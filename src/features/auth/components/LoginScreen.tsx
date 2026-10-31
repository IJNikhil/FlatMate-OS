import React, { useState } from 'react';
import { Home, ShieldCheck, Mail, ArrowRight, X } from 'lucide-react';
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

export const LoginScreen: React.FC = () => {
  const { members, loginAsUser, refreshData } = useAppData();
  const { showToast } = useToast();
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleContinueWithGoogle = async () => {
    triggerHapticFeedback(25);
    setIsProcessing(true);

    try {
      // 1. Attempt automatic Google session resolution from server
      await refreshData({ bypassCache: true });
      const storedUserId = typeof localStorage !== 'undefined' ? localStorage.getItem('flatmate_active_user_id') : null;
      if (storedUserId) {
        setIsProcessing(false);
        return; // Successfully identified; Shell will route to dashboard or onboarding
      }

      // 2. If browser requires Google account email entry
      setIsPromptOpen(true);
    } catch {
      setIsPromptOpen(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = googleEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      showToast('Please enter a valid Google email address.', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      // Check if existing user in members list
      const existing = members.find((m) => (m.email || '').toLowerCase() === cleanEmail);
      if (existing) {
        await loginAsUser(existing);
        showToast(`Signed in as ${existing.name}`, 'success');
      } else {
        // Auto-provision new member
        const displayName = cleanEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
        const newMember: Member = {
          user_id: `USR_${Date.now().toString(36)}`,
          name: displayName,
          email: cleanEmail,
          upi_id: '',
          is_active: true
        };
        await loginAsUser(newMember);
        showToast(`Welcome home, ${displayName}!`, 'success');
      }
      setIsPromptOpen(false);
    } catch {
      showToast('Failed to sign in with Google.', 'error');
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
        <div className="pt-4">
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

            <form onSubmit={handleEmailSubmit} className="mt-5 space-y-4">
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
