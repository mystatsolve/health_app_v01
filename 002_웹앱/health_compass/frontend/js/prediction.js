// 예측 요청을 입력 스냅샷과 연결하고, 같은 입력에 대한 동시 요청은 합친다.
import { predict } from './api.js';
import { hasCurrentPrediction, inputKey, setPrediction, state } from './state.js';

let pending = null;

export function ensurePrediction() {
  if (hasCurrentPrediction()) return Promise.resolve(state.prediction);

  const inputs = { ...state.inputs };
  const key = inputKey(inputs);
  if (pending?.key === key) return pending.promise;

  const promise = predict(inputs).then(out => {
    if (!setPrediction(out, inputs)) {
      throw new Error('입력이 바뀌었어요. 최신 입력으로 다시 시도해주세요.');
    }
    return out;
  }).finally(() => {
    if (pending?.key === key) pending = null;
  });
  pending = { key, promise };
  return promise;
}
