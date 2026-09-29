// 공통 포맷터
export const pct = (p) => Number.isFinite(p) ? (100 * p).toFixed(1) + '%' : '-';
export const mult = (m) => Number.isFinite(m) ? '×' + m.toFixed(2) : '-';
export const multShort = (m) => Number.isFinite(m) ? m.toFixed(2) + '배' : '계산 불가';

export function featureValue(meta, code, value) {
  if (!Number.isFinite(value)) return '-';
  const f = meta?.features[code];
  const choice = f?.choices?.find(c => Number(c.value) === value);
  if (choice) return choice.label;
  if (f?.choices) return '대체값';
  return `${Number(value.toFixed(2))}${f?.unit ? ' ' + f.unit : ''}`;
}

export const GRADE_LABEL = { high: '높음', mid: '보통', low: '낮음' };

export function gradeBadge(grade) {
  if (!Object.hasOwn(GRADE_LABEL, grade)) return `<span class="badge-grade none">-</span>`;
  return `<span class="badge-grade ${grade}">${GRADE_LABEL[grade]}</span>`;
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function dateKo(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function whoLabel(state) {
  const sex = Number(state.inputs.SEX) === 1 ? '남성' : '여성';
  const n = state.prediction?.provided_count ?? Object.keys(state.inputs).filter(k => state.meta?.features[k]).length;
  const total = state.meta ? state.meta.app.feature_total : 42;
  return `${state.inputs.AGE ?? '-'}세 ${state.inputs.SEX ? sex : '-'} · 입력 ${n}/${total}`;
}
