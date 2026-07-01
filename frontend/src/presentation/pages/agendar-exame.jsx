import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { listarHorariosAgenda } from "../../application/agenda/agendamento-use-cases";
import { obterUsuarioAtual } from "../../application/auth/auth-service";
import { criarAgendamentoExame } from "../../application/exames/exames-use-cases";
import { ouvirClinicasAtualizadas } from "../../application/clinicas/clinicas-eventos";
import { buscarClinicaPorId } from "../../application/clinicas/clinicas-use-cases";
import CabecalhoApp from "../components/cabecalho-app";
import FotoClinica from "../components/foto-clinica";
import MenuUsuarioPaciente from "../components/menu-usuario-paciente";

function obterEspecialidadesExames(clinica) {
  return (clinica?.especialidadesExames || [])
    .map((especialidade) => String(especialidade || "").trim())
    .filter(Boolean);
}

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
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function AgendarExame() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const clinicaIdParam = params.get("clinica");
  const [clinica, setClinica] = useState(null);
  const [carregandoClinica, setCarregandoClinica] = useState(false);
  const [tipoExame, setTipoExame] = useState("");
  const [data, setData] = useState(dataMinimaHoje());
  const [horarioId, setHorarioId] = useState(null);
  const [horarios, setHorarios] = useState([]);
  const [carregandoHorarios, setCarregandoHorarios] = useState(false);
  const [observacoes, setObservacoes] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erroAcao, setErroAcao] = useState("");
  const [sucesso, setSucesso] = useState(null);
  const tiposExames = useMemo(() => obterEspecialidadesExames(clinica), [clinica]);

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
      setErroAcao(erro.message || "Não conseguimos carregar os dados da unidade agora.");
    } finally {
      setCarregandoClinica(false);
    }
  }, [clinicaIdParam]);

  useEffect(() => {
    carregarClinica();
  }, [carregarClinica]);

  useEffect(() => ouvirClinicasAtualizadas(carregarClinica), [carregarClinica]);

  const carregarHorarios = useCallback(async () => {
    if (!clinica || !tipoExame || !data) return;

    setCarregandoHorarios(true);
    setErroAcao("");
    try {
      const lista = await listarHorariosAgenda(clinica.id, data, null, tipoExame);
      setHorarios(Array.isArray(lista) ? lista : []);
    } catch (erro) {
      setHorarios([]);
      setErroAcao(erro.message || "Não conseguimos carregar os horários disponíveis agora.");
    } finally {
      setCarregandoHorarios(false);
    }
  }, [clinica, data, tipoExame]);

  useEffect(() => {
    carregarHorarios();
  }, [carregarHorarios]);

  useEffect(() => {
    setHorarioId(null);
  }, [data, tipoExame]);

  useEffect(() => {
    if (tiposExames.length === 0) {
      setTipoExame("");
      return;
    }

    if (!tiposExames.includes(tipoExame)) {
      setTipoExame(tiposExames[0]);
    }
  }, [tipoExame, tiposExames]);

  function aoVoltar() {
    navigate("/paciente/exames");
  }

  async function aoConfirmar(evento) {
    evento.preventDefault();
    if (!clinica || !tipoExame || !data || !horarioId) {
      setErroAcao("Escolha o exame, a data e o horário antes de confirmar.");
      return;
    }

    const slot = horarios.find((item) => item.id === horarioId);
    if (!slot?.disponivel) {
      setErroAcao("Escolha um horário disponível para confirmar.");
      return;
    }

    const usuario = obterUsuarioAtual();
    const pacienteId = usuario?.id != null ? Number(usuario.id) : 1;

    setEnviando(true);
    setErroAcao("");
    try {
      const exame = await criarAgendamentoExame({
        pacienteId,
        medicoId: slot.medico_id,
        agendaId: slot.id,
        clinicaId: clinica.id,
        clinicaNome: clinica.nome,
        clinicaBairro: clinica.bairro,
        tipo: tipoExame,
        data,
        horario: slot.hora,
        observacoes,
      });
      setSucesso(exame);
      setHorarioId(null);
      setObservacoes("");
      await carregarHorarios();
    } catch (erro) {
      setErroAcao(erro.message || "Não conseguimos agendar o exame. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  if (carregandoClinica) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
        <p className="text-sm text-gray-500">Carregando dados da unidade...</p>
      </div>
    );
  }

  if (!clinicaIdParam || !clinica) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6">
        <div className="absolute right-5 top-10 rounded-full bg-blue-400">
          <MenuUsuarioPaciente />
        </div>
        <p className="mb-6 text-center text-gray-600">
          Escolha uma unidade na aba Exames para continuar com o agendamento.
        </p>
        <button
          type="button"
          onClick={() => navigate("/paciente/exames")}
          className="rounded-xl bg-blue-400 px-8 py-3 font-bold text-white hover:bg-blue-500"
        >
          Ver unidades disponíveis
        </button>
      </div>
    );
  }

  if (!clinica.aberta) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50">
        <CabecalhoApp
          compacto
          fixo={false}
          aoVoltar={aoVoltar}
          textoVoltar="Voltar"
          voltarSomenteIcone
          titulo="Agendar exame"
          acao={<MenuUsuarioPaciente />}
        />
        <div className="p-6 text-center">
          <p className="text-gray-600">
            Esta unidade não está recebendo agendamentos no momento.
          </p>
        </div>
      </div>
    );
  }

  const horarioSelecionado = horarios.find((item) => item.id === horarioId);

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <CabecalhoApp
        compacto
        aoVoltar={aoVoltar}
        textoVoltar="Voltar às unidades"
        voltarSomenteIcone
        titulo="Agendar exame"
        descricao="Escolha o exame, a data e o horário"
        acao={<MenuUsuarioPaciente />}
      />

      <main className="app-content-narrow space-y-5">
        <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div
            className={`h-1.5 w-full ${clinica.aberta ? "bg-green-400" : "bg-gray-300"}`}
          />
          <div className="flex gap-4 p-5">
            <FotoClinica
              src={clinica.fotoPerfil}
              nome={clinica.nome}
              className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-blue-50 text-2xl font-bold text-blue-500"
            />
            <div>
              <h2 className="text-base font-bold text-gray-800">{clinica.nome}</h2>
              <p className="text-sm font-medium text-blue-400">{clinica.bairro}</p>
              <p className="mt-1 text-xs text-gray-500">{clinica.endereco}</p>
            </div>
          </div>
        </section>

        <section>
          <p className="mb-3 text-xs font-medium uppercase text-gray-500">
            Tipo de exame
          </p>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {tiposExames.map((exame) => (
              <button
                key={exame}
                type="button"
                onClick={() => setTipoExame(exame)}
                className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                  tipoExame === exame
                    ? "bg-blue-400 text-white shadow-md"
                    : "border border-gray-200 bg-white text-gray-600 hover:border-blue-300"
                }`}
              >
                {exame}
              </button>
            ))}
          </div>
          {tiposExames.length === 0 && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Esta unidade ainda não possui exames disponíveis.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <label className="mb-2 block text-sm font-semibold text-gray-700">
            Data do exame
          </label>
          <input
            type="date"
            min={dataMinimaHoje()}
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {data && (
            <p className="mt-2 text-sm capitalize text-gray-500">
              {formatarDataPt(data)}
            </p>
          )}
        </section>

        <section>
          <p className="mb-3 text-xs font-medium uppercase text-gray-500">
            Horários disponíveis
          </p>
          {carregandoHorarios ? (
            <p className="py-6 text-center text-sm text-gray-500">Carregando...</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {horarios.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  disabled={!slot.disponivel}
                  onClick={() => slot.disponivel && setHorarioId(slot.id)}
                  className={`rounded-xl py-3 text-sm font-semibold transition ${
                    !slot.disponivel
                      ? "cursor-not-allowed bg-gray-100 text-gray-400 line-through"
                      : horarioId === slot.id
                        ? "bg-blue-400 text-white shadow-md ring-2 ring-blue-200"
                        : "border border-gray-200 bg-white text-gray-700 hover:border-blue-300 active:scale-95"
                  }`}
                >
                  {slot.hora}
                </button>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-gray-400">
            Horários riscados já estão ocupados ou indisponíveis.
          </p>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <label className="mb-2 block text-sm font-semibold text-gray-700">
            Observações (opcional)
          </label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Ex.: pedido medico, orientacoes recebidas..."
            rows={3}
            className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-base text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </section>

        {erroAcao && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-600">{erroAcao}</p>
          </div>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-100 bg-white/95 px-4 pt-4 shadow-lg backdrop-blur safe-bottom-nav">
        <div className="mx-auto w-full max-w-3xl">
          <button
            type="button"
            disabled={!tipoExame || !horarioSelecionado?.disponivel || enviando || carregandoHorarios}
            onClick={aoConfirmar}
            className="w-full rounded-xl bg-blue-400 py-4 text-base font-bold text-white transition hover:bg-blue-500 active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-400 sm:text-lg"
          >
            {enviando ? "Confirmando..." : "Confirmar agendamento"}
          </button>
        </div>
      </div>

      {sucesso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
          <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-xl">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-white p-1 shadow-sm ring-1 ring-blue-100">
              <img
                src="/icons/logo-saude-plus.png"
                alt="Saúde+"
                className="h-full w-full object-contain"
              />
            </div>
            <h3 className="mb-2 text-xl font-bold text-gray-800">
              Exame agendado
            </h3>
            <p className="mb-6 text-sm text-gray-600">
              {sucesso.tipo}
              <br />
              {sucesso.clinica_nome}
              <br />
              {formatarDataPt(sucesso.data)} as {sucesso.horario}
            </p>
            <button
              type="button"
              onClick={() => {
                setSucesso(null);
                navigate("/paciente/inicio");
              }}
              className="w-full rounded-xl bg-blue-400 py-3 font-bold text-white hover:bg-blue-500"
            >
              Voltar ao início
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AgendarExame;
