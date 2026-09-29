import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";

type Tx = Prisma.TransactionClient | PrismaClient;

export type AuditEntry = {
  actorId?: string | null;
  action: string; // e.g. "report.status_change"
  entityType: string; // e.g. "report"
  entityId?: string | null;
  data?: Prisma.InputJsonValue;
  ip?: string | null;
};

/** Append-only audit log. Pass the transaction client to keep it atomic with the change. */
export async function audit(entry: AuditEntry, tx: Tx = db) {
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      data: entry.data ?? undefined,
      ip: entry.ip ?? null,
    },
  });
}

/** Shallow diff helper for audit payloads. */
export function diff<T extends Record<string, unknown>>(before: T, after: Partial<T>) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of Object.keys(after)) {
    const a = before[k];
    const b = after[k];
    const norm = (v: unknown) => (v instanceof Date ? v.toISOString() : v ?? null);
    if (JSON.stringify(norm(a)) !== JSON.stringify(norm(b))) changes[k] = { from: norm(a), to: norm(b) };
  }
  return changes;
}
