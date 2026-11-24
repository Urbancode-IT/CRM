import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { postAuthPath } from '../utils/postAuthPath';

export default function ProtectedRoute({ children, allowIncomplete = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-slate-500">Loading...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const target = postAuthPath(user);

  if (!allowIncomplete && target !== '/app') {
    return <Navigate to={target} replace />;
  }

  if (allowIncomplete) {
    if (location.pathname === '/onboarding' && user.onboardingCompleted) {
      return <Navigate to={target} replace />;
    }
    if (location.pathname === '/feature-intro') {
      if (!user.onboardingCompleted) return <Navigate to="/onboarding" replace />;
      if (user.featureIntroSeen) return <Navigate to="/app" replace />;
    }
  }

  return children;
}
