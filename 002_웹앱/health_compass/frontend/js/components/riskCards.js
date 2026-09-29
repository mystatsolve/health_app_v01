// 질환 카드/리스트 렌더 — livePanel(2b~2f)·results(2g) 공용
import { pct, multShort, gradeBadge, esc } from '../format.js';

// 상위 N개 카드 + 나머지 리스트 HTML
export function riskCardsHtml(results, { topN = 4, deltas = null } = {}) {
  const top = results.slice(0, topN);
  const rest = results.slice(topN);
  let html = top.map(r => `
    <div class="risk-card">
      <div class="r1">
        <span class="name">${esc(r.name)}${r.caution ? ' <span class="caution" title="학습 표본이 적어 참고용">⚠</span>' : ''}</span>
        <span class="p" title="모델 추정값">모델 ${pct(r.prob)}</span>
      </div>
      <div class="r2">
        <span>${gradeBadge(r.grade)}</span>
        <span>또래 관측 평균 ${pct(r.base)} · ${multShort(r.mult)}${deltaMark(deltas, r.code)}</span>
      </div>
    </div>`).join('');
  if (rest.length) {
    html += `<div class="risk-rest"><div class="rest-title">나머지 질환</div>` +
      rest.map(r => `
        <div class="risk-row">
          <span class="nm">${esc(r.name)}${r.caution ? ' <span class="caution">⚠</span>' : ''}</span>
          <span class="vals">모델 ${pct(r.prob)} · ${multShort(r.mult)}${deltaMark(deltas, r.code)}</span>
        </div>`).join('') + `</div>`;
  }
  return html;
}

function deltaMark(deltas, code) {
  if (!deltas) return '';
  const d = deltas[code];
  if (d === 'up') return ' <span class="delta-up">▲</span>';
  if (d === 'down') return ' <span class="delta-down">▼</span>';
  return '';
}

// 직전 예측과 비교해 질환별 ▲▼ 계산 (prob 기준, 0.1%p 이상 변화만)
export function computeDeltas(prev, cur) {
  if (!prev || !cur) return null;
  if (prev.sex !== cur.sex || prev.age_group !== cur.age_group || prev.model_version !== cur.model_version) return null;
  const prevMap = Object.fromEntries(prev.results.map(r => [r.code, r.prob]));
  const out = {};
  for (const r of cur.results) {
    const p0 = prevMap[r.code];
    if (p0 == null) continue;
    if (r.prob - p0 > 0.001) out[r.code] = 'up';
    else if (p0 - r.prob > 0.001) out[r.code] = 'down';
  }
  return out;
}
