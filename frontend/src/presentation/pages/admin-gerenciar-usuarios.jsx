import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ouvirClinicasAtualizadas } from "../../application/clinicas/clinicas-eventos";
import { listarClinicas } from "../../application/clinicas/clinicas-use-cases";
import {
  alternarStatusUsuario,
  listarUsuarios,
  salvarUsuario as salvarUsuarioApi,
} from "../../application/usuarios/usuarios-use-cases";
import { ouvirUsuariosAtualizados } from "../../application/usuarios/usuarios-eventos";
import CabecalhoApp from "../components/cabecalho-app";

const ROTULOS_NIVEIS = {
  admin_master: "Admin master",
  admin_clinica: "Admin da clínica",
  medico: "Médico",
  paciente: "Paciente",
};

const USUARIO_INICIAL = {
  nome: "",
  email: "",
  senha: "",
  nivel_acesso: "paciente",
  clinica_id: "",
  status: "ativo",
};

function AdminGerenciarUsuarios() {
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState([]);
  const [clinicas, setClinicas] = useState([]);
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroNivel, setFiltroNivel] = useState("todos");
  const [formulario, setFormulario] = useState(USUARIO_INICIAL);
  const [usuarioEditandoId, setUsuarioEditandoId] = useState(null);
  const [mensagem, setMensagem] = useState("");

  async function carregarClinicas() {
    try {
      setClinicas(await listarClinicas());
    } catch (erro) {
      setMensagem(erro.message || "Não conseguimos carregar as clínicas agora.");
    }
  }

  async function carregarDados() {
    setMensagem("");
    try {
      const [usuariosApi, clinicasApi] = await Promise.all([
        listarUsuarios(),
        listarClinicas(),
      ]);
      setUsuarios(usuariosApi);
      setClinicas(clinicasApi);
    } catch (erro) {
      setMensagem(erro.message || "Não conseguimos carregar os dados agora.");
    }
  }

  useEffect(() => {
    carregarDados();
  }, []);

  useEffect(() => ouvirClinicasAtualizadas(carregarClinicas), []);
  useEffect(() => ouvirUsuariosAtualizados(carregarDados), []);

  useEffect(() => {
    function aoVoltarParaTela() {
      if (document.visibilityState === "visible") {
        carregarClinicas();
      }
    }

    document.addEventListener("visibilitychange", aoVoltarParaTela);
    window.addEventListener("focus", carregarClinicas);

    return () => {
      document.removeEventListener("visibilitychange", aoVoltarParaTela);
      window.removeEventListener("focus", carregarClinicas);
    };
  }, []);

  const usuariosFiltrados = useMemo(() => {
    const termo = filtroTexto.trim().toLowerCase();
    return usuarios.filter((usuario) => {
      const passaTexto =
        !termo ||
        usuario.nome.toLowerCase().includes(termo) ||
        usuario.email.toLowerCase().includes(termo);
      const passaNivel = filtroNivel === "todos" || usuario.nivel_acesso === filtroNivel;
      return passaTexto && passaNivel;
    });
  }, [usuarios, filtroTexto, filtroNivel]);

  const resumo = useMemo(() => {
    return usuarios.reduce(
      (acc, usuario) => {
        acc.total += 1;
        if (usuario.status === "ativo") acc.ativos += 1;
        acc.porNivel[usuario.nivel_acesso] = (acc.porNivel[usuario.nivel_acesso] || 0) + 1;
        return acc;
      },
      { total: 0, ativos: 0, porNivel: {} }
    );
  }, [usuarios]);

  function alterarCampo(campo, valor) {
    setFormulario((atual) => ({ ...atual, [campo]: valor }));
  }

  function limparFormulario() {
    setFormulario(USUARIO_INICIAL);
    setUsuarioEditandoId(null);
  }

  async function salvarUsuario(evento) {
    evento.preventDefault();
    setMensagem("");

    if (!formulario.nome.trim() || !formulario.email.trim()) {
      setMensagem("Digite nome e e-mail para salvar o usuário.");
      return;
    }

    if (!usuarioEditandoId && formulario.senha.length < 8) {
      setMensagem("Use uma senha inicial com pelo menos 8 caracteres.");
      return;
    }

    const clinicaId = formulario.clinica_id ? Number(formulario.clinica_id) : null;

    try {
      await salvarUsuarioApi({
        id: usuarioEditandoId,
        nome: formulario.nome.trim(),
        email: formulario.email.trim(),
        nivel_acesso: formulario.nivel_acesso,
        clinica_id: clinicaId,
        status: formulario.status,
        ...(formulario.senha ? { senha: formulario.senha } : {}),
      });
      setMensagem(usuarioEditandoId ? "Usuário atualizado com sucesso." : "Usuário criado com sucesso.");
      limparFormulario();
      await carregarDados();
    } catch (erro) {
      setMensagem(erro.message || "Não conseguimos salvar o usuário agora.");
    }
  }

  function editarUsuario(usuario) {
    setUsuarioEditandoId(usuario.id);
    setFormulario({
      nome: usuario.nome,
      email: usuario.email,
      senha: "",
      nivel_acesso: usuario.nivel_acesso,
      clinica_id: usuario.clinica_id || "",
      status: usuario.status,
    });
    setMensagem("");
  }

  async function alternarStatus(usuarioId) {
    const usuario = usuarios.find((item) => item.id === usuarioId);
    if (!usuario) return;

    try {
      await alternarStatusUsuario(usuario);
      await carregarDados();
    } catch (erro) {
      setMensagem(erro.message || "Não conseguimos alterar o status agora.");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CabecalhoApp
        compacto
        aoVoltar={() => navigate("/admin/master")}
        textoVoltar="Voltar ao painel"
        voltarSomenteIcone
        titulo="Gerenciar usuários"
        descricao="Gerencie o acesso de pacientes, médicos, administradores de clínica e equipe da prefeitura."
      />

      <main className="app-content space-y-5">
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-gray-500 text-sm">Usuários</p>
            <strong className="text-3xl text-gray-800">{resumo.total}</strong>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-gray-500 text-sm">Ativos</p>
            <strong className="text-3xl text-gray-800">{resumo.ativos}</strong>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-gray-500 text-sm">Médicos</p>
            <strong className="text-3xl text-gray-800">{resumo.porNivel.medico || 0}</strong>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-gray-500 text-sm">Admins</p>
            <strong className="text-3xl text-gray-800">
              {(resumo.porNivel.admin_master || 0) + (resumo.porNivel.admin_clinica || 0)}
            </strong>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5">
          <form
            onSubmit={salvarUsuario}
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3"
          >
            <div>
              <h2 className="text-xl font-semibold text-gray-800">
                {usuarioEditandoId ? "Editar acesso" : "Novo usuário"}
              </h2>
              <p className="text-gray-500 text-sm">
                Defina o nível de permissão e o vínculo com a clínica.
              </p>
            </div>

            <input
              value={formulario.nome}
              onChange={(evento) => alterarCampo("nome", evento.target.value)}
              placeholder="Nome completo"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <input
              type="email"
              value={formulario.email}
              onChange={(evento) => alterarCampo("email", evento.target.value)}
              placeholder="E-mail de acesso"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <input
              type="password"
              value={formulario.senha}
              onChange={(evento) => alterarCampo("senha", evento.target.value)}
              placeholder={
                usuarioEditandoId
                  ? "Nova senha (opcional)"
                  : "Senha inicial (minimo de 8 caracteres)"
              }
              autoComplete="new-password"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <select
              value={formulario.nivel_acesso}
              onChange={(evento) => alterarCampo("nivel_acesso", evento.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              {Object.entries(ROTULOS_NIVEIS).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </select>
            <select
              value={formulario.clinica_id}
              onChange={(evento) => alterarCampo("clinica_id", evento.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="">Sem clínica vinculada</option>
              {clinicas.map((clinica) => (
                <option key={clinica.id} value={clinica.id}>
                  {clinica.nome}
                </option>
              ))}
            </select>
            <select
              value={formulario.status}
              onChange={(evento) => alterarCampo("status", evento.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="ativo">Ativo</option>
              <option value="bloqueado">Bloqueado</option>
            </select>

            {mensagem && (
              <p className="text-sm text-blue-600 bg-blue-50 rounded-xl px-4 py-3">
                {mensagem}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-blue-400 text-white rounded-xl py-3 font-semibold hover:bg-blue-500 transition"
              >
                {usuarioEditandoId ? "Salvar edição" : "Criar usuário"}
              </button>
              {usuarioEditandoId && (
                <button
                  type="button"
                  onClick={limparFormulario}
                  className="px-4 py-3 rounded-xl bg-gray-100 text-gray-700 font-semibold"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>

          <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">Acessos cadastrados</h2>
                <p className="text-gray-500 text-sm">
                  {usuariosFiltrados.length} usuário(s) encontrado(s).
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={filtroTexto}
                  onChange={(evento) => setFiltroTexto(evento.target.value)}
                  placeholder="Buscar por nome ou e-mail"
                  className="border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <select
                  value={filtroNivel}
                  onChange={(evento) => setFiltroNivel(evento.target.value)}
                  className="border border-gray-200 rounded-xl px-4 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="todos">Todos</option>
                  {Object.entries(ROTULOS_NIVEIS).map(([valor, rotulo]) => (
                    <option key={valor} value={valor}>
                      {rotulo}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left px-3 py-3 font-semibold rounded-l-xl">Usuário</th>
                    <th className="text-left px-3 py-3 font-semibold">Nível</th>
                    <th className="text-left px-3 py-3 font-semibold">Clínica</th>
                    <th className="text-left px-3 py-3 font-semibold">Último acesso</th>
                    <th className="text-left px-3 py-3 font-semibold">Status</th>
                    <th className="text-right px-3 py-3 font-semibold rounded-r-xl">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosFiltrados.map((usuario) => (
                    <tr key={usuario.id} className="border-b border-gray-100">
                      <td className="px-3 py-3">
                        <p className="font-semibold text-gray-800">{usuario.nome}</p>
                        <p className="text-gray-500">{usuario.email}</p>
                      </td>
                      <td className="px-3 py-3 text-gray-600">
                        {ROTULOS_NIVEIS[usuario.nivel_acesso]}
                      </td>
                      <td className="px-3 py-3 text-gray-600">
                        {usuario.clinica_id
                          ? clinicas.find((clinica) => Number(clinica.id) === Number(usuario.clinica_id))?.nome || "Sem vínculo"
                          : "Sem vínculo"}
                      </td>
                      <td className="px-3 py-3 text-gray-500">{usuario.ultimo_acesso}</td>
                      <td className="px-3 py-3">
                        <span
                          className={`text-xs px-3 py-1 rounded-full font-semibold ${
                            usuario.status === "ativo"
                              ? "bg-green-50 text-green-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {usuario.status === "ativo" ? "Ativo" : "Bloqueado"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => editarUsuario(usuario)}
                          className="text-blue-600 font-semibold mr-3"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => alternarStatus(usuario.id)}
                          className="text-gray-600 font-semibold"
                        >
                          {usuario.status === "ativo" ? "Bloquear" : "Ativar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}

export default AdminGerenciarUsuarios;
