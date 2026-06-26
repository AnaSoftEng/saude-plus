const { AppError } = require("../errors/app-error");
const validar = require("../../infrastructure/security/validacao");
const { validarArquivoResultado } = require("../value-objects/arquivo-resultado");

function normalizarCategoriaDocumento(categoria) {
  const chave = String(categoria || "").toLowerCase();
  if (["exame", "prontuario", "atestado"].includes(chave)) return chave;
  return "exame";
}

function criarExame(dados) {
  const obrigatorios = ["paciente_id", "clinica_id", "tipo"];
  const faltando = obrigatorios.find((campo) => dados[campo] == null || dados[campo] === "");

  if (faltando) {
    throw new AppError(`Campo obrigatorio ausente: ${faltando}.`, 422, "EXAME_INVALIDO");
  }

  const arquivoResultado = dados.resultado_arquivo_data_url
    ? validarArquivoResultado(
        {
          resultado_nome_arquivo: dados.resultado_nome_arquivo || "resultado.pdf",
          resultado_arquivo_data_url: dados.resultado_arquivo_data_url,
          resultado_arquivo_tipo: dados.resultado_arquivo_tipo,
          resultado_arquivo_tamanho: dados.resultado_arquivo_tamanho,
        },
        { fallbackNome: dados.resultado_nome_arquivo || "resultado.pdf" }
      )
    : null;

  return {
    id: dados.id,
    consulta_id: dados.consulta_id,
    paciente_id: validar.inteiroPositivo(dados.paciente_id, "Paciente"),
    medico_id: dados.medico_id == null || dados.medico_id === "" ? undefined : validar.inteiroPositivo(dados.medico_id, "Medico"),
    agenda_id: dados.agenda_id ? String(dados.agenda_id) : undefined,
    paciente: dados.paciente ? validar.texto(dados.paciente, "Paciente", { max: 120 }) : dados.paciente_nome || "",
    medico: dados.medico || "",
    clinica_id: validar.inteiroPositivo(dados.clinica_id, "Clinica"),
    clinica_nome: dados.clinica_nome || "",
    clinica_bairro: dados.clinica_bairro || "",
    tipo: validar.texto(dados.tipo || "Exame", "Exame", { max: 120 }),
    data: dados.data || new Date().toISOString().slice(0, 10),
    horario: dados.horario || "-",
    observacoes: dados.observacoes ? validar.texto(dados.observacoes, "Observacoes", { max: 500 }) : "",
    status: dados.status || "agendado",
    resultado_disponivel: dados.resultado_disponivel === true,
    resultado_categoria: normalizarCategoriaDocumento(dados.resultado_categoria),
    resultado_nome_arquivo: arquivoResultado?.nomeArquivo || dados.resultado_nome_arquivo || "",
    resultado_descricao: dados.resultado_descricao || "",
    resultado_anexado_em: dados.resultado_anexado_em || "",
    resultado_anexado_por: dados.resultado_anexado_por || "",
    resultado_anexado_por_nome: dados.resultado_anexado_por_nome || "",
    resultado_arquivo_data_url: arquivoResultado?.arquivoDataUrl || dados.resultado_arquivo_data_url || "",
    resultado_arquivo_tipo: arquivoResultado?.tipoArquivo || dados.resultado_arquivo_tipo || "",
    resultado_arquivo_tamanho: Number(arquivoResultado?.tamanhoArquivo || dados.resultado_arquivo_tamanho || 0),
    criado_em: dados.criado_em || new Date().toISOString(),
  };
}

module.exports = { criarExame, normalizarCategoriaDocumento };
