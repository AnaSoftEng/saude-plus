import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  MessageSquareText,
  Stethoscope,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { ouvirClinicasAtualizadas } from "../../application/clinicas/clinicas-eventos";
import { buscarClinicaPorId } from "../../application/clinicas/clinicas-use-cases";
import CabecalhoApp from "../components/cabecalho-app";
import FotoClinica from "../components/foto-clinica";
import MenuUsuarioPaciente from "../components/menu-usuario-paciente";
import {
  listarHorariosAgenda,
  criarAgendamento,
} from "../../application/agenda/agendamento-use-cases";
import { obterUsuarioAtual } from "../../application/auth/auth-service";

function dataMinimaHoje() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatarDataPt(dataIso) {
  if (!dataIso) return "";
  const [y, m, d] = dataIso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function AgendarConsulta() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const clinicaIdParam = params.get("clinica");

  const [clinica, setClinica] = useState(null);
  const [carregandoClinica, setCarregandoClinica] = useState(false);
  const [especialidade, setEspecialidade] = useState("");
  const [data, setData] = useState(dataMinimaHoje());
  const [horarioId, setHorarioId] = useState(null);
  const [horarios, setHorarios] = useState([]);
  const [carregandoHorarios, setCarregandoHorarios] = useState(false);
  const [observacoes, setObservacoes] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erroAcao, setErroAcao] = useState("");

  const carregarClinica = useCallback(async () => {
    if (!clinicaIdParam) {
      setClinica(null);
      return;
    }

    setCarregandoClinica(true);
    setErroAcao("");
    try {
      setClinica(await buscarClinicaPorId(clinicaIdParam));
    } catch (erro) {
      setClinica(null);
      setErroAcao(erro.message || "Não conseguimos carregar os dados da clínica agora.");
    } finally {
      setCarregandoClinica(false);
    }
  }, [clinicaIdParam]);

  useEffect(() => {
    carregarClinica();
  }, [carregarClinica]);

  useEffect(() => ouvirClinicasAtualizadas(carregarClinica), [carregarClinica]);

  const carregarHorarios = useCallback(async () => {
    if (!clinica || !especialidade || !data) return;
    setCarregandoHorarios(true);
    setErroAcao("");
    try {
      const lista = await listarHorariosAgenda(
        clinica.id,
        data,
        null,
        especialidade
      );
      setHorarios(Array.isArray(lista) ? lista : []);
    } catch (e) {
      setHorarios([]);
      setErroAcao(e.message || "Não foi possível carregar os horários.");
    } finally {
      setCarregandoHorarios(false);
    }
  }, [clinica, data, especialidade]);

  useEffect(() => {
    carregarHorarios();
  }, [carregarHorarios]);

  useEffect(() => {
    setHorarioId(null);
  }, [data, especialidade]);

  useEffect(() => {
    if (clinica?.especialidades?.length && !clinica.especialidades.includes(especialidade)) {
      setEspecialidade(clinica.especialidades[0]);
    }
  }, [clinica, especialidade]);

  const horarioSelecionado = useMemo(
    () => horarios.find((h) => h.id === horarioId),
    [horarioId, horarios]
  );

  function aoVoltar() {
    navigate("/paciente/inicio");
  }

  async function aoConfirmar(e) {
    e.preventDefault();
    if (!clinica || !especialidade || !data || !horarioId) return;

    const slot = horarios.find((h) => h.id === horarioId);
    if (!slot?.disponivel) return;

    const usuario = obterUsuarioAtual();
    const pacienteId = usuario?.id != null ? Number(usuario.id) : 1;

    setEnviando(true);
    setErroAcao("");
    try {
      await criarAgendamento({
        pacienteId,
        medicoId: slot.medico_id,
        agendaId: slot.id,
        clinicaId: clinica.id,
        observacoes,
        especialidade,
      });
      setSucesso(true);
      await carregarHorarios();
    } catch (err) {
      setErroAcao(err.message || "Não conseguimos concluir o agendamento. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  if (carregandoClinica) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#eef8f7] px-6">
        <p className="text-sm font-medium text-slate-500">Carregando dados da clínica...</p>
      </div>
    );
  }

  if (!clinicaIdParam || !clinica) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#eef8f7] px-6">
        <div className="absolute right-5 top-10 rounded-lg bg-blue-500">
          <MenuUsuarioPaciente />
        </div>
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100">
            <Building2 className="h-7 w-7" aria-hidden="true" />
          </div>
          <p className="mb-6 text-slate-600">
            Escolha uma clínica na lista para continuar com o agendamento.
          </p>
          <button
            type="button"
            onClick={() => navigate("/paciente/inicio")}
            className="rounded-lg bg-blue-500 px-8 py-3 font-bold text-white transition hover:bg-blue-600"
          >
            Ver clínicas
          </button>
        </div>
      </div>
    );
  }

  if (!clinica.aberta) {
    return (
      <div className="flex min-h-screen flex-col bg-[#eef8f7]">
        <CabecalhoApp
          compacto
          fixo={false}
          aoVoltar={aoVoltar}
          textoVoltar="Voltar"
          voltarSomenteIcone
          titulo="Agendar consulta"
          acao={<MenuUsuarioPaciente />}
        />
        <div className="p-6 text-center">
          <p className="text-slate-600">
            Esta unidade não está recebendo agendamentos no momento.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#eef8f7] pb-32">
      <CabecalhoApp
        compacto
        aoVoltar={aoVoltar}
        textoVoltar="Voltar às clínicas"
        voltarSomenteIcone
        titulo="Agendar consulta"
        descricao="Escolha especialidade, data e horário"
        acao={<MenuUsuarioPaciente />}
      />

      <main className="app-content-narrow">
        <div className="grid gap-5 lg:grid-cols-[1fr_18rem] lg:items-start">
          <div className="space-y-5">
            <section className="overflow-hidden rounded-lg border border-blue-100 bg-white shadow-sm shadow-blue-950/5">
              <div className="h-1 w-full bg-blue-500" />
              <div className="p-5">
                <div className="flex gap-4">
                  <FotoClinica
                    src={clinica.fotoPerfil}
                    nome={clinica.nome}
                    className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-blue-50 text-2xl font-bold text-blue-600 ring-1 ring-blue-100"
                  />
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold leading-tight text-slate-900">
                      {clinica.nome}
                    </h2>
                    <p className="mt-1 font-semibold text-blue-600">{clinica.bairro}</p>
                    <p className="mt-2 flex items-start gap-2 text-sm leading-5 text-slate-500">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" aria-hidden="true" />
                      <span>{clinica.endereco}</span>
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm shadow-blue-950/5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Stethoscope className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900">Especialidade</h2>
                  <p className="text-sm text-slate-500">Selecione o tipo de atendimento</p>
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {clinica.especialidades.map((esp) => (
                  <button
                    key={esp}
                    type="button"
                    onClick={() => setEspecialidade(esp)}
                    className={`flex-shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                      especialidade === esp
                        ? "bg-blue-500 text-white shadow-sm shadow-blue-950/10"
                        : "border border-blue-100 bg-blue-50/40 text-slate-600 hover:border-blue-300 hover:bg-white"
                    }`}
                  >
                    {esp}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm shadow-blue-950/5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <CalendarDays className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900">Data da consulta</h2>
                  <p className="text-sm text-slate-500">A partir de hoje</p>
                </div>
              </div>

              <input
                type="date"
                min={dataMinimaHoje()}
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-full rounded-lg border border-blue-100 bg-blue-50/40 px-4 py-3 text-base text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              {data && (
                <p className="mt-2 text-sm capitalize text-slate-500">
                  {formatarDataPt(data)}
                </p>
              )}
            </section>

            <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm shadow-blue-950/5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Clock3 className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900">Horários disponíveis</h2>
                  <p className="text-sm text-slate-500">
                    Horários riscados já estão ocupados
                  </p>
                </div>
              </div>

              {carregandoHorarios ? (
                <p className="py-6 text-center text-sm text-slate-500">Carregando...</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {horarios.map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      disabled={!slot.disponivel}
                      onClick={() => slot.disponivel && setHorarioId(slot.id)}
                      className={`min-h-12 rounded-lg text-sm font-bold transition ${
                        !slot.disponivel
                          ? "cursor-not-allowed bg-slate-100 text-slate-400 line-through"
                          : horarioId === slot.id
                            ? "bg-blue-500 text-white shadow-sm shadow-blue-950/10 ring-2 ring-blue-200"
                            : "border border-blue-100 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/50 active:scale-95"
                      }`}
                    >
                      {slot.hora}
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm shadow-blue-950/5">
              <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
                <MessageSquareText className="h-4 w-4 text-blue-500" aria-hidden="true" />
                Observações
              </label>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex.: primeira consulta, acompanhamento..."
                rows={3}
                className="w-full resize-none rounded-lg border border-blue-100 bg-blue-50/40 px-4 py-3 text-base text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </section>

            {erroAcao && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm text-red-600">{erroAcao}</p>
              </div>
            )}
          </div>

          <aside className="hidden rounded-lg border border-blue-100 bg-white p-4 shadow-sm shadow-blue-950/5 lg:sticky lg:top-28 lg:block">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-600">
              Resumo
            </p>
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <p className="font-bold text-slate-900">{clinica.nome}</p>
                <p className="text-slate-500">{clinica.bairro}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Consulta
                </p>
                <p className="mt-1 font-semibold text-slate-700">{especialidade}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Data
                </p>
                <p className="mt-1 capitalize text-slate-700">{formatarDataPt(data)}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Horário
                </p>
                <p className="mt-1 text-lg font-bold text-blue-600">
                  {horarioSelecionado?.hora || "--:--"}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-blue-100 bg-white/95 px-4 pt-3 shadow-lg shadow-blue-950/10 backdrop-blur safe-bottom-nav">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-sm">
            <p className="truncate font-bold text-slate-900">
              {especialidade || "Selecione a especialidade"}
            </p>
            <p className="truncate text-slate-500">
              {horarioSelecionado?.hora
                ? `${formatarDataPt(data)} às ${horarioSelecionado.hora}`
                : "Escolha um horário disponível"}
            </p>
          </div>
          <button
            type="button"
            disabled={!horarioSelecionado?.disponivel || enviando || carregandoHorarios}
            onClick={aoConfirmar}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-500 px-6 text-base font-bold text-white shadow-sm shadow-blue-950/10 transition hover:bg-blue-600 active:scale-[0.98] disabled:bg-slate-200 disabled:text-slate-400 sm:w-auto"
          >
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            {enviando ? "Confirmando..." : "Confirmar agendamento"}
          </button>
        </div>
      </div>

      {sucesso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-6">
          <div className="w-full max-w-sm rounded-lg bg-white p-7 text-center shadow-xl shadow-slate-950/20">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
              <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
            </div>
            <h3 className="mb-2 text-xl font-bold text-slate-900">
              Agendamento registrado
            </h3>
            <p className="mb-6 text-sm leading-6 text-slate-600">
              {clinica.nome}
              <br />
              {formatarDataPt(data)} às {horarioSelecionado?.hora}
              <br />
              <span className="font-bold text-blue-600">{especialidade}</span>
            </p>
            <button
              type="button"
              onClick={() => {
                setSucesso(false);
                navigate("/paciente/inicio");
              }}
              className="w-full rounded-lg bg-blue-500 py-3 font-bold text-white transition hover:bg-blue-600"
            >
              Voltar ao início
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AgendarConsulta;
