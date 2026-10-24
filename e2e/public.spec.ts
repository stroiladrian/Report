import { expect, test } from "@playwright/test";

test.describe("anonymous visitor", () => {
  test("browses the map, filters and opens a report", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("region", { name: "Harta sesizărilor" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Adaugă sesizare/ })).toBeVisible();

    // Filters live in a floating card on desktop, a bottom drawer on mobile
    const isMobile = (page.viewportSize()?.width ?? 1280) < 768;
    if (isMobile) await page.getByRole("button", { name: /Filtre/ }).click();
    const panel = isMobile ? page.getByRole("dialog") : page.locator("main");
    if (!isMobile) await panel.getByRole("button", { name: "Stare" }).first().click();
    const resolved = panel.getByRole("checkbox", { name: /Rezolvate/ }).first();
    await expect(resolved).toBeVisible();
    await resolved.click();
    await expect(page).toHaveURL(/status=/);
    if (isMobile) await page.keyboard.press("Escape");

    // List view
    await page.goto("/?view=list&period=all");
    const cards = page.locator("aside article");
    await expect(cards.first()).toBeVisible();
    const title = await cards.first().locator("h3").innerText();
    await cards.first().locator("h3 a").click();
    await expect(page).toHaveURL(/\/reports\/CR\d{4}-\d{6}/);
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: title })).toBeVisible();
    await expect(dialog.getByText("Istoric")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/view=list/);
  });

  test("report page works on direct load and hides reporter identity", async ({ page, request }) => {
    const res = await (await request.get("/api/reports?period=all&pageSize=1")).json();
    const number = res.items[0].number as string;
    await page.goto(`/reports/${number}`);
    await expect(page.getByText("Nr. înregistrare")).toBeVisible();
    await expect(page.locator("main")).not.toContainText("@example.com");
  });

  test("anonymous users are sent to login when reporting", async ({ page }) => {
    await page.goto("/submit");
    await expect(page).toHaveURL(/\/login\?returnTo=%2Fsubmit/);
  });
});
