import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const PASSWORD = process.env.SEED_PASSWORD ?? "CivicDemo2026!";

export async function login(page: Page, email: string, password = PASSWORD, returnTo = "/") {
  await page.goto(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Parolă").fill(password);
  await page.getByRole("button", { name: "Autentificare", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

export async function logout(page: Page) {
  await page.context().clearCookies();
}

/** Reads the latest message captured by the mock e-mail provider (dev mailbox). */
export async function lastMail(request: APIRequestContext, to: string) {
  await expect
    .poll(async () => ((await (await request.get(`/api/dev/mailbox?to=${encodeURIComponent(to)}`)).json()).items as unknown[]).length, {
      timeout: 15_000,
    })
    .toBeGreaterThan(0);
  const { items } = await (await request.get(`/api/dev/mailbox?to=${encodeURIComponent(to)}`)).json();
  return items[0] as { subject: string; body: string };
}
