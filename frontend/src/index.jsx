import React from "react";
import ReactDOM from "react-dom/client";

import "./index.css";

import App from "./app/App";
import { registrarServiceWorkerAoCarregar } from "./infrastructure/pwa/service-worker";

const root = ReactDOM.createRoot(document.getElementById("root"));

registrarServiceWorkerAoCarregar();

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
