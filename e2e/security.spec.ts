import { expect, test } from "@playwright/test";
import { PASSWORD } from "./helpers";

test.describe("server-side enforcement", () => {
  test("anonymous cannot create reports or read admin data", async ({ request }) => {
    const r = await request.post("/api/reports", { data: { title: "x" }, headers: { origin: "http://localhost:3000" } });
    expect(r.status()).toBe(401);
    expect((await r.json()).error.code).toBe("UNAUTHORIZED");
    expect((await request.get("/api/admin/stats")).status()).toBe(401);
  });

  test("cross-site POSTs are rejected (CSRF)", async ({ request }) => {
    const r = await request.post("/api/auth/login", { data: { email: "a@b.c", password: "x" }, headers: { origin: "https://evil.example" } });
    expect(r.status()).toBe(403);
  });

  test("a citizen cannot change status or access admin endpoints", async ({ playwright, baseURL }) => {
    const ctx = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { origin: baseURL! } });
    const login = await ctx.post("/api/auth/login", { data: { email: "citizen@civicreport.test", password: PASSWORD } });
    expect(login.ok()).toBeTruthy();
    const list = await (await ctx.get("/api/reports?period=all&pageSize=1")).json();
    const id = list.items[0].id;
    const res = await ctx.post(`/api/reports/${id}/status`, { data: { status: "resolved" } });
    expect(res.status()).toBe(403);
    expect((await ctx.get("/api/admin/users")).status()).toBe(403);
    expect((await ctx.patch(`/api/reports/${id}`, { data: { isPublic: false } })).status()).toBe(403);
    await ctx.dispose();
  });

  test("uploads with spoofed content are rejected", async ({ playwright, baseURL }) => {
    const ctx = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { origin: baseURL! } });
    await ctx.post("/api/auth/login", { data: { email: "citizen@civicreport.test", password: PASSWORD } });
    const cats = await (await ctx.get("/api/categories")).json();
    const cat = cats.items.find((c: { slug: string }) => c.slug === "other");
    const res = await ctx.post("/api/reports", {
      multipart: {
        data: JSON.stringify({ title: "Spoof test", description: "Checking server-side validation.", categoryId: cat.id }),
        files: { name: "evil.png", mimeType: "image/png", buffer: Buffer.from("<script>alert(1)</script>") },
      },
    });
    expect(res.status()).toBe(422);
    await ctx.dispose();
  });
});
