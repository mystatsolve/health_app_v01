// 2i 개선 제안
import { state } from '../state.js';
import { suggest } from '../api.js';
import { topbarHtml } from '../components/topbar.js';
import { esc, featureValue, multShort, pct } from '../format.js';

function summaryHtml(g) {
  return `<p class="effect-summary"><span class="effect-up">상승 ${g.increase_count}개</span> ·
    <span class="effect-down">하락 ${g.decrease_count}개</span> · 변화 없음 ${g.unchanged_count}개</p>`;
}
function effectsHtml(effects) {
  const changed = effects.filter(e => e.direction !== 'neutral');
  if (!changed.length) return '<p class="disclaimer">모델 출력의 변화가 없습니다.</p>';
  const sorted = [...changed].sort((a, b) => (a.direction === 'up' ? 0 : 1) - (b.direction === 'up' ? 0 : 1));
  return '<div class="sug-effects">' + sorted.map(e => `
    <div class="sug-effect ${e.direction}"><b>${e.direction === 'up' ? '↑ 상승' : '↓ 하락'} · ${esc(e.name)}${e.caution ? ' ⚠ 참고용' : ''}</b>
      <span>배수 ${multShort(e.mult_before)} → ${multShort(e.mult_after)}</span>
      <span>모델값 ${pct(e.prob_before)} → ${pct(e.prob_after)}
        (${e.delta > 0 ? '+' : '−'}${Math.abs(e.delta * 100) < 0.001 ? '0.001 미만' : Math.abs(e.delta * 100).toFixed(3)}%p)</span>
    </div>`).join('') + '</div>';
}

export function renderSuggest(el) {
  const out = state.prediction;
  if (!out) { location.hash = '#/'; return; }
  el.innerHTML = topbarHtml('#/suggest') + `
  <div class="page">
    <div class="page-date">입력값 민감도 시뮬레이션</div>
    <h1 class="serif" id="sug-head">모델 출력을 다시 계산하고 있어요…</h1>
    <p class="disclaimer" style="margin:-10px 0 22px">건강 목표는 일반적인 권장 기준과 비교한 참고 정보입니다.
      실제 치료·처방·생활습관 변경은 의료진과 상의하세요.</p>
    <div id="sug-body"></div>
  </div>`;

  const head = el.querySelector('#sug-head');
  const body = el.querySelector('#sug-body');
  const current = () => head.isConnected && !el.hidden && state.prediction === out;
  suggest({ ...state.inputs }).then(s => {
    if (!current()) return;
    const notice = `<div class="model-notice" role="note"><b>시뮬레이션 해석</b>
      ${esc(s.methodology)} ${esc(s.disclaimer)}</div>`;
    if (!s.suggestions.length) {
      head.innerHTML = `일반 권장 기준과 비교했을 때<br><em class="good">우선 표시할 입력이 없어요.</em>`;
      body.innerHTML = notice + (s.others.length ? othersHtml(s.others) : '');
      return;
    }
    const mixed = s.suggestions.some(g => g.increase_count > 0) || s.others.some(g => g.increase_count > 0);
    head.innerHTML = `${s.suggestions.length}개 입력의 변경 전후를 비교했어요.${mixed ? '<br><em>일부 질환의 모델 출력은 상승합니다.</em>' : ''}`;
    body.innerHTML = notice + s.suggestions.map(g => `
      <div class="card sug-card">
        <div class="sug-num">${g.priority}</div>
        <div>
          <h3>${esc(g.title)}</h3>
          <div class="sug-target">${esc(g.label)}
            <b>${esc(featureValue(state.meta, g.feature, g.current))} → ${esc(featureValue(state.meta, g.feature, g.target))}</b></div>
          <div class="sug-method">${esc(g.method)}</div>
          ${summaryHtml(g)}${effectsHtml(g.effects)}
        </div>
      </div>`).join('') + (s.others.length ? othersHtml(s.others) : '');
  }).catch(e => {
    if (current()) head.textContent = '제안 계산에 실패했어요: ' + (e.detail || e.message || '서버 오류');
  });
}

function othersHtml(others) {
  return `<div class="card sug-others"><b style="font-size:13px">그 밖에</b><ul>` +
    others.map(o => `<li><b>${esc(o.title)}</b> — ${esc(o.text)}
      ${o.effects.length ? summaryHtml(o) + `<details><summary>질환별 변화 모두 보기</summary>${effectsHtml(o.effects)}</details>` : ''}</li>`).join('') + `</ul></div>`;
}
