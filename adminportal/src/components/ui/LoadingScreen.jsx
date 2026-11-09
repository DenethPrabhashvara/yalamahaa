import { Loader2 } from './icons'

export function LoadingScreen({ label }) {
  return (
    <div className="loading-screen" role="status">
      <Loader2 size={22} className="spin" />
      <span>{label}</span>
    </div>
  )
}
