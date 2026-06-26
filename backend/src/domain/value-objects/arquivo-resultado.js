const { AppError } = require("../errors/app-error");

const TAMANHO_MAXIMO_ARQUIVO_BYTES = 2 * 1024 * 1024;
const TAMANHO_MAXIMO_DATA_URL = 3 * 1024 * 1024;
const TIPOS_PERMITIDOS = new Map([
  ["application/pdf", [".pdf"]],
  ["image/png", [".png"]],
  ["image/jpeg", [".jpg", ".jpeg"]],
  ["text/plain", [".txt"]],
]);

function sanitizarNomeArquivo(nomeArquivo, fallback = "resultado.pdf") {
  const base = String(nomeArquivo || fallback)
    .replace(/[\\/]/g, "-")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"|?*]/g, "-")
    .trim()
    .slice(0, 160);

  return base || fallback;
}

function normalizarTipoArquivo(tipoArquivo = "") {
  const tipo = String(tipoArquivo || "").split(";")[0].trim().toLowerCase();
  return tipo;
}

function extrairTipoDataUrl(dataUrl = "") {
  const match = /^data:([^;,]+);base64,[a-z0-9+/=\s_-]*$/i.exec(String(dataUrl || ""));
  return match?.[1]?.toLowerCase() || "";
}

function validarExtensao(nomeArquivo, tipoArquivo) {
  const extensoes = TIPOS_PERMITIDOS.get(tipoArquivo);
  if (!extensoes) return false;
  const nome = String(nomeArquivo || "").toLowerCase();
  return extensoes.some((extensao) => nome.endsWith(extensao));
}

function validarArquivoResultado(arquivo = {}, opcoes = {}) {
  const fallbackNome = opcoes.fallbackNome || "resultado.pdf";
  const nomeArquivo = sanitizarNomeArquivo(
    arquivo.nomeArquivo || arquivo.resultado_nome_arquivo,
    fallbackNome
  );
  const tipoArquivo = normalizarTipoArquivo(
    arquivo.tipoArquivo || arquivo.resultado_arquivo_tipo || "application/pdf"
  );
  const arquivoDataUrl = String(arquivo.arquivoDataUrl || arquivo.resultado_arquivo_data_url || "");
  const tamanhoArquivo = Number(arquivo.tamanhoArquivo || arquivo.resultado_arquivo_tamanho || 0);

  if (!arquivoDataUrl) {
    throw new AppError("Informe o conteudo do arquivo para anexar ao resultado.", 422, "ARQUIVO_INVALIDO");
  }

  if (!TIPOS_PERMITIDOS.has(tipoArquivo)) {
    throw new AppError("Tipo de arquivo nao permitido para resultado.", 415, "ARQUIVO_TIPO_NAO_PERMITIDO");
  }

  if (!validarExtensao(nomeArquivo, tipoArquivo)) {
    throw new AppError("Extensao do arquivo nao corresponde ao tipo informado.", 422, "ARQUIVO_EXTENSAO_INVALIDA");
  }

  if (tamanhoArquivo <= 0) {
    throw new AppError("Tamanho do arquivo invalido.", 422, "ARQUIVO_INVALIDO");
  }

  if (tamanhoArquivo > TAMANHO_MAXIMO_ARQUIVO_BYTES || arquivoDataUrl.length > TAMANHO_MAXIMO_DATA_URL) {
    throw new AppError("O arquivo do resultado excede o tamanho permitido.", 413, "ARQUIVO_MUITO_GRANDE");
  }

  const tipoDataUrl = extrairTipoDataUrl(arquivoDataUrl);
  if (!tipoDataUrl || tipoDataUrl !== tipoArquivo) {
    throw new AppError("Conteudo do arquivo nao corresponde ao tipo informado.", 422, "ARQUIVO_CONTEUDO_INVALIDO");
  }

  return {
    nomeArquivo,
    tipoArquivo,
    arquivoDataUrl,
    tamanhoArquivo,
  };
}

module.exports = {
  TAMANHO_MAXIMO_ARQUIVO_BYTES,
  TAMANHO_MAXIMO_DATA_URL,
  TIPOS_PERMITIDOS,
  sanitizarNomeArquivo,
  validarArquivoResultado,
};
