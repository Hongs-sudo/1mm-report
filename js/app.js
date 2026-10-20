// 1MM 보고서 · 수학도서관 — 앱 시작, 로그인, 화면 이동, 목록·학생·선생님·설정
import { $, $$, esc, toast, confirmBox, formBox, todayStr, monthKey, parseDate } from './util.js';
import {
  auth, login, logout, finishRedirect, onAuthStateChanged, OWNER_EMAIL,
  col, ref, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, serverTimestamp
} from './fb.js';
import { STATUS, newReportData, teacherLine } from './schema.js';
import { renderEditor, printNow } from './editor.js';
import { mobileHTML } from './render.js';
import { drCfg, setDrCfg, fetchDR } from './sources.js';

const app = $('#app');
const boot = $('#boot');
const phoneMQ = matchMedia('(max-width: 699px)');
const isPhone = () => phoneMQ.matches;

const ctx = {
  user: null, me: null, isAdmin: false, staff: [], staffNames: {}, config: {},
  main: null, onLeave: null,
  go(hash, replace = false) {
    if (replace) { history.replaceState(null, '', hash); route(); }
    else location.hash = hash;
  }
};

/* =========================================================
   설치 (PWA)
   ========================================================= */
let installEvt = null;
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; refreshInstall(); });
window.addEventListener('appinstalled', () => { installEvt = null; refreshInstall(); toast('바탕화면에 설치했습니다'); });
function refreshInstall() {
  $$('[data-install]').forEach(b => { b.hidden = standalone(); });
}
async function doInstall() {
  if (installEvt) {
    installEvt.prompt();
    const r = await installEvt.userChoice.catch(() => null);
    installEvt = null; refreshInstall();
    if (r && r.outcome === 'accepted') toast('설치를 시작했습니다');
    return;
  }
  return showInstallHelp();
}
function showInstallHelp() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const body = ios
    ? '<ol class="steps"><li>사파리 아래(아이패드는 위)의 <b>공유 버튼</b>(네모에서 화살표가 나온 모양)을 누릅니다.</li><li><b>홈 화면에 추가</b>를 누릅니다.</li><li>오른쪽 위 <b>추가</b>를 누르면 홈 화면에 1MM 보고서 아이콘이 생깁니다.</li></ol>'
    : '<ol class="steps"><li>크롬이나 엣지로 이 주소를 엽니다.</li><li>주소창 오른쪽 끝의 <b>설치 아이콘</b>(모니터에 화살표) 또는 메뉴(⋮) → <b>앱 설치</b> / <b>이 사이트를 앱으로 설치</b>를 누릅니다.</li><li>설치하면 바탕화면과 시작 메뉴에 아이콘이 생기고, 별도 창으로 열립니다.</li></ol><p class="hint">갤럭시탭·안드로이드 휴대폰은 크롬 메뉴(⋮) → <b>홈 화면에 추가</b>(또는 앱 설치)를 누르면 됩니다.</p>';
  return confirmBox({ title: ios ? '홈 화면에 추가하기' : '바탕화면에 앱으로 설치하기', body, ok: '알겠습니다', cancel: '닫기' });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw && nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) showUpdate();
        });
      });
    }).catch(() => {});
  });
}
function showUpdate() {
  const bar = document.createElement('div');
  bar.className = 'update-bar';
  bar.innerHTML = '새 버전이 있습니다. <button type="button" class="btn gold sm">새로고침</button>';
  bar.querySelector('button').onclick = () => location.reload();
  document.body.appendChild(bar);
}

/* =========================================================
   로그인
   ========================================================= */
function loginScreen(msg = '') {
  boot.hidden = true; app.hidden = false;
  app.className = 'login-wrap';
  app.innerHTML = `<div class="login">
    <img class="logo" src="img/logo_v.png" alt="수학도서관 1:1 명품 맞춤 수학학원">
    <h1>1개월 학습보고서</h1><p class="lat">Math Library · One Month Report</p>
    ${msg ? `<p class="login-msg">${msg}</p>` : ''}
    <button type="button" class="btn primary big" id="btn-login"><span class="g">G</span> 구글 계정으로 로그인</button>
    <p class="hint">원장님이 등록한 선생님 계정만 들어올 수 있습니다.</p>
    <button type="button" class="btn ghost sm" data-install hidden>바탕화면에 설치</button>
  </div>`;
  $('#btn-login').onclick = async () => {
    try { await login(); }
    catch (e) {
      console.error(e);
      const m = e && e.code === 'auth/unauthorized-domain' ? 'Firebase 승인된 도메인에 이 주소가 없습니다. 관리자에게 알려주세요.'
        : e && e.code === 'auth/popup-closed-by-user' ? '로그인 창이 닫혔습니다. 다시 눌러주세요.' : '로그인하지 못했습니다. 다시 시도해 주세요.';
      toast(m, 'err');
    }
  };
  $$('[data-install]').forEach(b => b.onclick = doInstall);
  refreshInstall();
}

function noAccess(email) {
  boot.hidden = true; app.hidden = false;
  app.className = 'login-wrap';
  app.innerHTML = `<div class="login">
    <img class="logo" src="img/logo_v.png" alt="수학도서관">
    <h1>등록되지 않은 계정입니다</h1>
    <p class="login-msg"><b>${esc(email)}</b> 계정은 아직 선생님 명단에 없습니다.<br>원장님께 이 이메일 주소를 알려드리고 등록을 요청해 주세요.</p>
    <button type="button" class="btn line" id="btn-out">다른 계정으로 로그인</button>
  </div>`;
  $('#btn-out').onclick = () => logout();
}

finishRedirect();
onAuthStateChanged(auth, async user => {
  if (!user) { ctx.user = null; loginScreen(); return; }
  const email = (user.email || '').toLowerCase();
  ctx.user = user;
  try {
    let snap = await getDoc(ref('staff', email));
    if (!snap.exists() && email === OWNER_EMAIL) {
      await setDoc(ref('staff', email), { email, name: user.displayName || '원장', role: 'admin', active: true, createdAt: serverTimestamp() });
      snap = await getDoc(ref('staff', email));
    }
    if (!snap.exists() || snap.data().active === false) { noAccess(email); return; }
    ctx.me = { email, ...snap.data() };
    ctx.isAdmin = email === OWNER_EMAIL || ctx.me.role === 'admin';
    await loadStaff();
    try { const c = await getDoc(ref('config', 'app')); ctx.config = c.exists() ? c.data() : {}; } catch { ctx.config = {}; }
    shell();
    route();
  } catch (e) {
    console.error(e);
    loginScreen('정보를 불러오지 못했습니다. Firestore 규칙이 게시되었는지 확인해 주세요.<br><small>' + esc(e.code || e.message || '') + '</small>');
  }
});

async function loadStaff() {
  const s = await getDocs(col('staff'));
  ctx.staff = s.docs.map(d => ({ email: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
  ctx.staffNames = Object.fromEntries(ctx.staff.map(s => [s.email, s.name || s.email]));
}

/* =========================================================
   화면 틀
   ========================================================= */
function shell() {
  boot.hidden = true; app.hidden = false;
  app.className = 'shell';
  const me = ctx.me;
  const nav = [
    ['list', '보고서 목록', 'doc'],
    ['new', '새 보고서', 'plus'],
    ['students', ctx.isAdmin ? '학생 · 담임 배정' : '내 담임반 학생', 'users']
  ];
  const adminNav = [['staff', '선생님 계정', 'key'], ['settings', '설정 · 연동', 'gear']];
  app.innerHTML = `
    <header class="topbar">
      <a class="brand" href="#/list"><img src="img/logo_h.png" alt="수학도서관"><span class="tt">1MM 보고서</span></a>
      <span class="sp"></span>
      <button type="button" class="btn gold sm" data-install hidden>⬇ 바탕화면에 설치</button>
      <div class="me"><span class="av">${esc((me.name || me.email).slice(0, 1))}</span><span class="nm">${esc(me.name || me.email)}</span><span class="rb ${ctx.isAdmin ? 'ad' : 'te'}">${ctx.isAdmin ? '관리자' : '선생님'}</span></div>
      <button type="button" class="btn ghost sm" id="btn-logout">로그아웃</button>
    </header>
    <div class="layout">
      <nav class="side" aria-label="메뉴">
        ${nav.map(([k, l, i]) => `<a href="#/${k}" data-nav="${k}" title="${l}"><i class="ico ${i}"></i><span>${l}</span></a>`).join('')}
        ${ctx.isAdmin ? `<span class="side-h">관리자 메뉴</span>${adminNav.map(([k, l, i]) => `<a href="#/${k}" data-nav="${k}" title="${l}"><i class="ico ${i}"></i><span>${l}</span></a>`).join('')}` : `<a href="#/settings" data-nav="settings"><i class="ico gear"></i><span>설정</span></a>`}
        <span class="side-f">수학도서관 · 1:1 명품 맞춤 수학학원</span>
      </nav>
      <main id="main" class="main"></main>
    </div>
    <nav class="tabbar" aria-label="메뉴">
      <a href="#/list" data-nav="list"><i class="ico doc"></i>보고서</a>
      <a href="#/students" data-nav="students"><i class="ico users"></i>학생</a>
      <a href="#/settings" data-nav="settings"><i class="ico gear"></i>내 정보</a>
    </nav>`;
  ctx.main = $('#main');
  $('#btn-logout').onclick = async () => { if (await confirmBox({ title: '로그아웃할까요?', ok: '로그아웃' })) { if (ctx.onLeave) ctx.onLeave(); logout(); } };
  $$('[data-install]').forEach(b => b.onclick = doInstall);
  refreshInstall();
}

window.addEventListener('hashchange', route);
// 화면 폭이 바뀌어도 작성 중인 화면은 그대로 둡니다 (휴대폰 판단은 화면을 열 때만)

async function route() {
  if (!ctx.me) return;
  if (ctx.onLeave) { try { ctx.onLeave(); } catch { /* */ } ctx.onLeave = null; }
  const h = location.hash.replace(/^#\/?/, '') || 'list';
  const [page, id] = h.split('/');
  $$('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === page || (page === 'report' && a.dataset.nav === 'list') || (page === 'view' && a.dataset.nav === 'list')));
  app.classList.toggle('wide', page === 'report');
  window.scrollTo({ top: 0 });
  const main = ctx.main;
  try {
    if (page === 'report' && id) {
      if (isPhone()) return ctx.go('#/view/' + id, true);
      return await renderEditor(ctx, id);
    }
    if (page === 'view' && id) return await renderView(id);
    if (page === 'new') return await renderNew();
    if (page === 'students') return await renderStudents();
    if (page === 'staff' && ctx.isAdmin) return await renderStaff();
    if (page === 'settings') return await renderSettings();
    return await renderList();
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="empty-state"><h2>화면을 불러오지 못했습니다</h2><p>${esc(e.code === 'permission-denied' ? '이 내용을 볼 권한이 없습니다.' : (e.message || ''))}</p><a class="btn primary" href="#/list">보고서 목록으로</a></div>`;
  }
}

/* =========================================================
   데이터 읽기 (권한에 맞춰)
   ========================================================= */
async function readScoped(name) {
  if (ctx.isAdmin) {
    const s = await getDocs(col(name));
    return s.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  const e = ctx.me.email;
  const [a, b] = await Promise.all([
    getDocs(query(col(name), where('homeroom', '==', e))),
    getDocs(query(col(name), where('sub', '==', e)))
  ]);
  const m = new Map();
  [...a.docs, ...b.docs].forEach(d => m.set(d.id, { id: d.id, ...d.data() }));
  return [...m.values()];
}
const tsVal = t => (t && t.toMillis ? t.toMillis() : 0);
const tsText = t => { if (!t || !t.toDate) return ''; const d = t.toDate(); return `${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const statusChip = s => { const x = STATUS[s] || STATUS.draft; return `<span class="s ${x.cls}">${x.label}</span>`; };
const canEditReport = r => ctx.isAdmin || (r.homeroom === ctx.me.email && r.status === 'draft');
const nm = em => ctx.staffNames[em] || em || '';

/* =========================================================
   보고서 목록
   ========================================================= */
let listFilter = { teacher: '', status: '', q: '' };
async function renderList() {
  const main = ctx.main;
  main.innerHTML = '<div class="loading">보고서를 불러오는 중…</div>';
  const reports = (await readScoped('reports')).sort((a, b) => tsVal(b.updatedAt) - tsVal(a.updatedAt));
  const counts = { all: reports.length, draft: 0, done: 0, consulted: 0 };
  reports.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
  const teachers = [...new Set(reports.flatMap(r => [r.homeroom, r.sub]).filter(Boolean))];

  const filtered = () => reports.filter(r =>
    (!listFilter.teacher || r.homeroom === listFilter.teacher || r.sub === listFilter.teacher) &&
    (!listFilter.status || r.status === listFilter.status) &&
    (!listFilter.q || (r.studentName || '').includes(listFilter.q)));

  const roleOf = r => r.homeroom === ctx.me.email ? '담임' : r.sub === ctx.me.email ? '부담임' : '';
  const rowHTML = r => {
    const d = r.data || {};
    const mine = !ctx.isAdmin ? `<span class="tg ${roleOf(r) === '담임' ? 'a' : 's'}">${roleOf(r)}</span>` : '';
    const href = canEditReport(r) ? `#/report/${r.id}` : `#/view/${r.id}`;
    return `<tr data-href="${href}" tabindex="0"><td><b>${esc(r.studentName)}</b> ${mine}</td><td>${esc([d.school, d.grade].filter(Boolean).join(' '))}</td><td>${esc(d.join_date || '')}</td>
      <td>${esc(nm(r.homeroom))} <span class="tg a">담임</span>${r.sub ? ` · ${esc(nm(r.sub))} <span class="tg s">부담임</span>` : ''}</td>
      <td>${statusChip(r.status)}</td><td class="mute">${tsText(r.updatedAt)} ${esc(r.updatedBy || '')}</td>
      <td class="acts"><a class="btn ghost sm" href="#/view/${r.id}">보기</a>${canEditReport(r) ? `<a class="btn line sm" href="#/report/${r.id}">작성</a>` : ''}</td></tr>`;
  };
  const cardHTML = r => {
    const d = r.data || {};
    return `<a class="card-item" href="#/view/${r.id}"><span class="av">${esc((r.studentName || '?').slice(0, 1))}</span><div><b>${esc(r.studentName)}</b><small>${esc([d.school, d.grade].filter(Boolean).join(' '))} · ${esc(teacherLine(d))}</small></div>${statusChip(r.status)}</a>`;
  };

  function draw() {
    const rows = filtered();
    main.innerHTML = `
      <div class="page-h"><h1>보고서 목록</h1><span class="sp"></span><a class="btn gold" href="#/new">＋ 새 보고서</a></div>
      <div class="kpis">
        <button type="button" class="kpi ${!listFilter.status ? 'on' : ''}" data-st=""><small>전체</small><b>${counts.all}</b></button>
        <button type="button" class="kpi ${listFilter.status === 'draft' ? 'on' : ''}" data-st="draft"><small>작성 중</small><b>${counts.draft || 0}</b></button>
        <button type="button" class="kpi ${listFilter.status === 'done' ? 'on' : ''}" data-st="done"><small>완료</small><b>${counts.done || 0}</b></button>
        <button type="button" class="kpi ${listFilter.status === 'consulted' ? 'on' : ''}" data-st="consulted"><small>상담 끝</small><b>${counts.consulted || 0}</b></button>
      </div>
      <div class="filters">
        <input class="fi search" id="f-q" placeholder="학생 이름으로 찾기" value="${esc(listFilter.q)}">
        ${ctx.isAdmin ? `<div class="chips"><button type="button" class="${!listFilter.teacher ? 'on' : ''}" data-tf="">선생님 전체</button>${teachers.map(t => `<button type="button" class="${listFilter.teacher === t ? 'on' : ''}" data-tf="${esc(t)}">${esc(nm(t))}</button>`).join('')}</div>` : ''}
      </div>
      ${rows.length ? `
        <div class="tw desk-only"><table class="st"><thead><tr><th>학생</th><th>학교 · 학년</th><th>입회일</th><th>담임 / 부담임</th><th>상태</th><th>마지막 수정</th><th></th></tr></thead><tbody>${rows.map(rowHTML).join('')}</tbody></table></div>
        <div class="cards phone-only">${rows.map(cardHTML).join('')}</div>`
      : `<div class="empty-state"><h2>${reports.length ? '조건에 맞는 보고서가 없습니다' : '아직 보고서가 없습니다'}</h2><p>${reports.length ? '필터를 바꿔 보세요.' : (ctx.isAdmin ? '먼저 학생을 등록하고 담임을 배정한 뒤, 새 보고서를 만들어 주세요.' : '담임반 학생의 새 보고서를 만들어 주세요.')}</p>${reports.length ? '' : `<a class="btn primary" href="#/${ctx.isAdmin ? 'students' : 'new'}">${ctx.isAdmin ? '학생 등록하기' : '새 보고서 만들기'}</a>`}</div>`}`;
    $$('[data-st]', main).forEach(b => b.onclick = () => { listFilter.status = b.dataset.st; draw(); });
    $$('[data-tf]', main).forEach(b => b.onclick = () => { listFilter.teacher = b.dataset.tf; draw(); });
    const q = $('#f-q', main);
    q.oninput = () => { listFilter.q = q.value.trim(); const pos = q.selectionStart; draw(); const n = $('#f-q', main); n.focus(); n.setSelectionRange(pos, pos); };
    $$('tr[data-href]', main).forEach(tr => {
      tr.onclick = e => { if (!e.target.closest('a')) location.hash = tr.dataset.href; };
      tr.onkeydown = e => { if (e.key === 'Enter') location.hash = tr.dataset.href; };
    });
  }
  draw();
}

/* =========================================================
   새 보고서
   ========================================================= */
async function renderNew() {
  const main = ctx.main;
  main.innerHTML = '<div class="loading">학생 명단을 불러오는 중…</div>';
  const students = (await readScoped('students')).filter(s => s.active !== false && (ctx.isAdmin || s.homeroom === ctx.me.email))
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
  const reports = await readScoped('reports');
  const has = new Map(); reports.forEach(r => { has.set(r.studentId, (has.get(r.studentId) || 0) + 1); });
  main.innerHTML = `
    <div class="page-h"><h1>새 보고서</h1></div>
    <p class="lead">보고서를 쓸 학생을 고르세요. 학교·학년·입회일·담임/부담임이 채워진 상태로 시작합니다.</p>
    <input class="fi search" id="n-q" placeholder="학생 이름으로 찾기">
    ${students.length ? `<div class="pick" id="pick">${students.map(s => `<button type="button" class="pick-item" data-id="${s.id}" data-name="${esc(s.name)}">
      <span class="av">${esc((s.name || '?').slice(0, 1))}</span><div><b>${esc(s.name)}</b><small>${esc([s.school, s.grade].filter(Boolean).join(' '))}${s.joinDate ? ' · 입회 ' + esc(s.joinDate) : ''}</small><small>${esc(nm(s.homeroom))} 담임${s.sub ? ' · ' + esc(nm(s.sub)) + ' 부담임' : ''}</small></div>
      ${has.get(s.id) ? `<span class="s n">보고서 ${has.get(s.id)}개</span>` : ''}</button>`).join('')}</div>`
    : `<div class="empty-state"><h2>보고서를 쓸 수 있는 학생이 없습니다</h2><p>${ctx.isAdmin ? '학생을 먼저 등록해 주세요.' : '담임으로 배정된 학생이 없습니다. 원장님께 담임 배정을 요청해 주세요.'}</p>${ctx.isAdmin ? '<a class="btn primary" href="#/students">학생 등록하기</a>' : ''}</div>`}`;
  const q = $('#n-q');
  q.oninput = () => $$('.pick-item').forEach(b => { b.hidden = q.value && !b.dataset.name.includes(q.value.trim()); });
  $$('.pick-item').forEach(b => b.onclick = async () => {
    const s = students.find(x => x.id === b.dataset.id);
    if (has.get(s.id) && !await confirmBox({ title: '이미 보고서가 있는 학생입니다', body: `<p>${esc(s.name)} 학생의 보고서가 ${has.get(s.id)}개 있습니다. 새로 하나 더 만들까요?</p>`, ok: '새로 만들기' })) return;
    b.disabled = true;
    try {
      const data = newReportData(s, ctx.staffNames);
      data.consult_date = '';
      const docRef = await addDoc(col('reports'), {
        studentId: s.id, studentName: s.name, homeroom: s.homeroom || '', sub: s.sub || '',
        month: monthKey(), status: 'draft', data,
        createdAt: serverTimestamp(), createdBy: ctx.me.email,
        updatedAt: serverTimestamp(), updatedBy: ctx.me.name || ctx.me.email, updatedByEmail: ctx.me.email
      });
      ctx.go(isPhone() ? '#/view/' + docRef.id : '#/report/' + docRef.id);
    } catch (e) { console.error(e); toast('보고서를 만들지 못했습니다 (' + (e.code || '') + ')', 'err'); b.disabled = false; }
  });
}

/* =========================================================
   학생 · 담임 배정
   ========================================================= */
async function renderStudents() {
  const main = ctx.main;
  main.innerHTML = '<div class="loading">학생 명단을 불러오는 중…</div>';
  const students = (await readScoped('students')).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
  const teachers = ctx.staff.filter(s => s.active !== false);
  const opt = (sel, none) => (none ? `<option value="">${none}</option>` : '') + teachers.map(t => `<option value="${esc(t.email)}" ${sel === t.email ? 'selected' : ''}>${esc(t.name || t.email)}</option>`).join('');
  let q = '', tf = '';
  function draw() {
    const rows = students.filter(s => (!q || (s.name || '').includes(q)) && (!tf || s.homeroom === tf || s.sub === tf));
    main.innerHTML = `
      <div class="page-h"><h1>${ctx.isAdmin ? '학생 · 담임 배정' : '내 담임반 학생'}</h1><span class="sp"></span>
        ${ctx.isAdmin ? '<button type="button" class="btn line" id="bulk">여러 명 붙여넣기</button><button type="button" class="btn gold" id="add">＋ 학생 등록</button>' : ''}</div>
      ${ctx.isAdmin ? '' : '<p class="lead">담임으로 배정된 학생과, 부담임으로 함께 수업하는 학생입니다. 학생 등록과 담임 배정은 관리자가 합니다.</p>'}
      <div class="filters"><input class="fi search" id="s-q" placeholder="이름으로 찾기" value="${esc(q)}">
        ${ctx.isAdmin ? `<select class="fi sel" id="s-tf"><option value="">선생님 전체</option>${opt(tf)}</select>` : ''}<span class="mute">${rows.length}명</span></div>
      ${rows.length ? `<div class="tw"><table class="st"><thead><tr><th>이름</th><th>학교</th><th>학년</th><th>입회일</th><th>담임</th><th>부담임</th>${ctx.isAdmin ? '<th></th>' : ''}</tr></thead><tbody>
        ${rows.map(s => `<tr class="${s.active === false ? 'off' : ''}"><td><b>${esc(s.name)}</b>${s.active === false ? ' <span class="s n">퇴원</span>' : ''}${!ctx.isAdmin ? ` <span class="tg ${s.homeroom === ctx.me.email ? 'a' : 's'}">${s.homeroom === ctx.me.email ? '담임' : '부담임'}</span>` : ''}</td><td>${esc(s.school || '')}</td><td>${esc(s.grade || '')}</td><td>${esc(s.joinDate || '')}</td><td>${esc(nm(s.homeroom))}</td><td>${esc(nm(s.sub))}</td>${ctx.isAdmin ? `<td class="acts"><button type="button" class="btn ghost sm" data-edit="${s.id}">고치기</button></td>` : ''}</tr>`).join('')}
      </tbody></table></div>` : `<div class="empty-state"><h2>${students.length ? '찾는 학생이 없습니다' : '등록된 학생이 없습니다'}</h2>${ctx.isAdmin && !students.length ? '<p>학생을 등록하고 담임을 정하면, 그 선생님 화면에 학생이 나타납니다.</p>' : ''}</div>`}`;
    const qi = $('#s-q'); qi.oninput = () => { q = qi.value.trim(); const p = qi.selectionStart; draw(); const n = $('#s-q'); n.focus(); n.setSelectionRange(p, p); };
    const t = $('#s-tf'); if (t) t.onchange = () => { tf = t.value; draw(); };
    const add = $('#add'); if (add) add.onclick = () => editStudent(null);
    const bulk = $('#bulk'); if (bulk) bulk.onclick = bulkAdd;
    $$('[data-edit]').forEach(b => b.onclick = () => editStudent(students.find(s => s.id === b.dataset.edit)));
  }
  async function editStudent(s) {
    const r = await formBox({
      title: s ? `${s.name} 정보 고치기` : '학생 등록',
      html: `<div class="row2"><div><label class="lb">이름</label><input class="fi full" name="name" required value="${esc(s?.name || '')}"></div><div><label class="lb">입회일</label><input class="fi full" name="joinDate" placeholder="2026.09.01" value="${esc(s?.joinDate || '')}"></div></div>
        <div class="row2"><div><label class="lb">학교</label><input class="fi full" name="school" placeholder="예) 염경중" value="${esc(s?.school || '')}"></div><div><label class="lb">학년</label><input class="fi full" name="grade" placeholder="예) 2학년" value="${esc(s?.grade || '')}"></div></div>
        <div class="row2"><div><label class="lb">담임</label><select class="fi sel full" name="homeroom" required>${opt(s?.homeroom || '', '선택하세요')}</select></div><div><label class="lb">부담임 (없으면 비워두기)</label><select class="fi sel full" name="sub">${opt(s?.sub || '', '없음')}</select></div></div>
        ${s ? `<label class="chk"><input type="checkbox" name="inactive" ${s.active === false ? 'checked' : ''}> 퇴원 처리 (목록에서 흐리게 표시, 새 보고서 대상에서 빠짐)</label>` : ''}
        ${s ? '<button type="button" class="btn ghost sm danger-t" id="del-stu">이 학생 삭제</button>' : ''}`,
      onMount: f => { const d = f.querySelector('#del-stu'); if (d) d.onclick = async () => { $('#modal-root').innerHTML = ''; if (await confirmBox({ title: `${s.name} 학생을 삭제할까요?`, body: '<p>학생 정보만 지워지고, 이미 만든 보고서는 남습니다.</p>', ok: '삭제', danger: true })) { await deleteDoc(ref('students', s.id)); toast('삭제했습니다'); renderStudents(); } }; }
    });
    if (!r) return;
    if (r.sub && r.sub === r.homeroom) { toast('담임과 부담임을 같은 선생님으로 정할 수 없습니다', 'err'); return; }
    const payload = { name: r.name.trim(), school: r.school.trim(), grade: r.grade.trim(), joinDate: r.joinDate.trim(), homeroom: r.homeroom, sub: r.sub || '', active: !r.inactive, updatedAt: serverTimestamp() };
    try {
      if (s) {
        await updateDoc(ref('students', s.id), payload);
        // 담임이 바뀌면 이 학생의 보고서 권한도 함께 옮김
        if (s.homeroom !== payload.homeroom || (s.sub || '') !== payload.sub) {
          const rs = await getDocs(query(col('reports'), where('studentId', '==', s.id)));
          await Promise.all(rs.docs.map(d => updateDoc(d.ref, { homeroom: payload.homeroom, sub: payload.sub })));
        }
      } else {
        await addDoc(col('students'), { ...payload, createdAt: serverTimestamp() });
      }
      toast('저장했습니다'); renderStudents();
    } catch (e) { console.error(e); toast('저장하지 못했습니다 (' + (e.code || '') + ')', 'err'); }
  }
  async function bulkAdd() {
    const r = await formBox({
      title: '여러 명 붙여넣기', wide: true,
      html: `<p class="hint">엑셀에서 <b>이름 · 학교 · 학년 · 입회일</b> 순서로 된 칸을 복사해 붙여넣으세요. 한 줄에 한 명입니다.</p>
        <textarea class="ta full" name="rows" rows="10" placeholder="정서윤	염경중	2학년	2026.09.01"></textarea>
        <div class="row2"><div><label class="lb">담임</label><select class="fi sel full" name="homeroom" required>${opt('', '선택하세요')}</select></div><div><label class="lb">부담임</label><select class="fi sel full" name="sub">${opt('', '없음')}</select></div></div>`,
      ok: '등록'
    });
    if (!r) return;
    const lines = r.rows.split(/\r?\n/).map(l => l.split(/\t|,/).map(x => x.trim())).filter(c => c[0]);
    if (!lines.length) return;
    try {
      await Promise.all(lines.map(c => addDoc(col('students'), { name: c[0], school: c[1] || '', grade: c[2] || '', joinDate: c[3] || '', homeroom: r.homeroom, sub: r.sub || '', active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })));
      toast(`${lines.length}명을 등록했습니다`); renderStudents();
    } catch (e) { console.error(e); toast('등록하지 못했습니다', 'err'); }
  }
  draw();
}

/* =========================================================
   선생님 계정 (관리자)
   ========================================================= */
async function renderStaff() {
  await loadStaff();
  const main = ctx.main;
  main.innerHTML = `
    <div class="page-h"><h1>선생님 계정</h1><span class="sp"></span><button type="button" class="btn gold" id="add">＋ 선생님 추가</button></div>
    <p class="lead">구글 계정 이메일로 등록하면, 그 선생님이 같은 계정으로 로그인해 들어올 수 있습니다. 선생님은 자기가 담임인 학생의 보고서만 쓸 수 있고, 부담임으로 들어간 학생은 보기만 할 수 있습니다.</p>
    <div class="tw"><table class="st"><thead><tr><th>이름</th><th>이메일</th><th>권한</th><th>상태</th><th></th></tr></thead><tbody>
      ${ctx.staff.map(s => `<tr class="${s.active === false ? 'off' : ''}"><td><b>${esc(s.name || '')}</b></td><td>${esc(s.email)}</td><td><span class="rb ${s.role === 'admin' ? 'ad' : 'te'}">${s.role === 'admin' ? '관리자' : '선생님'}</span></td><td>${s.active === false ? '<span class="s n">사용 중지</span>' : '<span class="s d">사용 중</span>'}</td>
      <td class="acts">${s.email === OWNER_EMAIL ? '<span class="mute">원장 계정</span>' : `<button type="button" class="btn ghost sm" data-edit="${esc(s.email)}">고치기</button>`}</td></tr>`).join('')}
    </tbody></table></div>`;
  const edit = async s => {
    const r = await formBox({
      title: s ? `${s.name} 선생님` : '선생님 추가',
      html: `<label class="lb">구글 계정 이메일</label><input class="fi full" name="email" type="email" required value="${esc(s?.email || '')}" ${s ? 'readonly' : ''} placeholder="teacher@gmail.com">
        <label class="lb">이름 (보고서에 표시)</label><input class="fi full" name="name" required value="${esc(s?.name || '')}" placeholder="예) 고하송">
        <label class="lb">권한</label><select class="fi sel full" name="role"><option value="teacher" ${s?.role !== 'admin' ? 'selected' : ''}>선생님 — 담임반 학생만</option><option value="admin" ${s?.role === 'admin' ? 'selected' : ''}>관리자 — 모든 학생, 계정·배정 관리</option></select>
        ${s ? `<label class="chk"><input type="checkbox" name="off" ${s.active === false ? 'checked' : ''}> 사용 중지 (로그인해도 들어올 수 없음)</label>` : ''}`
    });
    if (!r) return;
    const email = r.email.trim().toLowerCase();
    try {
      await setDoc(ref('staff', email), { email, name: r.name.trim(), role: r.role, active: !r.off, updatedAt: serverTimestamp() }, { merge: true });
      toast('저장했습니다'); renderStaff();
    } catch (e) { console.error(e); toast('저장하지 못했습니다', 'err'); }
  };
  $('#add').onclick = () => edit(null);
  $$('[data-edit]').forEach(b => b.onclick = () => edit(ctx.staff.find(s => s.email === b.dataset.edit)));
}

/* =========================================================
   설정 · 연동
   ========================================================= */
async function renderSettings() {
  const main = ctx.main;
  const c = drCfg();
  main.innerHTML = `
    <div class="page-h"><h1>${ctx.isAdmin ? '설정 · 연동' : '설정'}</h1></div>
    <section class="panel">
      <h2>내 계정</h2>
      <p><b>${esc(ctx.me.name || '')}</b> · ${esc(ctx.me.email)} · ${ctx.isAdmin ? '관리자' : '선생님'}</p>
      <div class="btn-row"><button type="button" class="btn gold" data-install hidden>⬇ 바탕화면에 설치</button><button type="button" class="btn line" id="how-install">설치 방법 보기</button></div>
    </section>
    <section class="panel">
      <h2>데일리 리포트 연동 <span class="mute">이 기기에만 저장</span></h2>
      <p class="hint">데일리 리포트 앱의 <b>설정 · 백업 → 기기 간 동기화</b>에 넣은 저장소 이름과 토큰을 그대로 넣으면, 보고서 작성 화면에서 학생의 출결·과제·진도를 불러올 수 있습니다. 토큰은 이 기기 브라우저에만 저장되고 서버로 보내지 않습니다.</p>
      <div class="row2"><div><label class="lb" for="dr-repo">저장소</label><input class="fi full" id="dr-repo" value="${esc(c.repo)}" placeholder="Hongs-sudo/daily-report-data"></div><div><label class="lb" for="dr-path">파일 이름</label><input class="fi full" id="dr-path" value="${esc(c.path)}"></div></div>
      <label class="lb" for="dr-token">접근 토큰</label><input class="fi full" id="dr-token" type="password" value="${esc(c.token)}" placeholder="github_pat_…" autocomplete="off">
      <div class="btn-row"><button type="button" class="btn primary" id="dr-save">저장하고 연결 확인</button>${c.repo ? '<button type="button" class="btn ghost" id="dr-clear">연결 지우기</button>' : ''}</div>
      <p class="hint" id="dr-msg"></p>
    </section>
    ${ctx.isAdmin ? `<section class="panel">
      <h2>AI 자동 인식 <span class="mute">학원 전체 공통</span></h2>
      <p class="hint">입회원서 사진과 수업 기록 엑셀을 AI로 읽어 채우는 기능입니다. Cloudflare에 AI 중계 서버(저장소의 <b>worker/ai-proxy.js</b>)를 올리고 그 주소를 넣으면, 모든 선생님의 "자료 보기" 화면에 <b>AI로 읽어서 채우기</b> 버튼이 나타납니다. 비워두면 사진·엑셀을 옆에 띄워 놓고 직접 입력합니다.</p>
      <label class="lb" for="ai-ep">AI 중계 서버 주소</label><input class="fi full" id="ai-ep" value="${esc(ctx.config.aiEndpoint || '')}" placeholder="https://mathlibrary-ai.○○○.workers.dev">
      <div class="btn-row"><button type="button" class="btn primary" id="ai-save">저장</button></div>
    </section>
    <section class="panel">
      <h2>Firestore 권한 규칙</h2>
      <p class="hint">선생님이 담임반 학생만 볼 수 있게 막는 규칙입니다. 저장소의 <b>firestore.rules</b> 내용을 Firebase 콘솔 → Firestore Database → 규칙에 붙여넣고 게시해 두어야 합니다.</p>
    </section>` : ''}`;
  $$('[data-install]', main).forEach(b => b.onclick = doInstall);
  refreshInstall();
  $('#how-install').onclick = () => showInstallHelp();
  $('#dr-save').onclick = async () => {
    setDrCfg({ repo: $('#dr-repo').value, token: $('#dr-token').value, path: $('#dr-path').value });
    const msg = $('#dr-msg'); msg.textContent = '연결 확인 중…';
    try { const db = await fetchDR(true); msg.textContent = `연결됐습니다. 수업 기록 ${db.records.length}개, 학생 ${(db.students || []).length}명.`; msg.className = 'hint ok'; }
    catch (e) { msg.textContent = e.message; msg.className = 'hint err'; }
  };
  const clr = $('#dr-clear'); if (clr) clr.onclick = () => { setDrCfg({ repo: '', token: '', path: '' }); renderSettings(); };
  const ai = $('#ai-save');
  if (ai) ai.onclick = async () => {
    const v = $('#ai-ep').value.trim();
    try { await setDoc(ref('config', 'app'), { aiEndpoint: v }, { merge: true }); ctx.config.aiEndpoint = v; toast('저장했습니다'); }
    catch (e) { console.error(e); toast('저장하지 못했습니다', 'err'); }
  };
}

/* =========================================================
   보고서 보기 (휴대폰 · 읽기 전용, 모든 항목)
   ========================================================= */
async function renderView(id) {
  const main = ctx.main;
  main.innerHTML = '<div class="loading">보고서를 여는 중…</div>';
  const snap = await getDoc(ref('reports', id));
  if (!snap.exists()) { main.innerHTML = '<div class="empty-state"><h2>보고서를 찾을 수 없습니다</h2><a class="btn primary" href="#/list">보고서 목록으로</a></div>'; return; }
  const r = { id, ...snap.data() };
  r.data = r.data || {}; r.data.teachers = r.data.teachers || []; r.data.answers = r.data.answers || {};
  const st = STATUS[r.status] || STATUS.draft;
  const edit = canEditReport(r);
  main.innerHTML = `
    <div class="view-bar"><a class="btn ghost sm" href="#/list">‹ 목록</a><span class="sp"></span>${!edit ? '<span class="ro-chip">보기 전용</span>' : ''}${edit && !isPhone() ? `<a class="btn line sm" href="#/report/${id}">작성 화면</a>` : ''}<button type="button" class="btn primary sm" id="v-pdf">PDF</button></div>
    ${edit && isPhone() ? '<p class="phone-note">고치려면 PC나 태블릿에서 열어주세요. 휴대폰에서는 보고서 내용을 확인만 할 수 있습니다.</p>' : ''}
    <article class="mv">${mobileHTML(r, st.label)}</article>
    ${ctx.isAdmin ? `<div class="view-admin"><label class="lb" for="v-st">상태</label><select class="fi sel" id="v-st">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${r.status === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></div>` : ''}`;
  $('#v-pdf').onclick = () => printNow(r);
  const vs = $('#v-st');
  if (vs) vs.onchange = async () => {
    try { await updateDoc(ref('reports', id), { status: vs.value, updatedAt: serverTimestamp(), updatedBy: ctx.me.name || ctx.me.email }); toast('상태를 바꿨습니다'); renderView(id); }
    catch (e) { console.error(e); toast('상태를 바꾸지 못했습니다', 'err'); }
  };
}
