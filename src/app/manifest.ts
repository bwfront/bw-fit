import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kraftbuch",
    short_name: "Kraftbuch",
    description: "Dein persönliches Trainingsprotokoll",
    start_url: "/",
    display: "standalone",
    background_color: "#e9edf1",
    theme_color: "#244f78",
    lang: "de-DE",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
