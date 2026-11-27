import { API_URL } from './config.js';

// One place for every network call: adds the token, parses JSON, throws readable errors.
export async function api(path, { method = 'GET', body, isForm = false } = {}) {
  const token = localStorage.getItem('token');
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !isForm) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method, headers,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the server. Is the backend running?');
  }

  const data = await res.json().catch(() => ({}));

  const onAuthPage = /login\.html|register\.html/.test(location.pathname);
  if (res.status === 401 && token && !onAuthPage) {
    // token expired or user deactivated -> force login
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    location.href = '/pages/login.html';
  }

  if (!res.ok) {
    const err = new Error(data.message || 'Something went wrong');
    err.errors = data.errors || [];
    err.status = res.status;
    throw err;
  }
  return data;
}

export const toQuery = (obj) => {
  const q = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => { if (v !== '' && v !== undefined && v !== null && v !== false) q.set(k, v); });
  return q.toString();
};
