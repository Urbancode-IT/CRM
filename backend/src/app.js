const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const taskRoutes = require('./routes/taskRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const analysisRoutes = require('./routes/analysisRoutes');
const cronRoutes = require('./routes/cronRoutes');
const moduleRoutes = require('./routes/moduleRoutes');
const customModuleRoutes = require('./routes/customModuleRoutes');
const formRoutes = require('./routes/formRoutes');
const workflowRoutes = require('./routes/workflowRoutes');
const billingRoutes = require('./routes/billingRoutes');
const adminRoutes = require('./routes/adminRoutes');
const batchRoutes = require('./routes/batchRoutes');
const reportRoutes = require('./routes/reportRoutes');
const parentRoutes = require('./routes/parentRoutes');
const publicFormRoutes = require('./routes/publicFormRoutes');
const recycleBinRoutes = require('./routes/recycleBinRoutes');
const instructorRoutes = require('./routes/instructorRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { sanitizeRequest } = require('./middleware/sanitize');
const { csrfProtect } = require('./middleware/csrf');
const { globalLimiter } = require('./middleware/rateLimit');
const connectDB = require('./config/db');

const app = express();

app.set('trust proxy', 1);

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

const isDev = process.env.NODE_ENV !== 'production';
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (isDev && /^http:\/\/localhost:\d+$/.test(origin)) return callback(null, true);
      if (origin === process.env.CLIENT_URL) return callback(null, true);
      if (/\.vercel\.app$/.test(origin || '')) return callback(null, true);
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id', 'X-CSRF-Token', 'X-XSRF-Token'],
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());
app.use(sanitizeRequest);
app.use(globalLimiter);
app.use(csrfProtect);

app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', product: 'Tusion', time: new Date().toISOString() })
);

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/cron', cronRoutes);
app.use('/api/modules', moduleRoutes);
app.use('/api/custom-modules', customModuleRoutes);
app.use('/api/forms', formRoutes);
app.use('/api/public/forms', publicFormRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/messages', require('./routes/messagingRoutes'));
app.use('/api/parent', parentRoutes);
app.use('/api/recycle-bin', recycleBinRoutes);
app.use('/api/instructors', instructorRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
