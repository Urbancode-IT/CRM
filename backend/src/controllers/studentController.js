const Student = require('../models/Student');
const asyncHandler = require('../utils/asyncHandler');

const getStudents = asyncHandler(async (req, res) => {
  const { status, search } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (search) filter.name = { $regex: search, $options: 'i' };

  const students = await Student.find(filter).sort({ name: 1 });
  res.json(students);
});

const getStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }
  res.json(student);
});

const createStudent = asyncHandler(async (req, res) => {
  const student = await Student.create(req.body);
  res.status(201).json(student);
});

const updateStudent = asyncHandler(async (req, res) => {
  const student = await Student.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }
  res.json(student);
});

const deleteStudent = asyncHandler(async (req, res) => {
  const student = await Student.findByIdAndDelete(req.params.id);
  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }
  res.json({ message: 'Student deleted' });
});

module.exports = { getStudents, getStudent, createStudent, updateStudent, deleteStudent };
