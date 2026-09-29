// 2b~2f 공용 우측 실시간 결과 패널
import { state, setPrediction, hasRequired } from '../state.js';
import { predictLive, cancelLive } from '../api.js';
import { riskCardsHtml, computeDeltas } from './riskCards.js';
import { esc } from '../format.js';

// 헤드라인: 데이터 기반 요약 문구
function headline(out) {
  const inputs = out.provided_count;
  const sexKo = out.sex === 1 ? '남성' : '여성';
  const high = out.results.filter(r => r.mult > 1 && !r.caution);
  if (inputs <= 4) {
    return `입력값이 적어 <em>${out.age}세 ${sexKo}의 연령군 대체값</em>을 많이 사용한 모델 추정이에요.`;
  }
  if (high.length === 0) {
    return `비교 가능한 일반 질환의 모델 점수가 관측 평균 <em>이하</em>예요.`;
  }
  const names = high.slice(0, 2).map(r => r.name).join('·');
  return `모델은 <em>${esc(names)}</em> 점수를 동성·동연령 관측 평균보다 ${high[0].mult >= 3 ? '눈에 띄게' : '다소'} 높게 계산했어요.`;
}

function changedLine(deltas) {
  if (!deltas) return '입력하지 않은 항목에는 동성·동연령군의 대체값을 사용합니다.';
  const marks = [];
  for (const r of state.prediction.results) {
    if (deltas[r.code]) {
      marks.push(`<span class="${deltas[r.code]}">${esc(r.name)} ${deltas[r.code] === 'up' ? '▲' : '▼'}</span>`);
    }
    if (marks.length >= 3) break;
  }
  if (!marks.length) return '방금 입력은 결과를 거의 바꾸지 않았어요.';
  return '방금 바뀐 항목: ' + marks.join(' · ');
}

export function renderLivePanel(el) {
  const out = state.prediction;
  const summary = el.closest('.wiz-right')?.querySelector('[data-live-summary]');
  if (summary) summary.textContent = out
    ? `직접 입력 ${out.provided_count}/${state.meta.app.feature_total} · ${out.results.filter(r => r.grade === 'high').length}개 높음`
    : hasRequired() ? '최신 입력으로 계산 중…' : '성별·나이를 입력해주세요';
  if (!out || !hasRequired()) {
    el.innerHTML = `<div class="lp-title">실시간 모델 추정</div>
      <div class="lp-empty" role="status">${hasRequired() ? '최신 입력으로 계산 중…' : '성별과 19~110세의 만 나이를 입력하면 모델 추정값이 나타나요.'}</div>`;
    return;
  }
  const total = state.meta.app.feature_total;
  const deltas = computeDeltas(state.prevPrediction, out);
  el.innerHTML = `
    <div class="lp-title">실시간 모델 추정 · 직접 입력 ${out.provided_count} / ${total} · 자동 계산 ${out.derived_count}</div>
    <div class="lp-head">${headline(out)}</div>
    <div class="lp-sub">${changedLine(deltas)}</div>
    ${riskCardsHtml(out.results, { topN: 4, deltas })}`;
}

// 입력 변경 → debounce 예측 → 패널 갱신
export function refreshLive(el, changedKey = null) {
  if (!hasRequired()) {
    cancelLive();
    renderLivePanel(el);
    return;
  }
  renderLivePanel(el);
  predictLive(state.inputs, (out, snapshot) => {
    if (setPrediction(out, snapshot, changedKey ? [changedKey] : [])) renderLivePanel(el);
  }, (e) => {
    const summary = el.closest('.wiz-right')?.querySelector('[data-live-summary]');
    if (summary) summary.textContent = '계산 실패 · 입력 후 다시 시도';
    el.innerHTML = `<p class="disclaimer" role="alert">계산 실패: ${esc(e.detail || e.message || '서버 오류')}</p>`;
  });
}
