// 2b~2f 입력 위저드 — meta.steps 데이터로 폼 생성
import { state, setInput, hasRequired, setBmiMode, calculatedBmi } from '../state.js';
import { ensurePrediction } from '../prediction.js';
import { renderLivePanel, refreshLive } from '../components/livePanel.js';
import { esc } from '../format.js';
import { toast } from '../router.js';

function fieldHtml(code) {
  const f = state.meta.features[code];
  if (!f) return '';
  const cur = state.inputs[code];
  const fieldId = `field-${code}`;
  const labelId = `label-${code}`;
  const req = f.required ? ' <span class="req">*</span>' : '';
  const unit = f.unit ? ` <span class="unit">${esc(f.unit)}</span>` : '';
  const hint = f.hint ? ` <span class="hint">${esc(f.hint)}</span>` : '';
  let control;
  if (f.type === 'radio') {
    control = `<div class="seg" data-code="${code}" role="group" aria-labelledby="${labelId}">` + f.choices.map(c =>
      `<button type="button" data-v="${c.value}" aria-pressed="${cur != null && Number(cur) === c.value}" class="${cur != null && Number(cur) === c.value ? 'on' : ''}">${esc(c.label)}</button>`
    ).join('') + `</div>`;
  } else if (f.type === 'select') {
    control = `<select id="${fieldId}" data-code="${code}" ${f.required ? 'required' : ''}>
      <option value="">모름 / 건너뛰기</option>` + f.choices.map(c =>
      `<option value="${c.value}" ${cur != null && Number(cur) === c.value ? 'selected' : ''}>${esc(c.label)}</option>`
    ).join('') + `</select>`;
  } else {
    control = `<input id="${fieldId}" type="number" data-code="${code}" min="${f.min}" max="${f.max}"
      step="${f.step}" value="${cur ?? ''}" ${f.required ? 'required' : ''} placeholder="모르면 비워두세요">`;
  }
  const note = f.note ? `<div class="note">${esc(f.note)}</div>` : '';
  const labelFor = f.type === 'radio' ? '' : ` for="${fieldId}"`;
  const bmiMode = code === 'HE_BMI' ? `<div class="bmi-mode" role="group" aria-label="BMI 입력 방식">
    <button type="button" data-bmi-mode="auto">자동 계산</button>
    <button type="button" data-bmi-mode="manual">직접 입력</button></div>` : '';
  return `<div class="field"><label id="${labelId}"${labelFor}>${esc(f.label)}${req}${unit}${hint}</label>${bmiMode}${control}${note}
    ${code === 'HE_BMI' ? '<div id="bmi-status" class="note" role="status"></div>' : ''}</div>`;
}

function updateBmi(el) {
  const input = el.querySelector('#field-HE_BMI');
  if (!input) return;
  const auto = state.ui.bmiMode === 'auto';
  input.readOnly = auto;
  input.value = state.inputs.HE_BMI ?? '';
  input.removeAttribute('aria-invalid');
  el.querySelectorAll('[data-bmi-mode]').forEach(button => {
    const active = button.dataset.bmiMode === state.ui.bmiMode;
    button.classList.toggle('on', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const computed = calculatedBmi();
  el.querySelector('#bmi-status').textContent = auto
    ? computed != null ? `신장·체중으로 계산한 BMI ${computed}` : '유효한 신장·체중을 입력하면 계산됩니다. 현재 BMI는 미입력입니다.'
    : `직접 입력한 BMI를 유지합니다.${computed != null ? ` 신장·체중 기준 계산값은 ${computed}입니다.` : ''}`;
}

// 영양 자동 계산 표시 (2f)
function nutriAutoHtml() {
  const i = state.inputs;
  const rows = [];
  if (i.N_NA > 0 && i.N_K > 0) {
    rows.push(['나트륨/칼륨 비', (i.N_NA / i.N_K).toFixed(2), '권장 1.0 미만']);
  }
  if (i.N_EN > 0) {
    for (const [lbl, src, m] of [['탄수화물 에너지비', 'N_CHO', 4], ['지방 에너지비', 'N_FAT', 9], ['단백질 에너지비', 'N_PROT', 4]]) {
      if (i[src] > 0) rows.push([lbl, Math.round(100 * i[src] * m / i.N_EN) + '%', '']);
    }
  }
  if (!rows.length) return '';
  return `<div class="wiz-optsec"><div class="optsec-head"><b>자동 계산</b></div>` +
    rows.map(([l, v, h]) =>
      `<div class="autocalc"><span>${l}</span><span><b>${v}</b> <span class="hint">${h}</span></span></div>`
    ).join('') + `</div>`;
}

export function renderWizard(el, stepId) {
  const steps = state.meta.steps;
  const step = steps.find(s => s.id === stepId) || steps[0];
  const isLast = step.id === steps.length;
  const nextLabel = isLast ? '최종 결과 보기' : `다음 · ${steps[step.id].title}`;

  let formHtml = step.features.map(fieldHtml).join('');
  if (step.id === 1) {
    const os = step.optional_section;
    formHtml += `<div class="wiz-optsec">
      <button type="button" class="optsec-head" id="optsec-toggle" aria-expanded="true" aria-controls="optsec-body"><b>${esc(os.title)}</b><span>선택 · ${os.features.length}개 · 접기/펼치기</span></button>
      <div id="optsec-body">${os.features.map(fieldHtml).join('')}</div>
    </div>`;
  }
  if (step.id === 3) {
    formHtml = `<div class="ocr-strip">📄 결과지 자동 읽기는 준비 중입니다. 검진 수치를 직접 입력해주세요.</div>` + formHtml;
  }
  if (step.id === 5) formHtml += `<div id="nutri-auto">${nutriAutoHtml()}</div>`;

  el.innerHTML = `
  <div class="wiz">
    <div class="wiz-left">
      <div class="wiz-brand"><a href="#/" style="color:inherit;text-decoration:none">건강나침반</a></div>
      <div class="wiz-head">
        <div class="wiz-progress">${steps.map(s => `<i class="${s.id <= step.id ? 'done' : ''}"></i>`).join('')}</div>
        <div class="wiz-steplabel">${step.id} / ${steps.length} · ${esc(step.title)}</div>
        <h1 class="serif">${esc(step.headline)}</h1>
        ${step.note ? `<div class="wiz-note">${esc(step.note)}</div>` : ''}
      </div>
      <div class="wiz-form">${formHtml}</div>
      <div class="wiz-nav">
        ${step.id > 1 ? `<button type="button" class="btn secondary" id="wiz-prev">이전</button>` : ''}
        <button type="button" class="btn" id="wiz-next">${esc(nextLabel)}</button>
      </div>
    </div>
    <aside class="wiz-right" aria-label="실시간 모델 추정">
      <button type="button" class="mobile-live-toggle" aria-expanded="false" aria-controls="live-panel">
        <span data-live-summary role="status">모델 추정 준비 중</span><span data-live-action>펼치기 ↑</span>
      </button>
      <div id="live-panel"></div>
    </aside>
  </div>`;

  updateBmi(el);
  const live = el.querySelector('#live-panel');
  renderLivePanel(live);
  if (state.prediction === null) refreshLive(live);

  // 입력 바인딩
  el.querySelector('.wiz-left').addEventListener('click', (e) => {
    const b = e.target.closest('.seg button[data-v]');
    if (!b) return;
    const code = b.parentElement.dataset.code;
    const was = b.classList.contains('on');
    b.parentElement.querySelectorAll('button').forEach(x => {
      x.classList.remove('on');
      x.setAttribute('aria-pressed', 'false');
    });
    if (was) { setInput(code, null); }           // 다시 누르면 해제
    else {
      b.classList.add('on');
      b.setAttribute('aria-pressed', 'true');
      setInput(code, Number(b.dataset.v));
    }
    refreshLive(live, code);
  });
  el.querySelectorAll('input[type=number][data-code]').forEach(inp => {
    inp.addEventListener('input', () => {
      const code = inp.dataset.code;
      if (inp.value !== '' && !inp.checkValidity()) {
        inp.setAttribute('aria-invalid', 'true');
        setInput(code, null);
        if (code === 'HE_HT' || code === 'HE_WT') updateBmi(el);
        refreshLive(live, code);
        return;
      }
      inp.removeAttribute('aria-invalid');
      setInput(code, inp.value === '' ? null : Number(inp.value));
      if (code === 'HE_HT' || code === 'HE_WT') {
        updateBmi(el);
      }
      if (step.id === 5) el.querySelector('#nutri-auto').innerHTML = nutriAutoHtml();
      refreshLive(live, code);
    });
  });
  el.querySelectorAll('select[data-code]').forEach(sel => {
    sel.addEventListener('change', () => {
      setInput(sel.dataset.code, sel.value === '' ? null : Number(sel.value));
      refreshLive(live, sel.dataset.code);
    });
  });

  el.querySelector('#optsec-toggle')?.addEventListener('click', () => {
    const body = el.querySelector('#optsec-body');
    body.hidden = !body.hidden;
    el.querySelector('#optsec-toggle').setAttribute('aria-expanded', String(!body.hidden));
  });
  el.querySelectorAll('[data-bmi-mode]').forEach(button => button.addEventListener('click', () => {
    setBmiMode(button.dataset.bmiMode);
    updateBmi(el);
    refreshLive(live, 'HE_BMI');
  }));
  el.querySelector('.mobile-live-toggle').addEventListener('click', (e) => {
    const open = el.querySelector('.wiz-right').classList.toggle('expanded');
    e.currentTarget.setAttribute('aria-expanded', String(open));
    el.querySelector('[data-live-action]').textContent = open ? '접기 ↓' : '펼치기 ↑';
  });
  el.querySelector('#wiz-prev')?.addEventListener('click', () => {
    location.hash = `#/wizard/${step.id - 1}`;
  });
  el.querySelector('#wiz-next').addEventListener('click', async (e) => {
    const invalid = el.querySelector('input:invalid, select:invalid');
    if (invalid) {
      invalid.reportValidity();
      invalid.focus();
      return;
    }
    if (!hasRequired()) {
      toast('성별과 만 나이는 필수입니다.'); return;
    }
    if (!isLast) { location.hash = `#/wizard/${step.id + 1}`; return; }
    const button = e.currentTarget;
    const hash = location.hash;
    button.disabled = true;
    button.textContent = '최신 입력으로 계산 중…';
    try {
      await ensurePrediction();
      if (location.hash === hash && el.contains(button)) location.hash = '#/results';
    } catch (error) { toast(error.message || '결과를 계산하지 못했어요.'); }
    finally { button.disabled = false; button.textContent = nextLabel; }
  });
}
