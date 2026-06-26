import { requisitarJson } from "./http-client";

async function autenticarUsuarioApi(email, senha) {
  return requisitarJson("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, senha }),
  });
}

async function solicitarRecuperacaoSenhaApi(email, canal = "") {
  return requisitarJson("/api/auth/recuperar-senha/solicitar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, canal }),
  });
}

async function confirmarRecuperacaoSenhaApi(email, codigoRecuperacao, novaSenha) {
  return requisitarJson("/api/auth/recuperar-senha/confirmar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, codigoRecuperacao, novaSenha }),
  });
}

async function recuperarSenhaApi(email, novaSenha, codigoRecuperacao = "") {
  return requisitarJson("/api/auth/recuperar-senha", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, novaSenha, codigoRecuperacao }),
  });
}

async function encerrarSessaoApi() {
  return requisitarJson("/api/auth/logout", {
    method: "POST",
  });
}

export {
  autenticarUsuarioApi,
  confirmarRecuperacaoSenhaApi,
  encerrarSessaoApi,
  recuperarSenhaApi,
  solicitarRecuperacaoSenhaApi,
};
