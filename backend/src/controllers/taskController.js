const Task = require('../models/Task');
const asyncHandler = require('../utils/asyncHandler');

const getTasks = asyncHandler(async (req, res) => {
  const { status, student, priority } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (student) filter.relatedStudent = student;
  if (priority) filter.priority = priority;

  const tasks = await Task.find(filter)
    .populate('relatedStudent', 'name')
    .sort({ dueDate: 1, createdAt: -1 });
  res.json(tasks);
});

const createTask = asyncHandler(async (req, res) => {
  const task = await Task.create(req.body);
  res.status(201).json(task);
});

const updateTask = asyncHandler(async (req, res) => {
  const task = await Task.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!task) {
    res.status(404);
    throw new Error('Task not found');
  }
  res.json(task);
});

const deleteTask = asyncHandler(async (req, res) => {
  const task = await Task.findByIdAndDelete(req.params.id);
  if (!task) {
    res.status(404);
    throw new Error('Task not found');
  }
  res.json({ message: 'Task deleted' });
});

module.exports = { getTasks, createTask, updateTask, deleteTask };
