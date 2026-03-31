"use client";

import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { WagmiProvider, type State } from "wagmi";
import { wagmiAdapter, projectId, networks } from "@/config";

const queryClient = new QueryClient();

const metadata = {
  name: "Ectoplasma",
  description: "Yield-funded subscription vault on Monad",
  url: typeof window !== "undefined" ? window.location.origin : "",
  icons: ["/logos/ectoplasma-logo.png"],
};

if (projectId) {
  createAppKit({
    adapters: [wagmiAdapter],
    projectId,
    networks,
    metadata,
    features: {
      analytics: false,
    },
  });
}

export default function AppKitProvider({
  children,
  initialState,
}: {
  children: ReactNode;
  initialState?: State;
}) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig} initialState={initialState}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
