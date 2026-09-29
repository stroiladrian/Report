import { execSync } from "node:child_process";

/**
 * Prepares the TEST database non-destructively: applies migrations and the
 * (idempotent) configuration seed. Tests create uniquely-named data, so they
 * can run repeatedly without wiping the database. To start from scratch, run
 * `DATABASE_URL=<test url> npx prisma migrate reset` yourself.
 */
export default function setup() {
  if (process.env.SKIP_DB_SETUP === "1") return;
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://civic:civic@localhost:5432/civicreport_test?schema=public";
  const env = { ...process.env, DATABASE_URL: url, SEED_SKIP_REPORTS: "1", PRISMA_HIDE_UPDATE_MESSAGE: "1" };
  execSync("npx prisma migrate deploy", { env, stdio: "pipe" });
  execSync("npx tsx prisma/seed.ts", { env, stdio: "pipe" });
}
