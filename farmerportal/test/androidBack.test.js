// What the Android back button does on each page (backAction in src/useAndroidBack.js).
import { describe, expect, it } from 'vitest';
import { backAction } from '../src/useAndroidBack.js';

const at = (pathname, extra = {}) => backAction({ pathname, hasHistory: true, overlayOpen: false, signedIn: true, ...extra });

describe('backAction', () => {
  it('closes a sheet or the chat first, on any page', () => {
    expect(at('/news', { overlayOpen: true })).toBe('close');
    expect(at('/home', { overlayOpen: true })).toBe('close');
  });
  it('Home and the sign-in screens put the app in the background instead of closing it', () => {
    for (const p of ['/home', '/', '/login', '/welcome']) expect(at(p)).toBe('minimize');
  });
  it('the other bottom-bar tabs go to Home', () => {
    for (const p of ['/water', '/report', '/fields', '/profile']) expect(at(p)).toBe('home');
  });
  it('inner pages go back one step', () => {
    for (const p of ['/forecast', '/news', '/alerts', '/register/crops', '/otp', '/signin']) expect(at(p)).toBe('back');
  });
  it('nothing to go back to: Home when signed in, else the background', () => {
    expect(at('/forecast', { hasHistory: false })).toBe('home');
    expect(at('/register/identity', { hasHistory: false, signedIn: false })).toBe('minimize');
  });
});
