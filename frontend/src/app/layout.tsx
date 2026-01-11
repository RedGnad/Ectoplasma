import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ectoplasma dApp",
  description: "Stake-to-subscribe vault on the Casper Network.",
  icons: {
    icon: "/logos/ectoplasma-logo.png.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="icon"
          type="image/png"
          href="/logos/ectoplasma-logo.png.png"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Script id="csprclick-init" strategy="afterInteractive">
          {`
            const clickUIOptions = {
              uiContainer: 'csprclick-ui',
              rootAppElement: '#app',
              // Hide the default CSPR.click top bar; we use our own header UI.
              showTopBar: false,
            };

            const clickSDKOptions = {
              appName: 'Ectoplasma dApp',
              appId: 'csprclick-template',
              providers: ['casper-wallet', 'casper-signer'],
            };
          `}
        </Script>
        <Script
          id="csprclick-cdn"
          src="https://cdn.cspr.click/ui/v1.9.0/csprclick-client-1.9.0.js"
          strategy="afterInteractive"
        />
        <div id="app">
          <div id="csprclick-ui" />
          {children}
        </div>
      </body>
    </html>
  );
}
