import { api } from '../api.js';
import { requireAuth } from '../auth.js';
import { renderNavbar, renderFooter, toast, setBusy, showFieldErrors, clearFieldErrors, loadMeta, fillSelect, mediaUrl } from '../ui.js';
import { getParam } from '../utils.js';

const user = requireAuth();
const id = getParam('id'); // present when editing
renderNavbar(id ? 'issues' : 'report');
renderFooter();

const form = document.querySelector('#issueForm');
const preview = document.querySelector('#preview');
const meta = await loadMeta();
fillSelect(form.category, meta.categories, 'Select category');
fillSelect(form.building, meta.buildings, 'Select building');
fillSelect(form.department, meta.departments, 'Select department', user.department);

if (id) {
  document.querySelector('#formTitle').textContent = 'Edit issue';
  document.querySelector('#saveBtn').textContent = 'Save changes';
  document.title = 'Edit issue | FixItHub';
  try {
    const { data: i } = await api(`/issues/${id}`);
    ['title', 'description', 'location'].forEach((k) => { form[k].value = i[k] || ''; });
    fillSelect(form.category, meta.categories, 'Select category', i.category);
    fillSelect(form.building, meta.buildings, 'Select building', i.building);
    fillSelect(form.department, meta.departments, 'Select department', i.department);
    if (i.photo) { preview.src = mediaUrl(i.photo); preview.classList.remove('hidden'); }
  } catch (err) {
    toast(err.message, 'error');
  }
}

form.photo.addEventListener('change', () => {
  const file = form.photo.files[0];
  if (!file) return preview.classList.add('hidden');
  if (file.size > 3 * 1024 * 1024) {
    form.photo.value = '';
    return showFieldErrors(form, { errors: [{ field: 'photo', msg: 'Photo must be 3 MB or smaller' }], message: '' });
  }
  clearFieldErrors(form);
  preview.src = URL.createObjectURL(file);
  preview.classList.remove('hidden');
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearFieldErrors(form);

  const errors = [];
  const v = (n) => form[n].value.trim();
  if (v('title').length < 5) errors.push({ field: 'title', msg: 'Title must be at least 5 characters' });
  if (v('description').length < 10) errors.push({ field: 'description', msg: 'Describe the problem in at least 10 characters' });
  ['category', 'building', 'department'].forEach((n) => { if (!form[n].value) errors.push({ field: n, msg: 'Please choose an option' }); });
  if (errors.length) return showFieldErrors(form, { errors, message: '' });

  const fd = new FormData();
  ['title', 'description', 'category', 'building', 'department', 'location'].forEach((n) => fd.append(n, v(n)));
  if (form.photo.files[0]) fd.append('photo', form.photo.files[0]);

  const btn = document.querySelector('#saveBtn');
  setBusy(btn, true, 'Saving...');
  try {
    const { data } = await api(id ? `/issues/${id}` : '/issues', { method: id ? 'PUT' : 'POST', body: fd, isForm: true });
    toast(id ? 'Issue updated' : 'Issue reported');
    setTimeout(() => { location.href = `/pages/issue.html?id=${data._id}`; }, 600);
  } catch (err) {
    showFieldErrors(form, err);
    setBusy(btn, false);
  }
});
