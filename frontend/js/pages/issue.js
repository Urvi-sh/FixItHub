import { api } from '../api.js';
import { requireAuth } from '../auth.js';
import { renderNavbar, renderFooter, toast, confirmDialog, errorHTML, statusBadge, priorityLabel, mediaUrl, loadMeta, fillSelect, bindUpvotes, setBusy } from '../ui.js';
import { escapeHTML, humanize, getParam, formatDate, formatDateTime, timeAgo } from '../utils.js';

const user = requireAuth();
renderNavbar('issues');
renderFooter();

const id = getParam('id');
const root = document.querySelector('#detail');
const isAdmin = user.role === 'admin';
let issue;
let staff = [];

if (!id) location.href = '/pages/issues.html';
const meta = await loadMeta();
if (isAdmin) staff = (await api('/users/staff')).data;

async function load() {
  try {
    issue = (await api(`/issues/${id}`)).data;
    document.title = `${issue.title} | FixItHub`;
    render();
    loadComments();
  } catch (err) {
    root.innerHTML = errorHTML(err.status === 404 ? 'This issue does not exist or was deleted.' : err.message);
  }
}

function render() {
  const i = issue;
  const own = String(i.reportedBy?._id) === String(user.id);
  const assignedToMe = i.assignedTo && String(i.assignedTo._id) === String(user.id);
  const canEdit = isAdmin || (own && i.status === 'open');
  const canDelete = isAdmin || own;
  const canSetStatus = isAdmin || (user.role === 'maintenance' && assignedToMe);

  root.innerHTML = `
  <div class="page-head">
    <div><p class="small"><a href="/pages/issues.html">All issues</a></p>
    <h1>${escapeHTML(i.title)}</h1>
    <div class="row">${statusBadge(i.status)} ${priorityLabel(i.priority)}</div></div>
    <div class="row">
      <button class="upvote-btn" data-id="${escapeHTML(i._id)}" aria-pressed="${i.hasUpvoted}" ${own ? 'disabled title="You cannot upvote your own issue"' : ''}>▲ Upvote <span class="count">${i.upvoteCount}</span></button>
      ${canEdit ? `<a class="btn btn-ghost btn-sm" href="/pages/issue-form.html?id=${escapeHTML(i._id)}">Edit</a>` : ''}
      ${canDelete ? '<button class="btn btn-danger btn-sm" id="deleteBtn">Delete</button>' : ''}
    </div>
  </div>

  <div class="two-col">
    <div>
      <div class="card">
        <p style="white-space:pre-wrap;overflow-wrap:anywhere">${escapeHTML(i.description)}</p>
        ${i.photo ? `<img class="detail-photo" src="${escapeHTML(mediaUrl(i.photo))}" alt="Photo attached to the issue">` : ''}
        <dl class="kv">
          <dt>Category</dt><dd>${escapeHTML(humanize(i.category))}</dd>
          <dt>Building</dt><dd>${escapeHTML(i.building)}${i.location ? `, ${escapeHTML(i.location)}` : ''}</dd>
          <dt>Department</dt><dd>${escapeHTML(i.department)}</dd>
          <dt>Reported by</dt><dd>${escapeHTML(i.reportedBy?.name || 'Unknown')} on ${escapeHTML(formatDate(i.createdAt))}</dd>
          <dt>Assigned to</dt><dd>${i.assignedTo ? escapeHTML(i.assignedTo.name) : '<span class="muted">Not assigned yet</span>'}</dd>
        </dl>
      </div>

      <div class="card" style="margin-top:1rem">
        <h2>Comments (<span id="commentTotal">${i.commentCount}</span>)</h2>
        <form id="commentForm">
          <div class="field"><label class="sr-only" for="commentText">Add a comment</label>
          <textarea class="input" id="commentText" maxlength="500" placeholder="Add a comment or extra detail" style="min-height:80px"></textarea>
          <div class="field-error" id="commentError"></div></div>
          <button class="btn btn-accent btn-sm" type="submit">Post comment</button>
        </form>
        <div id="comments"></div>
      </div>
    </div>

    <aside>
      ${canSetStatus ? `<form class="card" id="manageForm" style="margin-bottom:1rem">
        <h2>${isAdmin ? 'Manage issue' : 'Update status'}</h2>
        <div class="field"><label for="mStatus">Status</label><select class="input" id="mStatus"></select></div>
        ${isAdmin ? `<div class="field"><label for="mPriority">Priority</label><select class="input" id="mPriority"></select></div>
        <div class="field"><label for="mAssigned">Assigned to</label><select class="input" id="mAssigned"></select>
        ${staff.length ? '' : '<div class="hint">No maintenance staff yet. Promote a user to the maintenance role in the Manage page.</div>'}</div>` : ''}
        <button class="btn btn-block" type="submit">Save</button>
      </form>` : ''}

      <div class="card">
        <h2>Status history</h2>
        <ul class="timeline">
          ${(i.statusHistory || []).slice().reverse().map((h) => `<li><strong>${escapeHTML(humanize(h.status))}</strong><br>
            <span class="muted small">${escapeHTML(formatDateTime(h.changedAt))}${h.changedBy ? ` by ${escapeHTML(h.changedBy.name)}` : ''}</span></li>`).join('') || '<li class="muted">No history yet</li>'}
        </ul>
      </div>
    </aside>
  </div>`;

  bindUpvotes(root);
  root.querySelector('#deleteBtn')?.addEventListener('click', onDelete);
  root.querySelector('#commentForm').addEventListener('submit', onComment);

  const manage = root.querySelector('#manageForm');
  if (manage) {
    fillSelect(manage.querySelector('#mStatus'), meta.statuses, undefined, i.status);
    if (isAdmin) {
      fillSelect(manage.querySelector('#mPriority'), meta.priorities, undefined, i.priority);
      const sel = manage.querySelector('#mAssigned');
      sel.innerHTML = '<option value="">Unassigned</option>' +
        staff.map((s) => `<option value="${escapeHTML(s._id)}" ${i.assignedTo && i.assignedTo._id === s._id ? 'selected' : ''}>${escapeHTML(s.name)}</option>`).join('');
    }
    manage.addEventListener('submit', onManage);
  }
}

async function onManage(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const body = { status: form.querySelector('#mStatus').value };
  if (isAdmin) {
    body.priority = form.querySelector('#mPriority').value;
    body.assignedTo = form.querySelector('#mAssigned').value;
  }
  const btn = form.querySelector('button[type="submit"]');
  setBusy(btn, true, 'Saving...');
  try {
    await api(`/issues/${id}`, { method: 'PUT', body });
    toast('Issue updated');
    await load();
  } catch (err) { toast(err.message, 'error'); setBusy(btn, false); }
}

async function onDelete() {
  if (!(await confirmDialog('Delete this issue and all its comments? This cannot be undone.'))) return;
  try {
    await api(`/issues/${id}`, { method: 'DELETE' });
    toast('Issue deleted');
    setTimeout(() => { location.href = '/pages/issues.html'; }, 500);
  } catch (err) { toast(err.message, 'error'); }
}

async function loadComments() {
  const box = root.querySelector('#comments');
  try {
    const { data, pagination } = await api(`/issues/${id}/comments?limit=50`);
    root.querySelector('#commentTotal').textContent = pagination.total;
    box.innerHTML = data.length ? data.map((c) => `
      <div class="comment">
        <div class="comment-head"><span><strong>${escapeHTML(c.author?.name || 'Deleted user')}</strong>
          ${c.author && c.author.role !== 'student' ? `<span class="tag">${escapeHTML(c.author.role)}</span>` : ''} · ${escapeHTML(timeAgo(c.createdAt))}</span>
          ${(c.author && String(c.author._id) === String(user.id)) || isAdmin ? `<button class="btn btn-danger btn-sm" data-del="${escapeHTML(c._id)}">Delete</button>` : ''}</div>
        <p>${escapeHTML(c.text)}</p>
      </div>`).join('') : '<p class="muted" style="margin-top:1rem">No comments yet. Be the first to add one.</p>';
    box.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      if (!(await confirmDialog('Delete this comment?'))) return;
      try { await api(`/comments/${b.dataset.del}`, { method: 'DELETE' }); toast('Comment deleted'); loadComments(); }
      catch (err) { toast(err.message, 'error'); }
    }));
  } catch (err) { box.innerHTML = errorHTML(err.message); }
}

async function onComment(e) {
  e.preventDefault();
  const text = root.querySelector('#commentText');
  const errBox = root.querySelector('#commentError');
  errBox.textContent = '';
  if (!text.value.trim()) { errBox.textContent = 'Write something before posting'; return; }
  try {
    await api(`/issues/${id}/comments`, { method: 'POST', body: { text: text.value.trim() } });
    text.value = '';
    toast('Comment added');
    loadComments();
  } catch (err) { errBox.textContent = err.message; }
}

load();
