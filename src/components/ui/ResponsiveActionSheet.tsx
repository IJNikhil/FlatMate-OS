import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ResponsiveActionSheetProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  closeDisabled?: boolean;
  children: React.ReactNode;
}

export const ResponsiveActionSheet: React.FC<ResponsiveActionSheetProps> = ({
  title,
  isOpen,
  onClose,
  closeDisabled = false,
  children,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !closeDisabled) onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeDisabled, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto md:flex md:justify-center">
      <button
        type="button"
        aria-label={`Dismiss ${title}`}
        disabled={closeDisabled}
        onClick={onClose}
        className="fixed inset-0 z-0 bg-slate-950/60 opacity-100 backdrop-blur-md transition-opacity duration-300 starting:opacity-0 motion-reduce:transition-none disabled:cursor-default"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 z-10 mx-auto max-h-[90dvh] w-full overflow-y-auto overscroll-contain rounded-t-3xl border border-zinc-800/40 bg-zinc-900/90 p-5 pb-safe text-zinc-50 shadow-2xl shadow-black/50 backdrop-blur-xl scrollbar-hide transition-[transform,opacity] duration-300 ease-out starting:translate-y-full starting:scale-95 md:relative md:inset-auto md:mt-[10vh] md:max-h-[80dvh] md:max-w-md md:rounded-2xl md:starting:translate-y-0 md:starting:scale-95 motion-reduce:transition-none"
      >
        <div className="pb-24 md:pb-5">
          <div className="relative mb-4 flex min-h-11 items-center justify-center">
            <div aria-hidden="true" className="h-1 w-10 rounded-full bg-zinc-700 md:hidden" />
            <button
              type="button"
              aria-label={`Close ${title}`}
              disabled={closeDisabled}
              onClick={onClose}
              className="absolute right-0 grid size-11 place-items-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-50 focus-visible:outline-2 focus-visible:outline-sky-400 disabled:opacity-50"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          {children}
        </div>
      </section>
    </div>
  );
};
