import { register, redirectIfAuthed } from '../auth.js';
import { bindPasswordToggles, setBusy, showFieldErrors, clearFieldErrors, loadMeta, fillSelect } from '../ui.js';

redirectIfAuthed();
bindPasswordToggles();

const form = document.querySelector('#registerForm');
loadMeta().then((m) => fillSelect(form.department, m.departments, 'Select department (optional)')).catch(() => {});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearFieldErrors(form);
  const payload = {
    name: form.name.value.trim(),
    email: form.email.value.trim(),
    password: form.password.value,
    department: form.department.value,
  };

  const errors = [];
  if (payload.name.length < 2) errors.push({ field: 'name', msg: 'Name must be at least 2 characters' });
  if (!/^\S+@\S+\.\S+$/.test(payload.email)) errors.push({ field: 'email', msg: 'Enter a valid email' });
  if (payload.password.length < 8 || !/[A-Za-z]/.test(payload.password) || !/\d/.test(payload.password)) {
    errors.push({ field: 'password', msg: 'Use at least 8 characters with a letter and a number' });
  }
  if (errors.length) return showFieldErrors(form, { errors, message: '' });

  const btn = form.querySelector('button[type="submit"]');
  setBusy(btn, true, 'Creating account...');
  try {
    await register(payload);
    location.href = '/pages/dashboard.html';
  } catch (err) {
    showFieldErrors(form, err);
    setBusy(btn, false);
  }
});
