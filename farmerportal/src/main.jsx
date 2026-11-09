import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import { AppProvider } from './state/AppContext.jsx';
import './styles.css';

// Android phones (the app and Chrome): the glass stops bending while the page scrolls or a map is
// dragged, and bends again 200 ms after it stops. See .android.moving in styles.css.
if (/Android/i.test(navigator.userAgent)) {
  const root = document.documentElement;
  root.classList.add('android');
  let still;
  const moving = () => {
    if (!still) root.classList.add('moving');
    clearTimeout(still);
    still = setTimeout(() => { root.classList.remove('moving'); still = null; }, 200);
  };
  // capture: scroll events don't bubble, and each page, sheet and chat list scrolls on its own
  document.addEventListener('scroll', moving, { capture: true, passive: true });
  document.addEventListener('touchmove', moving, { capture: true, passive: true });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* No v7_startTransition: pages update state and then navigate (sign-in, registration), and their
        own guards would redirect first if navigation were deferred. */}
    <HashRouter future={{ v7_relativeSplatPath: true }}>
      <AppProvider>
        <App />
      </AppProvider>
    </HashRouter>
  </React.StrictMode>,
);
