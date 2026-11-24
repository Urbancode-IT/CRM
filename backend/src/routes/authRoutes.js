const express = require('express');
const {
  register,
  login,
  logout,
  refreshSession,
  verifyMfaLogin,
  googleConfig,
  googleLogin,
  me,
  updateProfile,
  completeOnboarding,
  dismissFeatureIntro,
  updateTenantSettings,
} = require('../controllers/authController');
const {
  changePassword,
  beginMfaSetup,
  updateMfa,
  updateAccountSettings,
  getSessions,
  deleteSession,
  deleteOtherSessions,
  getMembers,
  exportPrivacyData,
  getCompliance,
} = require('../controllers/accountController');
const {
  inviteMember,
  acceptInvite,
  getInvitePreview,
  updateMember,
  revokeMember,
} = require('../controllers/inviteController');
const { requestLoginOtp, verifyLoginOtp } = require('../controllers/otpController');
const { protect, requireTenant, requireRole } = require('../middleware/auth');
const { authLimiter, otpLimiter } = require('../middleware/rateLimit');
const { validate, loginRules, registerRules } = require('../middleware/validate');

const router = express.Router();

router.post('/register', authLimiter, registerRules, validate, register);
router.post('/login', authLimiter, loginRules, validate, login);
router.post('/logout', logout);
router.post('/refresh', authLimiter, refreshSession);
router.post('/mfa/verify', authLimiter, verifyMfaLogin);
router.post('/otp/request', otpLimiter, requestLoginOtp);
router.post('/otp/verify', authLimiter, verifyLoginOtp);
router.get('/google/config', googleConfig);
router.post('/google', authLimiter, googleLogin);
router.get('/invites/:token', getInvitePreview);
router.post('/invites/accept', authLimiter, acceptInvite);
router.get('/me', protect, me);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, changePassword);
router.post('/mfa/setup', protect, beginMfaSetup);
router.put('/mfa', protect, updateMfa);
router.put('/settings', protect, updateAccountSettings);
router.get('/sessions', protect, getSessions);
router.delete('/sessions/:id', protect, deleteSession);
router.delete('/sessions', protect, deleteOtherSessions);
router.get('/members', protect, requireTenant, getMembers);
router.post('/members/invite', protect, requireTenant, requireRole('owner', 'admin'), inviteMember);
router.patch('/members/:id', protect, requireTenant, requireRole('owner', 'admin'), updateMember);
router.delete('/members/:id', protect, requireTenant, requireRole('owner', 'admin'), revokeMember);
router.get('/privacy/export', protect, exportPrivacyData);
router.get('/compliance', protect, getCompliance);
router.put('/onboarding', protect, requireTenant, completeOnboarding);
router.put('/feature-intro', protect, dismissFeatureIntro);
router.put('/tenant', protect, requireTenant, requireRole('owner', 'admin'), updateTenantSettings);

module.exports = router;
