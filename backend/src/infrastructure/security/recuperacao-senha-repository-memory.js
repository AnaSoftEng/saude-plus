function criarRecuperacaoSenhaRepositoryMemory() {
  const desafiosPorEmail = new Map();

  return {
    async salvar(desafio) {
      desafiosPorEmail.set(String(desafio.email || "").toLowerCase(), { ...desafio });
      return { ...desafio };
    },

    async buscarPorEmail(email) {
      const desafio = desafiosPorEmail.get(String(email || "").toLowerCase());
      return desafio ? { ...desafio } : null;
    },

    async incrementarTentativas(email) {
      const chave = String(email || "").toLowerCase();
      const desafio = desafiosPorEmail.get(chave);
      if (!desafio) return null;

      const atualizado = {
        ...desafio,
        tentativas: Number(desafio.tentativas || 0) + 1,
      };
      desafiosPorEmail.set(chave, atualizado);
      return { ...atualizado };
    },

    async remover(email) {
      desafiosPorEmail.delete(String(email || "").toLowerCase());
    },
  };
}

module.exports = { criarRecuperacaoSenhaRepositoryMemory };
