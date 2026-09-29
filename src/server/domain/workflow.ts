/**
 * Workflow engine – pure logic.
 * Statuses and transitions come from the database (configurable by super-admins);
 * this module only decides whether a requested transition is valid.
 */
import { Errors } from "@/lib/errors";

export type WfStatus = {
  id: string;
  key: string;
  isInitial: boolean;
  isTerminal: boolean;
  isResolved: boolean;
  isActive: boolean;
};

export type WfTransition = {
  fromStatusId: string;
  toStatusId: string;
  requiresComment: boolean;
  permission: string | null;
};

export type TransitionRequest = {
  fromStatusId: string;
  toStatusKey: string;
  note?: string | null;
  redirectedTo?: string | null;
};

export class Workflow {
  private byId: Map<string, WfStatus>;
  private byKey: Map<string, WfStatus>;

  constructor(
    public readonly statuses: WfStatus[],
    public readonly transitions: WfTransition[],
  ) {
    this.byId = new Map(statuses.map((s) => [s.id, s]));
    this.byKey = new Map(statuses.map((s) => [s.key, s]));
  }

  initial(): WfStatus {
    const s = this.statuses.find((x) => x.isInitial && x.isActive);
    if (!s) throw new Error("Workflow misconfigured: no initial status");
    return s;
  }

  status(idOrKey: string): WfStatus | undefined {
    return this.byId.get(idOrKey) ?? this.byKey.get(idOrKey);
  }

  /** Transitions available from a status, filtered by the actor's permissions. */
  available(fromStatusId: string, permissions: ReadonlySet<string>): (WfTransition & { to: WfStatus })[] {
    return this.transitions
      .filter((t) => t.fromStatusId === fromStatusId)
      .filter((t) => !t.permission || permissions.has(t.permission))
      .map((t) => ({ ...t, to: this.byId.get(t.toStatusId)! }))
      .filter((t) => t.to && t.to.isActive);
  }

  /** Throws INVALID_TRANSITION / VALIDATION_ERROR when the request is not allowed. */
  validate(req: TransitionRequest, permissions: ReadonlySet<string>): { transition: WfTransition; to: WfStatus } {
    const from = this.byId.get(req.fromStatusId);
    const to = this.byKey.get(req.toStatusKey);
    if (!from) throw Errors.invalidTransition("Unknown current status");
    if (!to || !to.isActive) throw Errors.invalidTransition(`Unknown status "${req.toStatusKey}"`);
    if (from.id === to.id) throw Errors.invalidTransition("Report is already in this status");
    const transition = this.transitions.find((t) => t.fromStatusId === from.id && t.toStatusId === to.id);
    if (!transition) throw Errors.invalidTransition(`Transition ${from.key} → ${to.key} is not allowed`);
    if (transition.permission && !permissions.has(transition.permission)) {
      throw Errors.forbidden(`Transition ${from.key} → ${to.key} requires ${transition.permission}`);
    }
    if (transition.requiresComment && !req.note?.trim()) {
      throw Errors.validation("A note is required for this transition", { fieldErrors: { note: ["required"] } });
    }
    if (to.key === "redirected" && !req.redirectedTo?.trim()) {
      throw Errors.validation("Target institution is required when redirecting", {
        fieldErrors: { redirectedTo: ["required"] },
      });
    }
    return { transition, to };
  }
}

/** Default workflow shipped by the seed (can be changed from Admin → Workflow). */
export const DEFAULT_STATUSES = [
  { key: "submitted", ro: "Depusă", en: "Submitted", roP: "Depuse", enP: "Submitted", group: "submitted", color: "#1e3a8a", isInitial: true },
  { key: "accepted", ro: "Acceptată", en: "Accepted", roP: "Acceptate", enP: "Accepted", group: "submitted", color: "#2563eb" },
  { key: "needs_info", ro: "Așteaptă clarificări", en: "Awaiting clarification", roP: "Așteaptă clarificări", enP: "Awaiting clarification", group: "in_progress", color: "#d97706" },
  { key: "assigned", ro: "Alocată", en: "Assigned", roP: "Alocate", enP: "Assigned", group: "in_progress", color: "#ea580c" },
  { key: "planned", ro: "Planificată", en: "Planned", roP: "Planificate", enP: "Planned", group: "planned", color: "#0ea5e9" },
  { key: "in_progress", ro: "În lucru", en: "In progress", roP: "În lucru", enP: "In progress", group: "in_progress", color: "#f59e0b" },
  { key: "resolved", ro: "Rezolvată", en: "Resolved", roP: "Rezolvate", enP: "Resolved", group: "resolved", color: "#15803d", isResolved: true },
  { key: "redirected", ro: "Redirecționată", en: "Redirected", roP: "Redirecționate", enP: "Redirected", group: "redirected", color: "#6d28d9", isTerminal: true },
  { key: "closed", ro: "Închisă", en: "Closed", roP: "Închise", enP: "Closed", group: "closed", color: "#475569", isTerminal: true },
] as const;

export const DEFAULT_TRANSITIONS: [string, string, boolean?][] = [
  ["submitted", "accepted"],
  ["submitted", "needs_info", true],
  ["submitted", "redirected", true],
  ["submitted", "closed", true],
  ["accepted", "assigned"],
  ["accepted", "planned"],
  ["accepted", "in_progress"],
  ["accepted", "needs_info", true],
  ["accepted", "redirected", true],
  ["needs_info", "accepted"],
  ["needs_info", "closed", true],
  ["assigned", "planned"],
  ["assigned", "in_progress"],
  ["assigned", "redirected", true],
  ["assigned", "needs_info", true],
  ["planned", "in_progress"],
  ["planned", "assigned"],
  ["in_progress", "resolved"],
  ["in_progress", "planned"],
  ["in_progress", "needs_info", true],
  ["resolved", "closed"],
  ["resolved", "in_progress", true],
  ["redirected", "closed"],
];

