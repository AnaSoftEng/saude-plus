import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { ouvirClinicasAtualizadas } from "../../application/clinicas/clinicas-eventos";
import { buscarClinicaPorId } from "../../application/clinicas/clinicas-use-cases";
import CabecalhoApp from "../components/cabecalho-app";
import FotoClinica from "../components/foto-clinica";
import MapaGoogleClinica from "../components/mapa-google-clinica";
import MenuInferiorPaciente from "../components/menu-inferior-paciente";
import MenuUsuarioPaciente from "../components/menu-usuario-paciente";

function PacienteClinicaDetalhes() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const origem = location.state?.origem === "exames" ? "exames" : "consultas";
  const [clinica, setClinica] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  async function carregarClinica() {
    setCarregando(true);
    setErro("");

    try {
      setClinica(await buscarClinicaPorId(id));
    } catch (erroCarregar) {
      setClinica(null);
      setErro(erroCarregar.message || "Não conseguimos carregar os dados da clínica agora.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarClinica();
  }, [id]);

  useEffect(() => ouvirClinicasAtualizadas(carregarClinica), [id]);

  useEffect(() => {
    function recarregarAoVoltar() {
      if (document.visibilityState === "visible") {
        carregarClinica();
      }
    }

    document.addEventListener("visibilitychange", recarregarAoVoltar);
    window.addEventListener("focus", carregarClinica);

    return () => {
      document.removeEventListener("visibilitychange", recarregarAoVoltar);
      window.removeEventListener("focus", carregarClinica);
    };
  }, [id]);

  function voltar() {
    navigate(origem === "exames" ? "/paciente/exames" : "/paciente/consultas");
  }

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
        <p className="text-sm text-gray-500">Carregando informações...</p>
      </div>
    );
  }

  if (erro || !clinica) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6 text-center">
        <p className="mb-5 text-sm text-red-600">
          {erro || "Clínica não encontrada."}
        </p>
        <button
          type="button"
          onClick={voltar}
          className="rounded-xl bg-blue-400 px-6 py-3 text-sm font-bold text-white hover:bg-blue-500"
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <CabecalhoApp
        aoVoltar={voltar}
        textoVoltar="Voltar"
        voltarSomenteIcone
        contexto="Mais informações"
        titulo={clinica.nome}
        descricao={clinica.bairro}
        acao={<MenuUsuarioPaciente />}
      />

      <main className="app-content space-y-5">
        <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div
            className={`h-1.5 w-full ${
              clinica.aberta ? "bg-green-400" : "bg-gray-300"
            }`}
          />
          <div className="grid gap-5 p-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="flex items-start gap-4">
              <FotoClinica
                src={clinica.fotoPerfil}
                nome={clinica.nome}
                className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-blue-50 text-3xl font-bold text-blue-500 sm:h-32 sm:w-32"
              />

              <div className="min-w-0 flex-1">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      clinica.aberta
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-500"
                    }`}
                  >
                    {clinica.aberta ? "Aberta" : "Fechada"}
                  </span>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600">
                    {clinica.status === "ativa" ? "Ativa" : "Temporariamente fechada"}
                  </span>
                </div>

                <dl className="space-y-4 text-sm">
                  <div>
                    <dt className="font-semibold text-gray-800">Endereço</dt>
                    <dd className="mt-1 text-gray-600">{clinica.endereco}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-gray-800">Telefone</dt>
                    <dd className="mt-1 text-gray-600">{clinica.telefone}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-gray-800">Horário</dt>
                    <dd className="mt-1 text-gray-600">{clinica.horario}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3 text-center lg:items-end">
              <div className="flex min-h-20 w-full max-w-44 flex-col items-center justify-center rounded-xl bg-gray-50 px-4 py-3 text-center">
                <p className="text-xs font-medium text-gray-500">Atendimentos/dia</p>
                <strong className="text-xl text-gray-800">
                  {clinica.capacidadeDiaria || 0}
                </strong>
              </div>
            </div>
          </div>

          {((clinica.especialidades || []).length > 0 ||
            (clinica.especialidadesExames || []).length > 0) && (
            <div className="border-t border-gray-100 p-5">
              {(clinica.especialidades || []).length > 0 && (
                <>
                  <p className="mb-3 text-xs font-semibold uppercase text-gray-500">
                    Consultas
                  </p>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {(clinica.especialidades || []).map((especialidade) => (
                      <span
                        key={especialidade}
                        className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600"
                      >
                        {especialidade}
                      </span>
                    ))}
                  </div>
                </>
              )}

              {(clinica.especialidadesExames || []).length > 0 && (
                <>
                  <p className="mb-3 text-xs font-semibold uppercase text-gray-500">
                    Exames
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(clinica.especialidadesExames || []).map((especialidade) => (
                      <span
                        key={especialidade}
                        className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700"
                      >
                        {especialidade}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="grid gap-2 border-t border-gray-100 p-4 sm:grid-cols-3">
            <a
              href={`tel:${clinica.telefone}`}
              className="rounded-xl bg-gray-100 px-4 py-3 text-center text-sm font-bold text-gray-700 hover:bg-gray-200"
            >
              Ligar
            </a>
            <button
              type="button"
              onClick={() => navigate(`/paciente/agendar?clinica=${clinica.id}`)}
              disabled={!clinica.aberta || !(clinica.especialidades || []).length}
              className="rounded-xl bg-blue-400 px-4 py-3 text-sm font-bold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
            >
              Agendar consulta
            </button>
            <button
              type="button"
              onClick={() =>
                navigate(`/paciente/agendar-exame?clinica=${clinica.id}`)
              }
              disabled={!clinica.aberta || !(clinica.especialidadesExames || []).length}
              className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-600 hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-100 disabled:text-gray-400"
            >
              Agendar exame
            </button>
          </div>
        </section>

        <MapaGoogleClinica clinica={clinica} />
      </main>

      <MenuInferiorPaciente abaAtiva={origem} />
    </div>
  );
}

export default PacienteClinicaDetalhes;
