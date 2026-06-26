const CHAVE_USUARIO = "saude_usuario";
const CHAVE_TOKEN = "saude_token";

function obterStorageSessao() {
  return typeof sessionStorage === "undefined" ? localStorage : sessionStorage;
}

function salvarUsuarioSessao(usuario, token = "") {
  obterStorageSessao().setItem(CHAVE_USUARIO, JSON.stringify(usuario));
  if (token) {
    obterStorageSessao().setItem(CHAVE_TOKEN, token);
  }
}

function removerUsuarioSessao() {
  obterStorageSessao().removeItem(CHAVE_USUARIO);
  obterStorageSessao().removeItem(CHAVE_TOKEN);
  localStorage.removeItem(CHAVE_USUARIO);
  localStorage.removeItem(CHAVE_TOKEN);
}

function existeUsuarioSessao() {
  return !!obterStorageSessao().getItem(CHAVE_USUARIO);
}

function obterUsuarioSessao() {
  const dados = obterStorageSessao().getItem(CHAVE_USUARIO);
  if (!dados) return null;

  try {
    return JSON.parse(dados);
  } catch {
    removerUsuarioSessao();
    return null;
  }
}

function obterTokenSessao() {
  return obterStorageSessao().getItem(CHAVE_TOKEN) || "";
}

export {
  CHAVE_TOKEN,
  CHAVE_USUARIO,
  salvarUsuarioSessao,
  removerUsuarioSessao,
  existeUsuarioSessao,
  obterUsuarioSessao,
  obterTokenSessao,
};
