const crypto = require('crypto');
const { prisma } = require('../config/db');
const { toApi, toApiList } = require('../utils/toApi');
const asyncHandler = require('../utils/asyncHandler');
const pick = require('../utils/pick');
const slugify = require('../utils/slugify');
const { assertWithinLimit } = require('../services/planLimits');
const { runWorkflows } = require('../services/workflowService');
const {
  BUILT_IN_FORM_TEMPLATES,
  getBuiltInTemplate,
} = require('../constants/formTemplates');

function userIdOf(user) {
  return user?.id ?? user?._id ?? null;
}

function fieldsOf(form) {
  return Array.isArray(form?.fields) ? form.fields : [];
}

/** Copy of form fields suitable for a template (drops extra props). */
function templateFields(fields) {
  return fields.map((f, i) => ({
    name: f.name,
    key: f.key,
    type: f.type,
    required: Boolean(f.required),
    placeholder: f.placeholder || '',
    options: f.options || [],
    order: i,
  }));
}

const listForms = asyncHandler(async (req, res) => {
  const where = { tenantId: req.tenantId };
  if (req.query.templates === '1') where.isTemplate = true;
  else if (req.query.templates === '0') where.isTemplate = false;
  const forms = await prisma.form.findMany({ where, orderBy: { updatedAt: 'desc' } });
  res.json({ forms: toApiList(forms) });
});

/** Built-in + workspace-saved templates */
const listTemplates = asyncHandler(async (req, res) => {
  const saved = await prisma.form.findMany({
    where: { tenantId: req.tenantId, isTemplate: true },
    orderBy: { name: 'asc' },
  });
  res.json({
    builtIn: BUILT_IN_FORM_TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      fieldCount: (t.fields || []).length,
      fields: t.fields || [],
      source: 'built_in',
    })),
    saved: saved.map((f) => ({
      id: String(f.id),
      name: f.name,
      description: f.description || '',
      category: 'saved',
      fieldCount: fieldsOf(f).length,
      fields: fieldsOf(f),
      source: 'saved',
    })),
  });
});

/** Save current form as a reusable workspace template (copy). */
const saveAsTemplate = asyncHandler(async (req, res) => {
  const form = await prisma.form.findFirst({
    where: { id: req.params.id, tenantId: req.tenantId },
  });
  if (!form) {
    res.status(404);
    throw new Error('Form not found');
  }
  const name = (req.body.name || `${form.name} template`).trim();
  const tpl = await prisma.form.create({
    data: {
      tenantId: req.tenantId,
      name,
      description: req.body.description || form.description || '',
      fields: templateFields(fieldsOf(form)),
      isTemplate: true,
      status: 'draft',
      allowPublic: false,
    },
  });
  res.status(201).json({ form: toApi(tpl) });
});

const createFromTemplate = asyncHandler(async (req, res) => {
  await assertWithinLimit(req.tenantId, 'forms');
  const { templateId, source = 'built_in', name } = req.body;

  let fields = [];
  let formName = (name || '').trim();
  let description = '';

  if (source === 'saved') {
    const tpl = await prisma.form.findFirst({
      where: { id: String(templateId || ''), tenantId: req.tenantId, isTemplate: true },
    });
    if (!tpl) {
      res.status(404);
      throw new Error('Saved template not found');
    }
    fields = templateFields(fieldsOf(tpl));
    formName = formName || tpl.name;
    description = tpl.description || '';
  } else {
    const tpl = getBuiltInTemplate(templateId || 'blank');
    if (!tpl) {
      res.status(404);
      throw new Error('Template not found');
    }
    fields = (tpl.fields || []).map((f, i) => ({ ...f, order: i }));
    formName = formName || tpl.name;
    description = tpl.description || '';
  }

  const form = await prisma.form.create({
    data: {
      tenantId: req.tenantId,
      name: formName || 'Untitled form',
      description,
      fields,
      isTemplate: false,
      status: 'draft',
    },
  });
  res.status(201).json({ form: toApi(form) });
});

const getForm = asyncHandler(async (req, res) => {
  const form = await prisma.form.findFirst({
    where: { id: req.params.id, tenantId: req.tenantId },
  });
  if (!form) {
    res.status(404);
    throw new Error('Form not found');
  }
  res.json({ form: toApi(form) });
});

const createForm = asyncHandler(async (req, res) => {
  await assertWithinLimit(req.tenantId, 'forms');
  const name = (req.body.name || '').trim();
  if (!name) {
    res.status(400);
    throw new Error('Form name is required');
  }
  const form = await prisma.form.create({
    data: {
      tenantId: req.tenantId,
      name,
      description: req.body.description || '',
      moduleId: req.body.moduleId || req.body.module || null,
      fields: req.body.fields || [],
      isTemplate: Boolean(req.body.isTemplate),
      status: req.body.status || 'draft',
      allowPublic: Boolean(req.body.allowPublic),
      publicToken: req.body.allowPublic ? crypto.randomBytes(16).toString('hex') : null,
    },
  });
  res.status(201).json({ form: toApi(form) });
});

const updateForm = asyncHandler(async (req, res) => {
  const form = await prisma.form.findFirst({
    where: { id: req.params.id, tenantId: req.tenantId },
  });
  if (!form) {
    res.status(404);
    throw new Error('Form not found');
  }
  const data = pick(req.body, [
    'name',
    'description',
    'module',
    'moduleId',
    'fields',
    'isTemplate',
    'status',
    'allowPublic',
  ]);
  if ('module' in data || 'moduleId' in data) {
    data.moduleId = data.moduleId || data.module || null;
    delete data.module;
  }

  const allowPublic = data.allowPublic !== undefined ? data.allowPublic : form.allowPublic;
  if (allowPublic && !form.publicToken) {
    data.publicToken = crypto.randomBytes(16).toString('hex');
  }
  if (allowPublic === false) {
    data.publicToken = null;
  }

  const updated = await prisma.form.update({ where: { id: form.id }, data });
  res.json({ form: toApi(updated) });
});

const duplicateForm = asyncHandler(async (req, res) => {
  await assertWithinLimit(req.tenantId, 'forms');
  const form = await prisma.form.findFirst({
    where: { id: req.params.id, tenantId: req.tenantId },
  });
  if (!form) {
    res.status(404);
    throw new Error('Form not found');
  }
  const copy = await prisma.form.create({
    data: {
      tenantId: req.tenantId,
      name: `${form.name} (copy)`,
      description: form.description,
      moduleId: form.moduleId,
      fields: fieldsOf(form),
      isTemplate: form.isTemplate,
      status: 'draft',
    },
  });
  res.status(201).json({ form: toApi(copy) });
});

const deleteForm = asyncHandler(async (req, res) => {
  const form = await prisma.form.findFirst({
    where: { id: req.params.id, tenantId: req.tenantId },
  });
  if (!form) {
    res.status(404);
    throw new Error('Form not found');
  }
  await prisma.form.delete({ where: { id: form.id } });
  res.json({ ok: true });
});

async function createSubmission({ form, values, userId, preview }) {
  for (const field of fieldsOf(form)) {
    if (field.required && (values[field.key] === undefined || values[field.key] === '')) {
      const err = new Error(`${field.name} is required`);
      err.statusCode = 400;
      throw err;
    }
  }

  if (preview) {
    return { preview: true, values };
  }

  await assertWithinLimit(form.tenantId, 'records');

  let moduleId = form.moduleId;
  if (!moduleId) {
    const fallback = await prisma.customModule.findFirst({
      where: { tenantId: form.tenantId, isSystem: false },
      orderBy: { createdAt: 'asc' },
    });
    if (!fallback) {
      const created = await prisma.customModule.create({
        data: {
          tenantId: form.tenantId,
          name: form.name,
          slug: slugify(form.name) + '-data',
          description: 'Auto module for form submissions',
          isSystem: false,
        },
      });
      moduleId = created.id;
      await prisma.form.update({ where: { id: form.id }, data: { moduleId } });
    } else {
      moduleId = fallback.id;
    }
  }

  const record = await prisma.record.create({
    data: {
      tenantId: form.tenantId,
      moduleId,
      values,
      createdById: userId || null,
      updatedById: userId || null,
    },
  });

  await runWorkflows({
    tenantId: form.tenantId,
    moduleId,
    trigger: 'create',
    record,
    user: userId ? { id: userId, _id: userId } : null,
  });

  return { record: toApi(record) };
}

const submitForm = asyncHandler(async (req, res) => {
  const form = await prisma.form.findFirst({
    where: { id: req.params.id, tenantId: req.tenantId },
  });
  if (!form) {
    res.status(404);
    throw new Error('Form not found');
  }
  if (form.status !== 'published' && !req.body.preview) {
    res.status(400);
    throw new Error('Form is not published');
  }

  const result = await createSubmission({
    form,
    values: req.body.values || {},
    userId: userIdOf(req.user),
    preview: Boolean(req.body.preview),
  });

  if (result.preview) return res.json(result);
  res.status(201).json(result);
});

const getPublicForm = asyncHandler(async (req, res) => {
  const form = await prisma.form.findFirst({
    where: {
      publicToken: req.params.token,
      allowPublic: true,
      status: 'published',
    },
    select: {
      id: true,
      name: true,
      description: true,
      fields: true,
      status: true,
      allowPublic: true,
      publicToken: true,
    },
  });
  if (!form) {
    res.status(404);
    throw new Error('Public form not found');
  }
  res.json({ form: toApi(form) });
});

const submitPublicForm = asyncHandler(async (req, res) => {
  const form = await prisma.form.findFirst({
    where: {
      publicToken: req.params.token,
      allowPublic: true,
      status: 'published',
    },
  });
  if (!form) {
    res.status(404);
    throw new Error('Public form not found');
  }
  const result = await createSubmission({
    form,
    values: req.body.values || {},
    userId: null,
    preview: false,
  });
  res.status(201).json({ ok: true, recordId: result.record?.id });
});

module.exports = {
  listForms,
  getForm,
  createForm,
  createFromTemplate,
  saveAsTemplate,
  listTemplates,
  updateForm,
  duplicateForm,
  deleteForm,
  submitForm,
  getPublicForm,
  submitPublicForm,
};
