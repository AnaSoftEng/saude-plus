import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, MapPin, Trash2, Upload } from "lucide-react";
import { useNavigate } from "react-router";
import { ouvirConsultasAtualizadas } from "../../application/agenda/consultas-eventos";
import {
  alternarStatusClinica,
  listarClinicas,
  salvarClinica as salvarClinicaApi,
} from "../../application/clinicas/clinicas-use-cases";
import { ouvirClinicasAtualizadas } from "../../application/clinicas/clinicas-eventos";
import { ouvirExamesAtualizados } from "../../application/exames/exames-eventos";
import { obterRelatoriosSistema } from "../../application/sistema/relatorios-use-cases";
import {
  criarEnderecoClinica,
  geocodificarEndereco,
  obterStatusConfiguracaoGoogleMaps,
} from "../../infrastructure/api/mapas-api";
import CabecalhoApp from "../components/cabecalho-app";
import FotoClinica from "../components/foto-clinica";

const FORMULARIO_INICIAL = {
  nome: "",
  bairro: "",
  endereco: "",
  telefone: "",
  responsavel: "",
  especialidades: "",
  especialidadesExames: "",
  horario: "Seg a Sex: 07h as 17h",
  capacidadeDiaria: 40,
  status: "ativa",
  latitude: "",
  longitude: "",
  fotoPerfil: "",
};

function normalizarClinica(formulario, id = null) {
  return {
    id,
    nome: formulario.nome.trim(),
    bairro: formulario.bairro.trim(),
    endereco: formulario.endereco.trim(),
    telefone: formulario.telefone.trim(),
    responsavel: formulario.responsavel.trim(),
    especialidades: formulario.especialidades
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    especialidadesExames: formulario.especialidadesExames
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    horario: formulario.horario.trim(),
    capacidadeDiaria: Number(formulario.capacidadeDiaria) || 0,
    status: formulario.status,
    aberta: formulario.status === "ativa",
    emoji: "+",
    latitude: formulario.latitude !== "" ? Number(formulario.latitude) : undefined,
    longitude: formulario.longitude !== "" ? Number(formulario.longitude) : undefined,
    fotoPerfil: formulario.fotoPerfil || "",
  };
}

function arquivoParaDataUrl(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result);
    leitor.onerror = reject;
    leitor.readAsDataURL(arquivo);
  });
}

function coordenadasValidas(formulario) {
  const latitude = Number(formulario.latitude);
  const longitude = Number(formulario.longitude);

  return (
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function AdminGerenciarClinicas() {
  const navigate = useNavigate();
  const [clinicas, setClinicas] = useState([]);
  const [formulario, setFormulario] = useState(FORMULARIO_INICIAL);
  const [clinicaEditandoId, setClinicaEditandoId] = useState(null);
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [geocodificando, setGeocodificando] = useState(false);
  const [relatorio, setRelatorio] = useState(null);
  const ultimaCargaRef = useRef(0);

  const carregarClinicas = useCallback(async ({ silencioso = false } = {}) => {
    const cargaAtual = ultimaCargaRef.current + 1;
    ultimaCargaRef.current = cargaAtual;

    if (!silencioso) {
      setCarregando(true);
      setMensagem("");
    }

    try {
      const [listaClinicas, relatorioSistema] = await Promise.all([
        listarClinicas(),
        obterRelatoriosSistema(),
      ]);

      if (ultimaCargaRef.current !== cargaAtual) return;

      setClinicas(listaClinicas);
      setRelatorio(relatorioSistema);
    } catch (erro) {
      if (!silencioso) {
        setMensagem(erro.message || "Não conseguimos carregar as clínicas agora.");
      }
    } finally {
      if (ultimaCargaRef.current === cargaAtual) {
        setCarregando(false);
      }
    }
  }, []);

  useEffect(() => {
    carregarClinicas();
  }, [carregarClinicas]);

  useEffect(() => ouvirClinicasAtualizadas(() => carregarClinicas({ silencioso: true })), [
    carregarClinicas,
  ]);
  useEffect(() => ouvirConsultasAtualizadas(() => carregarClinicas({ silencioso: true })), [
    carregarClinicas,
  ]);
  useEffect(() => ouvirExamesAtualizados(() => carregarClinicas({ silencioso: true })), [
    carregarClinicas,
  ]);

  useEffect(() => {
    function recarregarAoVoltar() {
      if (document.visibilityState === "visible") {
        carregarClinicas({ silencioso: true });
      }
    }

    document.addEventListener("visibilitychange", recarregarAoVoltar);
    window.addEventListener("focus", recarregarAoVoltar);

    return () => {
      document.removeEventListener("visibilitychange", recarregarAoVoltar);
      window.removeEventListener("focus", recarregarAoVoltar);
    };
  }, [carregarClinicas]);

  const clinicasComIndicadores = useMemo(() => {
    const indicadoresPorClinica = new Map(
      (relatorio?.porClinica || []).map((item) => [Number(item.id), item])
    );

    return clinicas.map((clinica) => {
      const indicadores = indicadoresPorClinica.get(Number(clinica.id)) || {};

      return {
        ...clinica,
        atendimentosMes: Number(indicadores.atendimentosMes || 0),
        ocupacao: Number(indicadores.ocupacao || 0),
      };
    });
  }, [clinicas, relatorio]);

  const resumo = useMemo(() => {
    const ativas = clinicasComIndicadores.filter((clinica) => clinica.status === "ativa").length;
    const atendimentosPorDia = clinicasComIndicadores.reduce(
      (total, clinica) => total + Number(clinica.capacidadeDiaria || 0),
      0
    );
    const atendimentos = Number(relatorio?.resumo?.agendamentosMes || 0);

    return { ativas, atendimentosPorDia, atendimentos };
  }, [clinicasComIndicadores, relatorio]);

  function alterarCampo(campo, valor) {
    setFormulario((atual) => {
      if (campo === "endereco" || campo === "bairro") {
        return { ...atual, [campo]: valor, latitude: "", longitude: "" };
      }

      return { ...atual, [campo]: valor };
    });
  }

  function limparFormulario() {
    setFormulario(FORMULARIO_INICIAL);
    setClinicaEditandoId(null);
  }

  async function obterFormularioComCoordenadas(formularioAtual) {
    if (coordenadasValidas(formularioAtual)) {
      return formularioAtual;
    }

    const endereco = criarEnderecoClinica(formularioAtual);

    if (!formularioAtual.endereco.trim() && !formularioAtual.bairro.trim()) {
      throw new Error("Informe endereço ou bairro para buscar as coordenadas.");
    }

    const configuracaoGoogleMaps = obterStatusConfiguracaoGoogleMaps();

    if (!configuracaoGoogleMaps.pronta) {
      throw new Error(`${configuracaoGoogleMaps.mensagem} Ou preencha latitude e longitude manualmente.`);
    }

    const coordenadas = await geocodificarEndereco(endereco);

    return {
      ...formularioAtual,
      latitude: String(coordenadas.latitude),
      longitude: String(coordenadas.longitude),
    };
  }

  async function preencherCoordenadasPorEndereco() {
    setMensagem("");
    setGeocodificando(true);

    try {
      const formularioComCoordenadas = await obterFormularioComCoordenadas({
        ...formulario,
        latitude: "",
        longitude: "",
      });

      setFormulario(formularioComCoordenadas);
      setMensagem("Coordenadas preenchidas pelo Google Maps.");
    } catch (erro) {
      setMensagem(erro.message || "Não conseguimos buscar as coordenadas agora.");
    } finally {
      setGeocodificando(false);
    }
  }

  async function selecionarFotoPerfil(evento) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = "";

    if (!arquivo) return;

    if (!arquivo.type.startsWith("image/")) {
      setMensagem("Selecione um arquivo de imagem para a foto da clínica.");
      return;
    }

    if (arquivo.size > 1024 * 1024) {
      setMensagem("Use uma imagem de até 1 MB para manter o app rápido.");
      return;
    }

    try {
      const fotoPerfil = await arquivoParaDataUrl(arquivo);
      alterarCampo("fotoPerfil", fotoPerfil);
      setMensagem("");
    } catch {
      setMensagem("Não conseguimos carregar a imagem selecionada.");
    }
  }

  async function salvarClinica(evento) {
    evento.preventDefault();
    setMensagem("");

    if (!formulario.nome.trim() || !formulario.bairro.trim()) {
      setMensagem("Informe pelo menos o nome e o bairro da clínica.");
      return;
    }

    try {
      setGeocodificando(true);
      setMensagem("Conferindo as coordenadas da clínica...");
      const formularioParaSalvar = await obterFormularioComCoordenadas(formulario);

      setFormulario(formularioParaSalvar);
      await salvarClinicaApi(normalizarClinica(formularioParaSalvar, clinicaEditandoId));
      setMensagem(clinicaEditandoId ? "Clínica atualizada com sucesso." : "Clínica adicionada com sucesso.");
      limparFormulario();
      await carregarClinicas();
    } catch (erro) {
      setMensagem(erro.message || "Não conseguimos salvar a clínica agora.");
    } finally {
      setGeocodificando(false);
    }
  }

  function editarClinica(clinica) {
    setClinicaEditandoId(clinica.id);
    setFormulario({
      nome: clinica.nome,
      bairro: clinica.bairro,
      endereco: clinica.endereco,
      telefone: clinica.telefone,
      responsavel: clinica.responsavel || "",
      especialidades: (clinica.especialidades || []).join(", "),
      especialidadesExames: (clinica.especialidadesExames || []).join(", "),
      horario: clinica.horario,
      capacidadeDiaria: clinica.capacidadeDiaria,
      status: clinica.status,
      latitude: clinica.latitude ?? "",
      longitude: clinica.longitude ?? "",
      fotoPerfil: clinica.fotoPerfil || "",
    });
    setMensagem("");
  }

  async function alternarStatus(clinicaId) {
    const clinica = clinicas.find((item) => item.id === clinicaId);
    if (!clinica) return;

    try {
      await alternarStatusClinica(clinica);
      await carregarClinicas();
    } catch (erro) {
      setMensagem(erro.message || "Não conseguimos alterar o status agora.");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CabecalhoApp
        compacto
        aoVoltar={() => navigate("/admin/master")}
        textoVoltar="Voltar ao painel"
        voltarSomenteIcone
        titulo="Gerenciar clínicas"
        descricao="Cadastre, edite e acompanhe as unidades de saúde do município."
      />

      <main className="app-content space-y-5">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-gray-500 text-sm">Clínicas ativas</p>
            <strong className="text-3xl text-gray-800">{resumo.ativas}</strong>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-gray-500 text-sm">Atendimentos médicos/dia</p>
            <strong className="text-3xl text-gray-800">{resumo.atendimentosPorDia}</strong>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-gray-500 text-sm">Atendimentos no mês</p>
            <strong className="text-3xl text-gray-800">{resumo.atendimentos}</strong>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5">
          <form
            onSubmit={salvarClinica}
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3"
          >
            <div>
              <h2 className="text-xl font-semibold text-gray-800">
                {clinicaEditandoId ? "Editar unidade" : "Nova unidade"}
              </h2>
              <p className="text-gray-500 text-sm">
                Essas informações aparecem no painel principal.
              </p>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-gray-800">Foto da clínica</p>
                  <p className="text-xs text-gray-500">
                    Usada como foto de perfil nos cards da unidade.
                  </p>
                </div>
                <ImagePlus className="h-5 w-5 flex-shrink-0 text-blue-400" aria-hidden="true" />
              </div>

              <div className="flex items-center gap-3">
                <FotoClinica
                  src={formulario.fotoPerfil}
                  nome={formulario.nome}
                  className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-blue-50 text-2xl font-bold text-blue-500"
                  conteudoVazio={<span className="text-4xl leading-none">+</span>}
                />

                <div className="min-w-0 flex-1 space-y-2">
                  <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-blue-600 shadow-sm ring-1 ring-gray-100 transition hover:bg-blue-50">
                    <Upload className="h-4 w-4" aria-hidden="true" />
                    Enviar foto
                    <input
                      type="file"
                      accept="image/*"
                      onChange={selecionarFotoPerfil}
                      className="sr-only"
                    />
                  </label>

                  {formulario.fotoPerfil && (
                    <button
                      type="button"
                      onClick={() => alterarCampo("fotoPerfil", "")}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-100"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Remover foto
                    </button>
                  )}
                </div>
              </div>
            </div>

            <input
              value={formulario.nome}
              onChange={(evento) => alterarCampo("nome", evento.target.value)}
              placeholder="Nome da clínica"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <input
              value={formulario.bairro}
              onChange={(evento) => alterarCampo("bairro", evento.target.value)}
              placeholder="Bairro"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <input
              value={formulario.endereco}
              onChange={(evento) => alterarCampo("endereco", evento.target.value)}
              placeholder="Endereço completo"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">
                  Latitude
                </span>
                <input
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  value={formulario.latitude}
                  onChange={(evento) => alterarCampo("latitude", evento.target.value)}
                  placeholder="-22.9324"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">
                  Longitude
                </span>
                <input
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  value={formulario.longitude}
                  onChange={(evento) => alterarCampo("longitude", evento.target.value)}
                  placeholder="-42.4876"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </label>
            </div>
            <p className="text-xs text-gray-400">
              Quando a chave do Google Maps está configurada, o sistema preenche as coordenadas pelo endereço ao salvar.
            </p>
            <button
              type="button"
              onClick={preencherCoordenadasPorEndereco}
              disabled={geocodificando}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-600 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
            >
              <MapPin className="h-4 w-4" aria-hidden="true" />
              {geocodificando ? "Buscando coordenadas..." : "Preencher pelo endereço"}
            </button>
            <input
              value={formulario.telefone}
              onChange={(evento) => alterarCampo("telefone", evento.target.value)}
              placeholder="Telefone"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <input
              value={formulario.especialidades}
              onChange={(evento) => alterarCampo("especialidades", evento.target.value)}
              placeholder="Especialidades de consulta separadas por vírgula"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <input
              value={formulario.especialidadesExames}
              onChange={(evento) => alterarCampo("especialidadesExames", evento.target.value)}
              placeholder="Especialidades de exames separadas por vírgula"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="number"
                min="0"
                value={formulario.capacidadeDiaria}
                onChange={(evento) => alterarCampo("capacidadeDiaria", evento.target.value)}
                placeholder="Atendimentos médicos por dia"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <select
                value={formulario.status}
                onChange={(evento) => alterarCampo("status", evento.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="ativa">Ativa</option>
                <option value="temporariamente_fechada">Temporariamente fechada</option>
              </select>
            </div>
            <input
              value={formulario.horario}
              onChange={(evento) => alterarCampo("horario", evento.target.value)}
              placeholder="Horário de funcionamento"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />

            {mensagem && (
              <p className="text-sm text-blue-600 bg-blue-50 rounded-xl px-4 py-3">
                {mensagem}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={geocodificando}
                className="flex-1 bg-blue-400 text-white rounded-xl py-3 font-semibold hover:bg-blue-500 transition disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {geocodificando
                  ? "Localizando..."
                  : clinicaEditandoId
                  ? "Salvar edição"
                  : "Adicionar clínica"}
              </button>
              {clinicaEditandoId && (
                <button
                  type="button"
                  onClick={limparFormulario}
                  className="px-4 py-3 rounded-xl bg-gray-100 text-gray-700 font-semibold"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>

          <section className="space-y-4">
            {carregando && (
              <p className="rounded-xl bg-white px-4 py-3 text-sm text-gray-500">
                Carregando clínicas...
              </p>
            )}
            {clinicasComIndicadores.map((clinica) => (
              <article
                key={clinica.id}
                className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex min-w-0 gap-4">
                    <FotoClinica
                      src={clinica.fotoPerfil}
                      nome={clinica.nome}
                      className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-blue-50 text-2xl font-bold text-blue-500"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl font-semibold text-gray-800">{clinica.nome}</h2>
                        <span
                          className={`text-xs px-3 py-1 rounded-full font-semibold ${
                            clinica.status === "ativa"
                              ? "bg-green-50 text-green-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {clinica.status === "ativa" ? "Ativa" : "Fechada"}
                        </span>
                      </div>
                      <p className="text-gray-500 mt-1">{clinica.endereco}</p>
                      <p className="text-gray-400 text-xs mt-1">
                        Lat/Lng: {clinica.latitude ?? "-"}, {clinica.longitude ?? "-"}
                      </p>
                      <p className="text-gray-500 text-sm mt-1">
                        {clinica.telefone} | {clinica.horario}
                      </p>
                      <p className="text-gray-500 text-sm mt-1">
                        Consultas: {(clinica.especialidades || []).join(", ") || "Ainda sem dados"}
                      </p>
                      <p className="text-gray-500 text-sm mt-1">
                        Exames: {(clinica.especialidadesExames || []).join(", ") || "Ainda sem dados"}
                      </p>
                    </div>
                  </div>

                  <div className="flex md:flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => editarClinica(clinica)}
                      className="bg-blue-50 text-blue-700 border border-blue-100 px-4 py-2 rounded-xl font-semibold text-sm"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => alternarStatus(clinica.id)}
                      className="bg-gray-100 text-gray-700 px-4 py-2 rounded-xl font-semibold text-sm"
                    >
                      {clinica.status === "ativa" ? "Pausar" : "Reativar"}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-4 text-center">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-gray-500 text-xs">Atendimentos/dia</p>
                    <strong>{clinica.capacidadeDiaria}/dia</strong>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-gray-500 text-xs">Mês</p>
                    <strong>{clinica.atendimentosMes}</strong>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-gray-500 text-xs">Ocupação</p>
                    <strong>{clinica.ocupacao}%</strong>
                  </div>
                </div>
              </article>
            ))}
          </section>
        </section>
      </main>
    </div>
  );
}

export default AdminGerenciarClinicas;
