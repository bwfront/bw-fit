import type { Metadata, Viewport } from "next";
import { PwaProvider } from "@/components/pwa-provider";
import "./globals.css";

const themeBootScript = `
  (() => {
    try {
      const saved = localStorage.getItem("bw-fit-theme");
      if (saved === "light" || saved === "dark") {
        document.documentElement.dataset.theme = saved;
      }
    } catch {}
  })();
`;

export const metadata: Metadata = {
  title: { default: "bw-fit", template: "%s · bw-fit" },
  description: "Dein persönliches Trainingsprotokoll.",
  applicationName: "bw-fit",
  appleWebApp: { capable: true, title: "bw-fit", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon.svg", apple: "/icon-180.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e9edf1" },
    { media: "(prefers-color-scheme: dark)", color: "#111920" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeBootScript }} /></head>
      <body><PwaProvider>{children}</PwaProvider></body>
    </html>
  );
}
