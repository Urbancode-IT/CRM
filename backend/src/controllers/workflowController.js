const { prisma } = require('../config/db');
const { toApi, toApiList } = require('../utils/toApi');
const asyncHandler = require('../utils/asyncHandler');
const pick = require('../utils/pick');
const { assertWithinLimit } = require('../services/planLimits');

const listWorkflows = asyncHandler(async (req, res) => {
  const workflows = await prisma.workflow.findMany({
    where: { tenantId: req.tenantId },
    orderBy: { updatedAt: 'desc' },
  });
  res.json({ workflows: toApiList(workflows) });
});

const createWorkflow = asyncHandler(async (req, res) => {
  await assertWithinLimit(req.tenantId, 'workflows');
  const name = (req.body.name || '').trim();
  if (!name || !req.body.trigger) {
    res.status(400);
    throw new Error('Name and trigger are required');
  }
  const workflow = await prisma.workflow.create({
    data: {
      tenantId: req.tenantId,
      name,
      moduleId: req.body.moduleId || req.body.module || null,
      trigger: req.body.trigger,
      conditions: req.body.conditions || [],
      actions: req.body.actions || [],
      isActive: req.body.isActive !== false,
    },
  });
  res.status(201).json({ workflow: toApi(workflow) });
});

const updateWorkflow = asyncHandler(async (req, res) => {
  const workflow = await prisma.workflow.findFirst({
    where: { id: req.params.id, tenantId: req.tenantId },
  });
  if (!workflow) {
    res.status(404);
    throw new Error('Workflow not found');
  }
  const data = pick(req.body, [
    'name',
    'module',
    'moduleId',
    'trigger',
    'conditions',
    'actions',
    'isActive',
  ]);
  if ('module' in data || 'moduleId' in data) {
    data.moduleId = data.moduleId || data.module || null;
    delete data.module;
  }
  const updated = await prisma.workflow.update({ where: { id: workflow.id }, data });
  res.json({ workflow: toApi(updated) });
});

const deleteWorkflow = asyncHandler(async (req, res) => {
  const workflow = await prisma.workflow.findFirst({
    where: { id: req.params.id, tenantId: req.tenantId },
  });
  if (!workflow) {
    res.status(404);
    throw new Error('Workflow not found');
  }
  await prisma.workflow.delete({ where: { id: workflow.id } });
  res.json({ ok: true });
});

module.exports = { listWorkflows, createWorkflow, updateWorkflow, deleteWorkflow };
