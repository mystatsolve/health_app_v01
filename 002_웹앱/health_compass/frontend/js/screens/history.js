// 2j 기록 추이 — SVG 시계열 (외부 라이브러리 없음)
import { state, getRecords, deleteRecord, clearAllData, saveUi, targetName, exportBackup, importBackup } from '../state.js';
import { clearApiCache } from '../api.js';
import { topbarHtml } from '../components/topbar.js';
import { esc, dateKo, multShort, featureValue } from '../format.js';
import { toast } from '../router.js';

const SERIES_COLORS = ['oklch(0.55 0.18 25)', 'oklch(0.55 0.15 250)', 'oklch(0.55 0.12 160)'];
const RANGES = { '6m': ['6개월', 183], '1y': ['1년', 366], 'all': ['전체', Infinity] };

function filterRecords(range) {
  const days = RANGES[range][1];
  const cutoff = Date.now() - days * 86400e3;
  return getRecords().filter(r => new Date(r.savedAt).getTime() >= cutoff);
}

// 배수 상위 3개 질환(마지막 기록 기준) 시리즈
function pickSeries(recs) {
  const last = recs[recs.length - 1];
  return [...last.results].filter(r => Number.isFinite(r.mult)).sort((a, b) => b.mult - a.mult).slice(0, 3).map(r => r.code);
}

function conditionKey(rec) {
  const age = rec.inputs.AGE;
  const group = age < 30 ? 0 : Math.min(7, Math.floor(age / 10));
  return JSON.stringify([rec.inputs.SEX, group, rec.modelVersion, Object.keys(rec.inputs).sort()]);
}
function dateTime(iso) {
  return new Date(iso).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function chartSvg(recs, codes) {
  const W = Math.max(600, recs.length * 64 + 70), H = 290, PAD = { l: 44, r: 26, t: 20, b: 48 };
  let maxY = 1.5;
  for (const rec of recs) for (const r of rec.results)
    if (codes.includes(r.code) && r.mult != null) maxY = Math.max(maxY, r.mult);
  maxY = Math.ceil(maxY + 0.5);
  const X = i => recs.length === 1 ? W / 2 : PAD.l + (W - PAD.l - PAD.r) * i / (recs.length - 1);
  const Y = m => PAD.t + (H - PAD.t - PAD.b) * (1 - m / maxY);

  let svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;min-width:${W}px;height:auto" role="group" aria-label="저장 순서별 배수 차트. 각 점에 초점을 맞추면 상세값을 볼 수 있습니다.">`;
  // 그리드 + y라벨
  const ticks = [...new Set([1, ...Array.from({ length: 5 }, (_, i) => maxY * (i + 1) / 5)])].sort((a, b) => a - b);
  for (const g of ticks) {
    svg += `<line x1="${PAD.l}" y1="${Y(g)}" x2="${W - PAD.r}" y2="${Y(g)}"
      stroke="rgba(31,42,36,${g === 1 ? .35 : .08})" stroke-width="1" ${g === 1 ? 'stroke-dasharray="4 4"' : ''}/>
      <text x="${PAD.l - 8}" y="${Y(g) + 4}" text-anchor="end" font-size="10" fill="rgba(31,42,36,.65)">${Number(g.toFixed(1))}x</text>`;
  }
  svg += `<text x="${PAD.l + 4}" y="${Y(1) - 5}" font-size="10" fill="rgba(31,42,36,.45)">평균 1.0</text>`;
  // x라벨
  recs.forEach((rec, i) => {
    const d = new Date(rec.savedAt);
    svg += `<text x="${X(i)}" y="${H - 24}" text-anchor="middle" font-size="10"
      fill="rgba(31,42,36,.65)">${d.getMonth() + 1}/${d.getDate()}
      <tspan x="${X(i)}" dy="15">${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}</tspan></text>`;
  });
  // 시리즈
  codes.forEach((code, ci) => {
    const pts = [];
    let previousKey = null, path = '';
    recs.forEach((rec, i) => {
      const r = rec.results.find(x => x.code === code);
      if (!r || !Number.isFinite(r.mult)) { previousKey = null; return; }
      const key = conditionKey(rec);
      const x = X(i), y = Y(r.mult);
      path += `${previousKey === key ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)} `;
      pts.push({ x, y, rec, result: r });
      previousKey = key;
    });
    if (pts.length < 1) return;
    svg += `<path d="${path}" fill="none" stroke="${SERIES_COLORS[ci]}" stroke-width="2.5" stroke-linecap="round"/>`;
    pts.forEach(p => {
      const label = `${dateTime(p.rec.savedAt)} · ${targetName(code)} ${multShort(p.result.mult)} · 입력 ${p.rec.inputCount}개`;
      svg += `<circle cx="${p.x}" cy="${p.y}" r="5" fill="${SERIES_COLORS[ci]}" tabindex="0" role="button"
        data-point="${esc(label)}" aria-label="${esc(label)}"><title>${esc(label)}</title></circle>`;
    });
  });
  return svg + '</svg>';
}

// 인접 두 기록의 변경·추가·제거 입력 (범주형은 라벨 사용)
function diffHtml(recs) {
  if (recs.length < 2) return '';
  const a = recs[recs.length - 2].inputs, b = recs[recs.length - 1].inputs;
  const rows = [];
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const f = state.meta.features[k];
    if (!f) continue;
    if (a[k] !== b[k]) {
      rows.push(`<div class="d-row"><span>${esc(f.label)}</span>
        <span>${esc(featureValue(state.meta, k, a[k]))} → <b>${esc(featureValue(state.meta, k, b[k]))}</b></span></div>`);
    }
  }
  if (!rows.length) return '';
  return `<div class="card hist-diff"><h3>함께 바뀐 수치 <span class="hint">(직전 기록 대비)</span></h3>${rows.join('')}</div>`;
}

function headline(recs, codes) {
  if (recs.length < 2) return `결과를 두 번 이상 저장하면<br>변화 추이를 볼 수 있어요.`;
  if (new Set(recs.map(conditionKey)).size > 1) return `저장된 결과 ${recs.length}회<br>비교 조건이 다른 기록이 있어요.`;
  const code = codes[0];
  const first = recs[0].results.find(r => r.code === code);
  const last = recs[recs.length - 1].results.find(r => r.code === code);
  if (!first || !last || first.mult == null || last.mult == null) return `저장된 결과 ${recs.length}회`;
  const nm = esc(targetName(code));
  const d = last.mult - first.mult;
  const verb = Math.abs(d) < 0.05 ? '비슷하게 유지됐어요.' : d < 0 ? '낮아졌어요.' : '높아졌어요.';
  return `${nm} 모델 배수가 저장 기록에서<br><em class="${d < 0 ? 'good' : ''}">${first.mult.toFixed(1)}배 → ${last.mult.toFixed(1)}배</em>로 ${verb}`;
}

export function renderHistory(el) {
  const range = state.ui.historyRange || 'all';
  const recs = filterRecords(range);
  const codes = recs.length ? pickSeries(recs) : [];

  el.innerHTML = topbarHtml('#/history') + `
  <div class="page">
    <div class="hist-toggle">${Object.entries(RANGES).map(([k, [lbl]]) =>
      `<button type="button" data-r="${k}" aria-pressed="${k === range}" class="${k === range ? 'on' : ''}">${lbl}</button>`).join('')}</div>
    <div class="page-date">${recs.length ? `${dateKo(recs[0].savedAt)} → ${dateKo(recs[recs.length - 1].savedAt)} · 결과 ${recs.length}회 저장` : ''}</div>
    <h1 class="serif">${recs.length ? headline(recs, codes) : '아직 저장된 결과가 없어요.'}</h1>
    ${recs.length ? `
    <div class="card hist-chart-box">
      <div class="lp-title">동성·동연령 평균 대비 배수</div>
      <div class="hist-legend">${codes.map((c, i) =>
        `<span><i class="sw" style="background:${SERIES_COLORS[i]}"></i>${esc(targetName(c))}</span>`).join('')}
        <span><i class="sw" style="background:rgba(31,42,36,.35)"></i>평균 1.0</span></div>
      <div class="hist-chart-scroll">${chartSvg(recs, codes)}</div>
      <div id="hist-point-details" role="status" class="hist-point-details">점에 마우스를 올리거나 눌러 정확한 날짜와 값을 확인하세요.</div>
      <p class="disclaimer">x축은 저장 순서이며 점 사이 간격은 동일합니다. 날짜 간격에 비례하지 않습니다.
        성별·연령군·입력 항목·모델 버전이 달라지면 선을 연결하지 않습니다. 같은 사람의 기록끼리 비교해주세요.
        ${recs.some(r => !r.modelVersion) ? '이전 버전에서 저장한 일부 기록은 모델 버전을 확인할 수 없습니다.' : ''}</p>
    </div>
    ${diffHtml(recs)}
    <div class="card hist-records">
      ${[...recs].reverse().map(r => `
        <div class="hist-rec">
          <span><b>${esc(dateTime(r.savedAt))}</b> <span class="meta">${r.inputs.AGE}세 ${r.inputs.SEX === 1 ? '남성' : '여성'} · 입력 ${r.inputCount}</span></span>
          <span class="meta">높음 ${r.results.filter(x => x.grade === 'high').length}개
            <button type="button" class="del" data-del="${esc(r.id)}" aria-label="${dateKo(r.savedAt)} 기록 삭제">삭제</button></span>
        </div>`).join('')}
    </div>` : `
    <div class="card hist-chart-box"><div class="hist-empty">결과 요약 화면에서 <b>이번 결과 저장</b>을 누르면<br>여기에 추이가 쌓여요. 기록은 이 브라우저에만 저장됩니다.</div></div>`}
    <p class="disclaimer">입력값과 저장 결과는 이 브라우저의 로컬 저장소에 남습니다.
      JSON 백업에는 저장한 기록의 건강 입력값과 결과가 포함됩니다. 가져오기는 기존 기록과 합치며 현재 입력은 바꾸지 않습니다.</p>
    <div class="hist-actions">
      <a class="btn" href="#/wizard/1" style="text-decoration:none;display:inline-block">새 결과 기록하기</a>
      <button type="button" class="btn secondary" id="export-records">JSON 내보내기</button>
      <button type="button" class="btn secondary" id="import-records">JSON 가져오기</button>
      <input type="file" id="import-file" accept=".json,application/json" hidden aria-label="기록 백업 JSON 파일">
      <button type="button" class="btn danger secondary" id="clear-all-data">내 입력·기록 전체 삭제</button>
    </div>
  </div>`;

  el.querySelectorAll('[data-point]').forEach(point => {
    for (const event of ['pointerenter', 'focus', 'click']) point.addEventListener(event, () => {
      el.querySelector('#hist-point-details').textContent = point.dataset.point;
    });
  });
  el.querySelector('#export-records').addEventListener('click', () => {
    const blob = new Blob([exportBackup()], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `건강나침반_기록_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  el.querySelector('#import-records').addEventListener('click', () => el.querySelector('#import-file').click());
  el.querySelector('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('백업 파일은 5MB 이하여야 합니다.');
      const added = importBackup(await file.text());
      toast(`${added}개 기록을 가져왔어요. 기존 기록은 유지했습니다.`);
      if (!el.hidden) renderHistory(el);
    } catch (error) { toast(error.message); }
    finally { e.target.value = ''; }
  });

  el.querySelector('.hist-toggle').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-r]');
    if (!b) return;
    state.ui.historyRange = b.dataset.r; saveUi();
    renderHistory(el);
  });
  el.querySelectorAll('button[data-del]').forEach(b => {
    b.addEventListener('click', () => {
      try {
        deleteRecord(b.dataset.del);
        toast('기록을 삭제했어요.');
        renderHistory(el);
      } catch (error) { toast(error.message); }
    });
  });
  el.querySelector('#clear-all-data').addEventListener('click', () => {
    if (!confirm('이 브라우저에 저장된 입력값, 예측 결과, 기록을 모두 삭제할까요?')) return;
    try {
      clearAllData();
      clearApiCache();
      toast('저장된 건강 데이터를 모두 삭제했어요.');
      location.hash = '#/';
    } catch (error) { toast(error.message); }
  });
}
