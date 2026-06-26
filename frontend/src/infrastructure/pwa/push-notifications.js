import { requisitarJson } from "../api/http-client";
import { registrarServiceWorker } from "./service-worker";

const CHAVE_SUBSCRIPTION = "saude_push_subscription";
const CHAVE_PUSH_LOCAL_ATIVO = "saude_push_local_ativo";
const CHAVE_PERMISSAO_PUSH = "saude_push_permission";
const CHAVE_PUSH_SOLICITADO = "saude_push_permission_solicitada";
const CHAVE_VAPID_PUBLIC_KEY = "saude_push_vapid_public_key";
const PERMISSAO_ADIADA = "adiada";
const VAPID_PUBLIC_KEY = import.meta.env.REACT_APP_VAPID_PUBLIC_KEY || "";

function suportaNotificacoesPush() {
  return (
    "Notification" in window &&
    "PushManager" in window &&
    "serviceWorker" in navigator
  );
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);

  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function enviarSubscriptionParaBackend(subscription) {
  const payload = subscription.toJSON ? subscription.toJSON() : subscription;

  localStorage.setItem(CHAVE_SUBSCRIPTION, JSON.stringify(payload));

  try {
    return await requisitarJson("/api/notificacoes/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (erro) {
    console.warn("Subscription salva apenas localmente:", erro.message);
    return { modo: "local", subscription: payload };
  }
}

async function exibirNotificacaoSaudePlus({
  titulo = "Saúde+",
  corpo = "Você tem uma nova atualização no Saúde+.",
  url = "/paciente/inicio",
  tag = "saude-plus",
} = {}) {
  if (!suportaNotificacoesPush() || Notification.permission !== "granted") {
    return false;
  }

  const opcoes = {
    body: corpo,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag,
    data: { url },
  };

  try {
    const registration = await registrarServiceWorker();
    if (registration?.showNotification) {
      await registration.showNotification(titulo, opcoes);
      return true;
    }
  } catch (erro) {
    console.warn("Service worker indisponível para notificação:", erro.message);
  }

  new Notification(titulo, opcoes);
  return true;
}

function armazenarPermissaoNotificacoes(permission) {
  localStorage.setItem(CHAVE_PERMISSAO_PUSH, permission);
  localStorage.setItem(CHAVE_PUSH_SOLICITADO, "true");
}

function dispensarPermissaoNotificacoes() {
  armazenarPermissaoNotificacoes(PERMISSAO_ADIADA);
}

function deveExibirModalNotificacoes() {
  if (!("Notification" in window) || !suportaNotificacoesPush()) {
    return false;
  }

  const permissaoArmazenada = localStorage.getItem(CHAVE_PERMISSAO_PUSH);
  const usuarioJaDecidiuNoApp = [
    PERMISSAO_ADIADA,
    "denied",
    "granted",
    "indisponivel",
  ].includes(permissaoArmazenada);

  return !usuarioJaDecidiuNoApp && Notification.permission === "default";
}

function notificacoesJaInicializadas() {
  const chaveAtual = VAPID_PUBLIC_KEY || "local";
  return (
    localStorage.getItem(CHAVE_PUSH_LOCAL_ATIVO) === "true" &&
    localStorage.getItem(CHAVE_VAPID_PUBLIC_KEY) === chaveAtual
  );
}

async function ativarNotificacoesPush({ exibirConfirmacao = true } = {}) {
  if (!suportaNotificacoesPush()) {
    throw new Error("Este navegador não suporta notificações push.");
  }

  const permission = await Notification.requestPermission();
  armazenarPermissaoNotificacoes(permission);

  if (permission !== "granted") {
    throw new Error("Você precisa permitir notificações para receber avisos.");
  }

  const registration = await registrarServiceWorker();

  if (!VAPID_PUBLIC_KEY) {
    localStorage.setItem(CHAVE_PUSH_LOCAL_ATIVO, "true");
    localStorage.setItem(CHAVE_VAPID_PUBLIC_KEY, "local");
    if (exibirConfirmacao) {
      await exibirNotificacaoSaudePlus({
        titulo: "Notificações ativadas",
        corpo: "O Saúde+ poderá avisar sobre consultas, exames e resultados.",
      });
    }
    return {
      status: "local",
      mensagem:
        "Permissão concedida. As notificações já estáo ativas neste navegador.",
    };
  }

  if (!registration?.pushManager) {
    throw new Error("Não conseguimos registrar este dispositivo para notificações.");
  }

  let subscription = await registration.pushManager.getSubscription();
  const chaveAnterior = localStorage.getItem(CHAVE_VAPID_PUBLIC_KEY);

  if (subscription && chaveAnterior && chaveAnterior !== VAPID_PUBLIC_KEY) {
    await subscription.unsubscribe();
    subscription = null;
  }

  subscription =
    subscription ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }));

  await enviarSubscriptionParaBackend(subscription);
  localStorage.setItem(CHAVE_PUSH_LOCAL_ATIVO, "true");
  localStorage.setItem(CHAVE_VAPID_PUBLIC_KEY, VAPID_PUBLIC_KEY);
  if (exibirConfirmacao) {
    await exibirNotificacaoSaudePlus({
      titulo: "Notificações ativadas",
      corpo: "O Saúde+ poderá avisar sobre consultas, exames e resultados.",
    });
  }

  return {
    status: "ativo",
    mensagem: "Notificações ativadas neste dispositivo.",
  };
}

async function testarNotificacaoPush() {
  const exibida = await exibirNotificacaoSaudePlus({
    titulo: "Saúde+",
    corpo: "Teste enviado. Suas notificações estáo funcionando.",
    tag: "saude-plus-teste",
  });

  if (!exibida) {
    throw new Error("Ative as notificações antes de enviar um teste.");
  }

  return { mensagem: "Notificação de teste enviada." };
}

async function solicitarPermissaoNotificacoesUmaVez() {
  return inicializarNotificacoesPermitidas();
}

async function inicializarNotificacoesPermitidas() {
  if (!("Notification" in window)) {
    armazenarPermissaoNotificacoes("indisponivel");
    return "indisponivel";
  }

  const permissaoAtual = Notification.permission;

  if (!suportaNotificacoesPush()) {
    armazenarPermissaoNotificacoes(permissaoAtual || "indisponivel");
    return permissaoAtual || "indisponivel";
  }

  if (permissaoAtual !== "default") {
    armazenarPermissaoNotificacoes(permissaoAtual);
  }

  if (permissaoAtual === "granted" && !notificacoesJaInicializadas()) {
    await ativarNotificacoesPush({ exibirConfirmacao: false });
  }

  return permissaoAtual;
}

function obterStatusNotificacoes() {
  if (!("Notification" in window)) {
    return "indisponivel";
  }

  return Notification.permission;
}

export {
  ativarNotificacoesPush,
  dispensarPermissaoNotificacoes,
  deveExibirModalNotificacoes,
  exibirNotificacaoSaudePlus,
  inicializarNotificacoesPermitidas,
  obterStatusNotificacoes,
  solicitarPermissaoNotificacoesUmaVez,
  suportaNotificacoesPush,
  testarNotificacaoPush,
};
