import { api } from '../api.js';
import { requireAuth, saveUser } from '../auth.js';
import { renderNavbar, renderFooter, toast, setBusy, showFieldErrors, clearFieldErrors, loadMeta, fillSelect, mediaUrl } from '../ui.js';
import { escapeHTML } from '../utils.js';

requireAuth();
renderNavbar('profile');
renderFooter();

const form = document.querySelector('#profileForm');
const pwForm = document.querySelector('#pwForm');
const box = document.querySelector('#avatarBox');

function showAvatar(u, previewUrl) {
  const src = previewUrl || mediaUrl(u.avatar);
  box.innerHTML = src
    ? `<img class="avatar" src="${escapeHTML(src)}" alt="Profile picture">`
    : `<div class="avatar avatar-fallback" aria-hidden="true">${escapeHTML((u.name || '?').charAt(0).toUpperCase())}</div>`;
}

const meta = await loadMeta();
async function fill() {
  const { data: u } = await api('/auth/me');
  form.name.value = u.name;
  form.email.value = u.email;
  form.phone.value = u.phone || '';
  fillSelect(form.department, meta.departments, 'Not set', u.department);
  showAvatar(u);
  saveUser(u);
  renderNavbar('profile');
}
fill().catch((e) => toast(e.message, 'error'));

form.avatar.addEventListener('change', () => {
  const f = form.avatar.files[0];
  if (!f) return;
  if (f.size > 3 * 1024 * 1024) {
    form.avatar.value = '';
    return showFieldErrors(form, { errors: [{ field: 'avatar', msg: 'Picture must be 3 MB or smaller' }], message: '' });
  }
  clearFieldErrors(form);
  showAvatar({ name: form.name.value }, URL.createObjectURL(f));
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearFieldErrors(form);
  if (form.name.value.trim().length < 2) {
    return showFieldErrors(form, { errors: [{ field: 'name', msg: 'Name must be at least 2 characters' }], message: '' });
  }
  const fd = new FormData();
  fd.append('name', form.name.value.trim());
  fd.append('department', form.department.value);
  fd.append('phone', form.phone.value.trim());
  if (form.avatar.files[0]) fd.append('avatar', form.avatar.files[0]);
  const btn = form.querySelector('button[type="submit"]');
  setBusy(btn, true, 'Saving...');
  try {
    const { data } = await api('/users/profile', { method: 'PUT', body: fd, isForm: true });
    saveUser(data);
    showAvatar(data);
    renderNavbar('profile');
    form.avatar.value = '';
    toast('Profile updated');
  } catch (err) { showFieldErrors(form, err); }
  setBusy(btn, false);
});

pwForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearFieldErrors(pwForm);
  const { currentPassword, newPassword } = pwForm;
  const errors = [];
  if (!currentPassword.value) errors.push({ field: 'currentPassword', msg: 'Enter your current password' });
  if (newPassword.value.length < 8 || !/[A-Za-z]/.test(newPassword.value) || !/\d/.test(newPassword.value)) {
    errors.push({ field: 'newPassword', msg: 'Use at least 8 characters with a letter and a number' });
  }
  if (errors.length) return showFieldErrors(pwForm, { errors, message: '' });
  const btn = pwForm.querySelector('button[type="submit"]');
  setBusy(btn, true, 'Updating...');
  try {
    await api('/auth/change-password', { method: 'PUT', body: { currentPassword: currentPassword.value, newPassword: newPassword.value } });
    pwForm.reset();
    toast('Password updated');
  } catch (err) { showFieldErrors(pwForm, err); }
  setBusy(btn, false);
});
