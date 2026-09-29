import { expect, test } from "@playwright/test";
import { lastMail, login, logout, PASSWORD } from "./helpers";

/**
 * Full lifecycle: citizen registers → verifies e-mail → creates a report with a photo →
 * admin processes it to "resolved" → citizen sees the resolution and a notification.
 */
test.describe.serial("report lifecycle", () => {
  const email = `e2e-${Date.now()}@example.com`;
  let number = "";

  test("citizen registers and verifies e-mail", async ({ page, request }) => {
    await page.goto("/register");
    await page.getByLabel("Prenume").fill("Eva");
    await page.getByLabel(/^Nume\*?$/).fill("Tester");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel(/^Parolă\*?$/).fill(PASSWORD);
    await page.getByLabel("Confirmă parola").fill(PASSWORD);
    await page.getByLabel(/Sunt de acord/).check();
    await page.getByLabel(/Declar că/).check();
    await page.getByRole("button", { name: "Creează cont" }).click();
    await expect(page).toHaveURL(/\/account/);
    const mail = await lastMail(request, email);
    const link = /(https?:\/\/\S+verify-email\?token=\S+)/.exec(mail.body)![1]!;
    await page.goto(new URL(link).pathname + new URL(link).search);
    await expect(page.getByText("Adresa de e-mail a fost verificată.")).toBeVisible();
  });

  test("citizen creates a report with location, category, description and photo", async ({ page }) => {
    await login(page, email, PASSWORD, "/submit");
    await expect(page.getByRole("heading", { name: "Unde este problema?" })).toBeVisible();
    // Location: pin at map centre – wait for coordinates/address, fall back to "no location" if tiles are unavailable.
    const detected = page.locator("text=Adresă detectată").locator("..");
    try {
      await expect(detected).not.toContainText("—", { timeout: 15_000 });
    } catch {
      await page.getByLabel("Sesizarea nu are o locație anume").check();
    }
    await page.getByRole("button", { name: "Continuă" }).click();
    await page.getByText("Străzi și trotuare").click();
    await page.getByLabel("Subcategorie").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Continuă" }).click();
    // validation
    await page.getByRole("button", { name: "Continuă" }).click();
    await expect(page.getByText("Sunt necesare minim 5 caractere.")).toBeVisible();
    await page.getByLabel("Titlu").fill("Groapă adâncă E2E");
    await page.getByLabel("Descriere").fill("Groapă adâncă în carosabil, test automat end-to-end.");
    await page.getByRole("button", { name: "Continuă" }).click();
    await page.setInputFiles("input[type=file]", {
      name: "groapa.png",
      mimeType: "image/png",
      buffer: Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d763f8cfc0000003010100c9fe92ef0000000049454e44ae426082", "hex"),
    });
    await expect(page.getByRole("img", { name: "groapa.png" })).toBeVisible();
    await page.getByRole("button", { name: "Continuă" }).click();
    await page.getByLabel(/Confirm că/).check();
    await page.getByRole("button", { name: "Trimite sesizarea" }).click();
    const num = page.getByTestId("report-number");
    await expect(num).toBeVisible();
    number = (await num.innerText()).trim();
    expect(number).toMatch(/^CR\d{4}-\d{6}$/);

    await page.goto("/account/reports");
    await expect(page.getByText("Groapă adâncă E2E")).toBeVisible();
    await page.goto(`/reports/${number}`);
    await expect(page.getByText("Ați depus această sesizare")).toBeVisible();
    await expect(page.locator("dd").getByText("Depusă")).toBeVisible();
  });

  test("admin processes the report to resolved", async ({ page }) => {
    await logout(page);
    await login(page, "admin@civicreport.test", PASSWORD, "/admin/reports");
    await page.goto(`/admin/reports/${number}`);
    const move = async (key: string, note?: string) => {
      await page.getByTestId(`transition-${key}`).click();
      if (note) await page.getByRole("dialog").getByLabel("Notă").fill(note);
      await page.getByTestId("confirm-transition").click();
      await expect(page.getByTestId(`transition-${key}`)).toHaveCount(0);
    };
    await move("accepted");
    await page.getByTestId("assignee-select").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Salvează alocarea" }).click();
    await expect(page.getByText("Salvat.").first()).toBeVisible();
    await move("assigned");
    await move("in_progress");
    await page.getByTestId("comment-body").fill("Echipa va interveni mâine dimineață.");
    await page.getByRole("button", { name: "Adaugă", exact: true }).click();
    await expect(page.getByTestId("comment-body")).toHaveValue("");
    await expect(page.locator("li").getByText("Echipa va interveni mâine dimineață.")).toBeVisible();
    await move("resolved", "Groapa a fost astupată.");
    await expect(page.getByText("Rezolvată").first()).toBeVisible();
  });

  test("citizen sees resolved status, public update and notification", async ({ page }) => {
    await logout(page);
    await login(page, email);
    await page.goto(`/reports/${number}`);
    await expect(page.locator("dd").getByText("Rezolvată")).toBeVisible();
    await expect(page.getByText("Echipa va interveni mâine dimineață.")).toBeVisible();
    await page.goto("/account/notifications");
    await expect(page.getByText(`Sesizarea ${number} a fost rezolvată`)).toBeVisible();
  });
});
