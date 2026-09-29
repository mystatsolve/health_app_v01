// 2a 온보딩
import { state, setInput, hasRequired } from '../state.js';
import { toast } from '../router.js';

export function renderOnboarding(el) {
  const m = state.meta;
  const sex = Number(state.inputs.SEX) || null;
  const age = Number.isFinite(Number(state.inputs.AGE)) ? state.inputs.AGE : '';
  el.innerHTML = `
  <div class="onb-wrap">
    <div class="onb-left">
      <div class="onb-brand">건강나침반</div>
      <h1 class="serif">성별과 나이,<br><em>두 가지만으로</em><br>시작할 수 있어요.</h1>
      <p class="onb-lede">${m.targets.length}개 질환의 의사진단 경험을 설문 자료로 학습한 모델 점수를 보여드려요.
        검진 수치나 생활습관을 입력하면 해당 정보도 계산에 반영됩니다.</p>
      <div class="onb-stats">
        <div class="onb-stat"><b>${m.targets.length}</b><span>예측 질환</span></div>
        <div class="onb-stat"><b>2 + ${m.app.input_total}</b><span>필수 + 선택 입력</span></div>
        <div class="onb-stat"><b>${m.app.derived_total}</b><span>자동 계산 특성</span></div>
      </div>
      <p class="disclaimer">결과는 미래 발병 확률이 아닌 위험 점수이며 진단을 대체하지 않습니다.
        입력은 계산을 위해 연결된 서버로 전송되며, 입력과 기록은 이 브라우저에 저장됩니다.
        기록 화면에서 백업하거나 삭제할 수 있습니다.</p>
    </div>
    <div class="onb-right">
      <div class="card onb-card">
        <h3>필수 정보</h3>
        <div class="field">
          <label>성별 <span class="req">*</span></label>
          <div class="seg" id="onb-sex" role="group" aria-label="성별">
            <button type="button" data-v="1" aria-pressed="${sex === 1}" class="${sex === 1 ? 'on' : ''}">남성</button>
            <button type="button" data-v="2" aria-pressed="${sex === 2}" class="${sex === 2 ? 'on' : ''}">여성</button>
          </div>
        </div>
        <div class="field">
          <label for="onb-age">만 나이 <span class="req">*</span> <span class="hint">19~110세</span></label>
          <input type="number" id="onb-age" min="19" max="110" step="1" value="${age}" required placeholder="예: 58">
        </div>
        <div class="onb-actions">
          <button type="button" class="btn" id="onb-go">바로 결과 보기</button>
          <button type="button" class="btn secondary" id="onb-detail">자세히 입력</button>
        </div>
        <p class="disclaimer">${Object.keys(state.inputs).length > 2 ? '저장된 추가 입력도 함께 반영합니다. 자세히 입력에서 수정할 수 있어요.' : '필수 정보만으로 바로 확인하거나 선택 항목을 더 입력할 수 있어요.'}</p>
        <p class="disclaimer">📄 결과지 자동 읽기는 준비 중입니다.</p>
      </div>
    </div>
  </div>`;

  el.querySelector('#onb-sex').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-v]');
    if (!b) return;
    setInput('SEX', Number(b.dataset.v));
    el.querySelectorAll('#onb-sex button').forEach(x => {
      x.classList.toggle('on', x === b);
      x.setAttribute('aria-pressed', String(x === b));
    });
  });
  el.querySelector('#onb-age').addEventListener('input', (e) => {
    const v = e.target.value;
    if (v !== '' && !e.target.checkValidity()) {
      e.target.setAttribute('aria-invalid', 'true');
      setInput('AGE', null);
      return;
    }
    e.target.removeAttribute('aria-invalid');
    setInput('AGE', v === '' ? null : Number(v));
  });
  function go(hash) {
    const ageInput = el.querySelector('#onb-age');
    if (!ageInput.checkValidity()) {
      ageInput.reportValidity();
      ageInput.focus();
      return;
    }
    if (!hasRequired()) { toast('성별과 만 나이(19~110세)를 입력해주세요.'); return; }
    location.hash = hash;
  }
  el.querySelector('#onb-go').addEventListener('click', () => go('#/results'));
  el.querySelector('#onb-detail').addEventListener('click', () => go('#/wizard/1'));
}
