import React, { useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  confirmarRecuperacaoSenha,
  realizarLogin,
  solicitarRecuperacaoSenha,
} from "../../application/auth/auth-service";
import { usarDispositivo } from "../../infrastructure/device/use-dispositivo";
import LogoSaudePlus from "../components/logo-saude-plus";

function emailValido(valor) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
}

function Login() {
  const navigate = useNavigate();
  const dispositivo = usarDispositivo();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState("");
  const [codigoRecuperacao, setCodigoRecuperacao] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const [modoRecuperacao, setModoRecuperacao] = useState(false);
  const [etapaRecuperacao, setEtapaRecuperacao] = useState("solicitar");
  const [canalRecuperacao, setCanalRecuperacao] = useState("email");

  function validarFormularioLogin() {
    if (!email.trim()) return "Por favor, informe seu e-mail.";
    if (!emailValido(email)) {
      return "E-mail invalido. Verifique e tente novamente.";
    }
    if (!senha) return "Por favor, informe sua senha.";
    if (senha.length < 8) return "A senha deve ter pelo menos 8 caracteres.";
    return "";
  }

  function validarSolicitacaoRecuperacao() {
    if (!email.trim()) return "Informe o e-mail cadastrado.";
    if (!emailValido(email)) return "Informe um e-mail valido.";
    return "";
  }

  function validarConfirmacaoRecuperacao() {
    const codigoLimpo = codigoRecuperacao.trim();
    if (!email.trim()) return "Informe o e-mail cadastrado.";
    if (!emailValido(email)) return "Informe um e-mail valido.";
    if (codigoLimpo.length < 6) return "Informe o codigo recebido.";
    if (novaSenha.length < 8) {
      return "A nova senha deve ter pelo menos 8 caracteres.";
    }
    if (novaSenha !== confirmarNovaSenha) {
      return "A confirmacão de senha precisa ser igual a senha.";
    }
    return "";
  }

  async function aoEnviar(e) {
    e.preventDefault();
    setErro("");
    setMensagem("");

    const mensagemErro = validarFormularioLogin();
    if (mensagemErro) {
      setErro(mensagemErro);
      return;
    }

    setCarregando(true);
    try {
      const dados = await realizarLogin(email.trim(), senha);
      const nivelAcesso = dados.usuario?.nivel_acesso;

      const rotasPorNivel = {
        paciente: "/paciente/inicio",
        admin_clinica: "/admin/painel",
        admin_master: "/admin/master",
        medico: "/medico/agenda",
      };

      navigate(rotasPorNivel[nivelAcesso] || "/login");
    } catch (err) {
      setErro(err.message || "Erro ao fazer login");
    } finally {
      setCarregando(false);
    }
  }

  async function aoSolicitarCodigoRecuperacao(e) {
    e.preventDefault();
    setErro("");
    setMensagem("");

    const mensagemErro = validarSolicitacaoRecuperacao();
    if (mensagemErro) {
      setErro(mensagemErro);
      return;
    }

    setCarregando(true);
    try {
      const resultado = await solicitarRecuperacaoSenha(email.trim(), canalRecuperacao);
      setEtapaRecuperacao("confirmar");
      setMensagem(
        resultado.destinoMascarado
          ? `Codigo enviado para ${resultado.destinoMascarado}.`
          : resultado.mensagem || "Se o email estiver cadastrado, enviaremos um codigo."
      );
    } catch (err) {
      setErro(err.message || "Nao foi possivel enviar o codigo.");
    } finally {
      setCarregando(false);
    }
  }

  async function aoConfirmarRecuperacaoSenha(e) {
    e.preventDefault();
    setErro("");
    setMensagem("");

    const mensagemErro = validarConfirmacaoRecuperacao();
    if (mensagemErro) {
      setErro(mensagemErro);
      return;
    }

    setCarregando(true);
    try {
      const resultado = await confirmarRecuperacaoSenha(
        email.trim(),
        codigoRecuperacao.trim(),
        novaSenha
      );
      setSenha("");
      setNovaSenha("");
      setConfirmarNovaSenha("");
      setCodigoRecuperacao("");
      setModoRecuperacao(false);
      setMensagem(resultado.mensagem || "Senha atualizada. Entre com a nova senha.");
    } catch (err) {
      setErro(err.message || "Nao foi possivel recuperar a senha.");
    } finally {
      setCarregando(false);
    }
  }

  function abrirRecuperacao() {
    setErro("");
    setMensagem("");
    setEtapaRecuperacao("solicitar");
    setModoRecuperacao(true);
  }

  function voltarAoLogin() {
    setErro("");
    setMensagem("");
    setNovaSenha("");
    setConfirmarNovaSenha("");
    setCodigoRecuperacao("");
    setEtapaRecuperacao("solicitar");
    setCanalRecuperacao("email");
    setModoRecuperacao(false);
  }

  const aviso = (
    <>
      {erro && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-600">{erro}</p>
        </div>
      )}

      {mensagem && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-sm text-emerald-700">{mensagem}</p>
        </div>
      )}
    </>
  );

  const formularioLogin = (
    <form onSubmit={aoEnviar} noValidate>
      <div className="mb-5">
        <label className="mb-2 block text-sm font-semibold text-gray-700">
          E-mail
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={
            dispositivo.celular ? "seu@email.com" : "usuario@saquarema.rj.gov.br"
          }
          autoComplete="email"
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base text-gray-800 shadow-sm transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      <div className="mb-3">
        <label className="mb-2 block text-sm font-semibold text-gray-700">
          Senha
        </label>
        <div className="relative">
          <input
            type={senhaVisivel ? "text" : "password"}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Sua senha"
            autoComplete="current-password"
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 pr-14 text-base text-gray-800 shadow-sm transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            type="button"
            onClick={() => setSenhaVisivel((atual) => !atual)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-sm font-semibold text-gray-400 hover:bg-gray-50 hover:text-gray-600"
            aria-label={senhaVisivel ? "Ocultar senha" : "Mostrar senha"}
          >
            {senhaVisivel ? "Ocultar" : "Ver"}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={abrirRecuperacao}
        className="mb-5 text-sm font-semibold text-blue-500 hover:text-blue-600 hover:underline"
      >
        Esqueceu a senha?
      </button>

      {aviso}

      <button
        type="submit"
        disabled={carregando}
        className="w-full rounded-xl bg-blue-400 py-3.5 text-base font-bold text-white shadow-md transition-all duration-200 hover:bg-blue-500 hover:shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {carregando ? "Entrando..." : "Entrar"}
      </button>

      <Link
        to="/cadastro"
        className="mt-4 block w-full rounded-xl border border-blue-200 py-3 text-center font-bold text-blue-500 transition hover:bg-blue-50"
      >
        {dispositivo.celular ? "Cadastre-se" : "Cadastre-se"}
      </Link>
    </form>
  );

  const formularioRecuperacao = (
    <form
      onSubmit={
        etapaRecuperacao === "solicitar"
          ? aoSolicitarCodigoRecuperacao
          : aoConfirmarRecuperacaoSenha
      }
      noValidate
    >
      <div className="mb-5">
        <label className="mb-2 block text-sm font-semibold text-gray-700">
          E-mail cadastrado
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          autoComplete="email"
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base text-gray-800 shadow-sm transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {etapaRecuperacao === "solicitar" && (
        <div className="mb-6">
          <p className="mb-2 block text-sm font-semibold text-gray-700">
            Receber codigo por
          </p>
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-50 p-1">
            {[
              { valor: "email", label: "E-mail" },
              { valor: "sms", label: "SMS" },
            ].map((opcao) => (
              <button
                key={opcao.valor}
                type="button"
                onClick={() => setCanalRecuperacao(opcao.valor)}
                className={`rounded-lg px-3 py-2 text-sm font-bold transition ${
                  canalRecuperacao === opcao.valor
                    ? "bg-blue-400 text-white shadow-sm"
                    : "text-gray-500 hover:bg-white"
                }`}
              >
                {opcao.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {etapaRecuperacao === "confirmar" && (
        <>
          <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
            <p className="text-sm font-semibold text-blue-700">
              Codigo solicitado por {canalRecuperacao === "sms" ? "SMS" : "e-mail"}.
            </p>
            <button
              type="button"
              onClick={() => {
                setEtapaRecuperacao("solicitar");
                setMensagem("");
                setErro("");
              }}
              className="mt-1 text-xs font-bold text-blue-600 hover:underline"
            >
              Escolher outro canal
            </button>
          </div>

          <div className="mb-5">
            <label className="mb-2 block text-sm font-semibold text-gray-700">
              Codigo recebido
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={codigoRecuperacao}
              onChange={(e) => setCodigoRecuperacao(e.target.value)}
              placeholder="000000"
              autoComplete="one-time-code"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base text-gray-800 shadow-sm transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div className="mb-5">
            <label className="mb-2 block text-sm font-semibold text-gray-700">
              Nova senha
            </label>
            <input
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="Minimo de 8 caracteres"
              autoComplete="new-password"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base text-gray-800 shadow-sm transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div className="mb-6">
            <label className="mb-2 block text-sm font-semibold text-gray-700">
              Confirmar nova senha
            </label>
            <input
              type="password"
              value={confirmarNovaSenha}
              onChange={(e) => setConfirmarNovaSenha(e.target.value)}
              placeholder="Repita a nova senha"
              autoComplete="new-password"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base text-gray-800 shadow-sm transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </>
      )}

      {aviso}

      <button
        type="submit"
        disabled={carregando}
        className="w-full rounded-xl bg-blue-400 py-3.5 text-base font-bold text-white shadow-md transition-all duration-200 hover:bg-blue-500 hover:shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {carregando
          ? etapaRecuperacao === "solicitar"
            ? "Enviando..."
            : "Atualizando..."
          : etapaRecuperacao === "solicitar"
            ? "Enviar codigo"
            : "Atualizar senha"}
      </button>

      {etapaRecuperacao === "confirmar" && (
        <button
          type="button"
          onClick={aoSolicitarCodigoRecuperacao}
          disabled={carregando}
          className="mt-3 w-full rounded-xl border border-gray-200 py-3 text-center font-bold text-gray-500 transition hover:bg-gray-50 disabled:opacity-60"
        >
          Reenviar codigo
        </button>
      )}

      <button
        type="button"
        onClick={voltarAoLogin}
        className="mt-4 w-full rounded-xl border border-blue-200 py-3 text-center font-bold text-blue-500 transition hover:bg-blue-50"
      >
        Voltar ao login
      </button>
    </form>
  );

  const formulario = modoRecuperacao ? formularioRecuperacao : formularioLogin;
  const tituloFormulario = modoRecuperacao ? "Recuperar senha" : "Bem-vindo!";
  const descricaoFormulario = modoRecuperacao
    ? "Informe seu e-mail e defina uma nova senha."
    : "Faca login para agendar sua consulta.";

  if (dispositivo.celular) {
    return (
      <div className="flex min-h-svh flex-col bg-gradient-to-b from-blue-400 to-blue-500">
        <div className="flex flex-1 flex-col items-center justify-center px-4 pb-8 pt-12">
          <div className="mb-10 text-center">
            <LogoSaudePlus className="mx-auto mb-4" size="lg" />
            <h1 className="text-3xl font-bold tracking-tight text-white">Saúde+</h1>
            <p className="mt-1 text-sm text-blue-100">
              Saquarema - Secretaria de Saude
            </p>
          </div>

          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="mb-1 text-xl font-bold text-gray-800">
              {tituloFormulario}
            </h2>
            <p className="mb-6 text-sm text-gray-500">{descricaoFormulario}</p>
            {formulario}
          </div>
        </div>

        <p className="pb-6 text-center text-xs text-blue-200">
          Prefeitura Municipal de Saquarema - 2025
        </p>
      </div>
    );
  }

  if (dispositivo.tablet) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-gradient-to-b from-blue-400 to-blue-500 p-6">
        <div className="grid w-full max-w-5xl grid-cols-[0.9fr_1.1fr] overflow-hidden rounded-3xl bg-white shadow-2xl">
          <section className="flex flex-col justify-center bg-blue-500 p-10 text-white">
            <LogoSaudePlus className="mb-6" size="lg" />
            <h1 className="text-4xl font-bold">Saude+</h1>
            <p className="mt-3 max-w-sm text-blue-100">
              Interface otimizada para tablets, com leitura ampla e toque confortavel.
            </p>
          </section>

          <section className="flex items-center justify-center p-10">
            <div className="w-full max-w-md">
              <h2 className="mb-2 text-3xl font-bold text-gray-800">
                {modoRecuperacao ? "Recuperar senha" : "Acesso ao Sistema"}
              </h2>
              <p className="mb-8 text-gray-500">
                {modoRecuperacao
                  ? "Defina uma nova senha para voltar ao sistema."
                  : "Area administrativa - Prefeitura de Saquarema"}
              </p>
              {formulario}
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh">
      <section className="flex w-1/2 flex-col items-center justify-center bg-gradient-to-br from-blue-400 to-blue-600 p-12">
        <div className="text-center">
          <LogoSaudePlus className="mx-auto mb-6 shadow-xl" size="xl" />
          <h1 className="mb-3 text-5xl font-bold text-white">Saúde+</h1>
          <p className="mb-10 text-lg text-blue-100">A sua saúde a um toque de distância</p>
          <p className="mx-auto max-w-xs text-sm leading-relaxed text-blue-200">Sistema de agendamento e gestão de consultas para a Secretaria de Saúde de Saquarema. Interface moderna, fácil de usar e otimizada para todos os dispositivos.
          </p>

          <div className="mx-auto mt-10 grid max-w-xs grid-cols-2 gap-3">
            {["Bacaxá", "Centro", "Sampaio Correia", "Vilatur"].map((bairro) => (
              <div
                key={bairro}
                className="flex items-center justify-center rounded-xl border border-white/70 bg-transparent px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-white/10"
              >
                {bairro}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-1 items-center justify-center bg-gray-50 p-8">
        <div className="w-full max-w-md">
          <h2 className="mb-2 text-3xl font-bold text-gray-800">
            {modoRecuperacao ? "Recuperar senha" : "Acesso ao sistema"}
          </h2>
          <p className="mb-8 text-gray-500">
            {modoRecuperacao
              ? "Informe seus dados para definir uma nova senha."
              : "Area administrativa - Prefeitura de Saquarema"}
          </p>
          {formulario}
          <p className="mt-8 text-center text-xs text-gray-400">
            Sistema Saude+ v1.0
          </p>
        </div>
      </section>
    </div>
  );
}

export default Login;
