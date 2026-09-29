import { branding } from "@config/branding";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";
import { createReportSchema, reportFiltersSchema } from "@/lib/validation/schemas";
import {
  addAttachments,
  addComment,
  changeStatus,
  createReport,
  getAdminReportDetail,
  getReportDetail,
  listReports,
  readAttachment,
  updateReport,
} from "@/server/services/reports";
import { category, makeUser, PNG_1PX } from "../helpers/factories";

let citizen: SessionUser, other: SessionUser, admin: SessionUser, lightOp: SessionUser, roadsOp: SessionUser;
let reportId: string;
let number: string;

const LOC = { lat: branding.map.defaultLocation.lat, lng: branding.map.defaultLocation.lng, street: "Strada Test", streetNumber: "1", source: "map" as const };

beforeAll(async () => {
  citizen = await makeUser("CITIZEN");
  other = await makeUser("CITIZEN");
  admin = await makeUser("ADMIN");
  lightOp = await makeUser("OPERATOR", { dept: "LIGHT" });
  roadsOp = await makeUser("OPERATOR", { dept: "ROADS" });
});

describe("create report", () => {
  it("persists report, location, attachment, history, audit and notification", async () => {
    const lighting = await category("lighting");
    const input = createReportSchema.parse({
      title: "Lamp out",
      description: "The lamp in front of number one has been out for a week.",
      categoryId: lighting.id,
      subcategoryId: lighting.children[0]!.id,
      location: LOC,
    });
    const r = await createReport(citizen, input, [{ name: "photo.png", size: PNG_1PX.length, type: "image/png", data: PNG_1PX }]);
    reportId = r.id;
    number = r.number;
    expect(r.number).toMatch(/^CR\d{4}-\d{6}$/);
    const full = await db.report.findUniqueOrThrow({
      where: { id: r.id },
      include: { location: true, attachments: true, history: true, status: true, department: true },
    });
    expect(full.status.key).toBe("submitted");
    expect(full.department?.code).toBe("LIGHT");
    expect(full.location?.street).toBe("Strada Test");
    expect(full.attachments).toHaveLength(1);
    expect(full.attachments[0]!.storageKey).not.toContain("photo");
    expect(full.history).toHaveLength(1);
    expect(full.dueAt).not.toBeNull();
    expect(await db.auditLog.count({ where: { entityId: r.id, action: "report.create" } })).toBe(1);
    expect(await db.notification.count({ where: { userId: citizen.id, reportId: r.id, type: "report_submitted" } })).toBe(1);
    expect(await db.notification.count({ where: { userId: lightOp.id, reportId: r.id, type: "new_report_staff" } })).toBe(1);
  });

  it("rejects unverified citizens, bad subcategories and spoofed files", async () => {
    const unverified = await makeUser("CITIZEN", { verified: false });
    const lighting = await category("lighting");
    const roads = await category("roads");
    const base = { title: "Lamp out", description: "Some long enough description here.", categoryId: lighting.id, subcategoryId: lighting.children[0]!.id };
    await expect(createReport(unverified, createReportSchema.parse(base))).rejects.toMatchObject({ code: "UNVERIFIED" });
    await expect(createReport(citizen, createReportSchema.parse({ ...base, subcategoryId: roads.children[0]!.id }))).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    const html = Buffer.from("<html>not an image</html>");
    await expect(
      createReport(citizen, createReportSchema.parse(base), [{ name: "evil.png", size: html.length, type: "image/png", data: html }]),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const eleven = Array.from({ length: 11 }, (_, i) => ({ name: `p${i}.png`, size: PNG_1PX.length, type: "image/png", data: PNG_1PX }));
    await expect(createReport(citizen, createReportSchema.parse(base), eleven)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("refuses staff-only creation paths for anonymous/unauthorised users", async () => {
    const noPerm = { ...citizen, permissions: new Set<string>() };
    const lighting = await category("lighting");
    await expect(
      createReport(noPerm, createReportSchema.parse({ title: "Lamp out", description: "Long enough description.", categoryId: lighting.id, subcategoryId: lighting.children[0]!.id })),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("public visibility", () => {
  it("public detail hides reporter identity and internal data", async () => {
    const d = await getReportDetail(number, null, "en");
    expect(d.number).toBe(number);
    expect(JSON.stringify(d)).not.toContain(citizen.email!);
    expect(d.viewer.isOwner).toBe(false);
    expect(d.dueAt).toBeNull();
    const own = await getReportDetail(number, citizen, "en");
    expect(own.viewer.isOwner).toBe(true);
    expect(own.viewer.canComment).toBe(true);
  });

  it("sensitive categories never appear publicly", async () => {
    const integrity = await category("integrity");
    const r = await createReport(citizen, createReportSchema.parse({ title: "Sensitive", description: "Something sensitive happened here.", categoryId: integrity.id }));
    const list = await listReports(reportFiltersSchema.parse({ period: "all", pageSize: "100" }), null, "en");
    expect(list.items.find((x) => x.id === r.id)).toBeUndefined();
    await expect(getReportDetail(r.number, null, "en")).rejects.toMatchObject({ status: 404 });
    await expect(getReportDetail(r.number, other, "en")).rejects.toMatchObject({ status: 404 });
    expect((await getReportDetail(r.number, citizen, "en")).number).toBe(r.number);
    expect((await getReportDetail(r.number, admin, "en")).number).toBe(r.number);
  });

  it("filters by status group and category", async () => {
    const res = await listReports(reportFiltersSchema.parse({ status: "submitted", category: "lighting", period: "all" }), null, "en");
    expect(res.items.some((x) => x.id === reportId)).toBe(true);
    const none = await listReports(reportFiltersSchema.parse({ status: "resolved", category: "lighting", period: "all" }), null, "en");
    expect(none.items.some((x) => x.id === reportId)).toBe(false);
    const mine = await listReports(reportFiltersSchema.parse({ mine: "1" }), other, "en");
    expect(mine.total).toBe(0);
  });
});

describe("processing", () => {
  it("operators cannot assign; admins can, and the assignee is notified", async () => {
    const emp = await db.employee.findUniqueOrThrow({ where: { userId: lightOp.id } });
    await expect(updateReport(lightOp, reportId, { assigneeId: emp.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(updateReport(citizen, reportId, { isPublic: false })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await updateReport(admin, reportId, { assigneeId: emp.id });
    const r = await db.report.findUniqueOrThrow({ where: { id: reportId } });
    expect(r.assigneeId).toBe(emp.id);
    expect(await db.notification.count({ where: { userId: lightOp.id, type: "report_assigned" } })).toBe(1);
    expect(await db.auditLog.count({ where: { entityId: reportId, action: "report.update" } })).toBe(1);
  });

  it("an operator from another department cannot change status", async () => {
    await expect(changeStatus(roadsOp, reportId, { status: "accepted" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(changeStatus(citizen, reportId, { status: "accepted" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("walks the workflow to resolved, recording history, audit and notifications", async () => {
    await expect(changeStatus(lightOp, reportId, { status: "resolved" })).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    for (const s of ["accepted", "assigned", "in_progress"]) await changeStatus(lightOp, reportId, { status: s, isPublic: true });
    await changeStatus(lightOp, reportId, { status: "resolved", note: "Bulb replaced", resolution: "Lamp repaired" });
    const r = await db.report.findUniqueOrThrow({ where: { id: reportId }, include: { status: true, history: true } });
    expect(r.status.key).toBe("resolved");
    expect(r.resolvedAt).not.toBeNull();
    expect(r.resolution).toBe("Lamp repaired");
    expect(r.history).toHaveLength(5);
    expect(await db.auditLog.count({ where: { entityId: reportId, action: "report.status_change" } })).toBe(4);
    expect(await db.notification.count({ where: { userId: citizen.id, reportId, type: "report_resolved" } })).toBe(1);
    const d = await getReportDetail(number, null, "en");
    expect(d.status.key).toBe("resolved");
    expect(d.history.map((h) => h.status.key)).toEqual(["submitted", "accepted", "assigned", "in_progress", "resolved"]);
  });

  it("enforces comment permissions and visibility", async () => {
    await addComment(lightOp, reportId, { body: "Internal only", kind: "NOTE" });
    await addComment(lightOp, reportId, { body: "Fixed today", kind: "RESPONSE" });
    await addComment(citizen, reportId, { body: "Thank you!", kind: "CITIZEN" });
    await expect(addComment(other, reportId, { body: "spam", kind: "CITIZEN" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(addComment(citizen, reportId, { body: "x", kind: "NOTE" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const pub = await getReportDetail(number, null, "en");
    expect(pub.comments.map((c) => c.body)).toEqual(["Fixed today"]);
    const own = await getReportDetail(number, citizen, "en");
    expect(own.comments.map((c) => c.body)).toEqual(["Fixed today", "Thank you!"]);
    const staff = await getAdminReportDetail(number, admin, "en");
    expect(staff.comments).toHaveLength(3);
    expect(staff.reporter?.email).toBe(citizen.email);
  });

  it("handles admin attachments with controlled access", async () => {
    const [att] = await addAttachments(lightOp, reportId, [{ name: "invoice.pdf", size: 9, type: "application/pdf", data: Buffer.from("%PDF-1.4\n") }], { isPublic: false });
    expect(att!.kind).toBe("ADMIN");
    await expect(readAttachment(null, att!.id)).rejects.toMatchObject({ status: 404 });
    await expect(readAttachment(citizen, att!.id)).rejects.toMatchObject({ status: 404 });
    const f = await readAttachment(admin, att!.id);
    expect(f.mimeType).toBe("application/pdf");
    const citizenPhoto = await db.reportAttachment.findFirstOrThrow({ where: { reportId, kind: "CITIZEN" } });
    expect((await readAttachment(null, citizenPhoto.id)).mimeType).toBe("image/png");
    await expect(addAttachments(other, reportId, [{ name: "a.png", size: PNG_1PX.length, type: "image/png", data: PNG_1PX }])).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("closes the report and blocks further citizen comments", async () => {
    await changeStatus(admin, reportId, { status: "closed" });
    const d = await getReportDetail(number, citizen, "en");
    expect(d.status.isTerminal).toBe(true);
    expect(d.viewer.canComment).toBe(false);
    await expect(addComment(citizen, reportId, { body: "more", kind: "CITIZEN" })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
