import type { Metadata } from "next";
import { headers } from "next/headers";
import { cookieToInitialState } from "wagmi";
import { wagmiAdapter } from "@/config";
import AppKitProvider from "@/context/AppKitProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ectoplasma — Yield-Funded Subscriptions on Monad",
  description:
    "Deposit aprMON, earn staking yield, and pay subscriptions from yield only. Your principal stays untouched.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const reqHeaders = await headers();
  const initialState = cookieToInitialState(
    wagmiAdapter.wagmiConfig,
    reqHeaders.get("cookie")
  );

  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <AppKitProvider initialState={initialState}>
          {children}
        </AppKitProvider>
      </body>
    </html>
  );
}
