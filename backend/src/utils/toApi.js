/** Map Prisma FK field names → mongoose-style relation field names for API responses. */
const FK_TO_REL = {
  tenantId: 'tenant',
  userId: 'user',
  studentId: 'student',
  batchRefId: 'batchRef',
  deletedById: 'deletedBy',
  instructorId: 'instructor',
  instructorProfileId: 'instructorProfile',
  relatedStudentId: 'relatedStudent',
  planId: 'plan',
  subscriptionId: 'subscription',
  moduleId: 'module',
  lookupModuleId: 'lookupModule',
  createdById: 'createdBy',
  updatedById: 'updatedBy',
  activeTenantId: 'activeTenant',
};

/** Never serialize these fields into API/auth objects. */
const SENSITIVE_KEYS = new Set([
  'password',
  'mfaSecret',
  'mfaBackupCodes',
  'codeHash',
  'tokenHash',
  'refreshToken',
  'accessToken',
  'secret',
]);

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date);
}

/**
 * Serialize Prisma rows to mongoose-compatible API shape:
 * - adds `_id` from `id`
 * - exposes FK ids under relation names when the relation object is not loaded
 * - strips sensitive credential fields
 */
function toApi(doc) {
  if (doc == null) return doc;
  if (Array.isArray(doc)) return doc.map(toApi);
  if (doc instanceof Date) return doc;
  if (!isPlainObject(doc)) return doc;

  const out = {};
  const keys = Object.keys(doc);

  for (const key of keys) {
    if (SENSITIVE_KEYS.has(key)) continue;

    const value = doc[key];
    if (FK_TO_REL[key]) {
      const relName = FK_TO_REL[key];
      const relLoaded = keys.includes(relName) && isPlainObject(doc[relName]);
      if (!relLoaded) {
        out[relName] = value;
      }
      out[key] = value;
      continue;
    }

    if (Array.isArray(value)) {
      out[key] = value.map((item) => (isPlainObject(item) || Array.isArray(item) ? toApi(item) : item));
    } else if (isPlainObject(value)) {
      out[key] = toApi(value);
    } else {
      out[key] = value;
    }
  }

  if (out.id != null && out._id == null) {
    out._id = out.id;
  }

  return out;
}

function toApiList(rows) {
  return (rows || []).map(toApi);
}

module.exports = { toApi, toApiList, FK_TO_REL, SENSITIVE_KEYS };
