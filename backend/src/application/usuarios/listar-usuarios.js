const { NIVEIS_ACESSO } = require("../../domain/value-objects/niveis-acesso");

async function listarRegistrosClinica(repository, clinicaId) {
  if (!repository?.listarPorClinica || !clinicaId) return [];
  return repository.listarPorClinica(clinicaId);
}

async function obterPacientesVinculadosClinica({
  consultaRepository,
  exameRepository,
  clinicaId,
}) {
  const [consultas, exames] = await Promise.all([
    listarRegistrosClinica(consultaRepository, clinicaId),
    listarRegistrosClinica(exameRepository, clinicaId),
  ]);

  return new Set(
    [...consultas, ...exames]
      .map((registro) => Number(registro.paciente_id))
      .filter((pacienteId) => Number.isInteger(pacienteId) && pacienteId > 0)
  );
}

function criarListarUsuarios({ usuarioRepository, consultaRepository = null, exameRepository = null }) {
  return async function listarUsuarios(contexto = {}) {
    const usuarios = await usuarioRepository.listar();
    const usuarioAtual = contexto.usuario;

    if (usuarioAtual?.nivel_acesso === NIVEIS_ACESSO.ADMIN_MASTER) {
      return usuarios;
    }

    if (
      [NIVEIS_ACESSO.ADMIN_CLINICA, NIVEIS_ACESSO.MEDICO].includes(usuarioAtual?.nivel_acesso)
    ) {
      const pacientesVinculados = await obterPacientesVinculadosClinica({
        consultaRepository,
        exameRepository,
        clinicaId: usuarioAtual.clinica_id,
      });

      return usuarios.filter(
        (usuario) =>
          Number(usuario.clinica_id) === Number(usuarioAtual.clinica_id) ||
          (
            usuario.nivel_acesso === NIVEIS_ACESSO.PACIENTE &&
            pacientesVinculados.has(Number(usuario.id))
          )
      );
    }

    return usuarios.filter((usuario) => Number(usuario.id) === Number(usuarioAtual?.id));
  };
}

module.exports = { criarListarUsuarios };
