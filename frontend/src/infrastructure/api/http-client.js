import { obterTokenSessao, removerUsuarioSessao } from "../storage/sessao-usuario";

function obterApiBaseUrl() {
  const configurado = String(import.meta.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, "");
  const rodandoLocal =
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1"].includes(window.location.hostname);

  if (configurado) {
    try {
      const urlConfigurada = new URL(configurado);
      const backendLocal = ["localhost", "127.0.0.1"].includes(urlConfigurada.hostname);

      if (backendLocal && typeof window !== "undefined" && !rodandoLocal) {
        return "";
      }
    } catch {
      return configurado;
    }

    return configurado;
  }

  if (rodandoLocal && window.location.port !== "3333") {
    return "http://localhost:3333";
  }

  return "";
}

function montarUrlRequisicao(url) {
  if (!String(url).startsWith("/api")) return url;

  const apiBaseUrl = obterApiBaseUrl();
  return apiBaseUrl ? `${apiBaseUrl}${url}` : url;
}

function descreverDestino(url) {
  try {
    const base = typeof window === "undefined" ? "http://localhost" : window.location.origin;
    return new URL(url, base).href;
  } catch {
    return url;
  }
}

async function parseJsonResposta(resposta, url) {
  const texto = await resposta.text();
  const conteudo = texto.trim();
  const contentType = resposta.headers.get("content-type") || "";
  const destino = descreverDestino(url || resposta.url || "/api");

  if (!conteudo) {
    return {};
  }

  if (conteudo.startsWith("<") || conteudo.startsWith("<!")) {
    throw new Error(
      `A API devolveu HTML em vez de JSON em ${destino}. No desenvolvimento, rode npm run iniciar; no Vercel, confirme se a Function /api foi publicada.`
    );
  }

  try {
    return JSON.parse(conteudo);
  } catch {
    if (
      conteudo.toLowerCase().includes("proxy") ||
      conteudo.toLowerCase().includes("econnrefused")
    ) {
      throw new Error(
        "Nao foi possivel conectar ao backend. Use npm run iniciar para subir frontend e backend juntos."
      );
    }

    throw new Error(
      contentType && !contentType.includes("application/json")
        ? `A API nao retornou JSON em ${destino}. Content-Type recebido: ${contentType}.`
        : "Resposta do servidor em formato inesperado."
    );
  }
}

async function requisitarJson(url, opcoes = {}) {
  const urlRequisicao = montarUrlRequisicao(url);
  let resposta;
  const token = obterTokenSessao();
  const headers = {
    ...(opcoes.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    resposta = await fetch(urlRequisicao, {
      cache: "no-store",
      ...opcoes,
      credentials: "include",
      headers,
    });
  } catch {
    throw new Error(
      "Nao foi possivel conectar ao backend. Use npm run iniciar para subir frontend e backend juntos."
    );
  }

  const dados = await parseJsonResposta(resposta, urlRequisicao);

  if (!resposta.ok) {
    if (resposta.status === 401) {
      removerUsuarioSessao();
    }
    throw new Error(dados.mensagem || "Erro ao processar requisicao.");
  }

  return dados;
}

export { parseJsonResposta, requisitarJson };
