import React, { useEffect, useMemo, useRef, useState } from "react";
import { LogOut, Upload, UserCircle } from "lucide-react";
import { obterUsuarioAtual, realizarLogout } from "../../application/auth/auth-service";
import { ouvirClinicasAtualizadas } from "../../application/clinicas/clinicas-eventos";
import { buscarClinicaPorId } from "../../application/clinicas/clinicas-use-cases";
import { ouvirExamesAtualizados } from "../../application/exames/exames-eventos";
import {
  anexarResultadoExame,
  listarExamesClinica,
  salvarExamesEmMassa,
} from "../../application/exames/exames-use-cases";
import { listarUsuarios } from "../../application/usuarios/usuarios-use-cases";
import CabecalhoApp from "../components/cabecalho-app";
import MenuInferiorAdmin from "../components/menu-inferior-admin";

const TAMANHO_MAXIMO_RESULTADO = 2 * 1024 * 1024;
const TIPOS_DOCUMENTO_UPLOAD = [
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

function AdminExamesClinica() {
  const usuario = obterUsuarioAtual();
  const [clinicaVinculada, setClinicaVinculada] = useState(null);
  const [examesClinica, setExamesClinica] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [uploadEmAndamento, setUploadEmAndamento] = useState("");
  const [exameUploadSelecionado, setExameUploadSelecionado] = useState(null);
  const [arquivosUpload, setArquivosUpload] = useState([]);
  const [formularioUpload, setFormularioUpload] = useState({
    categoriaDocumento: "exame",
    observacoes: "",
  });
  const [modoEdicaoTabela, setModoEdicaoTabela] = useState(false);
  const [examesEmEdicao, setExamesEmEdicao] = useState([]);
  const [menuUsuarioAberto, setMenuUsuarioAberto] = useState(false);
  const tempoFechamentoMenuRef = useRef(null);
  const nomeClinica = clinicaVinculada?.nome || "Clínica não identificada";
  const horarioFuncionamento = useMemo(
    () => extrairIntervaloFuncionamento(clinicaVinculada?.horario),
    [clinicaVinculada]
  );

  async function carregarClinicaVinculada() {
    if (!usuario?.clinica_id) return;

    setErro("");
    try {
      const [clinica, exames, usuariosApi] = await Promise.all([
        buscarClinicaPorId(usuario.clinica_id),
        listarExamesClinica(usuario.clinica_id),
        listarUsuarios(),
      ]);
      const listaUsuarios = Array.isArray(usuariosApi) ? usuariosApi : [];
      const examesFormatados = (Array.isArray(exames) ? exames : []).map((exame) => ({
        ...exame,
        paciente:
          exame.paciente ||
          listaUsuarios.find((item) => Number(item.id) === Number(exame.paciente_id))?.nome ||
          "",
        medico: exame.medico || "",
      })).filter((exame) => exame.paciente);

      setClinicaVinculada(clinica);
      setExamesClinica(examesFormatados);
      setUsuarios(listaUsuarios);
    } catch (falha) {
      setErro(falha.message || "Não conseguimos carregar a clínica vinculada agora.");
    }
  }

  useEffect(() => {
    carregarClinicaVinculada();
  }, [usuario?.clinica_id]);

  useEffect(() => ouvirClinicasAtualizadas(carregarClinicaVinculada), [usuario?.clinica_id]);
  useEffect(() => ouvirExamesAtualizados(carregarClinicaVinculada), [usuario?.clinica_id]);

  useEffect(() => {
    return () => {
      if (tempoFechamentoMenuRef.current) {
        clearTimeout(tempoFechamentoMenuRef.current);
      }
    };
  }, []);

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

  function alterarCampoUpload(campo, valor) {
    setFormularioUpload((atual) => ({
      ...atual,
      [campo]: valor,
    }));
  }

  function abrirUpload(exame) {
    setErro("");
    setMensagem("");
    setArquivosUpload([]);
    setFormularioUpload({
      categoriaDocumento: exame?.resultado_categoria || "exame",
      observacoes: "",
    });
    setExameUploadSelecionado(exame);
  }

  function fecharUpload() {
    setExameUploadSelecionado(null);
    setArquivosUpload([]);
    setFormularioUpload({
      categoriaDocumento: "exame",
      observacoes: "",
    });
  }

  function iniciarEdicaoEmMassa() {
    setExamesEmEdicao(examesClinica.map((exame) => ({ ...exame })));
    setModoEdicaoTabela(true);
  }

  function cancelarEdicaoEmMassa() {
    setModoEdicaoTabela(false);
    setExamesEmEdicao([]);
  }

  function alterarCampoExame(indice, campo, valor) {
    setExamesEmEdicao((listaAtual) =>
      listaAtual.map((exame, i) => (i === indice ? { ...exame, [campo]: valor } : exame))
    );
  }

  async function salvarEdicaoEmMassa() {
    setErro("");
    setMensagem("");

    try {
      const atualizados = await salvarExamesEmMassa(clinicaVinculada.id, examesEmEdicao);
      setExamesClinica(atualizados);
      setModoEdicaoTabela(false);
      setExamesEmEdicao([]);
      setMensagem("Exames atualizados com sucesso.");
    } catch (falha) {
      setErro(falha.message || "Não conseguimos salvar os exames agora.");
    }
  }

  function deletarExameEmEdicao(indice) {
    setExamesEmEdicao((listaAtual) => listaAtual.filter((_, i) => i !== indice));
  }

  async function enviarUploadDoExame(evento) {
    evento.preventDefault();
    setErro("");
    setMensagem("");

    if (!exameUploadSelecionado) {
      setErro("Selecione um exame para anexar o arquivo.");
      return;
    }

    if (arquivosUpload.length === 0) {
      setErro("Selecione pelo menos um arquivo para upload.");
      return;
    }

    const arquivoMuitoGrande = arquivosUpload.find(
      (arquivo) => arquivo.size > TAMANHO_MAXIMO_RESULTADO
    );
    if (arquivoMuitoGrande) {
      setErro(`O arquivo ${arquivoMuitoGrande.name} deve ter no máximo 2 MB.`);
      return;
    }

    setUploadEmAndamento(String(exameUploadSelecionado.id));

    try {
      const arquivos = await Promise.all(
        arquivosUpload.map(async (arquivo) => ({
          nomeArquivo: arquivo.name,
          arquivoDataUrl: await arquivoParaDataUrl(arquivo),
          tipoArquivo: arquivo.type || "application/octet-stream",
          tamanhoArquivo: arquivo.size,
        }))
      );
      const resultado = await anexarResultadoExame(exameUploadSelecionado.id, {
        categoriaDocumento: formularioUpload.categoriaDocumento,
        arquivos,
        descricao: formularioUpload.observacoes || `Arquivo anexado pela ${nomeClinica}.`,
        anexadoPor: "admin_clinica",
        anexadoPorNome: usuario?.nome || "Admin da clínica",
      });
      const documentos = Array.isArray(resultado) ? resultado : [resultado];
      setExamesClinica((atuais) => {
        const porId = new Map(documentos.map((documento) => [String(documento.id), documento]));
        const atualizados = atuais.map((item) => porId.get(String(item.id)) || item);
        const idsAtuais = new Set(atuais.map((item) => String(item.id)));
        return [
          ...atualizados,
          ...documentos.filter((documento) => !idsAtuais.has(String(documento.id))),
        ];
      });
      fecharUpload();
      setMensagem(
        documentos.length > 1
          ? `${documentos.length} arquivos anexados e liberados nos downloads.`
          : "Arquivo anexado e liberado na categoria correta de downloads."
      );
    } catch (falha) {
      setErro(falha.message || "Não conseguimos anexar o arquivo agora.");
    } finally {
      setUploadEmAndamento("");
    }
  }

  const resumo = examesClinica.reduce(
    (acc, exame) => {
      const status = String(exame.status || "").toLowerCase();
      acc.total += 1;
      if (status === "agendado" || status === "aguardando coleta") acc.pendentes += 1;
      if (exame.resultado_disponivel || status === "liberado") acc.liberados += 1;
      return acc;
    },
    { total: 0, pendentes: 0, liberados: 0 }
  );

  const pacientes = useMemo(
    () => usuarios.filter((item) => item.nivel_acesso === "paciente"),
    [usuarios]
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <CabecalhoApp
        titulo="Exames"
        descricao={`Exames da clínica ${nomeClinica}`}
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
              <div className="absolute right-0 z-40 mt-3 w-56 overflow-hidden rounded-2xl border border-blue-100/80 bg-white shadow-xl shadow-blue-950/10 ring-1 ring-black/5">
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
        {erro && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-600">{erro}</p>
          </div>
        )}

        {mensagem && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-sm text-emerald-700">{mensagem}</p>
          </div>
        )}

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Exames agendados</p>
            <strong className="text-3xl text-gray-800">{resumo.total}</strong>
            <p className="mt-1 text-xs text-gray-400">Agenda da unidade</p>
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

        <section className="clinic-record-panel">
          <div className="clinic-record-header">
            <h2 className="clinic-record-title">Exames da unidade</h2>
              {!modoEdicaoTabela ? (
                <button
                  type="button"
                  onClick={iniciarEdicaoEmMassa}
                  disabled={examesClinica.length === 0}
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

          {examesClinica.length === 0 ? (
            <p className="clinic-record-empty">
              Nenhum exame cadastrado para esta unidade.
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
                {(modoEdicaoTabela ? examesEmEdicao : examesClinica).map((exame, indice) => {
                  const liberado =
                    exame.resultado_disponivel ||
                    String(exame.status || "").toLowerCase() === "liberado";

                  return (
                  <tr key={exame.id}>
                    <td>
                      {modoEdicaoTabela ? (
                        <input
                          type="date"
                          value={exame.data || ""}
                          onChange={(evento) =>
                            alterarCampoExame(indice, "data", evento.target.value)
                          }
                          className="w-full rounded-lg border border-blue-200 px-2 py-1"
                        />
                      ) : (
                        exame.data || "-"
                      )}
                    </td>
                    <td className="clinic-record-time">
                      {modoEdicaoTabela ? (
                        <input
                          type="time"
                          value={exame.horario === "-" ? "" : exame.horario || ""}
                          onChange={(evento) =>
                            alterarCampoExame(indice, "horario", evento.target.value || "-")
                          }
                          className="w-full rounded-lg border border-blue-200 px-2 py-1"
                        />
                      ) : (
                        exame.horario
                      )}
                    </td>
                    <td>
                      {modoEdicaoTabela ? (
                        <select
                          value={exame.paciente_id || ""}
                          onChange={(evento) => {
                            const paciente = pacientes.find(
                              (item) => Number(item.id) === Number(evento.target.value)
                            );
                            alterarCampoExame(indice, "paciente_id", evento.target.value);
                            alterarCampoExame(
                              indice,
                              "paciente",
                              paciente?.nome || ""
                            );
                          }}
                          className="w-full rounded-lg border border-blue-200 px-2 py-1"
                        >
                          <option value="">Selecione</option>
                          {pacientes.map((paciente) => (
                            <option key={paciente.id} value={paciente.id}>
                              {paciente.nome}
                            </option>
                          ))}
                        </select>
                      ) : (
                        exame.paciente
                      )}
                    </td>
                    <td>
                      {modoEdicaoTabela ? (
                        <input
                          value={exame.tipo || ""}
                          onChange={(evento) =>
                            alterarCampoExame(indice, "tipo", evento.target.value)
                          }
                          className="w-full rounded-lg border border-blue-200 px-2 py-1"
                        />
                      ) : (
                        exame.tipo
                      )}
                    </td>
                    <td>
                      {modoEdicaoTabela ? (
                        <div className="flex items-center gap-2">
                          <input
                            value={exame.medico || ""}
                            onChange={(evento) =>
                              alterarCampoExame(indice, "medico", evento.target.value)
                            }
                            className="w-full rounded-lg border border-blue-200 px-2 py-1"
                          />
                          <button
                            type="button"
                            onClick={() => deletarExameEmEdicao(indice)}
                            className="text-xs font-semibold text-red-500 hover:text-red-600"
                          >
                            Deletar
                          </button>
                        </div>
                      ) : (
                        exame.medico || "Não informado"
                      )}
                    </td>
                    <td>
                      {modoEdicaoTabela ? (
                        <select
                          value={exame.status || "agendado"}
                          onChange={(evento) =>
                            alterarCampoExame(indice, "status", evento.target.value)
                          }
                          className="w-full rounded-lg border border-blue-200 px-2 py-1"
                        >
                          <option value="agendado">Agendado</option>
                          <option value="aguardando coleta">Aguardando coleta</option>
                          <option value="liberado">Liberado</option>
                          <option value="cancelado">Cancelado</option>
                        </select>
                      ) : (
                        <span className="clinic-record-status">
                          {exame.status}
                        </span>
                      )}
                    </td>
                    <td>
                      {modoEdicaoTabela ? (
                        <span className="text-xs text-gray-400">-</span>
                      ) : liberado ? (
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

      {exameUploadSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <form
            onSubmit={enviarUploadDoExame}
            className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-800">
                  Upload de exame
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {exameUploadSelecionado.tipo} -{" "}
                  {exameUploadSelecionado.paciente || "Paciente não identificado"}
                </p>
              </div>
              <button
                type="button"
                onClick={fecharUpload}
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
                  value={formularioUpload.categoriaDocumento}
                  onChange={(evento) =>
                    alterarCampoUpload("categoriaDocumento", evento.target.value)
                  }
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  {TIPOS_DOCUMENTO_UPLOAD.map((tipo) => (
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
                <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                  Observacoes
                </span>
                <input
                  value={formularioUpload.observacoes}
                  onChange={(evento) => alterarCampoUpload("observacoes", evento.target.value)}
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
                disabled={uploadEmAndamento === String(exameUploadSelecionado.id)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-400 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                {uploadEmAndamento === String(exameUploadSelecionado.id)
                  ? "Enviando..."
                  : "Enviar arquivos"}
              </button>
            </div>
          </form>
        </div>
      )}

      <MenuInferiorAdmin abaAtiva="exames" />
      <div className="h-24" />
    </div>
  );
}

export default AdminExamesClinica;
