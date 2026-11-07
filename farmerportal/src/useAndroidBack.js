// The Android back button in the app (Capacitor). Without a listener Android closes the whole app on
// the first press; with one, it does what a farmer expects:
//   1. something open on top (a sheet, the chat): close it
//   2. a bottom-bar tab (Water, Report, Fields, Profile): go to Home
//   3. any other page with somewhere to go back to: go back one step
//   4. Home, the sign-in screens, or nothing to go back to: put the app in the background (like
//      pressing Home), so it opens again where the farmer was instead of starting over
// In a browser this does nothing: the browser's own back button already works.
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';

const TABS = ['/water', '/report', '/fields', '/profile'];   // the bottom bar, besides Home
const ROOTS = ['/', '/home', '/welcome', '/login'];

// What one press of back should do on this page (exported for the tests).
export function backAction({ pathname, hasHistory, overlayOpen, signedIn }) {
  if (overlayOpen) return 'close';
  if (ROOTS.includes(pathname)) return 'minimize';
  if (signedIn && TABS.includes(pathname)) return 'home';
  if (hasHistory) return 'back';
  return signedIn ? 'home' : 'minimize';
}

export function useAndroidBack(signedIn) {
  const navigate = useNavigate();
  const location = useLocation();
  const state = useRef({});
  state.current = { location, signedIn };

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    const handle = NativeApp.addListener('backButton', () => {
      const { location: loc, signedIn: inApp } = state.current;
      const overlayOpen = Boolean(document.querySelector('.sheet-backdrop, .chat-panel'));
      const action = backAction({ pathname: loc.pathname, hasHistory: loc.key !== 'default', overlayOpen, signedIn: inApp });
      if (action === 'close') window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));   // Sheet and ChatBubble close on Escape
      else if (action === 'back') navigate(-1);
      else if (action === 'home') navigate('/home', { replace: true });
      else NativeApp.minimizeApp();
    });
    return () => { Promise.resolve(handle).then((h) => h.remove()); };
  }, [navigate]);
}
