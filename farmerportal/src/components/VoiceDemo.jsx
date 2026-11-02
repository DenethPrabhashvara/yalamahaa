// Demo of the voice flood alert: the server phones the team's demo number (API/routes/voicedemoroutes.js)
import { useState } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { request } from '../api/auth.js';
import { Card, PrimaryBtn } from './UI.jsx';

const LANGS = [['en', 'English'], ['si', 'සිංහල']];

export default function VoiceDemo() {
  const { t, showToast } = useApp();
  const [calling, setCalling] = useState(null);

  const call = async (lang) => {
    setCalling(lang);
    try {
      await request('/api/voice-demo/call', { method: 'POST', body: { lang } });
      showToast(t('voiceDemoCalling'));
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setCalling(null);
    }
  };

  return (
    <Card>
      <div className="f15 fw600">{t('voiceDemo')}</div>
      <div className="f14 muted lh" style={{ marginTop: 2 }}>{t('voiceDemoBody')}</div>
      <div className="col gap10" style={{ marginTop: 12 }}>
        {LANGS.map(([lang, label]) => (
          <PrimaryBtn key={lang} icon="bell" disabled={calling !== null} onClick={() => call(lang)}>{label}</PrimaryBtn>
        ))}
      </div>
    </Card>
  );
}
