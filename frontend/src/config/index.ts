import { cookieStorage, createStorage } from "wagmi";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { monad } from "@reown/appkit/networks";
import type { AppKitNetwork } from "@reown/appkit/networks";

// Reown AppKit Project ID — get yours at https://dashboard.reown.com
// NEVER commit a real project ID. Use .env.local
export const projectId = process.env.NEXT_PUBLIC_PROJECT_ID ?? "";

if (!projectId) {
  console.warn(
    "⚠️  NEXT_PUBLIC_PROJECT_ID is not set. Wallet connect will not work. " +
      "Get a project ID at https://dashboard.reown.com"
  );
}

// Networks
export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [monad];

// Wagmi adapter for Reown AppKit
export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  projectId,
  networks,
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;
