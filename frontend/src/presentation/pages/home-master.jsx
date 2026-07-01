import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarDays,
  LogOut,
  Percent,
  UserCircle,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router";
import {
  RELATORIO_VAZIO,
  obterRelatoriosSistema,
} from "../../application/sistema/relatorios-use-cases";
import { realizarLogout } from "../../application/auth/auth-service";
import { ouvirConsultasAtualizadas } from "../../application/agenda/consultas-eventos";
import { ouvirClinicasAtualizadas } from "../../application/clinicas/clinicas-eventos";
import { ouvirExamesAtualizados } from "../../application/exames/exames-eventos";
import { ouvirUsuariosAtualizados } from "../../application/usuarios/usuarios-eventos";
import CabecalhoApp from "../components/cabecalho-app";

const CARTOES_ADMIN = [
  {
    titulo: "Clínicas",
    descricao: "Gerenciar unidades de saúde",
    rota: "/admin/master/clinicas",
    detalhe: "Cadastro, status e capacidade",
    Icone: Building2,
  },
  {
    titulo: "Usuários",
    descricao: "Gerenciar acessos",
    rota: "/admin/master/usuarios",
    detalhe: "Perfis, bloqueios e vinculos",
    Icone: Users,
  },
  {
    titulo: "Relatorios",
    descricao: "Visualizar dados gerais",
    rota: "/admin/master/relatorios",
    detalhe: "Consultas, ocupacao e resultados",
    Icone: BarChart3,
  },
];

function HomeMaster() {
  const navigate = useNavigate();
  const [resumo, setResumo] = useState(RELATORIO_VAZIO.resumo);
  const [menuUsuarioAberto, setMenuUsuarioAberto] = useState(false);
  const tempoFechamentoMenuRef = useRef(null);

  async function carregarResumo() {
    try {
      const relatorio = await obterRelatoriosSistema();
      setResumo(relatorio.resumo);
    } catch {
      setResumo(RELATORIO_VAZIO.resumo);
    }
  }

  useEffect(() => {
    carregarResumo();
  }, []);

  useEffect(() => ouvirClinicasAtualizadas(carregarResumo), []);
  useEffect(() => ouvirConsultasAtualizadas(carregarResumo), []);
  useEffect(() => ouvirExamesAtualizados(carregarResumo), []);
  useEffect(() => ouvirUsuariosAtualizados(carregarResumo), []);

  useEffect(() => {
    return () => {
      if (tempoFechamentoMenuRef.current) {
        clearTimeout(tempoFechamentoMenuRef.current);
      }
    };
  }, []);

  function cancelarFechamentoDoMenu() {
    if (tempoFechamentoMenuRef.current) {
      clearTimeout(tempoFechamentoMenuRef.current);
      tempoFechamentoMenuRef.current = null;
    }
  }

  function sairDaConta() {
    cancelarFechamentoDoMenu();
    setMenuUsuarioAberto(false);
    realizarLogout();
  }

  function fecharMenuAoSairDoHover() {
    cancelarFechamentoDoMenu();
    tempoFechamentoMenuRef.current = setTimeout(() => {
      setMenuUsuarioAberto(false);
    }, 350);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CabecalhoApp
        titulo="Painel Admin Master"
        descricao="Gerenciamento central das clínicas, usuários e indicadores do Saúde+."
        acao={
          <div
            className="relative z-30"
            onMouseEnter={cancelarFechamentoDoMenu}
            onMouseLeave={fecharMenuAoSairDoHover}
          >
            <button
              type="button"
              onClick={() => setMenuUsuarioAberto((v) => !v)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30"
              aria-label="Perfil do usuário"
            >
              <UserCircle className="h-6 w-6" aria-hidden="true" />
            </button>
            {menuUsuarioAberto && (
              <div className="absolute right-0 z-40 mt-4 w-56 overflow-hidden rounded-2xl border border-blue-100/80 bg-white shadow-xl shadow-blue-950/10 ring-1 ring-black/5 sm:right-1/2 sm:translate-x-1/2">
                <div className="border-b border-gray-100 bg-blue-50/70 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-500">
                    Conta
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-gray-800">
                    Opções do usuário
                  </p>
                </div>
                <button
                  type="button"
                  onClick={sairDaConta}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-red-500 transition hover:bg-red-50"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-500">
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span>Sair</span>
                </button>
              </div>
            )}
          </div>
        }
      />

      <main className="app-content dashboard-shell">
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="dashboard-metric">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm text-gray-500">Clínicas ativas</p>
              <Building2 className="h-5 w-5 text-blue-400" aria-hidden="true" />
            </div>
            <strong className="text-3xl text-gray-800">{resumo.clinicasAtivas}</strong>
          </div>
          <div className="dashboard-metric">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm text-gray-500">Usuários ativos</p>
              <Users className="h-5 w-5 text-blue-400" aria-hidden="true" />
            </div>
            <strong className="text-3xl text-gray-800">{resumo.usuariosAtivos}</strong>
          </div>
          <div className="dashboard-metric">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm text-gray-500">Agendamentos no mes</p>
              <CalendarDays className="h-5 w-5 text-blue-400" aria-hidden="true" />
            </div>
            <strong className="text-3xl text-gray-800">
              {resumo.agendamentosMes || resumo.consultasMes}
            </strong>
          </div>
          <div className="dashboard-metric">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-gray-500 text-sm">Cancelamentos</p>
              <Percent className="h-5 w-5 text-amber-500" aria-hidden="true" />
            </div>
            <strong className="text-3xl text-gray-800">{resumo.taxaCancelamento}%</strong>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {CARTOES_ADMIN.map((cartao) => {
            const Icone = cartao.Icone;

            return (
            <button
              key={cartao.rota}
              type="button"
              onClick={() => navigate(cartao.rota)}
              className="dashboard-card group text-left hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-500">
                  <Icone className="h-5 w-5" aria-hidden="true" />
                </div>
                <ArrowRight
                  className="h-5 w-5 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-blue-400"
                  aria-hidden="true"
                />
              </div>
              <p className="text-sm font-semibold text-blue-500">{cartao.detalhe}</p>
              <h2 className="mt-2 text-xl font-semibold text-gray-800">{cartao.titulo}</h2>
              <p className="mt-2 text-sm leading-5 text-gray-500">{cartao.descricao}</p>
            </button>
            );
          })}
        </section>
      </main>
    </div>
  );
}

export default HomeMaster;
