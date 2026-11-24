const { prisma } = require('../config/db');
const { toApi, toApiList } = require('../utils/toApi');
const { studentWhere } = require('../utils/studentQuery');
const asyncHandler = require('../utils/asyncHandler');
const pick = require('../utils/pick');
const { assertWithinLimit } = require('../services/planLimits');

const INSTRUCTOR_SELECT = { id: true, name: true, email: true, phone: true, status: true };

const listBatches = asyncHandler(async (req, res) => {
  const batches = await prisma.batch.findMany({
    where: { tenantId: req.tenantId },
    include: { instructor: { select: INSTRUCTOR_SELECT } },
    orderBy: { name: 'asc' },
  });
  const counts = await prisma.student.groupBy({
    by: ['batchRefId'],
    where: studentWhere({ tenantId: req.tenantId, batchRefId: { not: null } }),
    _count: { _all: true },
  });
  const countMap = Object.fromEntries(counts.map((c) => [String(c.batchRefId), c._count._all]));
  res.json({
    batches: toApiList(batches).map((b) => ({
      ...b,
      studentCount: countMap[String(b.id)] || 0,
    })),
  });
});

const createBatch = asyncHandler(async (req, res) => {
  await assertWithinLimit(req.tenantId, 'batches');
  const name = (req.body.name || '').trim();
  if (!name) {
    res.status(400);
    throw new Error('Batch name is required');
  }
  const batch = await prisma.batch.create({
    data: {
      tenantId: req.tenantId,
      name,
      grade: req.body.grade || '',
      subjects: req.body.subjects || [],
      schedule: req.body.schedule || [],
      capacity: Number(req.body.capacity) || 30,
      instructorId: req.body.instructor || null,
      notes: req.body.notes || '',
    },
  });
  res.status(201).json({ batch: toApi(batch) });
});

const updateBatch = asyncHandler(async (req, res) => {
  const existing = await prisma.batch.findFirst({
    where: { id: req.params.id, tenantId: req.tenantId },
    select: { id: true },
  });
  if (!existing) {
    res.status(404);
    throw new Error('Batch not found');
  }
  const { instructor, ...rest } = pick(req.body, [
    'name',
    'grade',
    'subjects',
    'schedule',
    'capacity',
    'notes',
    'isActive',
    'instructor',
  ]);
  const data = { ...rest };
  if (data.capacity !== undefined) data.capacity = Number(data.capacity) || 30;
  if (instructor !== undefined) data.instructorId = instructor || null;

  const batch = await prisma.batch.update({ where: { id: existing.id }, data });
  res.json({ batch: toApi(batch) });
});

const deleteBatch = asyncHandler(async (req, res) => {
  const batch = await prisma.batch.findFirst({
    where: { id: req.params.id, tenantId: req.tenantId },
    select: { id: true },
  });
  if (!batch) {
    res.status(404);
    throw new Error('Batch not found');
  }
  // FK is ON DELETE SET NULL, but clear explicitly (incl. soft-deleted students) to match prior behaviour.
  await prisma.$transaction([
    prisma.student.updateMany({
      where: { tenantId: req.tenantId, batchRefId: batch.id },
      data: { batchRefId: null },
    }),
    prisma.batch.delete({ where: { id: batch.id } }),
  ]);
  res.json({ ok: true });
});

const getTimetable = asyncHandler(async (req, res) => {
  const batches = await prisma.batch.findMany({
    where: { tenantId: req.tenantId, isActive: true },
    include: { instructor: { select: { id: true, name: true } } },
  });
  const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const timetable = days.map((day) => ({
    day,
    slots: batches
      .flatMap((b) =>
        (Array.isArray(b.schedule) ? b.schedule : [])
          .filter((s) => s.day === day)
          .map((s) => ({
            batchId: b.id,
            batchName: b.name,
            instructorName: b.instructor?.name || '',
            startTime: s.startTime,
            endTime: s.endTime,
            subject: s.subject || (b.subjects || [])[0] || '',
          }))
      )
      .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime))),
  }));
  res.json({ timetable });
});

module.exports = {
  listBatches,
  createBatch,
  updateBatch,
  deleteBatch,
  getTimetable,
};
