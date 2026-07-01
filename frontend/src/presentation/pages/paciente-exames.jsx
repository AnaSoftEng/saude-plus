import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ouvirClinicasAtualizadas } from "../../application/clinicas/clinicas-eventos";
import { listarClinicas } from "../../application/clinicas/clinicas-use-cases";
import CabecalhoApp from "../components/cabecalho-app";
import FotoClinica from "../components/foto-clinica";
import MenuInferiorPaciente from "../components/menu-inferior-paciente";
import MenuUsuarioPaciente from "../components/menu-usuario-paciente";

function clinicaEstaDisponivel(clinica) {
  return clinica.aberta !== false && clinica.status !== "temporariamente_fechada";
}

function obterEspecialidadesExames(clinica) {
  return (clinica.especialidadesExames || [])
    .map((especialidade) => String(especialidade || "").trim())
    .filter(Boolean);
}

function PacienteExames() {
  const navigate = useNavigate();
  const [termoBusca, setTermoBusca] = useState("");
  const [clinicas, setClinicas] = useState([]);
  const [clinicasFiltradas, setClinicasFiltradas] = useState([]);
  const [especialidadeSelecionada, setEspecialidadeSelecionada] = useState("Todos");
  const [bairroSelecionado, setBairroSelecionado] = useState("Todos");
  const [filtroBuscaAberto, setFiltroBuscaAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erroCarregamento, setErroCarregamento] = useState("");

  const todosBairros = [
    "Todos",
    ...new Set(clinicas.map((clinica) => clinica.bairro).filter(Boolean)),
  ];

  const clinicasBaseEspecialidades = useMemo(() => {
    const termo = termoBusca.toLowerCase().trim();

    return clinicas.filter((clinica) => {
      const nome = String(clinica.nome || "").toLowerCase();
      const bairro = String(clinica.bairro || "").toLowerCase();
      const exames = obterEspecialidadesExames(clinica).join(" ").toLowerCase();
      const bateTexto =
        !termo || nome.includes(termo) || bairro.includes(termo) || exames.includes(termo);
      const bateBairro =
        bairroSelecionado === "Todos" || clinica.bairro === bairroSelecionado;

      return clinicaEstaDisponivel(clinica) && bateTexto && bateBairro;
    });
  }, [bairroSelecionado, clinicas, termoBusca]);

  const especialidadesExamesDisponiveis = useMemo(() => {
    const contagem = new Map();

    clinicasBaseEspecialidades.forEach((clinica) => {
      const especialidadesUnicas = new Set(obterEspecialidadesExames(clinica));
      especialidadesUnicas.forEach((especialidade) => {
        contagem.set(especialidade, (contagem.get(especialidade) || 0) + 1);
      });
    });

    return [
      { nome: "Todos", quantidade: clinicasBaseEspecialidades.length },
      ...Array.from(contagem.entries())
        .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
        .map(([nome, quantidade]) => ({ nome, quantidade })),
    ];
  }, [clinicasBaseEspecialidades]);

  const quantidadeFiltrosAtivos =
    (especialidadeSelecionada !== "Todos" ? 1 : 0) +
    (bairroSelecionado !== "Todos" ? 1 : 0);

  async function carregarClinicas() {
    setCarregando(true);
    setErroCarregamento("");

    try {
      const lista = await listarClinicas();
      const clinicasDisponiveis = Array.isArray(lista) ? lista : [];
      setClinicas(clinicasDisponiveis);
      setClinicasFiltradas(clinicasDisponiveis);
    } catch (erro) {
      setErroCarregamento(erro.message || "Não conseguimos carregar as unidades agora.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarClinicas();
  }, []);

  useEffect(() => ouvirClinicasAtualizadas(carregarClinicas), []);

  useEffect(() => {
    const existeEspecialidadeSelecionada = especialidadesExamesDisponiveis.some(
      (especialidade) => especialidade.nome === especialidadeSelecionada
    );

    if (!existeEspecialidadeSelecionada) {
      setEspecialidadeSelecionada("Todos");
    }
  }, [especialidadeSelecionada, especialidadesExamesDisponiveis]);

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
      const exames = obterEspecialidadesExames(clinica);
      const temExames = exames.length > 0;
      const examesTexto = exames.join(" ").toLowerCase();
      const bateTexto =
        !termo || nome.includes(termo) || bairro.includes(termo) || examesTexto.includes(termo);
      const bateEspecialidade =
        especialidadeSelecionada === "Todos" || exames.includes(especialidadeSelecionada);
      const bateBairro =
        bairroSelecionado === "Todos" || clinica.bairro === bairroSelecionado;
      const bateDisponibilidadeEspecialidade =
        especialidadeSelecionada === "Todos" || clinicaEstaDisponivel(clinica);

      return (
        temExames &&
        bateTexto &&
        bateEspecialidade &&
        bateBairro &&
        bateDisponibilidadeEspecialidade
      );
    });

    setClinicasFiltradas(resultado);
  }, [bairroSelecionado, clinicas, especialidadeSelecionada, termoBusca]);

  function aoClicarAgendar(clinica) {
    navigate(`/paciente/agendar-exame?clinica=${clinica.id}`);
  }

  function limparFiltrosPesquisa() {
    setTermoBusca("");
    setEspecialidadeSelecionada("Todos");
    setBairroSelecionado("Todos");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CabecalhoApp
        titulo="Exames"
        descricao="Escolha uma unidade para agendar seu exame"
        acao={<MenuUsuarioPaciente />}
      />

      <main className="app-content space-y-4">
        <section className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
        <div className="relative">
          <span className="absolute left-4 top-1/2 hidden -translate-y-1/2 text-sm text-gray-400 sm:block">
            Buscar
          </span>
          <input
            type="text"
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            placeholder="Unidade, exame ou bairro..."
            className="w-full rounded-xl border border-gray-100 bg-gray-50 py-2.5 pl-4 pr-24 text-sm text-gray-700 placeholder:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 sm:pl-20"
          />
          {termoBusca && (
            <button
              type="button"
              onClick={() => setTermoBusca("")}
              className="absolute right-14 top-1/2 -translate-y-1/2 p-1 text-sm text-gray-400"
              aria-label="Limpar busca"
            >
              X
            </button>
          )}
          <button
            type="button"
            onClick={() => setFiltroBuscaAberto((v) => !v)}
            className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 transition ${
              filtroBuscaAberto || quantidadeFiltrosAtivos > 0
                ? "bg-blue-100 text-blue-600"
                : "text-gray-400 hover:bg-gray-100"
            }`}
            aria-label="Abrir filtros de pesquisa"
          >
            <span className="relative flex h-5 w-5 items-end justify-center gap-0.5">
              <span className="h-2 w-1 rounded-full bg-current" />
              <span className="h-3.5 w-1 rounded-full bg-current" />
              <span className="h-5 w-1 rounded-full bg-current" />
              {quantidadeFiltrosAtivos > 0 && (
                <span className="absolute -right-2 -top-2 h-4 min-w-4 rounded-full bg-blue-500 px-1 text-center text-[10px] leading-4 text-white">
                  {quantidadeFiltrosAtivos}
                </span>
              )}
            </span>
          </button>
        </div>

        {filtroBuscaAberto && (
          <div className="mt-3 rounded-xl border border-blue-100 bg-white p-3 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-800">Filtros de pesquisa</p>
                <p className="text-xs text-gray-400">Refine por exame e bairro</p>
              </div>
              {quantidadeFiltrosAtivos > 0 && (
                <button
                  type="button"
                  onClick={limparFiltrosPesquisa}
                  className="text-xs font-semibold text-blue-500"
                >
                  Limpar
                </button>
              )}
            </div>

            <div className="mb-4">
              <p className="mb-2 text-xs font-medium uppercase text-gray-500">
                Exames
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {especialidadesExamesDisponiveis.map((especialidade) => (
                  <button
                    key={especialidade.nome}
                    type="button"
                    onClick={() => setEspecialidadeSelecionada(especialidade.nome)}
                    className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      especialidadeSelecionada === especialidade.nome
                        ? "bg-blue-400 text-white shadow-md"
                        : "border border-gray-200 bg-gray-50 text-gray-600"
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
              <p className="mb-2 text-xs font-medium uppercase text-gray-500">
                Bairros
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {todosBairros.map((bairro) => (
                  <button
                    key={bairro}
                    type="button"
                    onClick={() => setBairroSelecionado(bairro)}
                    className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      bairroSelecionado === bairro
                        ? "bg-blue-400 text-white shadow-md"
                        : "border border-gray-200 bg-gray-50 text-gray-600"
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
          <p className="py-6 text-center text-sm text-gray-500">
            Carregando unidades...
          </p>
        )}

        {!carregando && erroCarregamento && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-600">{erroCarregamento}</p>
          </div>
        )}

        {!carregando && !erroCarregamento && (
          <div className="mb-4 flex items-center justify-between gap-4">
            <p className="text-sm text-gray-600">
              {clinicasFiltradas.length === 0
                ? "Nenhuma unidade encontrada"
                : `${clinicasFiltradas.length} unidade${
                    clinicasFiltradas.length > 1 ? "s" : ""
                  } disponível${clinicasFiltradas.length > 1 ? "s" : ""}`}
            </p>
            <p className="text-xs font-medium text-blue-400">Saquarema/RJ</p>
          </div>
        )}

        {!carregando && !erroCarregamento && clinicasFiltradas.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-base font-medium text-gray-500">
              Nenhuma unidade encontrada
            </p>
            <p className="mt-1 text-sm text-gray-400">
              Tente outro nome, exame ou bairro
            </p>
            <button
              type="button"
              onClick={limparFiltrosPesquisa}
              className="mt-4 text-sm font-medium text-blue-400 underline"
            >
              Limpar filtros
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {clinicasFiltradas.map((clinica) => (
            <article
              key={clinica.id}
              className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
            >
              <div
                className={`h-1.5 w-full ${clinica.aberta ? "bg-green-400" : "bg-gray-300"}`}
              />

              <div className="p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <FotoClinica src={clinica.fotoPerfil} nome={clinica.nome} />
                    <div>
                      <h2 className="text-base font-bold leading-tight text-gray-800">
                        {clinica.nome}
                      </h2>
                      <p className="text-sm font-medium text-blue-400">
                        {clinica.bairro}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                      clinica.aberta
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-500"
                    }`}
                  >
                    {clinica.aberta ? "Aberta" : "Fechada"}
                  </span>
                </div>

                <p className="mb-2 text-xs text-gray-500">
                  <span className="font-semibold">Horário:</span> {clinica.horario}
                </p>
                <p className="mb-3 text-xs text-gray-500">
                  <span className="font-semibold">Endereço:</span> {clinica.endereco}
                </p>

                <div className="mb-4 flex flex-wrap gap-1.5">
                  {obterEspecialidadesExames(clinica).map((servico) => (
                    <span
                      key={servico}
                      className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-600"
                    >
                      {servico}
                    </span>
                  ))}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <a
                    href={`tel:${clinica.telefone}`}
                    className="flex flex-1 items-center justify-center rounded-xl bg-gray-100 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
                  >
                    Ligar
                  </a>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/paciente/clinicas/${clinica.id}`, {
                        state: { origem: "exames" },
                      })
                    }
                    className="flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 transition hover:border-blue-300"
                  >
                    Mais info
                  </button>
                  <button
                    type="button"
                    onClick={() => aoClicarAgendar(clinica)}
                    disabled={!clinica.aberta || !obterEspecialidadesExames(clinica).length}
                    className={`flex-[1.6] rounded-xl py-3 text-base font-bold transition active:scale-95 ${
                      clinica.aberta && obterEspecialidadesExames(clinica).length
                        ? "bg-blue-400 text-white shadow-sm hover:bg-blue-500"
                        : "cursor-not-allowed bg-gray-200 text-gray-400"
                    }`}
                  >
                    {clinica.aberta && obterEspecialidadesExames(clinica).length
                      ? "Agendar"
                      : "Indisponível"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>

      <MenuInferiorPaciente abaAtiva="exames" />

      <div className="h-24" />
    </div>
  );
}

export default PacienteExames;
