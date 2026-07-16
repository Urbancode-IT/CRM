// Vercel serverless entry — Express app handles all routes.
require('dotenv').config();
const app = require('../src/app');

module.exports = app;
