const { Prisma } = require('@prisma/client');
const { prisma } = require('../config/db');
const { toApi, toApiList } = require('../utils/toApi');
const asyncHandler = require('../utils/asyncHandler');
const slugify = require('../utils/slugify');
const pick = require('../utils/pick');
const { runWorkflows } = require('../services/workflowService');
const { writeAudit } = require('../utils/audit');
const { SYSTEM_CUSTOM_MODULES } = require('../services/tenantBootstrap');
const { assertWithinLimit, getPlanLimits } = require('../services/planLimits');
const {
  MODULE_CATALOG,
  getCatalogItem,
  planUnlocked,
} = require('../constants/moduleCatalog');
const {
  syncCustomModulesIntoSidebar,
  removeCustomModuleSidebarLinks,
} = require('../services/moduleNavSync');

// Mongoose allowed sorting by `_id`; Prisma uses `id`. JSON paths (values.*) cannot be sorted here.
const RECORD_SORT_FIELDS = { createdAt: 'createdAt', updatedAt: 'updatedAt', _id: 'id', id: 'id' };

function userIdOf(user) {
  return user?.id ?? user?._id ?? null;
}

/** Nullable Json columns need Prisma.DbNull instead of a bare `null`. */
function jsonOrNull(value) {
  return value === null ? Prisma.DbNull : value;
}

function toInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

async function ensureSystemCustomModules(tenantId) {
  for (const m of SYSTEM_CUSTOM_MODULES) {
    const existing = await prisma.customModule.findFirst({
      where: { tenantId, systemKey: m.systemKey },
    });
    if (existing) continue;
    try {
      await prisma.customModule.create({
        data: {
          tenantId,
          name: m.name,
          slug: m.slug,
          systemKey: m.systemKey,
          order: m.order,
          isSystem: true,
          description: `System ${m.name} module`,
        },
      });
    } catch (err) {
      // Concurrent request created it first (unique tenantId+slug) — safe to ignore.
      if (err.code !== 'P2002') throw err;
    }
  }
}

function findModule(req) {
  return prisma.customModule.findFirst({
    where: { id: req.params.id, tenantId: req.tenantId },
  });
}

const listModules = asyncHandler(async (req, res) => {
  await ensureSystemCustomModules(req.tenantId);
  const modules = await prisma.customModule.findMany({
    where: { tenantId: req.tenantId },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
  });
  res.json({ modules: toApiList(modules) });
});

/** Zoho-style gallery: ready modules unlocked by subscription plan. */
const listCatalog = asyncHandler(async (req, res) => {
  await ensureSystemCustomModules(req.tenantId);
  const { subscription, limits } = await getPlanLimits(req.tenantId);
  const planCode = subscription?.plan?.code || 'trial';
  const installed = await prisma.customModule.findMany({
    where: { tenantId: req.tenantId, isSystem: false },
    select: { id: true, slug: true, name: true },
  });
  const installedSlugs = new Set(installed.map((m) => m.slug));
  const used = installed.length;
  const max = Number(limits?.modules);
  const catalog = MODULE_CATALOG.map((item) => {
    const unlocked = planUnlocked(planCode, item.minPlan);
    const already = installedSlugs.has(item.id) || installedSlugs.has(slugify(item.name));
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      icon: item.icon,
      minPlan: item.minPlan,
      fieldCount: (item.fields || []).length,
      convertToStudent: Boolean(item.convertToStudent),
      unlocked,
      installed: already,
      lockedReason: unlocked
        ? null
        : `Unlock on ${item.minPlan} plan or higher`,
    };
  });
  res.json({
    planCode,
    usage: {
      used,
      limit: Number.isFinite(max) ? max : null,
    },
    catalog,
  });
});

const installCatalogModule = asyncHandler(async (req, res) => {
  const catalogId = String(req.body.catalogId || req.params.catalogId || '').trim();
  const item = getCatalogItem(catalogId);
  if (!item) {
    res.status(404);
    throw new Error('Catalog module not found');
  }

  const { subscription } = await getPlanLimits(req.tenantId);
  const planCode = subscription?.plan?.code || 'trial';
  if (!planUnlocked(planCode, item.minPlan)) {
    res.status(402);
    throw new Error(`“${item.name}” needs ${item.minPlan} plan or higher. Upgrade to unlock.`);
  }

  await assertWithinLimit(req.tenantId, 'modules');

  const slug = item.id;
  const existing = await prisma.customModule.findUnique({
    where: { tenantId_slug: { tenantId: req.tenantId, slug } },
  });
  if (existing) {
    res.status(409);
    throw new Error(`“${item.name}” is already installed`);
  }

  const last = await prisma.customModule.findFirst({
    where: { tenantId: req.tenantId },
    orderBy: { order: 'desc' },
  });

  const module = await prisma.customModule.create({
    data: {
      tenantId: req.tenantId,
      name: item.name,
      slug,
      icon: item.icon || 'box',
      description: item.description || '',
      order: last ? last.order + 1 : 0,
      isSystem: false,
      systemKey: `catalog:${item.id}`,
    },
  });

  if ((item.fields || []).length) {
    await prisma.customField.createMany({
      data: item.fields.map((f, i) => ({
        tenantId: req.tenantId,
        moduleId: module.id,
        name: f.name,
        key: f.key,
        type: f.type,
        required: Boolean(f.required),
        placeholder: f.placeholder || '',
        options: f.options || [],
        order: i,
      })),
    });
  }

  await writeAudit({
    tenantId: req.tenantId,
    userId: userIdOf(req.user),
    action: 'module.install',
    entityType: 'CustomModule',
    entityId: module.id,
    meta: { catalogId: item.id },
  });

  await syncCustomModulesIntoSidebar(req.tenantId);

  const fields = await prisma.customField.findMany({
    where: { moduleId: module.id },
    orderBy: { order: 'asc' },
  });

  res.status(201).json({
    module: toApi(module),
    fields: toApiList(fields),
  });
});

/** Convert a Leads (or catalog convertToStudent) record into a Student. */
const convertRecordToStudent = asyncHandler(async (req, res) => {
  const module = await findModule(req);
  if (!module) {
    res.status(404);
    throw new Error('Module not found');
  }

  const catalogId = String(module.systemKey || '').replace(/^catalog:/, '') || module.slug;
  const catalogItem = getCatalogItem(catalogId);
  if (!catalogItem?.convertToStudent) {
    res.status(400);
    throw new Error('This module does not support convert to student');
  }

  const record = await prisma.record.findFirst({
    where: { id: req.params.recordId, moduleId: module.id, tenantId: req.tenantId },
  });
  if (!record) {
    res.status(404);
    throw new Error('Record not found');
  }

  const values = record.values || {};
  if (values.converted_student_id) {
    res.status(409);
    throw new Error('This lead was already converted to a student');
  }

  const studentName =
    String(values.student_name || values.contact_name || values.name || '').trim() || 'New student';
  const phone = String(values.phone || values.parent_phone || '').trim();
  const email = String(values.email || values.parent_email || '').trim().toLowerCase();
  const parentName = String(values.contact_name || values.parent_name || '').trim();
  const interest = String(values.interest || '').trim();
  const monthlyFee = Number(values.monthly_fee) || 0;
  const notes = String(values.notes || '').trim();

  const student = await prisma.student.create({
    data: {
      tenantId: req.tenantId,
      name: studentName,
      phone: phone || null,
      email: email || null,
      parentName: parentName || null,
      parentPhone: phone || null,
      parentEmail: email || null,
      subjects: interest ? [interest] : [],
      monthlyFee,
      status: 'active',
      notes: notes ? `Converted from lead. ${notes}` : 'Converted from lead',
      joinDate: new Date(),
    },
  });

  const nextValues = {
    ...values,
    status: 'Won',
    converted_student_id: student.id,
  };
  const updated = await prisma.record.update({
    where: { id: record.id },
    data: {
      values: nextValues,
      updatedById: userIdOf(req.user),
    },
  });

  await writeAudit({
    tenantId: req.tenantId,
    userId: userIdOf(req.user),
    action: 'lead.convert_student',
    entityType: 'Student',
    entityId: student.id,
    meta: { recordId: record.id, moduleId: module.id },
  });

  res.status(201).json({
    student: toApi(student),
    record: toApi(updated),
  });
});

const createModule = asyncHandler(async (req, res) => {
  await assertWithinLimit(req.tenantId, 'modules');
  const name = (req.body.name || '').trim();
  if (!name) {
    res.status(400);
    throw new Error('Module name is required');
  }
  let slug = slugify(req.body.slug || name);
  const exists = await prisma.customModule.findUnique({
    where: { tenantId_slug: { tenantId: req.tenantId, slug } },
  });
  if (exists) slug = `${slug}-${Date.now().toString(36)}`;

  const last = await prisma.customModule.findFirst({
    where: { tenantId: req.tenantId },
    orderBy: { order: 'desc' },
  });
  const module = await prisma.customModule.create({
    data: {
      tenantId: req.tenantId,
      name,
      slug,
      icon: req.body.icon || 'box',
      description: req.body.description || '',
      order: last ? last.order + 1 : 0,
      isSystem: false,
    },
  });

  await writeAudit({
    tenantId: req.tenantId,
    userId: userIdOf(req.user),
    action: 'module.create',
    entityType: 'CustomModule',
    entityId: module.id,
  });

  await syncCustomModulesIntoSidebar(req.tenantId);

  res.status(201).json({ module: toApi(module) });
});

const updateModule = asyncHandler(async (req, res) => {
  const module = await findModule(req);
  if (!module) {
    res.status(404);
    throw new Error('Module not found');
  }
  if (module.isSystem) {
    res.status(400);
    throw new Error('System modules cannot be edited');
  }
  const data = pick(req.body, ['name', 'icon', 'description', 'order']);
  if (data.order !== undefined) data.order = toInt(data.order);
  const updated = await prisma.customModule.update({ where: { id: module.id }, data });
  res.json({ module: toApi(updated) });
});

const deleteModule = asyncHandler(async (req, res) => {
  const module = await findModule(req);
  if (!module) {
    res.status(404);
    throw new Error('Module not found');
  }
  if (module.isSystem) {
    res.status(400);
    throw new Error('System modules cannot be deleted');
  }
  // Cascade: fields and records belong to the module.
  await prisma.$transaction([
    prisma.customField.deleteMany({ where: { moduleId: module.id, tenantId: req.tenantId } }),
    prisma.record.deleteMany({ where: { moduleId: module.id, tenantId: req.tenantId } }),
    prisma.customModule.delete({ where: { id: module.id } }),
  ]);
  await removeCustomModuleSidebarLinks(req.tenantId, module.id);
  res.json({ ok: true });
});

const listFields = asyncHandler(async (req, res) => {
  const module = await findModule(req);
  if (!module) {
    res.status(404);
    throw new Error('Module not found');
  }
  const fields = await prisma.customField.findMany({
    where: { moduleId: module.id, tenantId: req.tenantId },
    orderBy: { order: 'asc' },
  });
  res.json({ fields: toApiList(fields) });
});

const createField = asyncHandler(async (req, res) => {
  const module = await findModule(req);
  if (!module) {
    res.status(404);
    throw new Error('Module not found');
  }
  const name = (req.body.name || '').trim();
  const type = req.body.type;
  if (!name || !type) {
    res.status(400);
    throw new Error('Field name and type are required');
  }
  const key = slugify(req.body.key || name).replace(/-/g, '_');
  const last = await prisma.customField.findFirst({
    where: { moduleId: module.id },
    orderBy: { order: 'desc' },
  });
  const data = {
    tenantId: req.tenantId,
    moduleId: module.id,
    name,
    key,
    type,
    required: Boolean(req.body.required),
    placeholder: req.body.placeholder || '',
    options: req.body.options || [],
    lookupModuleId: req.body.lookupModuleId || req.body.lookupModule || null,
    validation: req.body.validation || {},
    order: req.body.order !== undefined && req.body.order !== null
      ? toInt(req.body.order)
      : last
        ? last.order + 1
        : 0,
  };
  if (req.body.defaultValue !== undefined) data.defaultValue = jsonOrNull(req.body.defaultValue);
  if (req.body.conditional) data.conditional = req.body.conditional;

  const field = await prisma.customField.create({ data });
  res.status(201).json({ field: toApi(field) });
});

const updateField = asyncHandler(async (req, res) => {
  const field = await prisma.customField.findFirst({
    where: {
      id: req.params.fieldId,
      moduleId: req.params.id,
      tenantId: req.tenantId,
    },
  });
  if (!field) {
    res.status(404);
    throw new Error('Field not found');
  }
  const data = pick(req.body, [
    'name',
    'type',
    'required',
    'placeholder',
    'defaultValue',
    'options',
    'lookupModule',
    'lookupModuleId',
    'validation',
    'conditional',
    'order',
  ]);
  if ('lookupModule' in data || 'lookupModuleId' in data) {
    data.lookupModuleId = data.lookupModuleId || data.lookupModule || null;
    delete data.lookupModule;
  }
  if (data.order !== undefined) data.order = toInt(data.order);
  ['defaultValue', 'validation', 'conditional'].forEach((key) => {
    if (key in data) data[key] = jsonOrNull(data[key]);
  });
  const updated = await prisma.customField.update({ where: { id: field.id }, data });
  res.json({ field: toApi(updated) });
});

const deleteField = asyncHandler(async (req, res) => {
  const field = await prisma.customField.findFirst({
    where: {
      id: req.params.fieldId,
      moduleId: req.params.id,
      tenantId: req.tenantId,
    },
  });
  if (!field) {
    res.status(404);
    throw new Error('Field not found');
  }
  await prisma.customField.delete({ where: { id: field.id } });
  res.json({ ok: true });
});

const reorderFields = asyncHandler(async (req, res) => {
  const orders = req.body.orders || [];
  await Promise.all(
    orders.map((item) =>
      prisma.customField.updateMany({
        where: { id: String(item.id), moduleId: req.params.id, tenantId: req.tenantId },
        data: { order: toInt(item.order) },
      })
    )
  );
  const fields = await prisma.customField.findMany({
    where: { moduleId: req.params.id, tenantId: req.tenantId },
    orderBy: { order: 'asc' },
  });
  res.json({ fields: toApiList(fields) });
});

const listRecords = asyncHandler(async (req, res) => {
  const module = await findModule(req);
  if (!module) {
    res.status(404);
    throw new Error('Module not found');
  }
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;
  const where = { tenantId: req.tenantId, moduleId: module.id };
  if (req.query.q) {
    // Case-insensitive substring match on values.name (JSON path filter, Postgres).
    where.values = {
      path: ['name'],
      string_contains: String(req.query.q),
      mode: 'insensitive',
    };
  }
  const sortField = RECORD_SORT_FIELDS[req.query.sort] || 'createdAt';
  const sortDir = req.query.dir === 'asc' ? 'asc' : 'desc';

  const [items, total] = await Promise.all([
    prisma.record.findMany({
      where,
      orderBy: { [sortField]: sortDir },
      skip,
      take: limit,
    }),
    prisma.record.count({ where }),
  ]);

  res.json({ items: toApiList(items), total, page, limit });
});

const createRecord = asyncHandler(async (req, res) => {
  const module = await findModule(req);
  if (!module) {
    res.status(404);
    throw new Error('Module not found');
  }
  await assertWithinLimit(req.tenantId, 'records');
  const userId = userIdOf(req.user);
  const record = await prisma.record.create({
    data: {
      tenantId: req.tenantId,
      moduleId: module.id,
      values: req.body.values || {},
      createdById: userId,
      updatedById: userId,
    },
  });
  await runWorkflows({
    tenantId: req.tenantId,
    moduleId: module.id,
    trigger: 'create',
    record,
    user: req.user,
  });
  res.status(201).json({ record: toApi(record) });
});

function findRecord(req) {
  return prisma.record.findFirst({
    where: {
      id: req.params.recordId,
      moduleId: req.params.id,
      tenantId: req.tenantId,
    },
  });
}

const getRecord = asyncHandler(async (req, res) => {
  const record = await findRecord(req);
  if (!record) {
    res.status(404);
    throw new Error('Record not found');
  }
  res.json({ record: toApi(record) });
});

const updateRecord = asyncHandler(async (req, res) => {
  const existing = await findRecord(req);
  if (!existing) {
    res.status(404);
    throw new Error('Record not found');
  }
  const data = { updatedById: userIdOf(req.user) };
  if (req.body.values) data.values = { ...(existing.values || {}), ...req.body.values };
  const record = await prisma.record.update({ where: { id: existing.id }, data });
  await runWorkflows({
    tenantId: req.tenantId,
    moduleId: record.moduleId,
    trigger: 'update',
    record,
    user: req.user,
  });
  res.json({ record: toApi(record) });
});

const deleteRecord = asyncHandler(async (req, res) => {
  const record = await findRecord(req);
  if (!record) {
    res.status(404);
    throw new Error('Record not found');
  }
  await prisma.record.delete({ where: { id: record.id } });
  await runWorkflows({
    tenantId: req.tenantId,
    moduleId: record.moduleId,
    trigger: 'delete',
    record,
    user: req.user,
  });
  res.json({ ok: true });
});

const exportRecords = asyncHandler(async (req, res) => {
  const module = await findModule(req);
  if (!module) {
    res.status(404);
    throw new Error('Module not found');
  }
  const fields = await prisma.customField.findMany({
    where: { moduleId: module.id, tenantId: req.tenantId },
    orderBy: { order: 'asc' },
  });
  const records = await prisma.record.findMany({
    where: { tenantId: req.tenantId, moduleId: module.id },
    orderBy: { createdAt: 'desc' },
  });

  const headers = ['id', 'createdAt', ...fields.map((f) => f.key)];
  const lines = [headers.join(',')];
  records.forEach((r) => {
    const row = [
      r.id,
      r.createdAt.toISOString(),
      ...fields.map((f) => JSON.stringify(r.values?.[f.key] ?? '')),
    ];
    lines.push(row.join(','));
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${module.slug}-export.csv"`);
  res.send(lines.join('\n'));
});

module.exports = {
  listModules,
  listCatalog,
  installCatalogModule,
  convertRecordToStudent,
  createModule,
  updateModule,
  deleteModule,
  listFields,
  createField,
  updateField,
  deleteField,
  reorderFields,
  listRecords,
  createRecord,
  getRecord,
  updateRecord,
  deleteRecord,
  exportRecords,
};
