/**
 * Report use-cases: create, query (public map/list/facets), detail, update,
 * status changes (through the workflow engine), comments and attachments.
 * All authorization happens here, server-side.
 */
import type { Prisma } from "@prisma/client";
import { appConfig } from "@config/app";
import { branding } from "@config/branding";
import { db } from "@/lib/db";
import { AppError, Errors } from "@/lib/errors";
import { tr, type Locale } from "@/lib/i18n/core";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import {
  assertCan,
  assertCanProcess,
  can,
  canCommentAsCitizen,
  canProcessReport,
  canViewPrivate,
  canViewReport,
  isStaff,
  type Actor,
  type ReportScope,
} from "@/lib/rbac/policy";
import {
  resolveDateRange,
  type CreateReportInput,
  type ReportFilters,
  type LocationInput,
} from "@/lib/validation/schemas";
import { safeDisplayName, storageKeyFor, stripJpegMetadata, validateUpload } from "@/server/domain/files";
import { getStorage } from "@/server/providers/storage";
import type {
  AdminReportDetailDTO,
  AttachmentDTO,
  CategoryFacet,
  ListReportDTO,
  MapReportDTO,
  Paginated,
  ReportDetailDTO,
  StatusGroupDTO,
} from "@/types/reports";
import { audit, diff } from "./audit";
import { assertVerifiedForReporting } from "./auth";
import { notifyMany, notifyUser } from "./notifications";
import { loadWorkflow, statusDTO, statusGroups, statusIdsForGroups } from "./workflow";

export type UploadFile = { name: string; size: number; type: string; data: Buffer };

const fileUrl = (id: string) => `/api/files/${id}`;
const excerpt = (s: string, n = 160) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const fullName = (u: { firstName: string; lastName: string } | null | undefined) =>
  u ? `${u.firstName} ${u.lastName}`.trim() : null;

function scopeOf(r: {
  reporterId: string | null;
  assigneeId: string | null;
  departmentId: string | null;
  isPublic: boolean;
  category?: { isSensitive: boolean } | null;
}): ReportScope {
  return {
    reporterId: r.reporterId,
    assigneeId: r.assigneeId,
    departmentId: r.departmentId,
    isPublic: r.isPublic,
    categorySensitive: r.category?.isSensitive ?? false,
  };
}

// ─── Numbering ─────────────────────────────────────────────────────

export async function nextReportNumber(tx: Prisma.TransactionClient, now = new Date()): Promise<string> {
  const year = now.getFullYear();
  const key = `report:${year}`;
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO counters (key, value) VALUES (${key}, 1)
    ON CONFLICT (key) DO UPDATE SET value = counters.value + 1
    RETURNING value`;
  return formatReportNumber(year, Number(rows[0]!.value));
}

export function formatReportNumber(year: number, seq: number, prefix: string = branding.reportNumberPrefix) {
  return `${prefix}${year}-${String(seq).padStart(6, "0")}`;
}

// ─── Files ─────────────────────────────────────────────────────────

type PreparedFile = { key: string; name: string; mime: string; size: number; data: Buffer };

export function prepareFiles(files: UploadFile[], existingCount = 0): PreparedFile[] {
  const max = appConfig.uploads.maxFiles;
  if (files.length + existingCount > max) {
    throw Errors.validation(`At most ${max} files are allowed`, { fieldErrors: { files: [`max:${max}`] } });
  }
  return files.map((f) => {
    const check = validateUpload({ name: f.name, size: f.size, data: f.data });
    if (!check.ok) {
      throw Errors.validation(`File "${safeDisplayName(f.name)}" rejected (${check.reason})`, {
        fieldErrors: { files: [`${check.reason}:${safeDisplayName(f.name)}`] },
      });
    }
    const data = check.mime === "image/jpeg" ? stripJpegMetadata(f.data) : f.data;
    return { key: storageKeyFor(check.ext), name: safeDisplayName(f.name), mime: check.mime, size: data.length, data };
  });
}

async function storeFiles(files: PreparedFile[]) {
  const storage = getStorage();
  const stored: string[] = [];
  try {
    for (const f of files) {
      await storage.put(f.key, f.data, f.mime);
      stored.push(f.key);
    }
  } catch (e) {
    await Promise.all(stored.map((k) => storage.delete(k).catch(() => undefined)));
    throw e;
  }
}

async function removeFiles(files: PreparedFile[]) {
  const storage = getStorage();
  await Promise.all(files.map((f) => storage.delete(f.key).catch(() => undefined)));
}

// ─── Create ────────────────────────────────────────────────────────

export async function createReport(
  actor: Actor & { emailVerifiedAt: Date | null; phoneVerifiedAt: Date | null },
  input: CreateReportInput,
  files: UploadFile[] = [],
  meta: { ip?: string | null } = {},
) {
  assertCan(actor, PERMISSIONS.REPORT_CREATE);
  assertVerifiedForReporting(actor);

  const recent = await db.report.count({
    where: { reporterId: actor.id, createdAt: { gte: new Date(Date.now() - 3_600_000) } },
  });
  if (recent >= appConfig.reports.maxPerHourPerUser) throw Errors.tooMany("Too many reports in the last hour");

  const category = await db.category.findFirst({
    where: { id: input.categoryId, isActive: true, parentId: null },
    include: { children: { where: { isActive: true } } },
  });
  if (!category) throw Errors.validation("Invalid category", { fieldErrors: { categoryId: ["category"] } });
  let sub: (typeof category.children)[number] | null = null;
  if (category.children.length > 0) {
    sub = category.children.find((c) => c.id === input.subcategoryId) ?? null;
    if (!sub) throw Errors.validation("Invalid subcategory", { fieldErrors: { subcategoryId: ["subcategory"] } });
  }
  if (input.location && branding.map.maxBounds) {
    const [w, s, e, n] = branding.map.maxBounds;
    const { lat, lng } = input.location;
    if (lng < w || lng > e || lat < s || lat > n) {
      throw Errors.validation("Location outside the service area", { fieldErrors: { location: ["outOfBounds"] } });
    }
  }

  const prepared = prepareFiles(files);
  const { wf } = await loadWorkflow();
  const initial = wf.initial();
  const slaDays = sub?.slaDays ?? category.slaDays ?? appConfig.reports.defaultSlaDays;

  await storeFiles(prepared);
  let report;
  try {
    report = await db.$transaction(async (tx) => {
      const number = await nextReportNumber(tx);
      const r = await tx.report.create({
        data: {
          number,
          title: input.title,
          description: input.description,
          categoryId: category.id,
          subcategoryId: sub?.id ?? null,
          statusId: initial.id,
          reporterId: actor.id,
          departmentId: sub?.departmentId ?? category.departmentId ?? null,
          dueAt: new Date(Date.now() + slaDays * 86_400_000),
          location: input.location ? { create: locationData(input.location) } : undefined,
          history: { create: { toStatusId: initial.id, actorId: actor.id, isPublic: true } },
          attachments: {
            create: prepared.map((f) => ({
              storageKey: f.key,
              originalName: f.name,
              mimeType: f.mime,
              size: f.size,
              uploaderId: actor.id,
              kind: "CITIZEN" as const,
              isPublic: true,
            })),
          },
        },
      });
      await audit(
        {
          actorId: actor.id,
          action: "report.create",
          entityType: "report",
          entityId: r.id,
          data: { number, categoryId: category.id, files: prepared.length },
          ip: meta.ip,
        },
        tx,
      );
      return r;
    });
  } catch (e) {
    await removeFiles(prepared);
    throw e;
  }

  const link = `/reports/${report.number}`;
  await notifyUser(actor.id, "report_submitted", { number: report.number, title: report.title }, { reportId: report.id, link });
  if (report.departmentId) {
    const staff = await db.employee.findMany({ where: { departmentId: report.departmentId, isActive: true }, select: { userId: true } });
    await notifyMany(
      staff.map((s) => s.userId),
      "new_report_staff",
      { number: report.number, title: report.title, category: category.name as Record<string, string> },
      { reportId: report.id, link: `/admin/reports/${report.number}`, channels: { email: false, sms: false, inApp: true } },
    );
  }
  return report;
}

function locationData(l: LocationInput) {
  return {
    lat: l.lat,
    lng: l.lng,
    street: l.street ?? null,
    streetNumber: l.streetNumber ?? null,
    district: l.district ?? null,
    formattedAddress: l.formattedAddress ?? ([l.street, l.streetNumber].filter(Boolean).join(" ") || null),
    source: l.source ?? "map",
  };
}

// ─── Public queries ────────────────────────────────────────────────

type WhereOpts = { skip?: "status" | "category" };

async function buildWhere(f: ReportFilters, actor: Actor | null, opts: WhereOpts = {}): Promise<Prisma.ReportWhereInput> {
  const and: Prisma.ReportWhereInput[] = [];
  if (f.mine) {
    if (!actor) throw Errors.unauthorized();
    and.push({ reporterId: actor.id });
  } else {
    and.push({ isPublic: true, category: { isSensitive: false } });
  }
  if (opts.skip !== "status" && f.status.length) {
    and.push({ statusId: { in: await statusIdsForGroups(f.status) } });
  }
  if (opts.skip !== "category" && f.category.length) {
    and.push({ category: { slug: { in: f.category } } });
  }
  const { from, to } = resolveDateRange(f);
  if (from || to) and.push({ createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } });
  if (f.q) {
    const q = f.q;
    and.push({
      OR: [
        { number: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { location: { is: { formattedAddress: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }
  if (f.bbox) {
    const [w, s, e, n] = f.bbox;
    and.push({ location: { is: { lng: { gte: w, lte: e }, lat: { gte: s, lte: n } } } });
  }
  return { AND: and };
}

const orderFor = (sort: ReportFilters["sort"]): Prisma.ReportOrderByWithRelationInput =>
  sort === "oldest" ? { createdAt: "asc" } : sort === "updated" ? { updatedAt: "desc" } : { createdAt: "desc" };

/** GeoJSON-friendly list for the map (reports with a location only). */
export async function mapReports(f: ReportFilters, actor: Actor | null, locale: Locale): Promise<MapReportDTO[]> {
  const where = await buildWhere({ ...f, bbox: null }, actor);
  const rows = await db.report.findMany({
    where: { AND: [where, { location: { isNot: null } }] },
    orderBy: { createdAt: "desc" },
    take: 5000,
    select: {
      id: true,
      number: true,
      title: true,
      description: true,
      createdAt: true,
      status: true,
      category: { select: { name: true } },
      location: { select: { lat: true, lng: true } },
      attachments: {
        where: { isPublic: true, mimeType: { startsWith: "image/" } },
        select: { id: true },
        take: 4,
        orderBy: { createdAt: "asc" },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    title: r.title,
    excerpt: excerpt(r.description, 220),
    lat: r.location!.lat,
    lng: r.location!.lng,
    status: r.status.key,
    group: r.status.publicGroup,
    color: r.status.color,
    statusLabel: tr(r.status.label, locale),
    category: tr(r.category.name, locale),
    createdAt: r.createdAt.toISOString(),
    photos: r.attachments.map((a) => fileUrl(a.id)),
  }));
}

export async function listReports(f: ReportFilters, actor: Actor | null, locale: Locale): Promise<Paginated<ListReportDTO>> {
  const where = await buildWhere(f, actor);
  const [total, rows] = await Promise.all([
    db.report.count({ where }),
    db.report.findMany({
      where,
      orderBy: orderFor(f.sort),
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      include: {
        status: true,
        category: true,
        location: true,
        attachments: { where: { isPublic: true, mimeType: { startsWith: "image/" } }, select: { id: true }, orderBy: { createdAt: "asc" } },
      },
    }),
  ]);
  return {
    items: rows.map((r) => ({
      id: r.id,
      number: r.number,
      title: r.title,
      excerpt: excerpt(r.description),
      status: statusDTO(r.status, locale),
      category: { slug: r.category.slug, name: tr(r.category.name, locale), color: r.category.color },
      address: r.location?.formattedAddress ?? r.location?.street ?? null,
      lat: r.location?.lat ?? null,
      lng: r.location?.lng ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      photo: r.attachments[0] ? fileUrl(r.attachments[0].id) : null,
      photoCount: r.attachments.length,
    })),
    total,
    page: f.page,
    pageSize: f.pageSize,
    pages: Math.max(1, Math.ceil(total / f.pageSize)),
  };
}

/** Counts for the filter panel (status counts ignore the status filter; category counts ignore the category filter). */
export async function reportFacets(
  f: ReportFilters,
  actor: Actor | null,
  locale: Locale,
): Promise<{ statuses: StatusGroupDTO[]; categories: CategoryFacet[] }> {
  const [whereS, whereC, groups, cats, { rows: statusRows }] = await Promise.all([
    buildWhere({ ...f, bbox: null }, actor, { skip: "status" }),
    buildWhere({ ...f, bbox: null }, actor, { skip: "category" }),
    statusGroups(locale),
    db.category.findMany({ where: { parentId: null, isActive: true, ...(f.mine ? {} : { isSensitive: false }) } }),
    loadWorkflow(),
  ]);
  const [byStatus, byCategory] = await Promise.all([
    db.report.groupBy({ by: ["statusId"], where: whereS, _count: { _all: true } }),
    db.report.groupBy({ by: ["categoryId"], where: whereC, _count: { _all: true } }),
  ]);
  const groupOf = new Map(statusRows.map((s) => [s.id, s.publicGroup]));
  const groupCounts = new Map<string, number>();
  for (const s of byStatus) {
    const g = groupOf.get(s.statusId);
    if (g) groupCounts.set(g, (groupCounts.get(g) ?? 0) + s._count._all);
  }
  const catCounts = new Map(byCategory.map((c) => [c.categoryId, c._count._all]));
  return {
    statuses: groups.map((g) => ({ ...g, count: groupCounts.get(g.key) ?? 0 })),
    categories: cats
      .map((c) => ({ slug: c.slug, name: tr(c.name, locale), color: c.color, count: catCounts.get(c.id) ?? 0 }))
      .sort((a, b) => a.name.localeCompare(b.name, locale)),
  };
}

// ─── Detail ────────────────────────────────────────────────────────

const detailInclude = {
  status: true,
  category: true,
  subcategory: true,
  location: true,
  reporter: true,
  department: true,
  assignee: { include: { user: true } },
  history: { include: { actor: true }, orderBy: { createdAt: "asc" as const } },
  comments: { include: { author: true }, orderBy: { createdAt: "asc" as const } },
  attachments: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.ReportInclude;

type ReportWithDetail = Prisma.ReportGetPayload<{ include: typeof detailInclude }>;

async function findReport(idOrNumber: string) {
  return db.report.findFirst({
    where: { OR: [{ id: idOrNumber }, { number: idOrNumber }] },
    include: detailInclude,
  });
}

function toDetail(r: ReportWithDetail, actor: Actor | null, locale: Locale, statusById: Map<string, Parameters<typeof statusDTO>[0]>): ReportDetailDTO {
  const staff = canViewPrivate(actor);
  const owner = !!actor && r.reporterId === actor.id;
  const attachments: AttachmentDTO[] = r.attachments
    .filter((a) => a.isPublic || staff || (owner && a.kind === "CITIZEN"))
    .map((a) => ({
      id: a.id,
      name: a.originalName,
      mimeType: a.mimeType,
      size: a.size,
      url: fileUrl(a.id),
      isImage: a.mimeType.startsWith("image/"),
      isPublic: a.isPublic,
      kind: a.kind,
      createdAt: a.createdAt.toISOString(),
    }));
  return {
    id: r.id,
    number: r.number,
    title: r.title,
    description: r.description,
    isPublic: r.isPublic && !r.category.isSensitive,
    status: statusDTO(r.status, locale),
    category: { id: r.category.id, slug: r.category.slug, name: tr(r.category.name, locale), color: r.category.color },
    subcategory: r.subcategory ? { id: r.subcategory.id, name: tr(r.subcategory.name, locale) } : null,
    location: r.location
      ? {
          lat: r.location.lat,
          lng: r.location.lng,
          street: r.location.street,
          streetNumber: r.location.streetNumber,
          district: r.location.district,
          formattedAddress: r.location.formattedAddress,
        }
      : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
    dueAt: staff || owner ? (r.dueAt?.toISOString() ?? null) : null,
    redirectedTo: r.redirectedTo,
    resolution: r.resolution,
    history: r.history
      .filter((h) => h.isPublic || staff || owner)
      .map((h) => {
        const st = statusById.get(h.toStatusId)!;
        return {
          id: h.id,
          at: h.createdAt.toISOString(),
          status: statusDTO(st, locale),
          note: h.isPublic || staff ? h.note : null,
          isPublic: h.isPublic,
          actorName: staff ? fullName(h.actor) : null,
        };
      }),
    comments: r.comments
      .filter((c) =>
        staff ? true : c.visibility === "PUBLIC" && (c.kind === "UPDATE" || c.kind === "RESPONSE" || (owner && c.kind === "CITIZEN")),
      )
      .map((c) => ({
        id: c.id,
        kind: c.kind,
        visibility: c.visibility,
        body: c.body,
        at: c.createdAt.toISOString(),
        authorName: staff ? fullName(c.author) : c.kind === "CITIZEN" ? null : tr(branding.organizationName, locale),
      })),
    attachments,
    viewer: {
      isOwner: owner,
      isStaff: staff,
      canComment: canCommentAsCitizen(actor, scopeOf(r)) && !r.status.isTerminal,
    },
  };
}

export async function getReportDetail(idOrNumber: string, actor: Actor | null, locale: Locale): Promise<ReportDetailDTO> {
  const r = await findReport(idOrNumber);
  if (!r || !canViewReport(actor, scopeOf(r))) throw Errors.notFound("Report");
  const { rows } = await loadWorkflow();
  return toDetail(r, actor, locale, new Map(rows.map((s) => [s.id, s])));
}

export async function getAdminReportDetail(idOrNumber: string, actor: Actor, locale: Locale): Promise<AdminReportDetailDTO> {
  assertCan(actor, PERMISSIONS.REPORT_READ_ANY);
  const r = await findReport(idOrNumber);
  if (!r) throw Errors.notFound("Report");
  const { wf, rows } = await loadWorkflow();
  const statusById = new Map(rows.map((s) => [s.id, s]));
  const base = toDetail(r, actor, locale, statusById);
  const canProcess = canProcessReport(actor, scopeOf(r));
  const logs = await db.auditLog.findMany({
    where: { entityType: "report", entityId: r.id },
    include: { actor: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return {
    ...base,
    isPublic: r.isPublic,
    reporter: r.reporter
      ? { id: r.reporter.id, name: fullName(r.reporter)!, email: r.reporter.email, phone: r.reporter.phone }
      : null,
    department: r.department ? { id: r.department.id, name: r.department.name } : null,
    assignee: r.assignee ? { id: r.assignee.id, name: fullName(r.assignee.user)! } : null,
    transitions: canProcess
      ? wf.available(r.statusId, actor.permissions).map((t) => {
          const s = statusById.get(t.toStatusId)!;
          return { key: s.key, label: tr(s.label, locale), color: s.color, requiresComment: t.requiresComment };
        })
      : [],
    canProcess,
    canAssign: can(actor, PERMISSIONS.REPORT_ASSIGN),
    canEdit: can(actor, PERMISSIONS.REPORT_EDIT),
    audit: logs.map((l) => ({
      id: l.id,
      action: l.action,
      at: l.createdAt.toISOString(),
      actorName: fullName(l.actor),
      data: l.data,
    })),
  };
}

// ─── Staff actions ─────────────────────────────────────────────────

export async function changeStatus(
  actor: Actor,
  idOrNumber: string,
  input: { status: string; note?: string | null; isPublic?: boolean; redirectedTo?: string | null; resolution?: string | null },
  meta: { ip?: string | null } = {},
) {
  const r = await findReport(idOrNumber);
  if (!r) throw Errors.notFound("Report");
  assertCanProcess(actor, scopeOf(r));
  const { wf, rows } = await loadWorkflow(true);
  const { to } = wf.validate(
    { fromStatusId: r.statusId, toStatusKey: input.status, note: input.note, redirectedTo: input.redirectedTo },
    actor.permissions,
  );
  const now = new Date();
  const toRow = rows.find((s) => s.id === to.id)!;
  const fromRow = rows.find((s) => s.id === r.statusId)!;

  const updated = await db.$transaction(async (tx) => {
    // Optimistic concurrency: only update if the status did not change meanwhile.
    const res = await tx.report.updateMany({
      where: { id: r.id, statusId: r.statusId },
      data: {
        statusId: to.id,
        redirectedTo: to.key === "redirected" ? input.redirectedTo ?? null : r.redirectedTo,
        resolution: to.isResolved ? input.resolution ?? r.resolution : r.resolution,
        resolvedAt: to.isResolved ? now : fromRow.isResolved && !to.isTerminal ? null : r.resolvedAt,
        closedAt: to.isTerminal ? now : null,
      },
    });
    if (res.count !== 1) throw Errors.conflict("The report was changed by someone else. Reload and try again.");
    await tx.reportStatusHistory.create({
      data: {
        reportId: r.id,
        fromStatusId: r.statusId,
        toStatusId: to.id,
        actorId: actor.id,
        note: input.note ?? null,
        isPublic: input.isPublic ?? true,
      },
    });
    await audit(
      {
        actorId: actor.id,
        action: "report.status_change",
        entityType: "report",
        entityId: r.id,
        data: { from: fromRow.key, to: to.key, note: input.note ?? null, redirectedTo: input.redirectedTo ?? null },
        ip: meta.ip,
      },
      tx,
    );
    return tx.report.findUniqueOrThrow({ where: { id: r.id } });
  });

  if (r.reporterId) {
    const link = `/reports/${r.number}`;
    const vars = { number: r.number, title: r.title, status: toRow.label as Record<string, string>, target: input.redirectedTo ?? "" };
    const event = to.key === "redirected" ? "report_redirected" : to.isResolved ? "report_resolved" : "status_changed";
    await notifyUser(r.reporterId, event, vars, { reportId: r.id, link });
  }
  return updated;
}

export async function updateReport(
  actor: Actor,
  idOrNumber: string,
  patch: {
    title?: string;
    categoryId?: string;
    subcategoryId?: string | null;
    departmentId?: string | null;
    assigneeId?: string | null;
    isPublic?: boolean;
    dueAt?: string | null;
    location?: LocationInput | null;
  },
  meta: { ip?: string | null } = {},
) {
  const r = await findReport(idOrNumber);
  if (!r) throw Errors.notFound("Report");
  const assignFields = ["departmentId", "assigneeId", "dueAt"] as const;
  const editFields = ["title", "categoryId", "subcategoryId", "isPublic", "location"] as const;
  if (assignFields.some((k) => patch[k] !== undefined)) assertCan(actor, PERMISSIONS.REPORT_ASSIGN);
  if (editFields.some((k) => patch[k] !== undefined)) assertCan(actor, PERMISSIONS.REPORT_EDIT);

  const data: Prisma.ReportUncheckedUpdateInput = {};
  const auditBefore: Record<string, unknown> = {};
  const auditAfter: Record<string, unknown> = {};
  const track = (k: string, before: unknown, after: unknown) => {
    auditBefore[k] = before;
    auditAfter[k] = after;
  };

  if (patch.title !== undefined) {
    data.title = patch.title;
    track("title", r.title, patch.title);
  }
  if (patch.categoryId !== undefined) {
    const cat = await db.category.findFirst({ where: { id: patch.categoryId, parentId: null }, include: { children: true } });
    if (!cat) throw Errors.validation("Invalid category");
    const subId = patch.subcategoryId ?? null;
    if (subId && !cat.children.some((c) => c.id === subId)) throw Errors.validation("Subcategory does not belong to category");
    data.categoryId = cat.id;
    data.subcategoryId = subId;
    track("categoryId", r.categoryId, cat.id);
    track("subcategoryId", r.subcategoryId, subId);
  }
  if (patch.isPublic !== undefined) {
    data.isPublic = patch.isPublic;
    track("isPublic", r.isPublic, patch.isPublic);
  }
  let newAssigneeUserId: string | null = null;
  if (patch.assigneeId !== undefined) {
    if (patch.assigneeId) {
      const emp = await db.employee.findUnique({ where: { id: patch.assigneeId } });
      if (!emp || !emp.isActive) throw Errors.validation("Invalid operator");
      const deptId = patch.departmentId ?? emp.departmentId;
      if (deptId !== emp.departmentId) throw Errors.validation("Operator does not belong to the selected department");
      data.assigneeId = emp.id;
      data.departmentId = emp.departmentId;
      track("departmentId", r.departmentId, emp.departmentId);
      if (emp.id !== r.assigneeId) newAssigneeUserId = emp.userId;
    } else {
      data.assigneeId = null;
    }
    track("assigneeId", r.assigneeId, data.assigneeId);
  }
  if (patch.departmentId !== undefined && data.departmentId === undefined) {
    if (patch.departmentId && !(await db.department.findUnique({ where: { id: patch.departmentId } }))) {
      throw Errors.validation("Invalid department");
    }
    data.departmentId = patch.departmentId;
    track("departmentId", r.departmentId, patch.departmentId);
    // Moving to another department clears an assignee from the old one.
    if (r.assignee && r.assignee.departmentId !== patch.departmentId && patch.assigneeId === undefined) {
      data.assigneeId = null;
      track("assigneeId", r.assigneeId, null);
    }
  }
  if (patch.dueAt !== undefined) {
    data.dueAt = patch.dueAt ? new Date(patch.dueAt) : null;
    track("dueAt", r.dueAt, data.dueAt);
  }

  const changes = diff(auditBefore, auditAfter);
  const locationChanged = patch.location !== undefined;

  await db.$transaction(async (tx) => {
    if (Object.keys(data).length) await tx.report.update({ where: { id: r.id }, data });
    if (locationChanged) {
      if (patch.location) {
        const ld = { ...locationData(patch.location), source: "admin" };
        await tx.reportLocation.upsert({ where: { reportId: r.id }, create: { reportId: r.id, ...ld }, update: ld });
      } else {
        await tx.reportLocation.deleteMany({ where: { reportId: r.id } });
      }
      await tx.report.update({ where: { id: r.id }, data: { updatedAt: new Date() } });
    }
    await audit(
      {
        actorId: actor.id,
        action: "report.update",
        entityType: "report",
        entityId: r.id,
        data: JSON.parse(
          JSON.stringify({
            ...changes,
            ...(locationChanged ? { location: { from: r.location ? [r.location.lat, r.location.lng] : null, to: patch.location ? [patch.location.lat, patch.location.lng] : null } } : {}),
          }),
        ),
        ip: meta.ip,
      },
      tx,
    );
  });

  if (newAssigneeUserId) {
    await notifyUser(
      newAssigneeUserId,
      "report_assigned",
      { number: r.number, title: r.title },
      { reportId: r.id, link: `/admin/reports/${r.number}` },
    );
  }
  return findReport(r.id);
}

export async function addComment(
  actor: Actor,
  idOrNumber: string,
  input: { body: string; kind: "UPDATE" | "RESPONSE" | "NOTE" | "CITIZEN" },
  meta: { ip?: string | null } = {},
) {
  const r = await findReport(idOrNumber);
  if (!r) throw Errors.notFound("Report");
  const scope = scopeOf(r);
  let visibility: "PUBLIC" | "INTERNAL" = "PUBLIC";
  if (input.kind === "CITIZEN") {
    if (!canCommentAsCitizen(actor, scope)) throw Errors.forbidden();
    if (r.status.isTerminal) throw Errors.conflict("The report is closed");
  } else if (input.kind === "NOTE") {
    assertCan(actor, PERMISSIONS.REPORT_COMMENT_INTERNAL);
    visibility = "INTERNAL";
  } else {
    assertCan(actor, PERMISSIONS.REPORT_COMMENT_PUBLIC);
    assertCanProcess(actor, scope);
  }
  const c = await db.$transaction(async (tx) => {
    const c = await tx.reportComment.create({
      data: { reportId: r.id, authorId: actor.id, body: input.body, kind: input.kind, visibility },
    });
    await tx.report.update({ where: { id: r.id }, data: { updatedAt: new Date() } });
    await audit(
      { actorId: actor.id, action: `report.comment.${input.kind.toLowerCase()}`, entityType: "report", entityId: r.id, data: { commentId: c.id }, ip: meta.ip },
      tx,
    );
    return c;
  });
  if ((input.kind === "UPDATE" || input.kind === "RESPONSE") && r.reporterId) {
    await notifyUser(r.reporterId, "admin_response", { number: r.number, title: r.title }, { reportId: r.id, link: `/reports/${r.number}` });
  }
  if (input.kind === "CITIZEN" && r.assignee) {
    await notifyUser(
      r.assignee.userId,
      "admin_response",
      { number: r.number, title: r.title },
      { reportId: r.id, link: `/admin/reports/${r.number}`, channels: { email: false, sms: false, inApp: true } },
    );
  }
  return c;
}

export async function addAttachments(
  actor: Actor,
  idOrNumber: string,
  files: UploadFile[],
  opts: { isPublic?: boolean } = {},
  meta: { ip?: string | null } = {},
) {
  const r = await findReport(idOrNumber);
  if (!r) throw Errors.notFound("Report");
  const scope = scopeOf(r);
  let kind: "CITIZEN" | "ADMIN";
  if (can(actor, PERMISSIONS.ATTACHMENT_UPLOAD_ADMIN) && canProcessReport(actor, scope)) {
    kind = "ADMIN";
  } else if (canCommentAsCitizen(actor, scope) && !r.status.isTerminal) {
    kind = "CITIZEN";
  } else {
    throw Errors.forbidden();
  }
  if (!files.length) throw Errors.validation("No files uploaded");
  const existing = r.attachments.filter((a) => a.kind === kind).length;
  const prepared = prepareFiles(files, kind === "CITIZEN" ? existing : 0);
  await storeFiles(prepared);
  try {
    const created = await db.$transaction(async (tx) => {
      const rows = await Promise.all(
        prepared.map((f) =>
          tx.reportAttachment.create({
            data: {
              reportId: r.id,
              uploaderId: actor.id,
              storageKey: f.key,
              originalName: f.name,
              mimeType: f.mime,
              size: f.size,
              kind,
              isPublic: kind === "CITIZEN" ? true : opts.isPublic ?? false,
            },
          }),
        ),
      );
      await tx.report.update({ where: { id: r.id }, data: { updatedAt: new Date() } });
      await audit(
        { actorId: actor.id, action: "report.attachment.add", entityType: "report", entityId: r.id, data: { ids: rows.map((x) => x.id), kind }, ip: meta.ip },
        tx,
      );
      return rows;
    });
    return created;
  } catch (e) {
    await removeFiles(prepared);
    throw e;
  }
}

export async function setAttachmentVisibility(actor: Actor, attachmentId: string, isPublic: boolean) {
  const a = await db.reportAttachment.findUnique({ where: { id: attachmentId }, include: { report: { include: { category: true } } } });
  if (!a) throw Errors.notFound("Attachment");
  if (!can(actor, PERMISSIONS.REPORT_EDIT)) assertCanProcess(actor, scopeOf(a.report));
  await db.reportAttachment.update({ where: { id: a.id }, data: { isPublic } });
  await audit({ actorId: actor.id, action: "report.attachment.visibility", entityType: "report", entityId: a.reportId, data: { attachmentId, isPublic } });
}

/** Returns file bytes if the actor may download the attachment. */
export async function readAttachment(actor: Actor | null, attachmentId: string) {
  const a = await db.reportAttachment.findUnique({ where: { id: attachmentId }, include: { report: { include: { category: true } } } });
  if (!a) throw Errors.notFound("File");
  const scope = scopeOf(a.report);
  const owner = !!actor && a.report.reporterId === actor.id;
  const allowed = isStaff(actor) || (owner && a.kind === "CITIZEN") || (a.isPublic && canViewReport(actor, scope));
  if (!allowed) throw Errors.notFound("File");
  const data = await getStorage().get(a.storageKey);
  if (!data) throw Errors.notFound("File");
  return { data, mimeType: a.mimeType, name: a.originalName, isPublic: a.isPublic && scope.isPublic && !scope.categorySensitive };
}

// ─── Admin list ────────────────────────────────────────────────────

export async function adminListReports(
  actor: Actor,
  q: {
    q?: string;
    status: string[];
    category?: string;
    department?: string;
    assignee?: string;
    overdue: boolean;
    sort: "newest" | "oldest" | "updated" | "due";
    page: number;
    pageSize: number;
  },
  locale: Locale,
) {
  assertCan(actor, PERMISSIONS.REPORT_READ_ANY);
  const and: Prisma.ReportWhereInput[] = [];
  if (q.status.length) and.push({ status: { key: { in: q.status } } });
  if (q.category) and.push({ OR: [{ categoryId: q.category }, { subcategoryId: q.category }] });
  if (q.department) and.push(q.department === "none" ? { departmentId: null } : { departmentId: q.department });
  if (q.assignee === "me") and.push({ assigneeId: actor.employeeId ?? "__none__" });
  else if (q.assignee === "none") and.push({ assigneeId: null });
  else if (q.assignee) and.push({ assigneeId: q.assignee });
  if (q.overdue) and.push({ dueAt: { lt: new Date() }, status: { isTerminal: false, isResolved: false } });
  if (q.q) {
    and.push({
      OR: [
        { number: { contains: q.q, mode: "insensitive" } },
        { title: { contains: q.q, mode: "insensitive" } },
        { description: { contains: q.q, mode: "insensitive" } },
        { location: { is: { formattedAddress: { contains: q.q, mode: "insensitive" } } } },
        { reporter: { is: { OR: [{ email: { contains: q.q, mode: "insensitive" } }, { lastName: { contains: q.q, mode: "insensitive" } }, { phone: { contains: q.q } }] } } },
      ],
    });
  }
  const where: Prisma.ReportWhereInput = { AND: and };
  const orderBy: Prisma.ReportOrderByWithRelationInput =
    q.sort === "oldest" ? { createdAt: "asc" } : q.sort === "updated" ? { updatedAt: "desc" } : q.sort === "due" ? { dueAt: { sort: "asc", nulls: "last" } } : { createdAt: "desc" };
  const [total, rows] = await Promise.all([
    db.report.count({ where }),
    db.report.findMany({
      where,
      orderBy,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: { status: true, category: true, department: true, assignee: { include: { user: true } }, reporter: true, location: true },
    }),
  ]);
  const now = Date.now();
  return {
    total,
    page: q.page,
    pageSize: q.pageSize,
    pages: Math.max(1, Math.ceil(total / q.pageSize)),
    items: rows.map((r) => ({
      id: r.id,
      number: r.number,
      title: r.title,
      status: statusDTO(r.status, locale),
      category: tr(r.category.name, locale),
      department: r.department?.name ?? null,
      assignee: r.assignee ? fullName(r.assignee.user) : null,
      reporter: fullName(r.reporter),
      address: r.location?.formattedAddress ?? null,
      isPublic: r.isPublic,
      createdAt: r.createdAt.toISOString(),
      dueAt: r.dueAt?.toISOString() ?? null,
      overdue: !!r.dueAt && r.dueAt.getTime() < now && !r.status.isTerminal && !r.status.isResolved,
    })),
  };
}

export { AppError };
