function desafioFromRow(row) {
  if (!row) return null;
  return {
    email: row.email,
    usuarioId: Number(row.usuario_id),
    codigoHash: row.codigo_hash,
    expiraEm: row.expira_em instanceof Date ? row.expira_em.toISOString() : row.expira_em,
    tentativas: Number(row.tentativas || 0),
    maxTentativas: Number(row.max_tentativas || 5),
    canal: row.canal,
    destinoMascarado: row.destino_mascarado || "",
    criadoEm: row.criado_em instanceof Date ? row.criado_em.toISOString() : row.criado_em,
  };
}

function criarRecuperacaoSenhaRepositoryPostgres(pool) {
  return {
    async salvar(desafio) {
      const { rows } = await pool.query(
        `insert into password_recovery_codes
          (email, usuario_id, codigo_hash, expira_em, tentativas, max_tentativas,
           canal, destino_mascarado, criado_em)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         on conflict (email) do update set
           usuario_id = excluded.usuario_id,
           codigo_hash = excluded.codigo_hash,
           expira_em = excluded.expira_em,
           tentativas = excluded.tentativas,
           max_tentativas = excluded.max_tentativas,
           canal = excluded.canal,
           destino_mascarado = excluded.destino_mascarado,
           criado_em = excluded.criado_em
         returning *`,
        [
          desafio.email,
          desafio.usuarioId,
          desafio.codigoHash,
          desafio.expiraEm,
          desafio.tentativas || 0,
          desafio.maxTentativas || 5,
          desafio.canal,
          desafio.destinoMascarado || "",
          desafio.criadoEm,
        ]
      );
      return desafioFromRow(rows[0]);
    },

    async buscarPorEmail(email) {
      const { rows } = await pool.query(
        "select * from password_recovery_codes where lower(email) = lower($1) limit 1",
        [email]
      );
      return desafioFromRow(rows[0]);
    },

    async incrementarTentativas(email) {
      const { rows } = await pool.query(
        `update password_recovery_codes
            set tentativas = tentativas + 1
          where lower(email) = lower($1)
          returning *`,
        [email]
      );
      return desafioFromRow(rows[0]);
    },

    async remover(email) {
      await pool.query("delete from password_recovery_codes where lower(email) = lower($1)", [
        email,
      ]);
    },
  };
}

module.exports = { criarRecuperacaoSenhaRepositoryPostgres };
