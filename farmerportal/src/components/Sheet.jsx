import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';
import { useApp } from '../state/AppContext.jsx';

// Drawn on the phone frame (.device), not inside the page: the page is the scroll container, so a sheet
// inside it opened at the top of the page, off screen when the farmer had scrolled down (News, Report).
export default function Sheet({ open, onClose, title, children }) {
  const { t } = useApp();
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  // looked up when it opens: on a page's first render the frame isn't in the document yet
  const host = document.querySelector('.device');
  const sheet = (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="row between">
          <div className="f20 fw600">{title}</div>
          <button type="button" className="icon-btn soft" style={{ width: 44, height: 44 }} aria-label={t('close')} onClick={onClose}>
            <Icon name="close" size={18} stroke={2.2} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
  return host ? createPortal(sheet, host) : sheet;
}
