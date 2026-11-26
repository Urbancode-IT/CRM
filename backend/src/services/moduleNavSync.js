const crypto = require('crypto');
const { prisma } = require('../config/db');

function newId() {
  return crypto.randomBytes(12).toString('hex');
}

function normalizeSectionList(sections) {
  const list = Array.isArray(sections) ? sections : [];
  return list.map((s) => {
    const sec = { ...s };
    if (!sec._id) sec._id = sec.id ? String(sec.id) : newId();
    if (!Array.isArray(sec.checklist)) sec.checklist = [];
    return sec;
  });
}

/** Ensure each non-system custom module has a Workspace sidebar section (linkedModuleId). */
async function syncCustomModulesIntoSidebar(tenantId) {
  if (!tenantId) return;

  const systemMod = await prisma.module.findFirst({
    where: { tenantId, isSystem: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!systemMod) return;

  const customs = await prisma.customModule.findMany({
    where: { tenantId, isSystem: false },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  });

  let sections = normalizeSectionList(systemMod.sections);
  const linkedIds = new Set(
    sections.filter((s) => s.linkedModuleId).map((s) => String(s.linkedModuleId))
  );
  const customIds = new Set(customs.map((c) => String(c.id)));

  let changed = false;
  let maxOrder = sections.reduce((m, s) => Math.max(m, Number(s.order) || 0), 0);

  for (const cm of customs) {
    const id = String(cm.id);
    if (linkedIds.has(id)) {
      // Keep section label in sync with module name.
      sections = sections.map((s) => {
        if (String(s.linkedModuleId) !== id || s.name === cm.name) return s;
        changed = true;
        return { ...s, name: cm.name };
      });
      continue;
    }
    maxOrder += 1;
    sections.push({
      _id: newId(),
      name: cm.name,
      path: null,
      order: maxOrder,
      content: '',
      checklist: [],
      linkedModuleId: cm.id,
    });
    linkedIds.add(id);
    changed = true;
  }

  const pruned = sections.filter(
    (s) => !s.linkedModuleId || customIds.has(String(s.linkedModuleId))
  );
  if (pruned.length !== sections.length) {
    sections = pruned;
    changed = true;
  }

  if (!changed) return;
  await prisma.module.update({
    where: { id: systemMod.id },
    data: { sections },
  });
}

async function removeCustomModuleSidebarLinks(tenantId, customModuleId) {
  if (!tenantId || !customModuleId) return;
  const id = String(customModuleId);
  const mods = await prisma.module.findMany({ where: { tenantId } });
  await Promise.all(
    mods.map(async (mod) => {
      const sections = Array.isArray(mod.sections) ? mod.sections : [];
      const next = sections.filter((s) => String(s.linkedModuleId || '') !== id);
      if (next.length === sections.length) return;
      await prisma.module.update({
        where: { id: mod.id },
        data: { sections: normalizeSectionList(next) },
      });
    })
  );
}

module.exports = {
  syncCustomModulesIntoSidebar,
  removeCustomModuleSidebarLinks,
};
