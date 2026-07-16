const Student = require('../models/Student');
const asyncHandler = require('../utils/asyncHandler');
const { analyzeStudentProgress } = require('../services/aiService');

const getStudentAnalysis = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }

  const result = await analyzeStudentProgress(student);
  res.json(result);
});

module.exports = { getStudentAnalysis };
