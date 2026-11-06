import { ClipboardList, Database, Droplets, LayoutDashboard, MessageSquareText, Users, Waves } from 'lucide-react'
import { Bar, Icon, LockScreen, Notification, Phone, Stage, Text, Window, WALLPAPER } from '../../kit'
import '../yala-admin/look.css'
import './sms.css'

// "The alert reaches the farmer": a device pair telling one event. The window
// is the SMS Gateway itself, in the product's collapsed sidebar (its own
// 64px rail and its own lucide icons): the Water release notice composed for
// Hambantota's farmers and already sent. The phone straddles the window's
// right edge over the send log's placeholder rows, and its lock screen shows
// the same message arriving. Real words: the page, the template, the
// audience, the message, the sent state, and the notification.
//
// Compact is a second design: the phone leads, centred and large enough for
// its type, and the window behind it keeps only what says "this was sent
// from Yala Maha": the page title and the sent state.

const RAIL = [LayoutDashboard, Droplets, Waves, ClipboardList, MessageSquareText, Users, Database]
const ACTIVE = 4

const MESSAGE = 'Thissa wewa is at 94%. Water will be released at 6 a.m. Keep cattle off the lower fields.'

export default function YalaSms() {
  return (
    <Stage className="ym-sms look-yala" width={640} height={400} compact={{ below: 600, width: 358, height: 356 }}>
      {(_s, _rect, layout) => {
        const compact = layout === 'compact'
        return (
          <>
            <Window url="admin.yalamaha.lk/sms" className="ym-window">
              <aside className="ym-rail">
                {RAIL.map((Glyph, i) => (
                  <span key={i} className="ym-rail__item" data-active={i === ACTIVE || undefined}>
                    <Glyph size={16} strokeWidth={1.75} />
                  </span>
                ))}
              </aside>

              <div className="ym-main">
                <div className="ym-head">
                  <Text className="ym-title">Compose message</Text>
                  {!compact && <Bar w={56} h={22} r={6} tone={1} />}
                </div>

                {!compact && (
                  <>
                    <div className="ym-chips">
                      <span className="ym-chip ym-chip--accent">Water release notice</span>
                      <span className="ym-chip">Hambantota · 1,240 farmers</span>
                    </div>
                    <div className="ym-field">
                      <Text className="ym-field__text">{MESSAGE}</Text>
                    </div>
                  </>
                )}

                <div className="ym-sent">
                  <span className="ym-sent__btn">
                    <Icon name="check" size={13} />
                    Sent to 1,240 farmers
                  </span>
                </div>

                {!compact && (
                  <div className="ym-log">
                    {[[96, 40], [80, 46], [104, 36]].map((w, i) => (
                      <div key={i} className="ym-log__row">
                        <Bar w={w[0]} h={6} tone={3} />
                        <Bar w={w[1]} h={6} tone={2} style={{ marginLeft: 'auto' }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Window>

            {/* Compact is a redesign: the phone grows until its type clears the floor */}
            <Phone width={compact ? 290 : 236} frame="pro" dark wallpaper={WALLPAPER} className="ym-phone">
              <LockScreen size="satellite" stack="top">
                {/* The command centre's own alert, not a generic Messages app */}
                <Notification
                  icon={<Icon name="bell" filled size={20} />}
                  title="Yala Maha"
                  body="Thissa wewa at 94% — release at 6 a.m."
                />
              </LockScreen>
            </Phone>
          </>
        )
      }}
    </Stage>
  )
}
