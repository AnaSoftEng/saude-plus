
// ROTAS DO SISTEMA 
// Define todos os caminhos de navegação da aplicação
// Inclui proteção por nível de acesso


import React, { Suspense, lazy, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";

// --- Importação das Telas ---
const Login = lazy(() => import("../../presentation/pages/login"));
const CadastroPaciente = lazy(() => import("../../presentation/pages/cadastro-paciente"));
const HomePaciente = lazy(() => import("../../presentation/pages/home-paciente"));
const HomeMaster = lazy(() => import("../../presentation/pages/home-master"));
const HomeAdmin = lazy(() => import("../../presentation/pages/home-admin"));
const HomeMedico = lazy(() => import("../../presentation/pages/home-medico"));
const MedicoConsultasClinica = lazy(() =>
  import("../../presentation/pages/medico-consultas-clinica")
);
const MedicoExamesClinica = lazy(() =>
  import("../../presentation/pages/medico-exames-clinica")
);
const AgendarConsulta = lazy(() => import("../../presentation/pages/agendar-consulta"));
const AgendarExame = lazy(() => import("../../presentation/pages/agendar-exame"));
const AdminConsultasClinica = lazy(() =>
  import("../../presentation/pages/admin-consultas-clinica")
);
const AdminExamesClinica = lazy(() =>
  import("../../presentation/pages/admin-exames-clinica")
);
const PacienteConsultas = lazy(() => import("../../presentation/pages/paciente-consultas"));
const PacienteDownloads = lazy(() => import("../../presentation/pages/paciente-downloads"));
const PacienteExames = lazy(() => import("../../presentation/pages/paciente-exames"));
const PacienteHistorico = lazy(() => import("../../presentation/pages/paciente-historico"));
const PacientePerfil = lazy(() => import("../../presentation/pages/paciente-perfil"));
const PacienteClinicaDetalhes = lazy(() =>
  import("../../presentation/pages/paciente-clinica-detalhes")
);
const AdminGerenciarClinicas = lazy(() =>
  import("../../presentation/pages/admin-gerenciar-clinicas")
);
const AdminGerenciarUsuarios = lazy(() =>
  import("../../presentation/pages/admin-gerenciar-usuarios")
);
const AdminRelatoriosSistema = lazy(() =>
  import("../../presentation/pages/admin-relatorios-sistema")
);
import ModalNotificacoes from "../../presentation/components/modal-notificacoes";

// --- Importação da lógica de autenticação ---
import { estaAutenticado, temPermissao } from "../../application/auth/auth-service";
import {
  deveExibirModalNotificacoes,
  inicializarNotificacoesPermitidas,
} from "../../infrastructure/pwa/push-notifications";

/**
 * Componente de Rota Protegida
 * Redireciona para login se o usuário não estiver autenticado
 * @param {string} nivelNecessario - Nível mínimo de acesso (opcional)
 */
function RotaProtegida({ children, nivelNecessario }) {
  const autenticado = estaAutenticado();
  const [exibirModalNotificacoes, setExibirModalNotificacoes] = useState(false);

  useEffect(() => {
    if (!autenticado) return;

    let ativo = true;

    inicializarNotificacoesPermitidas()
      .catch((erro) => {
        console.warn("Nao foi possivel inicializar notificacoes:", erro.message);
      })
      .finally(() => {
        if (ativo) {
          setExibirModalNotificacoes(deveExibirModalNotificacoes());
        }
      });

    return () => {
      ativo = false;
    };
  }, [autenticado]);

  // Se não estiver logado, vai para o login
  if (!autenticado) {
    return <Navigate to="/login" replace />;
  }

  // Se exige um nível específico e o usuário não tem, bloqueia
  if (nivelNecessario && !temPermissao(nivelNecessario)) {
    return <Navigate to="/sem-permissao" replace />;
  }

  return (
    <>
      {children}
      <ModalNotificacoes
        aberto={exibirModalNotificacoes}
        aoFechar={() => setExibirModalNotificacoes(false)}
      />
    </>
  );
}

/**
 * Componente principal de rotas do Saúde+
 * Organiza todos os caminhos da aplicação
 */
function CarregandoRota() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <p className="text-sm font-semibold text-gray-500">Carregando...</p>
    </div>
  );
}

function RotasPrincipais() {
  return (
    <BrowserRouter>
      <Suspense fallback={<CarregandoRota />}>
        <Routes>
        {/* Rota pública — Tela de Login */}
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<CadastroPaciente />} />

        {/* Rota padrão — redireciona para login */}
        <Route path="/" element={<Navigate to="/login" replace />} />


        {/* ROTAS DO PACIENTE                          */}

        <Route
          path="/paciente/inicio"
          element={
            <RotaProtegida nivelNecessario="paciente">
              <HomePaciente />
            </RotaProtegida>
          }
        />
        <Route
          path="/paciente/agendar"
          element={
            <RotaProtegida nivelNecessario="paciente">
              <AgendarConsulta />
            </RotaProtegida>
          }
        />
        <Route
          path="/paciente/agendar-exame"
          element={
            <RotaProtegida nivelNecessario="paciente">
              <AgendarExame />
            </RotaProtegida>
          }
        />
        <Route
          path="/paciente/consultas"
          element={
            <RotaProtegida nivelNecessario="paciente">
              <PacienteConsultas />
            </RotaProtegida>
          }
        />
        <Route
          path="/paciente/exames"
          element={
            <RotaProtegida nivelNecessario="paciente">
              <PacienteExames />
            </RotaProtegida>
          }
        />
        <Route
          path="/paciente/clinicas/:id"
          element={
            <RotaProtegida nivelNecessario="paciente">
              <PacienteClinicaDetalhes />
            </RotaProtegida>
          }
        />
        <Route
          path="/paciente/historico"
          element={
            <RotaProtegida nivelNecessario="paciente">
              <PacienteHistorico />
            </RotaProtegida>
          }
        />
        <Route
          path="/paciente/downloads"
          element={
            <RotaProtegida nivelNecessario="paciente">
              <PacienteDownloads />
            </RotaProtegida>
          }
        />
        <Route
          path="/paciente/perfil"
          element={
            <RotaProtegida nivelNecessario="paciente">
              <PacientePerfil />
            </RotaProtegida>
          }
        />

        {/* ROTAS DO MÉDICO (RN2: apenas sua clínica)  */}

        <Route
          path="/medico/inicio"
          element={<Navigate to="/medico/agenda" replace />}
        />
        <Route
          path="/medico/agenda"
          element={
            <RotaProtegida nivelNecessario="medico">
              {/* TODO: <HomeMedico /> */}
              <HomeMedico />
            </RotaProtegida>
          }
        />
        <Route
          path="/medico/consultas"
          element={
            <RotaProtegida nivelNecessario="medico">
              <MedicoConsultasClinica />
            </RotaProtegida>
          }
        />
        <Route
          path="/medico/exames"
          element={
            <RotaProtegida nivelNecessario="medico">
              <MedicoExamesClinica />
            </RotaProtegida>
          }
        />

        {/* ROTAS DO ADMIN (Clínica e Master)          */}
   
        <Route
          path="/admin/painel"
          element={
            <RotaProtegida nivelNecessario="admin_clinica">
              {/* TODO: <HomeAdmin /> */}
              <HomeAdmin />
            </RotaProtegida>
          }
        />
        <Route
          path="/admin/painel/consultas"
          element={
            <RotaProtegida nivelNecessario="admin_clinica">
              <AdminConsultasClinica />
            </RotaProtegida>
          }
        />
        <Route
          path="/admin/painel/exames"
          element={
            <RotaProtegida nivelNecessario="admin_clinica">
              <AdminExamesClinica />
            </RotaProtegida>
          }
        />
        
        {/*Admin master (prefeitura)*/}
        <Route
          path="/admin/master"
          element={
            <RotaProtegida nivelNecessario="admin_master">
              <HomeMaster />
            </RotaProtegida>
          }
        />
        <Route
          path="/admin/master/clinicas"
          element={
            <RotaProtegida nivelNecessario="admin_master">
              <AdminGerenciarClinicas />
            </RotaProtegida>
          }
        />
        <Route
          path="/admin/master/usuarios"
          element={
            <RotaProtegida nivelNecessario="admin_master">
              <AdminGerenciarUsuarios />
            </RotaProtegida>
          }
        />
        <Route
          path="/admin/master/relatorios"
          element={
            <RotaProtegida nivelNecessario="admin_master">
              <AdminRelatoriosSistema />
            </RotaProtegida>
          }
        />
        
        {/* Rota de acesso negado */}
        <Route
          path="/sem-permissao"
          element={
            <div className="flex items-center justify-center h-screen">
              <p className="text-red-500 text-lg">
                Você não tem permissão para acessar esta página.
              </p>
            </div>
          }
        />

        {/* Rota 404 — página não encontrada */}
        <Route
          path="*"
          element={
            <div className="flex items-center justify-center h-screen">
              <p className="text-gray-500 text-lg">
                Página não encontrada.
              </p>
            </div>
          }
        />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default RotasPrincipais;
