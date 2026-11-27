import { api } from './api.js';
import { SERVER_URL } from './config.js';
import { getUser, logout } from './auth.js';
import { escapeHTML, humanize } from './utils.js';

/* ---------- navbar ---------- */
const LOGO = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.4 2.4-2.1-.6-.6-2.1z"/></svg>';

export function renderNavbar(active) {
  const user = getUser();
  const links = [
    ['dashboard', '/pages/dashboard.html', 'Dashboard'],
    ['issues', '/pages/issues.html', 'Issues'],
    ['report', '/pages/issue-form.html', 'Report issue'],
    ['profile', '/pages/profile.html', 'Profile'],
  ];
  if (user?.role === 'admin') links.splice(3, 0, ['admin', '/pages/admin.html', 'Manage']);

  const host = document.querySelector('#navbar');
  host.className = 'site-header';
  host.innerHTML = `
    <div class="container">
      <a class="brand" href="/pages/dashboard.html"><span class="brand-mark">${LOGO}</span>FixItHub</a>
      <button class="nav-toggle" aria-expanded="false" aria-controls="nav">Menu</button>
      <nav class="nav" id="nav" aria-label="Main">
        ${links.map(([k, href, label]) => `<a href="${href}" ${k === active ? 'aria-current="page"' : ''}>${label}</a>`).join('')}
        <span class="who">${escapeHTML(user?.name || '')} (${escapeHTML(user?.role || '')})</span>
        <button class="link" id="logoutBtn">Log out</button>
      </nav>
    </div>`;
  const toggle = host.querySelector('.nav-toggle');
  toggle.addEventListener('click', () => {
    const open = host.querySelector('#nav').classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  host.querySelector('#logoutBtn').addEventListener('click', logout);
}

/* ---------- toast ---------- */
export function toast(message, type = 'success') {
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'toast-wrap';
    wrap.setAttribute('role', 'status');
    document.body.appendChild(wrap);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

/* ---------- confirm dialog (replaces window.confirm) ---------- */
export function confirmDialog(message, okLabel = 'Delete') {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'confirm';
    dlg.innerHTML = `<p>${escapeHTML(message)}</p>
      <div class="row"><button class="btn btn-ghost" value="cancel">Cancel</button>
      <button class="btn btn-danger" value="ok">${escapeHTML(okLabel)}</button></div>`;
    document.body.appendChild(dlg);
    dlg.addEventListener('click', (e) => {
      const v = e.target.closest('button')?.value;
      if (v) dlg.close(v);
    });
    dlg.addEventListener('close', () => { resolve(dlg.returnValue === 'ok'); dlg.remove(); });
    dlg.showModal();
  });
}

/* ---------- states ---------- */
export const loadingHTML = (text = 'Loading...') => `<div class="loading"><span class="spinner"></span>${escapeHTML(text)}</div>`;
export const emptyHTML = (title, text = '', action = '') =>
  `<div class="empty"><h3>${escapeHTML(title)}</h3><p>${escapeHTML(text)}</p>${action}</div>`;
export const errorHTML = (msg) => `<div class="error-box" role="alert">${escapeHTML(msg)}</div>`;

export function setBusy(btn, busy, busyText = 'Please wait...') {
  if (busy) { btn.dataset.label = btn.textContent; btn.textContent = busyText; }
  else btn.textContent = btn.dataset.label || btn.textContent;
  btn.disabled = busy;
}

/* ---------- field errors from the API ---------- */
export function showFieldErrors(form, err) {
  clearFieldErrors(form);
  let shown = false;
  (err.errors || []).forEach(({ field, msg }) => {
    const input = form.querySelector(`[name="${field}"]`);
    const slot = form.querySelector(`[data-error-for="${field}"]`);
    if (input) input.classList.add('invalid');
    if (slot) { slot.textContent = msg; shown = true; }
  });
  const alert = form.querySelector('.form-alert');
  if (alert) {
    alert.textContent = shown ? 'Please fix the highlighted fields.' : err.message;
    alert.classList.remove('hidden');
  }
}
export function clearFieldErrors(form) {
  form.querySelectorAll('.invalid').forEach((i) => i.classList.remove('invalid'));
  form.querySelectorAll('[data-error-for]').forEach((s) => { s.textContent = ''; });
  form.querySelector('.form-alert')?.classList.add('hidden');
}

/* ---------- badges / helpers ---------- */
export const statusBadge = (s) => `<span class="badge badge-${escapeHTML(s)}">${escapeHTML(humanize(s))}</span>`;
export const priorityLabel = (p) => `<span class="prio prio-${escapeHTML(p)}">${escapeHTML(humanize(p))} priority</span>`;
export const mediaUrl = (p) => (p ? (p.startsWith('http') ? p : `${SERVER_URL}${p}`) : '');

/* ---------- dropdown options from /meta (cached) ---------- */
let metaCache;
export async function loadMeta() {
  if (!metaCache) metaCache = (await api('/meta')).data;
  return metaCache;
}
export function fillSelect(select, values, placeholder, selected = '') {
  select.innerHTML = (placeholder !== undefined ? `<option value="">${escapeHTML(placeholder)}</option>` : '') +
    values.map((v) => `<option value="${escapeHTML(v)}" ${v === selected ? 'selected' : ''}>${escapeHTML(humanize(v))}</option>`).join('');
}

/* ---------- pagination ---------- */
export function renderPagination(container, pagination, onChange) {
  if (!pagination || pagination.pages <= 1) { container.innerHTML = ''; return; }
  const { page, pages, total } = pagination;
  container.innerHTML = `
    <button class="btn btn-ghost btn-sm" data-go="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Previous</button>
    <span class="info">Page ${page} of ${pages} (${total} total)</span>
    <button class="btn btn-ghost btn-sm" data-go="${page + 1}" ${page >= pages ? 'disabled' : ''}>Next</button>`;
  container.querySelectorAll('button[data-go]').forEach((b) =>
    b.addEventListener('click', () => onChange(Number(b.dataset.go))));
}

/* ---------- issue card (shared by dashboard + list) ---------- */
export function issueCardHTML(i, user) {
  const own = i.reportedBy && String(i.reportedBy._id) === String(user.id);
  return `
  <article class="issue-card" data-status="${escapeHTML(i.status)}">
    ${i.photo ? `<img class="issue-thumb" src="${escapeHTML(mediaUrl(i.photo))}" alt="Photo of the issue" loading="lazy">` : ''}
    <div class="issue-body">
      <div class="row">${statusBadge(i.status)} ${priorityLabel(i.priority)}</div>
      <h3><a href="/pages/issue.html?id=${escapeHTML(i._id)}">${escapeHTML(i.title)}</a></h3>
      <p>${escapeHTML(i.description)}</p>
      <div class="issue-meta">
        <span class="tag">${escapeHTML(humanize(i.category))}</span>
        <span class="tag">${escapeHTML(i.building)}</span>
        <span>${escapeHTML(i.department)}</span>
      </div>
      <div class="issue-foot">
        <span>${escapeHTML(i.reportedBy?.name || 'Unknown')} · ${i.commentCount} comment${i.commentCount === 1 ? '' : 's'}</span>
        <button class="upvote-btn" data-id="${escapeHTML(i._id)}" aria-pressed="${i.hasUpvoted}"
          ${own ? 'disabled title="You cannot upvote your own issue"' : 'title="Upvote"'}
          aria-label="Upvote, ${i.upvoteCount} so far">▲ <span class="count">${i.upvoteCount}</span></button>
      </div>
    </div>
  </article>`;
}

// wire up upvote buttons inside a container
export function bindUpvotes(container) {
  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('.upvote-btn');
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    try {
      const { data } = await api(`/issues/${btn.dataset.id}/upvote`, { method: 'POST' });
      btn.setAttribute('aria-pressed', String(data.upvoted));
      btn.querySelector('.count').textContent = data.upvoteCount;
    } catch (err) { toast(err.message, 'error'); }
    btn.disabled = false;
  });
}

export function renderFooter() {
  const f = document.querySelector('#footer');
  if (f) { f.className = 'site-footer'; f.innerHTML = '<div class="container">FixItHub · Campus Issue &amp; Maintenance Tracker</div>'; }
}

/* ---------- show/hide password buttons ---------- */
export function bindPasswordToggles() {
  document.querySelectorAll('.pw-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.toggle);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Hide' : 'Show';
    });
  });
}
