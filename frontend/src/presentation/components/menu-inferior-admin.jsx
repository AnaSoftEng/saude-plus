import React from "react";
import { CalendarDays, LayoutDashboard, TestTube2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router";

const ABAS_MENU = [
  {
    chave: "inicio",
    label: "Inicio",
    rota: "/admin/painel",
    Icone: LayoutDashboard,
  },
  {
    chave: "consultas",
    label: "Consultas",
    rota: "/admin/painel/consultas",
    Icone: CalendarDays,
  },
  {
    chave: "exames",
    label: "Exames",
    rota: "/admin/painel/exames",
    Icone: TestTube2,
  },
];

function MenuInferiorAdmin({ abaAtiva }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-100 bg-white/95 shadow-lg backdrop-blur safe-bottom-nav">
      <div className="mx-auto grid max-w-2xl grid-cols-3 gap-2 px-3 pt-2 sm:px-4">
        {ABAS_MENU.map((aba) => {
          const ativa = abaAtiva ? abaAtiva === aba.chave : location.pathname === aba.rota;
          const Icone = aba.Icone;

          return (
            <button
              key={aba.chave}
              type="button"
              onClick={() => navigate(aba.rota)}
              className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold transition sm:text-sm ${
                ativa
                  ? "bg-blue-50 text-blue-500"
                  : "text-gray-400 hover:bg-gray-50 hover:text-blue-500"
              }`}
              aria-current={ativa ? "page" : undefined}
            >
              <Icone
                className="h-5 w-5"
                strokeWidth={ativa ? 2.5 : 2}
                aria-hidden="true"
              />
              <span className="block max-w-full truncate">{aba.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default MenuInferiorAdmin;
