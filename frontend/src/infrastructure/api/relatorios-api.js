import { requisitarJson } from "./http-client";

const DEBUG_RELATORIOS = import.meta.env.REACT_APP_RELATORIOS_DEBUG === "true";

function registrarDebug(evento, dados) {
  if (DEBUG_RELATORIOS) {
    console.debug(`[relatorios] ${evento}`, dados);
  }
}

async function obterRelatoriosSistemaApi() {
  const rota = `/api/relatorios/sistema?ts=${Date.now()}`;
  registrarDebug("request", { rota });
  const resposta = await requisitarJson(rota, {
    cache: "no-store",
  });
  registrarDebug("response", resposta);
  return resposta;
}

async function obterRelatorioClinicaApi(clinicaId) {
  const rota = clinicaId == null || clinicaId === ""
    ? "/api/relatorios/minha-clinica"
    : `/api/relatorios/clinicas/${encodeURIComponent(String(clinicaId))}`;

  const rotaComCacheBuster = `${rota}?ts=${Date.now()}`;
  registrarDebug("request", { rota: rotaComCacheBuster, clinicaId });
  const resposta = await requisitarJson(rotaComCacheBuster, {
    cache: "no-store",
  });
  registrarDebug("response", resposta);
  return resposta;
}

export { obterRelatorioClinicaApi, obterRelatoriosSistemaApi };
