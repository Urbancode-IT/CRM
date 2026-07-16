const Payment = require('../models/Payment');
const Student = require('../models/Student');
const asyncHandler = require('../utils/asyncHandler');
const emailService = require('../services/emailService');

const getPayments = asyncHandler(async (req, res) => {
  const { student, status, month, year } = req.query;
  const filter = {};
  if (student) filter.student = student;
  if (status) filter.status = status;
  if (month) filter.month = Number(month);
  if (year) filter.year = Number(year);

  const payments = await Payment.find(filter)
    .populate('student', 'name email parentEmail')
    .sort({ year: -1, month: -1 });
  res.json(payments);
});

const createPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.create(req.body);
  res.status(201).json(payment);
});

// Marks a payment as paid and fires the automatic receipt email.
const markPaid = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id).populate('student');
  if (!payment) {
    res.status(404);
    throw new Error('Payment not found');
  }

  payment.status = 'paid';
  payment.paidDate = req.body.paidDate || new Date();
  payment.method = req.body.method || payment.method;
  await payment.save();

  const to = payment.student?.notificationEmail?.();
  const result = await emailService.sendReceiptEmail(to, {
    studentName: payment.student.name,
    amount: payment.amount,
    month: payment.month,
    year: payment.year,
    paidDate: payment.paidDate,
    method: payment.method,
  });
  payment.receiptSent = result.sent;
  await payment.save();

  res.json(payment);
});

const updatePayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!payment) {
    res.status(404);
    throw new Error('Payment not found');
  }
  res.json(payment);
});

const deletePayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findByIdAndDelete(req.params.id);
  if (!payment) {
    res.status(404);
    throw new Error('Payment not found');
  }
  res.json({ message: 'Payment deleted' });
});

module.exports = { getPayments, createPayment, markPaid, updatePayment, deletePayment };
