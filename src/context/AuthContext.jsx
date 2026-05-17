import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  getCurrentUser,
  login as svcLogin,
  loginAsDemoAdmin as svcLoginAsDemoAdmin,
  logout as svcLogout,
  updateMe as svcUpdateMe,
  isAdminRole,
} from '../services/authService.js';
import { subscribe } from '../services/_storage.js';

/**
 * @typedef {import('../services/authService.js').User} User
 * @typedef {import('../services/authService.js').Role} Role
 *
 * @typedef {Object} AuthContextValue
 * @property {User|null} user
 * @property {boolean} isAuthenticated
 * @property {boolean} isAdmin
 * @property {(input: Parameters<typeof svcLogin>[0]) => Promise<User>} login
 * @property {() => Promise<User>} loginAsDemoAdmin
 * @property {() => Promise<void>} logout
 * @property {(patch: Partial<User>) => Promise<User>} updateMe
 */

/** @type {React.Context<AuthContextValue|null>} */
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => getCurrentUser());

  // Keep state in sync with localStorage changes from other tabs / direct
  // service calls. The `auth:user` channel is broadcast by authService on
  // every login/logout/updateMe.
  useEffect(() => {
    const refresh = () => setUser(getCurrentUser());
    return subscribe('auth:user', refresh);
  }, []);

  const value = useMemo(
    /** @returns {AuthContextValue} */
    () => ({
      user,
      isAuthenticated: !!user,
      isAdmin: !!user && isAdminRole(user.role),
      login: async (input) => {
        const u = await svcLogin(input);
        setUser(u);
        return u;
      },
      loginAsDemoAdmin: async () => {
        const u = await svcLoginAsDemoAdmin();
        setUser(u);
        return u;
      },
      logout: async () => {
        await svcLogout();
        setUser(null);
      },
      updateMe: async (patch) => {
        const u = await svcUpdateMe(patch);
        setUser(u);
        return u;
      },
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/** @returns {AuthContextValue} */
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
