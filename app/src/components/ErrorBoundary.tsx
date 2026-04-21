import React, { Component, ErrorInfo, ReactNode } from "react";
import { Layout } from "./Layout";
import { Button } from "./ui/button";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <Layout hideNav hideHeader>
          <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
            <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-lg">
              <h2 className="text-2xl font-bold text-red-700 mb-4">Oops, something went wrong</h2>
              <p className="text-red-600 mb-6">
                We're sorry for the inconvenience. A runtime error has occurred.
              </p>
              <div className="bg-white p-4 rounded border border-red-100 text-left mb-6 overflow-auto max-h-40">
                <code className="text-sm text-red-500 font-mono">
                  {this.state.error?.message || "Unknown error"}
                </code>
              </div>
              <div className="flex gap-4 justify-center">
                <Button 
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => window.location.reload()}
                >
                  Reload Page
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => window.location.href = '/'}
                >
                  Go Home
                </Button>
              </div>
            </div>
          </div>
        </Layout>
      );
    }

    return this.props.children;
  }
}
import React, { Component, ErrorInfo, ReactNode } from "react";
import { Layout } from "./Layout";
import { Button } from "./ui/button";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <Layout hideNav hideHeader>
          <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
            <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-lg">
              <h2 className="text-2xl font-bold text-red-700 mb-4">Oops, something went wrong</h2>
              <p className="text-red-600 mb-6">
                We're sorry for the inconvenience. A runtime error has occurred.
              </p>
              <div className="bg-white p-4 rounded border border-red-100 text-left mb-6 overflow-auto max-h-40">
                <code className="text-sm text-red-500 font-mono">
                  {this.state.error?.message || "Unknown error"}
                </code>
              </div>
              <div className="flex gap-4 justify-center">
                <Button 
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => window.location.reload()}
                >
                  Reload Page
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => window.location.href = '/'}
                >
                  Go Home
                </Button>
              </div>
            </div>
          </div>
        </Layout>
      );
    }

    return this.props.children;
  }
}
