import { useEffect, useRef, useState } from 'react';
import api from '../services/api';

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.getElementById('google-gsi');
    if (existing) {
      if (window.google?.accounts?.id) resolve();
      else {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Failed to load Google Sign-In')));
      }
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-gsi';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Sign-In'));
    document.head.appendChild(script);
  });
}

function GoogleIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.44a5.5 5.5 0 01-2.39 3.61v3h3.87c2.26-2.08 3.57-5.14 3.57-8.64z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.87-3a7.2 7.2 0 01-4.08 1.13c-3.14 0-5.8-2.12-6.75-4.97H1.27v3.11A12 12 0 0012 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.25 14.25A7.2 7.2 0 014.88 12c0-.78.14-1.54.37-2.25V6.64H1.27A12 12 0 000 12c0 1.94.46 3.77 1.27 5.36l3.98-3.11z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.43-3.43C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.27 6.64l3.98 3.11C6.2 6.89 8.86 4.77 12 4.77z"
      />
    </svg>
  );
}

export default function GoogleSignInButton({ onCredential, onError, label = 'Continue with Google' }) {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [clientId, setClientId] = useState('');
  const hostRef = useRef(null);
  const onCredentialRef = useRef(onCredential);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onCredentialRef.current = onCredential;
    onErrorRef.current = onError;
  }, [onCredential, onError]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const envId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
        let id = envId;
        let on = Boolean(envId);
        try {
          const res = await api.get('/auth/google/config');
          id = res.data.clientId || envId;
          on = Boolean(res.data.enabled || envId);
        } catch {
          /* env fallback */
        }
        if (cancelled) return;
        setClientId(id);
        setEnabled(on);
        if (!on || !id) {
          setReady(true);
          return;
        }

        await loadGoogleScript();
        if (cancelled || !window.google?.accounts?.id) return;

        window.google.accounts.id.initialize({
          client_id: id,
          callback: async (response) => {
            if (!response?.credential) {
              onErrorRef.current?.('Google Sign-In was cancelled');
              return;
            }
            setBusy(true);
            try {
              await onCredentialRef.current?.(response.credential);
            } catch (err) {
              onErrorRef.current?.(
                err.response?.data?.message || err.message || 'Google Sign-In failed'
              );
            } finally {
              setBusy(false);
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        if (hostRef.current) {
          hostRef.current.innerHTML = '';
          window.google.accounts.id.renderButton(hostRef.current, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            shape: 'pill',
            text: 'continue_with',
            width: Math.max(hostRef.current.offsetWidth || 320, 280),
          });
        }
        setReady(true);
      } catch (err) {
        if (!cancelled) onErrorRef.current?.(err.message || 'Google Sign-In unavailable');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleFallbackClick() {
    onErrorRef.current?.(
      'Google Sign-In is not configured yet. Add GOOGLE_CLIENT_ID (backend) and VITE_GOOGLE_CLIENT_ID (frontend) from Google Cloud Console.'
    );
  }

  if (!enabled) {
    return (
      <button
        type="button"
        onClick={handleFallbackClick}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
      >
        <GoogleIcon />
        {label}
      </button>
    );
  }

  return (
    <div className="relative w-full">
      <div
        className={`flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm ${
          busy ? 'opacity-60' : ''
        }`}
      >
        <GoogleIcon />
        {busy ? 'Connecting…' : ready ? label : 'Loading Google…'}
      </div>
      {/* Official GIS button overlays our styled face so clicks are valid */}
      <div
        ref={hostRef}
        className="absolute inset-0 overflow-hidden opacity-0"
        aria-hidden={busy}
        style={{ pointerEvents: busy ? 'none' : 'auto' }}
      />
    </div>
  );
}
