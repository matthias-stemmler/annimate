import { ErrorAlert } from '@/components/error-alert';
import { Component, PropsWithChildren } from 'react';
import { useRouteError } from 'react-router-dom';

type ErrorBoundaryState = {
  error?: Error;
};

export class ErrorBoundary extends Component<
  PropsWithChildren,
  ErrorBoundaryState
> {
  constructor(props: PropsWithChildren) {
    super(props);
    this.state = { error: undefined };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    return this.state.error !== undefined ? (
      <ErrorAlert message={this.state.error.message} />
    ) : (
      this.props.children
    );
  }
}

export const RouteErrorBoundary = () => {
  const error = useRouteError();
  return (
    <ErrorAlert
      message={
        error instanceof Error ? error.message : 'Sorry, something went wrong'
      }
    />
  );
};
