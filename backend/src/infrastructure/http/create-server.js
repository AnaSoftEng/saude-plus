const http = require("http");
const {
  enviarJson,
  enviarSemConteudo,
  lerJson,
  montarCookieSessao,
  montarCookieSessaoExpirada,
  tratarErro,
} = require("./http-utils");
const { exigirOrigemSegura } = require("./http-security");
const { NIVEIS_ACESSO, temNivelNecessario } = require("../../domain/value-objects/niveis-acesso");
const { AppError } = require("../../domain/errors/app-error");
const { criarRateLimiter } = require("../security/rate-limiter");
const { verificarTokenSessao } = require("../security/tokens");

function normalizarPath(pathname) {
  return pathname.replace(/\/+$/, "") || "/";
}

function parseCookies(header = "") {
  return String(header || "")
    .split(";")
    .map((parte) => parte.trim())
    .filter(Boolean)
    .reduce((acc, parte) => {
      const separador = parte.indexOf("=");
      if (separador < 0) return acc;
      const chave = parte.slice(0, separador).trim();
      const valor = parte.slice(separador + 1).trim();
      acc[chave] = decodeURIComponent(valor);
      return acc;
    }, {});
}

function obterToken(req, env = {}) {
  const authorization = req.headers.authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (match?.[1]) return match[1];

  const cookies = parseCookies(req.headers.cookie);
  return cookies[env.sessionCookieName || "saude_token"] || "";
}

function autenticar(req, env) {
  const usuario = verificarTokenSessao(obterToken(req, env), { jwtSecret: env.jwtSecret });
  req.usuarioAutenticado = usuario;
  return usuario;
}

function exigirUsuario(req, env) {
  return autenticar(req, env);
}

function exigirNivel(req, env, nivelNecessario) {
  const usuario = exigirUsuario(req, env);
  if (!temNivelNecessario(usuario, nivelNecessario)) {
    throw new AppError("Voce nao tem permissao para acessar este recurso.", 403, "ACESSO_NEGADO");
  }
  return usuario;
}

function exigirClinicaDoUsuario(usuario, clinicaId) {
  if (
    usuario.nivel_acesso !== NIVEIS_ACESSO.ADMIN_MASTER &&
    Number(usuario.clinica_id) !== Number(clinicaId)
  ) {
    throw new AppError("Recurso fora da clinica vinculada ao usuario.", 403, "ACESSO_NEGADO");
  }
}

function obterMedicoPermitido(usuario, medicoId) {
  if (usuario.nivel_acesso !== NIVEIS_ACESSO.MEDICO) {
    return medicoId || null;
  }

  if (medicoId && Number(medicoId) !== Number(usuario.id)) {
    throw new AppError("Medico so pode listar seus proprios registros.", 403, "ACESSO_NEGADO");
  }

  return usuario.id;
}

function exigirPacienteExato(usuario) {
  if (usuario.nivel_acesso !== NIVEIS_ACESSO.PACIENTE) {
    throw new AppError("Apenas pacientes podem realizar esta acao.", 403, "ACESSO_NEGADO");
  }
}

function exigirListagemPacientePermitida(usuario, pacienteId, recurso) {
  if (usuario.nivel_acesso === NIVEIS_ACESSO.ADMIN_MASTER) return;

  if (
    usuario.nivel_acesso === NIVEIS_ACESSO.PACIENTE &&
    Number(pacienteId) === Number(usuario.id)
  ) {
    return;
  }

  throw new AppError(
    `${recurso} devem ser consultados pela propria conta ou pela clinica vinculada.`,
    403,
    "ACESSO_NEGADO"
  );
}

function autenticarOpcional(req, env) {
  const token = obterToken(req, env);
  return token ? autenticar(req, env) : null;
}

function registrarAcesso(req, res, iniciadoEm, auditRepository) {
  if (!auditRepository?.registrarAcesso) return;

  const duracaoMs = Date.now() - iniciadoEm;
  auditRepository
    .registrarAcesso({
      metodo: req.method,
      rota: req.url,
      statusCode: res.statusCode,
      usuarioId: req.usuarioAutenticado?.id || null,
      nivelAcesso: req.usuarioAutenticado?.nivel_acesso || null,
      ip: req.socket?.remoteAddress || "",
      userAgent: req.headers["user-agent"] || "",
      origin: req.headers.origin || "",
      duracaoMs,
    })
    .catch((erro) => {
      console.warn("Nao foi possivel registrar auditoria de acesso:", erro.message);
    });
}

function obterIpCliente(req) {
  const encaminhado = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return encaminhado || req.socket?.remoteAddress || "ip-desconhecido";
}

function criarServidorHttp(useCases, env = {}, opcoes = {}) {
  const authRateLimiter =
    opcoes.authRateLimiter ||
    criarRateLimiter({
      janelaMs: env.authRateLimitJanelaMs,
      maximoTentativas: env.authRateLimitMaxTentativas,
    });

  return http.createServer(async (req, res) => {
    const iniciadoEm = Date.now();
    res.on("finish", () => registrarAcesso(req, res, iniciadoEm, opcoes.auditRepository));

    try {
      if (req.method === "OPTIONS") {
        enviarSemConteudo(res, req, env);
        return;
      }

      exigirOrigemSegura(req, env);

      const url = new URL(req.url, "http://localhost");
      const pathname = normalizarPath(url.pathname);

      if (req.method === "GET" && (pathname === "/health" || pathname === "/api/health")) {
        enviarJson(res, 200, { status: "ok", service: "saude-plus-backend" }, req, env);
        return;
      }

      if (req.method === "POST" && pathname === "/api/auth/login") {
        authRateLimiter.consumir(`login:${obterIpCliente(req)}`);
        const body = await lerJson(req, env);
        const resultado = await useCases.autenticarUsuario(body);
        req.usuarioAutenticado = resultado.usuario;

        const headers = {};
        const payload = env.usarCookieSessao ? { usuario: resultado.usuario } : resultado;
        if (env.usarCookieSessao) {
          headers["Set-Cookie"] = montarCookieSessao(resultado.token, env);
        }

        enviarJson(res, 200, payload, req, env, { headers });
        return;
      }

      if (req.method === "POST" && pathname === "/api/auth/logout") {
        enviarJson(
          res,
          200,
          { ok: true },
          req,
          env,
          { headers: { "Set-Cookie": montarCookieSessaoExpirada(env) } }
        );
        return;
      }

      if (req.method === "POST" && pathname === "/api/auth/recuperar-senha") {
        authRateLimiter.consumir(`recuperar-senha-confirmar:${obterIpCliente(req)}`);
        const body = await lerJson(req, env);
        const confirmar = useCases.confirmarRecuperacaoSenha || useCases.recuperarSenha;
        const resultado = await confirmar(body);
        enviarJson(res, 200, resultado, req, env);
        return;
      }

      if (req.method === "POST" && pathname === "/api/auth/recuperar-senha/solicitar") {
        authRateLimiter.consumir(`recuperar-senha-solicitar:${obterIpCliente(req)}`);
        const body = await lerJson(req, env);
        const resultado = await useCases.solicitarRecuperacaoSenha(body);
        enviarJson(res, 200, resultado, req, env);
        return;
      }

      if (req.method === "POST" && pathname === "/api/auth/recuperar-senha/confirmar") {
        authRateLimiter.consumir(`recuperar-senha-confirmar:${obterIpCliente(req)}`);
        const body = await lerJson(req, env);
        const resultado = await useCases.confirmarRecuperacaoSenha(body);
        enviarJson(res, 200, resultado, req, env);
        return;
      }

      if (req.method === "GET" && pathname === "/api/clinicas") {
        exigirUsuario(req, env);
        const clinicas = await useCases.listarClinicas();
        enviarJson(res, 200, clinicas, req, env);
        return;
      }

      if (req.method === "POST" && pathname === "/api/clinicas") {
        exigirNivel(req, env, NIVEIS_ACESSO.ADMIN_MASTER);
        const body = await lerJson(req, env);
        const clinica = await useCases.salvarClinica(body);
        enviarJson(res, 201, clinica, req, env);
        return;
      }

      const clinicaMatch = /^\/api\/clinicas\/([^/]+)$/.exec(pathname);
      if (req.method === "GET" && clinicaMatch) {
        exigirUsuario(req, env);
        const clinica = await useCases.obterClinica(clinicaMatch[1]);
        enviarJson(res, 200, clinica, req, env);
        return;
      }

      if (req.method === "PUT" && clinicaMatch) {
        exigirNivel(req, env, NIVEIS_ACESSO.ADMIN_MASTER);
        const body = await lerJson(req, env);
        const clinica = await useCases.salvarClinica({ ...body, id: clinicaMatch[1] });
        enviarJson(res, 200, clinica, req, env);
        return;
      }

      if (req.method === "GET" && pathname === "/api/usuarios") {
        const usuario = exigirNivel(req, env, NIVEIS_ACESSO.MEDICO);
        const usuarios = await useCases.listarUsuarios({ usuario });
        enviarJson(res, 200, usuarios, req, env);
        return;
      }

      if (req.method === "POST" && pathname === "/api/usuarios") {
        const usuarioAutenticado = autenticarOpcional(req, env);
        const body = await lerJson(req, env);
        const usuario = await useCases.salvarUsuario(body, { usuario: usuarioAutenticado });
        enviarJson(res, 201, usuario, req, env);
        return;
      }

      if (req.method === "POST" && pathname === "/api/notificacoes/subscriptions") {
        const usuario = exigirUsuario(req, env);
        const body = await lerJson(req, env);
        const resultado = await useCases.salvarPushSubscription(body, usuario);
        enviarJson(res, 201, resultado, req, env);
        return;
      }

      const usuarioMatch = /^\/api\/usuarios\/([^/]+)$/.exec(pathname);
      if (req.method === "PUT" && usuarioMatch) {
        const usuarioAutenticado = exigirUsuario(req, env);
        const body = await lerJson(req, env);
        const usuario = await useCases.salvarUsuario(
          { ...body, id: usuarioMatch[1] },
          { usuario: usuarioAutenticado }
        );
        enviarJson(res, 200, usuario, req, env);
        return;
      }

      if (req.method === "GET" && pathname === "/api/relatorios/sistema") {
        exigirNivel(req, env, NIVEIS_ACESSO.ADMIN_MASTER);
        const relatorios = await useCases.obterRelatoriosSistema();
        enviarJson(res, 200, relatorios, req, env);
        return;
      }

      if (req.method === "GET" && pathname === "/api/relatorios/minha-clinica") {
        const usuario = exigirNivel(req, env, NIVEIS_ACESSO.ADMIN_CLINICA);
        if (!usuario.clinica_id) {
          throw new AppError("Usuario sem clinica vinculada.", 422, "CLINICA_AUSENTE");
        }
        const relatorio = await useCases.obterRelatorioClinica(usuario.clinica_id);
        enviarJson(res, 200, relatorio, req, env);
        return;
      }

      const relatorioClinicaMatch = /^\/api\/relatorios\/clinicas?\/([^/]+)$/.exec(pathname);
      if (req.method === "GET" && relatorioClinicaMatch) {
        const usuario = exigirNivel(req, env, NIVEIS_ACESSO.ADMIN_CLINICA);
        const clinicaId = decodeURIComponent(relatorioClinicaMatch[1]);
        exigirClinicaDoUsuario(usuario, clinicaId);
        const relatorio = await useCases.obterRelatorioClinica(clinicaId);
        enviarJson(res, 200, relatorio, req, env);
        return;
      }

      if (req.method === "GET" && pathname === "/api/agendas") {
        exigirUsuario(req, env);
        const horarios = await useCases.listarHorariosAgenda({
          clinicaId: url.searchParams.get("clinica"),
          data: url.searchParams.get("data"),
          medicoId: url.searchParams.get("medico"),
          especialidade: url.searchParams.get("especialidade") || "",
        });
        enviarJson(res, 200, horarios, req, env);
        return;
      }

      const verificarAgendaMatch = /^\/api\/agendas\/([^/]+)\/verificar$/.exec(pathname);
      if (req.method === "GET" && verificarAgendaMatch) {
        exigirUsuario(req, env);
        const resultado = await useCases.verificarDisponibilidade({
          agendaId: decodeURIComponent(verificarAgendaMatch[1]),
          medicoId: url.searchParams.get("medico"),
          especialidade: url.searchParams.get("especialidade") || "",
        });
        enviarJson(res, 200, resultado, req, env);
        return;
      }

      if (req.method === "POST" && pathname === "/api/consultas") {
        const usuario = exigirNivel(req, env, NIVEIS_ACESSO.PACIENTE);
        exigirPacienteExato(usuario);
        const body = await lerJson(req, env);
        if (
          Number(body.paciente_id) !== Number(usuario.id)
        ) {
          throw new AppError("Paciente so pode criar consulta para sua propria conta.", 403, "ACESSO_NEGADO");
        }
        const resultado = await useCases.criarConsulta(body);
        enviarJson(res, 201, resultado, req, env);
        return;
      }

      if (req.method === "GET" && pathname === "/api/consultas") {
        const usuario = exigirUsuario(req, env);
        const clinicaId = url.searchParams.get("clinica");
        const pacienteId = url.searchParams.get("paciente");
        const medicoId = obterMedicoPermitido(usuario, url.searchParams.get("medico"));
        if (clinicaId) {
          exigirClinicaDoUsuario(usuario, clinicaId);
        } else {
          exigirListagemPacientePermitida(usuario, pacienteId, "Consultas");
        }
        const consultas = clinicaId
          ? await useCases.listarConsultasClinica(clinicaId, { medicoId })
          : await useCases.listarConsultasPaciente(pacienteId);
        enviarJson(res, 200, consultas, req, env);
        return;
      }

      const cancelarConsultaMatch = /^\/api\/consultas\/([^/]+)\/cancelar$/.exec(pathname);
      if (req.method === "PATCH" && cancelarConsultaMatch) {
        const usuario = exigirUsuario(req, env);
        const body = await lerJson(req, env);
        const resultado = await useCases.cancelarConsulta({
          consultaId: cancelarConsultaMatch[1],
          motivo: body.motivo,
        }, { usuario });
        enviarJson(res, 200, resultado, req, env);
        return;
      }

      if (req.method === "POST" && pathname === "/api/exames") {
        const usuario = exigirUsuario(req, env);
        const body = await lerJson(req, env);
        if (
          usuario.nivel_acesso === NIVEIS_ACESSO.PACIENTE &&
          Number(body.paciente_id) !== Number(usuario.id)
        ) {
          throw new AppError("Paciente so pode criar exame para sua propria conta.", 403, "ACESSO_NEGADO");
        }
        if (
          [NIVEIS_ACESSO.ADMIN_CLINICA, NIVEIS_ACESSO.MEDICO].includes(usuario.nivel_acesso)
        ) {
          exigirClinicaDoUsuario(usuario, body.clinica_id);
        }
        const resultado = await useCases.criarExame(body);
        enviarJson(res, 201, resultado, req, env);
        return;
      }

      if (req.method === "GET" && pathname === "/api/exames") {
        const usuario = exigirUsuario(req, env);
        const clinicaId = url.searchParams.get("clinica");
        const pacienteId = url.searchParams.get("paciente");
        const medicoId = obterMedicoPermitido(usuario, url.searchParams.get("medico"));
        if (clinicaId) {
          exigirClinicaDoUsuario(usuario, clinicaId);
        } else {
          exigirListagemPacientePermitida(usuario, pacienteId, "Exames");
        }
        const exames = clinicaId
          ? await useCases.listarExamesClinica(clinicaId, { medicoId })
          : await useCases.listarExamesPaciente(pacienteId);
        enviarJson(res, 200, exames, req, env);
        return;
      }

      if (req.method === "PUT" && pathname === "/api/exames") {
        const usuario = exigirNivel(req, env, NIVEIS_ACESSO.ADMIN_CLINICA);
        exigirClinicaDoUsuario(usuario, url.searchParams.get("clinica"));
        const body = await lerJson(req, env);
        const resultado = await useCases.salvarExamesClinica({
          clinicaId: url.searchParams.get("clinica"),
          exames: body.exames,
        });
        enviarJson(res, 200, resultado, req, env);
        return;
      }

      const resultadoExameMatch = /^\/api\/exames\/([^/]+)\/resultado$/.exec(pathname);
      if (req.method === "PATCH" && resultadoExameMatch) {
        const usuario = exigirNivel(req, env, NIVEIS_ACESSO.MEDICO);
        const body = await lerJson(req, env);
        const resultado = await useCases.anexarResultadoExame({
          exameId: resultadoExameMatch[1],
          dadosResultado: body,
        }, { usuario });
        enviarJson(res, 200, resultado, req, env);
        return;
      }

      const exameMatch = /^\/api\/exames\/([^/]+)$/.exec(pathname);
      if (req.method === "DELETE" && exameMatch) {
        const usuario = exigirNivel(req, env, NIVEIS_ACESSO.ADMIN_CLINICA);
        const resultado = await useCases.excluirExame(exameMatch[1], { usuario });
        enviarJson(res, 200, resultado, req, env);
        return;
      }

      enviarJson(res, 404, { mensagem: "Rota nao encontrada.", codigo: "ROTA_NAO_ENCONTRADA" }, req, env);
    } catch (erro) {
      tratarErro(res, erro, req, env);
    }
  });
}

module.exports = { criarServidorHttp };
