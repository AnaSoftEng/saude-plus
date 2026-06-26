const { AppError } = require("../../domain/errors/app-error");
const { montarHeadersSeguranca } = require("./http-security");

function montarHeadersCors(req, env = {}) {
  const origin = req?.headers?.origin;
  const originsPermitidas = env.corsOrigins || [];
  const originPermitida = origin && originsPermitidas.includes(origin) ? origin : originsPermitidas[0];

  return {
    "Access-Control-Allow-Origin": originPermitida || "http://localhost:3000",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

function montarCookieSessao(token, env = {}) {
  const maxAge = Number(env.tokenTtlSegundos || 60 * 60 * 8);
  const partes = [
    `${env.sessionCookieName || "saude_token"}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    `Max-Age=${maxAge}`,
    `SameSite=${env.cookieSameSite || "Lax"}`,
  ];

  if (env.cookieSecure) {
    partes.push("Secure");
  }

  return partes.join("; ");
}

function montarCookieSessaoExpirada(env = {}) {
  const partes = [
    `${env.sessionCookieName || "saude_token"}=`,
    "HttpOnly",
    "Path=/",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    `SameSite=${env.cookieSameSite || "Lax"}`,
  ];

  if (env.cookieSecure) {
    partes.push("Secure");
  }

  return partes.join("; ");
}

function enviarJson(res, statusCode, payload, req, env, opcoes = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...montarHeadersSeguranca(),
    ...montarHeadersCors(req, env),
    ...(opcoes.headers || {}),
  });
  res.end(JSON.stringify(payload));
}

function enviarSemConteudo(res, req, env) {
  res.writeHead(204, {
    ...montarHeadersSeguranca(),
    ...montarHeadersCors(req, env),
  });
  res.end();
}

function lerJson(req, env = {}) {
  return new Promise((resolve, reject) => {
    let body = "";
    let tamanhoBytes = 0;
    let limiteExcedido = false;
    const limiteBytes = Number(env.requestBodyLimitBytes || 10 * 1024 * 1024);

    req.on("data", (chunk) => {
      if (limiteExcedido) return;

      tamanhoBytes += chunk.length;
      if (tamanhoBytes > limiteBytes) {
        limiteExcedido = true;
        reject(new AppError("Corpo da requisicao excede o tamanho permitido.", 413, "JSON_MUITO_GRANDE"));
        req.pause();
        return;
      }

      body += chunk;
    });

    req.on("end", () => {
      if (limiteExcedido) return;

      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new AppError("Corpo da requisicao invalido.", 400, "JSON_INVALIDO"));
      }
    });

    req.on("error", reject);
  });
}

function tratarErro(res, erro, req, env) {
  const statusCode = erro.statusCode || 500;
  const mensagem = erro.statusCode ? erro.message : "Erro interno do servidor.";

  enviarJson(res, statusCode, {
    mensagem,
    codigo: erro.code || "ERRO_INTERNO",
  }, req, env);
}

module.exports = {
  enviarJson,
  enviarSemConteudo,
  lerJson,
  montarCookieSessao,
  montarCookieSessaoExpirada,
  tratarErro,
};
