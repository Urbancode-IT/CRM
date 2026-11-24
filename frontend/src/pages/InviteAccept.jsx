import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import BrandMark from '../components/BrandMark';
import { BRAND_NAME } from '../constants/brand';
import { postAuthPath } from '../utils/postAuthPath';

export default function InviteAccept() {
  const { token } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const [preview, setPreview] = useState(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/auth/invites/${token}`)
      .then((res) => setPreview(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Invite not found'));
  }, [token]);

  async function accept(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post('/auth/invites/accept', { token, name, password });
      localStorage.setItem('tuition_user', JSON.stringify(res.data.user));
      if (res.data.user?.tenantId) localStorage.setItem('tuition_tenant', res.data.user.tenantId);
      localStorage.removeItem('tuition_token');
      if (auth?.refreshUser) {
        await auth.refreshUser();
      } else {
        window.location.assign(postAuthPath(res.data.user));
        return;
      }
      navigate(postAuthPath(res.data.user));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not accept invite');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form onSubmit={accept} className="w-full max-w-md rounded-2xl border border-brand-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <BrandMark className="h-8 w-8" />
          <span className="font-display text-lg font-semibold">{BRAND_NAME}</span>
        </div>
        <h1 className="text-lg font-semibold">Accept invite</h1>
        {preview && (
          <p className="mt-1 text-sm text-slate-500">
            Join <strong>{preview.workspaceName}</strong> as {preview.role} ({preview.email})
          </p>
        )}
        {error && <div className="mt-3 rounded-md bg-[#fdeaea] px-3 py-2 text-sm text-[#d03b3b]">{error}</div>}
        <div className="mt-4 space-y-3">
          <input
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
          />
          <input
            type="password"
            placeholder="Set password (min 6)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
          />
          <button type="submit" className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm text-white">
            Join workspace
          </button>
          <Link to="/login" className="block text-center text-xs text-slate-500 underline">
            Back to login
          </Link>
        </div>
      </form>
    </div>
  );
}
