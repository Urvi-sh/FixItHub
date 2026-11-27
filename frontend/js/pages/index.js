import { isLoggedIn } from '../auth.js';
import { renderFooter } from '../ui.js';

renderFooter();
if (isLoggedIn()) {
  document.querySelector('#cta').innerHTML = '<a class="btn btn-accent" href="/pages/dashboard.html">Go to dashboard</a>';
}
