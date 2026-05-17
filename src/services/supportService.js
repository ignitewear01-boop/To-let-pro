/**
 * ─── supportService.js ───────────────────────────────────────────────────
 *
 * Support tickets + AI-to-human handoff.
 *
 * Two surfaces:
 *
 *   USER-SIDE (called from GlobalAIAssistant + Help Center)
 *     - openTicket()
 *     - listMyTickets()
 *     - getTicket(id)
 *     - sendMessage(id, text)
 *     - closeTicket(id)
 *
 *   ADMIN-SIDE (called from /admin/support)
 *     - listAllTickets(filters?)
 *     - getTicketWithContext(id)
 *     - sendAdminMessage(id, text)
 *     - assignTicket(id, adminId)
 *     - resolveTicket(id, summary?)
 *     - reopenTicket(id)
 *
 * Real-time-ish updates: every write broadcasts `support:tickets` so the
 * matching `subscribe()` consumers re-fetch. With a real backend, replace
 * the broadcast with a WebSocket subscription on the same channel.
 *
 * Backend contract:
 *   POST   /api/support/tickets                     -> { ticket }
 *   GET    /api/support/tickets                     -> { tickets[] }
 *   GET    /api/support/tickets/:id                 -> { ticket, messages[] }
 *   POST   /api/support/tickets/:id/messages        -> { message }
 *   POST   /api/support/tickets/:id/close           -> { ok }
 *
 *   GET    /api/admin/support/tickets               -> { tickets[] }   (admin)
 *   GET    /api/admin/support/tickets/:id           -> { ticket, messages[], userContext }
 *   POST   /api/admin/support/tickets/:id/messages  -> { message }
 *   POST   /api/admin/support/tickets/:id/assign    -> { ok }
 *   POST   /api/admin/support/tickets/:id/resolve   -> { ok }
 *   POST   /api/admin/support/tickets/:id/reopen    -> { ok }
 */

import {
  fakeLatency, readJson, writeJson, broadcast, subscribe, now, newId,
} from './_storage.js';
import { getCurrentUser } from './authService.js';

/** @typedef {'open'|'pending_user'|'resolved'|'closed'} TicketStatus */
/** @typedef {'low'|'normal'|'urgent'} TicketPriority */
/** @typedef {'user'|'admin'|'ai'|'system'} MessageAuthor */

/**
 * @typedef {Object} TicketMessage
 * @property {string} id
 * @property {MessageAuthor} author
 * @property {string=} authorId         user/admin id (omitted for ai/system)
 * @property {string=} authorName       display name at time of write
 * @property {string} text
 * @property {string} createdAt         ISO timestamp
 */

/**
 * @typedef {Object} Ticket
 * @property {string} id
 * @property {string} userId           creator
 * @property {string} userName
 * @property {string} userPhone
 * @property {string} subject          short summary derived from first user message
 * @property {TicketStatus} status
 * @property {TicketPriority} priority
 * @property {string=} assignedAdminId
 * @property {string=} assignedAdminName
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string=} resolvedAt
 * @property {string=} resolutionSummary
 * @property {{ source: 'ai_widget'|'help_center'|'admin_created', aiTranscript?: TicketMessage[] }} origin
 */

/**
 * @typedef {Object} UserContext
 * Context an admin sees in the workspace right-rail.
 * @property {string} userId
 * @property {string} name
 * @property {string} phone
 * @property {string=} email
 * @property {number} trustScore
 * @property {boolean} kycVerified
 * @property {number} openTicketCount
 * @property {number} resolvedTicketCount
 * @property {string=} lastActivityAt
 */

const KEY_TICKETS = 'support:tickets';
const KEY_MESSAGES = 'support:messages';
const CHANNEL = 'support:tickets';

/** @returns {Ticket[]} */
const allTickets = () => readJson(KEY_TICKETS, /** @type {Ticket[]} */([]));

/** @returns {Record<string, TicketMessage[]>} */
const allMessages = () => readJson(KEY_MESSAGES, /** @type {Record<string, TicketMessage[]>} */({}));

/** Build a ticket subject from the user's first message. @param {string} text */
const deriveSubject = (text) => {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= 60) return trimmed || 'Support request';
  return trimmed.slice(0, 57) + '…';
};

// ─── USER-SIDE API ────────────────────────────────────────────────────────

/**
 * Open a new ticket. If `aiTranscript` is provided (handoff from the AI
 * widget), we attach it as origin context and seed the conversation with
 * a system message and the user's most recent question.
 *
 * @param {{ initialMessage: string, aiTranscript?: TicketMessage[] }} input
 * @returns {Promise<Ticket>}
 */
export const openTicket = async ({ initialMessage, aiTranscript }) => {
  await fakeLatency();
  const user = getCurrentUser();
  if (!user) throw new Error('Sign in required to open a support ticket');
  const ts = now();
  /** @type {Ticket} */
  const ticket = {
    id: newId(),
    userId: user.id,
    userName: user.name,
    userPhone: user.phone,
    subject: deriveSubject(initialMessage),
    status: 'open',
    priority: 'normal',
    createdAt: ts,
    updatedAt: ts,
    origin: {
      source: aiTranscript ? 'ai_widget' : 'help_center',
      aiTranscript,
    },
  };
  /** @type {TicketMessage[]} */
  const seed = [
    {
      id: newId(),
      author: 'system',
      text: aiTranscript
        ? 'Conversation handed off from AI Assistant. Full transcript attached.'
        : 'Ticket opened from Help Center.',
      createdAt: ts,
    },
    {
      id: newId(),
      author: 'user',
      authorId: user.id,
      authorName: user.name,
      text: initialMessage,
      createdAt: ts,
    },
  ];
  const tickets = [ticket, ...allTickets()];
  const messages = { ...allMessages(), [ticket.id]: seed };
  writeJson(KEY_TICKETS, tickets);
  writeJson(KEY_MESSAGES, messages);
  broadcast(CHANNEL);
  return ticket;
};

/** @returns {Promise<Ticket[]>} */
export const listMyTickets = async () => {
  await fakeLatency(150);
  const user = getCurrentUser();
  if (!user) return [];
  return allTickets()
    .filter((t) => t.userId === user.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
};

/**
 * @param {string} id
 * @returns {Promise<{ ticket: Ticket, messages: TicketMessage[] } | null>}
 */
export const getTicket = async (id) => {
  await fakeLatency(150);
  const ticket = allTickets().find((t) => t.id === id);
  if (!ticket) return null;
  const messages = allMessages()[id] ?? [];
  return { ticket, messages };
};

/**
 * Send a message AS THE CURRENT USER.
 * @param {string} ticketId
 * @param {string} text
 * @returns {Promise<TicketMessage>}
 */
export const sendMessage = async (ticketId, text) => {
  await fakeLatency(150);
  const user = getCurrentUser();
  if (!user) throw new Error('Sign in required');
  const tickets = allTickets();
  const ticket = tickets.find((t) => t.id === ticketId);
  if (!ticket) throw new Error('Ticket not found');
  if (ticket.userId !== user.id) throw new Error('Not your ticket');
  /** @type {TicketMessage} */
  const message = {
    id: newId(),
    author: 'user',
    authorId: user.id,
    authorName: user.name,
    text,
    createdAt: now(),
  };
  const messages = allMessages();
  messages[ticketId] = [...(messages[ticketId] ?? []), message];
  ticket.updatedAt = message.createdAt;
  if (ticket.status === 'pending_user') ticket.status = 'open';
  writeJson(KEY_TICKETS, tickets);
  writeJson(KEY_MESSAGES, messages);
  broadcast(CHANNEL);
  return message;
};

/** @param {string} ticketId */
export const closeTicket = async (ticketId) => {
  await fakeLatency(150);
  const tickets = allTickets();
  const ticket = tickets.find((t) => t.id === ticketId);
  if (!ticket) throw new Error('Ticket not found');
  ticket.status = 'closed';
  ticket.updatedAt = now();
  writeJson(KEY_TICKETS, tickets);
  broadcast(CHANNEL);
  return { ok: true };
};

// ─── ADMIN-SIDE API ───────────────────────────────────────────────────────

/**
 * @param {{ status?: TicketStatus, search?: string }} [filters]
 * @returns {Promise<Ticket[]>}
 */
export const listAllTickets = async (filters = {}) => {
  await fakeLatency(150);
  let tickets = allTickets();
  if (filters.status) tickets = tickets.filter((t) => t.status === filters.status);
  if (filters.search) {
    const q = filters.search.toLowerCase();
    tickets = tickets.filter(
      (t) =>
        t.subject.toLowerCase().includes(q) ||
        t.userName.toLowerCase().includes(q) ||
        t.userPhone.toLowerCase().includes(q),
    );
  }
  return tickets.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
};

/**
 * @param {string} id
 * @returns {Promise<{ ticket: Ticket, messages: TicketMessage[], userContext: UserContext } | null>}
 */
export const getTicketWithContext = async (id) => {
  await fakeLatency(200);
  const ticket = allTickets().find((t) => t.id === id);
  if (!ticket) return null;
  const messages = allMessages()[id] ?? [];
  const allTks = allTickets().filter((t) => t.userId === ticket.userId);
  /** @type {UserContext} */
  const userContext = {
    userId: ticket.userId,
    name: ticket.userName,
    phone: ticket.userPhone,
    trustScore: 70,
    kycVerified: false,
    openTicketCount: allTks.filter((t) => t.status === 'open' || t.status === 'pending_user').length,
    resolvedTicketCount: allTks.filter((t) => t.status === 'resolved' || t.status === 'closed').length,
    lastActivityAt: allTks[0]?.updatedAt,
  };
  return { ticket, messages, userContext };
};

/**
 * Send a message AS AN ADMIN.
 * @param {string} ticketId
 * @param {string} text
 * @param {{ markPendingUser?: boolean }} [opts]
 * @returns {Promise<TicketMessage>}
 */
export const sendAdminMessage = async (ticketId, text, opts = {}) => {
  await fakeLatency(150);
  const admin = getCurrentUser();
  if (!admin) throw new Error('Admin sign-in required');
  const tickets = allTickets();
  const ticket = tickets.find((t) => t.id === ticketId);
  if (!ticket) throw new Error('Ticket not found');
  /** @type {TicketMessage} */
  const message = {
    id: newId(),
    author: 'admin',
    authorId: admin.id,
    authorName: admin.name,
    text,
    createdAt: now(),
  };
  const messages = allMessages();
  messages[ticketId] = [...(messages[ticketId] ?? []), message];
  ticket.updatedAt = message.createdAt;
  if (opts.markPendingUser) ticket.status = 'pending_user';
  if (!ticket.assignedAdminId) {
    ticket.assignedAdminId = admin.id;
    ticket.assignedAdminName = admin.name;
  }
  writeJson(KEY_TICKETS, tickets);
  writeJson(KEY_MESSAGES, messages);
  broadcast(CHANNEL);
  return message;
};

/** @param {string} ticketId @param {{ adminId: string, adminName: string }} assignee */
export const assignTicket = async (ticketId, assignee) => {
  await fakeLatency(150);
  const tickets = allTickets();
  const ticket = tickets.find((t) => t.id === ticketId);
  if (!ticket) throw new Error('Ticket not found');
  ticket.assignedAdminId = assignee.adminId;
  ticket.assignedAdminName = assignee.adminName;
  ticket.updatedAt = now();
  writeJson(KEY_TICKETS, tickets);
  broadcast(CHANNEL);
  return { ok: true };
};

/** @param {string} ticketId @param {string} [summary] */
export const resolveTicket = async (ticketId, summary) => {
  await fakeLatency(150);
  const tickets = allTickets();
  const ticket = tickets.find((t) => t.id === ticketId);
  if (!ticket) throw new Error('Ticket not found');
  ticket.status = 'resolved';
  ticket.updatedAt = now();
  ticket.resolvedAt = ticket.updatedAt;
  ticket.resolutionSummary = summary;
  writeJson(KEY_TICKETS, tickets);
  broadcast(CHANNEL);
  return { ok: true };
};

/** @param {string} ticketId */
export const reopenTicket = async (ticketId) => {
  await fakeLatency(150);
  const tickets = allTickets();
  const ticket = tickets.find((t) => t.id === ticketId);
  if (!ticket) throw new Error('Ticket not found');
  ticket.status = 'open';
  ticket.resolvedAt = undefined;
  ticket.resolutionSummary = undefined;
  ticket.updatedAt = now();
  writeJson(KEY_TICKETS, tickets);
  broadcast(CHANNEL);
  return { ok: true };
};

// ─── REAL-TIME SUBSCRIPTION ───────────────────────────────────────────────

/** @param {() => void} listener @returns {() => void} */
export const onTicketsChanged = (listener) => subscribe(CHANNEL, listener);
