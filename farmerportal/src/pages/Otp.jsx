import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { emptyDraft, formatPhone, useApp } from '../state/AppContext.jsx';
import { IconBtn, PrimaryBtn } from '../components/UI.jsx';
import Icon from '../components/Icon.jsx';
import { sendOtp, verifyOtp } from '../api/auth.js';

const RESEND_SECONDS = 60;

// What the code box keeps of whatever was typed or pasted: the first 6 digits.
export const cleanCode = (v) => String(v ?? '').replace(/\D/g, '').slice(0, 6);

export default function Otp() {
  const { t, pendingPhone, otpSentAt, update, showToast } = useApp();
  const navigate = useNavigate();
  // One real input shown as six boxes: the phone keyboard's backspace, paste and SMS autofill all
  // work on it as on any text field. (Six separate inputs can't follow backspace on Android: an empty
  // box gets no usable key event, so the cursor never moved back to the previous digit.)
  const [code, setCode] = useState('');
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => { inputRef.current?.focus(); }, []);

  if (!pendingPhone) return <Navigate to="/login" replace />;

  const left = Math.max(0, RESEND_SECONDS - Math.floor((now - (otpSentAt || 0)) / 1000));

  const verify = async (value) => {
    if (value.length < 6 || busy) return;
    setBusy(true);
    try {
      const { alreadyRegistered } = await verifyOtp(pendingPhone, value);
      if (alreadyRegistered) {
        // The account exists: the API signs in with phone + NIC.
        navigate('/signin', { replace: true });
      } else {
        // Verified for 15 minutes on the API; the farm form ends with POST /register.
        update((s) => ({
          user: { phone: pendingPhone, pendingRegistration: true },
          farm: null,
          // Keep a half-filled form only for the number that started it.
          draft: s.draft.owner === pendingPhone ? s.draft : { ...emptyDraft(), owner: pendingPhone },
        }));
        showToast(t('phoneVerified'));
        navigate('/register/identity', { replace: true });
      }
    } catch (err) {
      setBusy(false);
      setError(err.status === 400 ? t('wrongCode') : err.message);
      setCode('');
      inputRef.current?.focus();
    }
  };

  const onType = (v) => {
    const next = cleanCode(v);
    setCode(next);
    setError('');
    if (next.length === 6) verify(next);
  };

  const resend = async () => {
    try {
      await sendOtp(pendingPhone);
      update({ otpSentAt: Date.now() });
      setNow(Date.now());
      setError('');
      showToast(t('codeResent'));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="screen">
      <div className="row"><IconBtn icon="back" label={t('back')} to="/login" /></div>
      <div className="icon-tile accent"><Icon name="sms" size={26} /></div>
      <div className="col gap6">
        <h1 className="h1">{t('enterCode')}</h1>
        <div className="f15 muted">{t('sentTo')} <b className="ink">{formatPhone(pendingPhone)}</b> - <button type="button" className="link-btn" onClick={() => navigate('/login')}>{t('change')}</button></div>
      </div>

      <div className={`otp ${error ? 'shake' : ''}`} onClick={() => inputRef.current?.focus()}>
        <input ref={inputRef} className="otp-input" aria-label={t('enterCode')} inputMode="numeric" pattern="[0-9]*"
          autoComplete="one-time-code" value={code}
          onChange={(e) => onType(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} aria-hidden="true"
            className={`otp-box ${code[i] ? 'filled' : ''} ${error ? 'error' : ''} ${focused && i === Math.min(code.length, 5) ? 'active' : ''}`}>
            {code[i] || ''}
          </div>
        ))}
      </div>
      {error && <div className="err-text" role="alert">{error}</div>}

      <div className="row between f15">
        <span className="muted">{t('didntGet')}</span>
        {left > 0
          ? <span className="chip-white"><Icon name="clock" size={14} stroke={2.2} />{t('resendIn')} 0:{String(left).padStart(2, '0')}</span>
          : <button type="button" className="chip-white btn" onClick={resend}><Icon name="refresh" size={14} stroke={2.2} />{t('resend')}</button>}
      </div>

      <div className="grow" />
      <PrimaryBtn onClick={() => verify(code)} disabled={busy || code.length < 6}>{busy ? '…' : t('verify')}</PrimaryBtn>
      <button type="button" className="text-btn center" onClick={() => showToast(t('signInHelp'))}>{t('needHelpSignIn')}</button>
    </div>
  );
}
