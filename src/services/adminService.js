/**
 * ─── adminService.js ─────────────────────────────────────────────────────
 *
 * Admin-only data: dashboard stats, audit log. Property moderation and
 * user management have their own dedicated services that can hang off this
 * one later — for now we expose just what the rewritten Support workspace
 * needs (overview + audit) so we can ship the support-pipeline slice
 * without dragging in unrelated scope.
 *
 * Backend contract:
 *   GET    /api/admin/overview        -> { stats }
 *   GET    /api/admin/audit           -> { entries[] }
 *   POST   /api/admin/audit           -> { entry }
 */

import {
  fakeLatency, readJson, writeJson, broadcast, now, newId,
} from './_storage.js';
import { getCurrentUser, isAdminRole } from './authService.js';

/**
 * @typedef {Object} OverviewStats
 * @property {number} totalUsers
 * @property {number} activeProperties
 * @property {string} monthlyRevenueFormatted
 * @property {number} pendingModeration
 * @property {number} openTickets
 * @property {number} pendingKyc
 */

/**
 * @typedef {Object} AuditEntry
 * @property {string} id
 * @property {string} actorId
 * @property {string} actorName
 * @property {string} action          e.g. "ticket.resolve", "user.ban"
 * @property {string} targetType      e.g. "ticket", "user", "property"
 * @property {string} targetId
 * @property {string=} reason
 * @property {string} createdAt
 */

const KEY_AUDIT = 'admin:audit';

/** @returns {Promise<OverviewStats>} */
export const getOverviewStats = async () => {
  await fakeLatency(250);
  // Mock numbers; the existing AdminOverview screen renders these. The real
  // backend will compute these server-side.
  return {
    totalUsers: 2845,
    activeProperties: 842,
    monthlyRevenueFormatted: '৳ 1.2M',
    pendingModeration: 14,
    openTickets: 3,
    pendingKyc: 5,
  };
};

/** @returns {Promise<AuditEntry[]>} */
export const listAuditEntries = async () => {
  await fakeLatency(150);
  return readJson(KEY_AUDIT, /** @type {AuditEntry[]} */([])).slice().reverse();
};

/**
 * Record an admin action. Every admin write should call this.
 *
 * @param {{ action: string, targetType: string, targetId: string, reason?: string }} input
 * @returns {Promise<AuditEntry>}
 */
export const logAuditAction = async ({ action, targetType, targetId, reason }) => {
  await fakeLatency(80);
  const actor = getCurrentUser();
  if (!actor || !isAdminRole(actor.role)) {
    // Don't crash the calling write; just no-op the log so non-admin
    // surfaces (e.g. tests) can call into shared code paths.
    return /** @type {AuditEntry} */({
      id: newId(),
      actorId: 'unknown',
      actorName: 'unknown',
      action,
      targetType,
      targetId,
      reason,
      createdAt: now(),
    });
  }
  /** @type {AuditEntry} */
  const entry = {
    id: newId(),
    actorId: actor.id,
    actorName: actor.name,
    action,
    targetType,
    targetId,
    reason,
    createdAt: now(),
  };
  const list = readJson(KEY_AUDIT, /** @type {AuditEntry[]} */([]));
  list.push(entry);
  writeJson(KEY_AUDIT, list);
  broadcast(KEY_AUDIT);
  return entry;
};
