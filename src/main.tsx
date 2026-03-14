import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import App from "./App";
import "./index.css";

/**
 * Convex client instance.
 *
 * VITE_CONVEX_URL must be set in .env.local and matches the deployment URL
 * from `npx convex dev`. The client manages the WebSocket connection and
 * caches query results reactively.
 */
const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/*
     * ConvexAuthProvider replaces the standard ConvexProvider.
     * It injects the auth session into every query and mutation so that
     * backend handlers can call `auth.getUserId(ctx)` to identify the caller.
     */}
    <ConvexAuthProvider client={convex}>
      <App />
    </ConvexAuthProvider>
  </React.StrictMode>
);
