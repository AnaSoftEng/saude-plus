import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, TestTube2 } from "lucide-react";
import { useNavigate } from "react-router";
import { buscarHistoricoPaciente } from "../../application/agenda/agendamento-use-cases";
import { ouvirConsultasAtualizadas } from "../../application/agenda/consultas-eventos";
import { obterUsuarioAtual } from "../../application/auth/auth-service";
import { listarExamesPaciente } from "../../application/exames/exames-use-cases";
import { ouvirExamesAtualizados } from "../../application/exames/exames-eventos";
import { ouvirClinicasAtualizadas } from "../../application/clinicas/clinicas-eventos";
import { listarClinicas } from "../../application/clinicas/clinicas-use-cases";
import CabecalhoApp from "../components/cabecalho-app";
import MenuInferiorPaciente from "../components/menu-inferior-paciente";
import MenuUsuarioPaciente from "../components/menu-usuario-paciente";

function parseAgendaId(agendaId) {
  const parsed = /^ag-(\d+)-(\d{4}-\d{2}-\d{2})-t(\d{2})(\d{2})$/.exec(
    String(agendaId || "")
  );
  if (!parsed) return null;

  return {
    clinicaId: Number(parsed[1]),
    data: parsed[2],
    hora: `${parsed[3]}:${parsed[4]}`,
  };
}

function obterAgendaDaConsulta(consulta) {
  const agenda = parseAgendaId(consulta.agenda_id);
  if (agenda) return agenda;

  const data = consulta.data || consulta.data_consulta;
  const hora = consulta.hora || consulta.horario;
  if (!data || !hora) return null;

  return {
    clinicaId: Number(consulta.clinica_id),
    data,
    hora,
  };
}

function obterAgendaDoExame(exame) {
  const agenda = parseAgendaId(exame.agenda_id);
  const data = exame.data || agenda?.data;
  const hora = exame.horario || exame.hora || agenda?.hora;

  if (!data || !hora) return null;

  return {
    clinicaId: agenda?.clinicaId || Number(exame.clinica_id),
    data,
    hora,
  };
}

function paraInicioDoDia(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatarData(dataIso) {
  const [y, m, d] = dataIso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function HomePaciente() {
  const navigate = useNavigate();
  const usuario = obterUsuarioAtual();
  const nomeUsuario = usuario?.nome || "Paciente";
  const [consultas, setConsultas] = useState([]);
  const [exames, setExames] = useState([]);
  const [clinicas, setClinicas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  async function carregarDashboard() {
    const pacienteId = usuario?.id != null ? Number(usuario.id) : 1;
    setCarregando(true);
    setErro("");

    try {
      const [listaConsultas, listaClinicas, listaExames] = await Promise.all([
        buscarHistoricoPaciente(pacienteId),
        listarClinicas(),
        listarExamesPaciente(pacienteId),
      ]);
      setConsultas(Array.isArray(listaConsultas) ? listaConsultas : []);
      setClinicas(Array.isArray(listaClinicas) ? listaClinicas : []);
      setExames(Array.isArray(listaExames) ? listaExames : []);
    } catch (e) {
      setErro(e.message || "Não conseguimos carregar suas consultas agora.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarDashboard();
  }, [usuario?.id]);

  useEffect(() => ouvirClinicasAtualizadas(carregarDashboard), [usuario?.id]);
  useEffect(() => ouvirConsultasAtualizadas(carregarDashboard), [usuario?.id]);
  useEffect(() => ouvirExamesAtualizados(carregarDashboard), [usuario?.id]);

  const consultasFuturas = useMemo(() => {
    const hoje = paraInicioDoDia(new Date());
    return consultas
      .map((consulta) => {
        const agenda = obterAgendaDaConsulta(consulta);
        if (!agenda) return null;

        const clinica =
          clinicas.find((c) => Number(c.id) === Number(agenda.clinicaId)) ||
          clinicas.find((c) => Number(c.id) === Number(consulta.clinica_id));
        const dataConsulta = paraInicioDoDia(new Date(`${agenda.data}T00:00:00`));
        const status = String(consulta.status || "").toLowerCase();
        const estaCancelada = ["cancelada", "cancelado"].includes(status);
        const estaAtiva = ["agendada", "agendado", "confirmada", "confirmado"].includes(status);

        return {
          ...consulta,
          clinicaNome: clinica?.nome || "Clínica não identificada",
          clinicaBairro: clinica?.bairro || "-",
          data: agenda.data,
          hora: agenda.hora,
          apareceNaDashboard: !estaCancelada && (dataConsulta >= hoje || estaAtiva),
        };
      })
      .filter((consulta) => consulta && consulta.apareceNaDashboard)
      .sort((a, b) => `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`));
  }, [clinicas, consultas]);

  const proximosExames = useMemo(() => {
    const hoje = paraInicioDoDia(new Date());
    return exames
      .map((exame) => {
        const agenda = obterAgendaDoExame(exame);
        if (!agenda) return null;

        const clinica = clinicas.find(
          (item) => Number(item.id) === Number(agenda.clinicaId)
        );
        const status = String(exame.status || "").toLowerCase();
        const dataExame = paraInicioDoDia(new Date(`${agenda.data}T00:00:00`));
        const estaCancelado = ["cancelado", "cancelada"].includes(status);
        const estaAgendado = ["agendado", "agendada"].includes(status);

        return {
          ...exame,
          data: agenda.data,
          horario: agenda.hora,
          clinica_nome: clinica?.nome || exame.clinica_nome,
          clinica_bairro: clinica?.bairro || exame.clinica_bairro,
          apareceNaDashboard: !estaCancelado && (dataExame >= hoje || estaAgendado),
        };
      })
      .filter((exame) => exame && exame.apareceNaDashboard)
      .sort((a, b) =>
        `${a.data} ${a.horario}`.localeCompare(`${b.data} ${b.horario}`)
      );
  }, [clinicas, exames]);

  return (
    <div className="min-h-screen bg-gray-50">
      <CabecalhoApp
        titulo={`Olá, ${nomeUsuario}`}
        descricao="Acompanhe seus próximos atendimentos"
        acao={<MenuUsuarioPaciente />}
      />

      <main className="app-content dashboard-shell">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="dashboard-section">
          <div className="dashboard-section-header">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-500">
                <CalendarDays className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
              <h2 className="dashboard-section-title">Próximas consultas</h2>
              <p className="dashboard-section-description">
                Agendamentos futuros confirmados para você
              </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate("/paciente/consultas")}
              className="dashboard-action"
            >
              <span>Agendar</span>
              <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {carregando && (
            <p className="py-8 text-center text-sm text-gray-500">
              Carregando consultas...
            </p>
          )}

          {!carregando && erro && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-600">{erro}</p>
            </div>
          )}

          {!carregando && !erro && consultasFuturas.length === 0 && (
            <div className="dashboard-card-muted text-center">
              <p className="font-semibold text-gray-700">Nenhuma consulta futura</p>
              <p className="mt-1 text-sm text-gray-500">
                Seus próximos agendamentos aparecerão aqui.
              </p>
            </div>
          )}

          {!carregando && !erro && consultasFuturas.length > 0 && (
            <div className="space-y-3">
              {consultasFuturas.map((consulta) => (
                <article
                  key={consulta.id}
                  className="dashboard-card-muted"
                >
                  <p className="font-bold text-gray-800">{consulta.clinicaNome}</p>
                  <p className="mt-1 text-sm text-gray-500">{consulta.clinicaBairro}</p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Data:</span>{" "}
                      {formatarData(consulta.data)}
                    </p>
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Hora:</span> {consulta.hora}
                    </p>
                  </div>
                  {consulta.especialidade && (
                    <p className="mt-2 text-xs font-medium text-blue-500">
                      {consulta.especialidade}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-header">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <TestTube2 className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
              <h2 className="dashboard-section-title">Próximos exames</h2>
              <p className="dashboard-section-description">
                Solicitações e resultados previstos
              </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate("/paciente/exames")}
              className="dashboard-action"
            >
              <span>Ver exames</span>
              <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {carregando && (
            <p className="py-8 text-center text-sm text-gray-500">
              Carregando exames...
            </p>
          )}

          {!carregando && erro && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-600">{erro}</p>
            </div>
          )}

          {!carregando && !erro && proximosExames.length === 0 && (
            <div className="dashboard-card-muted text-center">
              <p className="font-semibold text-gray-700">Nenhum exame futuro</p>
              <p className="mt-1 text-sm text-gray-500">
                Seus próximos exames aparecerão aqui.
              </p>
            </div>
          )}

          {!carregando && !erro && proximosExames.length > 0 && (
            <div className="space-y-3">
              {proximosExames.map((exame) => (
                <article
                  key={exame.id}
                  className="dashboard-card-muted"
                >
                  <p className="font-bold text-gray-800">{exame.tipo}</p>
                  <p className="mt-1 text-sm text-gray-500">{exame.clinica_nome}</p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Data:</span>{" "}
                      {formatarData(exame.data)}
                    </p>
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Hora:</span> {exame.horario}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        </div>
      </main>

      <MenuInferiorPaciente abaAtiva="inicio" />
      <div className="h-24" />
    </div>
  );
}

export default HomePaciente;
