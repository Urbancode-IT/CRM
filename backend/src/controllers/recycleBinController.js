const { prisma } = require('../config/db');
const { toApi } = require('../utils/toApi');
const asyncHandler = require('../utils/asyncHandler');
const { writeAudit } = require('../utils/audit');

const listTrash = asyncHandler(async (req, res) => {
  const students = await prisma.student.findMany({
    where: {
      tenantId: req.tenantId,
      deletedAt: { not: null },
    },
    orderBy: { deletedAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      grade: true,
      batch: true,
      monthlyFee: true,
      status: true,
      deletedAt: true,
      createdAt: true,
    },
  });

  res.json({
    items: students.map((s) => ({
      id: s.id,
      type: 'student',
      name: s.name,
      meta: [s.grade, s.batch].filter(Boolean).join(' · ') || 'Student',
      email: s.email || '',
      deletedAt: s.deletedAt,
    })),
  });
});

const restoreItem = asyncHandler(async (req, res) => {
  const student = await prisma.student.findFirst({
    where: {
      id: req.params.id,
      tenantId: req.tenantId,
      deletedAt: { not: null },
    },
  });

  if (!student) {
    res.status(404);
    throw new Error('Item not found in recycle bin');
  }

  const restored = await prisma.student.update({
    where: { id: student.id },
    data: { deletedAt: null, deletedById: null },
  });

  await writeAudit({
    tenantId: req.tenantId,
    userId: req.user.id || req.user._id,
    action: 'student.restore',
    entityType: 'Student',
    entityId: restored.id,
  });

  res.json({ message: 'Student restored', student: toApi(restored) });
});

const permanentDelete = asyncHandler(async (req, res) => {
  const student = await prisma.student.findFirst({
    where: {
      id: req.params.id,
      tenantId: req.tenantId,
      deletedAt: { not: null },
    },
  });

  if (!student) {
    res.status(404);
    throw new Error('Item not found in recycle bin');
  }

  await prisma.$transaction([
    prisma.payment.deleteMany({ where: { tenantId: req.tenantId, studentId: student.id } }),
    prisma.attendance.deleteMany({ where: { tenantId: req.tenantId, studentId: student.id } }),
    prisma.task.updateMany({
      where: { tenantId: req.tenantId, relatedStudentId: student.id },
      data: { relatedStudentId: null },
    }),
    prisma.student.delete({ where: { id: student.id } }),
  ]);

  await writeAudit({
    tenantId: req.tenantId,
    userId: req.user.id || req.user._id,
    action: 'student.purge',
    entityType: 'Student',
    entityId: student.id,
  });

  res.json({ message: 'Student permanently deleted' });
});

const emptyTrash = asyncHandler(async (req, res) => {
  const students = await prisma.student.findMany({
    where: {
      tenantId: req.tenantId,
      deletedAt: { not: null },
    },
    select: { id: true },
  });

  const ids = students.map((s) => s.id);
  if (!ids.length) {
    return res.json({ message: 'Recycle bin already empty', purged: 0 });
  }

  await prisma.$transaction([
    prisma.payment.deleteMany({ where: { tenantId: req.tenantId, studentId: { in: ids } } }),
    prisma.attendance.deleteMany({ where: { tenantId: req.tenantId, studentId: { in: ids } } }),
    prisma.task.updateMany({
      where: { tenantId: req.tenantId, relatedStudentId: { in: ids } },
      data: { relatedStudentId: null },
    }),
    prisma.student.deleteMany({ where: { id: { in: ids }, tenantId: req.tenantId } }),
  ]);

  await writeAudit({
    tenantId: req.tenantId,
    userId: req.user.id || req.user._id,
    action: 'recycle.empty',
    entityType: 'Student',
    entityId: null,
  });

  res.json({ message: 'Recycle bin emptied', purged: ids.length });
});

module.exports = { listTrash, restoreItem, permanentDelete, emptyTrash };
