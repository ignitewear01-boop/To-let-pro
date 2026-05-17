/**
 * ─── authService.js ──────────────────────────────────────────────────────
 * Firebase OTP verify করার পরে Backend এ login/register করে।
 * Base URL: http://localhost:5000/api/auth
 */

import { readJson, writeJson, removeKey, broadcast } from './_storage.js';

const API_URL = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/auth`
  : 'http://localhost:5000/api/auth';

const KEY_USER  = 'auth:user';
const KEY_TOKEN = 'auth:token';

const ADMIN_ROLES = ['support_agent', 'moderator', 'super_admin'];
export const isAdminRole = (role) => ADMIN_ROLES.includes(role);

// বর্তমান ইউজার
export const getCurrentUser = () => readJson(KEY_USER);

// ─── Register ────────────────────────────────────────────────────────────────
export const register = async ({ name, phone, password, role = 'tenant' }) => {
  const res = await fetch(`${API_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, phone, password, role }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'অ্যাকাউন্ট তৈরি করতে সমস্যা হয়েছে।');
  return data;
};

// ─── Login ───────────────────────────────────────────────────────────────────
export const loginUser = async ({ phone, password }) => {
  const res = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'ফোন নম্বর বা পাসওয়ার্ড ভুল হয়েছে।');
  return data;
};

// ─── Main login() — AuthContext এটাকে call করে ──────────────────────────────
// Firebase OTP verify হওয়ার পরে এই function কে call করা হয়।
export const login = async ({ name, phone, password, role = 'tenant', isLogin = true }) => {
  try {
    // Sign Up হলে আগে register করো
    if (!isLogin && name) {
      await register({ name, phone, password, role });
    }

    // তারপর login করো
    const data = await loginUser({ phone, password });

    // Token ও User info save করো
    window.localStorage.setItem(KEY_TOKEN, data.token);
    writeJson(KEY_USER, data.user);
    broadcast(KEY_USER);

    return data.user;

  } catch (error) {
    throw error; // LoginPage এ error দেখানো হবে
  }
};

// ─── Logout ──────────────────────────────────────────────────────────────────
export const logout = async () => {
  window.localStorage.removeItem(KEY_TOKEN);
  removeKey(KEY_USER);
  broadcast(KEY_USER);
  return { ok: true };
};

export const loginAsDemoAdmin = async () => {
  throw new Error("ডেমো লগইন বন্ধ আছে।");
};

export const updateMe = async (patch) => {
  const user = getCurrentUser();
  if (!user) return null;
  const updated = { ...user, ...patch };
  writeJson(KEY_USER, updated);
  broadcast(KEY_USER);
  return updated;
};