import React, { Component, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

const IS_DEV = import.meta.env.DEV;

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        className="flex items-center justify-center h-screen bg-gray-100"
        // Keep in sync with smoke-test.js
        id="top-level-error-boundary"
      >
        <div className="text-center p-8 bg-white shadow-lg rounded-lg">
          <h1 className="text-5xl font-extrabold text-primary-600 mb-6">
            Oops! Something went wrong.
          </h1>
          <p className="text-lg text-gray-700 mb-4">
            We apologize for the inconvenience. Please try again later.
          </p>
          {IS_DEV && this.state.error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded">
              <h2 className="text-2xl font-semibold text-red-700">
                Error Details:
              </h2>
              <p className="text-sm text-red-500 mt-2">
                {this.state.error.toString()}
              </p>
              {this.state.errorInfo && (
                <pre className="text-xs text-gray-600 mt-2 whitespace-pre-wrap">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
}
