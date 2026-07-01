import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  RELATORIO_VAZIO,
  obterRelatoriosSistema,
} from "../../application/sistema/relatorios-use-cases";
import { ouvirClinicasAtualizadas } from "../../application/clinicas/clinicas-eventos";
import { ouvirConsultasAtualizadas } from "../../application/agenda/consultas-eventos";
import { ouvirExamesAtualizados } from "../../application/exames/exames-eventos";
import { ouvirUsuariosAtualizados } from "../../application/usuarios/usuarios-eventos";
import CabecalhoApp from "../components/cabecalho-app";

const ROTULOS_STATUS = {
  agendada: "Agendada",
  confirmada: "Confirmada",
  realizada: "Realizada",
  cancelada: "Cancelada",
};

function formatarData(data) {
  if (!data) return "-";
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarAtualizacao(dataIso) {
  if (!dataIso) return "Atualizando em tempo real";

  return new Date(dataIso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function limitarPercentual(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return 0;
  return Math.min(100, Math.max(0, numero));
}

function AdminRelatoriosSistema() {
  const navigate = useNavigate();
  const [relatorio, setRelatorio] = useState(RELATORIO_VAZIO);
  const [clinicaConsultasRecentes, setClinicaConsultasRecentes] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  async function carregarRelatorios() {
    setCarregando(true);
    setErro("");
    try {
      setRelatorio(await obterRelatoriosSistema());
    } catch (falha) {
      setErro(falha.message || "Não conseguimos carregar os relatórios agora.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarRelatorios();
  }, []);

  useEffect(() => ouvirClinicasAtualizadas(carregarRelatorios), []);
  useEffect(() => ouvirConsultasAtualizadas(carregarRelatorios), []);
  useEffect(() => ouvirExamesAtualizados(carregarRelatorios), []);
  useEffect(() => ouvirUsuariosAtualizados(carregarRelatorios), []);

  const {
    atualizadoEm,
    periodo,
    resumo,
    porClinica,
    clinicas,
    porEspecialidade,
    porTipoExame,
    porStatus,
    porStatusExames,
    consultasRecentes,
    examesRecentes,
  } = relatorio;
  const clinicasDisponiveis = clinicas.length > 0 ? clinicas : porClinica;
  const consultasRecentesFiltradas = useMemo(() => {
    if (!clinicaConsultasRecentes) return consultasRecentes;

    return consultasRecentes.filter(
      (consulta) => Number(consulta.clinica_id) === Number(clinicaConsultasRecentes)
    );
  }, [clinicaConsultasRecentes, consultasRecentes]);
  const maiorVolumeEspecialidade = Math.max(
    ...porEspecialidade.map((item) => item.total),
    1
  );
  const statusConsultas = Object.entries(porStatus);
  const statusExames = Object.entries(porStatusExames);

  return (
    <div className="min-h-screen bg-gray-50">
      <CabecalhoApp
        compacto
        aoVoltar={() => navigate("/admin/master")}
        textoVoltar="Voltar ao painel"
        voltarSomenteIcone
        titulo="Relatórios do sistema"
        descricao={
          <>
            Indicadores calculados a partir das clínicas, usuários e consultas cadastradas.
            <span className="mt-1 block text-xs">
              Atualizado em {formatarAtualizacao(atualizadoEm)}
            </span>
          </>
        }
      />

      <main className="app-content space-y-5">
        {carregando && (
          <p className="text-center text-sm text-gray-500">Carregando relatórios...</p>
        )}

        {!carregando && erro && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-red-600 text-sm">{erro}</p>
          </div>
        )}

        <section className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-gray-500 text-sm">Agendamentos no mês</p>
            <strong className="text-3xl text-gray-800">
              {resumo.agendamentosMes || resumo.consultasMes}
            </strong>
            <p className="text-xs text-gray-400 mt-1">
              Periodo {periodo.rotulo || "atual"}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-gray-500 text-sm">Consultas</p>
            <strong className="text-3xl text-gray-800">{resumo.consultasMes}</strong>
            <p className="text-xs text-gray-400 mt-1">Consultas cadastradas</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-gray-500 text-sm">Exames</p>
            <strong className="text-3xl text-gray-800">{resumo.examesMes || 0}</strong>
            <p className="text-xs text-gray-400 mt-1">
              {resumo.examesPendentes || 0} pendentes
            </p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-gray-500 text-sm">Realizadas</p>
            <strong className="text-3xl text-gray-800">{resumo.consultasRealizadas}</strong>
            <p className="text-xs text-gray-400 mt-1">Atendimentos concluídos</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-gray-500 text-sm">Usuários ativos</p>
            <strong className="text-3xl text-gray-800">{resumo.usuariosAtivos}</strong>
            <p className="text-xs text-gray-400 mt-1">De {resumo.totalUsuarios} cadastrados</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-gray-500 text-sm">Taxa de cancelamento</p>
            <strong className="text-3xl text-gray-800">{resumo.taxaCancelamento}%</strong>
            <p className="text-xs text-gray-400 mt-1">{resumo.consultasCanceladas} canceladas</p>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-5">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">
                  Desempenho por clínica
                </h2>
                <p className="text-gray-500 text-sm">
                  Compara volume, ocupacao e atendimentos reais das unidades.
                </p>
              </div>
              <span className="bg-blue-50 text-blue-700 text-xs px-3 py-1 rounded-full font-semibold">
                {resumo.clinicasAtivas}/{resumo.totalClinicas} ativas
              </span>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left px-3 py-3 font-semibold rounded-l-xl">Clínica</th>
                    <th className="text-left px-3 py-3 font-semibold">Consultas</th>
                    <th className="text-left px-3 py-3 font-semibold">Exames</th>
                    <th className="text-left px-3 py-3 font-semibold">Realizadas</th>
                    <th className="text-left px-3 py-3 font-semibold">Canceladas</th>
                    <th className="text-left px-3 py-3 font-semibold">Ocupação</th>
                    <th className="text-left px-3 py-3 font-semibold rounded-r-xl">Atendimentos</th>
                  </tr>
                </thead>
                <tbody>
                  {porClinica.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100">
                      <td className="px-3 py-3">
                        <p className="font-semibold text-gray-800">{item.nome}</p>
                        <p className="text-gray-500">{item.bairro}</p>
                      </td>
                      <td className="px-3 py-3 text-gray-700">{item.consultas}</td>
                      <td className="px-3 py-3 text-gray-700">{item.exames || 0}</td>
                      <td className="px-3 py-3 text-gray-700">{item.realizadas}</td>
                      <td className="px-3 py-3 text-gray-700">{item.canceladas}</td>
                      <td className="px-3 py-3">
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-400"
                            style={{ width: `${limitarPercentual(item.ocupacao)}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {limitarPercentual(item.ocupacao)}% no mes
                        </p>
                      </td>
                      <td className="px-3 py-3 text-gray-700">
                        {item.atendimentosMes || item.agendamentos || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-5">
            <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h2 className="text-xl font-semibold text-gray-800">
                Especialidades mais buscadas
              </h2>
              <p className="text-gray-500 text-sm mb-4">
                Volume de consultas por área de atendimento.
              </p>
              {porEspecialidade.length === 0 ? (
                <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-500">
                  Nenhuma consulta registrada no período atual.
                </p>
              ) : (
                <div className="space-y-3">
                  {porEspecialidade.map((item) => (
                    <div key={item.especialidade}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-semibold text-gray-700">{item.especialidade}</span>
                        <span className="text-gray-500">{item.total}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-400"
                          style={{
                            width: `${Math.round((item.total / maiorVolumeEspecialidade) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h2 className="text-xl font-semibold text-gray-800">
                Exames mais agendados
              </h2>
              <p className="text-gray-500 text-sm mb-4">
                Volume de exames por tipo.
              </p>
              {porTipoExame.length === 0 ? (
                <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-500">
                  Nenhum exame registrado no período atual.
                </p>
              ) : (
                <div className="space-y-3">
                  {porTipoExame.map((item) => (
                    <div key={item.tipo}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-semibold text-gray-700">{item.tipo}</span>
                        <span className="text-gray-500">{item.total}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h2 className="text-xl font-semibold text-gray-800">Status das consultas</h2>
              <p className="text-gray-500 text-sm mb-4">
                Visao operacional dos agendamentos do mes.
              </p>
              {statusConsultas.length === 0 ? (
                <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-500">
                  Nenhum status de consulta para exibir neste período.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {statusConsultas.map(([status, total]) => (
                    <div key={status} className="bg-gray-50 rounded-xl p-4">
                      <p className="text-gray-500 text-sm">{ROTULOS_STATUS[status] || status}</p>
                      <strong className="text-2xl text-gray-800">{total}</strong>
                    </div>
                  ))}
                </div>
              )}
              {statusExames.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-sm font-semibold text-gray-700">Exames</p>
                  <div className="grid grid-cols-2 gap-3">
                    {statusExames.map(([status, total]) => (
                      <div key={status} className="bg-gray-50 rounded-xl p-4">
                        <p className="text-gray-500 text-sm">{ROTULOS_STATUS[status] || status}</p>
                        <strong className="text-2xl text-gray-800">{total}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        </section>

        <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-800">Exames recentes</h2>
          <p className="text-gray-500 text-sm">
            Exames usados para compor os indicadores do painel.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-3 py-3 font-semibold rounded-l-xl">Data</th>
                  <th className="text-left px-3 py-3 font-semibold">Paciente</th>
                  <th className="text-left px-3 py-3 font-semibold">Clínica</th>
                  <th className="text-left px-3 py-3 font-semibold">Tipo</th>
                  <th className="text-left px-3 py-3 font-semibold">Médico</th>
                  <th className="text-left px-3 py-3 font-semibold rounded-r-xl">Status</th>
                </tr>
              </thead>
              <tbody>
                {examesRecentes.map((exame) => (
                  <tr key={exame.id} className="border-b border-gray-100">
                    <td className="px-3 py-3 text-gray-600">
                      {formatarData(exame.data)} as {exame.horario}
                    </td>
                    <td className="px-3 py-3 font-semibold text-gray-800">{exame.paciente}</td>
                    <td className="px-3 py-3 text-gray-600">
                      {exame.clinica || "Sem clínica"}
                    </td>
                    <td className="px-3 py-3 text-gray-600">{exame.tipo}</td>
                    <td className="px-3 py-3 text-gray-600">{exame.medico || "-"}</td>
                    <td className="px-3 py-3">
                      <span className="bg-blue-50 text-blue-700 text-xs px-3 py-1 rounded-full font-semibold">
                        {ROTULOS_STATUS[exame.status] || exame.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {examesRecentes.length === 0 && (
              <p className="px-3 py-4 text-sm text-gray-500">
                Nenhum exame recente encontrado.
              </p>
            )}
          </div>
        </section>

        <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Consultas recentes</h2>
            <p className="text-gray-500 text-sm">
              Registro usado para compor os indicadores do painel.
            </p>
            <label className="mt-3 block w-full md:w-80">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Clinica
              </span>
              <select
                value={clinicaConsultasRecentes}
                onChange={(evento) => setClinicaConsultasRecentes(evento.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="">Todas as clínicas</option>
                {clinicasDisponiveis.map((clinica) => (
                  <option key={clinica.id} value={clinica.id}>
                    {clinica.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-3 py-3 font-semibold rounded-l-xl">Data</th>
                  <th className="text-left px-3 py-3 font-semibold">Paciente</th>
                  <th className="text-left px-3 py-3 font-semibold">Clínica</th>
                  <th className="text-left px-3 py-3 font-semibold">Especialidade</th>
                  <th className="text-left px-3 py-3 font-semibold">Médico</th>
                  <th className="text-left px-3 py-3 font-semibold rounded-r-xl">Status</th>
                </tr>
              </thead>
              <tbody>
                {consultasRecentesFiltradas.map((consulta) => (
                  <tr key={consulta.id} className="border-b border-gray-100">
                    <td className="px-3 py-3 text-gray-600">
                      {formatarData(consulta.data)} as {consulta.horario}
                    </td>
                    <td className="px-3 py-3 font-semibold text-gray-800">{consulta.paciente}</td>
                    <td className="px-3 py-3 text-gray-600">
                      {consulta.clinica || "Sem clínica"}
                    </td>
                    <td className="px-3 py-3 text-gray-600">{consulta.especialidade}</td>
                    <td className="px-3 py-3 text-gray-600">{consulta.medico}</td>
                    <td className="px-3 py-3">
                      <span className="bg-blue-50 text-blue-700 text-xs px-3 py-1 rounded-full font-semibold">
                        {ROTULOS_STATUS[consulta.status] || consulta.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {consultasRecentesFiltradas.length === 0 && (
              <p className="px-3 py-4 text-sm text-gray-500">
                Nenhuma consulta recente encontrada para a clínica selecionada.
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default AdminRelatoriosSistema;
