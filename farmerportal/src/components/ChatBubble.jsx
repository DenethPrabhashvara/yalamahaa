import { Button, Glass } from 'glisse';
import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { useApp } from '../state/AppContext.jsx';

// Floating chat with the Yala Maha AI assistant (ai-assistant/server.js)
const _raw = (import.meta.env.VITE_AI_API_URL || 'http://localhost:5050').replace(/\/$/, '');
// A relative base ('/ai' behind the Caddy proxy) must stay relative; only a bare host:port needs a scheme.
export const AI_URL = /^https?:\/\//.test(_raw) || _raw.startsWith('/') ? _raw : `http://${_raw}`;

export default function ChatBubble({ hidden = false }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(null);
  const listRef = useRef(null);
  const audioRef = useRef(null);
  const ttsAbortRef = useRef(null);

  useEffect(() => {
    listRef.current?.scrollTo(0, listRef.current.scrollHeight);
  }, [msgs, open, busy]);

  // Escape (and the phone's back button, see useAndroidBack.js) closes the open chat
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // signing out unmounts the chat: stop any reply that is still being read out
  useEffect(() => () => {
    ttsAbortRef.current?.abort();
    audioRef.current?.pause();
    if (audioRef.current) URL.revokeObjectURL(audioRef.current.src);
  }, []);

  async function send(e) {
    e.preventDefault();
    const message = text.trim();
    if (!message || busy) return;
    setText('');
    setMsgs((m) => [...m, { role: 'user', text: message }]);
    setBusy(true);
    // Error notices are shown in the chat but never sent back to the model as conversation.
    const history = msgs.filter((m) => !m.error).map(({ role, text }) => ({ role, text }));
    try {
      const res = await fetch(`${AI_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.reply) {
        setMsgs((m) => [...m, { role: 'model', error: true, text: t('chatBusy') }]);
        return;
      }
      setMsgs((m) => [...m, { role: 'model', text: data.reply }]);
    } catch {
      setMsgs((m) => [...m, { role: 'model', error: true, text: t('chatOffline') }]);
    } finally {
      setBusy(false);
    }
  }

  async function speak(i) {
    audioRef.current?.pause();
    if (audioRef.current) URL.revokeObjectURL(audioRef.current.src);
    audioRef.current = null;
    ttsAbortRef.current?.abort();
    ttsAbortRef.current = null;
    if (playing === i) return setPlaying(null);
    const textToSpeak = msgs[i]?.text;
    if (!textToSpeak) return setPlaying(null);
    setPlaying(i);
    const ac = new AbortController();
    ttsAbortRef.current = ac;
    try {
      const res = await fetch(`${AI_URL}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSpeak }),
        signal: ac.signal,
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      if (ac.signal.aborted) return;
      const audio = new Audio(URL.createObjectURL(blob));
      audioRef.current = audio;
      audio.onended = () => setPlaying((p) => (p === i ? null : p));
      audio.onerror = () => setPlaying((p) => (p === i ? null : p));
      await audio.play();
    } catch {
      if (!ac.signal.aborted) {
        setPlaying((p) => (p === i ? null : p));
      }
    }
  }

  if (hidden) return null;
  return (
    <>
      {open && (
        <Glass className="chat-panel" role="dialog" aria-label={t('chatTitle')}>
          <header className="chat-head">
            <strong>{t('chatTitle')}</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label={t('close')}>✕</button>
          </header>
          <div className="chat-list" ref={listRef}>
            {msgs.length === 0 && <p className="chat-hint">{t('chatHint')}</p>}
            {msgs.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>
                <span>{m.text}</span>
                {m.role === 'model' && !m.error && (
                  <button type="button" className="chat-speak" onClick={() => speak(i)} aria-label={t('chatListen')}>
                    {playing === i ? '■' : '🔊'}
                  </button>
                )}
              </div>
            ))}
            {busy && <div className="chat-msg model"><span>…</span></div>}
          </div>
          <form className="chat-form" onSubmit={send}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('chatPlaceholder')} aria-label={t('chatPlaceholder')} />
            <button type="submit" disabled={busy || !text.trim()}>{t('chatSend')}</button>
          </form>
        </Glass>
      )}
      <Button className="chat-fab" icon={<Icon name={open ? 'close' : 'sms'} size={24} stroke={2} />}
        onClick={() => setOpen((o) => !o)} aria-label={open ? t('chatClose') : t('chatOpen')} aria-expanded={open} />
    </>
  );
}
