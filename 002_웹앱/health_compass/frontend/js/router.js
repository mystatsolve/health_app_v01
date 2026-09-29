// 해시 라우팅 + 토스트
import { hasRequired, hasCurrentPrediction } from './state.js';
import { ensurePrediction } from './prediction.js';
import { cancelLive } from './api.js';
import { renderOnboarding } from './screens/onboarding.js';
import { renderWizard } from './screens/wizard.js';
import { renderResults } from './screens/results.js';
import { renderDetail } from './screens/detail.js';
import { renderSuggest } from './screens/suggest.js';
import { renderHistory } from './screens/history.js';

const SCREENS = {
  onboarding: 'screen-onboarding',
  wizard: 'screen-wizard',
  results: 'screen-results',
  detail: 'screen-detail',
  suggest: 'screen-suggest',
  history: 'screen-history',
};

let toastTimer = null;
export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

function show(name) {
  for (const [k, id] of Object.entries(SCREENS)) {
    document.getElementById(id).hidden = (k !== name);
  }
  window.scrollTo(0, 0);
  return document.getElementById(SCREENS[name]);
}

let routeVersion = 0;
export async function route() {
  const version = ++routeVersion;
  const h = location.hash || '#/';
  cancelLive();
  const needPredict = ['#/results', '#/detail', '#/suggest'];
  const loading = document.getElementById('route-loading');
  if (loading) loading.hidden = true;
  if (needPredict.includes(h) && !hasCurrentPrediction()) {
    if (!hasRequired()) { location.hash = '#/'; return; }
    if (loading) loading.hidden = false;
    try { await ensurePrediction(); }
    catch (error) {
      if (version !== routeVersion) return;
      toast(error.message || '최신 결과를 계산하지 못했어요.');
      location.hash = '#/wizard/1';
      return;
    } finally { if (version === routeVersion && loading) loading.hidden = true; }
    if (version !== routeVersion || h !== location.hash) return;
  }
  if (h.startsWith('#/wizard/')) {
    const step = Math.min(5, Math.max(1, Number(h.split('/')[2]) || 1));
    if (!hasRequired()) { location.hash = '#/'; return; }
    renderWizard(show('wizard'), step);
  } else if (h === '#/results') {
    renderResults(show('results'));
  } else if (h === '#/detail') {
    renderDetail(show('detail'));
  } else if (h === '#/suggest') {
    renderSuggest(show('suggest'));
  } else if (h === '#/history') {
    renderHistory(show('history'));
  } else {
    renderOnboarding(show('onboarding'));
  }
}

export function startRouter() {
  window.addEventListener('hashchange', route);
  route();
}
