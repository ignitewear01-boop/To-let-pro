/**
 * ─── privacyService.js ───────────────────────────────────────────────────
 *
 * User-facing data-control surface (the "Privacy Center"):
 *   - exportMyData()           Download a JSON snapshot of everything we
 *                              store about the user.
 *   - requestAccountDeletion() Soft-delete with 30-day grace period.
 *   - cancelAccountDeletion()  Reverse a pending deletion within the grace
 *                              window.
 *   - listMySessions()         Active devices/sessions.
 *   - revokeSession(id)        Sign out a specific device.
 *   - revokeAllOtherSessions() Sign out everything except this tab.
 *   - getPreferences()/setPreferences()
 *
 * Backend contract:
 *   GET    /api/users/me/export       (Bearer)        -> { downloadUrl, expiresAt }
 *   POST   /api/users/me/delete       (Bearer)        -> { restoreDeadline }
 *   POST   /api/users/me/delete/cancel (Bearer)       -> { ok }
 *   GET    /api/users/me/sessions     (Bearer)        -> { sessions[] }
 *   DELETE /api/users/me/sessions/:id (Bearer)        -> { ok }
 *   DELETE /api/users/me/sessions     (Bearer)        -> { ok }   (revoke all but current)
 *   GET    /api/users/me/preferences  (Bearer)        -> { preferences }
 *   PATCH  /api/users/me/preferences  (Bearer)        -> { preferences }
 */

import {
  fakeLatency, readJson, writeJson, broadcast, now, newId,
} from './_storage.js';
import { getCurrentUser } from './authService.js';

/**
 * @typedef {Object} Session
 * @property {string} id
 * @property {string} device     "Chrome on macOS", "Safari on iPhone", etc.
 * @property {string} ipAddress  may be partially masked
 * @property {string} createdAt
 * @property {string} lastSeenAt
 * @property {boolean} current   true for the session this tab uses
 */

/**
 * @typedef {Object} Preferences
 * @property {boolean} aiLearningOptIn   allow AI to learn from this user's chats
 * @property {boolean} marketingEmails
 * @property {boolean} smsAlerts
 * @property {'system'|'light'|'dark'} theme
 * @property {'en'|'bn'} language
 */

const KEY_DELETE = 'privacy:pendingDeletion';
const KEY_SESSIONS = 'privacy:sessions';
const KEY_PREFS = 'privacy:preferences';
const KEY_AI_HISTORY = 'ai_chat_history'; // owned by GlobalAIAssistant; we read it for export

const DELETION_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

/** @returns {Preferences} */
const defaultPrefs = () => ({
  aiLearningOptIn: false,
  marketingEmails: true,
  smsAlerts: true,
  theme: 'system',
  language: 'en',
});

// ─── EXPORT ───────────────────────────────────────────────────────────────

/**
 * In mock mode we build an object client-side and return a Blob URL the
 * caller can stick on an <a download>. The real backend will return a
 * signed S3 URL valid for ~10 minutes.
 *
 * @returns {Promise<{ downloadUrl: string, expiresAt: string, filename: string }>}
 */
export const exportMyData = async () => {
  await fakeLatency(700);
  const user = getCurrentUser();
  if (!user) throw new Error('Sign in required');
  const payload = {
    exportedAt: now(),
    user,
    aiChatHistory: readJson(KEY_AI_HISTORY, []),
    preferences: getPreferencesSync(),
    sessions: readJson(KEY_SESSIONS, []),
    note:
      'This is a complete snapshot of every record TO-LET PRO holds about ' +
      'your account at the time of export.',
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const downloadUrl = URL.createObjectURL(blob);
  const filename = `tolet-pro-data-${user.id}.json`;
  return {
    downloadUrl,
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    filename,
  };
};

// ─── DELETION ─────────────────────────────────────────────────────────────

/** @typedef {{ scheduledAt: string, restoreDeadline: string }} PendingDeletion */

/** @returns {PendingDeletion|null} */
export const getPendingDeletion = () => readJson(KEY_DELETE, /** @type {PendingDeletion|null} */(null));

/** @returns {Promise<PendingDeletion>} */
export const requestAccountDeletion = async () => {
  await fakeLatency();
  const scheduled = now();
  const restoreDeadline = new Date(Date.now() + DELETION_GRACE_MS).toISOString();
  /** @type {PendingDeletion} */
  const pending = { scheduledAt: scheduled, restoreDeadline };
  writeJson(KEY_DELETE, pending);
  broadcast(KEY_DELETE);
  return pending;
};

export const cancelAccountDeletion = async () => {
  await fakeLatency();
  writeJson(KEY_DELETE, null);
  broadcast(KEY_DELETE);
  return { ok: true };
};

// ─── SESSIONS ─────────────────────────────────────────────────────────────

/** Make sure at least the current session exists in storage. @returns {Session[]} */
const ensureCurrentSession = () => {
  /** @type {Session[]} */
  const list = readJson(KEY_SESSIONS, []);
  if (!list.some((s) => s.current)) {
    /** @type {Session} */
    const current = {
      id: newId(),
      device: navigatorLabel(),
      ipAddress: '203.0.113.xxx',
      createdAt: now(),
      lastSeenAt: now(),
      current: true,
    };
    list.push(current);
    writeJson(KEY_SESSIONS, list);
  }
  return list;
};

const navigatorLabel = () => {
  if (typeof navigator === 'undefined') return 'Unknown device';
  const ua = navigator.userAgent;
  const browser = /Chrome/.test(ua)
    ? 'Chrome'
    : /Safari/.test(ua)
    ? 'Safari'
    : /Firefox/.test(ua)
    ? 'Firefox'
    : 'Browser';
  const os = /Mac/.test(ua)
    ? 'macOS'
    : /Windows/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad/.test(ua)
    ? 'iOS'
    : 'Unknown';
  return `${browser} on ${os}`;
};

/** @returns {Promise<Session[]>} */
export const listMySessions = async () => {
  await fakeLatency(200);
  return ensureCurrentSession();
};

/** @param {string} sessionId */
export const revokeSession = async (sessionId) => {
  await fakeLatency();
  /** @type {Session[]} */
  const list = readJson(KEY_SESSIONS, []);
  const next = list.filter((s) => s.id !== sessionId);
  writeJson(KEY_SESSIONS, next);
  broadcast(KEY_SESSIONS);
  return { ok: true };
};

export const revokeAllOtherSessions = async () => {
  await fakeLatency();
  /** @type {Session[]} */
  const list = readJson(KEY_SESSIONS, []);
  const next = list.filter((s) => s.current);
  writeJson(KEY_SESSIONS, next);
  broadcast(KEY_SESSIONS);
  return { ok: true, remaining: next.length };
};

// ─── PREFERENCES ──────────────────────────────────────────────────────────

/** @returns {Preferences} */
const getPreferencesSync = () => ({ ...defaultPrefs(), ...readJson(KEY_PREFS, {}) });

/** @returns {Promise<Preferences>} */
export const getPreferences = async () => {
  await fakeLatency(150);
  return getPreferencesSync();
};

/** @param {Partial<Preferences>} patch @returns {Promise<Preferences>} */
export const setPreferences = async (patch) => {
  await fakeLatency(200);
  const next = { ...getPreferencesSync(), ...patch };
  writeJson(KEY_PREFS, next);
  broadcast(KEY_PREFS);
  return next;
};
