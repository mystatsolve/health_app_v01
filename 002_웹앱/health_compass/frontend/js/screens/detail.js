// 2h 질환별 상세 리스크 — 기여도 + what-if 슬라이더
import { state, saveUi } from '../state.js';
import { contrib, predict } from '../api.js';
import { topbarHtml } from '../components/topbar.js';
import { pct, mult, multShort, gradeBadge, esc, featureValue } from '../format.js';

const DISEASE_GROUP = {
  DI1_DG: '순환기 질환', DI2_DG: '대사 질환', DE1_DG: '대사 질환', DI5_DG: '순환기 질환',
  DI3_DG: '순환기 질환', DI6_DG: '순환기 질환', DE2_DG: '내분비 질환', DF2_DG: '정신건강',
  DC1_DG: '암', DC7_DG: '암', DC5_DG: '암', DC3_DG: '암', DC6_DG: '암', DC2_DG: '암',
};

// what-if 대상: 사용자가 입력한 number형 특성 중 기여도 상위 2개
function whatifCandidates(contribData) {
  return contribData.contribs
    .filter(c => {
      const f = state.meta.features[c.code];
      return f && f.type === 'number' && c.delta > 0;
    })
    .slice(0, 2);
}

export function renderDetail(el) {
  const out = state.prediction;
  if (!out) { location.hash = '#/'; return; }
  let target = state.ui.detailTarget;
  if (!target || !out.results.some(r => r.code === target)) {
    target = out.results[0].code;
    state.ui.detailTarget = target; saveUi();
  }
  const r = out.results.find(x => x.code === target);

  el.innerHTML = topbarHtml('#/detail') + `
  <div class="page">
    <div class="det-grid">
      <div class="card det-list">
        <div class="lp-title" style="padding:6px 12px 2px">질환 선택</div>
        ${out.results.map(x => `
          <button type="button" data-t="${x.code}" aria-pressed="${x.code === target}" class="${x.code === target ? 'on' : ''}">
            <span>${esc(x.name)}${x.caution ? ' <span class="caution">⚠</span>' : ''}</span>
            <span>${multShort(x.mult)}</span>
          </button>`).join('')}
      </div>
      <div id="det-body">
        <div class="card det-hero">
          <div>
            <div style="margin-bottom:6px">${gradeBadge(r.grade)}
              <span class="hint" style="font-size:11.5px;color:var(--ink-faint)">${DISEASE_GROUP[r.code] || ''}</span></div>
            <div class="serif" style="font-size:24px;font-weight:700">${esc(r.name)}${r.caution ? ' <span class="caution">⚠ 참고용</span>' : ''}</div>
          </div>
          <div class="kv"><b>${pct(r.prob)}</b><span>모델 추정값</span></div>
          <div class="kv"><b style="color:var(--ink-soft)">${pct(r.base)}</b><span>${ageGroupLabel(out)} 평균</span></div>
          <div class="kv"><b style="color:${r.grade === 'high' ? 'var(--hi)' : 'var(--green-deep)'}">${mult(r.mult)}</b><span>관측 평균 대비 배수</span></div>
        </div>
        <div class="card det-sec">
          <h3>모델 점수와 관측 평균 비교</h3>
          ${positionBand(r)}
        </div>
        <div class="card det-sec">
          <h3>입력 민감도 — 직접 입력을 대체값으로 바꿨을 때</h3>
          <div id="det-contrib"><p class="disclaimer">계산 중…</p></div>
          <p class="disclaimer" style="margin:10px 0 0">빨강은 현재 입력이 모델 출력을 높인 경우, 초록은 낮춘 경우, 회색은 차이가 거의 없는 경우입니다.
            입력하지 않아 대체값이 사용된 항목은 나오지 않습니다. 기여도 합계가 예측값이 되는 설명 방식은 아닙니다.</p>
        </div>
        <div class="card det-sec" id="det-whatif" hidden>
          <h3>입력값을 바꾸면 모델 출력은?</h3>
          <p class="sim-notice">선택한 값을 함께 바꾸고 나머지 입력은 고정하는 민감도 시뮬레이션입니다.
            생활습관 변화의 실제 효과·인과관계·치료 효과를 뜻하지 않습니다.</p>
          <div id="whatif-rows"></div>
          <div class="whatif-result">변경 후 모델 추정값
            <b id="whatif-out">${pct(r.prob)}</b><span id="whatif-note" class="hint"></span></div>
        </div>
      </div>
    </div>
  </div>`;

  el.querySelector('.det-list').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-t]');
    if (!b) return;
    state.ui.detailTarget = b.dataset.t; saveUi();
    renderDetail(el);
  });

  loadContribAndWhatif(el, r);
}

function ageGroupLabel(out) {
  const lo = [null, '19~29세', '30대', '40대', '50대', '60대', '70세 이상'][out.age_group];
  return `${lo} ${out.sex === 1 ? '남성' : '여성'}`;
}

function positionBand(r) {
  return [['모델 점수', r.prob], ['동성·동연령 관측 평균', r.base]].map(([label, value]) => `
    <div class="comparison-row"><span>${label}</span><b>${pct(value)}</b>
      <div class="comparison-track"><i style="width:${Number.isFinite(value) ? Math.min(100, Math.max(0, value * 100)) : 0}%"></i></div></div>`).join('')
    + '<p class="disclaimer">막대는 0~100% 범위의 값 비교입니다. 또래 내 백분위나 개인별 분포를 뜻하지 않습니다.</p>'
    + (r.mult == null ? '<p class="disclaimer">관측 평균이 없거나 0이어서 배수를 계산할 수 없습니다.</p>' : '');
}

async function loadContribAndWhatif(el, r) {
  const box = el.querySelector('#det-contrib');
  const prediction = state.prediction;
  const snapshot = { ...state.inputs };
  const current = () => !el.hidden && box.isConnected && state.prediction === prediction;
  let c;
  try {
    c = await contrib(snapshot, r.code, 8);
  } catch (e) {
    if (current()) box.innerHTML = `<p class="disclaimer">기여도 계산 실패: ${esc(e.detail || e.message || '')}</p>`;
    return;
  }
  if (!current()) return;
  const maxD = Math.max(...c.contribs.map(x => Math.abs(x.delta)), 1e-9);
  box.innerHTML = c.contribs.length ? c.contribs.map(x => `
    <div class="contrib-row">
      <span>${esc(x.label)} <b>${esc(featureValue(state.meta, x.code, x.value))}</b>
        <small class="replacement">대체값: ${esc(featureValue(state.meta, x.code, x.replaced_with))}</small></span>
      <div class="bar-wrap"><div class="bar ${x.direction}" style="width:${50 * Math.abs(x.delta) / maxD}%"></div></div>
      <span class="dv ${x.direction}">${(100 * x.delta > 0 ? '+' : '')}${(100 * x.delta).toFixed(2)}%p</span>
    </div>`).join('')
    : `<p class="disclaimer">직접 입력한 항목이 없어 기여도를 계산할 수 없어요. 위저드에서 값을 입력해보세요.</p>`;

  // what-if
  const cands = whatifCandidates(c);
  if (!cands.length) return;
  const wi = el.querySelector('#det-whatif');
  wi.hidden = false;
  const rows = el.querySelector('#whatif-rows');
  rows.innerHTML = cands.map(x => {
    const f = state.meta.features[x.code];
    const cur = x.value;
    const lo = Math.max(f.min, Math.round(cur * 0.5));
    const hi = Math.min(f.max, Math.round(cur * 1.2));
    return `
    <div class="whatif-row">
      <span>${esc(f.label)}</span>
      <input type="range" data-w="${x.code}" aria-label="${esc(f.label)} 변경값" min="${lo}" max="${hi}" step="${f.step}" value="${cur}">
      <span class="whatif-val"><span id="wv-${x.code}">${cur}</span> ${esc(f.unit || '')}</span>
    </div>`;
  }).join('');

  let timer = null;
  let requestVersion = 0;
  rows.addEventListener('input', (e) => {
    const inp = e.target.closest('input[data-w]');
    if (!inp) return;
    const version = ++requestVersion;
    el.querySelector(`#wv-${inp.dataset.w}`).textContent = inp.value;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (!current()) return;
      const mod = { ...snapshot };
      rows.querySelectorAll('input[data-w]').forEach(i => { mod[i.dataset.w] = Number(i.value); });
      try {
        const out2 = await predict(mod, [r.code]);
        if (version !== requestVersion || !current()) return;
        const p2 = out2.results[0].prob;
        const outEl = el.querySelector('#whatif-out');
        if (outEl) {
          outEl.textContent = pct(p2);
          el.querySelector('#whatif-note').textContent =
            ` (기존 모델값 ${pct(r.prob)} → ${p2 < r.prob ? '↓ 낮아짐' : p2 > r.prob ? '↑ 높아짐' : '변화 없음'})`;
        }
      } catch (error) {
        if (version === requestVersion && current()) el.querySelector('#whatif-note').textContent = '계산 실패: ' + (error.detail || error.message);
      }
    }, 250);
  });
}
