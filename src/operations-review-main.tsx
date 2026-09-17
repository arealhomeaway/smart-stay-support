import React from "react";
import { createRoot } from "react-dom/client";
import { OperationsSandbox } from "./components/operations/OperationsSandbox";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Review mount is missing.");
createRoot(root).render(
  <React.StrictMode>
    <main className="mx-auto max-w-7xl px-4 py-6">
      <OperationsSandbox />
    </main>
  </React.StrictMode>,
);
