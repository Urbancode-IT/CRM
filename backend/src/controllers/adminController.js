const { prisma } = require('../config/db');
const { toApi } = require('../utils/toApi');
const { studentWhere } = require('../utils/studentQuery');
const asyncHandler = require('../utils/asyncHandler');

const listTenants = asyncHandler(async (req, res) => {
  const tenants = await prisma.tenant.findMany({ orderBy: { createdAt: 'desc' } });
  const enriched = await Promise.all(
    tenants.map(async (t) => {
      const [members, students, records, subscription] = await Promise.all([
        prisma.membership.count({ where: { tenantId: t.id, status: 'active' } }),
        prisma.student.count({ where: studentWhere({ tenantId: t.id }) }),
        prisma.record.count({ where: { tenantId: t.id } }),
        prisma.subscription.findUnique({
          where: { tenantId: t.id },
          include: { plan: true },
        }),
      ]);
      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        businessCategory: t.businessCategory,
        status: t.status,
        trialEndsAt: t.trialEndsAt,
        createdAt: t.createdAt,
        members,
        students,
        records,
        subscription: toApi(subscription),
      };
    })
  );
  res.json({ tenants: enriched });
});

const updateTenantStatus = asyncHandler(async (req, res) => {
  const existing = await prisma.tenant.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404);
    throw new Error('Tenant not found');
  }
  const tenant = req.body.status
    ? await prisma.tenant.update({
        where: { id: existing.id },
        data: { status: req.body.status },
      })
    : existing;
  res.json({ tenant: toApi(tenant) });
});

const platformStats = asyncHandler(async (req, res) => {
  const [tenants, users, invoicesPaid, auditCount] = await Promise.all([
    prisma.tenant.count(),
    prisma.user.count(),
    prisma.invoice.aggregate({
      where: { status: 'paid' },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.auditLog.count(),
  ]);
  res.json({
    tenants,
    users,
    paidInvoiceCount: invoicesPaid._count?._all || 0,
    revenue: invoicesPaid._sum?.amount || 0,
    auditCount,
  });
});

const listAuditLogs = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.tenantId) where.tenantId = String(req.query.tenantId);
  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ logs: toApi(logs) });
});

module.exports = { listTenants, updateTenantStatus, platformStats, listAuditLogs };
