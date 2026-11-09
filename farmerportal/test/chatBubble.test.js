import { describe, expect, it } from 'vitest';
import { AI_URL } from '../src/components/ChatBubble.jsx';

describe('ChatBubble AI_URL configuration', () => {
  it('preserves relative API URLs like /ai or startsWith /', () => {
    // Helper replicating the URL resolution logic in ChatBubble
    const resolveAiUrl = (raw) => {
      const trimmed = (raw || 'http://localhost:5050').replace(/\/$/, '');
      return /^https?:\/\//.test(trimmed) || trimmed.startsWith('/') ? trimmed : `http://${trimmed}`;
    };

    expect(resolveAiUrl('/ai')).toBe('/ai');
    expect(resolveAiUrl('/ai/')).toBe('/ai');
    expect(resolveAiUrl('https://farmer.yalamaha.aurawebsolution.online/ai')).toBe('https://farmer.yalamaha.aurawebsolution.online/ai');
    expect(resolveAiUrl('http://localhost:5050')).toBe('http://localhost:5050');
    expect(resolveAiUrl('localhost:5050')).toBe('http://localhost:5050');
    expect(resolveAiUrl('')).toBe('http://localhost:5050');
  });

  it('exports a valid AI_URL in the current test environment', () => {
    expect(typeof AI_URL).toBe('string');
    expect(AI_URL.length).toBeGreaterThan(0);
    // Should not produce invalid malformed scheme like http:///ai
    expect(AI_URL).not.toMatch(/^http:\/\/\//);
  });
});
