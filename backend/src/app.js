const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const taskRoutes = require('./routes/taskRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const analysisRoutes = require('./routes/analysisRoutes');
const cronRoutes = require('./routes/cronRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const connectDB = require('./config/db');

const app = express();

// Ensure Mongo is connected on every serverless invocation (no-op when already warm).
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

// In development, Vite auto-increments its port (5173, 5174, ...) if one is busy, so allow
// any localhost origin rather than pinning to a single CLIENT_URL that goes stale.
const isDev = process.env.NODE_ENV !== 'production';
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (isDev && /^http:\/\/localhost:\d+$/.test(origin)) return callback(null, true);
      if (origin === process.env.CLIENT_URL) return callback(null, true);
      // Allow any *.vercel.app preview / production frontend when CLIENT_URL is unset or mismatched.
      if (/\.vercel\.app$/.test(origin || '')) return callback(null, true);
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
  })
);
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/cron', cronRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
