import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { extractReadableError } from '../lib/firebase';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: extractReadableError(
        error,
        'An unexpected error occurred while rendering ONEHUB.'
      ),
    };
  }

  componentDidCatch(error: unknown) {
    console.error('ONEHUB ErrorBoundary caught:', error);
  }

  handleReload = () => {
    this.setState({ hasError: false, message: '' });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh items-center justify-center bg-[#F7F8FC] p-6">
          <div className="elegance-card w-full max-w-md rounded-3xl p-6 text-center sm:p-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-100">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h1 className="mt-4 text-xl font-bold text-[#111827]">
              Something went wrong
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[#687386]">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="elegance-gradient mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Reload ONEHUB</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
