import { NIVEIS_ACESSO, usuarioTemNivel } from "../../domain/auth/niveis-acesso";
import {
  autenticarUsuarioApi,
  confirmarRecuperacaoSenhaApi,
  encerrarSessaoApi,
  recuperarSenhaApi,
  solicitarRecuperacaoSenhaApi,
} from "../../infrastructure/api/auth-api";
import {
  existeUsuarioSessao,
  obterUsuarioSessao,
  removerUsuarioSessao,
  salvarUsuarioSessao,
} from "../../infrastructure/storage/sessao-usuario";

async function realizarLogin(email, senha) {
  try {
    const dados = await autenticarUsuarioApi(email, senha);
    salvarUsuarioSessao(dados.usuario, dados.token);
    return dados;
  } catch (erro) {
    throw new Error(erro.message || "Falha na conexao. Tente novamente.");
  }
}

async function recuperarSenha(email, novaSenha, codigoRecuperacao = "") {
  try {
    return await recuperarSenhaApi(email, novaSenha, codigoRecuperacao);
  } catch (erro) {
    throw new Error(erro.message || "Nao foi possivel recuperar a senha.");
  }
}

async function solicitarRecuperacaoSenha(email, canal = "") {
  try {
    return await solicitarRecuperacaoSenhaApi(email, canal);
  } catch (erro) {
    throw new Error(erro.message || "Nao foi possivel enviar o codigo.");
  }
}

async function confirmarRecuperacaoSenha(email, codigoRecuperacao, novaSenha) {
  try {
    return await confirmarRecuperacaoSenhaApi(email, codigoRecuperacao, novaSenha);
  } catch (erro) {
    throw new Error(erro.message || "Nao foi possivel atualizar a senha.");
  }
}

function registrarUsuarioAutenticado(usuario, token = "") {
  salvarUsuarioSessao(usuario, token);
}

function realizarLogout() {
  encerrarSessaoApi().catch(() => {});
  removerUsuarioSessao();
  window.location.href = "/login";
}

function estaAutenticado() {
  return existeUsuarioSessao();
}

function obterUsuarioAtual() {
  return obterUsuarioSessao();
}

function temPermissao(nivelNecessario) {
  return usuarioTemNivel(obterUsuarioAtual(), nivelNecessario);
}

export {
  NIVEIS_ACESSO,
  confirmarRecuperacaoSenha,
  realizarLogin,
  recuperarSenha,
  registrarUsuarioAutenticado,
  realizarLogout,
  solicitarRecuperacaoSenha,
  estaAutenticado,
  obterUsuarioAtual,
  temPermissao,
};
