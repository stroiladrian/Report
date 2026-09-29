import { db } from "@/lib/db";
import { tr, type Locale } from "@/lib/i18n/core";
import { Workflow } from "@/server/domain/workflow";
import type { StatusDTO, StatusGroupDTO } from "@/types/reports";
import type { ReportStatus } from "@prisma/client";

let cached: { wf: Workflow; rows: ReportStatus[]; at: number } | null = null;
const TTL = 30_000;

export async function loadWorkflow(force = false) {
  if (!force && cached && Date.now() - cached.at < TTL) return cached;
  const [rows, transitions] = await Promise.all([
    db.reportStatus.findMany({ orderBy: { sortOrder: "asc" } }),
    db.statusTransition.findMany(),
  ]);
  const wf = new Workflow(
    rows.map((s) => ({ id: s.id, key: s.key, isInitial: s.isInitial, isTerminal: s.isTerminal, isResolved: s.isResolved, isActive: s.isActive })),
    transitions.map((t) => ({ fromStatusId: t.fromStatusId, toStatusId: t.toStatusId, requiresComment: t.requiresComment, permission: t.permission })),
  );
  cached = { wf, rows, at: Date.now() };
  return cached;
}

export function invalidateWorkflow() {
  cached = null;
}

export function statusDTO(s: ReportStatus, locale: Locale): StatusDTO {
  return {
    key: s.key,
    label: tr(s.label, locale),
    color: s.color,
    group: s.publicGroup,
    isTerminal: s.isTerminal,
    isResolved: s.isResolved,
  };
}

/** Public filter groups; label/colour come from the status whose key equals the group key. */
export async function statusGroups(locale: Locale): Promise<Omit<StatusGroupDTO, "count">[]> {
  const { rows } = await loadWorkflow();
  const keys = [...new Set(rows.filter((s) => s.isActive).map((s) => s.publicGroup))];
  return keys.map((k) => {
    const rep = rows.find((s) => s.key === k) ?? rows.find((s) => s.publicGroup === k)!;
    return { key: k, label: tr(rep.pluralLabel ?? rep.label, locale), color: rep.color };
  });
}

export async function statusIdsForGroups(groups: string[]): Promise<string[]> {
  const { rows } = await loadWorkflow();
  return rows.filter((s) => groups.includes(s.publicGroup)).map((s) => s.id);
}
