const { prisma } = require('../config/db');
const { toApi, toApiList } = require('../utils/toApi');
const { studentWhere } = require('../utils/studentQuery');
const asyncHandler = require('../utils/asyncHandler');
const pick = require('../utils/pick');
const { writeAudit } = require('../utils/audit');
const { runWorkflows } = require('../services/workflowService');

const STUDENT_FIELDS = [
  'name',
  'email',
  'phone',
  'parentName',
  'parentEmail',
  'parentPhone',
  'subjects',
  'grade',
  'batch',
  'batchRef',
  'batchRefId',
  'joinDate',
  'monthlyFee',
  'status',
  'notes',
  'customValues',
];

/** Coerce request payload into Prisma-compatible student data. */
function normalizeStudentData(data) {
  const out = { ...data };
  if (out.batchRef !== undefined && out.batchRefId === undefined) {
    out.batchRefId =
      out.batchRef && typeof out.batchRef === 'object'
        ? out.batchRef.id || out.batchRef._id || null
        : out.batchRef || null;
    delete out.batchRef;
  }
  if (out.batchRefId === '') out.batchRefId = null;
  if (out.joinDate !== undefined) {
    if (out.joinDate === null || out.joinDate === '') delete out.joinDate;
    else out.joinDate = new Date(out.joinDate);
  }
  if (out.monthlyFee !== undefined) out.monthlyFee = Number(out.monthlyFee) || 0;
  if (out.subjects !== undefined && !Array.isArray(out.subjects)) {
    out.subjects =
      typeof out.subjects === 'string'
        ? out.subjects.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
  }
  if (out.customValues !== undefined) {
    if (out.customValues instanceof Map) out.customValues = Object.fromEntries(out.customValues);
    else if (out.customValues === null || typeof out.customValues !== 'object') out.customValues = {};
  }
  return out;
}

function scopedStudentWhere(req, extra = {}) {
  const scope = req.instructorScope?.studentFilter;
  return studentWhere({
    ...extra,
    tenantId: req.tenantId,
    // AND keeps instructor scope intact even when extra filters share keys (e.g. id).
    ...(scope ? { AND: [scope] } : {}),
  });
}

const getStudents = asyncHandler(async (req, res) => {
  const { status, search } = req.query;
  const extra = {};
  if (status) extra.status = status;
  if (search) extra.name = { contains: String(search), mode: 'insensitive' };

  const students = await prisma.student.findMany({
    where: scopedStudentWhere(req, extra),
    orderBy: { name: 'asc' },
  });
  res.json(toApiList(students));
});

const getStudent = asyncHandler(async (req, res) => {
  const student = await prisma.student.findFirst({
    where: scopedStudentWhere(req, { id: req.params.id }),
  });
  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }
  res.json(toApi(student));
});

const createStudent = asyncHandler(async (req, res) => {
  const data = normalizeStudentData(pick(req.body, STUDENT_FIELDS));
  const student = await prisma.student.create({
    data: { ...data, tenantId: req.tenantId },
  });
  await writeAudit({
    tenantId: req.tenantId,
    userId: req.user.id,
    action: 'student.create',
    entityType: 'Student',
    entityId: student.id,
  });
  await runWorkflows({
    tenantId: req.tenantId,
    systemKey: 'students',
    trigger: 'create',
    record: toApi(student),
    user: req.user,
  });
  res.status(201).json(toApi(student));
});

const updateStudent = asyncHandler(async (req, res) => {
  const data = normalizeStudentData(pick(req.body, STUDENT_FIELDS));
  const existing = await prisma.student.findFirst({
    where: studentWhere({ id: req.params.id, tenantId: req.tenantId }),
    select: { id: true },
  });
  if (!existing) {
    res.status(404);
    throw new Error('Student not found');
  }
  const student = await prisma.student.update({
    where: { id: existing.id },
    data,
  });
  await writeAudit({
    tenantId: req.tenantId,
    userId: req.user.id,
    action: 'student.update',
    entityType: 'Student',
    entityId: student.id,
  });
  await runWorkflows({
    tenantId: req.tenantId,
    systemKey: 'students',
    trigger: 'update',
    record: toApi(student),
    user: req.user,
  });
  res.json(toApi(student));
});

const deleteStudent = asyncHandler(async (req, res) => {
  const student = await prisma.student.findFirst({
    where: studentWhere({ id: req.params.id, tenantId: req.tenantId }),
  });
  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }

  await prisma.student.update({
    where: { id: student.id },
    data: { deletedAt: new Date(), deletedById: req.user.id },
  });

  await writeAudit({
    tenantId: req.tenantId,
    userId: req.user.id,
    action: 'student.trash',
    entityType: 'Student',
    entityId: student.id,
  });
  await runWorkflows({
    tenantId: req.tenantId,
    systemKey: 'students',
    trigger: 'delete',
    record: { _id: student.id, id: student.id, name: student.name },
    user: req.user,
  });

  res.json({ message: 'Student moved to recycle bin' });
});

module.exports = { getStudents, getStudent, createStudent, updateStudent, deleteStudent };
