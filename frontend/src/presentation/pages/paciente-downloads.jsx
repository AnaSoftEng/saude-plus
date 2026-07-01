import React, { useEffect, useMemo, useState } from "react";
import { ClipboardList, FileText, Stethoscope, TestTube2 } from "lucide-react";
import { useLocation } from "react-router";
import {
  buscarHistoricoPaciente,
} from "../../application/agenda/agendamento-use-cases";
import { ouvirConsultasAtualizadas } from "../../application/agenda/consultas-eventos";
import { obterUsuarioAtual } from "../../application/auth/auth-service";
import { listarClinicas } from "../../application/clinicas/clinicas-use-cases";
import { ouvirExamesAtualizados } from "../../application/exames/exames-eventos";
import { listarExamesPaciente } from "../../application/exames/exames-use-cases";
import CabecalhoApp from "../components/cabecalho-app";
import MenuInferiorPaciente from "../components/menu-inferior-paciente";
import MenuUsuarioPaciente from "../components/menu-usuario-paciente";

function parseAgendaId(agendaId) {
  const parsed = /^ag-(\d+)-(\d{4}-\d{2}-\d{2})-t(\d{2})(\d{2})$/.exec(
    String(agendaId || "")
  );
  if (!parsed) return null;

  return {
    clinicaId: Number(parsed[1]),
    data: parsed[2],
    hora: `${parsed[3]}:${parsed[4]}`,
  };
}

function obterAgendaDaConsulta(consulta) {
  const agenda = parseAgendaId(consulta.agenda_id);
  if (agenda) return agenda;

  const data = consulta.data || consulta.data_consulta;
  const hora = consulta.hora || consulta.horario;
  if (!data || !hora) return null;

  return {
    clinicaId: Number(consulta.clinica_id),
    data,
    hora,
  };
}

function paraInicioDoDia(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatarData(dataIso) {
  if (!dataIso) return "-";

  const [y, m, d] = String(dataIso).split("-").map(Number);
  if (!y || !m || !d) return "-";

  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function normalizarNomeArquivo(texto) {
  return String(texto || "documento")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function baixarArquivo(nomeArquivo, conteudo) {
  const blob = new Blob([conteudo], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function baixarDataUrl(nomeArquivo, dataUrl) {
  const link = document.createElement("a");

  link.href = dataUrl;
  link.download = nomeArquivo || "resultado-exame";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function montarConteudoDocumento(documento, usuario) {
  return [
    `Saúde+ - ${documento.categoria}`,
    "",
    `Paciente: ${usuario?.nome || "Paciente"}`,
    `Documento: ${documento.titulo}`,
    `Data: ${formatarData(documento.data)}`,
    `Unidade: ${documento.clinica}`,
    documento.responsavel ? `Anexado por: ${documento.responsavel}` : null,
    documento.medico ? `Médico: ${documento.medico}` : null,
    documento.especialidade ? `Especialidade: ${documento.especialidade}` : null,
    documento.horario ? `Horário: ${documento.horario}` : null,
    documento.status ? `Status: ${documento.status}` : null,
    "",
    documento.descricao,
    "",
    "Documento gerado a partir dos anexos liberados no Saúde+.",
  ]
    .filter((linha) => linha !== null)
    .join("\n");
}

function montarDownloadsConsultas(consultas, clinicas) {
  const hoje = paraInicioDoDia(new Date());

  return consultas
    .map((consulta) => {
      const agenda = obterAgendaDaConsulta(consulta);
      if (!agenda) return null;

      const status = String(consulta.status || "realizada").toLowerCase();
      const dataConsulta = paraInicioDoDia(new Date(`${agenda.data}T00:00:00`));
      const consultaComAnexos =
        status !== "cancelada" && (dataConsulta < hoje || status === "realizada");

      if (!consultaComAnexos) return null;

      const clinica =
        clinicas.find((item) => Number(item.id) === Number(agenda.clinicaId)) ||
        clinicas.find((item) => Number(item.id) === Number(consulta.clinica_id));

      return {
        id: String(consulta.id),
        data: agenda.data,
        horario: agenda.hora,
        clinica: clinica?.nome || "Clínica não identificada",
        medico: consulta.medico || "",
        especialidade: consulta.especialidade || "Atendimento",
        status,
      };
    })
    .filter(Boolean)
    .sort((a, b) => `${b.data} ${b.horario}`.localeCompare(`${a.data} ${a.horario}`));
}

function criarDocumentoExame(exame) {
  const categorias = {
    exame: "Exame",
    prontuario: "Prontuario",
    atestado: "Atestado",
  };
  const categoria = categorias[exame.resultado_categoria] || "Exame";

  return {
    id: `exame-${exame.id}`,
    categoria,
    titulo: exame.tipo || "Resultado de exame",
    data: exame.data,
    horario: exame.horario,
    clinica: exame.clinica_nome || "Unidade não informada",
    status: exame.status || "liberado",
    responsavel:
      exame.resultado_anexado_por_nome ||
      (exame.resultado_anexado_por === "medico" ? "Médico" : "Admin da clínica"),
    nomeArquivo:
      exame.resultado_nome_arquivo ||
      `${normalizarNomeArquivo(exame.tipo || "resultado-exame")}.txt`,
    arquivoDataUrl: exame.resultado_arquivo_data_url || "",
    tipoArquivo: exame.resultado_arquivo_tipo || "",
    descricao:
      exame.resultado_descricao || `Resultado anexado para ${exame.tipo || "exame"}.`,
  };
}

function criarDocumentoProntuario(consulta) {
  return {
    id: `prontuario-${consulta.id}`,
    categoria: "Prontuario",
    titulo: `Prontuario - ${consulta.especialidade}`,
    data: consulta.data,
    horario: consulta.horario,
    clinica: consulta.clinica,
    medico: consulta.medico,
    especialidade: consulta.especialidade,
    status: consulta.status,
    descricao:
      "Registro clinico anexado pelo médico com resumo do atendimento, conduta e orientações.",
  };
}

function criarDocumentoAtestado(consulta) {
  return {
    id: `atestado-${consulta.id}`,
    categoria: "Atestado",
    titulo: `Atestado - ${consulta.especialidade}`,
    data: consulta.data,
    horario: consulta.horario,
    clinica: consulta.clinica,
    medico: consulta.medico,
    especialidade: consulta.especialidade,
    status: consulta.status,
    descricao:
      "Atestado anexado pelo médico para comprovação de comparecimento ao atendimento.",
  };
}

function PacienteDownloads() {
  const location = useLocation();
  const usuario = obterUsuarioAtual();
  const [consultas, setConsultas] = useState([]);
  const [exames, setExames] = useState([]);
  const [clinicas, setClinicas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  async function carregarDownloads() {
      const pacienteId = usuario?.id != null ? Number(usuario.id) : 1;
      setCarregando(true);
      setErro("");

      try {
        const [listaConsultas, listaExames, listaClinicas] = await Promise.all([
          buscarHistoricoPaciente(pacienteId),
          listarExamesPaciente(pacienteId),
          listarClinicas(),
        ]);

        setConsultas(Array.isArray(listaConsultas) ? listaConsultas : []);
        setExames(Array.isArray(listaExames) ? listaExames : []);
        setClinicas(Array.isArray(listaClinicas) ? listaClinicas : []);
      } catch (falha) {
        setErro(falha.message || "Não conseguimos carregar seus arquivos agora.");
      } finally {
        setCarregando(false);
      }
    }

  useEffect(() => {
    carregarDownloads();
  }, [usuario?.id]);

  useEffect(() => ouvirExamesAtualizados(carregarDownloads), [usuario?.id]);
  useEffect(() => ouvirConsultasAtualizadas(carregarDownloads), [usuario?.id]);

  useEffect(() => {
    function recarregarAoVoltar() {
      if (document.visibilityState === "visible") {
        carregarDownloads();
      }
    }

    document.addEventListener("visibilitychange", recarregarAoVoltar);
    window.addEventListener("focus", carregarDownloads);

    return () => {
      document.removeEventListener("visibilitychange", recarregarAoVoltar);
      window.removeEventListener("focus", carregarDownloads);
    };
  }, [usuario?.id]);

  useEffect(() => {
    if (carregando) return;

    const categoria = new URLSearchParams(location.search).get("categoria");
    if (!categoria) return;

    const alvo = document.getElementById(`downloads-${categoria}`);
    if (alvo) {
      alvo.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [carregando, location.search]);

  const gruposDownloads = useMemo(() => {
    const consultasComAnexos = montarDownloadsConsultas(consultas, clinicas);
    const documentosAnexados = exames
      .filter((exame) => {
        const status = String(exame.status || "").toLowerCase();
        return exame.resultado_disponivel === true || status === "liberado";
      })
      .sort((a, b) =>
        `${b.data || ""} ${b.horario || ""}`.localeCompare(
          `${a.data || ""} ${a.horario || ""}`
        )
      )
      .map(criarDocumentoExame);

    return [
      {
        chave: "exames",
        titulo: "Exames",
        descricao: "Resultados e laudos anexados pelas unidades.",
        Icone: TestTube2,
        documentos: documentosAnexados.filter(
          (documento) => documento.categoria === "Exame"
        ),
      },
      {
        chave: "prontuarios",
        titulo: "Prontuarios",
        descricao: "Registros clínicos anexados pelos médicos.",
        Icone: ClipboardList,
        documentos: [
          ...consultasComAnexos.map(criarDocumentoProntuario),
          ...documentosAnexados.filter(
            (documento) => documento.categoria === "Prontuario"
          ),
        ],
      },
      {
        chave: "atestados",
        titulo: "Atestados",
        descricao: "Atestados e comprovantes emitidos pelos médicos.",
        Icone: Stethoscope,
        documentos: [
          ...consultasComAnexos.map(criarDocumentoAtestado),
          ...documentosAnexados.filter(
            (documento) => documento.categoria === "Atestado"
          ),
        ],
      },
    ];
  }, [clinicas, consultas, exames]);

  function baixarDocumento(documento) {
    if (documento.arquivoDataUrl) {
      baixarDataUrl(documento.nomeArquivo, documento.arquivoDataUrl);
      return;
    }

    const nomeArquivo = `${normalizarNomeArquivo(documento.categoria)}-${normalizarNomeArquivo(
      documento.titulo
    )}-${documento.data || "sem-data"}.txt`;

    baixarArquivo(nomeArquivo, montarConteudoDocumento(documento, usuario));
  }

  function baixarGrupo(grupo) {
    const conteudo = grupo.documentos
      .map((documento) => montarConteudoDocumento(documento, usuario))
      .join("\n\n---\n\n");
    const nomeArquivo = `${normalizarNomeArquivo(grupo.titulo)}-saude-plus.txt`;

    baixarArquivo(nomeArquivo, conteudo);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CabecalhoApp
        titulo="Downloads"
        descricao="Exames, prontuarios e atestados anexados"
        acao={<MenuUsuarioPaciente />}
      />

      <main className="app-content-narrow space-y-4">
        {carregando && (
          <p className="rounded-2xl border border-gray-100 bg-white p-5 text-sm text-gray-500 shadow-sm">
            Carregando arquivos...
          </p>
        )}

        {!carregando && erro && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-600">{erro}</p>
          </div>
        )}

        {!carregando &&
          !erro &&
          gruposDownloads.map((grupo) => {
            const Icone = grupo.Icone;
            const quantidade = grupo.documentos.length;

            return (
              <section
                key={grupo.chave}
                id={`downloads-${grupo.chave}`}
                className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-500">
                    <Icone className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-bold text-gray-800">{grupo.titulo}</h2>
                        <p className="mt-1 text-sm text-gray-500">{grupo.descricao}</p>
                      </div>
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500">
                        {quantidade}
                      </span>
                    </div>

                    {quantidade > 0 ? (
                      <>
                        <button
                          type="button"
                          onClick={() => baixarGrupo(grupo)}
                          className="mt-4 w-full rounded-xl bg-blue-400 py-3 text-sm font-bold text-white transition hover:bg-blue-500"
                        >
                          Baixar todos
                        </button>

                        <div className="mt-3 space-y-2">
                          {grupo.documentos.map((documento) => (
                            <div
                              key={documento.id}
                              className="rounded-xl border border-gray-100 bg-gray-50 p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-gray-800">
                                    {documento.titulo}
                                  </p>
                                  <p className="mt-0.5 text-xs text-gray-500">
                                    {formatarData(documento.data)} - {documento.clinica}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => baixarDocumento(documento)}
                                  className="flex flex-shrink-0 items-center gap-1 rounded-lg bg-white px-3 py-2 text-xs font-bold text-blue-600 shadow-sm hover:bg-blue-50"
                                >
                                  <FileText className="h-4 w-4" aria-hidden="true" />
                                  Baixar
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="mt-4 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-500">
                        Nenhum arquivo anexado nesta categoria.
                      </p>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
      </main>

      <MenuInferiorPaciente abaAtiva="downloads" />
      <div className="h-24" />
    </div>
  );
}

export default PacienteDownloads;
