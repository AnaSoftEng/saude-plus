import {
  criarEnderecoClinica,
  criarQueryLocalizacaoClinica,
  criarUrlEmbedGoogleMapsPorQuery,
  criarUrlGoogleMapsPorQuery,
  validarGoogleMapsApiKey,
} from "./mapas-api";

test("valida formato de chave publica do Google Maps", () => {
  expect(validarGoogleMapsApiKey("")).toEqual({
    configurada: false,
    formatoValido: false,
  });

  expect(validarGoogleMapsApiKey("mxfVQVA7HkU7i2I0Sbcu_Zy2s6g=")).toEqual({
    configurada: true,
    formatoValido: false,
  });

  expect(validarGoogleMapsApiKey(`AIza${"A".repeat(35)}`)).toEqual({
    configurada: true,
    formatoValido: true,
  });
});

test("monta endereco e url do Google Maps preservando texto original na entrada", () => {
  const endereco = criarEnderecoClinica({
    endereco: "Estrada de Sampaio Corrêa, 100",
    bairro: "Itaúna",
  });

  expect(endereco).toBe("Estrada de Sampaio Corrêa, 100, Itaúna, Saquarema/RJ, Brasil");
  expect(criarUrlGoogleMapsPorQuery(endereco)).toContain(
    "Estrada%20de%20Sampaio%20Corr%C3%AAa%2C%20100"
  );
  expect(criarUrlEmbedGoogleMapsPorQuery(endereco)).toContain("output=embed");
  expect(criarUrlEmbedGoogleMapsPorQuery(endereco)).not.toContain("key=");
});

test("prefere coordenadas validas para apontar a localizacao exata da clinica", () => {
  expect(
    criarQueryLocalizacaoClinica({
      endereco: "Rua Adolfo Bravo, 187",
      bairro: "Bacaxa",
      latitude: -22.9324,
      longitude: -42.4876,
    })
  ).toBe("-22.9324,-42.4876");
});
