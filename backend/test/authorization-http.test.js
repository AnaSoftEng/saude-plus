const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");
const { criarServidorHttp } = require("../src/infrastructure/http/create-server");
const { criarAutenticarUsuario } = require("../src/application/auth/autenticar-usuario");
const { criarListarClinicas } = require("../src/application/clinicas/listar-clinicas");
const { criarObterRelatorioClinica } = require("../src/application/sistema/obter-relatorio-clinica");
const { criarClinicaRepositoryMemory } = require("../src/infrastructure/repositories/memory/clinica-repository-memory");
const { criarConsultaRepositoryMemory } = require("../src/infrastructure/repositories/memory/consulta-repository-memory");
const { criarUsuarioRepositoryMemory } = require("../src/infrastructure/repositories/memory/usuario-repository-memory");
const { gerarTokenSessao } = require("../src/infrastructure/security/tokens");

const envBase = {
  nodeEnv: "test",
  jwtSecret: "segredo-local-de-teste-com-tamanho-suficiente",
  tokenTtlSegundos: 60,
  corsOrigins: ["http://localhost:3000"],
  repositoryDriver: "memory",
  recoverySecret: "recuperacao-local-de-teste-com-tamanho-suficiente",
  sessionCookieName: "saude_token",
  cookieSameSite: "Lax",
  cookieSecure: false,
};

async function criarServidorTeste(env = {}) {
  const auditEventos = [];
  const envTeste = { ...envBase, ...env };
  const usuarioRepository = criarUsuarioRepositoryMemory(
    [
      {
        id: 1,
        nome: "Paciente Teste",
        email: "paciente@teste.local",
        senha: "SenhaTeste123!",
        nivel_acesso: "paciente",
        clinica_id: null,
        status: "ativo",
      },
      {
        id: 2,
        nome: "Admin Master Teste",
        email: "master@teste.local",
        senha: "SenhaTeste123!",
        nivel_acesso: "admin_master",
        clinica_id: null,
        status: "ativo",
      },
    ],
    { caminhoDados: path.join(os.tmpdir(), `saude-plus-test-${Date.now()}-${Math.random()}.json`) }
  );
  const clinicaRepository = criarClinicaRepositoryMemory();
  const consultaRepository = criarConsultaRepositoryMemory();
  const useCases = {
    autenticarUsuario: criarAutenticarUsuario({ usuarioRepository, env: envTeste }),
    listarClinicas: criarListarClinicas({ clinicaRepository }),
    obterRelatorioClinica: criarObterRelatorioClinica({
      clinicaRepository,
      consultaRepository,
      usuarioRepository,
    }),
  };
  const server = criarServidorHttp(useCases, envTeste, {
    auditRepository: {
      async registrarAcesso(evento) {
        auditEventos.push(evento);
      },
    },
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  return {
    auditEventos,
    baseUrl: `http://127.0.0.1:${port}`,
    fechar: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function postJson(baseUrl, path, body, headers = {}) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

async function testeRotasProtegidasExigemAutenticacao() {
  const app = await criarServidorTeste();
  try {
    const resposta = await fetch(`${app.baseUrl}/api/clinicas`);
    const dados = await resposta.json();

    assert.equal(resposta.status, 401);
    assert.equal(dados.codigo, "TOKEN_INVALIDO");
  } finally {
    await app.fechar();
  }
}

async function testeAutorizacaoPorNivelDeAcesso() {
  const app = await criarServidorTeste();
  try {
    const login = await postJson(app.baseUrl, "/api/auth/login", {
      email: "paciente@teste.local",
      senha: "SenhaTeste123!",
    });
    const sessao = await login.json();

    assert.equal(login.status, 200);
    assert.ok(sessao.token);

    const clinicas = await fetch(`${app.baseUrl}/api/clinicas`, {
      headers: { Authorization: `Bearer ${sessao.token}` },
    });
    assert.equal(clinicas.status, 200);

    const relatorios = await fetch(`${app.baseUrl}/api/relatorios/sistema`, {
      headers: { Authorization: `Bearer ${sessao.token}` },
    });
    const dadosRelatorios = await relatorios.json();

    assert.equal(relatorios.status, 403);
    assert.equal(dadosRelatorios.codigo, "ACESSO_NEGADO");
  } finally {
    await app.fechar();
  }
}

async function testeCookieHttpOnlyEmProducao() {
  const app = await criarServidorTeste({
    nodeEnv: "production",
    usarCookieSessao: true,
    cookieSecure: true,
  });

  try {
    const login = await postJson(app.baseUrl, "/api/auth/login", {
      email: "master@teste.local",
      senha: "SenhaTeste123!",
    });
    const sessao = await login.json();
    const cookie = login.headers.get("set-cookie");

    assert.equal(login.status, 200);
    assert.equal(sessao.token, undefined);
    assert.match(cookie, /saude_token=/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);

    const resposta = await fetch(`${app.baseUrl}/api/clinicas`, {
      headers: { Cookie: cookie.split(";")[0] },
    });

    assert.equal(resposta.status, 200);
  } finally {
    await app.fechar();
  }
}

async function testeBloqueiaOrigemNaoPermitidaComCookie() {
  const app = await criarServidorTeste({
    usarCookieSessao: true,
  });

  try {
    const resposta = await postJson(
      app.baseUrl,
      "/api/auth/login",
      {
        email: "master@teste.local",
        senha: "SenhaTeste123!",
      },
      { Origin: "https://origem-nao-permitida.example" }
    );
    const dados = await resposta.json();

    assert.equal(resposta.status, 403);
    assert.equal(dados.codigo, "ORIGEM_NAO_PERMITIDA");
  } finally {
    await app.fechar();
  }
}

async function testeRateLimitLogin() {
  const app = await criarServidorTeste({
    authRateLimitJanelaMs: 60 * 1000,
    authRateLimitMaxTentativas: 2,
  });

  try {
    await postJson(app.baseUrl, "/api/auth/login", {
      email: "paciente@teste.local",
      senha: "senha-incorreta",
    });
    await postJson(app.baseUrl, "/api/auth/login", {
      email: "paciente@teste.local",
      senha: "senha-incorreta",
    });
    const resposta = await postJson(app.baseUrl, "/api/auth/login", {
      email: "paciente@teste.local",
      senha: "SenhaTeste123!",
    });
    const dados = await resposta.json();

    assert.equal(resposta.status, 429);
    assert.equal(dados.codigo, "MUITAS_TENTATIVAS");
  } finally {
    await app.fechar();
  }
}

async function testeAuditoriaHttpRegistraAcessos() {
  const app = await criarServidorTeste();
  try {
    const resposta = await fetch(`${app.baseUrl}/health`);
    await new Promise((resolve) => setTimeout(resolve, 5));

    assert.equal(resposta.headers.get("x-content-type-options"), "nosniff");
    assert.equal(resposta.headers.get("referrer-policy"), "no-referrer");
    assert.equal(app.auditEventos.length >= 1, true);
    assert.equal(app.auditEventos[0].metodo, "GET");
    assert.equal(app.auditEventos[0].statusCode, 200);
  } finally {
    await app.fechar();
  }
}

async function testeAdminClinicaAcessaRelatorioDaPropriaClinica() {
  const app = await criarServidorTeste();
  const token = gerarTokenSessao(
    { id: 2, nivel_acesso: "admin_clinica", clinica_id: 1 },
    { jwtSecret: envBase.jwtSecret, ttlSegundos: 60 }
  );

  try {
    const resposta = await fetch(`${app.baseUrl}/api/relatorios/clinicas/1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const dados = await resposta.json();

    assert.equal(resposta.status, 200);
    assert.equal(dados.clinica.id, 1);
    assert.equal(typeof dados.indicadores.consultas, "number");
  } finally {
    await app.fechar();
  }
}

async function testeAdminClinicaAcessaRelatorioMinhaClinica() {
  const app = await criarServidorTeste();
  const token = gerarTokenSessao(
    { id: 2, nivel_acesso: "admin_clinica", clinica_id: 1 },
    { jwtSecret: envBase.jwtSecret, ttlSegundos: 60 }
  );

  try {
    const resposta = await fetch(`${app.baseUrl}/api/relatorios/minha-clinica`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const dados = await resposta.json();

    assert.equal(resposta.status, 200);
    assert.equal(dados.clinica.id, 1);
  } finally {
    await app.fechar();
  }
}

async function testeAdminClinicaAcessaRelatorioAliasSingular() {
  const app = await criarServidorTeste();
  const token = gerarTokenSessao(
    { id: 2, nivel_acesso: "admin_clinica", clinica_id: 1 },
    { jwtSecret: envBase.jwtSecret, ttlSegundos: 60 }
  );

  try {
    const resposta = await fetch(`${app.baseUrl}/api/relatorios/clinica/1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const dados = await resposta.json();

    assert.equal(resposta.status, 200);
    assert.equal(dados.clinica.id, 1);
  } finally {
    await app.fechar();
  }
}

async function testeAdminClinicaNaoAcessaRelatorioDeOutraClinica() {
  const app = await criarServidorTeste();
  const token = gerarTokenSessao(
    { id: 2, nivel_acesso: "admin_clinica", clinica_id: 1 },
    { jwtSecret: envBase.jwtSecret, ttlSegundos: 60 }
  );

  try {
    const resposta = await fetch(`${app.baseUrl}/api/relatorios/clinicas/2`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const dados = await resposta.json();

    assert.equal(resposta.status, 403);
    assert.equal(dados.codigo, "ACESSO_NEGADO");
  } finally {
    await app.fechar();
  }
}

module.exports = {
  testeAdminClinicaAcessaRelatorioDaPropriaClinica,
  testeAdminClinicaAcessaRelatorioMinhaClinica,
  testeAdminClinicaAcessaRelatorioAliasSingular,
  testeAdminClinicaNaoAcessaRelatorioDeOutraClinica,
  testeRotasProtegidasExigemAutenticacao,
  testeAutorizacaoPorNivelDeAcesso,
  testeCookieHttpOnlyEmProducao,
  testeBloqueiaOrigemNaoPermitidaComCookie,
  testeRateLimitLogin,
  testeAuditoriaHttpRegistraAcessos,
};
