import { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

function persistUserProfile(user) {
  if (!user) {
    localStorage.removeItem('tuition_user');
    localStorage.removeItem('tuition_tenant');
    localStorage.removeItem('tuition_token');
    return;
  }
  localStorage.setItem('tuition_user', JSON.stringify(user));
  if (user.tenantId) localStorage.setItem('tuition_tenant', user.tenantId);
  // Clear any legacy JWT stored in localStorage (session is httpOnly cookie now).
  localStorage.removeItem('tuition_token');
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('tuition_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  function persistUser(nextUser) {
    persistUserProfile(nextUser);
    setUser(nextUser);
  }

  useEffect(() => {
    api
      .get('/auth/me')
      .then((res) => persistUser(res.data.user))
      .catch(() => {
        persistUserProfile(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const res = await api.post('/auth/login', { email, password });
    if (res.data.mfaRequired) return res.data;
    persistUser(res.data.user);
    return res.data.user;
  }

  async function verifyMfa(mfaToken, code) {
    const res = await api.post('/auth/mfa/verify', { mfaToken, code });
    persistUser(res.data.user);
    return res.data.user;
  }

  async function loginWithOtp({ phone, email, code }) {
    const res = await api.post('/auth/otp/verify', { phone, email, code });
    persistUser(res.data.user);
    return res.data.user;
  }

  async function loginWithGoogle(credential) {
    const res = await api.post('/auth/google', { credential });
    if (res.data.mfaRequired) return res.data;
    persistUser(res.data.user);
    return res.data.user;
  }

  async function register(payload) {
    const res = await api.post('/auth/register', payload);
    persistUser(res.data.user);
    return res.data.user;
  }

  async function completeOnboarding(payload) {
    const res = await api.put('/auth/onboarding', payload);
    persistUser(res.data.user);
    return res.data.user;
  }

  async function dismissFeatureIntro() {
    const res = await api.put('/auth/feature-intro');
    persistUser(res.data.user);
    return res.data.user;
  }

  async function updateProfile(payload) {
    const res = await api.put('/auth/profile', payload);
    persistUser(res.data.user);
    return res.data.user;
  }

  async function refreshUser() {
    const res = await api.get('/auth/me');
    persistUser(res.data.user);
    return res.data.user;
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } catch {
      /* ignore network errors on logout */
    }
    persistUserProfile(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        verifyMfa,
        loginWithOtp,
        loginWithGoogle,
        register,
        logout,
        completeOnboarding,
        dismissFeatureIntro,
        updateProfile,
        refreshUser,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
