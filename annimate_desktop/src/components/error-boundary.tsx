import { Component, PropsWithChildren, ReactNode } from 'react';

export type ErrorBoundaryProps = PropsWithChildren<{
  fallback: (error: Error) => ReactNode;
}>;

type ErrorBoundaryState = {
  error?: Error;
};

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: undefined };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    return this.state.error !== undefined
      ? this.props.fallback(this.state.error)
      : this.props.children;
  }
}
