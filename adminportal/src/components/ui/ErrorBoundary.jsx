import { Component } from 'react'
import { AlertTriangle, RefreshCw } from './icons'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    if (this.props.onReset) {
      this.props.onReset()
    } else {
      window.location.href = '/'
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return (
        <div className="page" style={{ padding: '48px 24px', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <div className="card" style={{ maxWidth: 520, width: '100%', padding: '32px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'inline-flex', padding: 14, borderRadius: '50%', background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626', marginBottom: 16 }}>
              <AlertTriangle size={32} />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>
              Something went wrong loading this view
            </h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24, maxWidth: 420 }}>
              {this.state.error?.message || 'An unexpected error occurred while rendering. You can try refreshing or return to the dashboard.'}
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { window.location.href = '/' }}
              >
                Go to Dashboard
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={this.handleReset}
              >
                <RefreshCw size={14} />
                Try again
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
