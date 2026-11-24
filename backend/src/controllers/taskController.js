const { prisma } = require('../config/db');
const { toApi, toApiList } = require('../utils/toApi');
const { studentWhere } = require('../utils/studentQuery');
const asyncHandler = require('../utils/asyncHandler');
const pick = require('../utils/pick');

const TASK_FIELDS = [
  'title',
  'description',
  'relatedStudent',
  'assignedTo',
  'dueDate',
  'priority',
  'status',
  'recurring',
  'recurrencePattern',
];

/** Map API payload (relatedStudent, date strings) to Prisma task data. */
function normalizeTaskData(data) {
  const { relatedStudent, ...rest } = data;
  const out = { ...rest };
  if (relatedStudent !== undefined) out.relatedStudentId = relatedStudent ? String(relatedStudent) : null;
  if (out.dueDate !== undefined) out.dueDate = out.dueDate ? new Date(out.dueDate) : null;
  return out;
}

async function assertRelatedStudent(req, res, relatedStudentId) {
  if (!relatedStudentId) return;
  const student = await prisma.student.findFirst({
    where: studentWhere({ id: relatedStudentId, tenantId: req.tenantId }),
    select: { id: true },
  });
  if (!student) {
    res.status(400);
    throw new Error('Student not found in this workspace');
  }
}

const getTasks = asyncHandler(async (req, res) => {
  const { status, student, priority } = req.query;
  const where = { tenantId: req.tenantId };
  if (status) where.status = status;
  if (student) where.relatedStudentId = String(student);
  if (priority) where.priority = priority;

  const tasks = await prisma.task.findMany({
    where,
    include: { relatedStudent: { select: { id: true, name: true, batch: true, grade: true } } },
    // Mongo sorted missing dueDate first on ASC; keep that ordering.
    orderBy: [{ dueDate: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }],
  });
  res.json(toApiList(tasks));
});

const createTask = asyncHandler(async (req, res) => {
  const data = normalizeTaskData(pick(req.body, TASK_FIELDS));
  await assertRelatedStudent(req, res, data.relatedStudentId);
  const task = await prisma.task.create({ data: { ...data, tenantId: req.tenantId } });
  res.status(201).json(toApi(task));
});

/** Create the same task for every active student in a batch (or all active). */
const createBatchTasks = asyncHandler(async (req, res) => {
  const { relatedStudentId: _ignored, ...data } = normalizeTaskData(pick(req.body, TASK_FIELDS));
  const batch = typeof req.body.batch === 'string' ? req.body.batch.trim() : '';
  const allActive = Boolean(req.body.allActive);

  if (!batch && !allActive) {
    res.status(400);
    throw new Error('Provide batch or set allActive');
  }

  const extra = { tenantId: req.tenantId, status: 'active' };
  if (!allActive) extra.batch = batch;

  const students = await prisma.student.findMany({
    where: studentWhere(extra),
    select: { id: true, name: true },
  });
  if (!students.length) {
    res.status(400);
    throw new Error(batch ? `No active students in batch "${batch}"` : 'No active students found');
  }

  const created = await prisma.$transaction(
    students.map((s) =>
      prisma.task.create({
        data: { ...data, relatedStudentId: s.id, tenantId: req.tenantId },
      })
    )
  );
  res.status(201).json({ created: created.length, tasks: toApiList(created) });
});

const updateTask = asyncHandler(async (req, res) => {
  const data = normalizeTaskData(pick(req.body, TASK_FIELDS));
  const existing = await prisma.task.findFirst({
    where: { id: req.params.id, tenantId: req.tenantId },
    select: { id: true },
  });
  if (!existing) {
    res.status(404);
    throw new Error('Task not found');
  }
  await assertRelatedStudent(req, res, data.relatedStudentId);
  const task = await prisma.task.update({ where: { id: existing.id }, data });
  res.json(toApi(task));
});

const deleteTask = asyncHandler(async (req, res) => {
  const task = await prisma.task.findFirst({
    where: { id: req.params.id, tenantId: req.tenantId },
    select: { id: true },
  });
  if (!task) {
    res.status(404);
    throw new Error('Task not found');
  }
  await prisma.task.delete({ where: { id: task.id } });
  res.json({ message: 'Task deleted' });
});

module.exports = { getTasks, createTask, createBatchTasks, updateTask, deleteTask };
