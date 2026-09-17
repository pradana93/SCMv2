// Supabase Auth with a Base44-compatible surface.
// Base44 user shape preserved: { id, email, role, display_name/full_name,
// job_title, warehouses, ... } where profile fields live in public.profiles.

import { supabase } from './supabaseClient';

function profileToUser(authUser, profile) {
  const data = (profile && profile.data) || {};
  const email = (authUser && authUser.email) || data.email || '';
  const displayName =
    data.display_name || data.full_name || (authUser && authUser.user_metadata && authUser.user_metadata.full_name) || '';
  return {
    id: (authUser && authUser.id) || (profile && profile.id) || '',
    email,
    role: data.role || 'crew',
    display_name: displayName,
    full_name: data.full_name || displayName,
    job_title: data.job_title || '',
    warehouses: Array.isArray(data.warehouses) ? data.warehouses : [],
    last_active_at: data.last_active_at || null,
    read_announcement_ids: Array.isArray(data.read_announcement_ids) ? data.read_announcement_ids : [],
    ...data,
    id: (authUser && authUser.id) || (profile && profile.id) || '',
    email,
  };
}

async function fetchProfile(userId) {
  if (!userId) return null;
  const { data, error } = await supabase.from('profiles').select('id,data').eq('id', userId).maybeSingle();
  if (error) return null;
  return data;
}

export const authCompat = {
  async me() {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw new Error(sessionError.message);
    const session = sessionData && sessionData.session;
    if (!session || !session.user) {
      const err = new Error('Not authenticated');
      err.status = 401;
      throw err;
    }
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData || !userData.user) {
      const err = new Error('Not authenticated');
      err.status = 401;
      throw err;
    }
    const profile = await fetchProfile(userData.user.id);
    return profileToUser(userData.user, profile);
  },

  async isAuthenticated() {
    try {
      const { data } = await supabase.auth.getSession();
      return !!(data && data.session && data.session.user);
    } catch {
      return false;
    }
  },

  async loginViaEmailPassword(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return data;
  },

  async register({ email, password }) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    return data;
  },

  async verifyOtp({ email, otpCode }) {
    const { data, error } = await supabase.auth.verifyOtp({ email, token: otpCode, type: 'signup' });
    if (error) throw new Error(error.message);
    const accessToken = data && data.session && data.session.access_token;
    return { access_token: accessToken, ...(data || {}) };
  },

  async setToken() {
    // Session is already persisted by signIn/signUp/verifyOtp; kept for compat.
    return true;
  },

  async resendOtp(email) {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  async resetPasswordRequest(email) {
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  async resetPassword({ resetToken, newPassword }) {
    // Supabase recovery links carry a token_hash; Base44 carries ?token=.
    // Try to verify it first, then update the password.
    if (resetToken) {
      try {
        await supabase.auth.verifyOtp({ type: 'recovery', token_hash: resetToken });
      } catch {
        // fall through: session may already exist from email link
      }
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  async logout(redirect) {
    try {
      await supabase.auth.signOut();
    } finally {
      if (typeof redirect === 'string' && redirect && typeof window !== 'undefined') {
        window.location.href = redirect;
      }
    }
  },

  redirectToLogin(returnTo) {
    if (typeof window === 'undefined') return;
    const target = returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login';
    window.location.href = target;
  },

  async updateMe(updates) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData || !userData.user) throw new Error('Not authenticated');
    const user = userData.user;
    const patch = { ...(updates || {}) };
    // Keep auth metadata in sync for display name
    const metaPatch = {};
    if (patch.display_name || patch.full_name) {
      metaPatch.full_name = patch.display_name || patch.full_name;
    }
    if (Object.keys(metaPatch).length) {
      const { error } = await supabase.auth.updateUser({ data: metaPatch });
      if (error) throw new Error(error.message);
    }
    const existing = await fetchProfile(user.id);
    const merged = { ...((existing && existing.data) || {}), ...patch };
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, data: merged }, { onConflict: 'id' })
      .select('id,data')
      .single();
    if (error) throw new Error(error.message);
    return profileToUser(user, data);
  },

  async changePassword({ newPassword }) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  },
};

export const usersCompat = {
  // Client-side approval flow updates profiles directly (see manageUsers
  // service), so invites are a tolerant no-op that never breaks the UI.
  async inviteUser() {
    return { ok: true };
  },
};
