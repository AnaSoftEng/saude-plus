import React from "react";
import { ArrowLeft } from "lucide-react";

function juntarClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

function CabecalhoApp({
  titulo,
  contexto,
  descricao,
  acao,
  aoVoltar,
  textoVoltar = "Voltar",
  voltarSomenteIcone = false,
  children,
  compacto = false,
  fixo = true,
  className = "",
  tituloClassName = "",
  descricaoClassName = "",
}) {
  const temTexto = contexto || titulo || descricao;
  const temLinhaVoltar = Boolean(aoVoltar);
  const voltarLateral = aoVoltar && voltarSomenteIcone && temTexto;

  return (
    <header
      className={juntarClasses(
        fixo && "sticky top-0 z-10",
        "border-b border-blue-300/40 bg-blue-500 px-4 shadow-sm shadow-blue-950/10 sm:px-6 lg:px-8",
        className
      )}
    >
      <div className="app-header-inner">
        <div
          className={juntarClasses(
            compacto
              ? "flex min-h-[67px] py-2 sm:min-h-[73px] sm:py-3"
              : "flex min-h-[67px] py-2 sm:min-h-[73px] sm:py-3",
            voltarLateral
              ? "items-center gap-3 sm:gap-4"
              : "flex-col justify-center"
          )}
        >
          {aoVoltar && (
            <div
              className={juntarClasses(
                "flex items-start justify-between gap-4",
                voltarLateral ? "shrink-0" : "mb-3"
              )}
            >
              <button
                type="button"
                onClick={aoVoltar}
                aria-label={textoVoltar || "Voltar"}
                className={juntarClasses(
                  "active:opacity-80",
                  voltarSomenteIcone
                    ? "flex h-10 w-10 items-center justify-center rounded-lg bg-white/15 text-white ring-1 ring-white/20 transition hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/60"
                    : "text-sm font-semibold text-white"
                )}
              >
                {voltarSomenteIcone ? (
                  <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                ) : (
                  textoVoltar
                )}
              </button>
              {!voltarLateral && acao}
            </div>
          )}

          {temTexto && (
            <div
              className={juntarClasses(
                voltarLateral && "min-w-0 flex-1",
                ((!aoVoltar && acao) || voltarLateral) &&
                  "flex items-center justify-between gap-4"
              )}
            >
              <div className="flex min-w-0 items-center gap-4 sm:gap-5">
                {!aoVoltar && (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white p-1.5 shadow-sm ring-1 ring-white/60">
                    <img
                      src="/icons/logo-saude-plus.png"
                      alt="Saúde+"
                      className="h-full w-full object-contain"
                    />
                  </div>
                )}

                <div className="min-w-0">
                  {contexto && (
                    <p
                      className={juntarClasses(
                        compacto ? "text-xs" : "text-sm",
                        "font-semibold uppercase tracking-wide text-blue-100"
                      )}
                    >
                      {contexto}
                    </p>
                  )}
                  {titulo && (
                    <h1
                      className={juntarClasses(
                        compacto
                          ? "text-xl font-bold leading-tight text-white sm:text-2xl"
                          : "text-xl font-bold leading-tight text-white sm:text-2xl",
                        tituloClassName
                      )}
                    >
                      {titulo}
                    </h1>
                  )}
                  {descricao && (
                    <p
                      className={juntarClasses(
                        compacto ? "mt-0.5 text-xs text-blue-50" : "mt-1 text-sm text-blue-50",
                        descricaoClassName
                      )}
                    >
                      {descricao}
                    </p>
                  )}
                </div>
              </div>
              {(!aoVoltar || voltarLateral) && acao}
            </div>
          )}

          {!temTexto && !temLinhaVoltar && acao}
        </div>

        {children && <div className="pb-4">{children}</div>}
      </div>
    </header>
  );
}

export default CabecalhoApp;
