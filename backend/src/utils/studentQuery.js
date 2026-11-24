/** Build Student where clause; excludes soft-deleted unless withDeleted. */
function studentWhere(extra = {}, { withDeleted = false } = {}) {
  const where = { ...extra };
  if (!withDeleted) {
    where.deletedAt = null;
  }
  return where;
}

function notificationEmail(student) {
  if (!student) return null;
  return student.email || student.parentEmail || null;
}

module.exports = { studentWhere, notificationEmail };
