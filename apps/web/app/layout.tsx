import type { Metadata, Viewport } from "next";
import { AppShell } from "@/src/components/app-shell";
import { DemoDataProvider } from "@/src/features/customers-projects/demo-data-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Angebots-Copilot | Malerbetrieb Westblick",
    template: "%s | Angebots-Copilot",
  },
  description:
    "Interne, synthetische Demo für den Angebotsprozess von Malerbetrieb Westblick GmbH.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#174c3c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body>
        <DemoDataProvider>
          <AppShell>{children}</AppShell>
        </DemoDataProvider>
      </body>
    </html>
  );
}
