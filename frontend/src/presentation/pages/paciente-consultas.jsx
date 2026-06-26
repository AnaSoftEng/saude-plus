import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  Clock3,
  Info,
  MapPin,
  Phone,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ouvirClinicasAtualizadas } from "../../application/clinicas/clinicas-eventos";
import { buscarClinicaPorId, listarClinicas } from "../../application/clinicas/clinicas-use-cases";
import { obterSnapshotDispositivo } from "../../infrastructure/device/use-dispositivo";
import CabecalhoApp from "../components/cabecalho-app";
import FotoClinica from "../components/foto-clinica";
import MenuInferiorPaciente from "../components/menu-inferior-paciente";
import MenuUsuarioPaciente from "../components/menu-usuario-paciente";

function clinicaEstaDisponivel(clinica) {
  return clinica.aberta !== false && clinica.status !== "temporariamente_fechada";
}

function obterEspecialidadesClinica(clinica) {
  return (clinica.especialidades || [])
    .map((especialidade) => String(especialidade || "").trim())
    .filter(Boolean);
}

function obterTelefoneDiscavel(telefone) {
  const numeros = String(telefone || "").replace(/\D/g, "");
  return numeros.length >= 10 ? numeros : "";
}

function dispositivoPodeLigar() {
  if (typeof window === "undefined") return false;

  const dispositivo = obterSnapshotDispositivo();
  const userAgent = navigator.userAgent || "";
  const plataformaMovel =
    dispositivo.celular ||
    /Android|iPhone|iPod|Windows Phone/i.test(userAgent) ||
    (navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1);

  return Boolean(plataformaMovel);
}

function PacienteConsultas() {
  const navigate = useNavigate();
  const [termoBusca, setTermoBusca] = useState("");
  const [clinicas, setClinicas] = useState([]);
  const [clinicasFiltradas, setClinicasFiltradas] = useState([]);
  const [especialidadeSelecionada, setEspecialidadeSelecionada] = useState("Todas");
  const [bairroSelecionado, setBairroSelecionado] = useState("Todos");
  const [filtroBuscaAberto, setFiltroBuscaAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erroCarregamento, setErroCarregamento] = useState("");
  const [ligacaoEmAndamentoId, setLigacaoEmAndamentoId] = useState(null);

  const todosBairros = [
    "Todos",
    ...new Set(clinicas.map((clinica) => clinica.bairro).filter(Boolean)),
  ];

  const clinicasBaseEspecialidades = useMemo(() => {
    const termo = termoBusca.toLowerCase().trim();

    return clinicas.filter((clinica) => {
      const nome = String(clinica.nome || "").toLowerCase();
      const bairro = String(clinica.bairro || "").toLowerCase();
      const bateTexto = !termo || nome.includes(termo) || bairro.includes(termo);
      const bateBairro =
        bairroSelecionado === "Todos" || clinica.bairro === bairroSelecionado;

      return clinicaEstaDisponivel(clinica) && bateTexto && bateBairro;
    });
  }, [bairroSelecionado, clinicas, termoBusca]);

  const especialidadesDisponiveis = useMemo(() => {
    const contagem = new Map();

    clinicasBaseEspecialidades.forEach((clinica) => {
      const especialidadesUnicas = new Set(obterEspecialidadesClinica(clinica));
      especialidadesUnicas.forEach((especialidade) => {
        contagem.set(especialidade, (contagem.get(especialidade) || 0) + 1);
      });
    });

    return [
      { nome: "Todas", quantidade: clinicasBaseEspecialidades.length },
      ...Array.from(contagem.entries())
        .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
        .map(([nome, quantidade]) => ({ nome, quantidade })),
    ];
  }, [clinicasBaseEspecialidades]);

  const quantidadeFiltrosAtivos =
    (especialidadeSelecionada !== "Todas" ? 1 : 0) +
    (bairroSelecionado !== "Todos" ? 1 : 0);

  async function carregarClinicas() {
    setCarregando(true);
    setErroCarregamento("");

    try {
      const lista = await listarClinicas();
      setClinicas(Array.isArray(lista) ? lista : []);
      setClinicasFiltradas(Array.isArray(lista) ? lista : []);
    } catch (erro) {
      setErroCarregamento(erro.message || "Não conseguimos carregar as clínicas agora.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarClinicas();
  }, []);

  useEffect(() => ouvirClinicasAtualizadas(carregarClinicas), []);

  useEffect(() => {
    const existeEspecialidadeSelecionada = especialidadesDisponiveis.some(
      (especialidade) => especialidade.nome === especialidadeSelecionada
    );

    if (!existeEspecialidadeSelecionada) {
      setEspecialidadeSelecionada("Todas");
    }
  }, [especialidadeSelecionada, especialidadesDisponiveis]);

  useEffect(() => {
    function recarregarAoVoltar() {
      if (document.visibilityState === "visible") {
        carregarClinicas();
      }
    }

    document.addEventListener("visibilitychange", recarregarAoVoltar);
    window.addEventListener("focus", carregarClinicas);

    return () => {
      document.removeEventListener("visibilitychange", recarregarAoVoltar);
      window.removeEventListener("focus", carregarClinicas);
    };
  }, []);

  useEffect(() => {
    const termo = termoBusca.toLowerCase().trim();
    const resultado = clinicas.filter((clinica) => {
      const nome = String(clinica.nome || "").toLowerCase();
      const bairro = String(clinica.bairro || "").toLowerCase();
      const bateTexto = !termo || nome.includes(termo) || bairro.includes(termo);
      const bateEspecialidade =
        especialidadeSelecionada === "Todas" ||
        obterEspecialidadesClinica(clinica).includes(especialidadeSelecionada);
      const bateBairro =
        bairroSelecionado === "Todos" || clinica.bairro === bairroSelecionado;
      const bateDisponibilidadeEspecialidade =
        especialidadeSelecionada === "Todas" || clinicaEstaDisponivel(clinica);

      return bateTexto && bateEspecialidade && bateBairro && bateDisponibilidadeEspecialidade;
    });

    setClinicasFiltradas(resultado);
  }, [bairroSelecionado, clinicas, especialidadeSelecionada, termoBusca]);

  function aoClicarAgendar(clinica) {
    navigate(`/paciente/agendar?clinica=${clinica.id}`);
  }

  async function aoClicarLigar(clinica) {
    if (!dispositivoPodeLigar()) {
      return;
    }

    setLigacaoEmAndamentoId(clinica.id);
    setErroCarregamento("");

    try {
      const clinicaAtualizada = await buscarClinicaPorId(clinica.id);
      const telefone = obterTelefoneDiscavel(clinicaAtualizada?.telefone);

      if (!telefone) {
        setErroCarregamento("A clínica não possui telefone válido cadastrado.");
        return;
      }

      setClinicas((listaAtual) =>
        listaAtual.map((item) =>
          Number(item.id) === Number(clinica.id) ? { ...item, ...clinicaAtualizada } : item
        )
      );
      window.location.href = `tel:${telefone}`;
    } catch (erro) {
      setErroCarregamento(erro.message || "Não foi possível carregar o telefone da clínica.");
    } finally {
      setLigacaoEmAndamentoId(null);
    }
  }

  function limparFiltrosPesquisa() {
    setTermoBusca("");
    setEspecialidadeSelecionada("Todas");
    setBairroSelecionado("Todos");
  }

  return (
    <div className="min-h-screen bg-[#eef8f7]">
      <CabecalhoApp
        titulo="Consultas"
        descricao="Escolha uma clínica para agendar seu atendimento"
        acao={<MenuUsuarioPaciente />}
      />

      <main className="app-content space-y-5">
        <section className="rounded-lg border border-blue-100 bg-white p-3 shadow-sm shadow-blue-950/5 sm:p-4">
          <div className="relative">
            <Search
              className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500"
              aria-hidden="true"
            />
            <input
              type="text"
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              placeholder="Clínica ou bairro..."
              className="w-full rounded-lg border border-blue-100 bg-blue-50/40 py-3 pl-11 pr-24 text-sm text-slate-700 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            {termoBusca && (
              <button
                type="button"
                onClick={() => setTermoBusca("")}
                className="absolute right-14 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-600"
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setFiltroBuscaAberto((v) => !v)}
              className={`absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg transition ${
                filtroBuscaAberto || quantidadeFiltrosAtivos > 0
                  ? "bg-blue-500 text-white shadow-sm shadow-blue-950/10"
                  : "text-slate-400 hover:bg-white hover:text-blue-600"
              }`}
              aria-label="Abrir filtros de pesquisa"
            >
              <span className="relative">
                <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
                {quantidadeFiltrosAtivos > 0 && (
                  <span className="absolute -right-2.5 -top-2.5 h-4 min-w-4 rounded-full bg-slate-900 px-1 text-center text-[10px] leading-4 text-white">
                    {quantidadeFiltrosAtivos}
                  </span>
                )}
              </span>
            </button>
          </div>

          {filtroBuscaAberto && (
            <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/40 p-3">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-800">Filtros de pesquisa</p>
                  <p className="text-xs text-slate-500">Refine por consulta e bairro</p>
                </div>
                {quantidadeFiltrosAtivos > 0 && (
                  <button
                    type="button"
                    onClick={limparFiltrosPesquisa}
                    className="rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 transition hover:bg-white"
                  >
                    Limpar
                  </button>
                )}
              </div>

              <div className="mb-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  Consultas
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {especialidadesDisponiveis.map((especialidade) => (
                    <button
                      key={especialidade.nome}
                      type="button"
                      onClick={() => setEspecialidadeSelecionada(especialidade.nome)}
                      className={`flex-shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                        especialidadeSelecionada === especialidade.nome
                          ? "bg-blue-500 text-white shadow-sm shadow-blue-950/10"
                          : "border border-blue-100 bg-white text-slate-600 hover:border-blue-300"
                      }`}
                    >
                      {especialidade.nome}
                      <span className="ml-2 rounded-full bg-white/40 px-1.5 text-xs">
                        {especialidade.quantidade}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  Bairros
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {todosBairros.map((bairro) => (
                    <button
                      key={bairro}
                      type="button"
                      onClick={() => setBairroSelecionado(bairro)}
                      className={`flex-shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                        bairroSelecionado === bairro
                          ? "bg-blue-500 text-white shadow-sm shadow-blue-950/10"
                          : "border border-blue-100 bg-white text-slate-600 hover:border-blue-300"
                      }`}
                    >
                      {bairro}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {carregando && (
          <p className="py-6 text-center text-sm text-slate-500">
            Carregando clínicas...
          </p>
        )}

        {!carregando && erroCarregamento && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-600">{erroCarregamento}</p>
          </div>
        )}

        {!carregando && !erroCarregamento && (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-blue-100 bg-white px-4 py-3 shadow-sm shadow-blue-950/5">
            <p className="text-sm font-medium text-slate-600">
              {clinicasFiltradas.length === 0
                ? "Nenhuma clínica encontrada"
                : `${clinicasFiltradas.length} clínica${
                    clinicasFiltradas.length > 1 ? "s" : ""
                  } disponível${clinicasFiltradas.length > 1 ? "s" : ""}`}
            </p>
            <p className="shrink-0 text-xs font-bold text-blue-600">Saquarema/RJ</p>
          </div>
        )}

        {!carregando && !erroCarregamento && clinicasFiltradas.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-base font-bold text-slate-600">
              Nenhuma clínica encontrada
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Tente outro nome, especialidade ou bairro
            </p>
            <button
              type="button"
              onClick={limparFiltrosPesquisa}
              className="mt-4 rounded-lg bg-blue-500 px-4 py-2 text-sm font-bold text-white"
            >
              Limpar filtros
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {clinicasFiltradas.map((clinica) => (
            <article
              key={clinica.id}
              className="overflow-hidden rounded-lg border border-blue-100 bg-white shadow-sm shadow-blue-950/5 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md hover:shadow-blue-950/10"
            >
              <div className={`h-1 w-full ${clinica.aberta ? "bg-blue-500" : "bg-slate-300"}`} />

              <div className="p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <FotoClinica
                      src={clinica.fotoPerfil}
                      nome={clinica.nome}
                      className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-blue-50 text-2xl font-bold text-blue-600 ring-1 ring-blue-100"
                    />
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-bold leading-tight text-slate-900">
                        {clinica.nome}
                      </h2>
                      <p className="text-sm font-semibold text-blue-600">{clinica.bairro}</p>
                    </div>
                  </div>

                  <span
                    className={`flex-shrink-0 rounded-lg px-3 py-1 text-xs font-bold ${
                      clinica.aberta
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                        : "bg-red-50 text-red-600 ring-1 ring-red-100"
                    }`}
                  >
                    {clinica.aberta ? "Aberta" : "Fechada"}
                  </span>
                </div>

                <p className="mb-2 flex items-center gap-2 text-xs text-slate-500">
                  <Clock3 className="h-4 w-4 text-blue-500" aria-hidden="true" />
                  <span>{clinica.horario}</span>
                </p>
                <p className="mb-3 flex items-start gap-2 text-xs leading-5 text-slate-500">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" aria-hidden="true" />
                  <span>{clinica.endereco}</span>
                </p>

                <div className="mb-4 flex flex-wrap gap-1.5">
                  {(clinica.especialidades || []).map((especialidade) => (
                    <span
                      key={especialidade}
                      className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100"
                    >
                      {especialidade}
                    </span>
                  ))}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => aoClicarLigar(clinica)}
                    disabled={ligacaoEmAndamentoId === clinica.id}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-100 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-60"
                  >
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    {ligacaoEmAndamentoId === clinica.id ? "Abrindo..." : "Ligar"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/paciente/clinicas/${clinica.id}`, {
                        state: { origem: "consultas" },
                      })
                    }
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-blue-100 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50/50"
                  >
                    <Info className="h-4 w-4" aria-hidden="true" />
                    Mais info
                  </button>
                  <button
                    type="button"
                    onClick={() => aoClicarAgendar(clinica)}
                    disabled={!clinica.aberta}
                    className={`flex flex-[1.6] items-center justify-center gap-2 rounded-lg py-3 text-base font-bold transition active:scale-95 ${
                      clinica.aberta
                        ? "bg-blue-500 text-white shadow-sm shadow-blue-950/10 hover:bg-blue-600"
                        : "cursor-not-allowed bg-slate-200 text-slate-400"
                    }`}
                  >
                    <CalendarCheck className="h-4 w-4" aria-hidden="true" />
                    {clinica.aberta ? "Agendar" : "Indisponível"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>

      <MenuInferiorPaciente abaAtiva="consultas" />
      <div className="h-24" />
    </div>
  );
}

export default PacienteConsultas;
