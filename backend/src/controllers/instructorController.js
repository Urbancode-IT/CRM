const { prisma } = require('../config/db');
const { toApi, toApiList } = require('../utils/toApi');
const asyncHandler = require('../utils/asyncHandler');
const pick = require('../utils/pick');

const FIELDS = [
  'name',
  'email',
  'phone',
  'employeeCode',
  'specialties',
  'joinDate',
  'address',
  'emergencyName',
  'emergencyPhone',
  'monthlyPay',
  'status',
  'notes',
  'customValues',
];

function normalizeSpecialties(value) {
  if (Array.isArray(value)) return value.map((s) => String(s).trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/** Coerce request payload into Prisma-compatible instructor data. */
function normalizeInstructorData(data) {
  const out = { ...data };
  if (out.joinDate !== undefined) {
    if (out.joinDate === null || out.joinDate === '') delete out.joinDate;
    else out.joinDate = new Date(out.joinDate);
  }
  if (out.monthlyPay !== undefined) out.monthlyPay = Number(out.monthlyPay) || 0;
  if (out.customValues !== undefined) {
    if (out.customValues instanceof Map) out.customValues = Object.fromEntries(out.customValues);
    else if (out.customValues === null || typeof out.customValues !== 'object') out.customValues = {};
  }
  return out;
}

function dayRange(dateStr) {
  const base = dateStr ? new Date(dateStr) : new Date();
  const start = new Date(base);
  start.setHours(0, 0, 0, 0);
  const end = new Date(base);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function syncInstructorBatches(tenantId, instructorId, batchIds) {
  const ids = [...new Set((batchIds || []).map(String).filter(Boolean))];
  await prisma.batch.updateMany({
    where: {
      tenantId,
      instructorId,
      ...(ids.length ? { id: { notIn: ids } } : {}),
    },
    data: { instructorId: null },
  });
  if (ids.length) {
    await prisma.batch.updateMany({
      where: { tenantId, id: { in: ids } },
      data: { instructorId },
    });
  }
}

const listInstructors = asyncHandler(async (req, res) => {
  const { status, search } = req.query;
  const where = { tenantId: req.tenantId };
  if (status) where.status = status;
  if (search) where.name = { contains: String(search), mode: 'insensitive' };

  const instructors = await prisma.instructor.findMany({ where, orderBy: { name: 'asc' } });
  const batches = await prisma.batch.findMany({
    where: {
      tenantId: req.tenantId,
      instructorId: { in: instructors.map((i) => i.id) },
    },
    select: { id: true, name: true, instructorId: true },
  });

  const byInstructor = {};
  batches.forEach((b) => {
    const key = String(b.instructorId);
    if (!byInstructor[key]) byInstructor[key] = [];
    byInstructor[key].push({ _id: b.id, id: b.id, name: b.name });
  });

  res.json({
    instructors: toApiList(instructors).map((i) => {
      const assigned = byInstructor[String(i.id)] || [];
      return {
        ...i,
        batchCount: assigned.length,
        batches: assigned,
        batchIds: assigned.map((b) => b._id),
      };
    }),
  });
});

const getInstructor = asyncHandler(async (req, res) => {
  const instructor = await prisma.instructor.findFirst({
    where: { id: req.params.id, tenantId: req.tenantId },
  });
  if (!instructor) {
    res.status(404);
    throw new Error('Instructor not found');
  }
  const batches = await prisma.batch.findMany({
    where: { tenantId: req.tenantId, instructorId: instructor.id },
    select: { id: true, name: true, grade: true, isActive: true },
    orderBy: { name: 'asc' },
  });
  res.json({ instructor: toApi(instructor), batches: toApiList(batches) });
});

const createInstructor = asyncHandler(async (req, res) => {
  const data = pick(req.body, FIELDS);
  if (!data.name || !String(data.name).trim()) {
    res.status(400);
    throw new Error('Name is required');
  }
  data.specialties = normalizeSpecialties(data.specialties ?? req.body.specialties);
  const instructor = await prisma.instructor.create({
    data: { ...normalizeInstructorData(data), tenantId: req.tenantId },
  });
  if (Array.isArray(req.body.batchIds)) {
    await syncInstructorBatches(req.tenantId, instructor.id, req.body.batchIds);
  }
  res.status(201).json({ instructor: toApi(instructor) });
});

const updateInstructor = asyncHandler(async (req, res) => {
  const existing = await prisma.instructor.findFirst({
    where: { id: req.params.id, tenantId: req.tenantId },
    select: { id: true },
  });
  if (!existing) {
    res.status(404);
    throw new Error('Instructor not found');
  }
  const data = pick(req.body, FIELDS);
  if (req.body.specialties !== undefined) data.specialties = normalizeSpecialties(req.body.specialties);
  const instructor = await prisma.instructor.update({
    where: { id: existing.id },
    data: normalizeInstructorData(data),
  });
  if (Array.isArray(req.body.batchIds)) {
    await syncInstructorBatches(req.tenantId, instructor.id, req.body.batchIds);
  }
  res.json({ instructor: toApi(instructor) });
});

const deleteInstructor = asyncHandler(async (req, res) => {
  const instructor = await prisma.instructor.findFirst({
    where: { id: req.params.id, tenantId: req.tenantId },
    select: { id: true },
  });
  if (!instructor) {
    res.status(404);
    throw new Error('Instructor not found');
  }
  await prisma.$transaction([
    prisma.batch.updateMany({
      where: { tenantId: req.tenantId, instructorId: instructor.id },
      data: { instructorId: null },
    }),
    prisma.instructorAttendance.deleteMany({
      where: { tenantId: req.tenantId, instructorId: instructor.id },
    }),
    prisma.instructor.delete({ where: { id: instructor.id } }),
  ]);
  res.json({ message: 'Instructor deleted' });
});

const getInstructorAttendance = asyncHandler(async (req, res) => {
  const { date, instructor, from, to } = req.query;
  const where = { tenantId: req.tenantId };
  if (instructor) where.instructorId = String(instructor);
  if (date) {
    const { start, end } = dayRange(date);
    where.date = { gte: start, lte: end };
  } else if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(to);
  }
  const records = await prisma.instructorAttendance.findMany({
    where,
    include: { instructor: { select: { id: true, name: true } } },
    orderBy: { date: 'desc' },
  });
  res.json(toApiList(records));
});

const markInstructorAttendanceBulk = asyncHandler(async (req, res) => {
  const { date, entries } = req.body;
  const { start } = dayRange(date);
  const results = await Promise.all(
    (entries || []).map(async (entry) => {
      if (!entry?.instructor) return null;
      const owned = await prisma.instructor.findFirst({
        where: { id: String(entry.instructor), tenantId: req.tenantId },
        select: { id: true },
      });
      if (!owned) return null;
      const fields = {
        status: entry.status || 'present',
        remarks: entry.remarks || '',
        markedBy: req.user?.name || '',
      };
      return prisma.instructorAttendance.upsert({
        where: {
          tenantId_instructorId_date: {
            tenantId: req.tenantId,
            instructorId: owned.id,
            date: start,
          },
        },
        create: { tenantId: req.tenantId, instructorId: owned.id, date: start, ...fields },
        update: fields,
      });
    })
  );
  res.json(toApiList(results.filter(Boolean)));
});

module.exports = {
  listInstructors,
  getInstructor,
  createInstructor,
  updateInstructor,
  deleteInstructor,
  getInstructorAttendance,
  markInstructorAttendanceBulk,
};
