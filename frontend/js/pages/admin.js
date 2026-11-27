import { api, toQuery } from '../api.js';
import { requireAuth } from '../auth.js';
import { renderNavbar, renderFooter, toast, confirmDialog, loadingHTML, errorHTML, emptyHTML, loadMeta, fillSelect, renderPagination } from '../ui.js';
import { escapeHTML, humanize, debounce, formatDate } from '../utils.js';

const me = requireAuth(['admin']);
renderNavbar('admin');
renderFooter();

const $ = (s) => document.querySelector(s);
const meta = await loadMeta();
let staff = (await api('/users/staff')).data;
const iState = { page: 1 };
const uState = { page: 1 };

/* ---------- tabs ---------- */
$('#adminTabs').addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  document.querySelectorAll('#adminTabs .tab').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
  $('#issuesPanel').classList.toggle('hidden', tab.dataset.tab !== 'issues');
  $('#usersPanel').classList.toggle('hidden', tab.dataset.tab !== 'users');
  if (tab.dataset.tab === 'users') loadUsers(); else loadIssues();
});

/* ---------- issues ---------- */
fillSelect($('#aStatus'), meta.statuses, 'Any status');
fillSelect($('#aPriority'), meta.priorities, 'Any priority');
fillSelect($('#aBuilding'), meta.buildings, 'Any building');
fillSelect($('#aCategory'), meta.categories, 'Any category');
fillSelect($('#aDepartment'), meta.departments, 'Any department');
staff.forEach((s) => $('#aAssigned').insertAdjacentHTML('beforeend', `<option value="${escapeHTML(s._id)}">${escapeHTML(s.name)}</option>`));

const opts = (list, sel) => list.map((v) => `<option value="${escapeHTML(v)}" ${v === sel ? 'selected' : ''}>${escapeHTML(humanize(v))}</option>`).join('');

async function loadIssues() {
  $('#issueTable').innerHTML = loadingHTML('Loading issues...');
  try {
    const query = toQuery({
      page: iState.page, limit: 10, search: $('#aSearch').value.trim(), status: $('#aStatus').value, priority: $('#aPriority').value,
      building: $('#aBuilding').value, category: $('#aCategory').value, department: $('#aDepartment').value,
      assignedTo: $('#aAssigned').value, sort: $('#aSort').value,
    });
    const { data, pagination } = await api(`/issues?${query}`);
    if (!data.length) {
      $('#issueTable').innerHTML = emptyHTML('No issues match these filters');
      $('#issuePager').innerHTML = '';
      return;
    }
    $('#issueTable').innerHTML = `<div class="table-wrap"><table class="data">
      <thead><tr><th>Issue</th><th>Building</th><th>Status</th><th>Priority</th><th>Assigned to</th><th>Votes</th><th></th></tr></thead>
      <tbody>${data.map((i) => `<tr data-id="${escapeHTML(i._id)}">
        <td class="title-cell"><a href="/pages/issue.html?id=${escapeHTML(i._id)}">${escapeHTML(i.title)}</a><br>
          <span class="muted small">${escapeHTML(humanize(i.category))} · ${escapeHTML(i.department)} · ${escapeHTML(formatDate(i.createdAt))}</span></td>
        <td>${escapeHTML(i.building)}</td>
        <td><select data-field="status" aria-label="Status">${opts(meta.statuses, i.status)}</select></td>
        <td><select data-field="priority" aria-label="Priority">${opts(meta.priorities, i.priority)}</select></td>
        <td><select data-field="assignedTo" aria-label="Assigned to"><option value="">Unassigned</option>
          ${staff.map((s) => `<option value="${escapeHTML(s._id)}" ${i.assignedTo && i.assignedTo._id === s._id ? 'selected' : ''}>${escapeHTML(s.name)}</option>`).join('')}</select></td>
        <td>${i.upvoteCount}</td>
        <td><button class="btn btn-danger btn-sm" data-delete>Delete</button></td>
      </tr>`).join('')}</tbody></table></div>`;
    renderPagination($('#issuePager'), pagination, (p) => { iState.page = p; loadIssues(); });
  } catch (err) { $('#issueTable').innerHTML = errorHTML(err.message); }
}

$('#issueTable').addEventListener('change', async (e) => {
  const sel = e.target.closest('select[data-field]');
  if (!sel) return;
  const id = sel.closest('tr').dataset.id;
  try {
    await api(`/issues/${id}`, { method: 'PUT', body: { [sel.dataset.field]: sel.value } });
    toast('Issue updated');
  } catch (err) { toast(err.message, 'error'); loadIssues(); }
});
$('#issueTable').addEventListener('click', async (e) => {
  if (!e.target.closest('[data-delete]')) return;
  const id = e.target.closest('tr').dataset.id;
  if (!(await confirmDialog('Delete this issue and its comments?'))) return;
  try { await api(`/issues/${id}`, { method: 'DELETE' }); toast('Issue deleted'); loadIssues(); }
  catch (err) { toast(err.message, 'error'); }
});

const reloadIssues = () => { iState.page = 1; loadIssues(); };
$('#aSearch').addEventListener('input', debounce(reloadIssues, 400));
['#aStatus', '#aPriority', '#aBuilding', '#aCategory', '#aDepartment', '#aAssigned', '#aSort'].forEach((s) => $(s).addEventListener('change', reloadIssues));
$('#aFilters').addEventListener('submit', (e) => e.preventDefault());

/* ---------- users ---------- */
fillSelect($('#uRole'), meta.roles, 'Any role');

async function loadUsers() {
  $('#userTable').innerHTML = loadingHTML('Loading users...');
  try {
    const query = toQuery({ page: uState.page, limit: 10, search: $('#uSearch').value.trim(), role: $('#uRole').value });
    const { data, pagination } = await api(`/users?${query}`);
    if (!data.length) { $('#userTable').innerHTML = emptyHTML('No users found'); $('#userPager').innerHTML = ''; return; }
    $('#userTable').innerHTML = `<div class="table-wrap"><table class="data">
      <thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Role</th><th>Status</th><th></th></tr></thead>
      <tbody>${data.map((u) => {
        const self = u._id === me.id;
        return `<tr data-id="${escapeHTML(u._id)}">
        <td><strong>${escapeHTML(u.name)}</strong></td><td>${escapeHTML(u.email)}</td><td>${escapeHTML(u.department || '-')}</td>
        <td><select data-role ${self ? 'disabled' : ''} aria-label="Role">${opts(meta.roles, u.role)}</select></td>
        <td><span class="badge ${u.isActive ? 'badge-resolved' : 'badge-open'}">${u.isActive ? 'Active' : 'Deactivated'}</span></td>
        <td>${self ? '' : `<button class="btn btn-ghost btn-sm" data-toggle-active="${u.isActive}">${u.isActive ? 'Deactivate' : 'Activate'}</button>`}</td>
      </tr>`; }).join('')}</tbody></table></div>`;
    renderPagination($('#userPager'), pagination, (p) => { uState.page = p; loadUsers(); });
  } catch (err) { $('#userTable').innerHTML = errorHTML(err.message); }
}

$('#userTable').addEventListener('change', async (e) => {
  const sel = e.target.closest('select[data-role]');
  if (!sel) return;
  try {
    await api(`/users/${sel.closest('tr').dataset.id}/role`, { method: 'PUT', body: { role: sel.value } });
    toast('Role updated');
    staff = (await api('/users/staff')).data; // keep assign dropdowns in sync
  } catch (err) { toast(err.message, 'error'); loadUsers(); }
});
$('#userTable').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-toggle-active]');
  if (!btn) return;
  const makeActive = btn.dataset.toggleActive !== 'true';
  if (!makeActive && !(await confirmDialog('Deactivate this account? They will no longer be able to log in.', 'Deactivate'))) return;
  try {
    await api(`/users/${btn.closest('tr').dataset.id}/status`, { method: 'PUT', body: { isActive: makeActive } });
    toast(makeActive ? 'User activated' : 'User deactivated');
    loadUsers();
  } catch (err) { toast(err.message, 'error'); }
});
const reloadUsers = () => { uState.page = 1; loadUsers(); };
$('#uSearch').addEventListener('input', debounce(reloadUsers, 400));
$('#uRole').addEventListener('change', reloadUsers);
$('#uFilters').addEventListener('submit', (e) => e.preventDefault());

loadIssues();
