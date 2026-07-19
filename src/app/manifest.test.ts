import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("PWA", () => {
  it("veröffentlicht ein installierbares Manifest für bw-fit", () => {
    const value = manifest();
    expect(value).toMatchObject({
      id: "/",
      name: "bw-fit",
      short_name: "bw-fit",
      start_url: "/",
      scope: "/",
      display: "standalone",
    });

    expect(value.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ sizes: "192x192", purpose: "any" }),
      expect.objectContaining({ sizes: "512x512", purpose: "any" }),
      expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
    ]));
    for (const icon of value.icons ?? []) {
      expect(existsSync(resolve("public", icon.src.replace(/^\//, "")))).toBe(true);
    }
  });

  it("liefert Service Worker und Offline-Seite aus", () => {
    const worker = readFileSync(resolve("public/sw.js"), "utf8");
    expect(worker).toContain('self.addEventListener("install"');
    expect(worker).toContain('self.addEventListener("fetch"');
    expect(worker).toContain('const OFFLINE_URL = "/offline.html"');
    expect(existsSync(resolve("public/offline.html"))).toBe(true);
  });
});
