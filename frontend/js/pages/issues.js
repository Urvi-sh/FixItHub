import { api, toQuery } from '../api.js';
import { requireAuth } from '../auth.js';
import { renderNavbar, renderFooter, loadingHTML, errorHTML, emptyHTML, issueCardHTML, loadMeta, fillSelect, bindUpvotes, renderPagination } from '../ui.js';
import { debounce } from '../utils.js';

const user = requireAuth();
renderNavbar('issues');
renderFooter();

const $ = (s) => document.querySelector(s);
const state = { page: 1, scope: new URLSearchParams(location.search).get('scope') || 'all' };

const meta = await loadMeta();
fillSelect($('#status'), meta.statuses, 'Any status');
fillSelect($('#category'), meta.categories, 'Any category');
fillSelect($('#building'), meta.buildings, 'Any building');
if (user.role === 'maintenance') $('#assignedTab').classList.remove('hidden');

function syncTabs() {
  document.querySelectorAll('#scopeTabs .tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.scope === state.scope)));
}

async function load() {
  syncTabs();
  $('#list').innerHTML = loadingHTML('Loading issues...');
  try {
    const query = toQuery({
      page: state.page, limit: 9,
      search: $('#search').value.trim(), status: $('#status').value, category: $('#category').value,
      building: $('#building').value, sort: $('#sort').value,
      mine: state.scope === 'mine', assignedToMe: state.scope === 'assigned',
    });
    const { data, pagination } = await api(`/issues?${query}`);
    $('#list').innerHTML = data.length
      ? data.map((i) => issueCardHTML(i, user)).join('')
      : emptyHTML('No issues found', 'Try clearing the filters, or report a new issue.', '<a class="btn btn-accent" href="/pages/issue-form.html">Report an issue</a>');
    renderPagination($('#pager'), pagination, (p) => { state.page = p; load(); window.scrollTo({ top: 0 }); });
  } catch (err) {
    $('#list').innerHTML = errorHTML(err.message);
    $('#pager').innerHTML = '';
  }
}

const reload = () => { state.page = 1; load(); };
$('#search').addEventListener('input', debounce(reload, 400));
['#status', '#category', '#building', '#sort'].forEach((s) => $(s).addEventListener('change', reload));
$('#filters').addEventListener('submit', (e) => e.preventDefault());
$('#scopeTabs').addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (tab) { state.scope = tab.dataset.scope; reload(); }
});
bindUpvotes($('#list'));
load();
