import React, { useState, useEffect, useRef } from 'react';
import { Home, ShieldCheck, Mail, ArrowRight, X, UserCheck } from 'lucide-react';
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

function parseJwtPayload(token: string): { email?: string; name?: string; sub?: string } | null {
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

export const LoginScreen: React.FC = () => {
  const { members, loginAsUser } = useAppData();
  const { showToast } = useToast();
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  // Initialize Google Identity Services (GIS) if client_id is available
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const win = window as unknown as { google?: { accounts?: { id?: { initialize: (config: object) => void; renderButton: (el: HTMLElement, opts: object) => void; prompt: () => void } } } };

    if (clientId && win.google?.accounts?.id) {
      try {
        win.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: { credential?: string }) => {
            if (response.credential) {
              const decoded = parseJwtPayload(response.credential);
              if (decoded?.email) {
                performLogin(decoded.email, decoded.name);
              }
            }
          }
        });

        if (googleBtnRef.current) {
          win.google.accounts.id.renderButton(googleBtnRef.current, {
            theme: 'outline',
            size: 'large',
            width: 320,
            text: 'continue_with'
          });
        }
      } catch (err) {
        console.warn('[LoginScreen] GIS initialization error:', err);
      }
    }
  }, []);

  const performLogin = async (rawEmail: string, preferredName?: string) => {
    const cleanEmail = rawEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      showToast('Please enter a valid Google email address.', 'error');
      return;
    }

    setIsProcessing(true);
    triggerHapticFeedback(25);

    try {
      // 1. Look up existing member by email
      const existing = members.find((m) => (m.email || '').toLowerCase() === cleanEmail);
      if (existing) {
        await loginAsUser(existing);
        showToast(`Welcome back, ${existing.name}!`, 'success');
        setIsPromptOpen(false);
        return;
      }

      // 2. Provision new member locally and immediately log in
      const displayName =
        preferredName ||
        cleanEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

      const newMember: Member = {
        user_id: `USR_${Date.now().toString(36)}`,
        name: displayName,
        email: cleanEmail,
        upi_id: '',
        is_active: true
      };

      await loginAsUser(newMember);
      showToast(`Welcome home, ${displayName}!`, 'success');
      setIsPromptOpen(false);
    } catch {
      showToast('Failed to sign in. Please try again.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleContinueWithGoogle = () => {
    triggerHapticFeedback(25);
    // If GIS prompt is available and configured, attempt it
    const win = window as unknown as { google?: { accounts?: { id?: { prompt: () => void } } } };
    if (import.meta.env.VITE_GOOGLE_CLIENT_ID && win.google?.accounts?.id?.prompt) {
      try {
        win.google.accounts.id.prompt();
      } catch {
        // Fall back to modal
      }
    }
    // Always open clean Google modal prompt immediately
    setIsPromptOpen(true);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await performLogin(googleEmail);
  };

  const handleSelectExistingMember = async (member: Member) => {
    triggerHapticFeedback(30);
    setIsProcessing(true);
    try {
      await loginAsUser(member);
      showToast(`Welcome back, ${member.name}!`, 'success');
      setIsPromptOpen(false);
    } catch {
      showToast('Failed to sign in as ' + member.name, 'error');
    } finally {
      setIsProcessing(false);
    }
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

        {/* Primary Action: Continue with Google */}
        <div className="pt-4 space-y-3">
          <div ref={googleBtnRef} className="flex justify-center" />

          <button
            type="button"
            onClick={handleContinueWithGoogle}
            disabled={isProcessing}
            className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl border border-white/20 bg-white px-6 font-semibold text-slate-900 shadow-xl shadow-black/40 transition-all hover:bg-slate-100 active:scale-95 disabled:opacity-60"
          >
            <GoogleIcon />
            <span className="text-sm font-medium">Continue with Google</span>
          </button>
        </div>
      </div>

      {/* Google Account Modal Dialog */}
      {isPromptOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm animate-in fade-in"
        >
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <GoogleIcon />
                <h3 className="text-base font-semibold text-slate-50">Sign in with Google</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPromptOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Switch if household members already loaded */}
            {members.length > 0 && (
              <div className="mt-4 mb-3">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">
                  Choose roommate profile:
                </p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {members.map((m) => (
                    <button
                      key={m.user_id}
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleSelectExistingMember(m)}
                      className="flex w-full items-center justify-between rounded-xl border border-white/5 bg-slate-800/60 px-3.5 py-2.5 text-left text-sm transition-all hover:border-sky-500/40 hover:bg-slate-800"
                    >
                      <div>
                        <div className="font-semibold text-slate-200">{m.name}</div>
                        <div className="text-xs text-slate-400">{m.email || `${m.user_id}@flatmate`}</div>
                      </div>
                      <UserCheck size={16} className="text-sky-400 shrink-0" />
                    </button>
                  ))}
                </div>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
                  <div className="relative flex justify-center text-xs"><span className="bg-slate-900 px-2 text-slate-500">or sign in with another email</span></div>
                </div>
              </div>
            )}

            <form onSubmit={handleEmailSubmit} className="mt-4 space-y-4">
              <div>
                <label htmlFor="google-email-input" className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">
                  Google Account Email
                </label>
                <div className="flex min-h-12 items-center rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 focus-within:border-sky-500">
                  <Mail size={16} className="mr-2.5 text-zinc-500 shrink-0" />
                  <input
                    id="google-email-input"
                    type="email"
                    required
                    autoFocus
                    value={googleEmail}
                    onChange={(e) => setGoogleEmail(e.target.value)}
                    placeholder="your.name@gmail.com"
                    className="w-full bg-transparent text-sm text-slate-50 outline-none placeholder:text-zinc-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isProcessing || !googleEmail.trim()}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-950/40 transition-transform active:scale-95 disabled:opacity-50"
              >
                <span>Continue</span>
                <ArrowRight size={15} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="text-center text-xs text-slate-500">
        <div className="flex items-center justify-center gap-1.5 text-slate-400">
          <ShieldCheck size={14} className="text-sky-400" />
          <span>Secure Google Cloud &amp; Apps Script Backend</span>
        </div>
      </footer>
    </div>
  );
};
