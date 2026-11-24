import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
});

function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&')}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

function clearClientAuthState() {
  localStorage.removeItem('tuition_token');
  localStorage.removeItem('tuition_user');
  localStorage.removeItem('tuition_tenant');
}

let refreshPromise = null;

async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = api
      .post('/auth/refresh')
      .then((res) => res)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.request.use((config) => {
  const tenantId = localStorage.getItem('tuition_tenant');
  if (tenantId) config.headers['X-Tenant-Id'] = tenantId;

  const csrf = readCookie('tusion_csrf');
  if (csrf) config.headers['X-CSRF-Token'] = csrf;

  // Never attach JWTs from localStorage — session is httpOnly cookies only.
  delete config.headers.Authorization;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config || {};
    const status = err.response?.status;
    const url = String(original.url || '');

    if (
      status === 401 &&
      !original._retry &&
      !url.includes('/auth/login') &&
      !url.includes('/auth/register') &&
      !url.includes('/auth/refresh') &&
      !url.includes('/auth/logout')
    ) {
      original._retry = true;
      try {
        await refreshSession();
        return api(original);
      } catch {
        /* fall through to logout redirect */
      }
    }

    if (status === 401) {
      clearClientAuthState();
      const path = window.location.pathname;
      if (
        path !== '/' &&
        !path.startsWith('/login') &&
        !path.startsWith('/register') &&
        !path.startsWith('/invite') &&
        !path.startsWith('/parent')
      ) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
