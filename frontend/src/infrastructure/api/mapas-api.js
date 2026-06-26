function lerEnv(nome) {
  return String(import.meta.env[nome] || "").trim();
}

const GOOGLE_MAPS_API_KEY = lerEnv("REACT_APP_GOOGLE_MAPS_API_KEY");
const GOOGLE_MAPS_API_KEYS = {
  embed: lerEnv("REACT_APP_GOOGLE_MAPS_EMBED_API_KEY") || GOOGLE_MAPS_API_KEY,
  geocoding: lerEnv("REACT_APP_GOOGLE_MAPS_GEOCODING_API_KEY") || GOOGLE_MAPS_API_KEY,
  javascript: lerEnv("REACT_APP_GOOGLE_MAPS_JAVASCRIPT_API_KEY") || GOOGLE_MAPS_API_KEY,
};
let googleMapsPromise = null;
const GOOGLE_MAPS_API_KEY_REGEX = /^AIza[0-9A-Za-z_-]{35}$/;

function obterCoordenadasDaClinica(clinica) {
  const latitude = Number(clinica?.latitude);
  const longitude = Number(clinica?.longitude);

  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return { latitude, longitude };
}

function obterGoogleMapsApiKey(tipo = "javascript") {
  return GOOGLE_MAPS_API_KEYS[tipo] || GOOGLE_MAPS_API_KEY;
}

function validarGoogleMapsApiKey(apiKey = obterGoogleMapsApiKey()) {
  const chave = String(apiKey || "").trim();

  return {
    configurada: chave.length > 0,
    formatoValido: GOOGLE_MAPS_API_KEY_REGEX.test(chave),
  };
}

function obterStatusConfiguracaoGoogleMaps(tipo = "javascript") {
  const variaveis = {
    embed: "REACT_APP_GOOGLE_MAPS_EMBED_API_KEY",
    geocoding: "REACT_APP_GOOGLE_MAPS_GEOCODING_API_KEY",
    javascript: "REACT_APP_GOOGLE_MAPS_JAVASCRIPT_API_KEY",
  };
  const nomeVariavel = variaveis[tipo] || "REACT_APP_GOOGLE_MAPS_API_KEY";
  const status = validarGoogleMapsApiKey(obterGoogleMapsApiKey(tipo));

  if (!status.configurada) {
    return {
      ...status,
      pronta: false,
      mensagem: `Configure ${nomeVariavel} para usar o Google Maps.`,
    };
  }

  if (!status.formatoValido) {
    return {
      ...status,
      pronta: false,
      mensagem:
        `${nomeVariavel} nao parece ser uma chave publica valida do Google Maps.`,
    };
  }

  return {
    ...status,
    pronta: true,
    mensagem: "",
  };
}

function carregarGoogleMaps() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("Google Maps so pode ser carregado no navegador."));
  }

  if (window.google?.maps) return Promise.resolve(window.google.maps);

  const configuracao = obterStatusConfiguracaoGoogleMaps("javascript");

  if (!configuracao.pronta) {
    return Promise.reject(new Error(configuracao.mensagem));
  }

  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    const callbackName = "__saudePlusGoogleMapsReady";
    const scriptExistente = document.querySelector("script[data-saude-google-maps]");

    window[callbackName] = () => {
      if (window.google?.maps) {
        resolve(window.google.maps);
      } else {
        reject(new Error("Google Maps carregou sem a biblioteca de mapas."));
      }
    };

    if (scriptExistente) {
      scriptExistente.addEventListener("load", () => {
        if (window.google?.maps) resolve(window.google.maps);
      });
      scriptExistente.addEventListener("error", () => {
        reject(new Error("Nao foi possivel carregar o Google Maps."));
      });
      return;
    }

    const script = document.createElement("script");
    const params = new URLSearchParams({
      key: obterGoogleMapsApiKey("javascript"),
      loading: "async",
      callback: callbackName,
      language: "pt-BR",
      region: "BR",
    });

    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.dataset.saudeGoogleMaps = "true";
    script.onerror = () => {
      googleMapsPromise = null;
      delete window[callbackName];
      reject(new Error("Nao foi possivel carregar o Google Maps. Confira a chave e as restricoes da API."));
    };

    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

function criarQueryCoordenadas(coordenadas) {
  if (!coordenadas) return "";

  const { latitude, longitude } = coordenadas;

  if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
    return "";
  }

  return `${latitude},${longitude}`;
}

function criarEnderecoClinica(clinica) {
  const partes = [
    clinica?.endereco,
    clinica?.bairro,
    "Saquarema/RJ",
    "Brasil",
  ]
    .map((parte) => String(parte || "").trim())
    .filter(Boolean);

  return [...new Set(partes)].join(", ");
}

function criarQueryLocalizacaoClinica(clinica) {
  return criarQueryCoordenadas(obterCoordenadasDaClinica(clinica)) || criarEnderecoClinica(clinica);
}

function criarUrlGoogleMapsPorQuery(query) {
  if (!query) return "#";

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    query
  )}`;
}

function criarUrlRotaGoogleMapsPorQuery(query) {
  if (!query) return "#";

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    query
  )}`;
}

function criarUrlEmbedGoogleMapsPorQuery(query) {
  if (!query) return "";

  return `https://maps.google.com/maps?output=embed&z=16&hl=pt-BR&q=${encodeURIComponent(
    query
  )}`;
}

function criarUrlGoogleMaps(coordenadas) {
  return criarUrlGoogleMapsPorQuery(criarQueryCoordenadas(coordenadas));
}

function criarUrlRotaGoogleMaps(coordenadas) {
  return criarUrlRotaGoogleMapsPorQuery(criarQueryCoordenadas(coordenadas));
}

function criarUrlEmbedGoogleMaps(coordenadas) {
  return criarUrlEmbedGoogleMapsPorQuery(criarQueryCoordenadas(coordenadas));
}

function traduzirStatusGeocoder(status) {
  if (status === "ZERO_RESULTS") return "Endereco nao encontrado no Google Maps.";
  if (status === "REQUEST_DENIED") return "A chave do Google Maps nao autorizou a geocodificacao.";
  if (status === "OVER_QUERY_LIMIT") return "Limite de consultas do Google Maps atingido.";
  if (status === "INVALID_REQUEST") return "Endereco insuficiente para localizar a clinica.";
  return "Nao foi possivel localizar o endereco no Google Maps.";
}

async function geocodificarEndereco(endereco) {
  const address = String(endereco || "").trim();

  if (!address) {
    throw new Error("Informe um endereco para buscar as coordenadas.");
  }

  const maps = await carregarGoogleMaps();
  const geocoder = new maps.Geocoder();

  return new Promise((resolve, reject) => {
    geocoder.geocode(
      {
        address,
        componentRestrictions: { country: "BR" },
        region: "BR",
      },
      (resultados, status) => {
        if (status !== "OK" || !resultados?.[0]?.geometry?.location) {
          reject(new Error(traduzirStatusGeocoder(status)));
          return;
        }

        const resultado = resultados[0];
        const localizacao = resultado.geometry.location;

        resolve({
          latitude: Number(localizacao.lat().toFixed(6)),
          longitude: Number(localizacao.lng().toFixed(6)),
          enderecoFormatado: resultado.formatted_address || address,
        });
      }
    );
  });
}

export {
  carregarGoogleMaps,
  criarEnderecoClinica,
  criarQueryLocalizacaoClinica,
  criarUrlEmbedGoogleMaps,
  criarUrlEmbedGoogleMapsPorQuery,
  criarUrlGoogleMaps,
  criarUrlGoogleMapsPorQuery,
  criarUrlRotaGoogleMaps,
  criarUrlRotaGoogleMapsPorQuery,
  geocodificarEndereco,
  obterCoordenadasDaClinica,
  obterGoogleMapsApiKey,
  obterStatusConfiguracaoGoogleMaps,
  validarGoogleMapsApiKey,
};
