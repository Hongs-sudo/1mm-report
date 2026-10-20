// 보고서를 그리는 곳: A4 인쇄용(시안①) · 휴대폰 전체 보기
import { esc, nl2br } from './util.js';
import { Q, INTRO, PAGE2_Q, PAGE3_Q, sums, teacherLine } from './schema.js';

const LOGO_H = 'img/logo_h.png';
const LOGO_V = 'img/logo_v.png';
const CONTACT = '상담 및 등록문의 010.3358.9007 · 02.2651.7750';

const dash = v => (v === '' || v == null ? '' : esc(v));
const nn = v => (v === '' || v == null ? '–' : esc(v));

function scoreText(a, b) { return [a, b].filter(Boolean).map(esc).join(' / '); }

/* ---------- 문항 그리기 (인쇄·보기 공용) ---------- */
function qBlock(id, data, cls = 'pr') {
  const q = Q[id];
  const v = data.answers[id];
  const hint = (data.hints || {})[id];
  let body = '';
  if (q.type === 'scale') {
    body = `<div class="${cls}-scale">${q.opts.map((o, i) => {
      const lab = i === 0 ? `(${q.ends[0]}) 1` : i === 4 ? `5 (${q.ends[1]})` : String(i + 1);
      return `<div class="${v === o ? 'on' : ''}">${lab}<i></i></div>`;
    }).join('')}</div>`;
  } else {
    const sel = q.type === 'multi' ? (v || []) : [v];
    body = `<div class="${cls}-opts">${q.opts.map(o => `<span class="${sel.includes(o) ? 'on' : ''}">${esc(o)}</span>`).join('')}</div>`;
  }
  let extra = '';
  if (id === 'coaching' && data.coaching_reason) extra = `<div class="${cls}-txt"><span class="lb">지도 방향과 개선 계획</span>${nl2br(data.coaching_reason)}</div>`;
  if (id === 'prelearning_reaction' && data.prelearning_reason) extra = `<div class="${cls}-txt"><span class="lb">지도 방향과 개선 계획</span>${nl2br(data.prelearning_reason)}</div>`;
  return `<div class="${cls}-q"><div class="${cls}-qh"><b>${esc(q.label)}</b>${hint ? `<span>${esc(hint)}</span>` : (q.type === 'multi' ? '<span>중복 선택</span>' : '')}</div><div class="${cls}-qb">${body}${extra}</div></div>`;
}

function attTable(data, cls) {
  const S = sums(data);
  const rows = data.teachers.map(t => `<tr><td class="l">${esc(t.name || '선생님')}<span class="tg ${t.role === '담임' ? 'a' : 's'}">${esc(t.role)}</span>${t.days ? ` <small>${esc(t.days)}</small>` : ''}</td><td>${nn(t.sessions)}</td><td>${nn(t.present)}</td><td class="w">${nn(t.late)}</td><td class="b">${nn(t.absent)}</td><td>${nn(t.nomk)}</td><td>${nn(t.muAbsent)}</td><td>${nn(t.muProgress)}</td></tr>`).join('');
  const sum = `<tr class="sum"><td class="l">합계</td><td>${nn(S.sessions)}</td><td>${nn(S.present)}</td><td>${nn(S.late)}</td><td>${nn(S.absent)}</td><td>${nn(S.nomk)}</td><td>${nn(S.muAbsent)}</td><td>${nn(S.muProgress)}</td></tr>`;
  return `<table class="${cls}-tt"><thead><tr><th class="l">선생님</th><th>수업</th><th>출석</th><th>지각</th><th>결석</th><th>미보강</th><th>결석보강</th><th>진도보강</th></tr></thead><tbody>${rows}${sum}</tbody></table>`;
}
function hwTable(data, cls) {
  const S = sums(data);
  const bar = (r, gold) => r === '' || r == null ? '–' : `<div class="mb"><span class="t"><i class="${gold ? 'gd' : ''}" style="width:${Math.max(0, Math.min(100, +r))}%"></i></span><span>${esc(r)}%</span></div>`;
  const rows = data.teachers.map((t, i) => `<tr><td class="l">${esc(t.name || '선생님')}<span class="tg ${t.role === '담임' ? 'a' : 's'}">${esc(t.role)}</span></td><td class="l">${dash(t.hwCourse)}</td><td>${nn(t.hwTotal)}</td><td>${nn(t.hwSkip)}</td><td class="bar">${bar(t.hwRate, i > 0)}</td></tr>`).join('');
  const sum = `<tr class="sum"><td class="l">합계</td><td></td><td>${nn(S.hwTotal)}</td><td>${nn(S.hwSkip)}</td><td class="bar">${bar(S.hwRate)}</td></tr>`;
  return `<table class="${cls}-tt"><thead><tr><th class="l">선생님</th><th class="l">과정</th><th>총</th><th>안함</th><th style="width:34%">달성률</th></tr></thead><tbody>${rows}${sum}</tbody></table>`;
}
function attLog(data) {
  const p = [];
  const period = [data.att_from, data.att_to].filter(Boolean).join(' – ');
  if (period) p.push(`기간 <b>${esc(period)}</b>`);
  if (data.att_days) p.push(`결석·보강일 <b>${esc(data.att_days)}</b>`);
  if (data.att_note) p.push(esc(data.att_note));
  return p.join(' · ');
}

function infoRows(data) {
  return `
    <tr><th>상담일자</th><td>${dash(data.consult_date)}</td><th>학생명</th><td>${dash(data.student_name)}</td></tr>
    <tr><th>학교/학년</th><td>${esc([data.school, data.grade].filter(Boolean).join(' '))}</td><th>교사명</th><td>${esc(teacherLine(data))}</td></tr>
    <tr><th>확인</th><td>${dash(data.confirmer)}</td><th>입회일자</th><td>${dash(data.join_date)}</td></tr>
    <tr><th>직전학기 내신</th><td>${dash(data.prev_score)}</td><th>진단평가</th><td>${scoreText(data.entry_score, data.entry_score2)}</td></tr>
    <tr><th>현재 진행 과정</th><td colspan="3">${dash(data.current_course)}</td></tr>
    <tr><th>월평가</th><td>${dash(data.monthly_eval_name)}</td><th>점수 / 평균</th><td>${scoreText(data.monthly_eval_score, data.monthly_eval_avg)}</td></tr>
    <tr><th>인증시험</th><td>${dash(data.cert_eval_name)}</td><th>점수 / P·F</th><td>${scoreText(data.cert_eval_score, data.cert_eval_pf)}</td></tr>`;
}
function briefRows(data) {
  const home = data.teachers.find(t => t.role === '담임') || {};
  const sub = data.teachers.find(t => t.role === '부담임') || {};
  return `
    <tr><th>학교</th><td>${dash(data.school)}</td><th>학년</th><td>${dash(data.grade)}</td></tr>
    <tr><th>이름</th><td>${dash(data.student_name)}</td><th>담임</th><td>${dash(home.name)}</td></tr>
    <tr><th>부담임</th><td>${dash(sub.name || data.briefing_sub)}</td><th>작성일</th><td>${dash(data.write_date)}</td></tr>`;
}

/* ---------- A4 인쇄 ---------- */
export function printHTML(report) {
  const d = report.data;
  const who = `<div class="pr-who"><span>학교<b>${esc([d.school, d.grade].filter(Boolean).join(' '))}</b></span><span>이름<b>${esc(d.student_name)}</b></span></div>`;
  const head = (n, sub) => `
    <div class="pr-hd"><img src="${LOGO_H}" alt="수학도서관">${who}</div>
    <div class="pr-ttl"><span class="lat">Math Library</span><h1>1개월 학습보고서</h1></div>
    <div class="pr-sub"><span class="n">${n}</span>${sub}</div>`;
  const foot = (n, contact) => `<div class="pr-ft"><span>수학도서관 · 1:1 명품 맞춤 수학학원${contact ? ' · ' + CONTACT : ''}</span><span class="pg">${n} / 3</span></div>`;
  const period = [d.att_from, d.att_to].filter(Boolean).join(' – ');

  const cover = `<section class="pr-page pr-cover">
    <span class="c1"></span><span class="c2"></span><span class="c3"></span><span class="c4"></span>
    <div class="pr-in">
      <div class="top">Math Library · One Month Report</div>
      <img src="${LOGO_V}" alt="수학도서관">
      <div class="rule"></div>
      <h1>1개월 학습보고서</h1>
      <div class="en">Monthly Learning Report</div>
      <div class="whobox"><div>학교<b>${esc([d.school, d.grade].filter(Boolean).join(' '))}</b></div><div>이름<b>${esc(d.student_name)}</b></div></div>
      <div class="period">${period ? '지도 기간 ' + esc(period) + ' · ' : ''}${esc(teacherLine(d))}</div>
      <div class="bottom"><div class="since">since 2013</div><div class="tel">${CONTACT}</div></div>
    </div></section>`;

  const p1 = `<section class="pr-page"><div class="pr-in">${head('I', '상담 기록 · 출결 · 관찰 평가')}
    <p class="pr-greet">${INTRO.join('<br>')}</p>
    <div class="pr-sec"><h2>상담 기록</h2><span class="r"></span></div>
    <table class="pr-info">${infoRows(d)}</table>
    <div class="pr-sec"><h2>출결 현황</h2><span class="r"></span></div>
    ${attTable(d, 'pr')}
    ${attLog(d) ? `<p class="pr-log">${attLog(d)}</p>` : ''}
    <div class="pr-sec"><h2>과제</h2><span class="per">단위 ${esc(d.hw_type || '')}</span><span class="r"></span></div>
    ${hwTable(d, 'pr')}
    ${d.hw_note ? `<div class="pr-miss"><b>안해온 날짜 &amp; 분량</b> — ${nl2br(d.hw_note)}</div>` : ''}
    <div class="pr-sec"><h2>관찰 평가</h2><span class="r"></span></div>
    ${qBlock('homework_error', d)}
    ${foot(1)}</div></section>`;

  const p2 = `<section class="pr-page"><div class="pr-in">${head('II', '관찰 평가 · 지도 계획')}
    ${qBlock('focus', d)}${qBlock('motivation', d)}${qBlock('coaching', d)}
    <div class="pr-q"><div class="pr-qh"><b>현재 진행 교재 · ${esc(d.roadmap_label || '분기 로드맵')}</b></div><div class="pr-qb"><div class="pr-pair"><div><span class="lb">현재 진행 교재</span>${nl2br(d.current_progress) || '–'}</div><div><span class="lb">${esc(d.roadmap_label || '분기 로드맵')}</span>${nl2br(d.roadmap_text) || '–'}</div></div></div></div>
    ${qBlock('roadmap_speed', d)}${qBlock('prelearning_reaction', d)}
    ${foot(2)}</div></section>`;

  const p3 = `<section class="pr-page"><div class="pr-in">${head('III', '관찰 평가')}
    <div class="pr-grid2">${qBlock('arithmetic', d)}${qBlock('problem_speed', d)}</div>
    ${qBlock('health', d)}${qBlock('question_frequency', d)}
    <div class="pr-bh"><img src="${LOGO_H}" alt="수학도서관"><h2><small>Math Library</small>상담을 위한 학생 Briefing</h2></div>
    <table class="pr-info" style="margin-top:3mm">${briefRows(d)}</table>
    <div class="pr-brief">${nl2br(d.briefing_text) || ''}</div>
    ${foot(3, true)}</div></section>`;

  return cover + p1 + p2 + p3;
}


/* 휴대폰: 표 대신 선생님별 카드 (가로 스크롤 없이 모든 숫자) */
function mAtt(data) {
  const S = sums(data);
  const cell = (k, v, cls = '') => `<div class="${cls}"><b>${nn(v)}</b><small>${k}</small></div>`;
  const grid = t => `<div class="mv-nums">${cell('수업', t.sessions)}${cell('출석', t.present)}${cell('지각', t.late, 'w')}${cell('결석', t.absent, 'b')}${cell('미보강', t.nomk)}${cell('결석보강', t.muAbsent)}${cell('진도보강', t.muProgress)}</div>`;
  const rows = data.teachers.map(t => `<div class="mv-trow"><div class="mv-tn">${esc(t.name || '선생님')}<span class="tg ${t.role === '담임' ? 'a' : 's'}">${esc(t.role)}</span>${t.days ? `<small>${esc(t.days)}</small>` : ''}</div>${grid(t)}</div>`).join('');
  return rows + `<div class="mv-trow sum"><div class="mv-tn">합계</div>${grid(S)}</div>`;
}
function mHw(data) {
  const S = sums(data);
  const bar = (r, gold) => r === '' || r == null ? '<span class="mv-empty">–</span>' : `<div class="mb"><span class="t"><i class="${gold ? 'gd' : ''}" style="width:${Math.max(0, Math.min(100, +r))}%"></i></span><span>${esc(r)}%</span></div>`;
  const row = (t, i, isSum) => `<div class="mv-trow ${isSum ? 'sum' : ''}"><div class="mv-tn">${isSum ? '합계' : `${esc(t.name || '선생님')}<span class="tg ${t.role === '담임' ? 'a' : 's'}">${esc(t.role)}</span>`}</div>
    ${!isSum && t.hwCourse ? `<div class="mv-course">${esc(t.hwCourse)}</div>` : ''}
    <div class="mv-hw"><span>총 <b>${nn(t.hwTotal)}</b>회</span><span>안함 <b>${nn(t.hwSkip)}</b>회</span><span class="r">${bar(t.hwRate, i > 0 && !isSum)}</span></div></div>`;
  return data.teachers.map((t, i) => row(t, i, false)).join('') + row(S, 0, true);
}

/* ---------- 휴대폰 · 읽기 전용 전체 보기 (모든 항목) ---------- */
export function mobileHTML(report, statusLabel) {
  const d = report.data;
  const sec = (title, inner, sub = '') => `<section class="mv-card"><h3>${title}${sub ? `<span>${sub}</span>` : ''}</h3>${inner}</section>`;
  const kv = rows => `<dl class="mv-kv">${rows.map(([k, v, wide]) => `<div class="${wide ? 'wide' : ''}"><dt>${k}</dt><dd>${v || '<span class="mv-empty">입력 없음</span>'}</dd></div>`).join('')}</dl>`;
  const period = [d.att_from, d.att_to].filter(Boolean).join(' – ');

  const info = kv([
    ['상담일자', dash(d.consult_date)], ['학생명', dash(d.student_name)],
    ['학교/학년', esc([d.school, d.grade].filter(Boolean).join(' '))], ['입회일자', dash(d.join_date)],
    ['교사명', esc(teacherLine(d)), true], ['확인', dash(d.confirmer)],
    ['직전학기 내신', dash(d.prev_score)], ['진단평가', scoreText(d.entry_score, d.entry_score2), true],
    ['현재 진행 과정', dash(d.current_course), true],
    ['월평가', dash(d.monthly_eval_name)], ['점수 / 평균', scoreText(d.monthly_eval_score, d.monthly_eval_avg)],
    ['인증시험', dash(d.cert_eval_name)], ['점수 / P·F', scoreText(d.cert_eval_score, d.cert_eval_pf)]
  ]);

  const att = `${mAtt(d)}${attLog(d) ? `<p class="mv-note">${attLog(d)}</p>` : ''}`;
  const hw = `${mHw(d)}<p class="mv-note">단위 ${esc(d.hw_type || '')}</p>${d.hw_note ? `<div class="mv-txt"><span class="lb">안해온 날짜 &amp; 분량</span>${nl2br(d.hw_note)}</div>` : ''}`;

  const qs = ids => ids.map(id => qBlock(id, d, 'mv')).join('');
  const books = `<div class="mv-txt"><span class="lb">현재 진행 교재</span>${nl2br(d.current_progress) || '<span class="mv-empty">입력 없음</span>'}</div><div class="mv-txt"><span class="lb">${esc(d.roadmap_label || '분기 로드맵')}</span>${nl2br(d.roadmap_text) || '<span class="mv-empty">입력 없음</span>'}</div>`;
  const home = d.teachers.find(t => t.role === '담임') || {};
  const sub = d.teachers.find(t => t.role === '부담임') || {};
  const brief = kv([['학교', dash(d.school)], ['학년', dash(d.grade)], ['이름', dash(d.student_name)], ['담임', dash(home.name)], ['부담임', dash(sub.name || d.briefing_sub)], ['작성일', dash(d.write_date)]])
    + `<div class="mv-brief">${nl2br(d.briefing_text) || '<span class="mv-empty">브리핑이 아직 없습니다</span>'}</div>`;

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
    ${sec('관찰 평가', qBlock('homework_error', d, 'mv'))}
    ${sec('<em>II</em> 관찰 평가 · 지도 계획', qs(['focus', 'motivation', 'coaching']) + `<div class="mv-q"><div class="mv-qh"><b>현재 진행 교재 · ${esc(d.roadmap_label || '분기 로드맵')}</b></div><div class="mv-qb">${books}</div></div>` + qs(['roadmap_speed', 'prelearning_reaction']))}
    ${sec('<em>III</em> 관찰 평가', qs(PAGE3_Q))}
    ${sec('상담을 위한 학생 Briefing', brief)}
    <p class="mv-foot">수학도서관 · 1:1 명품 맞춤 수학학원<br>${CONTACT}</p>`;
}

export { PAGE2_Q };
