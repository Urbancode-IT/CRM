/** Best-effort API / network error message for auth and forms. */
export function getApiErrorMessage(err, fallback = 'Request failed') {
  const data = err?.response?.data;
  if (typeof data?.message === 'string' && data.message.trim()) return data.message.trim();
  if (Array.isArray(data?.errors) && data.errors[0]?.msg) return String(data.errors[0].msg);
  if (!err?.response) {
    if (err?.code === 'ERR_NETWORK' || /network|failed to fetch|connection/i.test(String(err?.message || ''))) {
      return 'Cannot reach the server. Check your connection and try again.';
    }
  }
  return fallback;
}
