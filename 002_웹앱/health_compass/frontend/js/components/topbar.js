// 2g~2j 공용 상단 탭 내비
import { state } from '../state.js';
import { whoLabel } from '../format.js';

const TABS = [
  ['#/results', '결과 요약'],
  ['#/detail', '질환별 상세'],
  ['#/suggest', '개선 제안'],
  ['#/history', '기록 추이'],
];

export function topbarHtml(active) {
  return `
  <div class="topbar">
    <a class="brand" href="#/" style="text-decoration:none">건강나침반</a>
    <nav aria-label="결과 화면">${TABS.map(([h, l]) =>
      `<a href="${h}" class="${h === active ? 'on' : ''}" ${h === active ? 'aria-current="page"' : ''}>${l}</a>`).join('')}</nav>
    <span class="who">${whoLabel(state)}</span>
    <a class="edit" href="#/wizard/1">정보 수정</a>
  </div>`;
}
