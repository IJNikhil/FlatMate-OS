import React from 'react';

interface LoadingSkeletonProps {
  rows?: number;
  className?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ rows = 4, className = '' }) => (
  <div role="status" aria-label="Loading" aria-busy="true" className={`divide-y divide-zinc-800/40 ${className}`}>
    <span className="sr-only">Loading content</span>
    {Array.from({ length: rows }, (_, index) => (
      <div key={index} className="flex min-h-20 items-center justify-between gap-4 px-2 py-5">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3.5 w-2/5 animate-pulse rounded bg-zinc-800/50" />
          <div className="h-3 w-1/4 animate-pulse rounded bg-zinc-800/50" />
        </div>
        <div className="h-4 w-16 animate-pulse rounded bg-zinc-800/50" />
      </div>
    ))}
  </div>
);
