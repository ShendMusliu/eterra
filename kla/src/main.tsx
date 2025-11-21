// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/fonts.css";
import "./lib/i18n";
import App from "./App.tsx";
import "./index.css";
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";
import "@aws-amplify/ui-react/styles.css";

Amplify.configure(outputs);

if (import.meta.env.DEV) {
  import("aws-amplify/auth").then(({ fetchAuthSession }) => {
    (window as typeof window & { debugFetchAuthSession?: typeof fetchAuthSession }).debugFetchAuthSession =
      fetchAuthSession;
  });
}


ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
