import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
  info: ErrorInfo | null
}

/** Catches render errors so a crash shows a readable message instead of a blank window. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info })
    // eslint-disable-next-line no-console
    console.error('Renderer crash:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen w-screen flex-col gap-3 overflow-auto bg-background p-8 text-foreground">
          <h1 className="text-lg font-semibold text-destructive">Ошибка интерфейса</h1>
          <pre className="select-text whitespace-pre-wrap rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-xs">
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
            {this.state.info?.componentStack}
          </pre>
          <button
            type="button"
            onClick={() => this.setState({ error: null, info: null })}
            className="w-fit rounded-md border border-border bg-muted/30 px-3 py-1.5 text-xs hover:bg-muted/50"
          >
            Повторить
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
