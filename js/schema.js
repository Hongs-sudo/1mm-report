// 보고서 항목 정의 · 자동 계산 · 자동 생성 문장
// 원본 1MM 보고서(1mm_manual)의 문항·선택지·문장을 그대로 옮겼습니다.
import { num, todayStr, parseDate } from './util.js';

export const STATUS = {
  draft: { label: '작성 중', cls: 'w' },
  done: { label: '완료', cls: 'd' },
  consulted: { label: '상담 끝', cls: 'sh' }
};

// 관찰 평가 문항
export const Q = {
  homework_error: { label: '숙제 오답률 (평균)', type: 'opts',
    opts: ['① 5~10%', '② 10~20%', '③ 20~30%', '④ 30~40%', '⑤ 40~50%'] },
  focus: { label: '집중력', type: 'scale', ends: ['낮다', '높다'],
    opts: ['① 낮다', '② 조금 낮다', '③ 보통이다', '④ 조금 높다', '⑤ 높다'] },
  motivation: { label: '학습의욕', type: 'opts', grid: 3,
    opts: ['① 많이 의욕적이다', '② 의욕적인 편이다', '③ 의욕적이지는 않으나 시키는 일은 잘한다', '④ 수동적인 편이다', '⑤ 의욕이 많이 떨어져있다'] },
  coaching: { label: '공책 풀이노트 교정해야 할 부분', type: 'multi',
    opts: ['① 글씨체', '② 식 전개과정', '③ 채점', '④ 지적할 것이 없다'] },
  roadmap_speed: { label: '로드맵 속도 적정도', type: 'scale', ends: ['느리다', '빠르다'],
    opts: ['① 느리다', '② 조금 느리다', '③ 적당하다', '④ 조금 빠르다', '⑤ 빠르다'] },
  prelearning_reaction: { label: '선행으로 인한 아이의 반응', type: 'opts',
    opts: ['① 큰 문제가 없다', '② 조율 필요성을 느낀다', '③ 선행하기엔 무리가 있다'] },
  arithmetic: { label: '연산 실수 체크', type: 'scale', ends: ['적다', '많다'],
    opts: ['① 거의 없다', '② 가끔 있다', '③ 보통이다', '④ 자주 있다', '⑤ 많이 있다'] },
  health: { label: '체력 체크', type: 'opts',
    opts: ['① 건강한 편이다', '② 보통이다', '③ 약한 편이다', '④ 많이 허약하다'] },
  problem_speed: { label: '문제풀이 속도감 체크', type: 'scale', ends: ['느리다', '빠르다'],
    opts: ['① 느리다', '② 조금 느리다', '③ 보통이다', '④ 조금 빠르다', '⑤ 빠르다'] },
  question_frequency: { label: '학생이 선생님께 질문하는 빈도수', type: 'opts',
    opts: ['① 자주한다', '② 보통이다', '③ 질문을 하지않아 선생님이 일일히 다가가야 한다'] }
};
export const PAGE2_Q = ['focus', 'motivation', 'coaching', 'roadmap_speed', 'prelearning_reaction'];
export const PAGE3_Q = ['arithmetic', 'health', 'problem_speed', 'question_frequency'];
export const SUMMARY_ORDER = ['homework_error', 'focus', 'motivation', 'coaching', 'roadmap_speed', 'prelearning_reaction', 'arithmetic', 'health', 'problem_speed', 'question_frequency'];

export const COACHING_REASONS = {
  '① 글씨체':
    '수학 풀이에서 글씨체는 단순 미관의 문제가 아닙니다. 불명확한 글씨는 스스로 풀이를 검토할 때 오류를 놓치기 쉽고, 숫자 혼동으로 연산 실수로 이어질 수 있습니다.\n\n' +
    '▶ 지도 계획: 매수업 풀이 노트를 함께 확인하며 숫자와 기호를 또렷하게 쓰도록 반복 지도합니다. 특히 0과 6, 1과 7 등 혼동하기 쉬운 숫자를 집중적으로 교정합니다.',
  '② 식 전개과정':
    '풀이 과정을 생략하고 결과만 쓰는 습관은 개념 이해 없이 정답만 맞히는 피상적 학습으로 이어질 수 있습니다. 식 전개를 단계별로 기록하면 어느 단계에서 실수가 발생했는지 스스로 파악하고 수정하는 능력이 길러집니다.\n\n' +
    '▶ 지도 계획: 풀이 과정을 생략할 경우 다시 단계별로 쓰도록 지도하고, 올바른 풀이 예시를 함께 보여주며 체계적으로 쓰는 습관을 형성합니다.',
  '③ 채점':
    '오답을 어떻게 처리하느냐가 학습 성취를 크게 좌우합니다. 바른 채점 습관(문제 번호 확인 → 오답 표시 → 원인 분석)이 형성되면 같은 유형의 실수가 반복되지 않도록 스스로 관리하는 능력이 길러집니다.\n\n' +
    '▶ 지도 계획: 채점 방법과 오답 정리 루틴을 직접 시범 보이고, 오답 노트 활용 방법을 함께 익히도록 지도합니다.',
  '④ 지적할 것이 없다':
    '공책 풀이 기록과 채점 습관이 매우 잘 형성되어 있습니다. 이러한 체계적인 학습 습관은 실력 향상의 중요한 기반이 됩니다.\n\n' +
    '▶ 지도 계획: 현재의 우수한 습관을 유지하면서, 서술형·사고력 문제에서도 같은 수준의 풀이 기록을 유지하도록 격려합니다.'
};
export const PRELEARNING_REASONS = {
  '① 큰 문제가 없다':
    '현재 선행 수준이 학생의 인지 발달 범위 안에 있어 교사의 지도 아래 효과적으로 진행되고 있습니다.\n\n' +
    '▶ 지도 계획: 현 속도를 유지하면서 개념 이해의 깊이를 더하는 데 집중합니다. 진도를 나가면서도 핵심 개념이 확실히 내재화되었는지 주기적으로 확인합니다.',
  '② 조율 필요성을 느낀다':
    '일부 내용에서 학생의 준비도와 선행 속도 사이에 간극이 발생하고 있습니다. 기초 개념이 충분히 내재화되지 않은 상태에서 속도만 높이면 이후 학습에서 더 큰 어려움이 생길 수 있습니다.\n\n' +
    '▶ 지도 계획: 선행 내용 중 이해가 부족한 부분을 파악하여 집중 보완합니다. 속도보다 이해도를 우선으로 하여 단계적으로 조정합니다.',
  '③ 선행하기엔 무리가 있다':
    '현재 기초 개념이 충분히 형성되지 않은 상태에서 선행이 진행되어 학생이 어려움을 겪고 있습니다. 이 상태가 지속되면 지식의 공백이 누적되어 이후 학습에서 더 큰 어려움으로 이어질 수 있습니다.\n\n' +
    '▶ 지도 계획: 현재 진행 중인 개념의 기초 이해를 먼저 확실히 다지고, 선행 속도를 단계적으로 조정합니다. 학부모님과도 충분한 상담이 필요합니다.'
};
export const EVAL_SENTENCES = {
  focus: { '① 낮다': '집중력이 다소 낮은 편으로 수업 중 지속적인 지도가 필요합니다.', '② 조금 낮다': '집중력이 조금 낮은 편이며 꾸준한 관리가 필요합니다.', '③ 보통이다': '집중력은 보통 수준을 유지하고 있습니다.', '④ 조금 높다': '집중력이 좋은 편으로 수업에 잘 임하고 있습니다.', '⑤ 높다': '집중력이 매우 뛰어나 수업 참여도가 높습니다.' },
  motivation: { '① 많이 의욕적이다': '학습 의욕이 매우 높아 스스로 학습을 이끌어가고 있습니다.', '② 의욕적인 편이다': '학습 의욕이 좋아 자발적으로 공부하는 모습을 보입니다.', '③ 의욕적이지는 않으나 시키는 일은 잘한다': '시키는 것은 잘 하지만 자발적 학습 의욕은 조금 더 키워나갈 필요가 있습니다.', '④ 수동적인 편이다': '다소 수동적인 편으로 학습 의욕을 높이기 위한 격려가 필요합니다.', '⑤ 의욕이 많이 떨어져있다': '학습 의욕이 많이 떨어져 있어 동기부여를 위한 집중 관리가 필요합니다.' },
  arithmetic: { '① 거의 없다': '연산 실수가 거의 없어 안정적인 풀이 습관을 갖추고 있습니다.', '② 가끔 있다': '간헐적으로 연산 실수가 있어 검산 습관을 들이도록 지도하고 있습니다.', '③ 보통이다': '연산 실수는 보통 수준으로 검산 습관을 함께 지도하고 있습니다.', '④ 자주 있다': '연산 실수가 자주 발생하여 별도 연산 연습을 병행하고 있습니다.', '⑤ 많이 있다': '연산 실수가 많아 집중 지도가 필요한 상황입니다.' },
  problem_speed: { '① 느리다': '문제풀이 속도가 느려 시간 안에 푸는 훈련이 필요합니다.', '② 조금 느리다': '문제풀이 속도가 다소 느려 시간 관리 연습이 필요합니다.', '③ 보통이다': '문제풀이 속도는 보통 수준입니다.', '④ 조금 빠르다': '문제풀이 속도가 빠른 편입니다.', '⑤ 빠르다': '문제풀이 속도가 매우 빠릅니다.' },
  question_frequency: { '① 자주한다': '모르는 것을 적극적으로 질문하며 스스로 해결하려는 의지가 강합니다.', '② 보통이다': '필요할 때 질문을 하는 편입니다.', '③ 질문을 하지않아 선생님이 일일히 다가가야 한다': '질문을 거의 하지 않아 교사가 먼저 다가가 이해도를 확인하고 있습니다.' },
  roadmap_speed: { '① 느리다': '현재 로드맵 속도가 학생 수준 대비 느려 속도 조정을 검토 중입니다.', '② 조금 느리다': '로드맵 진행 속도가 조금 느린 편으로 확인이 필요합니다.', '③ 적당하다': '현재 로드맵 속도가 학생 수준에 적절합니다.', '④ 조금 빠르다': '로드맵 속도가 조금 빠른 편이나 잘 따라오고 있습니다.', '⑤ 빠르다': '로드맵 속도가 빠른 편으로 꼼꼼한 확인이 필요합니다.' },
  prelearning_reaction: { '① 큰 문제가 없다': '선행 학습에 무리 없이 잘 따라오고 있습니다.', '② 조율 필요성을 느낀다': '선행 학습에서 일부 조율이 필요한 부분이 있습니다.', '③ 선행하기엔 무리가 있다': '현재 선행 속도는 학생에게 다소 무리가 있어 조율이 필요합니다.' },
  health: { '① 건강한 편이다': '체력이 좋아 긴 수업도 지치지 않고 활기차게 참여합니다.', '② 보통이다': '체력은 보통 수준입니다.', '③ 약한 편이다': '체력이 다소 약해 수업 후반부에 집중력이 떨어지는 경향이 있습니다.', '④ 많이 허약하다': '체력이 약해 수업 중 피로감을 자주 보여 휴식 배분에 신경 쓰고 있습니다.' },
  coaching: { '① 글씨체': '공책 풀이 시 글씨체 교정을 지도하고 있습니다.', '② 식 전개과정': '풀이 과정을 체계적으로 쓰는 습관을 지도하고 있습니다.', '③ 채점': '채점 방법과 오답 처리 습관을 지도하고 있습니다.', '④ 지적할 것이 없다': '공책 풀이 습관이 매우 바릅니다.' },
  homework_error: { '① 5~10%': '숙제 오답률이 5~10%로 매우 양호합니다.', '② 10~20%': '숙제 오답률이 10~20% 수준입니다.', '③ 20~30%': '숙제 오답률이 20~30%로 오답 복습 지도를 강화하고 있습니다.', '④ 30~40%': '숙제 오답률이 30~40%로 기본 개념 보완이 필요합니다.', '⑤ 40~50%': '숙제 오답률이 40~50%로 집중적인 개념 지도가 필요합니다.' }
};

export const INTRO = [
  '안녕하세요. 수학도서관입니다.',
  '저희 수학도서관에서는 <b>신규학생의 조기적응과 학력향상을 위하여 "1개월 학습보고서" 상담을 진행</b>하고 있습니다.',
  '담당 선생님이 1개월 동안 지도한 내용을 바탕으로 학생들의 학습상태에 대해서 정밀하게 진단하고 심층 탐구할 수 있는 시간을 가지려고 합니다.',
  '학생들의 수업 진행과정과 학원 프로그램에 대해서 궁금해 하시는 학부모님께 도움이 되었으면 하는 바람을 가지며, <b>늘 최상의 결과를 보여드리는 수학도서관이 되겠습니다.</b>'
];

// 선생님 한 줄 (출결 + 과제)
export function newTeacherRow(role, name = '', email = '') {
  return {
    role, name, email, days: '',
    sessions: '', present: '', late: '', absent: '', nomk: '', muAbsent: '', muProgress: '',
    hwCourse: '', hwTotal: '', hwSkip: '', hwRate: ''
  };
}

// 새 보고서의 기본 내용 — 학생 정보로 미리 채움
export function newReportData(student, staffNames = {}) {
  const join = parseDate(student.joinDate);
  let periodFrom = student.joinDate || '';
  let periodTo = '';
  if (join) {
    const end = new Date(join); end.setMonth(end.getMonth() + 1); end.setDate(end.getDate() - 1);
    periodTo = todayStr(end);
    periodFrom = todayStr(join);
  }
  const homeName = staffNames[student.homeroom] || '';
  const subName = student.sub ? (staffNames[student.sub] || '') : '';
  const teachers = [newTeacherRow('담임', homeName, student.homeroom || '')];
  if (student.sub) teachers.push(newTeacherRow('부담임', subName, student.sub));
  return {
    consult_date: '', student_name: student.name || '', school: student.school || '', grade: student.grade || '',
    confirmer: '', join_date: student.joinDate ? todayStr(parseDate(student.joinDate) || new Date()) : '',
    prev_score: '', entry_score: '', entry_score2: '', current_course: '',
    monthly_eval_name: '', monthly_eval_score: '', monthly_eval_avg: '',
    cert_eval_name: '', cert_eval_score: '', cert_eval_pf: '',
    att_from: periodFrom, att_to: periodTo, att_note: '', att_days: '',
    hw_type: 'Page', hw_note: '',
    teachers,
    answers: {},
    hints: {},
    coaching_reason: '', prelearning_reason: '',
    current_progress: '', roadmap_text: '', roadmap_label: '분기 로드맵',
    books: [newBook()], road: [newRoad(), newRoad(), newRoad()],
    briefing_sub: '', write_date: todayStr(),
    briefing_text: '', brief1: '', brief2: '', brief3: '',
    auto: {}
  };
}

/* 진행 교재 한 줄 · 로드맵 한 줄 */
export function newBook(name = '', rate = '', teacher = '') { return { name, rate, teacher }; }
export function newRoad(month = '', text = '') { return { month, text }; }

// 예전 형식(글 상자)으로 저장된 보고서를 새 양식(교재 줄 · 로드맵 줄 · 브리핑 세 칸)으로 옮김
export function normalize(data) {
  data.answers = data.answers || {};
  data.hints = data.hints || {};
  data.teachers = data.teachers && data.teachers.length ? data.teachers : [newTeacherRow('담임')];
  if (!Array.isArray(data.books)) {
    const lines = String(data.current_progress || '').split(/\n+/).map(l => l.trim()).filter(Boolean);
    data.books = lines.map(l => {
      let teacher = '';
      const t = l.match(/^\[([^\]]+)\]\s*/); if (t) { teacher = t[1]; l = l.slice(t[0].length); }
      const r = l.match(/\((\d{1,3})\s*%\)\s*$/);
      return newBook(r ? l.slice(0, r.index).trim() : l, r ? r[1] : '', teacher);
    });
    if (!data.books.length) data.books = [newBook()];
  }
  if (!Array.isArray(data.road)) {
    const lines = String(data.roadmap_text || '').split(/\n+/).map(l => l.trim()).filter(Boolean);
    data.road = lines.map(l => {
      const m = l.match(/^(\d{1,2}\s*월)\s*[·:\-]?\s*/);
      return m ? newRoad(m[1].replace(/\s/g, ''), l.slice(m[0].length)) : newRoad('', l);
    });
    while (data.road.length < 3) data.road.push(newRoad());
  }
  if (data.brief1 == null && data.brief2 == null && data.brief3 == null) {
    data.brief1 = data.briefing_text || ''; data.brief2 = ''; data.brief3 = '';
  }
  ['brief1', 'brief2', 'brief3'].forEach(k => { if (data[k] == null) data[k] = ''; });
  return data;
}
export function bookLine(b) { return [b.name, b.rate !== '' && b.rate != null ? `(${b.rate}%)` : ''].filter(Boolean).join(' '); }

// 담임/부담임 표의 합계
export function sums(data) {
  const keys = ['sessions', 'present', 'late', 'absent', 'nomk', 'muAbsent', 'muProgress', 'hwTotal', 'hwSkip'];
  const out = {};
  keys.forEach(k => {
    let s = 0, any = false;
    (data.teachers || []).forEach(t => { const v = num(t[k]); if (v != null) { s += v; any = true; } });
    out[k] = any ? s : '';
  });
  // 과제 달성률: 과제 횟수만큼 가중 평균 (횟수가 없으면 단순 평균)
  let w = 0, ws = 0, plain = [];
  (data.teachers || []).forEach(t => {
    const r = num(t.hwRate); if (r == null) return;
    plain.push(r);
    const n = num(t.hwTotal);
    if (n) { w += n; ws += r * n; }
  });
  out.hwRate = w ? Math.round(ws / w) : (plain.length ? Math.round(plain.reduce((a, b) => a + b, 0) / plain.length) : '');
  return out;
}

export function teacherLine(data) {
  return (data.teachers || []).filter(t => t.name).map(t => `${t.role} ${t.name}`).join(' · ');
}

export function genCoaching(data) {
  const vals = data.answers.coaching || [];
  return vals.map(v => COACHING_REASONS[v]).filter(Boolean).join('\n\n');
}
export function genPrelearning(data) {
  return PRELEARNING_REASONS[data.answers.prelearning_reaction] || '';
}

// 설문 기반 브리핑 (원본 문장 구성 + 담임/부담임별 출결·과제)
export function genBriefing(data, monthLabel) {
  const t = data.teachers || [];
  const S = sums(data);
  const lines = [];
  const period = [data.att_from, data.att_to].filter(Boolean).join(' ~ ');
  t.forEach(r => {
    const parts = [];
    if (r.sessions !== '') parts.push(`수업 ${r.sessions}회`);
    if (r.present !== '') parts.push(`출석 ${r.present}회`);
    if (r.late !== '' && +r.late) parts.push(`지각 ${r.late}회`);
    if (r.absent !== '' && +r.absent) parts.push(`결석 ${r.absent}회`);
    if (r.muAbsent !== '' && +r.muAbsent) parts.push(`결석보강 ${r.muAbsent}회`);
    if (r.muProgress !== '' && +r.muProgress) parts.push(`진도보강 ${r.muProgress}회`);
    if (r.nomk !== '' && +r.nomk) parts.push(`미보강 ${r.nomk}회`);
    if (parts.length) lines.push(`${r.role} ${r.name || ''}: ${parts.join(' · ')}`.trim());
  });
  if (t.length > 1 && S.sessions !== '') lines.push(`합계: 수업 ${S.sessions}회 · 출석 ${S.present || 0}회` + (S.absent ? ` · 결석 ${S.absent}회` : ''));
  const hw = [];
  t.forEach(r => { if (r.hwRate !== '') hw.push(`${r.role} ${r.name || ''} ${r.hwRate}%` + (r.hwTotal !== '' ? ` (총 ${r.hwTotal}회 중 안함 ${r.hwSkip || 0}회)` : '')); });
  if (t.length > 1 && S.hwRate !== '') hw.push(`전체 ${S.hwRate}%`);

  const evalLines = [];
  ['focus', 'motivation', 'arithmetic', 'problem_speed', 'question_frequency', 'roadmap_speed', 'prelearning_reaction', 'health', 'coaching', 'homework_error'].forEach(id => {
    const v = data.answers[id];
    if (!v || !EVAL_SENTENCES[id]) return;
    (Array.isArray(v) ? v : [v]).forEach(x => { if (EVAL_SENTENCES[id][x]) evalLines.push('• ' + EVAL_SENTENCES[id][x]); });
  });

  let text = `[${monthLabel} 학부모 브리핑]\n`;
  text += `학생: ${data.student_name}${data.school ? ' (' + data.school + (data.grade ? ' ' + data.grade : '') + ')' : ''}\n`;
  text += `담당: ${teacherLine(data)}\n\n`;
  if (lines.length) text += `■ 출결 현황${period ? ' (' + period + ')' : ''}\n${lines.join('\n')}${data.att_days ? '\n' + data.att_days : ''}\n\n`;
  if (hw.length) text += `■ 과제 달성률\n${hw.join(' · ')}\n\n`;
  if (data.current_progress) text += `■ 현재 진행 교재\n${data.current_progress}\n\n`;
  if (data.roadmap_text) text += `■ ${data.roadmap_label || '분기 로드맵'}\n${data.roadmap_text}\n\n`;
  if (evalLines.length) text += `■ 학생 관찰\n${evalLines.join('\n')}\n\n`;
  return text.replace(/\n+$/, '');
}

export function answeredCount(data) {
  return SUMMARY_ORDER.filter(k => { const v = data.answers[k]; return Array.isArray(v) ? v.length : !!v; }).length;
}


// 브리핑 세 칸 자동생성 (수업 태도와 학습 습관 / 성적과 진단 결과 / 다음 달 계획)
export function genBriefing3(data) {
  const t = data.teachers || [];
  const S = sums(data);
  const ev = id => { const v = data.answers[id]; if (!v || !EVAL_SENTENCES[id]) return []; return (Array.isArray(v) ? v : [v]).map(x => EVAL_SENTENCES[id][x]).filter(Boolean); };
  const period = [data.att_from, data.att_to].filter(Boolean).join(' ~ ');

  const a = [];
  if (t.length > 1) {
    const parts = t.filter(r => r.sessions !== '').map(r => `${r.role} ${r.name || ''} 선생님${r.days ? '(' + r.days + ')' : ''} ${r.sessions}회`);
    if (parts.length) a.push(`${period ? period + ' 동안 ' : ''}${parts.join(', ')}로 나누어 모두 ${S.sessions}회 수업했습니다.`);
  } else if (S.sessions !== '') a.push(`${period ? period + ' 동안 ' : ''}모두 ${S.sessions}회 수업했습니다.`);
  const att = [];
  if (S.present !== '') att.push(`출석 ${S.present}회`);
  if (+S.late) att.push(`지각 ${S.late}회`);
  if (+S.absent) att.push(`결석 ${S.absent}회`);
  if (+S.muAbsent) att.push(`결석보강 ${S.muAbsent}회`);
  if (+S.muProgress) att.push(`진도보강 ${S.muProgress}회`);
  if (att.length) a.push(att.join(', ') + '입니다.');
  if (S.hwRate !== '') a.push(`과제 달성률은 ${t.length > 1 ? '전체 ' : ''}${S.hwRate}%${t.length > 1 ? ' (' + t.filter(r => r.hwRate !== '').map(r => `${r.role} ${r.hwRate}%`).join(', ') + ')' : ''}이며, 총 ${S.hwTotal || 0}회 중 ${S.hwSkip || 0}회 과제를 해 오지 않았습니다.`);
  a.push(...ev('focus'), ...ev('motivation'), ...ev('question_frequency'), ...ev('health'), ...ev('coaching'));

  const b = [];
  if (data.prev_score) b.push(`직전학기 내신: ${data.prev_score}.`);
  const entry = [data.entry_score, data.entry_score2].filter(Boolean).join(' / ');
  if (entry) b.push(`입회 진단평가: ${entry}.`);
  if (data.monthly_eval_name || data.monthly_eval_score) b.push(`${data.monthly_eval_name || '월평가'}: ${[data.monthly_eval_score, data.monthly_eval_avg].filter(Boolean).join(' / ')}.`);
  if (data.cert_eval_name || data.cert_eval_score) b.push(`${data.cert_eval_name || '인증시험'}: ${[data.cert_eval_score, data.cert_eval_pf].filter(Boolean).join(' / ')}.`);
  b.push(...ev('homework_error'), ...ev('arithmetic'), ...ev('problem_speed'));

  const c = [];
  const books = (data.books || []).filter(x => x.name);
  if (books.length) c.push('현재 진행 교재: ' + books.map(x => bookLine(x) + (t.length > 1 && x.teacher ? ` [${x.teacher}]` : '')).join(', ') + '.');
  const road = (data.road || []).filter(x => x.month || x.text);
  if (road.length) c.push(road.map(x => [x.month, x.text].filter(Boolean).join(' ')).join(' → ') + '.');
  c.push(...ev('roadmap_speed'), ...ev('prelearning_reaction'));
  if (data.ai_memo) c.push(`입회 상담 메모: ${data.ai_memo}`);
  return { brief1: a.join(' '), brief2: b.join(' '), brief3: c.join(' ') };
}
