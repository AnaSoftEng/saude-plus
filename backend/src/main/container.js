const { criarAutenticarUsuario } = require("../application/auth/autenticar-usuario");
const { criarRecuperarSenha } = require("../application/auth/recuperar-senha");
const { criarListarHorariosAgenda } = require("../application/agenda/listar-horarios-agenda");
const { criarVerificarDisponibilidade } = require("../application/agenda/verificar-disponibilidade");
const { criarListarClinicas } = require("../application/clinicas/listar-clinicas");
const { criarObterClinica } = require("../application/clinicas/obter-clinica");
const { criarSalvarClinica } = require("../application/clinicas/salvar-clinica");
const { criarCriarConsulta } = require("../application/consultas/criar-consulta");
const { criarListarConsultasClinica } = require("../application/consultas/listar-consultas-clinica");
const { criarListarConsultasPaciente } = require("../application/consultas/listar-consultas-paciente");
const { criarCancelarConsulta } = require("../application/consultas/cancelar-consulta");
const { criarAnexarResultadoExame } = require("../application/exames/anexar-resultado-exame");
const { criarCriarExame } = require("../application/exames/criar-exame");
const { criarExcluirExame } = require("../application/exames/excluir-exame");
const { criarListarExamesClinica } = require("../application/exames/listar-exames-clinica");
const { criarListarExamesPaciente } = require("../application/exames/listar-exames-paciente");
const { criarSalvarExamesClinica } = require("../application/exames/salvar-exames-clinica");
const { criarObterRelatoriosSistema } = require("../application/sistema/obter-relatorios-sistema");
const { criarObterRelatorioClinica } = require("../application/sistema/obter-relatorio-clinica");
const { criarListarUsuarios } = require("../application/usuarios/listar-usuarios");
const { criarSalvarUsuario } = require("../application/usuarios/salvar-usuario");
const { criarAgendaRepositoryMemory } = require("../infrastructure/repositories/memory/agenda-repository-memory");
const { criarClinicaRepositoryMemory } = require("../infrastructure/repositories/memory/clinica-repository-memory");
const { criarConsultaRepositoryMemory } = require("../infrastructure/repositories/memory/consulta-repository-memory");
const { criarExameRepositoryMemory } = require("../infrastructure/repositories/memory/exame-repository-memory");
const { criarUsuarioRepositoryMemory } = require("../infrastructure/repositories/memory/usuario-repository-memory");
const { criarPushNotifications } = require("../infrastructure/notifications/push-notifications");
const { criarRecuperacaoSenhaSender } = require("../infrastructure/notifications/recuperacao-senha-sender");
const {
  criarRecuperacaoSenhaRepositoryMemory,
} = require("../infrastructure/security/recuperacao-senha-repository-memory");
const {
  criarRecuperacaoSenhaRepositoryPostgres,
} = require("../infrastructure/security/recuperacao-senha-repository-postgres");

function criarContainer(env = {}) {
  let pool = null;
  let repositories;

  if (env.repositoryDriver === "postgres") {
    const { criarPoolPostgres } = require("../infrastructure/repositories/postgres/postgres-client");
    const { criarRepositoriesPostgres } = require("../infrastructure/repositories/postgres/postgres-repositories");
    pool = criarPoolPostgres(env);
    repositories = criarRepositoriesPostgres(pool);
  } else {
    repositories = {
      usuarioRepository: criarUsuarioRepositoryMemory(),
      clinicaRepository: criarClinicaRepositoryMemory(),
      agendaRepository: criarAgendaRepositoryMemory(),
      consultaRepository: criarConsultaRepositoryMemory(),
      exameRepository: criarExameRepositoryMemory(),
      auditRepository: null,
    };
  }

  const {
    usuarioRepository,
    clinicaRepository,
    agendaRepository,
    consultaRepository,
    exameRepository,
    auditRepository,
  } = repositories;
  const pushSubscriptions = [];
  const pushNotifications = criarPushNotifications({
    env,
    subscriptions: pushSubscriptions,
    pool,
  });
  const recuperacaoSenhaRepository = pool
    ? criarRecuperacaoSenhaRepositoryPostgres(pool)
    : criarRecuperacaoSenhaRepositoryMemory();
  const recuperacaoSenhaSender = criarRecuperacaoSenhaSender({ env });
  const recuperarSenha = criarRecuperarSenha({
    usuarioRepository,
    recuperacaoSenhaRepository,
    recuperacaoSenhaSender,
    env,
  });

  return {
    repositories: {
      usuarioRepository,
      clinicaRepository,
      agendaRepository,
      consultaRepository,
      exameRepository,
      auditRepository,
    },
    pool,
    useCases: {
      autenticarUsuario: criarAutenticarUsuario({ usuarioRepository, env }),
      recuperarSenha,
      solicitarRecuperacaoSenha: recuperarSenha.solicitarCodigo,
      confirmarRecuperacaoSenha: recuperarSenha.confirmarCodigo,
      listarUsuarios: criarListarUsuarios({
        usuarioRepository,
        consultaRepository,
        exameRepository,
      }),
      salvarUsuario: criarSalvarUsuario({ usuarioRepository }),
      listarClinicas: criarListarClinicas({ clinicaRepository }),
      obterClinica: criarObterClinica({ clinicaRepository }),
      salvarClinica: criarSalvarClinica({ clinicaRepository }),
      listarHorariosAgenda: criarListarHorariosAgenda({
        agendaRepository,
        consultaRepository,
        exameRepository,
        usuarioRepository,
      }),
      verificarDisponibilidade: criarVerificarDisponibilidade({
        agendaRepository,
        consultaRepository,
        exameRepository,
        usuarioRepository,
      }),
      criarConsulta: criarCriarConsulta({
        agendaRepository,
        consultaRepository,
        exameRepository,
        usuarioRepository,
        pushNotifications,
      }),
      listarConsultasClinica: criarListarConsultasClinica({ consultaRepository, usuarioRepository }),
      listarConsultasPaciente: criarListarConsultasPaciente({ consultaRepository, usuarioRepository }),
      cancelarConsulta: criarCancelarConsulta({ consultaRepository, agendaRepository }),
      criarExame: criarCriarExame({
        agendaRepository,
        consultaRepository,
        exameRepository,
        usuarioRepository,
        pushNotifications,
      }),
      listarExamesClinica: criarListarExamesClinica({ exameRepository, usuarioRepository }),
      listarExamesPaciente: criarListarExamesPaciente({ exameRepository, usuarioRepository }),
      anexarResultadoExame: criarAnexarResultadoExame({ exameRepository }),
      salvarExamesClinica: criarSalvarExamesClinica({ exameRepository }),
      excluirExame: criarExcluirExame({ exameRepository, agendaRepository }),
      obterRelatoriosSistema: criarObterRelatoriosSistema({
        clinicaRepository,
        usuarioRepository,
        consultaRepository,
        exameRepository,
        debug: env.relatoriosDebug,
      }),
      obterRelatorioClinica: criarObterRelatorioClinica({
        clinicaRepository,
        consultaRepository,
        usuarioRepository,
        exameRepository,
        debug: env.relatoriosDebug,
      }),
      salvarPushSubscription: pushNotifications.salvarSubscription,
    },
  };
}

module.exports = { criarContainer };
