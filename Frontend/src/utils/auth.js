const AUTH_KEY = 'handytext_auth';
const WORKSPACE_KEY = 'handytext-workspace';
const HANDWRITING_KEY = 'handytext-handwriting';
const HANDWRITING_HISTORY_KEY = 'handytext-handwriting-history';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 1 day

function clearExpiredSession(authData) {
  if (!authData?.expires_at) {
    localStorage.removeItem(AUTH_KEY);
    window.dispatchEvent(new Event('storage'));
    return true;
  }

  if (Date.now() <= authData.expires_at) return false;

  localStorage.removeItem(AUTH_KEY);
  window.dispatchEvent(new Event('storage'));
  return true;
}

export function setLoggedIn(authData) {
  localStorage.removeItem(WORKSPACE_KEY);
  localStorage.removeItem(HANDWRITING_KEY);
  localStorage.removeItem(HANDWRITING_HISTORY_KEY);
  localStorage.setItem(AUTH_KEY, JSON.stringify({
    ...authData,
    expires_at: Date.now() + SESSION_DURATION_MS,
  }));
}

export function getLoggedInUser() {
  try {
    const data = localStorage.getItem(AUTH_KEY);
    if (!data) return null;
    const authData = JSON.parse(data);
    if (clearExpiredSession(authData)) return null;
    // Return the user object inside the auth data
    return authData.user || null;
  } catch {
    return null;
  }
}

export function updateLoggedInUser(updates) {
  try {
    const data = localStorage.getItem(AUTH_KEY);
    if (!data) return;
    const authData = JSON.parse(data);
    if (clearExpiredSession(authData)) return;
    if (authData.user) {
      authData.user = { ...authData.user, ...updates };
      localStorage.setItem(AUTH_KEY, JSON.stringify(authData));
      window.dispatchEvent(new Event('storage'));
    }
  } catch {
    // ignore
  }
}

export function getAccessToken() {
  try {
    const data = localStorage.getItem(AUTH_KEY);
    if (!data) return null;
    const authData = JSON.parse(data);
    if (clearExpiredSession(authData)) return null;
    return authData.access_token || null;
  } catch {
    return null;
  }
}

export function isLoggedIn() {
  return !!getLoggedInUser();
}

export function getSessionExpiresAt() {
  try {
    const data = localStorage.getItem(AUTH_KEY);
    if (!data) return null;
    const authData = JSON.parse(data);
    if (clearExpiredSession(authData)) return null;
    return authData.expires_at || null;
  } catch {
    return null;
  }
}

export function logout() {
  localStorage.removeItem(AUTH_KEY);
  window.dispatchEvent(new Event('storage'));
}
