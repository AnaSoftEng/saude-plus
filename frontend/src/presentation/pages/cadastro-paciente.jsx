import React, { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { realizarLogin } from "../../application/auth/auth-service";
import { salvarUsuario } from "../../application/usuarios/usuarios-use-cases";
import { buscarEnderecoPorCep } from "../../infrastructure/api/cep-api";
import LogoSaudePlus from "../components/logo-saude-plus";

const FORMULARIO_INICIAL = {
  nome: "",
  email: "",
  cpf: "",
  telefone: "",
  cep: "",
  endereco: "",
  bairro: "",
  cidade: "",
  estado: "",
  senha: "",
  confirmarSenha: "",
};

function somenteNumeros(valor) {
  return valor.replace(/\D/g, "");
}

function formatarCpf(valor) {
  const numeros = somenteNumeros(valor).slice(0, 11);
  return numeros
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function formatarTelefone(valor) {
  const numeros = somenteNumeros(valor).slice(0, 11);

  if (numeros.length <= 10) {
    return numeros
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  return numeros
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

function formatarCep(valor) {
  const numeros = somenteNumeros(valor).slice(0, 8);
  return numeros.replace(/(\d{5})(\d)/, "$1-$2");
}

function validarFormulario(formulario) {
  const cpfNumeros = somenteNumeros(formulario.cpf);
  const telefoneNumeros = somenteNumeros(formulario.telefone);
  const cepNumeros = somenteNumeros(formulario.cep);
  const possuiCampoVazio = Object.values(formulario).some(
    (valor) => !valor.trim()
  );

  if (possuiCampoVazio) return "Preencha todos os campos para finalizar seu cadastro.";
  if (!formulario.nome.trim()) return "Digite seu nome completo.";
  if (!formulario.email.trim()) return "Digite seu e-mail.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formulario.email)) {
    return "Digite um e-mail válido.";
  }
  if (cpfNumeros.length !== 11) return "Digite um CPF com 11 dígitos.";
  if (telefoneNumeros.length < 10) return "Digite um telefone com DDD.";
  if (cepNumeros.length !== 8) return "Digite um CEP com 8 dígitos.";
  if (formulario.senha.length < 8) {
    return "Use uma senha com pelo menos 8 caracteres.";
  }
  if (formulario.senha !== formulario.confirmarSenha) {
    return "A confirmação precisa ser igual à senha.";
  }

  return "";
}

function CadastroPaciente() {
  const navigate = useNavigate();
  const [formulario, setFormulario] = useState(FORMULARIO_INICIAL);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const estiloInput =
    "mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm transition hover:border-blue-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-400";

  function alterarCampo(campo, valor) {
    const normalizadores = {
      cpf: formatarCpf,
      telefone: formatarTelefone,
      cep: formatarCep,
      estado: (v) => v.toUpperCase().slice(0, 2),
    };

    setFormulario((atual) => ({
      ...atual,
      [campo]: normalizadores[campo] ? normalizadores[campo](valor) : valor,
    }));
  }

  async function preencherEnderecoPorCep() {
    const cepNumeros = somenteNumeros(formulario.cep);
    if (cepNumeros.length !== 8) return;

    setBuscandoCep(true);
    setErro("");

    try {
      const endereco = await buscarEnderecoPorCep(cepNumeros);
      setFormulario((atual) => ({
        ...atual,
        cep: formatarCep(endereco.cep),
        endereco: endereco.endereco || atual.endereco,
        bairro: endereco.bairro || atual.bairro,
        cidade: endereco.cidade || atual.cidade,
        estado: endereco.estado || atual.estado,
      }));
    } catch (erroCep) {
      setErro(erroCep.message || "Não conseguimos buscar esse CEP agora. Você pode preencher o endereço manualmente.");
    } finally {
      setBuscandoCep(false);
    }
  }

  async function aoEnviar(evento) {
    evento.preventDefault();
    setErro("");
    setMensagem("");

    const mensagemErro = validarFormulario(formulario);
    if (mensagemErro) {
      setErro(mensagemErro);
      return;
    }

    setCarregando(true);

    try {
      await salvarUsuario({
        nome: formulario.nome.trim(),
        email: formulario.email.trim(),
        cpf: somenteNumeros(formulario.cpf),
        telefone: somenteNumeros(formulario.telefone),
        cep: somenteNumeros(formulario.cep),
        endereco: formulario.endereco.trim(),
        bairro: formulario.bairro.trim(),
        cidade: formulario.cidade.trim(),
        estado: formulario.estado.trim().toUpperCase(),
        senha: formulario.senha,
        nivel_acesso: "paciente",
        clinica_id: null,
        status: "ativo",
      });

      await realizarLogin(formulario.email.trim(), formulario.senha);
      setMensagem("Cadastro criado. Vamos abrir sua Área de paciente.");
      setTimeout(() => navigate("/paciente/inicio"), 700);
    } catch (erroSalvar) {
      setErro(erroSalvar.message || "Não conseguimos criar seu cadastro agora. Tente novamente em instantes.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-svh bg-gray-50 lg:flex">
      <section className="hidden w-1/2 flex-col items-center justify-center bg-gradient-to-br from-blue-400 to-blue-600 p-12 text-white lg:flex">
        <div className="text-center">
          <LogoSaudePlus className="mx-auto mb-6 shadow-xl" size="xl" />
          <h1 className="mb-3 text-5xl font-bold text-white">Saúde+</h1>
          <p className="mb-10 text-lg text-blue-100">
            Saúde na palma da mão
          </p>
          <p className="mx-auto max-w-xs text-sm leading-relaxed text-blue-200">
            Crie sua conta para agendar consultas, acompanhar exames e acessar seus atendimentos em um só lugar.
          </p>

          <div className="mx-auto mt-10 grid max-w-xs grid-cols-2 gap-3">
            {["Qualidade de Vida", "Saúde Elevada", "Sua Melhor Versão", "Viva melhor"].map(
              (item) => (
                <div
                  key={item}
                  className="flex items-center justify-center rounded-xl border border-white/70 bg-transparent px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-white/10"
                >
                  {item}
                </div>
              )
            )}
          </div>
        </div>
      </section>

      <main className="flex min-h-svh flex-1 items-center justify-center bg-gradient-to-b from-white-400 to-white-500 px-4 py-4 sm:px-6 sm:py-5 lg:min-h-0 lg:bg-gray-50 lg:p-5">
        <div className="w-full max-w-2xl">
          <div className="mb-4 text-center text-white lg:hidden">
            <LogoSaudePlus className="mx-auto mb-3" size="md" />
            <h1 className="text-2xl font-bold tracking-tight">Saúde+</h1>
            <p className="mt-1 text-xs text-blue-100">
              Saquarema - Secretaria de Saúde
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-xl sm:p-5 lg:border lg:border-gray-100 lg:shadow-sm">
            <div className="mb-4">
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  aria-label="Voltar para o login"
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-500 transition hover:bg-blue-100 hover:text-blue-600"
                >
                  <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                </Link>
                <h2 className="text-2xl font-bold text-gray-800">
                  Criar cadastro
                </h2>
              </div>
              <p className="mt-1 text-sm text-gray-500 sm:ml-[52px]">
                Use seus dados pessoais para acessar sua Área do paciente.
              </p>
            </div>

            <form onSubmit={aoEnviar} noValidate className="space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-gray-700">Nome</span>
                  <input
                    value={formulario.nome}
                    onChange={(evento) => alterarCampo("nome", evento.target.value)}
                    placeholder="Nome completo"
                    autoComplete="name"
                    className={estiloInput}
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-gray-700">E-mail</span>
                  <input
                    type="email"
                    value={formulario.email}
                    onChange={(evento) => alterarCampo("email", evento.target.value)}
                    placeholder="seu@email.com"
                    autoComplete="email"
                    className={estiloInput}
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-gray-700">CPF</span>
                  <input
                    value={formulario.cpf}
                    onChange={(evento) => alterarCampo("cpf", evento.target.value)}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                    autoComplete="off"
                    className={estiloInput}
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-gray-700">Telefone</span>
                  <input
                    value={formulario.telefone}
                    onChange={(evento) => alterarCampo("telefone", evento.target.value)}
                    placeholder="(22) 99999-9999"
                    inputMode="tel"
                    autoComplete="tel"
                    className={estiloInput}
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-gray-700">CEP</span>
                  <input
                    value={formulario.cep}
                    onChange={(evento) => alterarCampo("cep", evento.target.value)}
                    onBlur={preencherEnderecoPorCep}
                    placeholder="00000-000"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    className={estiloInput}
                  />
                  {buscandoCep && (
                    <span className="mt-1 block text-xs font-medium text-blue-500">
                      Buscando endereço...
                    </span>
                  )}
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-gray-700">Endereço</span>
                  <input
                    value={formulario.endereco}
                    onChange={(evento) => alterarCampo("endereco", evento.target.value)}
                    placeholder="Rua, avenida ou estrada"
                    autoComplete="street-address"
                    className={estiloInput}
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-gray-700">Bairro</span>
                  <input
                    value={formulario.bairro}
                    onChange={(evento) => alterarCampo("bairro", evento.target.value)}
                    placeholder="Bairro"
                    autoComplete="address-level3"
                    className={estiloInput}
                  />
                </label>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_84px]">
                  <label className="block">
                    <span className="text-xs font-semibold text-gray-700">Cidade</span>
                    <input
                      value={formulario.cidade}
                      onChange={(evento) => alterarCampo("cidade", evento.target.value)}
                      placeholder="Cidade"
                      autoComplete="address-level2"
                      className={estiloInput}
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-gray-700">UF</span>
                    <input
                      value={formulario.estado}
                      onChange={(evento) => alterarCampo("estado", evento.target.value)}
                      placeholder="RJ"
                      autoComplete="address-level1"
                      className={estiloInput}
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-xs font-semibold text-gray-700">Senha</span>
                  <input
                    type="password"
                    value={formulario.senha}
                    onChange={(evento) => alterarCampo("senha", evento.target.value)}
                    placeholder="Mínimo de 8 caracteres"
                    autoComplete="new-password"
                    className={estiloInput}
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-gray-700">
                    Confirmar senha
                  </span>
                  <input
                    type="password"
                    value={formulario.confirmarSenha}
                    onChange={(evento) =>
                      alterarCampo("confirmarSenha", evento.target.value)
                    }
                    placeholder="Repita sua senha"
                    autoComplete="new-password"
                    className={estiloInput}
                  />
                </label>
              </div>

              {erro && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
                  {erro}
                </p>
              )}

              {mensagem && (
                <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
                  {mensagem}
                </p>
              )}

              <button
                type="submit"
                disabled={carregando}
                className="w-full rounded-xl bg-blue-400 py-3 text-base font-bold text-white transition-all duration-200 hover:bg-blue-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {carregando ? "Criando sua conta..." : "Criar minha conta"}
              </button>
            </form>
          </div>

          <p className="mt-3 text-center text-xs text-blue-100 lg:text-gray-400">
            Sistema Saúde+ v1.0
          </p>
        </div>
      </main>
    </div>
  );
}

export default CadastroPaciente;
