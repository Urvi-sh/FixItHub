import { api } from './api.js';

export const getUser = () => {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
};
export const saveUser = (u) => localStorage.setItem('user', JSON.stringify(u));
export const isLoggedIn = () => !!localStorage.getItem('token') && !!getUser();

export async function login(email, password) {
  const { data } = await api('/auth/login', { method: 'POST', body: { email, password } });
  localStorage.setItem('token', data.token);
  saveUser(data.user);
  return data.user;
}

export async function register(payload) {
  const { data } = await api('/auth/register', { method: 'POST', body: payload });
  localStorage.setItem('token', data.token);
  saveUser(data.user);
  return data.user;
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  location.href = '/pages/login.html';
}

// Call at the top of every private page. roles is optional, e.g. requireAuth(['admin']).
export function requireAuth(roles) {
  const user = getUser();
  if (!isLoggedIn()) { location.href = '/pages/login.html'; throw new Error('redirecting'); }
  if (roles && !roles.includes(user.role)) { location.href = '/pages/404.html'; throw new Error('redirecting'); }
  return user;
}

// Used on login/register: skip them if already signed in
export const redirectIfAuthed = () => { if (isLoggedIn()) location.href = '/pages/dashboard.html'; };
