// 진입점 — meta 로드 후 라우터 시작
import { getMeta } from './api.js';
import { sanitizeInputs, state } from './state.js';
import { startRouter } from './router.js';

(async function init() {
  try {
    state.meta = await getMeta();
    sanitizeInputs(state.meta);
  } catch (e) {
    document.body.innerHTML = `<div style="padding:60px;text-align:center;font-family:sans-serif">
      <h2>서버에 연결할 수 없어요</h2>
      <p>run.bat으로 서버를 실행한 뒤 새로고침해주세요.</p></div>`;
    return;
  }
  startRouter();
})();
