import { useMemo, useState } from 'react'
import { CheckCircle2, Eye, Send, Smartphone, Waves } from './ui/icons'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { Modal } from './ui/Overlay'

const SAMPLE_GAUGES = [
  { basin: 'Kelani Ganga', station: 'Kithulgala' },
  { basin: 'Kelani Ganga', station: 'Holombuwa' },
  { basin: 'Mahaweli Ganga', station: 'Nawalapitiya' },
  { basin: 'Gin Ganga', station: 'Baddegama' },
  { basin: 'Kalu Ganga', station: 'Putupaula' },
  { basin: 'Nilwala Ganga', station: 'Panadugama' },
]

const RISK_TIERS = [
  {
    id: 'higher_susceptibility',
    label: 'Higher Susceptibility (High Risk)',
    badgeTone: 'critical',
    desc: 'Low-lying / riverbank farm (0–2m elevation relative to river). Prone to direct flooding.',
    directiveEn: 'Your farm is more flood-prone. Move livestock, pumps & seed uphill. Avoid flooded crossings.',
    directiveSi: 'ඔබේ කුඹුරට ගංවතුර අවදානම වැඩියි. සතුන්, පොම්ප හා බීජ උස් තැනකට ගෙන යන්න. ජලයෙන් යටවූ මාර්ගවලින් නොයන්න.',
    directiveTa: 'உங்கள் வயலுக்கு வெள்ள அபாயம் அதிகம். கால்நடைகள், பம்புகள், விதைகளை மேட்டுக்கு நகர்த்துங்கள். வெள்ளப் பாதைகளைக் கடக்காதீர்கள்.',
    majorEn: 'Your farm is more flood-prone. Move people, livestock & seed to safe high ground now. Avoid crossings.',
    majorSi: 'ඔබේ කුඹුරට ගංවතුර අවදානම වැඩියි. මිනිසුන්, සතුන් හා බීජ දැන්ම ආරක්ෂිත උස් තැනකට ගෙන යන්න.',
    majorTa: 'உங்கள் வயலுக்கு வெள்ள அபாயம் அதிகம். மக்களை, கால்நடைகளை, விதைகளை உடனே பாதுகாப்பான மேட்டுக்கு நகர்த்துங்கள்.',
  },
  {
    id: 'normal',
    label: 'Moderate Susceptibility (Medium Risk)',
    badgeTone: 'warning',
    desc: 'Midland farm (2–5m elevation). Backwater ponding or drainage stagnation possible.',
    directiveEn: 'Floodwater may affect your area. Prepare to move livestock, pumps & seed. Avoid flooded crossings.',
    directiveSi: 'ඔබේ ප්‍රදේශයට ගංවතුර බලපෑ හැකියි. සතුන්, පොම්ප හා බීජ ගෙන යාමට සූදානම් වන්න. ජලයෙන් යටවූ මාර්ගවලින් නොයන්න.',
    directiveTa: 'உங்கள் பகுதியை வெள்ளம் பாதிக்கலாம். கால்நடைகள், பம்புகள், விதைகளை நகர்த்தத் தயாராகுங்கள். வெள்ளப் பாதைகளைக் கடக்காதீர்கள்.',
    majorEn: 'Move people, livestock & seed to safe high ground now. Avoid flooded crossings.',
    majorSi: 'මිනිසුන්, සතුන් හා බීජ දැන්ම ආරක්ෂිත උස් තැනකට ගෙන යන්න. ජලයෙන් යටවූ මාර්ගවලින් නොයන්න.',
    majorTa: 'மக்களை, கால்நடைகளை, விதைகளை உடனே பாதுகாப்பான மேட்டுக்கு நகர்த்துங்கள். வெள்ளப் பாதைகளைக் கடக்காதீர்கள்.',
  },
  {
    id: 'lower_susceptibility',
    label: 'Lower Susceptibility (Low Risk)',
    badgeTone: 'success',
    desc: 'Upland farm (>5m elevation). Farmland safe from inundation, but access roads may flood.',
    directiveEn: 'Your farm is less flood-prone, but access routes may flood. Keep monitoring; avoid flooded crossings.',
    directiveSi: 'ඔබේ කුඹුරට අවදානම අඩු වුවත් යන මාර්ග ජලයෙන් යටවිය හැකියි. විමසිල්ලෙන් සිටින්න.',
    directiveTa: 'உங்கள் வயலுக்கு அபாயம் குறைவு; அணுகும் பாதைகள் வெள்ளத்தில் மூழ்கலாம். தொடர்ந்து அவதானியுங்கள்.',
    majorEn: 'Your farm is less flood-prone, but routes may flood. Move to safety if needed; avoid crossings.',
    majorSi: 'ඔබේ කුඹුරට අවදානම අඩු වුවත් මාර්ග යටවිය හැකියි. අවශ්‍ය නම් ආරක්ෂිත තැනකට යන්න.',
    majorTa: 'உங்கள் வயலுக்கு அபாயம் குறைவு; பாதைகள் வெள்ளத்தில் மூழ்கலாம். தேவைப்பட்டால் பாதுகாப்பான இடத்துக்குச் செல்லுங்கள்.',
  },
]

export function FloodAlertDemo({ open, onClose, defaultGauge }) {
  const { toast } = useToast()
  const { canEdit } = useAuth()

  const [selectedGaugeIdx, setSelectedGaugeIdx] = useState(0)
  const [floodStage, setFloodStage] = useState('alert')
  const [riskTier, setRiskTier] = useState('higher_susceptibility')
  const [recipientType, setRecipientType] = useState('custom')
  const [phone, setPhone] = useState('')
  const [sending, setSending] = useState(false)
  const [sentResult, setSentResult] = useState(null)

  const activeGauge = defaultGauge || SAMPLE_GAUGES[selectedGaugeIdx]
  const activeTier = RISK_TIERS.find((t) => t.id === riskTier) || RISK_TIERS[0]

  const previewMessage = useMemo(() => {
    const alertNames = floodStage === 'major'
      ? 'MAJOR FLOOD / ප්‍රධාන ගංවතුර / பெரு வெள்ளம்'
      : 'FLOOD ALERT / ගංවතුර අනතුරු ඇඟවීම / வெள்ள எச்சரிக்கை'

    const stageName = floodStage === 'major'
      ? 'major flood level / ප්‍රධාන ගංවතුර මට්ටම / பெரு வெள்ள மட்டம்'
      : 'alert level / අනතුරු මට්ටම / எச்சரிக்கை மட்டம்'

    const level = floodStage === 'major' ? '5.20m' : '3.15m'
    const where = `${activeGauge.basin} - ${activeGauge.station}`

    const enText = floodStage === 'major' ? activeTier.majorEn : activeTier.directiveEn
    const siText = floodStage === 'major' ? activeTier.majorSi : activeTier.directiveSi
    const taText = floodStage === 'major' ? activeTier.majorTa : activeTier.directiveTa

    return [
      `Yala Maha: ${alertNames}`,
      `${where}: ${level} (${stageName})`,
      `EN: ${enText}`,
      `SI: ${siText}`,
      `TA: ${taText}`,
    ].join('\n')
  }, [floodStage, activeGauge, activeTier])

  const handleSend = async () => {
    if (recipientType === 'custom' && !phone.trim()) {
      toast('Please enter a phone number (e.g. 077 123 4567).', { tone: 'warning' })
      return
    }

    setSending(true)
    setSentResult(null)
    try {
      const payload = {
        basin: activeGauge.basin,
        station: activeGauge.station,
        floodStage,
        riskCategory: riskTier,
        phone: recipientType === 'custom' ? phone.trim() : undefined,
        farmerName: recipientType === 'custom' ? 'Demonstration' : undefined,
      }

      const res = await api('/admin/sms/auto-alerts/demo-send', {
        method: 'POST',
        body: payload,
      })

      setSentResult(res.data)
      toast(
        `Alert SMS dispatched to ${res.data.phone}${res.data.dry_run ? ' (Dry run mode)' : ' via Text.lk'}!`,
        { title: 'Flood Alert Sent', tone: 'success' }
      )
    } catch (err) {
      toast(err.message || 'Failed to send flood alert demo.', { title: 'Dispatch Error', tone: 'error' })
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !sending && onClose()}
      title="Manual Flood Alert Demonstration"
      subtitle="Demonstrate how satellite DEM terrain elevation alters the advisory instructions delivered to farmers."
      icon={Waves}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={sending}>
            Close
          </Button>
          {canEdit && (
            <Button variant="primary" icon={Send} loading={sending} onClick={handleSend}>
              Send Demo SMS Now
            </Button>
          )}
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* River & Flood Severity Selection */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>
              River Gauge Station
            </label>
            <select
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
              value={selectedGaugeIdx}
              onChange={(e) => setSelectedGaugeIdx(Number(e.target.value))}
            >
              {SAMPLE_GAUGES.map((g, idx) => (
                <option key={`${g.basin}-${g.station}`} value={idx}>
                  {g.basin} — {g.station}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>
              Simulated Flood Stage
            </label>
            <div className="segmented" style={{ width: '100%' }}>
              <button
                type="button"
                className={floodStage === 'alert' ? 'active' : ''}
                onClick={() => setFloodStage('alert')}
                style={{ flex: 1 }}
              >
                Alert Stage
              </button>
              <button
                type="button"
                className={floodStage === 'major' ? 'active' : ''}
                onClick={() => setFloodStage('major')}
                style={{ flex: 1 }}
              >
                Major Flood
              </button>
            </div>
          </div>
        </div>

        {/* Farm Flood Risk Level (The key demonstration) */}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
            Farm DEM Elevation / Flood Susceptibility Band (Select to compare):
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {RISK_TIERS.map((tier) => {
              const active = riskTier === tier.id
              return (
                <button
                  type="button"
                  key={tier.id}
                  onClick={() => setRiskTier(tier.id)}
                  style={{
                    padding: '12px 10px',
                    borderRadius: 8,
                    border: active ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: active ? 'var(--primary-subtle, rgba(37,99,235,0.06))' : 'var(--surface)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Badge tone={tier.badgeTone} dot>
                      {tier.id === 'higher_susceptibility' ? 'High Risk' : tier.id === 'normal' ? 'Medium Risk' : 'Low Risk'}
                    </Badge>
                    {active && <CheckCircle2 size={15} color="var(--primary)" />}
                  </div>
                  <strong style={{ display: 'block', fontSize: 12, color: 'var(--text)' }}>
                    {tier.label.split(' (')[0]}
                  </strong>
                  <p style={{ fontSize: 11, color: 'var(--muted)', margin: '4px 0 0', lineHeight: 1.35 }}>
                    {tier.desc}
                  </p>
                </button>
              )
            })}
          </div>
        </div>


        {/* Live Trilingual Preview */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Eye size={14} />
              Real Trilingual Message Content (English / Sinhala / Tamil):
            </label>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              {previewMessage.length} characters (Unicode multi-part)
            </span>
          </div>
          <pre
            style={{
              padding: '12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface-2, #f8fafc)',
              color: 'var(--text)',
              fontSize: 11.5,
              lineHeight: 1.45,
              whiteSpace: 'pre-wrap',
              maxHeight: 160,
              overflowY: 'auto',
              fontFamily: 'inherit',
              margin: 0,
            }}
          >
            {previewMessage}
          </pre>
        </div>

        {/* Recipient Input */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
            Send Demonstration To:
          </label>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
              <input
                type="radio"
                name="demoRecipient"
                checked={recipientType === 'custom'}
                onChange={() => setRecipientType('custom')}
              />
              Mobile Number
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
              <input
                type="radio"
                name="demoRecipient"
                checked={recipientType === 'sample'}
                onChange={() => setRecipientType('sample')}
              />
              Sample Registered Farmer in this Risk Band
            </label>
          </div>

          {recipientType === 'custom' ? (
            <label className="search-field" style={{ width: '100%' }}>
              <Smartphone size={15} />
              <input
                type="tel"
                placeholder="Enter mobile number (e.g. 077 123 4567)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
          ) : (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>
              The system will automatically find an active farmer in the database with matching elevation risk in this basin.
            </p>
          )}
        </div>

        {/* Last Send Confirmation */}
        {sentResult && (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)', fontSize: 12, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={16} />
            <span>
              Dispatched to <strong>{sentResult.phone}</strong>. Status: <strong>{sentResult.dry_run ? 'Dry run logged' : 'Delivered'}</strong>.
            </span>
          </div>
        )}
      </div>
    </Modal>
  )
}
