import React, { useState } from 'react';
import { animate, motion, useMotionValue } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

interface SwipeActionRowProps {
  direction: 'left' | 'right';
  label: string;
  icon: LucideIcon;
  tone: 'emerald' | 'rose';
  onAction: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

const ACTION_WIDTH = 112;
const SWIPE_THRESHOLD = 58;

export const SwipeActionRow: React.FC<SwipeActionRowProps> = ({
  direction,
  label,
  icon: Icon,
  tone,
  onAction,
  disabled = false,
  children,
}) => {
  const x = useMotionValue(0);
  const [revealed, setRevealed] = useState(false);
  const isLeftAction = direction === 'left';
  const actionColor = tone === 'rose' ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-zinc-950';
  const constraints = isLeftAction
    ? { left: -ACTION_WIDTH, right: 0 }
    : { left: 0, right: ACTION_WIDTH };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: { offset: { x: number } }) => {
    const passedThreshold = isLeftAction
      ? info.offset.x <= -SWIPE_THRESHOLD
      : info.offset.x >= SWIPE_THRESHOLD;
    if (passedThreshold) {
      setRevealed(true);
      void animate(x, isLeftAction ? -ACTION_WIDTH : ACTION_WIDTH, {
        type: 'spring',
        stiffness: 420,
        damping: 34,
      });
    } else {
      setRevealed(false);
      void animate(x, 0, { type: 'spring', stiffness: 420, damping: 34 });
    }
  };

  const handleAction = () => {
    if (disabled) return;
    setRevealed(false);
    void animate(x, 0, { duration: 0.14 });
    onAction();
  };

  return (
    <div className="relative overflow-hidden touch-pan-y">
      <div className={`absolute inset-y-0 ${isLeftAction ? 'right-0' : 'left-0'} flex w-28 items-center justify-center ${actionColor}`}>
        <button
          type="button"
          onClick={handleAction}
          disabled={disabled || !revealed}
          aria-label={label}
          className="flex h-full w-full flex-col items-center justify-center gap-1 text-xs font-semibold disabled:cursor-default"
        >
          <Icon size={19} aria-hidden="true" />
          {label}
        </button>
      </div>
      <motion.div
        drag={disabled ? false : 'x'}
        dragConstraints={constraints}
        dragElastic={0.06}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className="relative z-[1] bg-black"
      >
        {children}
      </motion.div>
    </div>
  );
};
