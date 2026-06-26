import { NIVEIS_ACESSO, usuarioTemNivel } from "./niveis-acesso";

test("respeita a hierarquia de niveis de acesso", () => {
  expect(
    usuarioTemNivel({ nivel_acesso: NIVEIS_ACESSO.ADMIN_MASTER }, NIVEIS_ACESSO.ADMIN_CLINICA)
  ).toBe(true);
  expect(
    usuarioTemNivel({ nivel_acesso: NIVEIS_ACESSO.ADMIN_CLINICA }, NIVEIS_ACESSO.MEDICO)
  ).toBe(true);
  expect(
    usuarioTemNivel({ nivel_acesso: NIVEIS_ACESSO.PACIENTE }, NIVEIS_ACESSO.MEDICO)
  ).toBe(false);
});

test("nega permissao quando usuario ou nivel sao invalidos", () => {
  expect(usuarioTemNivel(null, NIVEIS_ACESSO.PACIENTE)).toBe(false);
  expect(usuarioTemNivel({ nivel_acesso: "desconhecido" }, NIVEIS_ACESSO.PACIENTE)).toBe(false);
  expect(usuarioTemNivel({ nivel_acesso: NIVEIS_ACESSO.PACIENTE }, "")).toBe(false);
});
