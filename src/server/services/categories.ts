import { db } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { tr, type Locale } from "@/lib/i18n/core";
import type { Actor } from "@/lib/rbac/policy";
import { assertCan } from "@/lib/rbac/policy";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import type { CategoryDTO } from "@/types/reports";
import type { categorySchema } from "@/lib/validation/schemas";
import type { z } from "zod";
import { audit, diff } from "./audit";

/** Active category tree for the public UI. */
export async function listCategories(locale: Locale, opts: { includeSensitive?: boolean } = {}): Promise<CategoryDTO[]> {
  const rows = await db.category.findMany({
    where: { isActive: true, parentId: null, ...(opts.includeSensitive ? {} : {}) },
    include: { children: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }] } },
    orderBy: [{ sortOrder: "asc" }],
  });
  return rows
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      name: tr(c.name, locale),
      color: c.color,
      notice: c.notice ? tr(c.notice, locale) || null : null,
      isSensitive: c.isSensitive,
      children: c.children
        .map((s) => ({ id: s.id, slug: s.slug, name: tr(s.name, locale), notice: s.notice ? tr(s.notice, locale) || null : null }))
        .sort((a, b) => a.name.localeCompare(b.name, locale)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}

export async function adminListCategories() {
  return db.category.findMany({
    include: { department: true, _count: { select: { reports: true, subReports: true } } },
    orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { slug: "asc" }],
  });
}

type CategoryInput = z.infer<typeof categorySchema>;

async function validateParent(parentId: string | null | undefined, selfId?: string) {
  if (!parentId) return;
  if (parentId === selfId) throw Errors.validation("A category cannot be its own parent");
  const parent = await db.category.findUnique({ where: { id: parentId } });
  if (!parent) throw Errors.validation("Parent category not found");
  if (parent.parentId) throw Errors.validation("Only two levels (category → subcategory) are supported");
  if (selfId && (await db.category.count({ where: { parentId: selfId } })) > 0) {
    throw Errors.validation("A category with subcategories cannot become a subcategory");
  }
}

export async function createCategory(actor: Actor, input: CategoryInput) {
  assertCan(actor, PERMISSIONS.CATEGORY_MANAGE);
  await validateParent(input.parentId);
  if (await db.category.findUnique({ where: { slug: input.slug } })) throw Errors.conflict("Slug already in use");
  const c = await db.category.create({
    data: {
      slug: input.slug,
      name: input.name,
      notice: input.notice && (input.notice.ro || input.notice.en) ? input.notice : undefined,
      color: input.color,
      parentId: input.parentId ?? null,
      departmentId: input.departmentId ?? null,
      slaDays: input.slaDays ?? null,
      isSensitive: input.isSensitive,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
    },
  });
  await audit({ actorId: actor.id, action: "category.create", entityType: "category", entityId: c.id, data: { slug: c.slug } });
  return c;
}

export async function updateCategory(actor: Actor, id: string, input: CategoryInput) {
  assertCan(actor, PERMISSIONS.CATEGORY_MANAGE);
  const before = await db.category.findUnique({ where: { id } });
  if (!before) throw Errors.notFound("Category");
  await validateParent(input.parentId, id);
  const clash = await db.category.findUnique({ where: { slug: input.slug } });
  if (clash && clash.id !== id) throw Errors.conflict("Slug already in use");
  const data = {
    slug: input.slug,
    name: input.name,
    notice: input.notice && (input.notice.ro || input.notice.en) ? input.notice : undefined,
    color: input.color,
    parentId: input.parentId ?? null,
    departmentId: input.departmentId ?? null,
    slaDays: input.slaDays ?? null,
    isSensitive: input.isSensitive,
    isActive: input.isActive,
    sortOrder: input.sortOrder,
  };
  const c = await db.category.update({ where: { id }, data });
  await audit({
    actorId: actor.id,
    action: "category.update",
    entityType: "category",
    entityId: id,
    data: JSON.parse(JSON.stringify(diff(before as unknown as Record<string, unknown>, data))),
  });
  return c;
}
