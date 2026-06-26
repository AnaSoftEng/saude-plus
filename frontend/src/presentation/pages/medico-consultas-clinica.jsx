import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Upload } from "lucide-react";
import {
  anexarArquivoConsulta,
  buscarConsultasClinica,
} from "../../application/agenda/agendamento-use-cases";
import { ouvirConsultasAtualizadas } from "../../application/agenda/consultas-eventos";
import { obterUsuarioAtual } from "../../application/auth/auth-service";
import { ouvirClinicasAtualizadas } from "../../application/clinicas/clinicas-eventos";
import { buscarClinicaPorId } from "../../application/clinicas/clinicas-use-cases";
import CabecalhoApp from "../components/cabecalho-app";
import MenuInferiorMedico from "../components/menu-inferior-medico";
import MenuUsuario from "../components/menu-usuario";

const TAMANHO_MAXIMO_ANEXO = 2 * 1024 * 1024;
const TIPOS_DOCUMENTO = [
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

function parseAgendaId(agendaId) {
  const parsed = /^ag-(\d+)-(\d{4}-\d{2}-\d{2})-t(\d{2})(\d{2})$/.exec(
    String(agendaId || "")
  );
  if (!parsed) return null;
  return { data: parsed[2], horario: `${parsed[3]}:${parsed[4]}` };
}

function extrairIntervaloFuncionamento(horarioTexto) {
  const match = String(horarioTexto || "").match(/(\d{2})h\s+(?:as|as)\s+(\d{2})h/i);
  if (!match) return null;
  return {
    inicio: `${match[1]}:00`,
    fim: `${match[2]}:00`,
  };
}

function formatarConsulta(consulta) {
  const agenda = parseAgendaId(consulta.agenda_id);
  return {
    ...consulta,
    data: consulta.data || consulta.data_consulta || agenda?.data || "",
    horario: consulta.horario || consulta.hora || agenda?.horario || "-",
    paciente: consulta.paciente || "",
    medico: consulta.medico || "",
    especialidade: consulta.especialidade || "Não informada",
    status: consulta.status || "agendada",
  };
}

function MedicoConsultasClinica() {
  const usuario = obterUsuarioAtual();
  const [clinica, setClinica] = useState(null);
  const [consultas, setConsultas] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [consultaUpload, setConsultaUpload] = useState(null);
  const [arquivosUpload, setArquivosUpload] = useState([]);
  const [uploadEmAndamento, setUploadEmAndamento] = useState("");
  const [formularioUpload, setFormularioUpload] = useState({
    categoriaDocumento: "prontuario",
    observacoes: "",
  });

  const nomeClinica = clinica?.nome || "clínica vinculada";
  const horarioFuncionamento = useMemo(
    () => extrairIntervaloFuncionamento(clinica?.horario),
    [clinica]
  );

  const carregarDados = useCallback(async () => {
    if (!usuario?.clinica_id) {
      setErro("Seu usuário ainda não tem uma clínica vinculada.");
      return;
    }

    setCarregando(true);
    setErro("");
    try {
      const [clinicaApi, consultasApi] = await Promise.all([
        buscarClinicaPorId(usuario.clinica_id),
        buscarConsultasClinica(usuario.clinica_id, usuario.id),
      ]);
      setClinica(clinicaApi);
      setConsultas(
        (Array.isArray(consultasApi) ? consultasApi : [])
          .map(formatarConsulta)
          .filter((consulta) => consulta.paciente && Number(consulta.medico_id) === Number(usuario.id))
          .sort((a, b) =>
            `${a.data || ""} ${a.horario || ""}`.localeCompare(
              `${b.data || ""} ${b.horario || ""}`
            )
          )
      );
    } catch (falha) {
      setErro(falha.message || "Não conseguimos carregar as consultas da clínica agora.");
    } finally {
      setCarregando(false);
    }
  }, [usuario?.clinica_id, usuario?.id]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  useEffect(() => ouvirClinicasAtualizadas(carregarDados), [carregarDados]);
  useEffect(() => ouvirConsultasAtualizadas(carregarDados), [carregarDados]);

  const resumo = useMemo(() => {
    return consultas.reduce(
      (acc, consulta) => {
        const status = String(consulta.status || "").toLowerCase();
        acc.total += 1;
        if (["agendada", "confirmada"].includes(status)) acc.pendentes += 1;
        if (status === "realizada") acc.realizadas += 1;
        if (status === "cancelada") acc.canceladas += 1;
        return acc;
      },
      { total: 0, pendentes: 0, realizadas: 0, canceladas: 0 }
    );
  }, [consultas]);

  function abrirUpload(consulta) {
    setErro("");
    setMensagem("");
    setConsultaUpload(consulta);
    setArquivosUpload([]);
    setFormularioUpload({ categoriaDocumento: "prontuario", observacoes: "" });
  }

  function fecharUpload() {
    setConsultaUpload(null);
    setArquivosUpload([]);
    setFormularioUpload({ categoriaDocumento: "prontuario", observacoes: "" });
  }

  async function enviarUpload(evento) {
    evento.preventDefault();
    setErro("");
    setMensagem("");

    if (!consultaUpload || arquivosUpload.length === 0) {
      setErro("Selecione uma consulta e pelo menos um arquivo.");
      return;
    }

    const arquivoMuitoGrande = arquivosUpload.find(
      (arquivo) => arquivo.size > TAMANHO_MAXIMO_ANEXO
    );
    if (arquivoMuitoGrande) {
      setErro(`O arquivo ${arquivoMuitoGrande.name} deve ter no máximo 2 MB.`);
      return;
    }

    setUploadEmAndamento(String(consultaUpload.id));
    try {
      const arquivos = await Promise.all(
        arquivosUpload.map(async (arquivo) => ({
          nomeArquivo: arquivo.name,
          arquivoDataUrl: await arquivoParaDataUrl(arquivo),
          tipoArquivo: arquivo.type || "application/octet-stream",
          tamanhoArquivo: arquivo.size,
        }))
      );
      const documentos = await anexarArquivoConsulta(consultaUpload, {
        categoriaDocumento: formularioUpload.categoriaDocumento,
        arquivos,
        descricao:
          formularioUpload.observacoes ||
          `Arquivo anexado por Dr(a). ${usuario?.nome || "Médico"} na ${nomeClinica}.`,
        anexadoPor: "medico",
        anexadoPorNome: usuario?.nome || "Médico",
      });
      const total = Array.isArray(documentos) ? documentos.length : 1;
      fecharUpload();
      setMensagem(
        total > 1
          ? `${total} arquivos anexados e liberados nos downloads do paciente.`
          : "Arquivo anexado e liberado nos downloads do paciente."
      );
    } catch (falha) {
      setErro(falha.message || "Não conseguimos anexar o arquivo agora.");
    } finally {
      setUploadEmAndamento("");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CabecalhoApp
        compacto
        titulo="Consultas"
        descricao={`Atendimentos marcados para Dr(a). ${usuario?.nome || "Médico"} na ${nomeClinica}`}
        acao={<MenuUsuario mostrarPerfil={false} />}
      />

      <main className="app-content space-y-4">
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Consultas cadastradas</p>
            <strong className="text-3xl text-gray-800">{resumo.total}</strong>
            <p className="mt-1 text-xs text-gray-400">Sua agenda na unidade</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Pendentes</p>
            <strong className="text-3xl text-gray-800">{resumo.pendentes}</strong>
            <p className="mt-1 text-xs text-gray-400">Agendadas ou confirmadas</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Realizadas</p>
            <strong className="text-3xl text-gray-800">{resumo.realizadas}</strong>
            <p className="mt-1 text-xs text-gray-400">Atendimentos concluídos</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Canceladas</p>
            <strong className="text-3xl text-gray-800">{resumo.canceladas}</strong>
            <p className="mt-1 text-xs text-gray-400">Remarcação necessária</p>
          </div>
        </section>

        {mensagem && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-sm text-emerald-700">{mensagem}</p>
          </div>
        )}

        {erro && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-600">{erro}</p>
          </div>
        )}

        <section className="clinic-record-panel">
          <div className="clinic-record-header">
            <h2 className="clinic-record-title">Suas consultas</h2>
          </div>

          {horarioFuncionamento && (
            <p className="clinic-record-schedule">
              Funcionamento: {horarioFuncionamento.inicio} as {horarioFuncionamento.fim}
            </p>
          )}

          {carregando ? (
            <p className="clinic-record-empty">Carregando consultas...</p>
          ) : consultas.length === 0 ? (
            <p className="clinic-record-empty">
              Nenhuma consulta marcada para este medico.
            </p>
          ) : (
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
                  {consultas.map((consulta) => (
                    <tr key={consulta.id}>
                      <td>
                        {consulta.data || "-"}
                      </td>
                      <td className="clinic-record-time">
                        {consulta.horario}
                      </td>
                      <td>{consulta.paciente}</td>
                      <td>{consulta.especialidade}</td>
                      <td>{consulta.medico || "Não informado"}</td>
                      <td>
                        <span className="clinic-record-status">
                          {consulta.status}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => abrirUpload(consulta)}
                          className="clinic-record-upload-button"
                        >
                          <Upload className="h-4 w-4" aria-hidden="true" />
                          {uploadEmAndamento === String(consulta.id) ? "Enviando..." : "Upload"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {consultaUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <form onSubmit={enviarUpload} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Upload de arquivo</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {consultaUpload.paciente} - {consultaUpload.especialidade || "Atendimento"}
                </p>
              </div>
              <button type="button" onClick={fecharUpload} className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200">
                Fechar
              </button>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Tipo de arquivo</span>
                <select
                  value={formularioUpload.categoriaDocumento}
                  onChange={(evento) =>
                    setFormularioUpload((atual) => ({
                      ...atual,
                      categoriaDocumento: evento.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  {TIPOS_DOCUMENTO.map((tipo) => (
                    <option key={tipo.valor} value={tipo.valor}>{tipo.rotulo}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Arquivos</span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,image/png,image/jpeg,.txt,text/plain"
                  onChange={(evento) => setArquivosUpload(arquivosParaLista(evento.target.files))}
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                {arquivosUpload.length > 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    {arquivosUpload.length} arquivo(s) selecionado(s).
                  </p>
                )}
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Observações</span>
                <input
                  value={formularioUpload.observacoes}
                  onChange={(evento) =>
                    setFormularioUpload((atual) => ({
                      ...atual,
                      observacoes: evento.target.value,
                    }))
                  }
                  placeholder="Ex.: documento anexado pela unidade"
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={fecharUpload}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={uploadEmAndamento === String(consultaUpload.id)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-400 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                {uploadEmAndamento === String(consultaUpload.id) ? "Enviando..." : "Enviar arquivos"}
              </button>
            </div>
          </form>
        </div>
      )}

      <MenuInferiorMedico abaAtiva="consultas" />
      <div className="h-24" />
    </div>
  );
}

export default MedicoConsultasClinica;
