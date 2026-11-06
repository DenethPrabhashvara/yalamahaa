import { Badge, Popover, Stage, States, Text, Window, type Act } from '../../kit'
import '../yala-admin/look.css'
import './reports.css'

// How it feels to use: a farmer's canal report comes in and the officer
// passes it on. Beats: the pointer opens the one New report; its detail opens
// below the row, anchored to it, with what the farmer said and their two
// photos; the pointer moves to Forward and presses; the button fills green
// first, then its label changes in place; a beat later the row's own status
// crossfades New to Forwarded. Plays once (about 9s); Replay is the reset.
//
// Real strings: the page title and a short register of reports in the page's
// own vocabulary (its problem labels and its New / Forwarded / In progress /
// Resolved statuses), the farmer's words and the action. The photos are drawn
// canal scenes, never real farmers' photos (api/uploads stays private for
// exactly that reason).

type Status = 'new' | 'forwarded' | 'progress' | 'resolved'
type S = { open: boolean; hover: boolean; sent: boolean; label: 'idle' | 'sent'; status: Status }

const STATUS: Record<Status, JSX.Element> = {
  new: <Badge tone="neutral">New</Badge>,
  forwarded: <Badge tone="accent">Forwarded</Badge>,
  progress: <Badge tone="warning">In progress</Badge>,
  resolved: <Badge tone="success">Resolved</Badge>,
}

const ROWS: { problem: string; canal: string; status: Status; when: string; wideOnly?: boolean }[] = [
  { problem: 'Blocked / silted', canal: 'Left bank canal, D2', status: 'forwarded', when: '8:40 a.m.' },
  { problem: 'Water leak', canal: 'Field channel 7', status: 'progress', when: 'Yesterday' },
  { problem: 'No water', canal: 'Tract 3 distributary', status: 'resolved', when: 'Yesterday', wideOnly: true },
  { problem: 'Blocked / silted', canal: 'Right bank canal, D6', status: 'progress', when: 'Mon', wideOnly: true },
  { problem: 'Water leak', canal: 'Left bank canal, D1', status: 'resolved', when: 'Mon', wideOnly: true },
  { problem: 'Broken gate', canal: 'Field channel 3', status: 'resolved', when: 'Sun', wideOnly: true },
  { problem: 'No water', canal: 'Right bank canal, D9', status: 'resolved', when: 'Sun', wideOnly: true },
]

const initial: S = { open: false, hover: false, sent: false, label: 'idle', status: 'new' }
const poster: S = { open: true, hover: false, sent: true, label: 'sent', status: 'forwarded' }

async function script(a: Act<S>) {
  await a.wait(900)
  a.mark('open')
  await a.move({ at: 'report', x: 0.25, y: 0.5 }, { duration: 800 })
  a.put({ hover: true })
  await a.wait(220)
  await a.click({ at: 'report', x: 0.25, y: 0.5 })
  a.put({ open: true })
  // Reading time: the farmer's words are the point of opening it
  await a.wait(2200)
  a.mark('forward')
  await a.move({ at: 'forward', x: 0.5, y: 0.55 }, { duration: 750 })
  await a.wait(200)
  await a.click({ at: 'forward', x: 0.5, y: 0.55 })
  // Fill first, then the label in place: no two labels over a moving fill
  a.put({ sent: true })
  await a.wait(240)
  a.put({ label: 'sent' })
  // The cause lands on the button, then its effect on the row
  await a.wait(450)
  a.put({ status: 'forwarded' })
  await a.wait(1800)
}

export default function YalaReports() {
  return (
    <Stage<S>
      className="ym-reports look-yala"
      width={660}
      height={500}
      compact={{ below: 660, width: 358, height: 440 }}
      initial={initial}
      poster={poster}
      script={script}
      play="once"
      cursor={{ at: { x: 470, y: 300 } }}
    >
      {s => (
        <>
          <Window url="admin.yalamaha.lk/reports" className="ym-rwin">
            <div className="ym-rbody">
              <div className="ym-rhead">
                <Text className="ym-rtitle">Canal reports</Text>
                <Text className="ym-rcount">1 new</Text>
              </div>

              <div className="ym-rrow ym-rrow--head">
                <span>Problem</span>
                <span className="ym-rcanal">Canal</span>
                <span>Status</span>
                <span className="ym-rwhen">Reported</span>
              </div>

              <div
                className="ym-rrow ym-rrow--focus"
                data-target="report"
                data-hover={s.hover || undefined}
                data-open={s.open || undefined}
              >
                <span className="ym-rname">Broken gate</span>
                <span className="ym-rcanal ym-rmuted">Right bank canal, D4</span>
                <span>
                  <States value={s.status} states={STATUS} align="start" />
                </span>
                <span className="ym-rwhen ym-rmuted">9:12 a.m.</span>
              </div>

              {ROWS.map((r, i) => (
                <div key={i} className={r.wideOnly ? 'ym-rrow ym-rrow--wide-only' : 'ym-rrow'}>
                  <span className="ym-rname ym-rname--quiet">{r.problem}</span>
                  <span className="ym-rcanal ym-rmuted">{r.canal}</span>
                  <span>{STATUS[r.status]}</span>
                  <span className="ym-rwhen ym-rmuted">{r.when}</span>
                </div>
              ))}
            </div>
          </Window>

          <Popover show={s.open} origin="top right" className="ym-rpanel">
            <Text className="ym-rpanel__title">Broken gate</Text>
            <Text className="ym-rpanel__label">What the farmer said</Text>
            <Text className="ym-rpanel__quote">
              The D4 gate won’t close. Water is running into the lower paddy fields.
            </Text>
            <div className="ym-rpanel__photos">
              <span className="ym-rphoto ym-rphoto--gate" />
              <span className="ym-rphoto ym-rphoto--field" />
            </div>
            <span className="ym-rbtn" data-target="forward" data-sent={s.sent || undefined}>
              <States
                value={s.label}
                align="center"
                states={{ idle: 'Forward to Irrigation Dept.', sent: 'Forwarded' }}
              />
            </span>
          </Popover>
        </>
      )}
    </Stage>
  )
}
