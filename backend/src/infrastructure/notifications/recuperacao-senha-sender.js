async function publicarWebhook(url, payload) {
  if (!url || typeof fetch !== "function") return false;

  const resposta = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!resposta.ok) {
    throw new Error(`Webhook de recuperacao retornou HTTP ${resposta.status}.`);
  }

  return true;
}

function criarRecuperacaoSenhaSender({ env = {}, logger = console } = {}) {
  return {
    async enviarCodigo({ canal, destino, destinoMascarado, codigo, usuario, expiraEm }) {
      const payload = {
        tipo: "recuperacao_senha",
        canal,
        destino,
        destinoMascarado,
        codigo,
        expiraEm,
        usuario: {
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
        },
        mensagem: `Seu codigo Saude+ para recuperar a senha e ${codigo}. Ele expira em poucos minutos.`,
      };

      const webhookUrl =
        canal === "sms" ? env.passwordRecoverySmsWebhookUrl : env.passwordRecoveryEmailWebhookUrl;

      if (webhookUrl) {
        await publicarWebhook(webhookUrl, payload);
        return { enviado: true, canal, provedor: "webhook" };
      }

      if (env.nodeEnv !== "production") {
        logger.info(
          `[recuperacao-senha] codigo=${codigo} canal=${canal} destino=${destinoMascarado || destino}`
        );
        return { enviado: true, canal, provedor: "console-dev" };
      }

      logger.warn(
        "Recuperacao de senha solicitada, mas nenhum provedor de email/SMS foi configurado."
      );
      return { enviado: false, canal, provedor: "nao-configurado" };
    },
  };
}

module.exports = { criarRecuperacaoSenhaSender };
