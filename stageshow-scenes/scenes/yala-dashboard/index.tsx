import { Badge, Bar, Chart, Stage, Text, Window } from '../../kit'
import '../yala-admin/look.css'
import './dashboard.css'

// Wide hero (references/framing.md): the command centre at 1040 wide, inset at
// the top, running off the bottom and both sides, realistic fidelity because
// the subject is a list. A "Latest alerts" card straddles the lower edge and
// carries the story: Thissa wewa is the one at risk, and it is the only row
// the eye should land on.
//
// Real content throughout, per realistic fidelity: the nav is the admin
// panel's own, the reservoirs and districts are real ones from
// reservoirs_data.json, the statuses are the product's own four.

const NAV = ['Dashboard', 'Tank & Reservoir', 'River', 'Canal Reports', 'SMS Gateway', 'Farmer Portal', 'Database']

const STORAGE = [58, 61, 59, 64, 67, 66, 71, 74, 72, 78, 81, 84]

type Status = 'risk' | 'watch'
const ROWS: { name: string; district: string; storage: string; depth: string; status: Status }[] = [
  { name: 'Thissa wewa', district: 'Hambantota', storage: '94%', depth: '6.2 m', status: 'risk' },
  { name: 'Basavakkulama', district: 'Anuradhapura', storage: '81%', depth: '4.8 m', status: 'watch' },
]
// The rows the satellite and the crop take: placeholder lines at the real rows' geometry
const FILLER = [
  [92, 70, 28, 34, 46],
  [78, 84, 26, 32, 46],
  [104, 64, 30, 30, 46],
  [86, 76, 24, 34, 46],
]

const TONE = { risk: 'danger', watch: 'warning' } as const
const LABEL = { risk: 'At risk', watch: 'Watch' } as const

export default function YalaDashboard() {
  return (
    <Stage className="ym-dash look-yala" width={1040} height={600} compact={{ below: 720, width: 358, height: 372 }}>
      {() => (
        <>
          <Window url="admin.yalamaha.lk" className="ym-dwindow">
            <aside className="ym-dside">
              <span className="ym-dlogo">Yala Maha</span>
              {NAV.map((label, i) => (
                <div key={i} className="ym-dnav" data-active={i === 0 || undefined}>
                  <Bar w={12} h={12} r={3} tone={i === 0 ? 4 : 2} />
                  <Text className="ym-dnav__label">{label}</Text>
                </div>
              ))}
            </aside>

            <div className="ym-dmain">
              <div className="ym-dhead">
                <Text className="ym-dtitle">Key indicators</Text>
                <Bar w={96} h={26} r={6} tone={1} />
              </div>

              <div className="ym-dstats">
                <section className="ym-dstat">
                  <Text className="ym-dstat__label">Average reservoir storage</Text>
                  <div className="ym-dstat__figure">
                    <Text className="ym-dstat__value">72.4%</Text>
                    <Badge tone="success">+4.1%</Badge>
                  </div>
                  <Chart data={STORAGE} width={232} height={40} className="ym-dchart" />
                </section>
                <section className="ym-dstat">
                  <Text className="ym-dstat__label">Reservoirs monitored</Text>
                  <div className="ym-dstat__figure">
                    <Text className="ym-dstat__value">117</Text>
                  </div>
                  <Bar w={168} h={5} tone={2} style={{ marginTop: 16 }} />
                </section>
                <section className="ym-dstat">
                  <Text className="ym-dstat__label">Spilling today</Text>
                  <div className="ym-dstat__figure">
                    <Text className="ym-dstat__value">8</Text>
                    <Badge tone="danger">+3</Badge>
                  </div>
                  <Bar w={132} h={5} tone={2} style={{ marginTop: 16 }} />
                </section>
              </div>

              <div className="ym-dtable">
                <Text className="ym-dtable__title">Reservoir watchlist</Text>
                <div className="ym-drow ym-drow--head">
                  <span>Reservoir</span>
                  <span>District</span>
                  <span>Storage</span>
                  <span>Depth</span>
                  <span>Status</span>
                </div>
                {ROWS.map(row => (
                  <div key={row.name} className="ym-drow" data-lead={row.status === 'risk' || undefined}>
                    <span className="ym-dcell ym-dcell--name">{row.name}</span>
                    <span className="ym-dcell ym-dcell--muted">{row.district}</span>
                    <span className="ym-dcell ym-dcell--num">{row.storage}</span>
                    <span className="ym-dcell ym-dcell--num">{row.depth}</span>
                    <span className="ym-dcell">
                      <Badge tone={TONE[row.status]}>{LABEL[row.status]}</Badge>
                    </span>
                  </div>
                ))}
                {FILLER.map((w, i) => (
                  <div key={'f' + i} className="ym-drow">
                    <span><Bar w={w[0]} h={6} tone={3} /></span>
                    <span><Bar w={w[1]} h={6} tone={2} /></span>
                    <span><Bar w={w[2]} h={6} tone={2} /></span>
                    <span><Bar w={w[3]} h={6} tone={2} /></span>
                    <span><Bar w={w[4]} h={18} r={9} tone={1} /></span>
                  </div>
                ))}
              </div>
            </div>
          </Window>

          {/* Satellite on the lower edge: the alert the watchlist is about */}
          <div className="ym-dalert">
            <div className="ym-dalert__head">
              <span className="ym-dalert__dot" />
              <Text className="ym-dalert__title">Spill warning</Text>
              <Text className="ym-dalert__time">2 min ago</Text>
            </div>
            <Text className="ym-dalert__body">Thissa wewa reached 94% of usable storage.</Text>
            <div className="ym-dalert__foot">
              <Text className="ym-dalert__meta">Hambantota</Text>
              <Text className="ym-dalert__action">Notify farmers</Text>
            </div>
          </div>
        </>
      )}
    </Stage>
  )
}
