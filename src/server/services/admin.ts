/**
 * Back-office use-cases: statistics, users, departments, workflow configuration, audit.
 */
import { db } from "@/lib/db";
import { AppError, Errors } from "@/lib/errors";
import { tr, type Locale } from "@/lib/i18n/core";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { assertCan, canAssignRole, type Actor } from "@/lib/rbac/policy";
import { audit, diff } from "./audit";
import { invalidateWorkflow, loadWorkflow } from "./workflow";
import { requestPasswordReset } from "./auth";
import type { z } from "zod";
import type {
  adminUserCreateSchema,
  adminUserUpdateSchema,
  departmentSchema,
  statusSchema,
} from "@/lib/validation/schemas";

// ─── Statistics ────────────────────────────────────────────────────

export async function dashboardStats(actor: Actor, locale: Locale) {
  assertCan(actor, PERMISSIONS.STATS_READ);
  const { rows: statuses } = await loadWorkflow();
  const now = new Date();
  const since = new Date(now.getTime() - 30 * 86_400_000);
  since.setHours(0, 0, 0, 0);

  const [total, byStatus, overdue, unassigned, mine, recent, openByCategory, openByDept, resolved] = await Promise.all([
    db.report.count(),
    db.report.groupBy({ by: ["statusId"], _count: { _all: true } }),
    db.report.count({ where: { dueAt: { lt: now }, status: { isTerminal: false, isResolved: false } } }),
    db.report.count({ where: { assigneeId: null, status: { isTerminal: false, isResolved: false } } }),
    actor.employeeId
      ? db.report.count({ where: { assigneeId: actor.employeeId, status: { isTerminal: false, isResolved: false } } })
      : Promise.resolve(0),
    db.$queryRaw<{ day: Date; n: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day, count(*) AS n
      FROM reports WHERE "createdAt" >= ${since}
      GROUP BY 1 ORDER BY 1`,
    db.report.groupBy({
      by: ["categoryId"],
      where: { status: { isTerminal: false, isResolved: false } },
      _count: { _all: true },
    }),
    db.report.groupBy({
      by: ["departmentId"],
      where: { status: { isTerminal: false, isResolved: false } },
      _count: { _all: true },
    }),
    db.report.findMany({ where: { resolvedAt: { not: null } }, select: { createdAt: true, resolvedAt: true }, take: 2000, orderBy: { resolvedAt: "desc" } }),
  ]);

  const statusCounts = statuses.map((s) => ({
    key: s.key,
    label: tr(s.label, locale),
    color: s.color,
    group: s.publicGroup,
    count: byStatus.find((b) => b.statusId === s.id)?._count._all ?? 0,
  }));
  const groupCount = (group: string) => statusCounts.filter((s) => s.group === group).reduce((a, b) => a + b.count, 0);
  const statusCount = (key: string) => statusCounts.find((s) => s.key === key)?.count ?? 0;

  const days: { day: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    const hit = recent.find((r) => new Date(r.day).toISOString().slice(0, 10) === key);
    days.push({ day: key, count: hit ? Number(hit.n) : 0 });
  }

  const [cats, depts] = await Promise.all([
    db.category.findMany({ where: { id: { in: openByCategory.map((c) => c.categoryId) } } }),
    db.department.findMany({ where: { id: { in: openByDept.map((d) => d.departmentId).filter((x): x is string => !!x) } } }),
  ]);

  const avgMs = resolved.length
    ? resolved.reduce((a, r) => a + (r.resolvedAt!.getTime() - r.createdAt.getTime()), 0) / resolved.length
    : 0;

  return {
    total,
    kpis: {
      new: groupCount("submitted"),
      assigned: statusCount("assigned"),
      inProgress: groupCount("in_progress"),
      planned: groupCount("planned"),
      resolved: groupCount("resolved") + groupCount("closed"),
      redirected: groupCount("redirected"),
      overdue,
      unassigned,
      mine,
    },
    statusCounts,
    last30: days,
    byCategory: openByCategory
      .map((c) => {
        const cat = cats.find((x) => x.id === c.categoryId);
        return { name: cat ? tr(cat.name, locale) : "?", color: cat?.color ?? "#64748b", count: c._count._all };
      })
      .sort((a, b) => b.count - a.count),
    byDepartment: openByDept
      .map((d) => ({ name: depts.find((x) => x.id === d.departmentId)?.name ?? null, count: d._count._all }))
      .sort((a, b) => b.count - a.count),
    avgResolutionDays: Math.round((avgMs / 86_400_000) * 10) / 10,
  };
}

// ─── Users ─────────────────────────────────────────────────────────

export async function listUsers(actor: Actor, q: { q?: string; role?: string; page: number; pageSize: number }) {
  assertCan(actor, PERMISSIONS.USER_READ);
  const where = {
    AND: [
      q.role ? { role: { key: q.role } } : {},
      q.q
        ? {
            OR: [
              { email: { contains: q.q, mode: "insensitive" as const } },
              { firstName: { contains: q.q, mode: "insensitive" as const } },
              { lastName: { contains: q.q, mode: "insensitive" as const } },
              { phone: { contains: q.q } },
            ],
          }
        : {},
    ],
  };
  const [total, items] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      include: { role: true, employee: { include: { department: true } }, _count: { select: { reports: true } } },
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  return { total, items, page: q.page, pages: Math.max(1, Math.ceil(total / q.pageSize)) };
}

export async function updateUser(actor: Actor, userId: string, input: z.infer<typeof adminUserUpdateSchema>) {
  assertCan(actor, PERMISSIONS.USER_MANAGE);
  const user = await db.user.findUnique({ where: { id: userId }, include: { role: true, employee: true } });
  if (!user) throw Errors.notFound("User");
  if (user.id === actor.id && (input.isActive === false || (input.roleKey && input.roleKey !== user.role.key))) {
    throw Errors.badRequest("You cannot deactivate yourself or change your own role");
  }
  const changes: Record<string, unknown> = {};
  await db.$transaction(async (tx) => {
    if (input.roleKey && input.roleKey !== user.role.key) {
      if (!canAssignRole(actor, input.roleKey, user.role.key)) throw Errors.forbidden("You cannot assign this role");
      const role = await tx.role.findUnique({ where: { key: input.roleKey } });
      if (!role) throw Errors.validation("Unknown role");
      await tx.user.update({ where: { id: user.id }, data: { roleId: role.id } });
      changes.role = { from: user.role.key, to: role.key };
    }
    if (input.isActive !== undefined && input.isActive !== user.isActive) {
      if (!canAssignRole(actor, user.role.key, user.role.key)) throw Errors.forbidden("You cannot manage this user");
      await tx.user.update({ where: { id: user.id }, data: { isActive: input.isActive } });
      if (!input.isActive) await tx.session.deleteMany({ where: { userId: user.id } });
      changes.isActive = { from: user.isActive, to: input.isActive };
    }
    if (input.departmentId !== undefined) {
      if (input.departmentId) {
        await tx.employee.upsert({
          where: { userId: user.id },
          create: { userId: user.id, departmentId: input.departmentId, jobTitle: input.jobTitle ?? null },
          update: { departmentId: input.departmentId, jobTitle: input.jobTitle ?? user.employee?.jobTitle ?? null, isActive: true },
        });
      } else if (user.employee) {
        await tx.employee.update({ where: { id: user.employee.id }, data: { isActive: false } });
        await tx.report.updateMany({ where: { assigneeId: user.employee.id, status: { isTerminal: false } }, data: { assigneeId: null } });
      }
      changes.department = { from: user.employee?.isActive ? user.employee.departmentId : null, to: input.departmentId };
    }
    await audit({ actorId: actor.id, action: "user.update", entityType: "user", entityId: user.id, data: JSON.parse(JSON.stringify(changes)) }, tx);
  });
}

export async function createStaffUser(actor: Actor, input: z.infer<typeof adminUserCreateSchema>) {
  assertCan(actor, PERMISSIONS.USER_MANAGE);
  if (!canAssignRole(actor, input.roleKey)) throw Errors.forbidden("You cannot assign this role");
  const role = await db.role.findUnique({ where: { key: input.roleKey } });
  if (!role) throw Errors.validation("Unknown role");
  if (await db.user.findUnique({ where: { email: input.email } })) throw new AppError(409, "EMAIL_TAKEN", "E-mail already in use");
  const user = await db.user.create({
    data: {
      email: input.email,
      phone: input.phone,
      firstName: input.firstName,
      lastName: input.lastName,
      roleId: role.id,
      passwordHash: null, // user sets it through the reset link
      employee: input.departmentId ? { create: { departmentId: input.departmentId, jobTitle: input.jobTitle ?? null } } : undefined,
    },
  });
  await audit({ actorId: actor.id, action: "user.create", entityType: "user", entityId: user.id, data: { role: role.key } });
  await requestPasswordReset(user.email!);
  return user;
}

export async function listRoles() {
  return db.role.findMany({ orderBy: { createdAt: "asc" } });
}

// ─── Departments ───────────────────────────────────────────────────

export async function listDepartments() {
  return db.department.findMany({
    include: {
      employees: { where: { isActive: true }, include: { user: true } },
      _count: { select: { categories: true, reports: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function saveDepartment(actor: Actor, id: string | null, input: z.infer<typeof departmentSchema>) {
  assertCan(actor, PERMISSIONS.DEPARTMENT_MANAGE);
  const clash = await db.department.findUnique({ where: { code: input.code } });
  if (clash && clash.id !== id) throw Errors.conflict("Code already in use");
  if (id) {
    const before = await db.department.findUnique({ where: { id } });
    if (!before) throw Errors.notFound("Department");
    const d = await db.department.update({ where: { id }, data: input });
    await audit({
      actorId: actor.id,
      action: "department.update",
      entityType: "department",
      entityId: id,
      data: JSON.parse(JSON.stringify(diff(before as unknown as Record<string, unknown>, input))),
    });
    return d;
  }
  const d = await db.department.create({ data: input });
  await audit({ actorId: actor.id, action: "department.create", entityType: "department", entityId: d.id, data: { code: d.code } });
  return d;
}

// ─── Workflow configuration ────────────────────────────────────────

export async function saveStatus(actor: Actor, id: string | null, input: z.infer<typeof statusSchema>) {
  assertCan(actor, PERMISSIONS.WORKFLOW_MANAGE);
  const clash = await db.reportStatus.findUnique({ where: { key: input.key } });
  if (clash && clash.id !== id) throw Errors.conflict("Key already in use");
  const res = await db.$transaction(async (tx) => {
    if (input.isInitial) await tx.reportStatus.updateMany({ where: { isInitial: true, NOT: { id: id ?? "" } }, data: { isInitial: false } });
    const s = id ? await tx.reportStatus.update({ where: { id }, data: input }) : await tx.reportStatus.create({ data: input });
    if (!(await tx.reportStatus.count({ where: { isInitial: true, isActive: true } }))) {
      throw Errors.validation("Exactly one active initial status is required");
    }
    await audit({ actorId: actor.id, action: id ? "workflow.status.update" : "workflow.status.create", entityType: "status", entityId: s.id, data: input }, tx);
    return s;
  });
  invalidateWorkflow();
  return res;
}

export async function replaceTransitions(
  actor: Actor,
  transitions: { fromStatusId: string; toStatusId: string; requiresComment: boolean }[],
) {
  assertCan(actor, PERMISSIONS.WORKFLOW_MANAGE);
  const ids = new Set((await db.reportStatus.findMany({ select: { id: true } })).map((s) => s.id));
  for (const t of transitions) {
    if (!ids.has(t.fromStatusId) || !ids.has(t.toStatusId) || t.fromStatusId === t.toStatusId) {
      throw Errors.validation("Invalid transition");
    }
  }
  await db.$transaction(async (tx) => {
    const before = await tx.statusTransition.findMany();
    await tx.statusTransition.deleteMany();
    await tx.statusTransition.createMany({
      data: transitions.map((t) => ({ ...t, permission: before.find((b) => b.fromStatusId === t.fromStatusId && b.toStatusId === t.toStatusId)?.permission ?? null })),
    });
    await audit(
      { actorId: actor.id, action: "workflow.transitions.replace", entityType: "workflow", data: { before: before.length, after: transitions.length } },
      tx,
    );
  });
  invalidateWorkflow();
}

// ─── Audit ─────────────────────────────────────────────────────────

export async function listAudit(actor: Actor, q: { entityType?: string; action?: string; page: number; pageSize: number }) {
  assertCan(actor, PERMISSIONS.AUDIT_READ);
  const where = {
    ...(q.entityType ? { entityType: q.entityType } : {}),
    ...(q.action ? { action: { startsWith: q.action } } : {}),
  };
  const [total, items] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where, include: { actor: true }, orderBy: { createdAt: "desc" }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
  ]);
  return { total, items, page: q.page, pages: Math.max(1, Math.ceil(total / q.pageSize)) };
}
