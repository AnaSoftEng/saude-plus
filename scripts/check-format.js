const fs = require("fs");
const path = require("path");

const EXTENSOES = new Set([".js", ".jsx", ".json", ".md", ".css", ".html"]);
const IGNORAR = new Set([
  ".git",
  ".tmp-chrome-favicon",
  ".tmp-icon-render",
  "node_modules",
  "node_modules.offline-backup",
  "build",
  "coverage",
  "data",
]);

function listarArquivos(dir, acumulado = []) {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORAR.has(entrada.name)) continue;

    const caminho = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      listarArquivos(caminho, acumulado);
    } else if (EXTENSOES.has(path.extname(entrada.name))) {
      acumulado.push(caminho);
    }
  }

  return acumulado;
}

const problemas = [];

for (const arquivo of listarArquivos(process.cwd())) {
  const conteudo = fs.readFileSync(arquivo, "utf8");
  if (!conteudo.endsWith("\n")) {
    problemas.push(`${arquivo}: arquivo deve terminar com quebra de linha`);
  }

  conteudo.split(/\n/).forEach((linha, indice) => {
    if (/[ \t]$/.test(linha)) {
      problemas.push(`${arquivo}:${indice + 1}: espaco em branco no fim da linha`);
    }
  });
}

if (problemas.length > 0) {
  console.error(problemas.join("\n"));
  process.exit(1);
}

console.log("Formatacao basica OK. Use Prettier com .prettierrc antes de revisar PRs.");
