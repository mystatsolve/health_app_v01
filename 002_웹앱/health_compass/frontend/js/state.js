// 입력 스냅샷과 예측을 연결하고 저장할 때도 최신성을 확인한다.
const K_INPUTS = 'hc:v1:inputs';
const K_RECORDS = 'hc:v1:records';
const K_UI = 'hc:v1:ui';
const MAX_RECORDS = 100;
const DEFAULT_UI = { sortMode: 'mult', historyRange: 'all', detailTarget: null, bmiMode: 'auto' };

function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); return true; }
  catch { return false; }
}
function numericInputs(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([, v]) => typeof v === 'number' && Number.isFinite(v)));
}
function normalizedUi(value, inputs) {
  const ui = value && typeof value === 'object' ? value : {};
  return {
    sortMode: ['mult', 'prob'].includes(ui.sortMode) ? ui.sortMode : 'mult',
    historyRange: ['all', '6m', '1y'].includes(ui.historyRange) ? ui.historyRange : 'all',
    detailTarget: typeof ui.detailTarget === 'string' ? ui.detailTarget : null,
    // 이전 버전의 BMI는 직접 입력값으로 보존한다.
    bmiMode: ['auto', 'manual'].includes(ui.bmiMode) ? ui.bmiMode : inputs.HE_BMI != null ? 'manual' : 'auto',
  };
}
const storedInputs = numericInputs(lsGet(K_INPUTS, {}));
export const state = {
  meta: null, inputs: storedInputs, prediction: null, predictionKey: null,
  prevPrediction: null, changedKeys: [],
  ui: normalizedUi(lsGet(K_UI, null), storedInputs), storageError: false,
};
export function inputKey(inputs) {
  return JSON.stringify(Object.keys(inputs).sort().map(k => [k, inputs[k]]));
}
export function hasCurrentPrediction() {
  return Boolean(state.prediction && state.predictionKey === inputKey(state.inputs));
}
function invalidate() {
  if (state.prediction) state.prevPrediction = state.prediction;
  state.prediction = null;
  state.predictionKey = null;
}
function persistInputs() { state.storageError = !lsSet(K_INPUTS, state.inputs); }
function validInputs(value, meta) {
  const clean = {};
  for (const [code, v] of Object.entries(numericInputs(value))) {
    const spec = meta.features[code];
    if (!spec || (spec.min != null && v < spec.min) || (spec.max != null && v > spec.max)) continue;
    if ((code === 'AGE' || spec.integer) && !Number.isInteger(v)) continue;
    if (spec.choices && !spec.choices.some(c => Number(c.value) === v)) continue;
    clean[code] = v;
  }
  return clean;
}
export function sanitizeInputs(meta) {
  state.inputs = validInputs(state.inputs, meta);
  if (state.ui.bmiMode === 'auto') syncBmi();
  invalidate();
  persistInputs();
}
export function calculatedBmi() {
  const { HE_HT: ht, HE_WT: wt } = state.inputs;
  if (!(ht > 0 && wt > 0)) return null;
  const bmi = Math.round(10 * wt / ((ht / 100) ** 2)) / 10;
  const spec = state.meta?.features.HE_BMI || { min: 12, max: 60 };
  return bmi >= spec.min && bmi <= spec.max ? bmi : null;
}
function syncBmi() {
  const bmi = calculatedBmi();
  if (bmi == null) delete state.inputs.HE_BMI;
  else state.inputs.HE_BMI = bmi;
}
export function setBmiMode(mode) {
  state.ui.bmiMode = mode === 'manual' ? 'manual' : 'auto';
  saveUi();
  const before = inputKey(state.inputs);
  if (state.ui.bmiMode === 'auto') syncBmi();
  if (before !== inputKey(state.inputs)) invalidate();
  persistInputs();
}
export function setInput(code, value) {
  const before = inputKey(state.inputs);
  if (value === null || value === undefined || value === '') delete state.inputs[code];
  else state.inputs[code] = value;
  if (['HE_HT', 'HE_WT'].includes(code) && state.ui.bmiMode === 'auto') syncBmi();
  if (before !== inputKey(state.inputs)) invalidate();
  persistInputs();
}
export function setPrediction(out, inputs, changedKeys = []) {
  if (inputKey(inputs) !== inputKey(state.inputs)) return false;
  if (state.prediction) state.prevPrediction = state.prediction;
  state.prediction = out;
  state.predictionKey = inputKey(inputs);
  state.changedKeys = changedKeys;
  return true;
}
export function saveUi() { state.storageError = !lsSet(K_UI, state.ui); }
export function hasRequired() {
  return [1, 2].includes(state.inputs.SEX) && Number.isInteger(state.inputs.AGE)
    && state.inputs.AGE >= 19 && state.inputs.AGE <= 110;
}

function validateRecord(rec) {
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return null;
  if (typeof rec.id !== 'string' || !/^r_[\w-]{1,100}$/.test(rec.id)
      || typeof rec.savedAt !== 'string' || !Number.isFinite(Date.parse(rec.savedAt))) return null;
  if (!rec.inputs || typeof rec.inputs !== 'object' || Array.isArray(rec.inputs)) return null;
  const inputs = Object.fromEntries(Object.entries(numericInputs(rec.inputs)).sort(([a], [b]) => a.localeCompare(b)));
  if (Object.keys(inputs).length !== Object.keys(rec.inputs).length || Object.keys(inputs).length > 42) return null;
  if (state.meta && Object.keys(validInputs(inputs, state.meta)).length !== Object.keys(inputs).length) return null;
  if (![1, 2].includes(inputs.SEX) || !Number.isInteger(inputs.AGE)
      || inputs.AGE < 19 || inputs.AGE > 110) return null;
  if (!Array.isArray(rec.results) || !rec.results.length || rec.results.length > 14) return null;
  const seen = new Set();
  const results = [];
  for (const r of rec.results) {
    if (!r || typeof r.code !== 'string' || !/^[A-Z]{2}\d_DG$/.test(r.code) || seen.has(r.code)
        || !Number.isFinite(r.prob) || r.prob < 0 || r.prob > 1
        || !(r.base === null || (Number.isFinite(r.base) && r.base >= 0 && r.base <= 1))
        || !(r.mult === null || (Number.isFinite(r.mult) && r.mult >= 0))
        || ![null, 'low', 'mid', 'high'].includes(r.grade)) return null;
    seen.add(r.code);
    results.push({ code: r.code, prob: r.prob, base: r.base, mult: r.mult, grade: r.grade });
  }
  return {
    id: rec.id, savedAt: new Date(rec.savedAt).toISOString(), inputs, results,
    inputCount: Object.keys(inputs).length,
    imputedCount: Number.isInteger(rec.imputedCount) && rec.imputedCount >= 0 ? rec.imputedCount : null,
    modelVersion: typeof rec.modelVersion === 'string' ? rec.modelVersion.slice(0, 64) : null,
    appVersion: Number.isInteger(rec.appVersion) ? rec.appVersion : 1,
  };
}
export function getRecords() {
  const raw = lsGet(K_RECORDS, []);
  if (!Array.isArray(raw)) return [];
  return raw.map(validateRecord).filter(Boolean)
    .sort((a, b) => Date.parse(a.savedAt) - Date.parse(b.savedAt)).slice(-MAX_RECORDS);
}
function writeRecords(records) {
  if (!lsSet(K_RECORDS, records)) throw new Error('저장 공간이 부족하거나 브라우저 저장이 차단되어 있어요. JSON 백업을 확인해주세요.');
}
export function saveRecord() {
  if (!hasCurrentPrediction()) throw new Error('입력이 바뀌었어요. 최신 결과를 계산한 뒤 저장해주세요.');
  const rec = {
    id: 'r_' + (globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`),
    savedAt: new Date().toISOString(), inputs: { ...state.inputs },
    inputCount: state.prediction.provided_count, imputedCount: state.prediction.imputed_count,
    results: state.prediction.results.map(r => ({
      code: r.code, prob: r.prob, base: r.base, mult: r.mult, grade: r.grade,
    })),
    modelVersion: state.prediction.model_version || state.meta?.app.model_version || null, appVersion: 2,
  };
  const records = getRecords();
  if (records.length >= MAX_RECORDS) throw new Error('기록은 100개까지 보관할 수 있어요. JSON으로 백업하고 일부 기록을 삭제해주세요.');
  writeRecords([...records, rec]);
  return rec;
}
export function deleteRecord(id) { writeRecords(getRecords().filter(r => r.id !== id)); }
export function exportBackup() {
  return JSON.stringify({ format: 'health-compass', version: 1,
    exportedAt: new Date().toISOString(), records: getRecords() }, null, 2);
}
export function importBackup(text) {
  if (typeof text !== 'string' || text.length > 5 * 1024 * 1024) throw new Error('백업 파일은 5MB 이하여야 합니다.');
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('올바른 JSON 파일이 아닙니다.'); }
  if (data?.format !== 'health-compass' || data.version !== 1 || !Array.isArray(data.records)
      || data.records.length > MAX_RECORDS) throw new Error('지원하지 않는 백업 형식입니다.');
  const incoming = data.records.map(validateRecord);
  if (incoming.some(r => !r) || new Set(incoming.map(r => r.id)).size !== incoming.length)
    throw new Error('손상되었거나 중복된 기록이 있어 가져오지 않았습니다.');
  const existing = getRecords();
  const byId = new Map(existing.map(r => [r.id, r]));
  let added = 0;
  for (const rec of incoming) {
    const old = byId.get(rec.id);
    if (old && JSON.stringify(old) !== JSON.stringify(rec)) throw new Error('같은 ID에 다른 내용의 기록이 있어 가져오지 않았습니다.');
    if (!old) { byId.set(rec.id, rec); added++; }
  }
  if (byId.size > MAX_RECORDS) throw new Error('합치면 100개를 초과합니다. 기존 기록을 백업하고 일부 삭제한 뒤 다시 시도해주세요.');
  writeRecords([...byId.values()].sort((a, b) => Date.parse(a.savedAt) - Date.parse(b.savedAt)));
  return added;
}
export function clearAllData() {
  try { for (const key of [K_INPUTS, K_RECORDS, K_UI]) localStorage.removeItem(key); }
  catch { throw new Error('브라우저 저장소를 삭제하지 못했어요. 브라우저 설정을 확인해주세요.'); }
  state.inputs = {};
  state.prediction = null;
  state.predictionKey = null;
  state.prevPrediction = null;
  state.changedKeys = [];
  state.ui = { ...DEFAULT_UI };
}
export function targetName(code) {
  return state.meta?.targets.find(t => t.code === code)?.name || code;
}
export function targetCaution(code) {
  return state.meta?.targets.find(t => t.code === code)?.caution || false;
}
