import { api, toQuery } from '../api.js';
import { requireAuth } from '../auth.js';
import { renderNavbar, renderFooter, loadingHTML, errorHTML, emptyHTML, issueCardHTML, loadMeta, fillSelect, bindUpvotes } from '../ui.js';
import { humanize, escapeHTML } from '../utils.js';

const user = requireAuth();
renderNavbar('dashboard');
renderFooter();

const isAdmin = user.role === 'admin';
const $ = (s) => document.querySelector(s);
const charts = [];
const COLORS = { open: '#b42318', 'in-progress': '#d99a1c', resolved: '#1b7a4b' };
const PALETTE = ['#14202b', '#cf431a', '#2457a6', '#1b7a4b', '#d99a1c', '#7a5af8', '#5f6e7d', '#0e9384'];

$('#greeting').textContent = `Hello, ${user.name.split(' ')[0]}`;
$('#subtitle').textContent = isAdmin ? 'Campus-wide analytics across all reported issues.' : 'A summary of the issues you have reported.';

function statCard(cls, num, label) {
  return `<div class="stat ${cls}"><div class="num">${escapeHTML(num)}</div><div class="label">${escapeHTML(label)}</div></div>`;
}

function drawChart(id, config) {
  if (typeof Chart === 'undefined') return;
  const canvas = document.getElementById(id);
  if (canvas) charts.push(new Chart(canvas, config));
}

const chartCard = (id, title) => `<div class="card chart-card"><h3>${title}</h3><div class="chart-box"><canvas id="${id}" role="img" aria-label="${title}"></canvas></div></div>`;

async function load() {
  charts.splice(0).forEach((c) => c.destroy());
  $('#stats').innerHTML = loadingHTML('Loading statistics...');
  $('#charts').innerHTML = '';
  $('#recent').innerHTML = '';
  try {
    const query = isAdmin ? toQuery({ building: $('#fBuilding').value, category: $('#fCategory').value, department: $('#fDepartment').value }) : '';
    const { data } = await api(`/dashboard/stats${query ? `?${query}` : ''}`);
    const by = Object.fromEntries(data.byStatus.map((s) => [s._id, s.count]));

    $('#stats').className = `stats${isAdmin ? ' six' : ''}`;
    $('#stats').innerHTML =
      statCard('total', data.total, isAdmin ? 'Total issues' : 'Issues reported') +
      statCard('open', by.open, 'Open') +
      statCard('in-progress', by['in-progress'], 'In progress') +
      statCard('resolved', by.resolved, 'Resolved') +
      (isAdmin ? statCard('open', data.unassigned, 'Unassigned and unresolved') +
        statCard('total', data.avgResolutionHours === null ? 'n/a' : `${data.avgResolutionHours} h`, 'Average time to resolve') : '');

    if (data.total === 0) {
      $('#charts').innerHTML = '';
      $('#recent').innerHTML = emptyHTML('Nothing to show yet', isAdmin ? 'No issues match these filters.' : 'You have not reported any issues.',
        '<a class="btn btn-accent" href="/pages/issue-form.html">Report an issue</a>');
      return;
    }

    $('#charts').innerHTML =
      chartCard('cStatus', 'Issues by status') +
      chartCard('cCategory', 'Issues by category') +
      (isAdmin ? chartCard('cBuilding', 'Issues by building') + chartCard('cMonthly', 'Last 6 months') : '');

    drawChart('cStatus', {
      type: 'doughnut',
      data: { labels: data.byStatus.map((s) => humanize(s._id)), datasets: [{ data: data.byStatus.map((s) => s.count), backgroundColor: data.byStatus.map((s) => COLORS[s._id]) }] },
      options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } },
    });
    drawChart('cCategory', {
      type: 'bar',
      data: { labels: data.byCategory.map((s) => humanize(s._id)), datasets: [{ label: 'Issues', data: data.byCategory.map((s) => s.count), backgroundColor: PALETTE[1] }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
    });
    if (isAdmin) {
      drawChart('cBuilding', {
        type: 'bar',
        data: { labels: data.byBuilding.map((s) => s._id), datasets: [{ label: 'Issues', data: data.byBuilding.map((s) => s.count), backgroundColor: PALETTE[0] }] },
        options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } },
      });
      drawChart('cMonthly', {
        type: 'line',
        data: {
          labels: data.monthly.map((m) => m._id),
          datasets: [
            { label: 'Reported', data: data.monthly.map((m) => m.reported), borderColor: PALETTE[1], backgroundColor: PALETTE[1], tension: .3 },
            { label: 'Resolved', data: data.monthly.map((m) => m.resolved), borderColor: PALETTE[3], backgroundColor: PALETTE[3], tension: .3 },
          ],
        },
        options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
      });
    }

    // recent issues: reuse the full list endpoint so cards show upvotes/comments
    const recent = await api(`/issues?limit=3&sort=-createdAt${isAdmin ? '' : '&mine=true'}`);
    $('#recent').innerHTML = recent.data.map((i) => issueCardHTML(i, user)).join('');
  } catch (err) {
    $('#stats').className = '';
    $('#stats').innerHTML = errorHTML(err.message);
  }
}

bindUpvotes($('#recent'));

if (isAdmin) {
  $('#adminFilters').classList.remove('hidden');
  const meta = await loadMeta();
  fillSelect($('#fBuilding'), meta.buildings, 'All buildings');
  fillSelect($('#fCategory'), meta.categories, 'All categories');
  fillSelect($('#fDepartment'), meta.departments, 'All departments');
  ['#fBuilding', '#fCategory', '#fDepartment'].forEach((s) => $(s).addEventListener('change', load));
  $('#fReset').addEventListener('click', () => { $('#adminFilters').reset(); load(); });
}
load();
