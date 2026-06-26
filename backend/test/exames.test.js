const assert = require("node:assert/strict");
const { criarAnexarResultadoExame } = require("../src/application/exames/anexar-resultado-exame");
const { criarCriarConsulta } = require("../src/application/consultas/criar-consulta");
const { criarCriarExame } = require("../src/application/exames/criar-exame");

function criarRepositorioExamesFake() {
  const registros = [
    {
      id: "exame-1",
      paciente_id: 1,
      clinica_id: 1,
      tipo: "Hemograma",
      data: "2026-04-30",
      horario: "08:00",
      status: "agendado",
      resultado_disponivel: false,
    },
  ];

  return {
    registros,
    async listarTodos() {
      return registros.map((item) => ({ ...item }));
    },
    async atualizar(id, dados) {
      const indice = registros.findIndex((item) => String(item.id) === String(id));
      registros[indice] = { ...registros[indice], ...dados };
      return { ...registros[indice] };
    },
    async criar(dados) {
      registros.push({ ...dados });
      return { ...dados };
    },
  };
}

async function testeAnexarMultiplosArquivosResultadoExame() {
  const exameRepository = criarRepositorioExamesFake();
  const anexarResultadoExame = criarAnexarResultadoExame({ exameRepository });

  const resultado = await anexarResultadoExame({
    exameId: "exame-1",
    dadosResultado: {
      categoriaDocumento: "exame",
      anexadoPor: "medico",
      anexadoPorNome: "Dra. Teste",
      arquivos: [
        {
          nomeArquivo: "laudo.pdf",
          arquivoDataUrl: "data:application/pdf;base64,AAAA",
          tipoArquivo: "application/pdf",
          tamanhoArquivo: 10,
        },
        {
          nomeArquivo: "imagem.png",
          arquivoDataUrl: "data:image/png;base64,BBBB",
          tipoArquivo: "image/png",
          tamanhoArquivo: 20,
        },
      ],
    },
  });

  assert.equal(Array.isArray(resultado), true);
  assert.equal(resultado.length, 2);
  assert.equal(exameRepository.registros.length, 2);
  assert.equal(exameRepository.registros[0].resultado_nome_arquivo, "laudo.pdf");
  assert.equal(exameRepository.registros[1].resultado_nome_arquivo, "imagem.png");
  assert.equal(exameRepository.registros[1].resultado_disponivel, true);
}

async function testeBloqueiaTipoArquivoResultadoNaoPermitido() {
  const exameRepository = criarRepositorioExamesFake();
  const anexarResultadoExame = criarAnexarResultadoExame({ exameRepository });

  await assert.rejects(
    () =>
      anexarResultadoExame({
        exameId: "exame-1",
        dadosResultado: {
          arquivos: [
            {
              nomeArquivo: "resultado.html",
              arquivoDataUrl: "data:text/html;base64,PGgxPk9pPC9oMT4=",
              tipoArquivo: "text/html",
              tamanhoArquivo: 20,
            },
          ],
        },
      }),
    { code: "ARQUIVO_TIPO_NAO_PERMITIDO" }
  );
}

async function testeBloqueiaArquivoResultadoComExtensaoDivergente() {
  const exameRepository = criarRepositorioExamesFake();
  const anexarResultadoExame = criarAnexarResultadoExame({ exameRepository });

  await assert.rejects(
    () =>
      anexarResultadoExame({
        exameId: "exame-1",
        dadosResultado: {
          arquivos: [
            {
              nomeArquivo: "resultado.png",
              arquivoDataUrl: "data:application/pdf;base64,AAAA",
              tipoArquivo: "application/pdf",
              tamanhoArquivo: 20,
            },
          ],
        },
      }),
    { code: "ARQUIVO_EXTENSAO_INVALIDA" }
  );
}

async function testeBloqueiaArquivoResultadoComConteudoDivergente() {
  const exameRepository = criarRepositorioExamesFake();
  const anexarResultadoExame = criarAnexarResultadoExame({ exameRepository });

  await assert.rejects(
    () =>
      anexarResultadoExame({
        exameId: "exame-1",
        dadosResultado: {
          arquivos: [
            {
              nomeArquivo: "resultado.pdf",
              arquivoDataUrl: "data:image/png;base64,AAAA",
              tipoArquivo: "application/pdf",
              tamanhoArquivo: 20,
            },
          ],
        },
      }),
    { code: "ARQUIVO_CONTEUDO_INVALIDO" }
  );
}

async function testeSanitizaNomeArquivoResultado() {
  const exameRepository = criarRepositorioExamesFake();
  const anexarResultadoExame = criarAnexarResultadoExame({ exameRepository });

  const resultado = await anexarResultadoExame({
    exameId: "exame-1",
    dadosResultado: {
      arquivos: [
        {
          nomeArquivo: "../laudo:final?.pdf",
          arquivoDataUrl: "data:application/pdf;base64,AAAA",
          tipoArquivo: "application/pdf",
          tamanhoArquivo: 20,
        },
      ],
    },
  });

  assert.equal(resultado.resultado_nome_arquivo, "..-laudo-final-.pdf");
}

function criarUsuarioRepositoryFake() {
  const usuarios = new Map([
    [1, { id: 1, nome: "Paciente Teste", nivel_acesso: "paciente", status: "ativo" }],
    [4, { id: 4, nome: "Dra. Teste", nivel_acesso: "medico", clinica_id: 1, status: "ativo" }],
  ]);

  return {
    async buscarPorId(id) {
      return usuarios.get(Number(id)) || null;
    },
  };
}

function criarAgendaRepositoryDisponivelFake() {
  return {
    reservado: false,
    async verificarDisponibilidade() {
      return { disponivel: true };
    },
    async reservar() {
      this.reservado = true;
    },
  };
}

async function testeConsultaNaoDuplicaHorarioDeExame() {
  const agendaRepository = criarAgendaRepositoryDisponivelFake();
  const consultaRepository = {
    async listarPorClinica() {
      return [];
    },
    async criar() {
      throw new Error("Consulta nao deveria ser criada em horario duplicado.");
    },
  };
  const exameRepository = {
    async listarPorClinica() {
      return [
        {
          id: "exame-duplicado",
          clinica_id: 1,
          medico_id: 4,
          agenda_id: "ag-1-2026-05-02-t1000",
          data: "2026-05-02",
          horario: "10:00",
          status: "agendado",
        },
      ];
    },
  };
  const criarConsulta = criarCriarConsulta({
    agendaRepository,
    consultaRepository,
    exameRepository,
    usuarioRepository: criarUsuarioRepositoryFake(),
  });

  await assert.rejects(
    () =>
      criarConsulta({
        paciente_id: 1,
        medico_id: 4,
        agenda_id: "ag-1-2026-05-02-t1000",
        clinica_id: 1,
        especialidade: "Clinico geral",
      }),
    { code: "HORARIO_DUPLICADO" }
  );
  assert.equal(agendaRepository.reservado, false);
}

async function testeExameNaoDuplicaHorarioDeConsulta() {
  const agendaRepository = criarAgendaRepositoryDisponivelFake();
  const consultaRepository = {
    async listarPorClinica() {
      return [
        {
          id: "consulta-duplicada",
          clinica_id: 1,
          medico_id: 4,
          agenda_id: "ag-1-2026-05-02-t1000",
          data: "2026-05-02",
          horario: "10:00",
          status: "agendada",
        },
      ];
    },
  };
  const exameRepository = {
    async listarPorClinica() {
      return [];
    },
    async criar() {
      throw new Error("Exame nao deveria ser criado em horario duplicado.");
    },
  };
  const criarExame = criarCriarExame({
    agendaRepository,
    consultaRepository,
    exameRepository,
    usuarioRepository: criarUsuarioRepositoryFake(),
  });

  await assert.rejects(
    () =>
      criarExame({
        paciente_id: 1,
        medico_id: 4,
        agenda_id: "ag-1-2026-05-02-t1000",
        clinica_id: 1,
        tipo: "Hemograma",
        data: "2026-05-02",
        horario: "10:00",
      }),
    { code: "HORARIO_DUPLICADO" }
  );
  assert.equal(agendaRepository.reservado, false);
}

module.exports = {
  testeAnexarMultiplosArquivosResultadoExame,
  testeBloqueiaTipoArquivoResultadoNaoPermitido,
  testeBloqueiaArquivoResultadoComExtensaoDivergente,
  testeBloqueiaArquivoResultadoComConteudoDivergente,
  testeSanitizaNomeArquivoResultado,
  testeConsultaNaoDuplicaHorarioDeExame,
  testeExameNaoDuplicaHorarioDeConsulta,
};
