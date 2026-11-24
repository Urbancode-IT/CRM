const crypto = require('crypto');
const { prisma } = require('../config/db');
const { toApi } = require('../utils/toApi');
const { hashPassword } = require('../utils/password');
const asyncHandler = require('../utils/asyncHandler');
const { assertWithinLimit } = require('../services/planLimits');
const emailService = require('../services/emailService');
const { writeAudit } = require('../utils/audit');
const { issueTokenPair } = require('../services/authTokens');

async function linkInstructorProfile({ tenantId, user, membership, role, instructorId }) {
  if (role !== 'instructor') return membership;
  let instructor = null;
  if (instructorId) {
    instructor = await prisma.instructor.findFirst({ where: { id: instructorId, tenantId } });
  }
  if (!instructor && user?.email) {
    instructor = await prisma.instructor.findFirst({ where: { tenantId, email: user.email } });
  }
  if (instructor) {
    await prisma.instructor.update({
      where: { id: instructor.id },
      data: { userId: user.id },
    });
    membership = await prisma.membership.update({
      where: { id: membership.id },
      data: { instructorProfileId: instructor.id },
    });
  }
  return membership;
}

function clientBase() {
  return (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
}

const inviteMember = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '')
    .toLowerCase()
    .trim();
  const role = ['admin', 'staff', 'instructor'].includes(req.body.role)
    ? req.body.role
    : 'staff';
  if (!email) {
    res.status(400);
    throw new Error('Email is required');
  }

  await assertWithinLimit(req.tenantId, 'users');

  let user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: email.split('@')[0],
        email,
        password: await hashPassword(crypto.randomBytes(16).toString('hex')),
        role: 'tutor',
        onboardingCompleted: true,
        featureIntroSeen: true,
      },
    });
  }

  let membership = await prisma.membership.findFirst({
    where: { tenantId: req.tenantId, userId: user.id },
  });
  if (membership?.status === 'active') {
    res.status(400);
    throw new Error('User is already a member of this workspace');
  }

  const inviteToken = crypto.randomBytes(24).toString('hex');
  const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  if (membership) {
    membership = await prisma.membership.update({
      where: { id: membership.id },
      data: {
        role,
        status: 'invited',
        invitedEmail: email,
        inviteToken,
        inviteExpiresAt,
      },
    });
  } else {
    membership = await prisma.membership.create({
      data: {
        tenantId: req.tenantId,
        userId: user.id,
        role,
        status: 'invited',
        invitedEmail: email,
        inviteToken,
        inviteExpiresAt,
      },
    });
  }

  membership = await linkInstructorProfile({
    tenantId: req.tenantId,
    user,
    membership,
    role,
    instructorId: req.body.instructorId,
  });

  const acceptUrl = `${clientBase()}/invite/${inviteToken}`;
  await emailService.sendInviteEmail(email, {
    inviterName: req.user.name,
    workspaceName: req.tenant?.name || 'workspace',
    role,
    acceptUrl,
  });

  await writeAudit({
    tenantId: req.tenantId,
    userId: req.user.id,
    action: 'member.invite',
    entityType: 'Membership',
    entityId: membership.id,
    meta: { email, role },
  });

  res.status(201).json({
    ok: true,
    member: {
      id: membership.id,
      _id: membership.id,
      role: membership.role,
      status: membership.status,
      invitedEmail: email,
      inviteExpiresAt,
    },
    acceptUrl: process.env.NODE_ENV === 'production' ? undefined : acceptUrl,
  });
});

const acceptInvite = asyncHandler(async (req, res) => {
  const { token, name, password } = req.body;
  if (!token) {
    res.status(400);
    throw new Error('Invite token is required');
  }

  const found = await prisma.membership.findFirst({
    where: {
      inviteToken: token,
      status: 'invited',
    },
    include: { user: true },
  });

  if (!found || (found.inviteExpiresAt && found.inviteExpiresAt < new Date())) {
    res.status(400);
    throw new Error('Invite is invalid or expired');
  }

  const userData = {
    activeTenantId: found.tenantId,
    onboardingCompleted: true,
  };
  if (name) userData.name = String(name).trim();
  if (password && String(password).length >= 6) {
    userData.password = await hashPassword(String(password));
    userData.authProvider = 'local';
  }
  const user = await prisma.user.update({ where: { id: found.userId }, data: userData });

  let membership = await prisma.membership.update({
    where: { id: found.id },
    data: {
      status: 'active',
      inviteToken: null,
      inviteExpiresAt: null,
    },
  });

  membership = await linkInstructorProfile({
    tenantId: membership.tenantId,
    user,
    membership,
    role: membership.role,
  });

  const tenant = await prisma.tenant.findUnique({ where: { id: membership.tenantId } });
  const subscription = await prisma.subscription.findFirst({
    where: { tenantId: membership.tenantId },
    include: { plan: true },
  });
  await issueTokenPair(res, user, membership, req);

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      onboardingCompleted: true,
      featureIntroSeen: true,
      tenantId: tenant?.id,
      tenant: tenant
        ? { id: tenant.id, name: tenant.name, slug: tenant.slug }
        : null,
      membershipRole: membership.role,
      subscription: subscription
        ? {
            status: subscription.status,
            plan: subscription.plan
              ? { code: subscription.plan.code, name: subscription.plan.name, limits: subscription.plan.limits }
              : null,
          }
        : null,
    },
  });
});

const getInvitePreview = asyncHandler(async (req, res) => {
  const membership = await prisma.membership.findFirst({
    where: {
      inviteToken: req.params.token,
      status: 'invited',
    },
    include: { tenant: { select: { id: true, name: true } } },
  });

  if (!membership || (membership.inviteExpiresAt && membership.inviteExpiresAt < new Date())) {
    res.status(404);
    throw new Error('Invite not found or expired');
  }

  res.json({
    email: membership.invitedEmail,
    role: membership.role,
    workspaceName: membership.tenant?.name || 'Workspace',
    expiresAt: membership.inviteExpiresAt,
  });
});

const updateMember = asyncHandler(async (req, res) => {
  const membership = await prisma.membership.findFirst({
    where: { id: req.params.id, tenantId: req.tenantId },
  });
  if (!membership) {
    res.status(404);
    throw new Error('Member not found');
  }
  if (membership.role === 'owner') {
    res.status(400);
    throw new Error('Cannot change owner membership');
  }
  const data = {};
  if (req.body.role && ['admin', 'staff', 'instructor'].includes(req.body.role)) {
    data.role = req.body.role;
  }
  if (req.body.status && ['active', 'disabled'].includes(req.body.status)) {
    data.status = req.body.status;
  }
  const updated = Object.keys(data).length
    ? await prisma.membership.update({ where: { id: membership.id }, data })
    : membership;
  res.json({ member: toApi(updated) });
});

const revokeMember = asyncHandler(async (req, res) => {
  const membership = await prisma.membership.findFirst({
    where: { id: req.params.id, tenantId: req.tenantId },
  });
  if (!membership) {
    res.status(404);
    throw new Error('Member not found');
  }
  if (membership.role === 'owner') {
    res.status(400);
    throw new Error('Cannot remove owner');
  }
  await prisma.membership.update({
    where: { id: membership.id },
    data: { status: 'disabled', inviteToken: null },
  });
  res.json({ ok: true });
});

module.exports = {
  inviteMember,
  acceptInvite,
  getInvitePreview,
  updateMember,
  revokeMember,
};
