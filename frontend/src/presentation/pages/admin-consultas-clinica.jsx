import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LogOut, Upload, UserCircle } from "lucide-react";
import { obterUsuarioAtual, realizarLogout } from "../../application/auth/auth-service";
import {
  anexarArquivoConsulta,
  buscarConsultasClinica,
} from "../../application/agenda/agendamento-use-cases";
import { ouvirClinicasAtualizadas } from "../../application/clinicas/clinicas-eventos";
import { buscarClinicaPorId } from "../../application/clinicas/clinicas-use-cases";
import { listarUsuarios } from "../../application/usuarios/usuarios-use-cases";
import CabecalhoApp from "../components/cabecalho-app";
import MenuInferiorAdmin from "../components/menu-inferior-admin";

const TAMANHO_MAXIMO_ANEXO_CONSULTA = 2 * 1024 * 1024;
const TIPOS_DOCUMENTO_CONSULTA = [
  { valor: "prontuario", rotulo: "Prontuario" },
  { valor: "atestado", rotulo: "Atestado" },
];

function arquivoParaDataUrl(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();

    leitor.onload = () => resolve(leitor.result);
    leitor.onerror = () => reject(new Error("Não conseguimos ler o arquivo selecionado."));
    leitor.readAsDataURL(arquivo);
  });
}

function arquivosParaLista(fileList) {
  return Array.from(fileList || []);
}

function extrairIntervaloFuncionamento(horarioTexto) {
  const match = String(horarioTexto || "").match(/(\d{2})h\s+(?:as|as)\s+(\d{2})h/i);
  if (!match) return null;
  return {
    inicio: `${match[1]}:00`,
    fim: `${match[2]}:00`,
  };
}

function parseAgendaId(agendaId) {
  const parsed = /^ag-(\d+)-(\d{4}-\d{2}-\d{2})-t(\d{2})(\d{2})$/.exec(
    String(agendaId || "")
  );
  if (!parsed) return null;
  return {
    data: parsed[2],
    horario: `${parsed[3]}:${parsed[4]}`,
  };
}

function AdminConsultasClinica() {
  const usuario = obterUsuarioAtual();
  const [clinicaVinculada, setClinicaVinculada] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [consultasDoDia, setConsultasDoDia] = useState([]);
  const [carregandoConsultas, setCarregandoConsultas] = useState(false);
  const [erroConsultas, setErroConsultas] = useState("");
  const [mensagemConsultas, setMensagemConsultas] = useState("");
  const [consultaUploadSelecionada, setConsultaUploadSelecionada] = useState(null);
  const [arquivosUploadConsulta, setArquivosUploadConsulta] = useState([]);
  const [formularioUploadConsulta, setFormularioUploadConsulta] = useState({
    categoriaDocumento: "prontuario",
    observacoes: "",
  });
  const [uploadConsultaEmAndamento, setUploadConsultaEmAndamento] = useState("");
  const [modoEdicaoTabela, setModoEdicaoTabela] = useState(false);
  const [consultasEmEdicao, setConsultasEmEdicao] = useState([]);
  const [menuUsuarioAberto, setMenuUsuarioAberto] = useState(false);
  const tempoFechamentoMenuRef = useRef(null);
  const nomeClinica = clinicaVinculada?.nome || "Clínica não identificada";

  const carregarClinicaVinculada = useCallback(async () => {
    if (!usuario?.clinica_id) return;

    setErroConsultas("");
    try {
      const [clinica, usuariosApi] = await Promise.all([
        buscarClinicaPorId(usuario.clinica_id),
        listarUsuarios(),
      ]);
      setClinicaVinculada(clinica);
      setUsuarios(Array.isArray(usuariosApi) ? usuariosApi : []);
    } catch (erro) {
      setErroConsultas(erro.message || "Não conseguimos carregar a clínica vinculada agora.");
    }
  }, [usuario?.clinica_id]);

  useEffect(() => {
    carregarClinicaVinculada();
  }, [carregarClinicaVinculada]);

  useEffect(
    () => ouvirClinicasAtualizadas(carregarClinicaVinculada),
    [carregarClinicaVinculada]
  );

  useEffect(() => {
    return () => {
      if (tempoFechamentoMenuRef.current) {
        clearTimeout(tempoFechamentoMenuRef.current);
      }
    };
  }, []);

  const horarioFuncionamento = useMemo(
    () => extrairIntervaloFuncionamento(clinicaVinculada?.horario),
    [clinicaVinculada]
  );

  const carregarConsultas = useCallback(async () => {
    if (!clinicaVinculada) return;
    setCarregandoConsultas(true);
    setErroConsultas("");
    try {
      const consultas = await buscarConsultasClinica(clinicaVinculada.id);
      const consultasFormatadas = consultas
        .map((consulta) => {
          const agenda = parseAgendaId(consulta.agenda_id);
          const data = consulta.data || consulta.data_consulta || agenda?.data;
          const horario = consulta.horario || consulta.hora || agenda?.horario || "-";
          const paciente =
            consulta.paciente ||
            usuarios.find((item) => Number(item.id) === Number(consulta.paciente_id))?.nome ||
            "";

          return {
            ...consulta,
            data,
            horario,
            paciente,
            especialidade: consulta.especialidade || "Não informada",
            medico: consulta.medico || "",
            status: consulta.status || "agendada",
          };
        })
        .filter((consulta) => consulta.paciente)
        .sort((a, b) =>
          `${a.data || ""} ${a.horario || ""}`.localeCompare(
            `${b.data || ""} ${b.horario || ""}`
          )
        );

      setConsultasDoDia(consultasFormatadas);
    } catch (e) {
      setErroConsultas(e.message || "Não conseguimos carregar as consultas da clínica agora.");
    } finally {
      setCarregandoConsultas(false);
    }
  }, [clinicaVinculada, usuarios]);

  useEffect(() => {
    carregarConsultas();
  }, [carregarConsultas]);

  function iniciarEdicaoEmMassa() {
    setConsultasEmEdicao(consultasDoDia.map((consulta) => ({ ...consulta })));
    setModoEdicaoTabela(true);
  }

  function cancelarEdicaoEmMassa() {
    setModoEdicaoTabela(false);
    setConsultasEmEdicao([]);
  }

  function alterarCampoConsulta(indice, campo, valor) {
    setConsultasEmEdicao((listaAtual) =>
      listaAtual.map((consulta, i) =>
        i === indice ? { ...consulta, [campo]: valor } : consulta
      )
    );
  }

  function salvarEdicaoEmMassa() {
    setConsultasDoDia(consultasEmEdicao);
    setModoEdicaoTabela(false);
    setConsultasEmEdicao([]);
  }

  function deletarConsulta(indice) {
    setConsultasEmEdicao((listaAtual) => listaAtual.filter((_, i) => i !== indice));
  }

  function alterarCampoUploadConsulta(campo, valor) {
    setFormularioUploadConsulta((atual) => ({
      ...atual,
      [campo]: valor,
    }));
  }

  function abrirUploadConsulta(consulta) {
    setErroConsultas("");
    setMensagemConsultas("");
    setConsultaUploadSelecionada(consulta);
    setArquivosUploadConsulta([]);
    setFormularioUploadConsulta({
      categoriaDocumento: "prontuario",
      observacoes: "",
    });
  }

  function fecharUploadConsulta() {
    setConsultaUploadSelecionada(null);
    setArquivosUploadConsulta([]);
    setFormularioUploadConsulta({
      categoriaDocumento: "prontuario",
      observacoes: "",
    });
  }

  async function enviarUploadConsulta(evento) {
    evento.preventDefault();
    setErroConsultas("");
    setMensagemConsultas("");

    if (!consultaUploadSelecionada) {
      setErroConsultas("Selecione uma consulta para anexar o arquivo.");
      return;
    }

    if (arquivosUploadConsulta.length === 0) {
      setErroConsultas("Selecione pelo menos um arquivo para upload.");
      return;
    }

    const arquivoMuitoGrande = arquivosUploadConsulta.find(
      (arquivo) => arquivo.size > TAMANHO_MAXIMO_ANEXO_CONSULTA
    );
    if (arquivoMuitoGrande) {
      setErroConsultas(`O arquivo ${arquivoMuitoGrande.name} deve ter no máximo 2 MB.`);
      return;
    }

    setUploadConsultaEmAndamento(String(consultaUploadSelecionada.id));

    try {
      const arquivos = await Promise.all(
        arquivosUploadConsulta.map(async (arquivo) => ({
          nomeArquivo: arquivo.name,
          arquivoDataUrl: await arquivoParaDataUrl(arquivo),
          tipoArquivo: arquivo.type || "application/octet-stream",
          tamanhoArquivo: arquivo.size,
        }))
      );
      const documentos = await anexarArquivoConsulta(consultaUploadSelecionada, {
        categoriaDocumento: formularioUploadConsulta.categoriaDocumento,
        arquivos,
        descricao:
          formularioUploadConsulta.observacoes ||
          `Arquivo anexado pela ${nomeClinica}.`,
        anexadoPorNome: usuario?.nome || "Admin da clínica",
      });
      const totalDocumentos = Array.isArray(documentos) ? documentos.length : 1;

      fecharUploadConsulta();
      setMensagemConsultas(
        totalDocumentos > 1
          ? `${totalDocumentos} arquivos anexados e liberados nos downloads do paciente.`
          : "Arquivo anexado e liberado nos downloads do paciente."
      );
    } catch (falha) {
      setErroConsultas(falha.message || "Não conseguimos anexar o arquivo agora.");
    } finally {
      setUploadConsultaEmAndamento("");
    }
  }

  const resumoConsultas = useMemo(() => {
    return consultasDoDia.reduce(
      (acc, consulta) => {
        const status = String(consulta.status || "").toLowerCase();
        acc.total += 1;
        if (status === "realizada") acc.realizadas += 1;
        if (status === "cancelada") acc.canceladas += 1;
        if (["agendada", "confirmada"].includes(status)) acc.pendentes += 1;
        return acc;
      },
      { total: 0, pendentes: 0, realizadas: 0, canceladas: 0 }
    );
  }, [consultasDoDia]);

  function sairDaConta() {
    cancelarFechamentoDoMenu();
    setMenuUsuarioAberto(false);
    realizarLogout();
  }

  function cancelarFechamentoDoMenu() {
    if (tempoFechamentoMenuRef.current) {
      clearTimeout(tempoFechamentoMenuRef.current);
      tempoFechamentoMenuRef.current = null;
    }
  }

  function fecharMenuAoSairDoHover() {
    cancelarFechamentoDoMenu();
    tempoFechamentoMenuRef.current = setTimeout(() => {
      setMenuUsuarioAberto(false);
    }, 350);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CabecalhoApp
        titulo="Consultas"
        descricao={`Consultas da clínica ${nomeClinica}`}
        acao={
          <div
            className="relative z-30"
            onMouseEnter={cancelarFechamentoDoMenu}
            onMouseLeave={fecharMenuAoSairDoHover}
          >
            <button
              type="button"
              onClick={() => setMenuUsuarioAberto((v) => !v)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30"
              aria-label="Perfil do usuário"
            >
              <UserCircle className="h-6 w-6" aria-hidden="true" />
            </button>
            {menuUsuarioAberto && (
              <div className="absolute right-0 z-40 mt-4 w-56 overflow-hidden rounded-2xl border border-blue-100/80 bg-white shadow-xl shadow-blue-950/10 ring-1 ring-black/5 sm:right-1/2 sm:translate-x-1/2">
                <div className="border-b border-gray-100 bg-blue-50/70 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-500">
                    Conta
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-gray-800">
                    Opções do usuário
                  </p>
                </div>
                <button
                  type="button"
                  onClick={sairDaConta}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-red-500 transition hover:bg-red-50"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-500">
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span>Sair</span>
                </button>
              </div>
            )}
          </div>
        }
      />

      <main className="app-content space-y-4">
        {mensagemConsultas && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-sm text-emerald-700">{mensagemConsultas}</p>
          </div>
        )}

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Consultas cadastradas</p>
            <strong className="text-3xl text-gray-800">{resumoConsultas.total}</strong>
            <p className="mt-1 text-xs text-gray-400">Agenda da unidade</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Pendentes</p>
            <strong className="text-3xl text-gray-800">{resumoConsultas.pendentes}</strong>
            <p className="mt-1 text-xs text-gray-400">Agendadas ou confirmadas</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Realizadas</p>
            <strong className="text-3xl text-gray-800">{resumoConsultas.realizadas}</strong>
            <p className="mt-1 text-xs text-gray-400">Atendimentos concluídos</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Canceladas</p>
            <strong className="text-3xl text-gray-800">{resumoConsultas.canceladas}</strong>
            <p className="mt-1 text-xs text-gray-400">Remarcação necessária</p>
          </div>
        </section>

        <section className="clinic-record-panel">
          <div className="clinic-record-header">
            <h2 className="clinic-record-title">Consultas da unidade</h2>
            {!modoEdicaoTabela ? (
              <button
                type="button"
                onClick={iniciarEdicaoEmMassa}
                disabled={consultasDoDia.length === 0}
                className="clinic-record-action"
              >
                Editar todas
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={salvarEdicaoEmMassa}
                  className="clinic-record-primary-action"
                >
                  Salvar tudo
                </button>
                <button
                  type="button"
                  onClick={cancelarEdicaoEmMassa}
                  className="clinic-record-secondary-action"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>

          {horarioFuncionamento && (
            <p className="clinic-record-schedule">
              Funcionamento: {horarioFuncionamento.inicio} as {horarioFuncionamento.fim}
            </p>
          )}

          {carregandoConsultas && (
            <p className="clinic-record-empty">Carregando consultas...</p>
          )}

          {!carregandoConsultas && erroConsultas && (
            <p className="clinic-record-empty text-red-500">{erroConsultas}</p>
          )}

          {!carregandoConsultas && !erroConsultas && consultasDoDia.length === 0 && (
            <p className="clinic-record-empty">
              Ainda não há consultas cadastradas para esta clínica.
            </p>
          )}

          {!carregandoConsultas && !erroConsultas && consultasDoDia.length > 0 && (
            <div className="clinic-record-table-wrap">
              <table className="clinic-record-table min-w-[760px]">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Horário</th>
                    <th>Paciente</th>
                    <th>Especialidade</th>
                    <th>Médico</th>
                    <th>Status</th>
                    <th>Arquivo</th>
                  </tr>
                </thead>
                <tbody>
                  {(modoEdicaoTabela ? consultasEmEdicao : consultasDoDia).map(
                    (consulta, indice) => (
                      <tr key={consulta.id}>
                        <td>
                          {modoEdicaoTabela ? (
                            <input
                              type="date"
                              value={consulta.data || ""}
                              onChange={(e) =>
                                alterarCampoConsulta(indice, "data", e.target.value)
                              }
                              className="w-full rounded-lg border border-blue-200 px-2 py-1"
                            />
                          ) : (
                            consulta.data || "-"
                          )}
                        </td>
                        <td className="clinic-record-time">
                          {modoEdicaoTabela ? (
                            <input
                              type="time"
                              value={consulta.horario}
                              onChange={(e) =>
                                alterarCampoConsulta(indice, "horario", e.target.value)
                              }
                              className="w-full rounded-lg border border-blue-200 px-2 py-1"
                            />
                          ) : (
                            consulta.horario
                          )}
                        </td>
                        <td>
                          {modoEdicaoTabela ? (
                            <input
                              type="text"
                              value={consulta.paciente}
                              onChange={(e) =>
                                alterarCampoConsulta(indice, "paciente", e.target.value)
                              }
                              className="w-full rounded-lg border border-blue-200 px-2 py-1"
                            />
                          ) : (
                            consulta.paciente
                          )}
                        </td>
                        <td>
                          {modoEdicaoTabela ? (
                            <input
                              type="text"
                              value={consulta.especialidade}
                              onChange={(e) =>
                                alterarCampoConsulta(indice, "especialidade", e.target.value)
                              }
                              className="w-full rounded-lg border border-blue-200 px-2 py-1"
                            />
                          ) : (
                            consulta.especialidade
                          )}
                        </td>
                        <td>
                          {modoEdicaoTabela ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={consulta.medico}
                                onChange={(e) =>
                                  alterarCampoConsulta(indice, "medico", e.target.value)
                                }
                                className="w-full rounded-lg border border-blue-200 px-2 py-1"
                              />
                              <button
                                type="button"
                                onClick={() => deletarConsulta(indice)}
                                className="text-xs font-semibold text-red-500 hover:text-red-600"
                              >
                                Deletar
                              </button>
                            </div>
                          ) : (
                            consulta.medico
                          )}
                        </td>
                        <td>
                          {modoEdicaoTabela ? (
                            <select
                              value={consulta.status}
                              onChange={(e) =>
                                alterarCampoConsulta(indice, "status", e.target.value)
                              }
                              className="w-full rounded-lg border border-blue-200 px-2 py-1"
                            >
                              <option value="agendada">Agendada</option>
                              <option value="confirmada">Confirmada</option>
                              <option value="realizada">Realizada</option>
                              <option value="cancelada">Cancelada</option>
                            </select>
                          ) : (
                            <span className="clinic-record-status">
                              {consulta.status}
                            </span>
                          )}
                        </td>
                        <td>
                          {modoEdicaoTabela ? (
                            <span className="text-xs text-gray-400">-</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => abrirUploadConsulta(consulta)}
                              className="clinic-record-upload-button"
                            >
                              <Upload className="h-4 w-4" aria-hidden="true" />
                              Upload
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {consultaUploadSelecionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <form
            onSubmit={enviarUploadConsulta}
            className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-800">
                  Upload de arquivo
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {consultaUploadSelecionada.paciente} -{" "}
                  {consultaUploadSelecionada.especialidade || "Atendimento"}
                </p>
              </div>
              <button
                type="button"
                onClick={fecharUploadConsulta}
                className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
              >
                Fechar
              </button>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                  Tipo de arquivo
                </span>
                <select
                  value={formularioUploadConsulta.categoriaDocumento}
                  onChange={(evento) =>
                    alterarCampoUploadConsulta("categoriaDocumento", evento.target.value)
                  }
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  {TIPOS_DOCUMENTO_CONSULTA.map((tipo) => (
                    <option key={tipo.valor} value={tipo.valor}>
                      {tipo.rotulo}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                  Arquivos
                </span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,image/png,image/jpeg,.txt,text/plain"
                  onChange={(evento) =>
                    setArquivosUploadConsulta(arquivosParaLista(evento.target.files))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                {arquivosUploadConsulta.length > 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    {arquivosUploadConsulta.length} arquivo(s) selecionado(s).
                  </p>
                )}
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                  Observacoes
                </span>
                <input
                  value={formularioUploadConsulta.observacoes}
                  onChange={(evento) =>
                    alterarCampoUploadConsulta("observacoes", evento.target.value)
                  }
                  placeholder="Ex.: documento anexado pela unidade"
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={fecharUploadConsulta}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={uploadConsultaEmAndamento === String(consultaUploadSelecionada.id)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-400 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                {uploadConsultaEmAndamento === String(consultaUploadSelecionada.id)
                  ? "Enviando..."
                  : "Enviar arquivos"}
              </button>
            </div>
          </form>
        </div>
      )}

      <MenuInferiorAdmin abaAtiva="consultas" />
      <div className="h-24" />
    </div>
  );
}

export default AdminConsultasClinica;
