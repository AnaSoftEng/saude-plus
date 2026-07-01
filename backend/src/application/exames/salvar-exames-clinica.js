const { AppError } = require("../../domain/errors/app-error");

async function buscarExamePorId(exameRepository, exameId) {
  if (exameRepository.buscarPorId) {
    return exameRepository.buscarPorId(exameId);
  }

  if (exameRepository.listarTodos) {
    const exames = await exameRepository.listarTodos();
    return exames.find((exame) => String(exame.id) === String(exameId)) || null;
  }

  return null;
}

async function validarExamesDaClinica(exameRepository, clinicaId, exames) {
  const examesValidados = [];

  for (const exame of exames) {
    if (!exame?.id) {
      throw new AppError("Exame sem identificador nao pode ser salvo em massa.", 422, "EXAME_INVALIDO");
    }

    const exameExistente = await buscarExamePorId(exameRepository, exame.id);

    if (!exameExistente) {
      throw new AppError("Exame nao encontrado.", 404, "EXAME_NAO_ENCONTRADO");
    }

    if (Number(exameExistente.clinica_id) !== Number(clinicaId)) {
      throw new AppError("Voce nao tem permissao para alterar este exame.", 403, "ACESSO_NEGADO");
    }

    examesValidados.push({
      ...exame,
      clinica_id: Number(clinicaId),
    });
  }

  return examesValidados;
}

function criarSalvarExamesClinica({ exameRepository }) {
  return async function salvarExamesClinica({ clinicaId, exames }) {
    if (!clinicaId) return [];
    const lista = Array.isArray(exames) ? exames : [];
    const examesValidados = await validarExamesDaClinica(exameRepository, clinicaId, lista);
    return exameRepository.substituirPorClinica(clinicaId, examesValidados);
  };
}

module.exports = { criarSalvarExamesClinica };
