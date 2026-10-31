import React, { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class TabErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[TabErrorBoundary] Caught render error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto flex max-w-md flex-col items-center justify-center p-8 text-center animate-in fade-in">
          <div className="mb-4 rounded-full border border-rose-500/20 bg-rose-500/10 p-3 text-rose-400">
            <AlertTriangle size={28} />
          </div>
          <h3 className="text-base font-semibold text-zinc-100">
            {this.props.fallbackTitle || 'Failed to display this view'}
          </h3>
          <p className="mt-1 text-xs text-zinc-400">
            {this.state.error?.message || 'An unexpected error occurred while processing data.'}
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-2 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-700 active:scale-95"
          >
            <RefreshCw size={14} /> Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

