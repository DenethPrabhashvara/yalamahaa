import { forwardRef, useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Glass, TabBar as GlisseTabBar } from 'glisse';
import Icon from './Icon.jsx';
import { useApp } from '../state/AppContext.jsx';
import { LANGS } from '../i18n.js';

// Yala Maha emblem (water drop + rice stalk), on its own off-white tile so it reads on light and dark screens.
export function Logo({ size = 48 }) {
  return (
    <span className="logo" style={{ width: size, height: size }}>
      <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" width={size} height={size} draggable="false" />
    </span>
  );
}

export function IconBtn({ icon, label, onClick, to, variant = 'light', badge, size = 48 }) {
  const cls = `icon-btn ${variant}`;
  const style = { width: size, height: size };
  const inner = (
    <>
      <Icon name={icon} size={20} stroke={2.2} />
      {badge ? <span className="dot-badge" /> : null}
    </>
  );
  if (to) return <Link to={to} className={cls} style={style} aria-label={label}>{inner}</Link>;
  return <button type="button" className={cls} style={style} aria-label={label} onClick={onClick}>{inner}</button>;
}

export function PrimaryBtn({ children, to, onClick, disabled, icon = 'arrow', type = 'button', tone = 'dark' }) {
  const content = (
    <>
      <span>{children}</span>
      <span className="pb-circle"><Icon name={icon} size={20} stroke={2.4} /></span>
    </>
  );
  const cls = `primary-btn ${tone}${disabled ? ' disabled' : ''}`;
  if (to && !disabled) return <Link to={to} className={cls}>{content}</Link>;
  return <button type={type} className={cls} onClick={onClick} disabled={disabled}>{content}</button>;
}

// Standard iOS-style status: a tinted symbol followed by the word, no background block.
const STATUS = {
  safe: ['ok', 'checkCircle'], stable: ['ok', 'checkCircle'], fixed: ['ok', 'checkCircle'],
  watch: ['warn', 'warn'], low: ['warn', 'warn'], lowWater: ['warn', 'warn'], inProgress: ['warn', 'clock'],
  critical: ['danger', 'stop'], spill: ['danger', 'stop'],
  received: ['info', 'inbox'],
  // tank level bands (tankLevel in api/reservoirs.js)
  levelVeryLow: ['danger', 'stop'], levelLow: ['warn', 'warn'], levelModerate: ['info', 'info'], levelGood: ['ok', 'checkCircle'], levelFull: ['ok', 'checkCircle'],
  forwarded: ['info', 'send'], reportClosed: ['warn', 'close'],
};

export function StatusLabel({ status, children }) {
  const [tone, icon] = STATUS[status] || ['info', 'info'];
  return <span className={`status-label sl-${tone}`}><Icon name={icon} size={16} stroke={2.4} />{children}</span>;
}

export function StatusPill({ status, t }) {
  return <StatusLabel status={status}>{t(status)}</StatusLabel>;
}

export function LangSwitch({ compact }) {
  const { lang, update, t } = useApp();
  if (compact) {
    const idx = LANGS.findIndex((l) => l.code === lang);
    const nextLang = LANGS[(idx + 1) % LANGS.length];
    return (
      <button type="button" className="lang-chip" onClick={() => update({ lang: nextLang.code })} aria-label={t('a11yChangeLanguage')}>
        <b>{LANGS[idx].short}</b>
        <span>{LANGS.filter((l) => l.code !== lang).map((l) => l.short).join(' - ')}</span>
      </button>
    );
  }
  return (
    <div className="seg seg-white" role="radiogroup" aria-label={t('language')}>
      {LANGS.map((l) => (
        <button key={l.code} type="button" role="radio" aria-checked={lang === l.code}
          className={lang === l.code ? 'on-accent' : ''} onClick={() => update({ lang: l.code })}
          style={{ fontFamily: l.code === 'si' ? 'Noto Sans Sinhala' : l.code === 'ta' ? 'Noto Sans Tamil' : undefined }}>
          {l.label}
        </button>
      ))}
    </div>
  );
}

export function StepHeader({ step, total = 4, title, backTo, closeTo, onClose, closeLabel, right }) {
  const { t } = useApp();
  const navigate = useNavigate();
  const done = Math.floor(step);
  return (
    <>
      <div className="row gap10">
        {onClose
          ? <IconBtn icon="close" label={closeLabel || t('close')} onClick={onClose} />
          : closeTo
          ? <IconBtn icon="close" label={t('close')} to={closeTo} />
          : <IconBtn icon="back" label={t('back')} onClick={() => (backTo ? navigate(backTo) : navigate(-1))} />}
        <div className="grow center fw600 f15">{title || t('registerFarm')}</div>
        {right || <span className="chip-dark">{Math.ceil(step)} / {total}</span>}
      </div>
      <div className="progress" aria-label={`${t('step')} ${Math.ceil(step)} / ${total}`}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className={`pg ${i < done ? 'done' : ''} ${i === done && step % 1 ? 'half' : ''}`} />
        ))}
      </div>
    </>
  );
}

// Glisse renders tabs with an `href` through this, so they navigate inside the router.
const RouterLink = forwardRef(function RouterLink({ href, ...props }, ref) {
  return <Link ref={ref} to={href} {...props} />;
});

export function BottomNav() {
  const { t } = useApp();
  const { pathname } = useLocation();
  const items = [
    { value: '/home', icon: 'home', label: t('home') },
    { value: '/water', icon: 'drop', label: t('water') },
    { value: '/report', icon: 'pencil', label: t('report') },
    { value: '/fields', icon: 'map', label: t('fields') },
    { value: '/profile', icon: 'user', label: t('profile') },
  ].map((it) => ({ ...it, href: it.value, icon: <Icon name={it.icon} size={24} stroke={2} /> }));
  // Every item is a section people navigate to; the bar never carries actions.
  // Glisse's iOS 26 tab bar: the selection springs between tabs, follows a drag and lifts into a lens while held.
  return (
    <div className="bottom-nav">
      <GlisseTabBar aria-label={t('a11yMainMenu')} items={items} link={RouterLink}
        value={items.some((it) => it.value === pathname) ? pathname : null} />
    </div>
  );
}

export function Toast() {
  const { toast } = useApp();
  if (!toast) return null;
  return (
    <div className={`toast t-${toast.tone}`} role="status" key={toast.id}>
      <Icon name={toast.tone === 'error' ? 'info' : 'check'} size={18} stroke={2.6} />
      <span>{toast.text}</span>
    </div>
  );
}

export function OfflineBanner() {
  const { t } = useApp();
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && navigator.onLine === false);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  if (!offline) return null;
  return <div className="offline-banner" role="alert"><Icon name="wifiOff" size={16} />{t('offline')}</div>;
}

// CSS-drawn aerial field tile with an outlined plot
// `photo` swaps the drawn field pattern for a real picture (the plot outline is hidden).
export function Aerial({ variant = 'a', height = 110, plot = 'accent', tag, tagTone, rotate = -8, radius = 18, photo, children }) {
  const style = { height, borderRadius: radius };
  if (photo) style.backgroundImage = `linear-gradient(180deg, rgba(0,0,0,.22), rgba(0,0,0,0) 35%, rgba(0,0,0,.35)), url("${photo}")`;
  return (
    <div className={`aerial aer-${variant}${photo ? ' aer-photo' : ''}`} style={style}>
      {plot && !photo && (
        <div className={`aer-plot plot-${plot}`} style={{ transform: `rotate(${rotate}deg)` }} />
      )}
      {tag && <span className={`aer-tag ${tagTone || ''}`}>{tag}</span>}
      {children}
    </div>
  );
}

// Liquid Glass is for the controls layer that floats over content (bars, floating buttons, sheets),
// as in Apple's design. Content cards stay solid so text on them stays easy to read.
export function LiquidGlass({ children, className = '', ...props }) {
  return <Glass className={`liquid ${className}`} {...props}>{children}</Glass>;
}

export function Card({ children, className = '', dark, style }) {
  return <section className={`card ${dark ? 'card-dark' : ''} ${className}`} style={style}>{children}</section>;
}
