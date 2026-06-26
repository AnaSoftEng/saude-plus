import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { obterUsuarioAtual } from "../../application/auth/auth-service";
import { ouvirClinicasAtualizadas } from "../../application/clinicas/clinicas-eventos";
import { buscarClinicaPorId } from "../../application/clinicas/clinicas-use-cases";
import { ouvirExamesAtualizados } from "../../application/exames/exames-eventos";
import {
  anexarResultadoExame,
  listarExamesClinica,
} from "../../application/exames/exames-use-cases";
import CabecalhoApp from "../components/cabecalho-app";
import MenuInferiorMedico from "../components/menu-inferior-medico";
import MenuUsuario from "../components/menu-usuario";

const TAMANHO_MAXIMO_RESULTADO = 2 * 1024 * 1024;
const TIPOS_DOCUMENTO = [
  { valor: "exame", rotulo: "Exame" },
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

function formatarExame(exame) {
  return {
    ...exame,
    data: exame.data || "",
    horario: exame.horario || "-",
    paciente: exame.paciente || "",
    medico: exame.medico || "",
    tipo: exame.tipo || "Exame",
    status: exame.status || "agendado",
  };
}

function MedicoExamesClinica() {
  const usuario = obterUsuarioAtual();
  const [clinica, setClinica] = useState(null);
  const [exames, setExames] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [exameUpload, setExameUpload] = useState(null);
  const [arquivosUpload, setArquivosUpload] = useState([]);
  const [uploadEmAndamento, setUploadEmAndamento] = useState("");
  const [formularioUpload, setFormularioUpload] = useState({
    categoriaDocumento: "exame",
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
      const [clinicaApi, examesApi] = await Promise.all([
        buscarClinicaPorId(usuario.clinica_id),
        listarExamesClinica(usuario.clinica_id, usuario.id),
      ]);
      setClinica(clinicaApi);
      setExames(
        (Array.isArray(examesApi) ? examesApi : [])
          .map(formatarExame)
          .filter((exame) => exame.paciente && Number(exame.medico_id) === Number(usuario.id))
          .sort((a, b) =>
            `${a.data || ""} ${a.horario || ""}`.localeCompare(
              `${b.data || ""} ${b.horario || ""}`
            )
          )
      );
    } catch (falha) {
      setErro(falha.message || "Não conseguimos carregar os exames da clínica agora.");
    } finally {
      setCarregando(false);
    }
  }, [usuario?.clinica_id, usuario?.id]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  useEffect(() => ouvirClinicasAtualizadas(carregarDados), [carregarDados]);
  useEffect(() => ouvirExamesAtualizados(carregarDados), [carregarDados]);

  const resumo = useMemo(() => {
    return exames.reduce(
      (acc, exame) => {
        const status = String(exame.status || "").toLowerCase();
        acc.total += 1;
        if (status === "agendado" || status === "aguardando coleta") acc.pendentes += 1;
        if (exame.resultado_disponivel || status === "liberado") acc.liberados += 1;
        if (status === "cancelado") acc.cancelados += 1;
        return acc;
      },
      { total: 0, pendentes: 0, liberados: 0, cancelados: 0 }
    );
  }, [exames]);

  function abrirUpload(exame) {
    setErro("");
    setMensagem("");
    setExameUpload(exame);
    setArquivosUpload([]);
    setFormularioUpload({ categoriaDocumento: "exame", observacoes: "" });
  }

  function fecharUpload() {
    setExameUpload(null);
    setArquivosUpload([]);
    setFormularioUpload({ categoriaDocumento: "exame", observacoes: "" });
  }

  async function enviarUpload(evento) {
    evento.preventDefault();
    setErro("");
    setMensagem("");

    if (!exameUpload || arquivosUpload.length === 0) {
      setErro("Selecione um exame e pelo menos um arquivo.");
      return;
    }

    const arquivoMuitoGrande = arquivosUpload.find(
      (arquivo) => arquivo.size > TAMANHO_MAXIMO_RESULTADO
    );
    if (arquivoMuitoGrande) {
      setErro(`O arquivo ${arquivoMuitoGrande.name} deve ter no máximo 2 MB.`);
      return;
    }

    setUploadEmAndamento(String(exameUpload.id));
    try {
      const arquivos = await Promise.all(
        arquivosUpload.map(async (arquivo) => ({
          nomeArquivo: arquivo.name,
          arquivoDataUrl: await arquivoParaDataUrl(arquivo),
          tipoArquivo: arquivo.type || "application/octet-stream",
          tamanhoArquivo: arquivo.size,
        }))
      );
      const resultado = await anexarResultadoExame(exameUpload.id, {
        categoriaDocumento: formularioUpload.categoriaDocumento,
        arquivos,
        descricao:
          formularioUpload.observacoes ||
          `Laudo liberado por Dr(a). ${usuario?.nome || "Médico"} na ${nomeClinica}.`,
        anexadoPor: "medico",
        anexadoPorNome: usuario?.nome || "Médico",
      });
      const documentos = Array.isArray(resultado) ? resultado : [resultado];
      setExames((atuais) => {
        const porId = new Map(documentos.map((documento) => [String(documento.id), documento]));
        return atuais.map((item) => formatarExame(porId.get(String(item.id)) || item));
      });
      fecharUpload();
      setMensagem(
        documentos.length > 1
          ? `${documentos.length} arquivos anexados e liberados nos downloads.`
          : "Arquivo anexado e liberado nos downloads."
      );
    } catch (falha) {
      setErro(falha.message || "Não conseguimos anexar o resultado agora.");
    } finally {
      setUploadEmAndamento("");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CabecalhoApp
        compacto
        titulo="Exames"
        descricao={`Exames marcados para Dr(a). ${usuario?.nome || "Médico"} na ${nomeClinica}`}
        acao={<MenuUsuario mostrarPerfil={false} />}
      />

      <main className="app-content space-y-4">
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Exames agendados</p>
            <strong className="text-3xl text-gray-800">{resumo.total}</strong>
            <p className="mt-1 text-xs text-gray-400">Sua agenda na unidade</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Coletas pendentes</p>
            <strong className="text-3xl text-gray-800">{resumo.pendentes}</strong>
            <p className="mt-1 text-xs text-gray-400">Aguardando atendimento</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Resultados</p>
            <strong className="text-3xl text-gray-800">{resumo.liberados}</strong>
            <p className="mt-1 text-xs text-gray-400">Liberados hoje</p>
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
            <h2 className="clinic-record-title">Seus exames</h2>
          </div>

          {horarioFuncionamento && (
            <p className="clinic-record-schedule">
              Funcionamento: {horarioFuncionamento.inicio} as {horarioFuncionamento.fim}
            </p>
          )}

          {carregando ? (
            <p className="clinic-record-empty">Carregando exames...</p>
          ) : exames.length === 0 ? (
            <p className="clinic-record-empty">
              Nenhum exame marcado para este médico.
            </p>
          ) : (
            <div className="clinic-record-table-wrap">
              <table className="clinic-record-table min-w-[860px]">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Horário</th>
                    <th>Paciente</th>
                    <th>Exame</th>
                    <th>Médico</th>
                    <th>Status</th>
                    <th>Arquivo</th>
                  </tr>
                </thead>
                <tbody>
                  {exames.map((exame) => {
                    const liberado =
                      exame.resultado_disponivel ||
                      String(exame.status || "").toLowerCase() === "liberado";
                    return (
                      <tr key={exame.id}>
                        <td>
                          {exame.data || "-"}
                        </td>
                        <td className="clinic-record-time">
                          {exame.horario}
                        </td>
                        <td>{exame.paciente}</td>
                        <td>{exame.tipo}</td>
                        <td>{exame.medico || "Não informado"}</td>
                        <td>
                          <span className="clinic-record-status">
                            {exame.status}
                          </span>
                        </td>
                        <td>
                          {liberado ? (
                            <div className="space-y-1">
                              <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                                Disponivel
                              </span>
                              {exame.resultado_nome_arquivo && (
                                <p className="max-w-[180px] truncate text-xs text-gray-500">
                                  {exame.resultado_nome_arquivo}
                                </p>
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => abrirUpload(exame)}
                              className="clinic-record-upload-button"
                            >
                              <Upload className="h-4 w-4" aria-hidden="true" />
                              Upload
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {exameUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <form onSubmit={enviarUpload} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Upload de exame</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {exameUpload.tipo} - {exameUpload.paciente}
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
                <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Observacoes</span>
                <input
                  value={formularioUpload.observacoes}
                  onChange={(evento) =>
                    setFormularioUpload((atual) => ({
                      ...atual,
                      observacoes: evento.target.value,
                    }))
                  }
                  placeholder="Ex.: laudo anexado pela unidade"
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
                disabled={uploadEmAndamento === String(exameUpload.id)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-400 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                {uploadEmAndamento === String(exameUpload.id) ? "Enviando..." : "Enviar arquivos"}
              </button>
            </div>
          </form>
        </div>
      )}

      <MenuInferiorMedico abaAtiva="exames" />
      <div className="h-24" />
    </div>
  );
}

export default MedicoExamesClinica;
