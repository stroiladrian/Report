import { redirect } from "next/navigation";

/** /reports?… → the explorer in list mode, keeping filters (spec: /reports?status=…&category=…&period=30d). */
export default async function ReportsIndex({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === "string") sp.set(k, v);
  sp.set("view", "list");
  redirect(`/?${sp.toString()}`);
}
