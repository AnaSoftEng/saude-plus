const crypto = require("crypto");
const { AppError } = require("../../domain/errors/app-error");
const validar = require("../../infrastructure/security/validacao");

const MENSAGEM_SOLICITACAO =
  "Se o email estiver cadastrado, enviaremos um codigo de recuperacao pelo canal vinculado a conta.";

function somenteNumeros(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function mascararEmail(email) {
  const [usuario, dominio] = String(email || "").split("@");
  if (!usuario || !dominio) return "";
  const inicio = usuario.slice(0, 2);
  return `${inicio}${"*".repeat(Math.max(usuario.length - 2, 3))}@${dominio}`;
}

function mascararTelefone(telefone) {
  const numeros = somenteNumeros(telefone);
  if (numeros.length < 4) return "";
  return `***${numeros.slice(-4)}`;
}

function gerarCodigo() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

function criarHashCodigo({ codigo, email, segredo }) {
  return crypto
    .createHmac("sha256", String(segredo || "dev-recovery-secret"))
    .update(`${String(email || "").toLowerCase()}:${codigo}`)
    .digest("hex");
}

function escolherCanal(usuario, canalPreferido, opcoes = {}) {
  const telefone = usuario.telefone || usuario.celular || usuario.phone || "";
  const telefoneNumeros = somenteNumeros(telefone);
  const smsDisponivel = opcoes.smsDisponivel || opcoes.modoDesenvolvimento;

  if (!["email", "sms"].includes(canalPreferido)) {
    throw new AppError("Escolha email ou SMS para receber o codigo.", 422, "CANAL_INVALIDO");
  }

  if (canalPreferido === "sms" && telefoneNumeros.length >= 10 && smsDisponivel) {
    return { tipo: "sms", destino: telefoneNumeros, destinoMascarado: mascararTelefone(telefone) };
  }

  if (canalPreferido === "sms") {
    throw new AppError(
      "Nao foi possivel enviar por SMS para esta conta. Escolha email.",
      422,
      "CANAL_RECUPERACAO_INDISPONIVEL"
    );
  }

  if (canalPreferido === "email") {
    return {
      tipo: "email",
      destino: usuario.email,
      destinoMascarado: mascararEmail(usuario.email),
    };
  }
}

function criarRecuperarSenha({
  usuarioRepository,
  recuperacaoSenhaRepository,
  recuperacaoSenhaSender,
  env = {},
  agora = () => new Date(),
  gerarCodigoRecuperacao = gerarCodigo,
}) {
  const ttlMinutos = Number(env.passwordRecoveryCodeTtlMinutes || 10);
  const maxTentativas = Number(env.passwordRecoveryMaxAttempts || 5);
  const intervaloReenvioMs = Number(env.passwordRecoveryResendIntervalSeconds || 45) * 1000;
  const segredo = env.recoverySecret || env.jwtSecret || "dev-recovery-secret";

  async function solicitarCodigo({ email, canal = "email" }) {
    const emailNormalizado = validar.email(email);
    const usuario = await usuarioRepository.buscarPorEmail(emailNormalizado);

    if (!usuario || usuario.status !== "ativo") {
      return { mensagem: MENSAGEM_SOLICITACAO };
    }

    const desafioAtual = await recuperacaoSenhaRepository.buscarPorEmail(emailNormalizado);
    const criadoEmMs = desafioAtual?.criadoEm ? new Date(desafioAtual.criadoEm).getTime() : 0;
    const restanteMs = criadoEmMs + intervaloReenvioMs - agora().getTime();

    if (restanteMs > 0) {
      throw new AppError(
        `Aguarde ${Math.ceil(restanteMs / 1000)} segundos para solicitar um novo codigo.`,
        429,
        "RECUPERACAO_REENVIO_LIMITADO"
      );
    }

    const codigo = gerarCodigoRecuperacao();
    const canalEntrega = escolherCanal(usuario, String(canal || "").toLowerCase(), {
      smsDisponivel: Boolean(env.passwordRecoverySmsWebhookUrl),
      modoDesenvolvimento: env.nodeEnv !== "production",
    });
    const expiraEm = new Date(agora().getTime() + ttlMinutos * 60 * 1000).toISOString();

    await recuperacaoSenhaRepository.salvar({
      email: emailNormalizado,
      usuarioId: usuario.id,
      codigoHash: criarHashCodigo({ codigo, email: emailNormalizado, segredo }),
      expiraEm,
      tentativas: 0,
      maxTentativas,
      canal: canalEntrega.tipo,
      destinoMascarado: canalEntrega.destinoMascarado,
      criadoEm: agora().toISOString(),
    });

    await recuperacaoSenhaSender.enviarCodigo({
      canal: canalEntrega.tipo,
      destino: canalEntrega.destino,
      destinoMascarado: canalEntrega.destinoMascarado,
      codigo,
      usuario,
      expiraEm,
    });

    return {
      mensagem: MENSAGEM_SOLICITACAO,
      canal: canalEntrega.tipo,
      destinoMascarado: canalEntrega.destinoMascarado,
      expiraEm,
    };
  }

  async function confirmarCodigo({ email, codigoRecuperacao, codigo, novaSenha }) {
    const emailNormalizado = validar.email(email);
    const codigoNormalizado = validar.texto(codigoRecuperacao || codigo, "Codigo", {
      min: 6,
      max: 12,
    });
    const senhaNormalizada = validar.senha(novaSenha);
    const desafio = await recuperacaoSenhaRepository.buscarPorEmail(emailNormalizado);

    if (!desafio) {
      throw new AppError("Codigo invalido ou expirado.", 401, "CODIGO_RECUPERACAO_INVALIDO");
    }

    if (new Date(desafio.expiraEm).getTime() < agora().getTime()) {
      await recuperacaoSenhaRepository.remover(emailNormalizado);
      throw new AppError("Codigo invalido ou expirado.", 401, "CODIGO_RECUPERACAO_INVALIDO");
    }

    if (Number(desafio.tentativas || 0) >= Number(desafio.maxTentativas || maxTentativas)) {
      await recuperacaoSenhaRepository.remover(emailNormalizado);
      throw new AppError("Codigo invalido ou expirado.", 401, "CODIGO_RECUPERACAO_INVALIDO");
    }

    const hashRecebido = criarHashCodigo({
      codigo: codigoNormalizado,
      email: emailNormalizado,
      segredo,
    });

    const hashEsperado = Buffer.from(desafio.codigoHash, "hex");
    const hashAtual = Buffer.from(hashRecebido, "hex");
    const codigoValido =
      hashEsperado.length === hashAtual.length && crypto.timingSafeEqual(hashEsperado, hashAtual);

    if (!codigoValido) {
      await recuperacaoSenhaRepository.incrementarTentativas(emailNormalizado);
      throw new AppError("Codigo invalido ou expirado.", 401, "CODIGO_RECUPERACAO_INVALIDO");
    }

    const usuario = await usuarioRepository.buscarPorEmail(emailNormalizado);
    if (!usuario || Number(usuario.id) !== Number(desafio.usuarioId) || usuario.status !== "ativo") {
      await recuperacaoSenhaRepository.remover(emailNormalizado);
      throw new AppError("Codigo invalido ou expirado.", 401, "CODIGO_RECUPERACAO_INVALIDO");
    }

    await usuarioRepository.atualizar(usuario.id, { senha: senhaNormalizada });
    await recuperacaoSenhaRepository.remover(emailNormalizado);

    return {
      mensagem: "Senha atualizada com sucesso. Use a nova senha para entrar.",
    };
  }

  async function recuperarSenhaLegado(dados) {
    return confirmarCodigo(dados);
  }

  recuperarSenhaLegado.solicitarCodigo = solicitarCodigo;
  recuperarSenhaLegado.confirmarCodigo = confirmarCodigo;

  return recuperarSenhaLegado;
}

module.exports = { criarRecuperarSenha };
