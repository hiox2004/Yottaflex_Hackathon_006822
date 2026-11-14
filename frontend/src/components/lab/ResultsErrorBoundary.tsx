// Keeps a render error in the results from taking the whole Test Lab page down. The fallback offers the page's Clear session.
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '../ui/button';

interface Props {
  children?: ReactNode;
  onClear: () => void;
}

interface State {
  failed: boolean;
}

export class ResultsErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Test Lab results could not be rendered', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children ?? null;
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
        <p>The saved results could not be shown. Clear the session to start again.</p>
        <Button size="sm" variant="outline" onClick={this.props.onClear}>
          Clear session
        </Button>
      </div>
    );
  }
}
