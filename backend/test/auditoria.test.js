const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { criarCancelarConsulta } = require("../src/application/consultas/cancelar-consulta");
const { criarAnexarResultadoExame } = require("../src/application/exames/anexar-resultado-exame");
const { criarExcluirExame } = require("../src/application/exames/excluir-exame");
const { criarListarExamesClinica } = require("../src/application/exames/listar-exames-clinica");
const { criarListarExamesPaciente } = require("../src/application/exames/listar-exames-paciente");
const { criarSalvarExamesClinica } = require("../src/application/exames/salvar-exames-clinica");
const { criarListarConsultasClinica } = require("../src/application/consultas/listar-consultas-clinica");
const { criarListarConsultasPaciente } = require("../src/application/consultas/listar-consultas-paciente");
const { criarListarUsuarios } = require("../src/application/usuarios/listar-usuarios");
const { criarSalvarUsuario } = require("../src/application/usuarios/salvar-usuario");
const { criarServidorHttp } = require("../src/infrastructure/http/create-server");
const { criarConsultaRepositoryMemory } = require("../src/infrastructure/repositories/memory/consulta-repository-memory");
const { criarExameRepositoryMemory } = require("../src/infrastructure/repositories/memory/exame-repository-memory");
const { criarUsuarioRepositoryMemory } = require("../src/infrastructure/repositories/memory/usuario-repository-memory");
const { gerarTokenSessao } = require("../src/infrastructure/security/tokens");

const envBase = {
  nodeEnv: "test",
  jwtSecret: "segredo-local-de-teste-com-tamanho-suficiente",
  tokenTtlSegundos: 60,
  corsOrigins: ["http://localhost:3000"],
  requestBodyLimitBytes: 1024 * 1024,
  sessionCookieName: "saude_token",
  cookieSameSite: "Lax",
  cookieSecure: false,
};

const usuariosBase = [
  { id: 1, nome: "Paciente Um", email: "paciente1@teste.local", senha: "SenhaTeste123!", nivel_acesso: "paciente", clinica_id: null, status: "ativo" },
  { id: 5, nome: "Paciente Dois", email: "paciente2@teste.local", senha: "SenhaTeste123!", nivel_acesso: "paciente", clinica_id: null, status: "ativo" },
  { id: 2, nome: "Admin Clinica 1", email: "admin1@teste.local", senha: "SenhaTeste123!", nivel_acesso: "admin_clinica", clinica_id: 1, status: "ativo" },
  { id: 6, nome: "Admin Clinica 2", email: "admin2@teste.local", senha: "SenhaTeste123!", nivel_acesso: "admin_clinica", clinica_id: 2, status: "ativo" },
  { id: 3, nome: "Admin Master", email: "master@teste.local", senha: "SenhaTeste123!", nivel_acesso: "admin_master", clinica_id: null, status: "ativo" },
  { id: 4, nome: "Medico Um", email: "medico1@teste.local", senha: "SenhaTeste123!", nivel_acesso: "medico", clinica_id: 1, status: "ativo" },
  { id: 7, nome: "Medico Dois", email: "medico2@teste.local", senha: "SenhaTeste123!", nivel_acesso: "medico", clinica_id: 2, status: "ativo" },
];

const consultasBase = [
  {
    id: "consulta-1",
    paciente_id: 1,
    medico_id: 4,
    agenda_id: "ag-1-2026-05-02-t1000",
    clinica_id: 1,
    especialidade: "Clinico geral",
    data: "2026-05-02",
    horario: "10:00",
    status: "agendada",
  },
];

const examesBase = [
  {
    id: "exame-1",
    paciente_id: 1,
    medico_id: 4,
    agenda_id: "ag-1-2026-05-02-t1030",
    clinica_id: 1,
    tipo: "Hemograma",
    data: "2026-05-02",
    horario: "10:30",
    status: "agendado",
    resultado_disponivel: false,
  },
  {
    id: "exame-2",
    paciente_id: 5,
    medico_id: 7,
    agenda_id: "ag-2-2026-05-02-t1030",
    clinica_id: 2,
    tipo: "Raio-X",
    data: "2026-05-02",
    horario: "10:30",
    status: "agendado",
    resultado_disponivel: false,
  },
];

function criarCaminhoTemporario(prefixo) {
  return path.join(os.tmpdir(), `saude-plus-auditoria-${prefixo}-${Date.now()}-${Math.random()}.json`);
}

function token(usuario) {
  return gerarTokenSessao(usuario, {
    jwtSecret: envBase.jwtSecret,
    ttlSegundos: envBase.tokenTtlSegundos,
  });
}

async function criarServidorAuditoria(env = {}) {
  const caminhos = [
    criarCaminhoTemporario("usuarios"),
    criarCaminhoTemporario("consultas"),
    criarCaminhoTemporario("exames"),
  ];
  const usuarioRepository = criarUsuarioRepositoryMemory(usuariosBase, { caminhoDados: caminhos[0] });
  const consultaRepository = criarConsultaRepositoryMemory(consultasBase, { caminhoDados: caminhos[1] });
  const exameRepository = criarExameRepositoryMemory(examesBase, { caminhoDados: caminhos[2] });
  const envTeste = { ...envBase, ...env };
  const useCases = {
    autenticarUsuario: async () => ({ usuario: usuariosBase[0], token: token(usuariosBase[0]) }),
    listarConsultasPaciente: criarListarConsultasPaciente({ consultaRepository, usuarioRepository }),
    listarConsultasClinica: criarListarConsultasClinica({ consultaRepository, usuarioRepository }),
    cancelarConsulta: criarCancelarConsulta({ consultaRepository }),
    listarExamesPaciente: criarListarExamesPaciente({ exameRepository, usuarioRepository }),
    listarExamesClinica: criarListarExamesClinica({ exameRepository, usuarioRepository }),
    anexarResultadoExame: criarAnexarResultadoExame({ exameRepository }),
    salvarExamesClinica: criarSalvarExamesClinica({ exameRepository }),
    excluirExame: criarExcluirExame({ exameRepository }),
    listarUsuarios: criarListarUsuarios({
      usuarioRepository,
      consultaRepository,
      exameRepository,
    }),
  };
  const server = criarServidorHttp(useCases, envTeste);

  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    fechar: () =>
      new Promise((resolve) =>
        server.close(() => {
          caminhos.forEach((caminho) => fs.rmSync(caminho, { force: true }));
          resolve();
        })
      ),
  };
}

async function testeUsuarioNaoMasterNaoElevaProprioAcesso() {
  const caminhoDados = criarCaminhoTemporario("usuario-self");
  const usuarioRepository = criarUsuarioRepositoryMemory(usuariosBase, { caminhoDados });
  const salvarUsuario = criarSalvarUsuario({ usuarioRepository });

  try {
    const atualizado = await salvarUsuario(
      {
        id: 1,
        nome: "Paciente Atualizado",
        email: "paciente1@teste.local",
        nivel_acesso: "admin_master",
        clinica_id: 2,
        status: "bloqueado",
      },
      { usuario: { id: 1, nivel_acesso: "paciente", clinica_id: null } }
    );

    assert.equal(atualizado.nome, "Paciente Atualizado");
    assert.equal(atualizado.nivel_acesso, "paciente");
    assert.equal(atualizado.clinica_id, null);
    assert.equal(atualizado.status, "ativo");
  } finally {
    fs.rmSync(caminhoDados, { force: true });
  }
}

async function testeCadastroPublicoForcaPacienteAtivo() {
  const caminhoDados = criarCaminhoTemporario("usuario-publico");
  const usuarioRepository = criarUsuarioRepositoryMemory([], { caminhoDados });
  const salvarUsuario = criarSalvarUsuario({ usuarioRepository });

  try {
    const criado = await salvarUsuario({
      nome: "Novo Paciente",
      email: "novo@teste.local",
      senha: "SenhaTeste123!",
      nivel_acesso: "paciente",
      clinica_id: 1,
      status: "bloqueado",
    });

    assert.equal(criado.nivel_acesso, "paciente");
    assert.equal(criado.clinica_id, null);
    assert.equal(criado.status, "ativo");
  } finally {
    fs.rmSync(caminhoDados, { force: true });
  }
}

async function testePacienteNaoCancelaConsultaDeOutroPaciente() {
  const app = await criarServidorAuditoria();
  try {
    const resposta = await fetch(`${app.baseUrl}/api/consultas/consulta-1/cancelar`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token({ id: 5, nivel_acesso: "paciente", clinica_id: null })}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ motivo: "Teste" }),
    });
    const dados = await resposta.json();

    assert.equal(resposta.status, 403);
    assert.equal(dados.codigo, "ACESSO_NEGADO");
  } finally {
    await app.fechar();
  }
}

async function testeCancelarConsultaInexistenteRetorna404() {
  const app = await criarServidorAuditoria();
  try {
    const resposta = await fetch(`${app.baseUrl}/api/consultas/consulta-ausente/cancelar`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token({ id: 3, nivel_acesso: "admin_master", clinica_id: null })}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ motivo: "Teste" }),
    });
    const dados = await resposta.json();

    assert.equal(resposta.status, 404);
    assert.equal(dados.codigo, "CONSULTA_NAO_ENCONTRADA");
  } finally {
    await app.fechar();
  }
}

async function testeMedicoNaoListaConsultasPorPacienteSemClinica() {
  const app = await criarServidorAuditoria();
  try {
    const resposta = await fetch(`${app.baseUrl}/api/consultas?paciente=1`, {
      headers: {
        Authorization: `Bearer ${token({ id: 4, nivel_acesso: "medico", clinica_id: 1 })}`,
      },
    });
    const dados = await resposta.json();

    assert.equal(resposta.status, 403);
    assert.equal(dados.codigo, "ACESSO_NEGADO");
  } finally {
    await app.fechar();
  }
}

async function testeAdminClinicaNaoAnexaResultadoForaDaClinica() {
  const app = await criarServidorAuditoria();
  try {
    const resposta = await fetch(`${app.baseUrl}/api/exames/exame-2/resultado`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token({ id: 2, nivel_acesso: "admin_clinica", clinica_id: 1 })}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        arquivos: [
          {
            nomeArquivo: "resultado.pdf",
            arquivoDataUrl: "data:application/pdf;base64,AAAA",
            tipoArquivo: "application/pdf",
            tamanhoArquivo: 10,
          },
        ],
      }),
    });
    const dados = await resposta.json();

    assert.equal(resposta.status, 403);
    assert.equal(dados.codigo, "ACESSO_NEGADO");
  } finally {
    await app.fechar();
  }
}

async function testeAdminClinicaNaoExcluiExameDeOutraClinica() {
  const app = await criarServidorAuditoria();
  try {
    const resposta = await fetch(`${app.baseUrl}/api/exames/exame-2`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token({ id: 2, nivel_acesso: "admin_clinica", clinica_id: 1 })}`,
      },
    });
    const dados = await resposta.json();

    assert.equal(resposta.status, 403);
    assert.equal(dados.codigo, "ACESSO_NEGADO");
  } finally {
    await app.fechar();
  }
}

async function testeAdminClinicaNaoEditaExameDeOutraClinicaEmMassa() {
  const app = await criarServidorAuditoria();
  try {
    const resposta = await fetch(`${app.baseUrl}/api/exames?clinica=1`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token({ id: 2, nivel_acesso: "admin_clinica", clinica_id: 1 })}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        exames: [
          {
            id: "exame-2",
            paciente_id: 5,
            clinica_id: 1,
            tipo: "Exame alterado indevidamente",
            status: "liberado",
          },
        ],
      }),
    });
    const dados = await resposta.json();

    assert.equal(resposta.status, 403);
    assert.equal(dados.codigo, "ACESSO_NEGADO");
  } finally {
    await app.fechar();
  }
}

async function testeMedicoNaoListaPacienteSemVinculoComSuaClinica() {
  const app = await criarServidorAuditoria();
  try {
    const resposta = await fetch(`${app.baseUrl}/api/usuarios`, {
      headers: {
        Authorization: `Bearer ${token({ id: 4, nivel_acesso: "medico", clinica_id: 1 })}`,
      },
    });
    const dados = await resposta.json();
    const ids = dados.map((usuario) => Number(usuario.id));

    assert.equal(resposta.status, 200);
    assert.equal(ids.includes(1), true);
    assert.equal(ids.includes(5), false);
    assert.equal(
      dados.some(
        (usuario) => usuario.email === "paciente2@teste.local" || usuario.id === 5
      ),
      false
    );
  } finally {
    await app.fechar();
  }
}

async function testeCorpoJsonMuitoGrandeRetorna413() {
  const app = await criarServidorAuditoria({ requestBodyLimitBytes: 20 });
  try {
    const resposta = await fetch(`${app.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "paciente1@teste.local", senha: "SenhaTeste123!" }),
    });
    const dados = await resposta.json();

    assert.equal(resposta.status, 413);
    assert.equal(dados.codigo, "JSON_MUITO_GRANDE");
  } finally {
    await app.fechar();
  }
}

async function testeCancelarConsultaLiberaAgendaReservada() {
  const caminhoDados = criarCaminhoTemporario("consulta-libera-agenda");
  const consultaRepository = criarConsultaRepositoryMemory(consultasBase, { caminhoDados });
  const agendaLiberada = [];
  const cancelarConsulta = criarCancelarConsulta({
    consultaRepository,
    agendaRepository: {
      async liberar(agendaId) {
        agendaLiberada.push(agendaId);
      },
    },
  });

  try {
    const resultado = await cancelarConsulta(
      { consultaId: "consulta-1", motivo: "Remarcacao" },
      { usuario: { id: 1, nivel_acesso: "paciente", clinica_id: null } }
    );

    assert.equal(resultado.status, "cancelada");
    assert.deepEqual(agendaLiberada, ["ag-1-2026-05-02-t1000"]);
  } finally {
    fs.rmSync(caminhoDados, { force: true });
  }
}

async function testeCancelarConsultaExigeMotivo() {
  const caminhoDados = criarCaminhoTemporario("consulta-motivo-obrigatorio");
  const consultaRepository = criarConsultaRepositoryMemory(consultasBase, { caminhoDados });
  const cancelarConsulta = criarCancelarConsulta({ consultaRepository });

  try {
    await assert.rejects(
      () =>
        cancelarConsulta(
          { consultaId: "consulta-1", motivo: "   " },
          { usuario: { id: 1, nivel_acesso: "paciente", clinica_id: null } }
        ),
      { code: "MOTIVO_CANCELAMENTO_OBRIGATORIO" }
    );
  } finally {
    fs.rmSync(caminhoDados, { force: true });
  }
}

async function testeExcluirExameLiberaAgendaReservada() {
  const caminhoDados = criarCaminhoTemporario("exame-libera-agenda");
  const exameRepository = criarExameRepositoryMemory(examesBase, { caminhoDados });
  const agendaLiberada = [];
  const excluirExame = criarExcluirExame({
    exameRepository,
    agendaRepository: {
      async liberar(agendaId) {
        agendaLiberada.push(agendaId);
      },
    },
  });

  try {
    const resultado = await excluirExame("exame-1", {
      usuario: { id: 2, nivel_acesso: "admin_clinica", clinica_id: 1 },
    });

    assert.equal(resultado.ok, true);
    assert.deepEqual(agendaLiberada, ["ag-1-2026-05-02-t1030"]);
  } finally {
    fs.rmSync(caminhoDados, { force: true });
  }
}

module.exports = {
  testeUsuarioNaoMasterNaoElevaProprioAcesso,
  testeCadastroPublicoForcaPacienteAtivo,
  testePacienteNaoCancelaConsultaDeOutroPaciente,
  testeCancelarConsultaInexistenteRetorna404,
  testeMedicoNaoListaConsultasPorPacienteSemClinica,
  testeAdminClinicaNaoAnexaResultadoForaDaClinica,
  testeAdminClinicaNaoExcluiExameDeOutraClinica,
  testeAdminClinicaNaoEditaExameDeOutraClinicaEmMassa,
  testeMedicoNaoListaPacienteSemVinculoComSuaClinica,
  testeCorpoJsonMuitoGrandeRetorna413,
  testeCancelarConsultaLiberaAgendaReservada,
  testeCancelarConsultaExigeMotivo,
  testeExcluirExameLiberaAgendaReservada,
};
