import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from '../components/ui/icons'

const ToastContext = createContext(null)

const TOAST_ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
    if (timers.current[id]) {
      clearTimeout(timers.current[id])
      delete timers.current[id]
    }
  }, [])

  const toast = useCallback(
    (message, options = {}) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      let text = message
      let opts = options
      if (typeof message === 'object' && message !== null) {
        text = message.message || message.text || JSON.stringify(message)
        opts = {
          title: message.title || options.title,
          tone: message.tone || (message.type === 'critical' ? 'error' : message.type) || options.tone || 'info',
          duration: message.duration || options.duration,
        }
      } else if (typeof text !== 'string') {
        text = String(text ?? '')
      }
      const tone = opts.tone === 'critical' ? 'error' : (opts.tone || 'success')
      const next = {
        id,
        message: text,
        title: opts.title || null,
        tone,
        duration: opts.duration || 3800,
      }
      setToasts((current) => [...current.slice(-3), next])
      timers.current[id] = setTimeout(() => dismiss(id), next.duration)
      return id
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div className="toast-viewport" role="region" aria-label="Notifications">
        {toasts.map((item) => {
          const Icon = TOAST_ICONS[item.tone] || Info
          return (
            <div key={item.id} className={`toast toast-${item.tone}`} role="status">
              <span className="toast-icon">
                <Icon size={18} />
              </span>
              <div className="toast-copy">
                {item.title && <strong>{item.title}</strong>}
                <span>{item.message}</span>
              </div>
              <button
                type="button"
                className="toast-close"
                aria-label="Dismiss notification"
                onClick={() => dismiss(item.id)}
              >
                <X size={15} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context
}
