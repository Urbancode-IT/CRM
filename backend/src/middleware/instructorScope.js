const { prisma } = require('../config/db');
const { toApi } = require('../utils/toApi');
const asyncHandler = require('../utils/asyncHandler');

/**
 * For membership role `instructor`, attach scoped batch/student filters.
 * Owners/admins/staff are unrestricted (req.instructorScope = null).
 */
const attachInstructorScope = asyncHandler(async (req, res, next) => {
  if (req.memberRole !== 'instructor') {
    req.instructorScope = null;
    return next();
  }

  let instructor = null;
  const profileId = req.membership?.instructorProfileId || req.membership?.instructorProfile;
  if (profileId && typeof profileId !== 'object') {
    instructor = await prisma.instructor.findFirst({
      where: {
        id: String(profileId),
        tenantId: req.tenantId,
      },
    });
  }
  if (!instructor) {
    instructor = await prisma.instructor.findFirst({
      where: { tenantId: req.tenantId, userId: req.user.id },
    });
  }

  if (!instructor) {
    res.status(403);
    throw new Error('Instructor profile not linked. Ask the owner to link your login.');
  }

  const batches = await prisma.batch.findMany({
    where: { tenantId: req.tenantId, instructorId: instructor.id },
    select: { id: true, name: true },
  });
  const batchIds = batches.map((b) => b.id);
  const batchNames = batches.map((b) => b.name).filter(Boolean);

  req.instructorProfile = toApi(instructor);
  req.instructorScope = {
    instructorId: instructor.id,
    batchIds,
    batchNames,
    studentFilter: {
      tenantId: req.tenantId,
      OR: [
        ...(batchIds.length ? [{ batchRefId: { in: batchIds } }] : []),
        ...(batchNames.length ? [{ batch: { in: batchNames } }] : []),
      ],
    },
  };

  // Empty OR would match nothing useful — force empty result set.
  if (!batchIds.length && !batchNames.length) {
    req.instructorScope.studentFilter = { tenantId: req.tenantId, id: { in: [] } };
  }

  next();
});

module.exports = { attachInstructorScope };
