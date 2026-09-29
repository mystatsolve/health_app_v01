// API 래퍼 — 입력 스냅샷, 제한된 메모리 캐시, 진행 중 요청 병합
const BASE = '';
const CACHE_LIMIT = 64;
const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map();

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
function cachedPost(path, body, signal) {
  const snapshot = canonical(body);
  if (signal) return _post(path, snapshot, signal);
  const key = path + JSON.stringify(snapshot);
  const found = cache.get(key);
  if (found && Date.now() - found.at < CACHE_TTL) {
    cache.delete(key); cache.set(key, found);
    return found.promise.then(value => structuredClone(value));
  }
  cache.delete(key);
  const entry = { at: Date.now() };
  entry.promise = _post(path, snapshot).catch(error => {
    if (cache.get(key) === entry) cache.delete(key);
    throw error;
  });
  cache.set(key, entry);
  while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
  return entry.promise.then(value => structuredClone(value));
}
export function clearApiCache() { cache.clear(); cancelLive(); }

async function _post(path, body, signal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 15000);
  try {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(res.status, err.detail || res.statusText);
  }
  return await res.json();
  } catch (error) {
    if (controller.signal.aborted && !signal?.aborted) throw new ApiError(408, '계산 시간이 초과됐어요. 다시 시도해주세요.');
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

export class ApiError extends Error {
  constructor(status, detail) {
    const message = Array.isArray(detail) ? detail.map(x => x.msg || '입력 오류').join(' · ') : String(detail);
    super(message); this.status = status; this.detail = message;
  }
}

export async function getMeta() {
  const res = await fetch(BASE + '/api/meta');
  if (!res.ok) throw new ApiError(res.status, '앱 설정을 불러오지 못했습니다.');
  return res.json();
}

export const predict = (inputs, targets = null, signal = null) =>
  cachedPost('/api/predict', { inputs, targets }, signal);

export const contrib = async (inputs, target, topK = 8) => {
  // 요약(10개)과 상세(8개)가 같은 계산을 재사용한다.
  const out = await cachedPost('/api/contrib', { inputs, target, top_k: 20 });
  out.contribs = out.contribs.slice(0, topK);
  return out;
};

export const suggest = (inputs) => cachedPost('/api/suggest', { inputs });

// 실시간 패널용: debounce 300ms + 직전 요청 취소, 항상 마지막 값 기준으로만 콜백
let _timer = null;
let _ctrl = null;
let _sequence = 0;
export function cancelLive() {
  clearTimeout(_timer);
  if (_ctrl) { _ctrl.abort(); _ctrl = null; }
  ++_sequence;
}
export function predictLive(inputs, onResult, onError) {
  cancelLive();
  const snapshot = { ...inputs };
  const sequence = ++_sequence;
  _timer = setTimeout(async () => {
    _ctrl = new AbortController();
    try {
      const out = await predict(snapshot, null, _ctrl.signal);
      if (sequence === _sequence) onResult(out, snapshot);
    } catch (e) {
      if (sequence === _sequence && e.name !== 'AbortError' && onError) onError(e);
    }
  }, 300);
}
