const fs = require("fs");
const http = require("http");
const path = require("path");

const port = Number(process.env.FRONTEND_PORT || process.env.PORT || 3000);
const apiTarget = new URL(process.env.REACT_APP_BACKEND_URL || "http://localhost:3333");
const buildDir = path.resolve(__dirname, "../frontend/build");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function proxyApi(req, res) {
  const target = new URL(req.url, apiTarget);
  const proxyReq = http.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      method: req.method,
      path: `${target.pathname}${target.search}`,
      headers: {
        ...req.headers,
        host: apiTarget.host,
      },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on("error", () => {
    send(res, 502, JSON.stringify({ mensagem: "Backend indisponivel." }), {
      "content-type": "application/json; charset=utf-8",
    });
  });

  req.pipe(proxyReq);
}

function resolveStaticPath(reqUrl) {
  const url = new URL(reqUrl, `http://localhost:${port}`);
  const decodedPath = decodeURIComponent(url.pathname);
  const requested = decodedPath === "/" ? "/index.html" : decodedPath;
  const filePath = path.resolve(buildDir, `.${requested}`);

  if (!filePath.startsWith(buildDir)) {
    return null;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return filePath;
  }

  return path.join(buildDir, "index.html");
}

const server = http.createServer((req, res) => {
  if (req.url && req.url.startsWith("/api/")) {
    proxyApi(req, res);
    return;
  }

  const filePath = resolveStaticPath(req.url || "/");
  if (!filePath) {
    send(res, 403, "Forbidden", { "content-type": "text/plain; charset=utf-8" });
    return;
  }

  fs.createReadStream(filePath)
    .on("error", () => {
      send(res, 404, "Not found", { "content-type": "text/plain; charset=utf-8" });
    })
    .on("open", () => {
      res.writeHead(200, {
        "content-type": contentTypes[path.extname(filePath)] || "application/octet-stream",
        "cache-control": filePath.endsWith("index.html") ? "no-store" : "public, max-age=31536000",
      });
    })
    .pipe(res);
});

server.listen(port, () => {
  console.log(`Frontend Saude+ ouvindo em http://localhost:${port}`);
});
