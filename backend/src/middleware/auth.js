const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    res.status(401);
    throw new Error('Not authorized, no token provided');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    res.status(401);
    throw new Error('Not authorized, invalid or expired token');
  }

  const user = await User.findById(decoded.id).select('-password');
  if (!user) {
    res.status(401);
    throw new Error('Not authorized, user no longer exists');
  }

  req.user = user;
  next();
});

module.exports = { protect };
