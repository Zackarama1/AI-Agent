import "./index.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import App from "./App";

const queryClient = new QueryClient({
  defaultOptions: {
    // iPad Safari suspends background tabs; refetch when the app comes back.
    queries: { refetchOnWindowFocus: true, refetchOnReconnect: true },
  },
});

registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
