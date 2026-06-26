import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time exceptions so a thrown component never leaves the user
 * staring at a frozen blank page. Shows a recoverable message instead.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface the failure in the console for debugging.
    console.error("GSOptimizer crashed:", error, info.componentStack);
  }

  handleReset = () => {
    // Drop any shared-config query params and reload to a clean state.
    window.location.href = window.location.pathname;
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 bg-surface-900 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-danger/15">
            <svg className="h-6 w-6 text-accent-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[#f5f5f5]">Something went wrong</h1>
            <p className="mt-1 max-w-sm text-[13px] text-surface-400">
              The optimizer hit an unexpected error and stopped. Your data is safe — reset to start over.
            </p>
          </div>
          {this.state.error.message && (
            <code className="max-w-md rounded-lg bg-surface-800 px-3 py-2 text-[11px] text-surface-400">
              {this.state.error.message}
            </code>
          )}
          <button
            type="button"
            onClick={this.handleReset}
            className="mt-1 rounded-xl bg-accent-primary px-5 py-2.5 text-[13px] font-semibold text-surface-900 transition-all duration-150 hover:brightness-110"
          >
            Reset & reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
