import { useCallback, useEffect, useState } from 'react'
import { CloudLightning, Eye, FlaskConical, PhoneCall, Play, PhoneOff } from './ui/icons'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { formatDateTime } from '../utils/format'
import { Card, CardHeader } from './ui/Card'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'

// Automatic warning calls (API: services/stormCallJob.js, routes /admin/sms/storm-calls):
// a storm forecast up to 4 days ahead, or a tank the ML model expects to spill, rings the farmers.
const STATUS = {
  called: { tone: 'success', label: 'Called' },
  calling: { tone: 'info', label: 'Calling' },
  failed: { tone: 'critical', label: 'Failed' },
  dry_run: { tone: 'neutral', label: 'Dry run' },
  skipped_trial: { tone: 'warning', label: 'Not verified (trial)' },
  outside_hours: { tone: 'neutral', label: 'Waiting for 7am' },
}
const MODE = {
  off: { tone: 'neutral', label: 'Off' },
  'dry-run': { tone: 'info', label: 'Dry run' },
  trial: { tone: 'warning', label: 'Twilio trial' },
  live: { tone: 'success', label: 'Live' },
}
const LANG = { si: 'Sinhala', en: 'English', 'si+en': 'Sinhala + English' }

const shortDate = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '—')

function what(row) {
  if (row.source === 'ml') return `${row.subject} may spill (${Math.round(row.predicted_pct)}%)`
  const parts = []
  if (row.kinds.includes('rain')) parts.push(`${Math.round(row.max_rain_mm)} mm rain`)
  if (row.kinds.includes('wind')) parts.push(`${Math.round(row.max_gust_kmh)} km/h gusts`)
  return parts.join(', ')
}

export function WarningCalls() {
  const { canEdit } = useAuth()
  const { toast } = useToast()
  const [state, setState] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [busy, setBusy] = useState(null)
  const [result, setResult] = useState(null)
  const [phone, setPhone] = useState('')
  const [kind, setKind] = useState('weather')

  const load = useCallback(() => {
    api('/admin/sms/storm-calls')
      .then((r) => {
        setState(r.data)
        setLoadError(null)
      })
      .catch((error) => setLoadError(error.message))
  }, [])
  useEffect(load, [load])

  const audioUrl = (name) => (name && state ? `${state.public_url}/api/voice/generated/${name}` : null)

  const run = async (label, body) => {
    setBusy(label)
    setResult(null)
    try {
      const r = await api('/admin/sms/storm-calls/check', { method: 'POST', body })
      setResult({ ...r.data, label })
      const d = r.data
      const found = d.storms.length + d.tanks.length
      toast(
        found === 0
          ? 'No storm in the next days and no tank expected to spill. Nobody would be called.'
          : `${d.storms.length} storm area(s), ${d.tanks.length} tank(s) to spill. ${d.called} called, ${d.wouldCall} dry run, ${d.skipped} skipped.`,
        { title: label, tone: d.failed ? 'error' : 'success' },
      )
      load()
    } catch (error) {
      toast(error.message, { title: `${label} failed`, tone: 'error' })
    } finally {
      setBusy(null)
    }
  }

  const runNow = () => {
    const warn = state.mode === 'live'
      ? 'Mode is LIVE: every farmer with a storm or tank warning will be phoned now. Continue?'
      : 'Run the real check now? On the Twilio trial only verified numbers are rung.'
    if (window.confirm(warn)) run('Check now', {})
  }

  const testCall = async () => {
    setBusy('test')
    try {
      const r = await api('/admin/sms/storm-calls/test', { method: 'POST', body: { phone, kind } })
      const d = r.data
      setResult({ label: 'Test call', test: d })
      toast(
        `Calling ${d.to} in ${LANG[d.lang] || d.lang}.${state.mode === 'trial' ? ' Press any key after the Twilio notice.' : ''}`,
        { title: 'Test warning call placed', tone: 'success' },
      )
      if (d.note) toast(d.note, { title: 'Fell back to English', tone: 'warning' })
    } catch (error) {
      toast(error.message, { title: 'Call not placed', tone: 'error' })
    } finally {
      setBusy(null)
    }
  }

  const toggle = async () => {
    setBusy('toggle')
    try {
      await api('/admin/sms/storm-calls', { method: 'PUT', body: { enabled: !state.enabled } })
      load()
    } catch (error) {
      toast(error.message, { title: 'Not changed', tone: 'error' })
    } finally {
      setBusy(null)
    }
  }

  if (!state) {
    return loadError ? (
      <Card className="span-12 campaigns-card">
        <CardHeader icon={CloudLightning} title="Warning calls" />
        <div style={{ padding: '12px 17px' }}>
          <p role="alert" className="composer-hint">{loadError}</p>
          <Button variant="secondary" size="sm" onClick={load}>Retry</Button>
        </div>
      </Card>
    ) : null
  }
  const mode = MODE[state.mode] || MODE.off
  const w = state.thresholds.weather
  const ml = state.thresholds.ml
  const slow = <span className="composer-hint">Can take a minute when the Sinhala voice has to wake up.</span>

  return (
    <Card className="span-12 campaigns-card">
      <CardHeader
        icon={CloudLightning}
        title="Warning calls"
        subtitle={`Phones farmers up to ${w.daysAhead} days before very heavy rain or strong winds, and when the ML model expects their tank to spill`}
        badge={<Badge tone={state.enabled ? mode.tone : 'neutral'} dot>{state.enabled ? mode.label : 'Switched off'}</Badge>}
        action={canEdit && (
          <Button variant="secondary" size="sm" loading={busy === 'toggle'} onClick={toggle}>
            {state.enabled ? 'Turn off' : 'Turn on'}
          </Button>
        )}
      />

      <div className="gateway-row"><span>Voice</span><strong>{LANG[state.lang]} (SinhalaVITS), English if it fails</strong></div>
      <div className="gateway-row"><span>Twilio</span><strong>{state.twilio_configured ? `Set up · ${state.verified_numbers} verified number(s)` : 'Not set up: calls are only recorded'}</strong></div>
      <div className="gateway-row"><span>Storm when</span><strong>≥ {w.rainMm} mm rain a day, or gusts ≥ {w.gustKmh} km/h</strong></div>
      <div className="gateway-row"><span>Tank spill when</span><strong>Predicted ≥ {ml.spillPct}% within 14 days</strong></div>
      <div className="gateway-row"><span>Calls</span><strong>{state.calling_hours} · at most {state.max_per_run} per hourly run</strong></div>

      {canEdit && (
        <div style={{ padding: '12px 17px', display: 'grid', gap: 12 }}>
          <div className="gateway-actions" style={{ padding: 0, flexWrap: 'wrap' }}>
            <Button variant="secondary" size="sm" loading={busy === 'Preview'} disabled={!!busy} onClick={() => run('Preview', { dryRun: true })}>
              Preview (real forecast)
            </Button>
            <Button variant="secondary" size="sm" loading={busy === 'Preview with a test storm'} disabled={!!busy}
              onClick={() => run('Preview with a test storm', { dryRun: true, simulate: true })}>
              Preview with a test storm
            </Button>
            <Button variant={state.mode === 'live' ? 'primary' : 'secondary'} size="sm" loading={busy === 'Check now'} disabled={!!busy || !state.enabled} onClick={runNow}>
              Check now and call
            </Button>
          </div>
          <span className="composer-hint">
            Preview never phones anyone. “Test storm” pretends a storm is {w.daysAhead} days away and every linked tank will spill, so you can see who would be called on a calm day.
          </span>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="segmented">
              <button type="button" className={kind === 'weather' ? 'active' : ''} onClick={() => setKind('weather')}>Storm</button>
              <button type="button" className={kind === 'ml' ? 'active' : ''} onClick={() => setKind('ml')}>Tank spill</button>
            </div>
            <label className="search-field" style={{ flex: '1 1 180px', minWidth: 0 }}>
              <PhoneCall size={15} />
              <input type="tel" placeholder="0771234567" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <Button size="sm" loading={busy === 'test'} disabled={!!busy || !phone.trim() || !state.twilio_configured} onClick={testCall}>
              Test call
            </Button>
          </div>
          {state.mode === 'trial' && <span className="composer-hint">Twilio trial: the test number must be a Verified Caller ID in Twilio.</span>}
          {busy && busy !== 'toggle' && slow}
        </div>
      )}

      {result && (
        <div style={{ padding: '0 17px 12px', display: 'grid', gap: 8 }}>
          <strong>{result.label}</strong>
          {result.test ? (
            <>
              <span className="composer-hint">Played in {LANG[result.test.lang] || result.test.lang}. Sinhala text:</span>
              <p className="phone-caption" style={{ textAlign: 'left', margin: 0 }}>{result.test.sinhala}</p>
              {result.test.audio && <audio controls preload="none" src={audioUrl(result.test.audio)} style={{ width: '100%' }} />}
            </>
          ) : (
            <>
              <span className="composer-hint">
                {result.storms.length} storm area(s){result.storms[0] ? ` (first: ${shortDate(result.storms[0].start)}, in ${result.storms[0].lead} day(s))` : ''} ·{' '}
                {result.tanks.length ? `tanks to spill: ${result.tanks.map((t) => `${t.name} ${Math.round(t.predictedPct)}%`).join(', ')}` : 'no tank expected to spill'} ·{' '}
                {result.called} called, {result.wouldCall} dry run, {result.skipped} skipped, {result.failed} failed
              </span>
              {result.notes.map((n) => <span className="composer-hint" key={n}>• {n}</span>)}
              {[...new Set(result.calls.map((c) => c.audio).filter(Boolean))].slice(0, 2).map((name) => (
                <audio key={name} controls preload="none" src={audioUrl(name)} style={{ width: '100%' }} />
              ))}
            </>
          )}
        </div>
      )}

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Farmer</th>
              <th>Warning</th>
              <th>For</th>
              <th>Voice</th>
              <th>Status</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {state.calls.length === 0 && (
              <tr><td colSpan={6} className="composer-hint">No warning calls yet. Try “Preview with a test storm”.</td></tr>
            )}
            {state.calls.map((row) => {
              const st = STATUS[row.status] || { tone: 'neutral', label: row.status }
              return (
                <tr key={row.id}>
                  <td><strong>{row.full_name}</strong><br /><span className="composer-hint">{row.phone}</span></td>
                  <td>{row.source === 'ml' ? 'Tank (ML)' : 'Storm'} · {what(row)}</td>
                  <td>{shortDate(row.event_date)}{row.event_end && row.event_end !== row.event_date ? ` – ${shortDate(row.event_end)}` : ''}</td>
                  <td>{LANG[row.lang] || '—'}</td>
                  <td><Badge tone={st.tone} dot>{st.label}</Badge>{row.error && <><br /><span className="composer-hint">{row.error}</span></>}</td>
                  <td>{formatDateTime(new Date(row.updated_at))}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
