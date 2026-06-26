const { AppError } = require("../../domain/errors/app-error");

function criarRateLimiter(opcoes = {}) {
  const janelaMs = Number(opcoes.janelaMs || 15 * 60 * 1000);
  const maximoTentativas = Number(opcoes.maximoTentativas || 20);
  const agora = opcoes.agora || (() => Date.now());
  const registros = new Map();

  function limparExpirados(instante) {
    for (const [chave, registro] of registros.entries()) {
      if (registro.expiraEm <= instante) {
        registros.delete(chave);
      }
    }
  }

  function consumir(chave) {
    const chaveNormalizada = String(chave || "anonimo");
    const instante = agora();
    limparExpirados(instante);

    const atual = registros.get(chaveNormalizada) || {
      total: 0,
      expiraEm: instante + janelaMs,
    };

    if (atual.expiraEm <= instante) {
      atual.total = 0;
      atual.expiraEm = instante + janelaMs;
    }

    atual.total += 1;
    registros.set(chaveNormalizada, atual);

    if (atual.total > maximoTentativas) {
      throw new AppError(
        "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.",
        429,
        "MUITAS_TENTATIVAS"
      );
    }
  }

  function resetar(chave) {
    registros.delete(String(chave || "anonimo"));
  }

  return { consumir, resetar };
}

module.exports = { criarRateLimiter };
