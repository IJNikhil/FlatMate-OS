import React, { useState, useEffect, useRef } from 'react';
import { Home, ShieldCheck, ArrowRight, Settings, ExternalLink, X } from 'lucide-react';
import { useAppData } from '../../../services/store/AppDataContext';
import { useToast } from '../../../components/ui/Toast';
import { triggerHapticFeedback } from '../../../components/ui/haptics';
import type { Member } from '../../../types/database';

const GoogleIcon = () => (
  <svg className="size-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

function parseJwt(token: string): { email?: string; name?: string; sub?: string } | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

interface GoogleTokenClient {
  requestAccessToken: (opts?: { prompt?: string }) => void;
}

export const LoginScreen: React.FC = () => {
  const { members, loginAsUser } = useAppData();
  const { showToast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [clientIdInput, setClientIdInput] = useState('');
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const tokenClientRef = useRef<GoogleTokenClient | null>(null);

  // Retrieve active Client ID from environment or localStorage
  const getClientId = (): string => {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('flatmate_google_client_id');
      if (stored) return stored.trim();
    }
    return (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
  };

  const handleAuthenticatedUser = async (email: string, displayName?: string, googleSub?: string) => {
    const cleanEmail = email.trim().toLowerCase();
    setIsProcessing(true);
    triggerHapticFeedback(30);

    try {
      // 1. Check if user already exists in household member roster
      const existing = members.find((m) => (m.email || '').toLowerCase() === cleanEmail);
      if (existing) {
        await loginAsUser(existing);
        showToast(`Welcome back, ${existing.name}!`, 'success');
        return;
      }

      // 2. Auto-provision newly authenticated Google user
      const name =
        displayName ||
        cleanEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

      const newMember: Member = {
        user_id: googleSub ? `USR_${googleSub.slice(-8)}` : `USR_${Date.now().toString(36)}`,
        name: name,
        email: cleanEmail,
        upi_id: '',
        is_active: true
      };

      await loginAsUser(newMember);
      showToast(`Welcome home, ${name}!`, 'success');
    } catch {
      showToast('Authentication succeeded, but failed to initialize household profile.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Check URL hash for OAuth redirect tokens (e.g. if redirected back from Google)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (hash.includes('access_token=')) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      if (accessToken) {
        window.history.replaceState({}, document.title, window.location.pathname);
        setIsProcessing(true);
        fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` }
        })
          .then((res) => res.json())
          .then((userInfo) => {
            if (userInfo.email) {
              handleAuthenticatedUser(userInfo.email, userInfo.name, userInfo.sub);
            }
          })
          .catch(() => {
            showToast('Failed to retrieve Google profile from redirect.', 'error');
            setIsProcessing(false);
          });
      }
    }
  }, []);

  // Initialize Google Identity Services (Token Client + ID Token button)
  useEffect(() => {
    const clientId = getClientId();
    if (!clientId || typeof window === 'undefined') return;

    interface GoogleAccountsApi {
      id?: {
        initialize: (config: object) => void;
        renderButton: (el: HTMLElement, opts: object) => void;
        prompt: () => void;
      };
      oauth2?: {
        initTokenClient: (config: object) => GoogleTokenClient;
      };
    }

    const win = window as unknown as { google?: { accounts?: GoogleAccountsApi } };
    const accounts = win.google?.accounts;

    if (!accounts) return;

    // 1. Initialize Token Client for popup account selection with permissions
    if (accounts.oauth2?.initTokenClient) {
      try {
        tokenClientRef.current = accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'openid email profile',
          callback: async (tokenResponse: { access_token?: string; error?: string }) => {
            if (tokenResponse.error) {
              setIsProcessing(false);
              showToast('Google Sign-In was cancelled.', 'info');
              return;
            }
            if (tokenResponse.access_token) {
              setIsProcessing(true);
              try {
                const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
                });
                const userInfo = await res.json();
                if (userInfo.email) {
                  await handleAuthenticatedUser(userInfo.email, userInfo.name, userInfo.sub);
                }
              } catch {
                showToast('Failed to fetch profile details from Google.', 'error');
                setIsProcessing(false);
              }
            }
          }
        });
      } catch (err) {
        console.warn('[LoginScreen] Error creating Google token client:', err);
      }
    }

    // 2. Initialize One-Tap / ID token button
    if (accounts.id?.initialize) {
      try {
        accounts.id.initialize({
          client_id: clientId,
          callback: (response: { credential?: string }) => {
            if (response.credential) {
              const decoded = parseJwt(response.credential);
              if (decoded?.email) {
                handleAuthenticatedUser(decoded.email, decoded.name, decoded.sub);
              }
            }
          }
        });

        if (googleBtnRef.current) {
          accounts.id.renderButton(googleBtnRef.current, {
            theme: 'filled_black',
            size: 'large',
            width: 320,
            text: 'continue_with',
            shape: 'pill'
          });
        }
      } catch (err) {
        console.warn('[LoginScreen] Error initializing Google One Tap:', err);
      }
    }
  }, []);

  const handleSignInWithGoogle = () => {
    triggerHapticFeedback(25);
    const clientId = getClientId();

    // If client ID is missing, open configuration dialog
    if (!clientId) {
      setShowConfigModal(true);
      return;
    }

    // 1. Try Token Client popup flow (requests user account & permission prompt)
    if (tokenClientRef.current) {
      setIsProcessing(true);
      tokenClientRef.current.requestAccessToken({ prompt: 'select_account' });
      return;
    }

    // 2. Fallback: Direct OAuth 2.0 Web Redirection to Google Accounts
    const redirectUri = window.location.origin + window.location.pathname;
    const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
      clientId
    )}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(
      'openid email profile'
    )}&prompt=select_account`;

    window.location.href = oauthUrl;
  };

  const handleSaveClientId = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = clientIdInput.trim();
    if (!cleanId || !cleanId.includes('.apps.googleusercontent.com')) {
      showToast('Please enter a valid Google OAuth Client ID ending in .apps.googleusercontent.com', 'error');
      return;
    }

    localStorage.setItem('flatmate_google_client_id', cleanId);
    setShowConfigModal(false);
    showToast('Google OAuth Client ID saved! Connecting...', 'success');

    // Trigger sign in immediately
    setTimeout(() => {
      handleSignInWithGoogle();
    }, 300);
  };

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-between bg-slate-950 px-6 py-10 pb-safe text-slate-50">
      <div className="my-auto space-y-8 text-center">
        {/* App Logo */}
        <div className="mx-auto grid size-20 place-items-center rounded-3xl bg-gradient-to-br from-blue-600 to-sky-500 text-white shadow-2xl shadow-blue-950/60 ring-1 ring-white/20">
          <Home size={38} aria-hidden="true" />
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">Welcome to FlatMate OS</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-50">Shared home, in sync.</h1>
          <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-slate-400">
            Household finances, grocery pantry, and monthly budget collection in one place.
          </p>
        </div>

        {/* Primary Action: Standard Google Sign-In */}
        <div className="pt-4 space-y-3">
          <div ref={googleBtnRef} className="flex justify-center" />

          <button
            type="button"
            onClick={handleSignInWithGoogle}
            disabled={isProcessing}
            className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl border border-white/20 bg-white px-6 font-semibold text-slate-900 shadow-xl shadow-black/40 transition-all hover:bg-slate-100 active:scale-95 disabled:opacity-60"
          >
            <GoogleIcon />
            <span className="text-sm font-medium">
              {isProcessing ? 'Connecting to Google…' : 'Sign in with Google'}
            </span>
          </button>
        </div>
      </div>

      {/* OAuth Client ID Configuration Modal (Only if Client ID is not configured) */}
      {showConfigModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4 backdrop-blur-sm animate-in fade-in"
        >
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <GoogleIcon />
                <h3 className="text-base font-semibold text-slate-50">Connect Google OAuth</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-slate-300">
              To authenticate using your device&apos;s logged-in Google account with permission consent, enter your Google Cloud OAuth Client ID:
            </p>

            <form onSubmit={handleSaveClientId} className="mt-4 space-y-4">
              <div>
                <label htmlFor="client-id-input" className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5">
                  Web Client ID
                </label>
                <input
                  id="client-id-input"
                  type="text"
                  required
                  autoFocus
                  value={clientIdInput}
                  onChange={(e) => setClientIdInput(e.target.value)}
                  placeholder="xxxxx.apps.googleusercontent.com"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-3 font-mono text-xs text-slate-50 outline-none placeholder:text-zinc-600 focus:border-sky-500"
                />
              </div>

              <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-3 text-xs text-sky-200">
                <p className="font-semibold mb-1">Quick Setup (Google Cloud Console):</p>
                <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px]">
                  <li>Create an <strong>OAuth 2.0 Client ID</strong> (Web App).</li>
                  <li>Add Authorized Origin: <code className="text-sky-300">{typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}</code></li>
                  <li>Paste the Client ID above.</li>
                </ol>
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-sky-400 hover:underline"
                >
                  <span>Open Google Cloud Credentials</span>
                  <ExternalLink size={12} />
                </a>
              </div>

              <button
                type="submit"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-950/40 transition-transform active:scale-95"
              >
                <span>Save &amp; Continue with Google</span>
                <ArrowRight size={15} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="flex items-center justify-between text-xs text-slate-500 pt-6">
        <div className="flex items-center gap-1.5 text-slate-400">
          <ShieldCheck size={14} className="text-sky-400" />
          <span>Google OAuth 2.0 Identity</span>
        </div>

        <button
          type="button"
          onClick={() => setShowConfigModal(true)}
          className="flex items-center gap-1 text-slate-500 hover:text-slate-300"
          title="Google OAuth Settings"
        >
          <Settings size={13} />
          <span>Config</span>
        </button>
      </footer>
    </div>
  );
};
