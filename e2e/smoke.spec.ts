import { expect, test } from "@playwright/test";

test("mobile first run, workout autosave, timer and bodyweight", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/einrichten/);

  await page.getByLabel("Name").fill("QA Besitzer");
  await page.getByLabel("E-Mail").fill("qa@kraftbuch.local");
  await page.getByLabel("Passwort").fill("sicheres-testpasswort");
  await page.getByRole("button", { name: "Kraftbuch einrichten" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "Training starten" })).toBeVisible();

  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);

  await page.getByRole("button", { name: "Training starten" }).click();
  await expect(page).toHaveURL(/\/training\//);
  await expect(page.getByRole("heading", { name: /Goblet.*Squat/i })).toBeVisible();

  const firstSet = page.getByRole("button", { name: "Satz 1 abschließen" });
  await page.getByLabel("Notiz zu Satz 1").fill("Tempo sauber");
  await page.getByLabel("Notiz zu Satz 1").blur();
  await firstSet.click();
  await expect(page.getByText("Pause", { exact: true })).toBeVisible();
  await expect(page.getByText(/1:2\d|1:30/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Satz 1 öffnen" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Notiz zu Satz 1")).toHaveValue("Tempo sauber");

  await page.getByRole("button", { name: "Technik" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("img", { name: "Animierte Übungsdarstellung" })).toBeVisible();
  await page.getByRole("button", { name: "Schließen", exact: true }).click();

  await page.getByRole("link", { name: "Training verlassen" }).click();
  await expect(page.getByText("Training läuft")).toBeVisible();
  await expect(page.getByRole("link", { name: "Fortsetzen" })).toBeVisible();

  await page.getByRole("link", { name: "Fortschritt" }).click();
  await page.getByLabel("Gewicht in kg").fill("74.5");
  await page.getByLabel("Notiz (optional)").fill("E2E Messung");
  await page.getByRole("button", { name: "Messung speichern" }).click();
  await expect(page.getByText("74,5 kg")).toBeVisible();

  await page.goto("/einrichten");
  await expect(page).toHaveURL(/\/$/);
});
