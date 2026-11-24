const crypto = require('crypto');
const { prisma } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { DEFAULT_NAV_SECTIONS, HIDDEN_NAV_PATHS } = require('../services/tenantBootstrap');

const PATH_LABELS = {
  '/app': 'Home',
  '/app/students': 'Students',
  '/app/batches': 'Batches',
  '/app/instructors': 'Instructors',
  '/app/attendance': 'Attendance',
  '/app/payments': 'Payments',
  '/app/tasks': 'Tasks',
  '/app/modules': 'Modules',
  '/app/forms': 'Forms',
  '/app/workflows': 'Workflows',
  '/app/reports': 'Reports',
  '/app/messages': 'Messages',
  '/app/recycle-bin': 'Recycle Bin',
  '/app/billing': 'Billing',
};

const HIDDEN_PATH_SET = new Set(HIDDEN_NAV_PATHS);

function newId() {
  return crypto.randomBytes(12).toString('hex');
}

function userIdOf(user) {
  return user?.id ?? user?._id ?? null;
}

/**
 * Sections live in a Json column (no subdocument ids like mongoose),
 * so ensure each section / checklist item carries a stable `_id`.
 */
function normalizeSections(sections) {
  let changed = false;
  const list = Array.isArray(sections) ? sections : [];
  const normalized = list.map((s) => {
    const sec = { ...s };
    if (!sec._id) {
      sec._id = sec.id ? String(sec.id) : newId();
      changed = true;
    }
    if (sec.checklist !== undefined && !Array.isArray(sec.checklist)) {
      sec.checklist = [];
      changed = true;
    }
    if (Array.isArray(sec.checklist)) {
      sec.checklist = sec.checklist.map((c) => {
        if (c._id) return c;
        changed = true;
        return { ...c, _id: c.id ? String(c.id) : newId() };
      });
    }
    return sec;
  });
  return { sections: normalized, changed };
}

function findSection(sections, sectionId) {
  const id = String(sectionId);
  return sections.find((s) => String(s._id) === id);
}

function toPublicSection(s) {
  const path = s.path || null;
  return {
    id: s._id,
    name: (path && PATH_LABELS[path]) || s.name,
    path,
    order: s.order,
    content: s.content || '',
    linkedModuleId: s.linkedModuleId || null,
    checklist: (s.checklist || []).map((c) => ({
      id: c._id,
      text: c.text,
      done: Boolean(c.done),
    })),
  };
}

function toPublicModule(doc) {
  const name = doc.isSystem ? 'Workspace' : doc.name;
  const sections = Array.isArray(doc.sections) ? doc.sections : [];
  return {
    id: doc.id,
    name,
    order: doc.order,
    isSystem: Boolean(doc.isSystem),
    sections: sections
      .slice()
      .filter((s) => !s.path || !HIDDEN_PATH_SET.has(s.path))
      .sort((a, b) => a.order - b.order)
      .map(toPublicSection),
  };
}

/** Load a module owned by the tenant, with section ids guaranteed (persisted if added). */
async function loadModule(id, tenantId) {
  const module = await prisma.module.findFirst({ where: { id, tenantId } });
  if (!module) return null;
  const { sections, changed } = normalizeSections(module.sections);
  if (!changed) return module;
  return prisma.module.update({ where: { id: module.id }, data: { sections } });
}

async function ensureDefaultModules(tenantId, userId) {
  const count = await prisma.module.count({ where: { tenantId } });
  if (count > 0) {
    // Keep existing sections/content — only ensure system folder label.
    await prisma.module.updateMany({
      where: { tenantId, isSystem: true },
      data: { name: 'Workspace' },
    });

    const systemMod = await prisma.module.findFirst({ where: { tenantId, isSystem: true } });
    if (systemMod) {
      const current = Array.isArray(systemMod.sections) ? systemMod.sections : [];
      let sections = current.filter((s) => !s.path || !HIDDEN_PATH_SET.has(s.path));
      let changed = sections.length !== current.length;

      const existingPaths = new Set(sections.filter((s) => s.path).map((s) => s.path));
      DEFAULT_NAV_SECTIONS.forEach((sec) => {
        if (!existingPaths.has(sec.path)) {
          sections.push({ ...sec });
          changed = true;
        }
      });

      const normalized = normalizeSections(sections);
      sections = normalized.sections;
      if (changed || normalized.changed) {
        await prisma.module.update({ where: { id: systemMod.id }, data: { sections } });
      }
    }
    return;
  }

  await prisma.module.create({
    data: {
      tenantId,
      userId,
      name: 'Workspace',
      order: 0,
      isSystem: true,
      sections: normalizeSections(DEFAULT_NAV_SECTIONS).sections,
    },
  });
}

const listModules = asyncHandler(async (req, res) => {
  await ensureDefaultModules(req.tenantId, userIdOf(req.user));
  const modules = await prisma.module.findMany({
    where: { tenantId: req.tenantId },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  });

  // Persist ids for any legacy section data lacking them so ids stay stable across requests.
  // Also seed a General section into empty custom modules so folders aren't blank.
  const prepared = await Promise.all(
    modules.map(async (m) => {
      const { sections, changed } = normalizeSections(m.sections);
      let nextSections = sections;
      let nextChanged = changed;
      if (!m.isSystem && nextSections.length === 0) {
        nextSections = [
          {
            _id: newId(),
            name: 'General',
            path: null,
            order: 0,
            content: '',
            checklist: [],
          },
        ];
        nextChanged = true;
      }
      if (!nextChanged) return m;
      return prisma.module.update({ where: { id: m.id }, data: { sections: nextSections } });
    })
  );
  res.json({ modules: prepared.map(toPublicModule) });
});

const createModule = asyncHandler(async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) {
    res.status(400);
    throw new Error('Module name is required.');
  }

  const last = await prisma.module.findFirst({
    where: { tenantId: req.tenantId },
    orderBy: { order: 'desc' },
  });
  // New folders get a starter section so they aren't empty in the sidebar.
  const starterSection = {
    _id: newId(),
    name: 'General',
    path: null,
    order: 0,
    content: '',
    checklist: [],
  };
  const module = await prisma.module.create({
    data: {
      tenantId: req.tenantId,
      userId: userIdOf(req.user),
      name,
      order: last ? last.order + 1 : 0,
      isSystem: false,
      sections: [starterSection],
    },
  });

  res.status(201).json({
    module: toPublicModule(module),
    section: toPublicSection(starterSection),
  });
});

const updateModule = asyncHandler(async (req, res) => {
  const module = await loadModule(req.params.id, req.tenantId);
  if (!module) {
    res.status(404);
    throw new Error('Module not found');
  }

  const data = {};
  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) {
      res.status(400);
      throw new Error('Module name is required.');
    }
    data.name = name;
  }

  const updated = Object.keys(data).length
    ? await prisma.module.update({ where: { id: module.id }, data })
    : module;
  res.json({ module: toPublicModule(updated) });
});

const deleteModule = asyncHandler(async (req, res) => {
  const module = await prisma.module.findFirst({
    where: { id: req.params.id, tenantId: req.tenantId },
  });
  if (!module) {
    res.status(404);
    throw new Error('Module not found');
  }
  if (module.isSystem) {
    res.status(400);
    throw new Error('System modules cannot be deleted.');
  }

  await prisma.module.delete({ where: { id: module.id } });
  res.json({ ok: true });
});

const addSection = asyncHandler(async (req, res) => {
  const module = await loadModule(req.params.id, req.tenantId);
  if (!module) {
    res.status(404);
    throw new Error('Module not found');
  }

  const name = (req.body.name || '').trim();
  if (!name) {
    res.status(400);
    throw new Error('Section name is required.');
  }

  const sections = Array.isArray(module.sections) ? [...module.sections] : [];
  const order = sections.length ? Math.max(...sections.map((s) => s.order)) + 1 : 0;

  const created = { _id: newId(), name, path: null, order, content: '', checklist: [] };
  sections.push(created);
  const updated = await prisma.module.update({
    where: { id: module.id },
    data: { sections },
  });

  res.status(201).json({
    module: toPublicModule(updated),
    section: toPublicSection(created),
  });
});

const updateSection = asyncHandler(async (req, res) => {
  const module = await loadModule(req.params.id, req.tenantId);
  if (!module) {
    res.status(404);
    throw new Error('Module not found');
  }

  const sections = Array.isArray(module.sections) ? module.sections.map((s) => ({ ...s })) : [];
  const section = findSection(sections, req.params.sectionId);
  if (!section) {
    res.status(404);
    throw new Error('Section not found');
  }

  // Built-in linked pages: only block rename/path changes; allow no content edits.
  if (section.path) {
    res.status(400);
    throw new Error('Built-in sections open their own app pages. Add a custom section for notes/checklist.');
  }

  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) {
      res.status(400);
      throw new Error('Section name is required.');
    }
    section.name = name;
  }

  if (req.body.content !== undefined) {
    section.content = String(req.body.content);
  }

  if (Array.isArray(req.body.checklist)) {
    section.checklist = req.body.checklist
      .map((item) => ({
        text: String(item.text || '').trim(),
        done: Boolean(item.done),
        _id: item.id ? String(item.id) : newId(),
      }))
      .filter((item) => item.text);
  }

  if (req.body.linkedModuleId !== undefined) {
    const linked = req.body.linkedModuleId;
    section.linkedModuleId = linked ? String(linked) : null;
  }

  const updated = await prisma.module.update({
    where: { id: module.id },
    data: { sections },
  });
  res.json({
    module: toPublicModule(updated),
    section: toPublicSection(section),
  });
});

const deleteSection = asyncHandler(async (req, res) => {
  const module = await loadModule(req.params.id, req.tenantId);
  if (!module) {
    res.status(404);
    throw new Error('Module not found');
  }

  const sections = Array.isArray(module.sections) ? module.sections : [];
  const section = findSection(sections, req.params.sectionId);
  if (!section) {
    res.status(404);
    throw new Error('Section not found');
  }

  if (section.path) {
    res.status(400);
    throw new Error('Built-in sections cannot be deleted.');
  }

  const updated = await prisma.module.update({
    where: { id: module.id },
    data: { sections: sections.filter((s) => String(s._id) !== String(section._id)) },
  });
  res.json({ module: toPublicModule(updated) });
});

module.exports = {
  listModules,
  createModule,
  updateModule,
  deleteModule,
  addSection,
  updateSection,
  deleteSection,
};
