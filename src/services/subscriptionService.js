/**
 * ─── subscriptionService.js ──────────────────────────────────────────────
 *
 * Mock implementation of the host-side subscription model. The product
 * spec is:
 *
 *   - Every new host gets a **3-month free trial** the moment they create
 *     an account. No card, no charge, no friction.
 *   - During the trial all premium features are unlocked (Analytics,
 *     Documents / Home Management, Bookings, Rent Collection, Smart
 *     Alerts, AI Insights).
 *   - After the trial expires, those features auto-lock. Clicking a
 *     locked feature redirects the host to /subscription.
 *   - The host can either upgrade to a paid Pro plan (monthly / yearly)
 *     or keep using the always-free tabs (Dashboard, My Properties,
 *     Inquiries, Messages).
 *
 * Today everything lives in localStorage. When the backend ships, only
 * this file changes — components consume the service through the
 * documented contracts below.
 *
 * Storage key: `tolet_pro::subscription:user`
 *   Shape: { tier, trialStartedAt, paidThroughAt, plan, autoRenew }
 */

import {
  readJson,
  writeJson,
  broadcast,
  subscribe as subscribeKey,
  fakeLatency,
  now,
} from './_storage.js';
import { getCurrentUser } from './authService.js';

const KEY_SUBSCRIPTION = 'subscription:user';

const TRIAL_DURATION_MS = 1000 * 60 * 60 * 24 * 90; // 3 months ≈ 90 days

// Feature ids that live behind the paywall. Used by HostDashboard to draw
// the lock badge on sidebar items and intercept clicks. Keeping the list
// here (not in components) so the backend can drive it later via
// GET /api/host/me/subscription -> { lockedFeatures: [...] }.
export const PREMIUM_FEATURES = [
  'analytics',
  'documents',       // "Home Management" in the spec
  'bookings',
  'rent',
  'smartAlerts',
  'aiInsights',
];

const FEATURE_LABELS = {
  analytics:   { en: 'Analytics',        bn: 'অ্যানালিটিক্স' },
  documents:   { en: 'Home Management',  bn: 'হোম ম্যানেজমেন্ট' },
  bookings:    { en: 'Bookings',         bn: 'বুকিং' },
  rent:        { en: 'Rent Collection',  bn: 'ভাড়া কালেকশন' },
  smartAlerts: { en: 'Smart Alerts',     bn: 'স্মার্ট অ্যালার্টস' },
  aiInsights:  { en: 'AI Insights',      bn: 'এআই ইনসাইটস' },
};

/**
 * Plans the host can choose from on /subscription. Pricing is presentation-
 * only today; the backend's billing service will be the source of truth.
 *
 * Backend contract:
 *   GET /api/billing/plans
 *     Response: { plans: [{ id, name, price, interval, features, popular }] }
 */
export const PLANS = [
  {
    id: 'pro_monthly',
    name: { en: 'Pro Monthly', bn: 'প্রো মাসিক' },
    price: 999,
    currency: 'BDT',
    interval: 'month',
    intervalLabel: { en: '/month', bn: '/মাসিক' },
    popular: false,
    benefits: { en: ['All premium tabs', 'Cancel anytime', 'Email support'], bn: ['সব প্রিমিয়াম ট্যাব', 'যেকোনো সময় বাতিল', 'ইমেইল সাপোর্ট'] },
  },
  {
    id: 'pro_yearly',
    name: { en: 'Pro Yearly', bn: 'প্রো বার্ষিক' },
    price: 9999,
    currency: 'BDT',
    interval: 'year',
    intervalLabel: { en: '/year', bn: '/বছর' },
    popular: true,
    savings: { en: 'Save ~17%', bn: '~১৭% সাশ্রয়' },
    benefits: { en: ['All premium tabs', 'Priority support', '2 months free'], bn: ['সব প্রিমিয়াম ট্যাব', 'প্রায়োরিটি সাপোর্ট', '২ মাস ফ্রি'] },
  },
];

const readRecord = () => readJson(KEY_SUBSCRIPTION, null);
const writeRecord = (rec) => { writeJson(KEY_SUBSCRIPTION, rec); broadcast(KEY_SUBSCRIPTION); };

/**
 * Ensure a subscription record exists for the current host. Called on
 * every status read — first call seeds the 3-month trial.
 */
const ensureRecord = () => {
  const me = getCurrentUser();
  if (!me) return null;
  const existing = readRecord();
  if (existing && existing.userId === me.id) return existing;
  const seeded = {
    userId: me.id,
    tier: 'trial',
    trialStartedAt: now(),
    paidThroughAt: null,
    plan: null,
    autoRenew: false,
  };
  writeRecord(seeded);
  return seeded;
};

/**
 * Derive the live status from a record. Pure — does not write.
 * @param {object|null} rec
 */
const deriveStatus = (rec) => {
  if (!rec) {
    return { tier: 'guest', isPaid: false, isTrial: false, isExpired: false, daysRemaining: 0, trialEndsAt: null };
  }
  // Paid subscribers (active, in-date Pro). `paidThroughAt` is the
  // exclusive end-of-coverage instant; once we pass it they drop back to
  // expired-trial state until they renew.
  if (rec.tier === 'pro' && rec.paidThroughAt && new Date(rec.paidThroughAt).getTime() > Date.now()) {
    return {
      tier: 'pro',
      plan: rec.plan,
      isPaid: true,
      isTrial: false,
      isExpired: false,
      daysRemaining: Math.ceil((new Date(rec.paidThroughAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      paidThroughAt: rec.paidThroughAt,
    };
  }
  // Trial accounting.
  const startedAt = rec.trialStartedAt ? new Date(rec.trialStartedAt).getTime() : Date.now();
  const endsAt = startedAt + TRIAL_DURATION_MS;
  const msLeft = endsAt - Date.now();
  if (msLeft > 0) {
    return {
      tier: 'trial',
      isPaid: false,
      isTrial: true,
      isExpired: false,
      daysRemaining: Math.ceil(msLeft / (1000 * 60 * 60 * 24)),
      trialEndsAt: new Date(endsAt).toISOString(),
    };
  }
  return {
    tier: 'expired',
    isPaid: false,
    isTrial: false,
    isExpired: true,
    daysRemaining: 0,
    trialEndsAt: new Date(endsAt).toISOString(),
  };
};

export const subscriptionService = {
  /**
   * Snapshot the host's current subscription status. Locked features in
   * the UI key off `status.isExpired === true`.
   *
   * Backend contract:
   *   GET /api/host/me/subscription   (Bearer)
   *     Response: { status: 'trial'|'pro'|'expired',
   *                 trialEndsAt?: ISO,
   *                 paidThroughAt?: ISO,
   *                 plan?: { id, name, price, interval },
   *                 daysRemaining: number }
   */
  getStatus() {
    return deriveStatus(ensureRecord());
  },

  /** Feature IDs the host can no longer access. Empty unless expired. */
  getLockedFeatures() {
    const status = this.getStatus();
    return status.isExpired ? [...PREMIUM_FEATURES] : [];
  },

  /** Display label for a feature id in either language. */
  labelFor(featureId, lang = 'English') {
    const entry = FEATURE_LABELS[featureId];
    if (!entry) return featureId;
    return lang === 'বাংলা' ? entry.bn : entry.en;
  },

  /**
   * Activate / renew a paid plan.
   *
   * Backend contract:
   *   POST /api/billing/checkout    (Bearer)
   *     Body: { planId: 'pro_monthly' | 'pro_yearly' }
   *     Response: { subscription: { tier, plan, paidThroughAt, autoRenew } }
   *
   * In mock mode the function pretends the payment succeeded and sets
   * `paidThroughAt` based on the plan interval.
   */
  async subscribe(planId) {
    await fakeLatency(300);
    const me = getCurrentUser();
    if (!me) throw new Error('Sign in before subscribing.');
    const plan = PLANS.find((p) => p.id === planId);
    if (!plan) throw new Error('Unknown plan: ' + planId);
    const ms = plan.interval === 'year' ? 1000 * 60 * 60 * 24 * 365 : 1000 * 60 * 60 * 24 * 30;
    const rec = {
      userId: me.id,
      tier: 'pro',
      trialStartedAt: readRecord()?.trialStartedAt || now(),
      paidThroughAt: new Date(Date.now() + ms).toISOString(),
      plan: { id: plan.id, name: plan.name, price: plan.price, interval: plan.interval },
      autoRenew: true,
    };
    writeRecord(rec);
    return deriveStatus(rec);
  },

  /**
   * Cancel auto-renew (keeps access until paidThroughAt).
   *
   * Backend contract:
   *   POST /api/billing/cancel   (Bearer)
   *     Response: { subscription: { ..., autoRenew: false } }
   */
  async cancel() {
    await fakeLatency(200);
    const existing = readRecord();
    if (!existing) return null;
    const next = { ...existing, autoRenew: false };
    writeRecord(next);
    return deriveStatus(next);
  },

  /**
   * For QA only — wipe the host's subscription record so the next call to
   * getStatus() re-seeds a fresh 3-month trial. Not exposed in the UI.
   */
  _resetForTesting() {
    writeRecord(null);
  },

  /** Subscribe to subscription record changes (cross-tab + same-tab). */
  onChange(listener) {
    return subscribeKey(KEY_SUBSCRIPTION, listener);
  },
};
