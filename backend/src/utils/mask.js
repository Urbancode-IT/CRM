/** Mask emails/phones for safe logging — never log full destinations or message bodies. */
function maskDestination(value) {
  const raw = String(value || '');
  if (!raw) return '(none)';
  if (raw.includes('@')) {
    const [local, domain] = raw.split('@');
    const safeLocal = local.length <= 2 ? `${local[0] || '*'}*` : `${local.slice(0, 2)}***`;
    return `${safeLocal}@${domain || '***'}`;
  }
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `***${digits.slice(-4)}`;
}

module.exports = { maskDestination };
