import { Button, Glass } from 'glisse';
import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

// Floating chat with the Yala Maha AI assistant (ai-assistant/server.js)
const _raw = (import.meta.env.VITE_AI_API_URL || 'http://localhost:5050').replace(/\/$/, '');
const AI_URL = /^https?:\/\//.test(_raw) ? _raw : `http://${_raw}`;

export default function ChatBubble() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(null);
  const listRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    listRef.current?.scrollTo(0, listRef.current.scrollHeight);
  }, [msgs, open]);

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
        setMsgs((m) => [...m, { role: 'model', error: true, text: 'The assistant is busy right now. Please try again in a moment.' }]);
        return;
      }
      setMsgs((m) => [...m, { role: 'model', text: data.reply }]);
    } catch {
      setMsgs((m) => [...m, { role: 'model', error: true, text: 'Can’t reach the assistant. Check your connection and try again.' }]);
    } finally {
      setBusy(false);
    }
  }

  async function speak(i) {
    audioRef.current?.pause();
    if (playing === i) return setPlaying(null);
    setPlaying(i);
    try {
      const res = await fetch(`${AI_URL}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: msgs[i].text }),
      });
      if (!res.ok) throw new Error();
      const audio = new Audio(URL.createObjectURL(await res.blob()));
      audioRef.current = audio;
      audio.onended = () => setPlaying(null);
      await audio.play();
    } catch {
      setPlaying(null);
    }
  }

  return (
    <>
      {open && (
        <Glass className="chat-panel" role="dialog" aria-label="AI assistant">
          <header className="chat-head">
            <strong>Yala Maha Assistant</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close">✕</button>
          </header>
          <div className="chat-list" ref={listRef}>
            {msgs.length === 0 && <p className="chat-hint">Ask about water levels, seasons or flood alerts.</p>}
            {msgs.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>
                <span>{m.text}</span>
                {m.role === 'model' && !m.error && (
                  <button type="button" className="chat-speak" onClick={() => speak(i)} aria-label="Listen">
                    {playing === i ? '■' : '🔊'}
                  </button>
                )}
              </div>
            ))}
            {busy && <div className="chat-msg model"><span>…</span></div>}
          </div>
          <form className="chat-form" onSubmit={send}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message" />
            <button type="submit" disabled={busy || !text.trim()}>Send</button>
          </form>
        </Glass>
      )}
      <Button className="chat-fab" icon={<Icon name={open ? 'close' : 'sms'} size={24} stroke={2} />}
        onClick={() => setOpen((o) => !o)} aria-label={open ? 'Close AI assistant' : 'Open AI assistant'} aria-expanded={open} />
    </>
  );
}
