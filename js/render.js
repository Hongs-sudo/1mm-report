// 보고서 지면 — 시안① PDF와 같은 양식
// 같은 함수가 작성 화면(입력칸)과 인쇄(글자)를 함께 그려서, 쓰는 모습이 곧 인쇄되는 모습이 되게 합니다.
import { esc, nl2br } from './util.js';
import { Q, INTRO, PAGE3_Q, sums, teacherLine, normalize, bookLine } from './schema.js';

const LOGO_H = 'img/logo_h.png';
const LOGO_V = 'img/logo_v.png';
const CONTACT = '상담 및 등록문의 010.3358.9007 · 02.2651.7750';
const ATT_F = ['sessions', 'present', 'late', 'absent', 'nomk', 'muAbsent', 'muProgress'];

const dash = v => (v === '' || v == null ? '' : esc(v));
const nn = v => (v === '' || v == null ? '–' : esc(v));
const pct = v => Math.max(0, Math.min(100, Number(v) || 0));
function scoreText(a, b) { return [a, b].filter(Boolean).map(esc).join(' / '); }
const tgCls = r => (r === '담임' ? '' : ' s');

/* =========================================================
   지면 4쪽 (표지 · 1 · 2 · 3)
   edit=true 이면 입력칸과 고르기 버튼, false 이면 인쇄용 글자
   ========================================================= */
export function sheetPages(report, { edit = false } = {}) {
  const d = normalize(report.data);
  const E = edit;
  const S = sums(d);
  const T = d.teachers;
  const multi = T.length > 1;

  // 입력칸 도구
  const f = (k, ph = '', cls = '', style = '') => E
    ? `<input class="e ${cls}" data-k="${k}" value="${esc(d[k] ?? '')}" placeholder="${esc(ph)}"${style ? ` style="${style}"` : ''}>`
    : dash(d[k]);
  const fa = (k, ph = '', rows = 2) => E
    ? `<textarea class="e" data-k="${k}" rows="${rows}" placeholder="${esc(ph)}">${esc(d[k] ?? '')}</textarea>`
    : nl2br(d[k] || '');
  const ft = (i, k, ph = '', cls = 'num', style = '') => E
    ? `<input class="e ${cls}" data-t="${i}" data-f="${k}" value="${esc(T[i][k] ?? '')}" placeholder="${esc(ph)}"${cls === 'num' ? ' inputmode="numeric"' : ''}${style ? ` style="${style}"` : ''}>`
    : nn(T[i][k]);
  const pair2 = (a, b) => E ? `<div class="s-two">${a}${b}</div>` : [a, b].filter(Boolean).join(' / ');
  const x = (attrs, label) => E ? `<button type="button" class="s-x" ${attrs}>${label}</button>` : '';
  const sumv = k => `<span data-sum="${k}">${S[k] === '' ? '–' : S[k]}</span>`;

  function qb(id) {
    const q = Q[id];
    const v = d.answers[id];
    const tag = E ? 'button' : 'span';
    const at = o => E ? ` type="button" data-q="${id}" data-v="${esc(o)}" title="${esc(o)}"` : '';
    if (q.type === 'scale') {
      return `<div class="s-scale">${q.opts.map((o, i) => {
        const lab = i === 0 ? `(${q.ends[0]}) 1` : i === 4 ? `5 (${q.ends[1]})` : String(i + 1);
        return `<${tag}${at(o)} class="${v === o ? 'on' : ''}">${lab}<i></i></${tag}>`;
      }).join('')}</div>`;
    }
    const sel = q.type === 'multi' ? (v || []) : [v];
    return `<div class="s-opts">${q.opts.map(o => `<${tag}${at(o)} class="${sel.includes(o) ? 'on' : ''}">${esc(o)}</${tag}>`).join('')}</div>`;
  }
  function qBox(id, extra = '', style = '') {
    const q = Q[id];
    const hint = d.hints[id] || (q.type === 'multi' ? '중복 선택' : '');
    return `<div class="s-q" id="q-${id}"${style ? ` style="${style}"` : ''}><div class="s-qh"><b>${esc(q.label)}</b><span>${esc(hint)}</span></div><div class="s-qb">${qb(id)}${extra}</div></div>`;
  }
  const plan = (k, gen) => {
    if (!E && !d[k]) return '';
    return `<div class="s-txt"><div class="s-lb">지도 방향과 개선 계획 ${x(`data-gen="${gen}"`, '자동생성')}</div>${fa(k, '지도 방향과 개선 계획을 입력하세요', 3)}</div>`;
  };

  const whoText = () => `<span>학교<b data-who="sg">${esc([d.school, d.grade].filter(Boolean).join(' '))}</b></span><span>이름<b data-who="nm">${esc(d.student_name)}</b></span>`;
  const head = (n, sub) => `<div class="s-hd"><img src="${LOGO_H}" alt="수학도서관"><div class="s-who">${whoText()}</div></div>
    <div class="s-ttl"><span class="lat">Math Library</span><h1>1개월 학습보고서</h1></div>
    <div class="s-sub"><span class="n">${n}</span>${sub}</div>`;
  const foot = (n, c) => `<div class="s-ft"><span>수학도서관 · 1:1 명품 맞춤 수학학원${c ? ' · ' + CONTACT.replace(' · 02.2651.7750', '') : ''}</span><span class="pg">${n} / 3</span></div>`;
  const page = (inner, cls = '', pi = 0) => `<section class="pr-page ${cls}" data-pi="${pi}"><div class="s-frame"></div>${inner}</section>`;

  /* ---------- 표지 ---------- */
  const period = [d.att_from, d.att_to].filter(Boolean).join(' – ');
  const cover = page(`<span class="c1"></span><span class="c2"></span><span class="c3"></span><span class="c4"></span>
    <div class="s-in">
      <div class="top">Math Library · One Month Report</div>
      <img src="${LOGO_V}" alt="수학도서관">
      <div class="rule"></div>
      <h1>1개월 학습보고서</h1>
      <div class="en">Monthly Learning Report</div>
      <div class="whobox"><div>학교<b data-who="sg">${esc([d.school, d.grade].filter(Boolean).join(' '))}</b></div><div>이름<b data-who="nm">${esc(d.student_name)}</b></div></div>
      <div class="period" data-who="period">${period ? '지도 기간 ' + esc(period) + ' · ' : ''}${esc(teacherLine(d))}</div>
      <div class="bottom"><div class="since">since 2013</div><div class="tel">${CONTACT}</div></div>
    </div>`, 's-cover', 0);

  /* ---------- 1페이지 ---------- */
  const attRows = T.map((t, i) => `<tr><td>${esc(t.name || '선생님')}<span class="s-tg${tgCls(t.role)}">${esc(t.role)}</span> ${E ? ft(i, 'days', '요일', '', 'width:16mm;display:inline-block') : esc(t.days || '')}${E && i > 0 ? x(`data-del-t="${i}" aria-label="부담임 줄 지우기"`, '×') : ''}</td>${ATT_F.map(k => `<td class="${k === 'late' ? 'w' : k === 'absent' ? 'b' : ''}">${ft(i, k, '0')}</td>`).join('')}</tr>`).join('');
  const attSum = `<tr class="sum"><td>합계</td><td>${sumv('sessions')}회</td>${ATT_F.slice(1).map(k => `<td>${sumv(k)}</td>`).join('')}</tr>`;
  const logLine = E
    ? `<div class="s-log"><span>결석·보강일</span>${f('att_days', '예) 결석 9/15(화) / 보강 9/19(토) · 지각 9/18(금) 16:38')}<span>메모</span>${f('att_note', '예) 9/25 추석 휴강', '', 'width:42mm')}</div>`
    : ((d.att_days || d.att_note) ? `<p class="s-log">${[d.att_days, d.att_note].filter(Boolean).map(esc).join(' · ')}</p>` : '');

  const rate = S.hwRate === '' ? 0 : pct(S.hwRate);
  const donut = `<div class="s-donut"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50" fill="none" stroke="#EEF2F0" stroke-width="11"/><circle data-donut cx="60" cy="60" r="50" fill="none" stroke="#0A4844" stroke-width="11" stroke-linecap="round" stroke-dasharray="${(rate / 100 * 314.16).toFixed(1)} 314.16" transform="rotate(-90 60 60)"/></svg><div class="c"><b data-sum="hwRatePct">${S.hwRate === '' ? '–' : S.hwRate + '%'}</b><span>${multi ? '전체 ' : ''}달성률</span></div></div>`;
  const hwRows = T.map((t, i) => `<tr><td>${esc(t.name || '선생님')}<span class="s-tg${tgCls(t.role)}">${esc(t.role)}</span> ${E ? ft(i, 'hwCourse', '과정 · 교재', '', 'width:40mm;display:inline-block') : esc(t.hwCourse || '')}</td>
    <td>${esc(d.hw_type || '')}</td><td>${ft(i, 'hwTotal', '0')}${E ? '' : '회'}</td><td>${ft(i, 'hwSkip', '0')}${E ? '' : '회'}</td>
    <td><div class="s-mb"><span class="t"><i data-bar-t="${i}" class="${i > 0 ? 'gd' : ''}" style="width:${pct(t.hwRate)}%"></i></span>${E ? ft(i, 'hwRate', '%', 'num', 'width:10mm') : `<span>${t.hwRate === '' ? '–' : esc(t.hwRate) + '%'}</span>`}</div></td></tr>`).join('');
  const hwSum = `<tr class="sum"><td>합계</td><td></td><td>${sumv('hwTotal')}회</td><td>${sumv('hwSkip')}회</td><td><div class="s-mb"><span class="t"><i data-bar-sum style="width:${rate}%"></i></span><span data-sum="hwRatePct">${S.hwRate === '' ? '–' : S.hwRate + '%'}</span></div></td></tr>`;
  const hwUnit = E ? `<select class="e sel" data-k="hw_type" aria-label="과제 단위">${['Page', '문제수', '단원'].map(o => `<option ${d.hw_type === o ? 'selected' : ''}>${o}</option>`).join('')}</select>` : '';
  const miss = (E || d.hw_note) ? `<div class="s-miss"><b>안해온 날짜 &amp; 분량 — </b>${fa('hw_note', '예) 9/11(금) 내신대비교재 A p.34–41', 1)}</div>` : '';

  const p1 = page(`<div class="s-in">${head('I', '상담 기록 · 출결 · 관찰 평가')}
    <p class="s-greet">${INTRO[0]}<br>${INTRO.slice(1).join(' ')}</p>
    <div class="s-sec"><h2>상담 기록</h2><span class="r"></span></div>
    <table class="s-info">
      <tr><th>상담일자</th><td>${f('consult_date', '예) 2026.10.24')}</td><th>학생명</th><td>${f('student_name', '이름')}</td></tr>
      <tr><th>학교/학년</th><td>${E ? pair2(f('school', '학교'), f('grade', '학년')) : esc([d.school, d.grade].filter(Boolean).join(' '))}</td><th>교사명</th><td data-who="teachers">${esc(teacherLine(d))}</td></tr>
      <tr><th>확인</th><td>${f('confirmer', '확인자 이름')}</td><th>입회일자</th><td>${f('join_date', '예) 2026.09.01')}</td></tr>
      <tr><th>직전학기 내신</th><td>${f('prev_score', '예) 중간 100점 · 기말 97점')}</td><th>진단평가</th><td>${E ? pair2(f('entry_score', '1차'), f('entry_score2', '2차')) : scoreText(d.entry_score, d.entry_score2)}</td></tr>
      <tr><th>현재 진행 과정</th><td colspan="3">${f('current_course', '예) 중2-2 내신대비교재, 공통수학1 쎈')}</td></tr>
      <tr><th>월평가</th><td>${f('monthly_eval_name', '시험명')}</td><th>점수 / 평균</th><td>${E ? pair2(f('monthly_eval_score', '점수'), f('monthly_eval_avg', '학년 평균')) : scoreText(d.monthly_eval_score, d.monthly_eval_avg)}</td></tr>
      <tr><th>인증시험</th><td>${f('cert_eval_name', '시험명')}</td><th>점수 / P·F</th><td>${E ? pair2(f('cert_eval_score', '점수'), f('cert_eval_pf', '통과 / 미통과')) : scoreText(d.cert_eval_score, d.cert_eval_pf)}</td></tr>
    </table>
    <div class="s-sec"><h2>출결 현황</h2><span class="per">${E ? `${f('att_from', '시작일', '', 'width:21mm')}–${f('att_to', '종료일', '', 'width:21mm')}` : esc(period)}</span><span class="r"></span>${E && !multi ? x('data-add-sub', '＋ 부담임 줄') : ''}</div>
    <table class="s-tt">
      <tr><th>선생님 · 수업 요일</th><th>수업</th><th>출석</th><th>지각</th><th>결석</th><th>미보강</th><th>결석보강</th><th>진도보강</th></tr>
      ${attRows}${multi || E ? attSum : ''}
    </table>
    ${logLine}
    <div class="s-sec"><h2>과제</h2><span class="per">${E ? '단위 ' + hwUnit : ''}</span><span class="r"></span></div>
    <div class="s-hw">${donut}
      <table class="s-tt">
        <tr><th>선생님 · 과정</th><th>단위</th><th>과제</th><th>안함</th><th style="width:36mm">달성률</th></tr>
        ${hwRows}${multi || E ? hwSum : ''}
      </table>
    </div>
    ${miss}
    <div class="s-sec"><h2>관찰 평가</h2><span class="r"></span></div>
    ${qBox('homework_error', '', 'margin-top:0')}
    ${foot(1)}</div>`, '', 1);

  /* ---------- 2페이지 ---------- */
  const books = d.books.filter(b => E || b.name || b.rate !== '');
  const bookRows = books.map((b, i) => `<li><div class="bt">${E ? `<input class="e" data-b="${i}" data-bf="name" value="${esc(b.name)}" placeholder="교재 · 단원">` : `<span>${esc(b.name)}${multi && b.teacher ? ` <small>${esc(b.teacher)}</small>` : ''}</span>`}
      <span class="rt">${E ? `<input class="e num" data-b="${i}" data-bf="rate" value="${esc(b.rate)}" placeholder="0" inputmode="numeric" style="width:9mm">%${x(`data-del-b="${i}" aria-label="교재 줄 지우기"`, '×')}` : (b.rate !== '' ? esc(b.rate) + '%' : '')}</span></div>
      <div class="t"><i data-bar-b="${i}" style="width:${pct(b.rate)}%"></i></div></li>`).join('');
  const road = d.road.filter(r => E || r.month || r.text);
  const roadRows = road.map((r, i) => `<li class="${i === 0 && r.text ? 'now' : ''}">${E ? `<input class="e" data-r="${i}" data-rf="month" value="${esc(r.month)}" placeholder="월"><input class="e" data-r="${i}" data-rf="text" value="${esc(r.text)}" placeholder="예) 2학기 기말 대비">` : `<b>${esc(r.month)}</b><span>${esc(r.text)}</span>`}</li>`).join('');
  const bookBox = `<div class="s-q" id="q-books"><div class="s-qh"><b>현재 진행 교재 · ${esc(d.roadmap_label || '분기 로드맵')}</b><span data-who="period2">${period ? esc(period) + ' 기준' : ''}</span></div>
    <div class="s-qb"><div class="s-pair">
      <ul class="s-books">${bookRows || (E ? '' : '<li><span class="s-empty">–</span></li>')}${E ? `<li>${x('data-add-b', '＋ 교재 줄')}</li>` : ''}</ul>
      <ul class="s-road">${roadRows || (E ? '' : '<li><span class="s-empty">–</span></li>')}${E ? `<li>${x('data-add-r', '＋ 로드맵 줄')}</li>` : ''}</ul>
    </div></div></div>`;

  const p2 = page(`<div class="s-in">${head('II', '관찰 평가 · 지도 계획')}
    <div class="s-grid2">${qBox('focus')}${qBox('roadmap_speed')}</div>
    ${qBox('motivation')}
    ${qBox('coaching', plan('coaching_reason', 'coaching'))}
    ${bookBox}
    ${qBox('prelearning_reaction', plan('prelearning_reason', 'prelearning'))}
    ${foot(2)}</div>`, '', 2);

  /* ---------- 3페이지 ---------- */
  const home = T.find(t => t.role === '담임') || {};
  const sub = T.find(t => t.role === '부담임') || {};
  const bsec = (k, title, ph) => (E || d[k]) ? `<h4>${title}</h4>${E ? `<textarea class="e" data-k="${k}" rows="3" placeholder="${esc(ph)}">${esc(d[k])}</textarea>` : `<p>${nl2br(d[k])}</p>`}` : '';
  const p3 = page(`<div class="s-in">${head('III', '관찰 평가')}
    <div class="s-grid2">${qBox('arithmetic')}${qBox('problem_speed')}</div>
    ${qBox('health')}${qBox('question_frequency')}
    <div class="s-bh"><img src="${LOGO_H}" alt="수학도서관"><h2><small>Math Library</small>상담을 위한 학생 Briefing</h2></div>
    <table class="s-info" style="margin-top:3mm">
      <tr><th>학교</th><td data-who="school">${esc(d.school)}</td><th>학년</th><td data-who="grade">${esc(d.grade)}</td></tr>
      <tr><th>이름</th><td data-who="nm2">${esc(d.student_name)}</td><th>담임</th><td>${esc(home.name || '')}</td></tr>
      <tr><th>부담임</th><td>${sub.name ? esc(sub.name) : f('briefing_sub', '부담임 이름')}</td><th>작성일</th><td>${f('write_date', '작성일')}</td></tr>
    </table>
    <div class="s-brief">
      ${E ? `<div class="s-genrow">${x('data-gen="briefing"', '설문 기반 브리핑 자동생성 (세 칸 모두)')}</div>` : ''}
      ${bsec('brief1', '수업 태도와 학습 습관', '출결, 수업 태도, 과제 습관')}
      ${bsec('brief2', '성적과 진단 결과', '내신, 진단평가, 월평가, 오답·연산 습관')}
      ${bsec('brief3', '다음 달 계획', '다음 달 지도 계획, 학부모 상담 내용')}
    </div>
    ${foot(3, true)}</div>`, '', 3);

  return [cover, p1, p2, p3];
}

export function printHTML(report) { return sheetPages(report, { edit: false }).join(''); }

/* =========================================================
   글자 크기 자동 맞춤
   2페이지 지도계획 두 칸, 3페이지 브리핑 세 칸이 쪽을 넘치면
   넘치지 않을 때까지 글자를 줄입니다 (가장 작게 7pt).
   ========================================================= */
export const FIT = {
  2: { base: 8.8, min: 7, lh: 1.75, lhMin: 1.55 },
  3: { base: 9, min: 7, lh: 1.85, lhMin: 1.6 }
};
const STEP = 0.25;
function lhFor(pi, size) {
  const f = FIT[pi];
  return +(f.lh - (f.base - size) / (f.base - f.min) * (f.lh - f.lhMin)).toFixed(3);
}
export function pageOverflows(pg) {
  const inEl = pg.querySelector('.s-in'); const ftEl = pg.querySelector('.s-ft');
  if (!inEl || !ftEl) return false;
  const limit = ftEl.getBoundingClientRect().top;
  let bottom = 0;
  [...inEl.children].forEach(c => { if (c !== ftEl) bottom = Math.max(bottom, c.getBoundingClientRect().bottom); });
  return bottom > limit + 1;
}
function setFit(pg, pi, size) {
  pg.style.setProperty('--fs', size + 'pt');
  pg.style.setProperty('--lh', lhFor(pi, size));
}
// 실제 인쇄 모양을 화면 밖에 그려 각 쪽에 맞는 글자 크기를 정합니다
export function computeFit(report) {
  const probe = document.createElement('div');
  probe.className = 'overflow-probe'; probe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(probe);
  probe.innerHTML = printHTML(report);
  const pages = [...probe.querySelectorAll('.pr-page')];
  const out = { 2: FIT[2].base, 3: FIT[3].base, over: [] };
  pages.forEach((pg, i) => {
    if (FIT[i]) {
      let size = FIT[i].base;
      setFit(pg, i, size);
      while (pageOverflows(pg) && size > FIT[i].min) { size = Math.max(FIT[i].min, +(size - STEP).toFixed(2)); setFit(pg, i, size); }
      out[i] = size;
    }
    out.over[i] = pageOverflows(pg);
  });
  probe.remove();
  return out;
}
export function applyFit(root, fit) {
  [2, 3].forEach(pi => root.querySelectorAll(`.pr-page[data-pi="${pi}"]`).forEach(pg => setFit(pg, pi, fit[pi])));
}

/* =========================================================
   휴대폰 · 읽기 전용 전체 보기 (모든 항목)
   ========================================================= */
function qMobile(id, data) {
  const q = Q[id];
  const v = data.answers[id];
  const hint = (data.hints || {})[id];
  let body;
  if (q.type === 'scale') {
    body = `<div class="mv-scale">${q.opts.map((o, i) => `<div class="${v === o ? 'on' : ''}">${i === 0 ? `(${q.ends[0]}) 1` : i === 4 ? `5 (${q.ends[1]})` : i + 1}<i></i></div>`).join('')}</div>`;
  } else {
    const sel = q.type === 'multi' ? (v || []) : [v];
    body = `<div class="mv-opts">${q.opts.map(o => `<span class="${sel.includes(o) ? 'on' : ''}">${esc(o)}</span>`).join('')}</div>`;
  }
  let extra = '';
  if (id === 'coaching' && data.coaching_reason) extra = `<div class="mv-txt"><span class="lb">지도 방향과 개선 계획</span>${nl2br(data.coaching_reason)}</div>`;
  if (id === 'prelearning_reaction' && data.prelearning_reason) extra = `<div class="mv-txt"><span class="lb">지도 방향과 개선 계획</span>${nl2br(data.prelearning_reason)}</div>`;
  return `<div class="mv-q"><div class="mv-qh"><b>${esc(q.label)}</b>${hint ? `<span>${esc(hint)}</span>` : (q.type === 'multi' ? '<span>중복 선택</span>' : '')}</div><div class="mv-qb">${body}${extra}</div></div>`;
}
function mAtt(data) {
  const S = sums(data);
  const cell = (k, v, cls = '') => `<div class="${cls}"><b>${nn(v)}</b><small>${k}</small></div>`;
  const grid = t => `<div class="mv-nums">${cell('수업', t.sessions)}${cell('출석', t.present)}${cell('지각', t.late, 'w')}${cell('결석', t.absent, 'b')}${cell('미보강', t.nomk)}${cell('결석보강', t.muAbsent)}${cell('진도보강', t.muProgress)}</div>`;
  const rows = data.teachers.map(t => `<div class="mv-trow"><div class="mv-tn">${esc(t.name || '선생님')}<span class="tg ${t.role === '담임' ? 'a' : 's'}">${esc(t.role)}</span>${t.days ? `<small>${esc(t.days)}</small>` : ''}</div>${grid(t)}</div>`).join('');
  return rows + (data.teachers.length > 1 ? `<div class="mv-trow sum"><div class="mv-tn">합계</div>${grid(S)}</div>` : '');
}
function mHw(data) {
  const S = sums(data);
  const bar = (r, gold) => r === '' || r == null ? '<span class="mv-empty">–</span>' : `<div class="mb"><span class="t"><i class="${gold ? 'gd' : ''}" style="width:${pct(r)}%"></i></span><span>${esc(r)}%</span></div>`;
  const row = (t, i, isSum) => `<div class="mv-trow ${isSum ? 'sum' : ''}"><div class="mv-tn">${isSum ? '합계' : `${esc(t.name || '선생님')}<span class="tg ${t.role === '담임' ? 'a' : 's'}">${esc(t.role)}</span>`}</div>
    ${!isSum && t.hwCourse ? `<div class="mv-course">${esc(t.hwCourse)}</div>` : ''}
    <div class="mv-hw"><span>총 <b>${nn(t.hwTotal)}</b>회</span><span>안함 <b>${nn(t.hwSkip)}</b>회</span><span class="r">${bar(t.hwRate, i > 0 && !isSum)}</span></div></div>`;
  return data.teachers.map((t, i) => row(t, i, false)).join('') + (data.teachers.length > 1 ? row(S, 0, true) : '');
}

export function mobileHTML(report, statusLabel) {
  const d = normalize(report.data);
  const sec = (title, inner, sub = '') => `<section class="mv-card"><h3>${title}${sub ? `<span>${sub}</span>` : ''}</h3>${inner}</section>`;
  const kv = rows => `<dl class="mv-kv">${rows.map(([k, v, wide]) => `<div class="${wide ? 'wide' : ''}"><dt>${k}</dt><dd>${v || '<span class="mv-empty">입력 없음</span>'}</dd></div>`).join('')}</dl>`;
  const period = [d.att_from, d.att_to].filter(Boolean).join(' – ');
  const empty = '<span class="mv-empty">입력 없음</span>';

  const info = kv([
    ['상담일자', dash(d.consult_date)], ['학생명', dash(d.student_name)],
    ['학교/학년', esc([d.school, d.grade].filter(Boolean).join(' '))], ['입회일자', dash(d.join_date)],
    ['교사명', esc(teacherLine(d)), true], ['확인', dash(d.confirmer)],
    ['직전학기 내신', dash(d.prev_score)], ['진단평가', scoreText(d.entry_score, d.entry_score2), true],
    ['현재 진행 과정', dash(d.current_course), true],
    ['월평가', dash(d.monthly_eval_name)], ['점수 / 평균', scoreText(d.monthly_eval_score, d.monthly_eval_avg)],
    ['인증시험', dash(d.cert_eval_name)], ['점수 / P·F', scoreText(d.cert_eval_score, d.cert_eval_pf)]
  ]);
  const log = [d.att_days, d.att_note].filter(Boolean).map(esc).join(' · ');
  const att = `${mAtt(d)}${log ? `<p class="mv-note">${log}</p>` : ''}`;
  const S = sums(d);
  const hw = `${S.hwRate !== '' ? `<div class="mv-big"><b>${S.hwRate}%</b><small>${d.teachers.length > 1 ? '전체 ' : ''}과제 달성률</small></div>` : ''}${mHw(d)}<p class="mv-note">단위 ${esc(d.hw_type || '')}</p>${d.hw_note ? `<div class="mv-txt"><span class="lb">안해온 날짜 &amp; 분량</span>${nl2br(d.hw_note)}</div>` : ''}`;
  const qs = ids => ids.map(id => qMobile(id, d)).join('');
  const books = d.books.filter(b => b.name || b.rate !== '');
  const road = d.road.filter(r => r.month || r.text);
  const bookHTML = `<div class="mv-txt"><span class="lb">현재 진행 교재</span>${books.length ? `<ul class="mv-books">${books.map(b => `<li><div><span>${esc(b.name)}${d.teachers.length > 1 && b.teacher ? ` <small>${esc(b.teacher)}</small>` : ''}</span><b>${b.rate !== '' ? esc(b.rate) + '%' : ''}</b></div><i><em style="width:${pct(b.rate)}%"></em></i></li>`).join('')}</ul>` : empty}</div>
    <div class="mv-txt"><span class="lb">${esc(d.roadmap_label || '분기 로드맵')}</span>${road.length ? `<ul class="mv-road">${road.map(r => `<li><b>${esc(r.month)}</b><span>${esc(r.text)}</span></li>`).join('')}</ul>` : empty}</div>`;
  const home = d.teachers.find(t => t.role === '담임') || {};
  const sub = d.teachers.find(t => t.role === '부담임') || {};
  const bparts = [['brief1', '수업 태도와 학습 습관'], ['brief2', '성적과 진단 결과'], ['brief3', '다음 달 계획']].filter(([k]) => d[k]);
  const brief = kv([['학교', dash(d.school)], ['학년', dash(d.grade)], ['이름', dash(d.student_name)], ['담임', dash(home.name)], ['부담임', dash(sub.name || d.briefing_sub)], ['작성일', dash(d.write_date)]])
    + `<div class="mv-brief">${bparts.length ? bparts.map(([k, t]) => `<h4>${t}</h4><p>${nl2br(d[k])}</p>`).join('') : '<span class="mv-empty">브리핑이 아직 없습니다</span>'}</div>`;

  return `
    <header class="mv-hero">
      <img src="${LOGO_H}" alt="수학도서관">
      <div class="mv-title"><span class="lat">Math Library</span><h2>1개월 학습보고서</h2></div>
      <div class="mv-who"><b>${esc(d.student_name)}</b> · ${esc([d.school, d.grade].filter(Boolean).join(' '))}<br><small>${esc(teacherLine(d))}${statusLabel ? ' · ' + esc(statusLabel) : ''}</small></div>
    </header>
    ${sec('인사말', `<div class="mv-greet">${INTRO.map(s => `<p>${s}</p>`).join('')}</div>`)}
    ${sec('<em>I</em> 상담 기록', info)}
    ${sec('출결 현황', att, period ? esc(period) : '')}
    ${sec('과제', hw)}
    ${sec('관찰 평가', qMobile('homework_error', d))}
    ${sec('<em>II</em> 관찰 평가 · 지도 계획', qs(['focus', 'roadmap_speed', 'motivation', 'coaching']) + `<div class="mv-q"><div class="mv-qh"><b>현재 진행 교재 · ${esc(d.roadmap_label || '분기 로드맵')}</b>${period ? `<span>${esc(period)} 기준</span>` : ''}</div><div class="mv-qb">${bookHTML}</div></div>` + qs(['prelearning_reaction']))}
    ${sec('<em>III</em> 관찰 평가', qs(['arithmetic', 'problem_speed', 'health', 'question_frequency']))}
    ${sec('상담을 위한 학생 Briefing', brief)}
    <p class="mv-foot">수학도서관 · 1:1 명품 맞춤 수학학원<br>${CONTACT}</p>`;
}

export { bookLine, PAGE3_Q };
