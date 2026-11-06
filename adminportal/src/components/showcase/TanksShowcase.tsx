import { Badge, Popover, Roll, Stage, States, Text, Window, type Act } from '../../lib/stageshow'
import './look.css'
import './tanks.css'

// What the system does: rain lifts Thissa wewa past its spill line and the
// command centre raises the alert on its own. The cause is drawn, not
// implied: the row's 24-hour rainfall rolls up first, then its storage, whose
// bar fills toward the spill-line tick at 90%.
// Beats: rain 12 to 41 mm, storage 78% to 88%, the fill nearing the tick, and
// the status crossfades to Watch; more rain, 41 to 68 mm, storage to 94% as
// the fill crosses the tick and turns red, and a beat later (the cause
// lands, then its effect) the status turns At risk and the row washes once and keeps its tint; the alert arrives
// bottom-right; the pointer, idle until now, sends it to farmers: the button
// fills green first, then its label changes in place.
// Plays once (about 11s); Replay is the reset, so no data rewinds in view.
//
// Real strings: the page title and a short register of real reservoirs (a
// table is the one place dense real data reads right), the alert and its
// action. Rows run off the crop.

type Status = 'normal' | 'watch' | 'risk'
type S = { rain: number; storage: number; status: Status; wash: boolean; alert: boolean; sent: boolean; label: 'idle' | 'sent' }

const SPILL = 90

const ROWS: { name: string; district: string; rain: number; storage: number; status: Status; wideOnly?: boolean }[] = [
  { name: 'Basavakkulama', district: 'Anuradhapura', rain: 22, storage: 81, status: 'watch' },
  { name: 'Thuruwila tank', district: 'Anuradhapura', rain: 18, storage: 68, status: 'normal', wideOnly: true },
]
// The rows the alert lands on: a name line only, so filler stays at the edge
// and nothing crowds the alert's button; enough of them to run off the crop
const UNDER = [92, 76, 104, 84, 70]

const BADGE = {
  normal: <Badge tone="neutral">Normal</Badge>,
  watch: <Badge tone="warning">Watch</Badge>,
  risk: <Badge tone="danger">At risk</Badge>,
}

const initial: S = { rain: 12, storage: 78, status: 'normal', wash: false, alert: false, sent: false, label: 'idle' }
const poster: S = { rain: 68, storage: 94, status: 'risk', wash: false, alert: true, sent: true, label: 'sent' }

async function script(a: Act<S>) {
  await a.wait(1000)
  a.mark('rain')
  a.put({ rain: 41 })
  await a.wait(500)
  a.put({ storage: 88 })
  await a.wait(500)
  a.put({ status: 'watch' })
  await a.wait(1300)
  a.mark('spill')
  a.put({ rain: 68 })
  await a.wait(500)
  a.put({ storage: 94 })
  await a.wait(450)
  a.put({ status: 'risk', wash: true })
  await a.wait(900)
  a.put({ wash: false })
  await a.wait(300)
  a.mark('alert')
  a.put({ alert: true })
  // Reading time before the hand arrives: the alert says what happened first
  await a.wait(1600)
  a.mark('notify')
  await a.move({ at: 'notify', x: 0.5, y: 0.55 }, { duration: 900 })
  await a.wait(220)
  await a.click({ at: 'notify', x: 0.5, y: 0.55 })
  // Fill first, then the label changes in place: no two-label crossfade over a moving fill
  a.put({ sent: true })
  await a.wait(260)
  a.put({ label: 'sent' })
  await a.wait(1800)
}

function Storage({ value }: { value: number }) {
  return (
    <span className="ym-tstore">
      <span className="ym-tstore__num">
        <Roll>{`${value}%`}</Roll>
      </span>
      <span className="ym-tbar" data-over={value >= SPILL || undefined}>
        <span className="ym-tbar__fill" style={{ width: `${value}%` }} />
        <span className="ym-tbar__tick" style={{ left: `${SPILL}%` }} />
      </span>
    </span>
  )
}

export default function TanksShowcase() {
  return (
    <Stage<S>
      className="ym-tanks look-yala"
      width={660}
      height={430}
      compact={{ below: 660, width: 358, height: 354 }}
      initial={initial}
      poster={poster}
      script={script}
      play="once"
      cursor={{ at: { x: 600, y: 270 } }}
    >
      {s => (
        <>
          <Window url="admin.yalamaha.lk/tanks" className="ym-twin">
            <div className="ym-tbody">
              <div className="ym-thead">
                <Text className="ym-ttitle">Tank &amp; reservoir register</Text>
                <Text className="ym-tspill">{`Spill line ${SPILL}%`}</Text>
              </div>

              <div className="ym-trow ym-trow--head">
                <span>Reservoir</span>
                <span className="ym-tdistrict">District</span>
                <span className="ym-tnum">Rain 24h</span>
                <span>Storage</span>
                <span>Status</span>
              </div>

              <div className="ym-trow" data-lead={s.status === 'risk' || undefined} data-wash={s.wash || undefined}>
                <span className="ym-tname">Thissa wewa</span>
                <span className="ym-tdistrict ym-tmuted">Hambantota</span>
                <span className="ym-tnum">
                  <Roll>{`${s.rain} mm`}</Roll>
                </span>
                <Storage value={s.storage} />
                <span>
                  <States value={s.status} states={BADGE} align="start" />
                </span>
              </div>

              {ROWS.map(r => (
                <div key={r.name} className={r.wideOnly ? 'ym-trow ym-trow--wide-only' : 'ym-trow'}>
                  <span className="ym-tname">{r.name}</span>
                  <span className="ym-tdistrict ym-tmuted">{r.district}</span>
                  <span className="ym-tnum">{r.rain} mm</span>
                  <Storage value={r.storage} />
                  <span>{BADGE[r.status]}</span>
                </div>
              ))}

              {UNDER.map((w, i) => (
                <div key={'u' + i} className="ym-trow">
                  <span><span className="ym-tline" style={{ width: w }} /></span>
                </div>
              ))}
            </div>
          </Window>

          <Popover show={s.alert} origin="bottom right" className="ym-talert">
            <div className="ym-talert__head">
              <span className="ym-talert__dot" />
              <Text className="ym-talert__title">Spill warning</Text>
              <Text className="ym-talert__time">now</Text>
            </div>
            <Text className="ym-talert__body">Thissa wewa passed its spill line.</Text>
            <div className="ym-talert__foot">
              <Text className="ym-talert__meta">Hambantota</Text>
              <span className="ym-tbtn" data-target="notify" data-sent={s.sent || undefined}>
                <States
                  value={s.label}
                  align="center"
                  states={{ idle: 'Notify farmers', sent: 'Sent to 1,240' }}
                />
              </span>
            </div>
          </Popover>
        </>
      )}
    </Stage>
  )
}
