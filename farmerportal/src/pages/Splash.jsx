import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadFarm, useApp } from '../state/AppContext.jsx';
import { getProfile } from '../api/auth.js';

const SPLASH_MS = 2200;

// Checks the saved session with the API (refreshing the access token from the cookie).
// Resolves to where the farmer should go next.
async function restoreSession(user, update) {
  if (!user) return null;
  if (user.pendingRegistration) return '/register/identity';
  try {
    const farmer = await getProfile();
    update({ farm: await loadFarm(farmer) });
    return '/home';
  } catch (err) {
    // No connection: the app still works offline with the saved farm.
    if (err.status === 0 || err.status >= 500) return '/home';
    update({ user: null, pendingPhone: user.phone });
    return '/login';
  }
}

// Loading screen shown while the saved session is checked.
export default function Splash() {
  const { user, onboarded, update, t } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const wait = new Promise((resolve) => { setTimeout(resolve, SPLASH_MS); });
    Promise.all([restoreSession(user, update), wait]).then(([to]) => {
      if (!cancelled) navigate(to || (onboarded ? '/login' : '/welcome'), { replace: true });
    });
    return () => { cancelled = true; };
    // Runs once on launch; the session result decides the route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="splash" role="status" aria-label={`${t('appName')}, ${t('a11yLoading')}`}>
      <div className="splash-brand">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" draggable="false" />
        <div className="splash-brand-copy">
          <strong>{t('appName')}</strong>
          <span>{t('farmerPortal')}</span>
        </div>
      </div>
      <div className="splash-loading">
        <span className="splash-track" aria-hidden="true"><i /></span>
        <span>{t('loadingPortal')}</span>
      </div>
    </div>
  );
}
