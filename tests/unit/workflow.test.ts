import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { DEFAULT_STATUSES, DEFAULT_TRANSITIONS, Workflow } from "@/server/domain/workflow";

const statuses = DEFAULT_STATUSES.map((s) => ({
  id: `id-${s.key}`,
  key: s.key,
  isInitial: "isInitial" in s && !!s.isInitial,
  isTerminal: "isTerminal" in s && !!s.isTerminal,
  isResolved: "isResolved" in s && !!s.isResolved,
  isActive: true,
}));
const transitions = DEFAULT_TRANSITIONS.map(([f, t, req]) => ({ fromStatusId: `id-${f}`, toStatusId: `id-${t}`, requiresComment: !!req, permission: null }));
const wf = new Workflow(statuses, transitions);
const perms = new Set<string>();

const fail = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e as AppError;
  }
  throw new Error("expected failure");
};

describe("Workflow", () => {
  it("has exactly one initial status", () => {
    expect(wf.initial().key).toBe("submitted");
  });

  it("allows the happy path submitted → … → closed", () => {
    const path = ["submitted", "accepted", "assigned", "in_progress", "resolved", "closed"];
    for (let i = 1; i < path.length; i++) {
      const { to } = wf.validate({ fromStatusId: `id-${path[i - 1]}`, toStatusKey: path[i]! }, perms);
      expect(to.key).toBe(path[i]);
    }
  });

  it("rejects transitions that are not configured", () => {
    const e = fail(() => wf.validate({ fromStatusId: "id-submitted", toStatusKey: "resolved" }, perms));
    expect(e.code).toBe("INVALID_TRANSITION");
    expect(fail(() => wf.validate({ fromStatusId: "id-closed", toStatusKey: "in_progress" }, perms)).code).toBe("INVALID_TRANSITION");
  });

  it("rejects no-op and unknown statuses", () => {
    expect(fail(() => wf.validate({ fromStatusId: "id-accepted", toStatusKey: "accepted" }, perms)).code).toBe("INVALID_TRANSITION");
    expect(fail(() => wf.validate({ fromStatusId: "id-accepted", toStatusKey: "nope" }, perms)).code).toBe("INVALID_TRANSITION");
  });

  it("requires a note where configured", () => {
    expect(fail(() => wf.validate({ fromStatusId: "id-submitted", toStatusKey: "needs_info" }, perms)).code).toBe("VALIDATION_ERROR");
    expect(wf.validate({ fromStatusId: "id-submitted", toStatusKey: "needs_info", note: "Which lamp?" }, perms).to.key).toBe("needs_info");
  });

  it("requires a target institution when redirecting", () => {
    expect(fail(() => wf.validate({ fromStatusId: "id-submitted", toStatusKey: "redirected", note: "n" }, perms)).code).toBe("VALIDATION_ERROR");
    expect(wf.validate({ fromStatusId: "id-submitted", toStatusKey: "redirected", note: "n", redirectedTo: "Water Co." }, perms).to.key).toBe("redirected");
  });

  it("honours per-transition permissions", () => {
    const w2 = new Workflow(statuses, [{ fromStatusId: "id-resolved", toStatusId: "id-closed", requiresComment: false, permission: "report:assign" }]);
    expect(fail(() => w2.validate({ fromStatusId: "id-resolved", toStatusKey: "closed" }, perms)).code).toBe("FORBIDDEN");
    expect(w2.validate({ fromStatusId: "id-resolved", toStatusKey: "closed" }, new Set(["report:assign"])).to.key).toBe("closed");
    expect(w2.available("id-resolved", perms)).toHaveLength(0);
  });

  it("lists available transitions", () => {
    const keys = wf.available("id-in_progress", perms).map((t) => t.to.key).sort();
    expect(keys).toEqual(["needs_info", "planned", "resolved"]);
  });
});
