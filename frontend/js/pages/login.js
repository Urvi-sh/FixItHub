import { login, redirectIfAuthed } from '../auth.js';
import { bindPasswordToggles, setBusy, showFieldErrors, clearFieldErrors } from '../ui.js';

redirectIfAuthed();
bindPasswordToggles();

const form = document.querySelector('#loginForm');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearFieldErrors(form);
  const email = form.email.value.trim();
  const password = form.password.value;

  // basic client-side validation (the server validates again)
  const errors = [];
  if (!/^\S+@\S+\.\S+$/.test(email)) errors.push({ field: 'email', msg: 'Enter a valid email' });
  if (!password) errors.push({ field: 'password', msg: 'Password is required' });
  if (errors.length) return showFieldErrors(form, { errors, message: '' });

  const btn = form.querySelector('button[type="submit"]');
  setBusy(btn, true, 'Logging in...');
  try {
    await login(email, password);
    location.href = '/pages/dashboard.html';
  } catch (err) {
    showFieldErrors(form, err);
    setBusy(btn, false);
  }
});
