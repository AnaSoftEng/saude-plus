const { carregarEnv } = require("../backend/src/infrastructure/config/env");
const { criarServidorHttp } = require("../backend/src/infrastructure/http/create-server");
const { criarContainer } = require("../backend/src/main/container");

let server = null;

function obterServidor() {
  if (server) return server;

  const env = carregarEnv();
  const container = criarContainer(env);
  server = criarServidorHttp(container.useCases, env, {
    auditRepository: container.repositories.auditRepository,
  });

  return server;
}

module.exports = function handler(req, res) {
  obterServidor().emit("request", req, res);
};
