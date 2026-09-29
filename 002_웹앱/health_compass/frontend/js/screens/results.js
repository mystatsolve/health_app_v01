// 2g 예측 결과 요약
import { state, saveRecord, saveUi } from '../state.js';
import { contrib } from '../api.js';
import { topbarHtml } from '../components/topbar.js';
import { riskCardsHtml } from '../components/riskCards.js';
import { esc, dateKo, GRADE_LABEL, featureValue } from '../format.js';
import { toast } from '../router.js';

function headlineHtml(out) {
  const high = out.results.filter(r => r.mult > 1 && !r.caution);
  if (!high.length) return `비교 가능한 일반 질환의 모델 점수가 관측 평균 <em class="good">이하</em>예요.`;
  const cardio = new Set(['DI3_DG', 'DI5_DG', 'DI6_DG', 'DI1_DG']);
  const meta = new Set(['DE1_DG', 'DI2_DG']);
  const hasC = high.some(r => cardio.has(r.code));
  const hasM = high.some(r => meta.has(r.code));
  let subject;
  if (hasC && hasM) subject = '심혈관·대사 질환';
  else if (hasC) subject = '심혈관 질환';
  else if (hasM) subject = '대사 질환';
  else subject = high.slice(0, 2).map(r => r.name).join('·');
  return `모델은 <em>${esc(subject)}</em> 점수를 동성·동연령 관측 평균보다 높게 계산했어요.`;
}

async function topInputsHtml(out) {
  // 상위 3개 질환에 contrib 호출 → 입력 제거 전후의 Σ|delta| 상위 4개
  const tops = out.results.filter(r => r.mult != null).slice(0, 3);
  const agg = {}; // code -> {label, sum, diseases:Set}
  try {
    const rs = await Promise.all(tops.map(t => contrib(state.inputs, t.code, 10)));
    rs.forEach((c, i) => {
      for (const item of c.contribs) {
        if (Math.abs(item.delta) < 1e-9) continue;
        agg[item.code] = agg[item.code] || { code: item.code, label: item.label, value: item.value, sum: 0, dz: [] };
        agg[item.code].sum += Math.abs(item.delta);
        agg[item.code].dz.push(tops[i].name);
      }
    });
  } catch { return '<p class="disclaimer">기여도 계산에 실패했어요.</p>'; }
  const rows = Object.values(agg).sort((a, b) => b.sum - a.sum).slice(0, 4);
  if (!rows.length) return '<p class="disclaimer">모델 출력이 민감하게 반응한 직접 입력이 뚜렷하지 않아요.</p>';
  return rows.map(r => `
    <div class="top-input">
      <b>${esc(r.label)} ${esc(featureValue(state.meta, r.code, r.value))}</b>
      <span>${esc(r.dz.slice(0, 2).join(' · '))}</span>
    </div>`).join('');
}

export function renderResults(el) {
  const out = state.prediction;
  if (!out) { location.hash = '#/'; return; }
  const sortMode = state.ui.sortMode || 'mult';
  const results = [...out.results];
  if (sortMode === 'prob') results.sort((a, b) => b.prob - a.prob);

  const counts = { high: 0, mid: 0, low: 0 };
  out.results.forEach(r => { if (r.grade) counts[r.grade]++; });
  const total = counts.high + counts.mid + counts.low || 1;

  const missing = out.imputed || [];
  const missingExam = missing.filter(c => (state.meta.features[c] || {}).group === 'exam').slice(0, 2);
  const missingNames = missingExam.map(c => state.meta.features[c].label).join('·');

  el.innerHTML = topbarHtml('#/results') + `
  <div class="page">
    <div class="page-date">${dateKo(new Date().toISOString())} 기준</div>
    <h1 class="serif">${headlineHtml(out)}</h1>
    <div class="model-notice" role="note"><b>해석 안내</b>
      이 값은 설문에서 의사진단 경험이 있다고 응답할 가능성을 학습한 모델 점수이며 미래 발병 확률이나 의료 진단이 아닙니다.
      내부 시간 분할로만 검증되었고 외부 임상 검증은 거치지 않았습니다.</div>
    <div class="res-grid">
      <div class="res-cards">
        <div class="sort-toggle">
          <button type="button" data-s="mult" aria-pressed="${sortMode === 'mult'}" class="${sortMode === 'mult' ? 'on' : ''}">배수 순</button>
          <button type="button" data-s="prob" aria-pressed="${sortMode === 'prob'}" class="${sortMode === 'prob' ? 'on' : ''}">확률 순</button>
        </div>
        <div id="result-cards">${riskCardsHtml(results, { topN: 4 })}</div>
        <p class="disclaimer" style="margin-top:14px">${esc(state.meta.disclaimer)}</p>
      </div>
      <div>
        <div class="card side-box">
          <h3>등급 분포</h3>
          <div class="dist-bar">
            <i class="hi" style="flex:${counts.high / total}"></i>
            <i class="mid" style="flex:${counts.mid / total}"></i>
            <i class="lo" style="flex:${counts.low / total}"></i>
          </div>
          <div class="dist-legend">
            <span><i class="dot" style="background:var(--hi)"></i>${GRADE_LABEL.high} ${counts.high}</span>
            <span><i class="dot" style="background:var(--mid)"></i>${GRADE_LABEL.mid} ${counts.mid}</span>
            <span><i class="dot" style="background:var(--lo)"></i>${GRADE_LABEL.low} ${counts.low}</span>
          </div>
        </div>
        <div class="card side-box">
          <h3>모델 출력이 민감했던 직접 입력</h3>
          <div id="top-inputs"><p class="disclaimer">계산 중…</p></div>
        </div>
        <div class="card side-box more-box">
          <h3>모델 입력 보완</h3>
          <p>아직 ${out.imputed_count}개 모델 특성이 대체값이에요.${missingNames ?
            ` ${esc(missingNames)}을(를) 추가하면 결과가 더 개인화됩니다.` : ''}</p>
          <a class="btn secondary" href="#/wizard/3" style="text-decoration:none;font-size:13px;padding:9px 16px">추가 입력 →</a>
        </div>
        <button type="button" class="btn" id="save-rec" style="width:100%">이번 결과 저장</button>
      </div>
    </div>
  </div>`;

  el.querySelector('.sort-toggle').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-s]');
    if (!b) return;
    state.ui.sortMode = b.dataset.s;
    saveUi();
    const sorted = [...out.results];
    if (b.dataset.s === 'prob') sorted.sort((a, b) => b.prob - a.prob);
    el.querySelector('#result-cards').innerHTML = riskCardsHtml(sorted, { topN: 4 });
    el.querySelectorAll('[data-s]').forEach(button => {
      button.classList.toggle('on', button === b);
      button.setAttribute('aria-pressed', String(button === b));
    });
  });
  el.querySelector('#save-rec').addEventListener('click', () => {
    try {
      saveRecord();
      toast('결과를 저장했어요. 기록 추이에서 확인할 수 있어요.');
    } catch (error) { toast(error.message); }
  });
  const box = el.querySelector('#top-inputs');
  topInputsHtml(out).then(html => {
    if (box.isConnected && !el.hidden && state.prediction === out) box.innerHTML = html;
  });
}
