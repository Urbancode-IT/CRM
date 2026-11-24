const { prisma } = require('../config/db');
const { toApi } = require('../utils/toApi');
const { studentWhere } = require('../utils/studentQuery');
const asyncHandler = require('../utils/asyncHandler');
const { analyzeStudentProgress } = require('../services/aiService');

const getStudentAnalysis = asyncHandler(async (req, res) => {
  const student = await prisma.student.findFirst({
    where: studentWhere({ id: req.params.id, tenantId: req.tenantId }),
  });
  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }

  // aiService reads student._id; toApi exposes both `id` and `_id`.
  const result = await analyzeStudentProgress(toApi(student));
  res.json(result);
});

module.exports = { getStudentAnalysis };
