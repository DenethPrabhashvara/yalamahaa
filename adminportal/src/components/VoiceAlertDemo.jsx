import { useEffect, useState } from 'react'
import { PhoneCall } from './ui/icons'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'

// Phones one number with the voice flood alert: hazard tone, then a short English warning, said twice
// (API: POST /admin/sms/voice/demo-call)
export function VoiceAlertDemo() {
  const { canEdit } = useAuth()
  const { toast } = useToast()
  const [status, setStatus] = useState(null)
  const [phone, setPhone] = useState('')
  const [calling, setCalling] = useState(false)

  useEffect(() => {
    api('/admin/sms/voice/status')
      .then((result) => setStatus(result.data))
      .catch(() => setStatus(null))
  }, [])

  const call = async () => {
    setCalling(true)
    try {
      const result = await api('/admin/sms/voice/demo-call', { method: 'POST', body: { phone } })
      toast(`Calling ${result.data.to}. Answer to hear the alert.`, { title: 'Voice alert sent', tone: 'success' })
    } catch (error) {
      toast(error.message, { title: 'Call not placed', tone: 'error' })
    } finally {
      setCalling(false)
    }
  }

  if (!status) return null

  return (
    <div className="auto-alerts is-compact">
      <span className="auto-alerts-icon"><PhoneCall size={18} /></span>
      <div className="auto-alerts-copy">
        <strong>
          Voice flood alert{' '}
          <Badge tone={status.configured ? 'success' : 'neutral'} dot>{status.configured ? 'Ready' : 'Not set up'}</Badge>
        </strong>
        <span>A hazard tone, then (said twice): “{status.message}”</span>
        <audio controls preload="none" src={status.audio_url} style={{ width: '100%', marginTop: 6 }} />
        {canEdit && status.configured && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <label className="search-field" style={{ flex: 1, minWidth: 0 }}>
              <PhoneCall size={15} />
              <input type="tel" placeholder="0771234567" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <Button size="sm" loading={calling} disabled={!phone.trim()} onClick={call}>
              Call
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
