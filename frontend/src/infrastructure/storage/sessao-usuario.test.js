import {
  CHAVE_TOKEN,
  CHAVE_USUARIO,
  existeUsuarioSessao,
  obterTokenSessao,
  obterUsuarioSessao,
  removerUsuarioSessao,
  salvarUsuarioSessao,
} from "./sessao-usuario";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

test("salva e remove usuario e token da sessao", () => {
  salvarUsuarioSessao({ id: 1, nome: "Paciente" }, "token-local");

  expect(existeUsuarioSessao()).toBe(true);
  expect(obterUsuarioSessao()).toEqual({ id: 1, nome: "Paciente" });
  expect(obterTokenSessao()).toBe("token-local");
  expect(localStorage.getItem(CHAVE_TOKEN)).toBeNull();

  removerUsuarioSessao();

  expect(existeUsuarioSessao()).toBe(false);
  expect(obterTokenSessao()).toBe("");
});

test("limpa sessao corrompida em vez de quebrar a aplicacao", () => {
  sessionStorage.setItem(CHAVE_USUARIO, "{json-invalido");
  sessionStorage.setItem(CHAVE_TOKEN, "token-local");

  expect(obterUsuarioSessao()).toBeNull();
  expect(sessionStorage.getItem(CHAVE_USUARIO)).toBeNull();
  expect(sessionStorage.getItem(CHAVE_TOKEN)).toBeNull();
});
