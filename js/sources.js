// 자료 불러오기: 데일리 리포트(깃허브 동기화 파일 · 백업 JSON), 입회원서 사진, 수업 기록 엑셀
import { esc, lsGet, lsSet, parseDate, md, num } from './util.js';
import { auth } from './fb.js';

/* =========================================================
   1. 데일리 리포트
   ========================================================= */
// 이 기기에만 저장되는 연결 정보 (토큰은 서버에 올리지 않음)
export function drCfg() {
  return {
    repo: lsGet('mm.dr.repo', ''),
    token: lsGet('mm.dr.token', ''),
    path: lsGet('mm.dr.path', '데일리리포트_데이터.json')
  };
}
export function setDrCfg({ repo, token, path }) {
  lsSet('mm.dr.repo', (repo || '').trim());
  lsSet('mm.dr.token', (token || '').trim());
  lsSet('mm.dr.path', (path || '데일리리포트_데이터.json').trim());
}
export function drReady() { const c = drCfg(); return !!(c.repo && c.token); }

function b64decode(b64) {
  const bin = atob(String(b64).replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

let drCache = null; // { at, db }
export async function fetchDR(force = false) {
  if (!force && drCache && Date.now() - drCache.at < 5 * 60 * 1000) return drCache.db;
  const c = drCfg();
  const repo = c.repo.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/^\/|\/$/g, '');
  const url = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(c.path)}`;
  const headers = { Authorization: 'Bearer ' + c.token, Accept: 'application/vnd.github+json' };
  const res = await fetch(url + '?t=' + Date.now(), { headers, cache: 'no-store' });
  if (res.status === 401) throw new Error('토큰이 올바르지 않거나 만료되었습니다.');
  if (res.status === 403) throw new Error('이 저장소를 읽을 권한이 없습니다.');
  if (res.status === 404) throw new Error('저장소나 파일 이름을 찾을 수 없습니다.');
  if (!res.ok) throw new Error('데일리 리포트를 불러오지 못했습니다 (' + res.status + ')');
  const j = await res.json();
  let text;
  if (j.content && j.encoding === 'base64') text = b64decode(j.content);
  else {
    const r2 = await fetch(url + '?t=' + Date.now(), { headers: { ...headers, Accept: 'application/vnd.github.raw' }, cache: 'no-store' });
    if (!r2.ok) throw new Error('데일리 리포트를 불러오지 못했습니다 (' + r2.status + ')');
    text = await r2.text();
  }
  const db = JSON.parse(text);
  drCache = { at: Date.now(), db };
  return db;
}
export function setDRFromObject(obj) {
  if (!obj || !Array.isArray(obj.records)) throw new Error('데일리 리포트 백업 파일이 아닙니다.');
  drCache = { at: Date.now(), db: obj };
  return obj;
}

export function drStudentNames(db) {
  const set = new Set();
  (db.students || []).forEach(s => s && s.name && set.add(s.name));
  (db.records || []).forEach(r => r && r.studentName && set.add(r.studentName));
  return [...set].sort((a, b) => a.localeCompare(b, 'ko'));
}
export function drStudent(db, name) {
  return (db.students || []).find(s => s.name === name) || null;
}

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// 기간 안 기록으로 출결·과제·진도·태도를 계산
export function computeDR(db, name, fromStr, toStr) {
  const from = parseDate(fromStr), to = parseDate(toStr);
  const f = from ? iso(from) : '0000-00-00', t = to ? iso(to) : '9999-12-31';
  const recs = (db.records || [])
    .filter(r => r && r.studentName === name && r.date >= f && r.date <= t)
    .sort((a, b) => (a.date + (a.period || '')).localeCompare(b.date + (b.period || '')));
  const lessons = recs.filter(r => r.attendance !== '휴회');
  const isMakeAbsent = r => /결석/.test((r.attMemo || '') + ' ' + (r.reporting || '') + ' ' + (r.prevComment || ''));
  const st = { sessions: 0, present: 0, late: 0, absent: 0, muAbsent: 0, muProgress: 0 };
  const absentDays = [], lateDays = [], makeDays = [];
  lessons.forEach(r => {
    const a = r.attendance || '출석';
    if (a === '보강') {
      if (isMakeAbsent(r)) st.muAbsent++; else st.muProgress++;
      makeDays.push(md(r.date));
      return;
    }
    st.sessions++;
    if (a === '출석') st.present++;
    else if (a === '지각') { st.late++; lateDays.push(md(r.date) + (r.arriveAt ? ' ' + r.arriveAt : '')); }
    else if (a === '결석') { st.absent++; absentDays.push(md(r.date)); }
  });
  st.nomk = Math.max(0, st.absent - st.muAbsent);

  // 과제: 수업마다 확인한 직전 과제 달성률
  const hwRecs = lessons.filter(r => r.prevRate != null);
  const hwTotal = hwRecs.length;
  const skipped = [];
  hwRecs.forEach(r => {
    (r.prev || []).forEach(p => {
      if (p && p.rate != null && Number(p.rate) === 0) skipped.push(`${md(r.date)} ${[p.book, p.range].filter(Boolean).join(' ')}`.trim());
    });
  });
  const skipDates = new Set(hwRecs.filter(r => (r.prev || []).some(p => p && p.rate != null && Number(p.rate) === 0)).map(r => r.date));
  const hwRate = hwTotal ? Math.round(hwRecs.reduce((a, r) => a + Number(r.prevRate || 0), 0) / hwTotal) : '';

  // 진도: 마지막 수업의 교재·단원·진도율, 첫 수업 대비 변화
  const lastProg = [...lessons].reverse().find(r => (r.progress || []).some(p => p.book));
  const firstProg = lessons.find(r => (r.progress || []).some(p => p.book));
  const books = lastProg ? lastProg.progress.filter(p => p.book).map(p => {
    const first = firstProg ? (firstProg.progress || []).find(x => x.book === p.book) : null;
    return { book: p.book, unit: p.unit || '', rate: p.rate, delta: (first && first.rate != null && p.rate != null) ? p.rate - first.rate : null };
  }) : [];

  // 수업 태도·집중 (별 1~5)
  const avg = k => { const v = lessons.map(r => Number(r[k])).filter(x => x > 0); return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : ''; };
  const tests = lessons.filter(r => r.test && (r.test.name || r.test.score)).map(r => ({ date: r.date, name: r.test.name, score: r.test.score, total: r.test.total }));
  return {
    name, from: fromStr, to: toStr, count: lessons.length,
    ...st, absentDays, lateDays, makeDays,
    hwTotal, hwSkip: skipDates.size, hwRate, skipped,
    books, attitude: avg('attitude'), focus: avg('focus'), tests,
    teacher: (db.meta && db.meta.teacher) || ''
  };
}

// 계산한 값을 보고서의 한 선생님 줄과 공통 칸에 채움 (빈 칸만 채우지 않고 덮어씀)
export function applyDR(data, s, rowIdx) {
  const row = data.teachers[rowIdx];
  Object.assign(row, {
    sessions: String(s.sessions), present: String(s.present), late: String(s.late), absent: String(s.absent),
    nomk: String(s.nomk), muAbsent: String(s.muAbsent), muProgress: String(s.muProgress),
    hwTotal: String(s.hwTotal), hwSkip: String(s.hwSkip), hwRate: s.hwRate === '' ? '' : String(s.hwRate)
  });
  // 담임 한 명이면 불러올 때마다 새로 씀(다시 불러와도 겹치지 않게), 두 명이면 선생님별로 이어 붙임
  const solo = data.teachers.length < 2;
  const put = (key, val, sep) => { data[key] = solo ? val : mergeLine(data[key], val, sep); };
  if (s.books.length) {
    row.hwCourse = s.books.map(b => b.book).join(', ');
    const courseTxt = s.books.map(b => b.book + (b.rate != null ? ` (${b.rate}%)` : '')).join(' · ');
    put('current_course', courseTxt + (solo ? '' : ` (${row.name || row.role})`), ' · ');
    // 2페이지 진행 교재 줄: 이 선생님 줄만 새로 바꿈
    const who = solo ? '' : (row.name || row.role);
    const fresh = s.books.map(b => ({ name: b.book + (b.unit ? ' · ' + b.unit : ''), rate: b.rate != null ? String(b.rate) : '', teacher: who }));
    const keep = solo ? [] : (data.books || []).filter(b => (b.name || b.rate !== '') && b.teacher !== who);
    data.books = [...keep, ...fresh];
  }
  const days = [];
  if (s.absentDays.length) days.push('결석 ' + s.absentDays.join(', '));
  if (s.makeDays.length) days.push('보강 ' + s.makeDays.join(', '));
  if (s.lateDays.length) days.push('지각 ' + s.lateDays.join(', '));
  if (days.length || solo) put('att_days', days.length ? (solo ? '' : `[${row.name || row.role}] `) + days.join(' / ') : '', ' · ');
  if (s.skipped.length || solo) put('hw_note', s.skipped.map(x => x + (solo ? '' : ` (${row.name || row.role})`)).join('\n'), '\n');
  // 보고서 기간은 불러온 기간으로 맞춤 (표의 숫자와 기간이 어긋나지 않게)
  if (s.from) data.att_from = s.from;
  if (s.to) data.att_to = s.to;
  data.hints = data.hints || {};
  if (s.focus) data.hints.focus = `수업 집중 평균 ${s.focus} / 5`;
  if (s.attitude) data.hints.motivation = `수업 태도 평균 ${s.attitude} / 5`;
  const delta = s.books.map(b => b.delta).filter(x => x != null);
  if (delta.length) data.hints.roadmap_speed = `기간 중 진도 +${Math.max(...delta)}%p`;
  const monthly = s.tests.find(t => /월/.test(t.name || ''));
  if (monthly && !data.monthly_eval_name) { data.monthly_eval_name = monthly.name; data.monthly_eval_score = monthly.score + (monthly.total ? ' / ' + monthly.total : ''); }
  const cert = s.tests.find(t => /인증/.test(t.name || ''));
  if (cert && !data.cert_eval_name) { data.cert_eval_name = cert.name; data.cert_eval_score = cert.score + (cert.total ? ' / ' + cert.total : ''); }
  data.auto = data.auto || {};
  data.auto['t' + rowIdx] = 'dr';
  return data;
}
function mergeLine(old, add, sep = ' · ') {
  if (!add) return old || '';
  if (!old) return add;
  if (old.includes(add)) return old;
  return old + sep + add;
}

/* =========================================================
   2. 올린 자료 (사진 · 엑셀) — 이 기기에서만 보관, 서버로 보내지 않음
   ========================================================= */
export class Uploads {
  constructor() { this.files = []; this.cur = null; this.onlyMatch = true; }

  async add(fileList, teacherIdx = 0) {
    const added = [];
    for (const f of fileList) {
      const id = Math.random().toString(36).slice(2, 9);
      const lower = f.name.toLowerCase();
      if (f.type.startsWith('image/') || /\.(jpe?g|png|heic|webp)$/.test(lower)) {
        added.push({ id, name: f.name, kind: 'img', teacherIdx, url: URL.createObjectURL(f), file: f });
      } else if (/\.(xlsx|xls|csv)$/.test(lower)) {
        if (!window.XLSX) throw new Error('엑셀 읽기 도구를 불러오는 중입니다. 잠시 후 다시 올려주세요.');
        const buf = await f.arrayBuffer();
        const wb = window.XLSX.read(buf, { type: 'array', cellDates: true });
        const sheets = wb.SheetNames.map(n => ({ name: n, rows: window.XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: '' }) }));
        added.push({ id, name: f.name, kind: 'sheet', teacherIdx, sheets, sheet: 0, file: f });
      } else if (/\.json$/.test(lower)) {
        const obj = JSON.parse(await f.text());
        added.push({ id, name: f.name, kind: 'json', teacherIdx, obj, file: f });
      } else if (/\.pdf$/.test(lower)) {
        added.push({ id, name: f.name, kind: 'pdf', teacherIdx, url: URL.createObjectURL(f), file: f });
      } else {
        throw new Error(`${f.name}: 사진, 엑셀(xlsx·csv), PDF, 데일리 리포트 백업(json)만 올릴 수 있습니다.`);
      }
    }
    this.files.push(...added);
    if (added.length) this.cur = added[added.length - 1].id;
    return added;
  }
  remove(id) {
    const f = this.files.find(x => x.id === id);
    if (f && f.url) URL.revokeObjectURL(f.url);
    this.files = this.files.filter(x => x.id !== id);
    if (this.cur === id) this.cur = this.files.length ? this.files[0].id : null;
  }
  get current() { return this.files.find(x => x.id === this.cur) || null; }
}

// 이름 비교용: 공백·괄호 속 학교 표기 제거
const bare = s => String(s || '').replace(/\s+/g, '');
export function nameHit(cell, name) {
  const c = bare(cell), n = bare(name);
  if (!n || !c) return 0;
  if (c.includes(n)) return 2;                       // 정서윤, 정서윤(염경2), 염경2정서윤
  if (n.length >= 3 && c.includes(n.slice(1)) && c.length <= n.length + 6) return 1; // 서윤 (성 빠짐) → 확인 필요
  return 0;
}

export function sheetHTML(sheet, studentName, onlyNear) {
  const rows = sheet.rows || [];
  if (!rows.length) return '<p class="up-empty">빈 시트입니다.</p>';
  const width = Math.min(40, Math.max(...rows.slice(0, 400).map(r => r.length)));
  const hits = [];
  rows.forEach((r, i) => r.forEach((c, j) => { const h = nameHit(c, studentName); if (h) hits.push({ i, j, h }); }));
  let show = rows.map((_, i) => i);
  if (onlyNear && hits.length) {
    const keep = new Set();
    hits.forEach(({ i }) => { for (let k = Math.max(0, i - 2); k <= Math.min(rows.length - 1, i + 12); k++) keep.add(k); });
    show = [...keep].sort((a, b) => a - b);
  }
  show = show.slice(0, 400);
  const hitMap = new Map(hits.map(h => [h.i + ':' + h.j, h.h]));
  // 학생 이름이 있는 열 근처를 강조
  const colNear = new Set();
  hits.forEach(({ j }) => { for (let k = j - 1; k <= j + 3; k++) colNear.add(k); });
  let html = '<table class="xl"><tbody>';
  let prev = -1;
  show.forEach(i => {
    if (prev >= 0 && i !== prev + 1) html += `<tr class="gap"><td colspan="${width + 1}">⋯</td></tr>`;
    prev = i;
    const r = rows[i] || [];
    html += `<tr><th>${i + 1}</th>`;
    for (let j = 0; j < width; j++) {
      const v = r[j] ?? '';
      const h = hitMap.get(i + ':' + j);
      html += `<td class="${h === 2 ? 'hit' : h === 1 ? 'maybe' : ''}${colNear.has(j) && onlyNear ? ' near' : ''}">${esc(v)}</td>`;
    }
    html += '</tr>';
  });
  html += '</tbody></table>';
  return { html, hits: hits.length, strong: hits.filter(h => h.h === 2).length, weak: hits.filter(h => h.h === 1).length };
}

export function sheetHitCount(sheet, name) {
  let n = 0;
  (sheet.rows || []).forEach(r => r.forEach(c => { if (nameHit(c, name)) n++; }));
  return n;
}

/* =========================================================
   3. AI 인식 (관리자가 설정에 주소를 넣으면 켜짐)
   ========================================================= */
function fileToDataURL(file, maxSide = 1800) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
export async function aiRead(endpoint, { data, uploads }) {
  const files = [];
  for (const f of uploads.files) {
    const teacher = data.teachers[f.teacherIdx] || {};
    if (f.kind === 'img') files.push({ name: f.name, kind: 'image', teacher: teacher.name, role: teacher.role, dataUrl: await fileToDataURL(f.file) });
    if (f.kind === 'sheet') {
      const text = f.sheets.map(s => `### 시트: ${s.name}\n` + s.rows.filter(r => r.some(c => c !== '')).map(r => r.join('\t')).join('\n')).join('\n\n');
      files.push({ name: f.name, kind: 'sheet', teacher: teacher.name, role: teacher.role, text: text.slice(0, 180000) });
    }
  }
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다. 새로고침 후 다시 로그인해 주세요.');
  const idToken = await user.getIdToken();
  const res = await fetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken },
    body: JSON.stringify({
      student: { name: data.student_name, school: data.school, grade: data.grade },
      period: { from: data.att_from, to: data.att_to },
      teachers: data.teachers.map(t => ({ role: t.role, name: t.name })),
      files
    })
  });
  if (!res.ok) {
    let msg = '';
    try { const j = await res.json(); msg = j.error || ''; if (j.detail) console.warn('AI 오류 상세:', j.detail); } catch {}
    throw new Error(msg || ('AI 인식 서버가 응답하지 않습니다 (' + res.status + ')'));
  }
  return res.json();
}
// AI 결과 적용 — 형식은 worker/ai-proxy.js 참고
export function applyAI(data, out) {
  const f = out.fields || {};
  ['prev_score', 'entry_score', 'entry_score2', 'join_date', 'school', 'grade', 'current_course', 'monthly_eval_name', 'monthly_eval_score', 'monthly_eval_avg', 'cert_eval_name', 'cert_eval_score', 'cert_eval_pf', 'att_days', 'hw_note', 'current_progress'].forEach(k => {
    if (f[k] != null && String(f[k]).trim() !== '') data[k] = String(f[k]);
  });
  (out.teachers || []).forEach(t => {
    const row = data.teachers.find(r => r.role === t.role) || data.teachers.find(r => r.name && r.name === t.name);
    if (!row) return;
    ['sessions', 'present', 'late', 'absent', 'nomk', 'muAbsent', 'muProgress', 'hwTotal', 'hwSkip', 'hwRate', 'hwCourse', 'days'].forEach(k => {
      if (t[k] != null && String(t[k]) !== '') row[k] = String(t[k]);
    });
  });
  if (f.current_progress) {
    data.books = String(f.current_progress).split(/\n+/).map(l => l.trim()).filter(Boolean).map(l => {
      const r = l.match(/\((\d{1,3})\s*%\)\s*$/);
      return { name: r ? l.slice(0, r.index).trim() : l, rate: r ? r[1] : '', teacher: '' };
    });
  }
  if (out.memo) data.ai_memo = String(out.memo);
  return out.check || [];
}

export { num };
