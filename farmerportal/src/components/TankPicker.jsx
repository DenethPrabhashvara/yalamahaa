import { useEffect, useRef, useState } from 'react';
import { useApp } from '../state/AppContext.jsx';

// `tanks` are reservoirs from the API ({ id, name }).
export default function TankPicker({ tanks, value, onChange, dark = false }) {
  const { t } = useApp();
  const ref = useRef(null);
  // Fade whichever edge still has chips scrolled out of view, so the cut-off chip reads as "more".
  const [edges, setEdges] = useState({ l: false, r: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const next = { l: el.scrollLeft > 2, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 };
      setEdges((e) => (e.l === next.l && e.r === next.r ? e : next));   // no re-render when nothing changed
    };
    // ResizeObserver runs after the browser's own layout, so the first measure doesn't force a layout of
    // the whole page while it is being built (it did on every visit to Home and Water)
    const sized = new ResizeObserver(measure);
    sized.observe(el);
    el.addEventListener('scroll', measure, { passive: true });
    return () => { sized.disconnect(); el.removeEventListener('scroll', measure); };
  }, [tanks]);

  return (
    <div ref={ref} className={`tank-picker ${dark ? 'dark' : ''} ${edges.l ? 'fade-l' : ''} ${edges.r ? 'fade-r' : ''}`}
      role="radiogroup" aria-label={t('a11yTank')}>
      {tanks.map((x) => (
        <button key={x.id} type="button" role="radio" aria-checked={value === x.id}
          className={value === x.id ? 'on' : ''} onClick={() => onChange(x.id)}>
          {x.name.replace(/ (tank|wewa)$/i, '')}
        </button>
      ))}
    </div>
  );
}
