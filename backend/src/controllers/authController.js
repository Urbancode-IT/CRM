const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const asyncHandler = require('../utils/asyncHandler');

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: (email || '').toLowerCase() });

  if (!user || !(await user.comparePassword(password))) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  res.json({
    token: generateToken(user),
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
});

const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

module.exports = { login, me };
