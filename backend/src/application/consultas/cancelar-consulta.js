const { AppError } = require("../../domain/errors/app-error");
const { NIVEIS_ACESSO } = require("../../domain/value-objects/niveis-acesso");

async function buscarConsultaPorId(consultaRepository, consultaId) {
  if (consultaRepository.buscarPorId) {
    return consultaRepository.buscarPorId(consultaId);
  }

  if (consultaRepository.listarTodos) {
    const consultas = await consultaRepository.listarTodos();
    return consultas.find((consulta) => String(consulta.id) === String(consultaId)) || null;
  }

  return null;
}

function usuarioPodeCancelarConsulta(usuario, consulta) {
  if (!usuario || !consulta) return false;

  if (usuario.nivel_acesso === NIVEIS_ACESSO.ADMIN_MASTER) return true;

  if (usuario.nivel_acesso === NIVEIS_ACESSO.PACIENTE) {
    return Number(usuario.id) === Number(consulta.paciente_id);
  }

  if (usuario.nivel_acesso === NIVEIS_ACESSO.ADMIN_CLINICA) {
    return Number(usuario.clinica_id) === Number(consulta.clinica_id);
  }

  if (usuario.nivel_acesso === NIVEIS_ACESSO.MEDICO) {
    return (
      Number(usuario.id) === Number(consulta.medico_id) &&
      Number(usuario.clinica_id) === Number(consulta.clinica_id)
    );
  }

  return false;
}

async function liberarAgenda(agendaRepository, agendaId) {
  if (agendaId && agendaRepository?.liberar) {
    await agendaRepository.liberar(agendaId);
  }
}

function criarCancelarConsulta({ consultaRepository, agendaRepository = null }) {
  return async function cancelarConsulta({ consultaId, motivo }, contexto = {}) {
    const motivoNormalizado = String(motivo || "").trim();
    const consulta = await buscarConsultaPorId(consultaRepository, consultaId);

    if (!consulta) {
      throw new AppError("Consulta nao encontrada.", 404, "CONSULTA_NAO_ENCONTRADA");
    }

    if (!motivoNormalizado) {
      throw new AppError("Informe o motivo do cancelamento.", 422, "MOTIVO_CANCELAMENTO_OBRIGATORIO");
    }

    if (contexto.usuario && !usuarioPodeCancelarConsulta(contexto.usuario, consulta)) {
      throw new AppError("Voce nao tem permissao para cancelar esta consulta.", 403, "ACESSO_NEGADO");
    }

    const resultado = await consultaRepository.cancelar(consultaId, motivoNormalizado);
    await liberarAgenda(agendaRepository, consulta.agenda_id);

    return resultado;
  };
}

module.exports = { criarCancelarConsulta };
