import { expect, test } from "@playwright/test";

test("mobile Chrome receives the installable PWA shell and offline fallback", async ({ context, page, request }) => {
  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBe(true);
  await expect(manifestResponse.json()).resolves.toMatchObject({
    id: "/",
    name: "bw-fit",
    short_name: "bw-fit",
    start_url: "/",
    scope: "/",
    display: "standalone",
  });

  const workerResponse = await request.get("/sw.js");
  expect(workerResponse.ok()).toBe(true);
  expect(workerResponse.headers()["service-worker-allowed"]).toBe("/");
  for (const icon of ["/icon-192.png", "/icon-512.png", "/icon-maskable-512.png"]) {
    expect((await request.get(icon)).ok()).toBe(true);
  }

  await page.goto("/einrichten");
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(new URL(scope).pathname).toBe("/");
  await page.reload();
  await context.setOffline(true);
  await page.goto("/offline-probe");
  await expect(page.getByRole("heading", { name: "Keine Verbindung" })).toBeVisible();
  await context.setOffline(false);
});

test("mobile first run, workout autosave, timer and bodyweight", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/einrichten/);

  await page.getByLabel("Name").fill("QA Besitzer");
  await page.getByLabel("E-Mail").fill("qa@bw-fit.local");
  await page.getByLabel("Passwort").fill("sicheres-testpasswort");
  await page.getByRole("button", { name: "bw-fit einrichten" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "Training starten" })).toBeVisible();

  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);

  await page.getByRole("button", { name: "Training starten" }).click();
  await expect(page).toHaveURL(/\/training\//);
  await expect(page.getByRole("heading", { name: /Goblet.*Squat/i })).toBeVisible();

  await page.getByRole("button", { name: "Nächste Übung" }).click();
  const longHeading = page.getByRole("heading", { name: "Schrägbankdrücken mit Kurzhanteln" });
  await expect(longHeading).toBeVisible();
  for (const width of [320, 360, 390, 412]) {
    await page.setViewportSize({ width, height: 740 });
    const layout = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    expect(layout.scroll).toBeLessThanOrEqual(layout.client);
    const headingBox = await longHeading.boundingBox();
    expect(headingBox).not.toBeNull();
    expect((headingBox?.x ?? 0) + (headingBox?.width ?? 0)).toBeLessThanOrEqual(width);
    const nextBox = await page.getByRole("button", { name: "Nächste Übung" }).boundingBox();
    expect(nextBox).not.toBeNull();
    expect((nextBox?.y ?? 0) + (nextBox?.height ?? 0)).toBeLessThanOrEqual(740);
  }
  await page.getByRole("button", { name: "Zurück" }).click();

  const firstSet = page.getByRole("button", { name: "Satz 1 abschließen" });
  const focusSet = page.locator(".focus-set");
  await focusSet.getByText("Notiz hinzufügen").click();
  await focusSet.getByLabel("Notiz zu Satz 1").fill("Tempo sauber");
  const noteSaved = page.waitForResponse((response) => response.request().method() === "POST" && response.ok());
  await focusSet.getByLabel("Notiz zu Satz 1").blur();
  await noteSaved;
  const setSaved = page.waitForResponse((response) => response.request().method() === "POST" && response.ok());
  await firstSet.click();
  await setSaved;
  await expect(page.getByText("Pause", { exact: true })).toBeVisible();
  await expect(page.getByText(/1:2\d|1:30/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Satz 2 abschließen" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Satz 1 öffnen" })).toBeVisible();
  await expect(page.getByLabel("Notiz zu Satz 1")).toHaveValue("Tempo sauber");

  await page.getByRole("button", { name: "Technik" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("img", { name: /Goblet Squat: aufrecht stehen/ })).toBeVisible();
  await page.getByRole("button", { name: "Schließen", exact: true }).click();

  await page.getByRole("link", { name: "Training verlassen" }).click();
  await expect(page.getByText("Training läuft")).toBeVisible();
  await expect(page.getByRole("link", { name: "Fortsetzen" })).toBeVisible();

  await page.getByRole("link", { name: "Fortschritt" }).click();
  await expect(page.getByRole("heading", { name: "Trainingspuls" })).toBeVisible();
  await expect(page.getByText("Letzte 12 Wochen")).toBeVisible();
  await page.getByLabel("Gewicht in kg").fill("74.5");
  await page.getByLabel("Notiz (optional)").fill("E2E Messung");
  await page.getByRole("button", { name: "Messung speichern" }).click();
  await expect(page.getByText("74,5 kg")).toBeVisible();

  await page.getByRole("link", { name: "Einstellungen" }).click();
  await page.getByLabel("Trainingseinheiten pro Woche").fill("3");
  await page.getByRole("button", { name: "Einstellungen speichern" }).click();
  await page.getByRole("link", { name: "Fortschritt" }).click();
  await expect(page.getByText("/3")).toBeVisible();
  await page.getByRole("link", { name: "Einstellungen" }).click();
  await page.getByRole("button", { name: "Dunkel" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Dunkel" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Automatisch" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);

  await page.goto("/einrichten");
  await expect(page).toHaveURL(/\/$/);
});
