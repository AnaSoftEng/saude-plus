const { AppError } = require("../../domain/errors/app-error");

function montarHeadersSeguranca() {
  return {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };
}

function origemPermitida(req, env = {}) {
  const origem = req.headers.origin || "";
  if (!origem) return true;
  return (env.corsOrigins || []).includes(origem);
}

function exigirOrigemSegura(req, env = {}) {
  const metodo = String(req.method || "").toUpperCase();
  const metodoSeguro = ["GET", "HEAD", "OPTIONS"].includes(metodo);
  if (metodoSeguro || !env.usarCookieSessao) return;

  if (!origemPermitida(req, env)) {
    throw new AppError("Origem nao permitida para esta requisicao.", 403, "ORIGEM_NAO_PERMITIDA");
  }
}

module.exports = { exigirOrigemSegura, montarHeadersSeguranca, origemPermitida };
