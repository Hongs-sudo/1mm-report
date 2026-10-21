// 보고서 작성 화면 (PC 풀버전 · 태블릿)
// 가운데: 시안① 지면 그대로 입력 / 양쪽 패널: 접기 · 펼치기 · 넓게
import { $, $$, esc, debounce, toast, confirmBox, formBox, lsGet, lsSet } from './util.js';
import { ref, getDoc, updateDoc, deleteDoc, serverTimestamp } from './fb.js';
import { Q, STATUS, SUMMARY_ORDER, sums, teacherLine, newTeacherRow, newBook, newRoad, normalize, genCoaching, genPrelearning, genBriefing3, answeredCount } from './schema.js';
import { sheetPages, printHTML } from './render.js';
import { drReady, fetchDR, setDRFromObject, drStudentNames, computeDR, applyDR, Uploads, sheetHTML, sheetHitCount, aiRead, applyAI } from './sources.js';

const PAGES = [
  { n: '·', label: '표지' },
  { n: '1', label: '기본 정보 · 출결 · 과제' },
  { n: '2', label: '관찰 평가 · 지도 계획' },
  { n: '3', label: '관찰 평가 · 브리핑' }
];
const PAGE_OF = { homework_error: 1, focus: 2, roadmap_speed: 2, motivation: 2, coaching: 2, prelearning_reaction: 2, arithmetic: 3, problem_speed: 3, health: 3, question_frequency: 3 };
const narrow = () => matchMedia('(max-width: 1023px)').matches;

function loadUI() {
  // 처음 열 때: 넓은 PC는 양쪽 패널을 펴고, 태블릿 가로처럼 덜 넓은 화면은 오른쪽을 접어 지면을 크게
  const def = { l: false, r: innerWidth < 1400, w: false, z: 'fit' };
  try { const saved = lsGet('mm.ui', ''); return saved ? Object.assign(def, JSON.parse(saved)) : def; }
  catch { return def; }
}

export async function renderEditor(ctx, id) {
  const { main, me, isAdmin, staffNames, config, go } = ctx;
  main.innerHTML = '<div class="loading">보고서를 여는 중…</div>';
  const snap = await getDoc(ref('reports', id)).catch(e => { console.error(e); return null; });
  if (!snap || !snap.exists()) {
    main.innerHTML = `<div class="empty-state"><h2>보고서를 열 수 없습니다</h2><p>지워졌거나 볼 권한이 없는 보고서입니다.</p><a class="btn primary" href="#/list">보고서 목록으로</a></div>`;
    return;
  }
  const report = { id, ...snap.data() };
  const canEdit = isAdmin || (report.homeroom === me.email && report.status === 'draft');
  if (!canEdit) { go('#/view/' + id, true); return; }

  const data = normalize(report.data);
  report.data = data;
  const ui = loadUI();
  if (narrow()) { ui.l = true; ui.r = true; }
  const st = { page: 1, all: false, view: 'edit', right: 'summary', savedAt: null, dirty: false };
  const uploads = new Uploads();

  main.innerHTML = `
  <div class="ed2" id="ed">
    <aside class="side2 left" id="pl" aria-label="학생과 페이지">
      <div class="s2-h"><span class="t">학생 · 페이지</span><button type="button" class="ic-btn" data-panel="l" title="접기" aria-label="왼쪽 패널 접기">⟨</button></div>
      <div class="s2-rail"><button type="button" class="ic-btn" data-panel="l" title="펼치기" aria-label="왼쪽 패널 펼치기">⟩</button><button type="button" class="rail-t" data-panel="l">학생 · 페이지</button></div>
      <div class="s2-b">
        <div class="stu-card"><b>${esc(report.studentName)}</b><small>${esc([data.school, data.grade].filter(Boolean).join(' '))}${data.join_date ? ' · 입회 ' + esc(data.join_date) : ''}</small><small id="who-line">${esc(teacherLine(data)) || '담임 미지정'}</small></div>
        <span class="s2-lb">기본 내용 불러오기</span>
        <button type="button" class="btn line full" id="btn-dr">데일리 리포트에서 불러오기</button>
        <button type="button" class="btn line full" id="btn-up">자료 올리기 (입회원서 · 엑셀)</button>
        <p class="hint">${drReady() ? '데일리 리포트 저장소가 이 기기에 연결되어 있습니다.' : '데일리 리포트는 설정에서 연결하거나, 백업 파일(json)을 자료로 올려도 됩니다.'}</p>
        <span class="s2-lb">페이지</span>
        <nav class="pages" id="pages">${PAGES.map((p, i) => `<button type="button" data-pg="${i}"><em>${p.n}</em>${p.label}</button>`).join('')}</nav>
        <div class="seg"><button type="button" id="v-one" class="on">한 장씩</button><button type="button" id="v-all">전체 펼쳐 보기</button></div>
      </div>
    </aside>

    <main class="ctr" id="ctr">
      <div class="cbar">
        <span class="save" id="save">저장됨</span>
        <button type="button" class="btn line sm" id="focus" title="양쪽 패널을 접고 지면만 크게">⤢ 지면만 크게</button>
        <div class="seg sm" role="group" aria-label="지면 크기"><button type="button" data-zoom="fit">폭 맞춤</button><button type="button" data-zoom="1">100%</button></div>
        <span class="sp"></span>
        <div class="seg sm" role="group" aria-label="보기"><button type="button" data-view="edit" class="on">작성</button><button type="button" data-view="print">인쇄 미리보기</button></div>
        <button type="button" class="btn primary sm" id="btn-pdf">PDF</button>
      </div>
      <div class="ctr-scroll" id="scr">
        <div class="sheets2" id="sheets"></div>
        <div class="pnav" id="pnav"><button type="button" class="btn line" id="prev">← 이전</button><div class="dots" id="dots"></div><button type="button" class="btn primary" id="next">다음 →</button></div>
      </div>
    </main>

    <aside class="side2 right" id="pr" aria-label="선택 현황과 자료">
      <div class="s2-h"><span class="t">선택 현황 · 자료</span><button type="button" class="ic-btn" id="wide" title="넓게 / 보통" aria-label="오른쪽 패널 넓게">⇔</button><button type="button" class="ic-btn" data-panel="r" title="접기" aria-label="오른쪽 패널 접기">⟩</button></div>
      <div class="s2-rail"><button type="button" class="ic-btn" data-panel="r" title="펼치기" aria-label="오른쪽 패널 펼치기">⟨</button><button type="button" class="rail-t" data-rail="summary">선택 현황 <em id="rail-cnt"></em></button><button type="button" class="rail-t" data-rail="files">자료 보기</button></div>
      <div class="tabs2"><button type="button" data-r="summary" class="on">선택 현황</button><button type="button" data-r="files">자료 보기</button></div>
      <div class="s2-b" id="right-body"></div>
      <div class="s2-foot"><span class="s2-lb">보고서 상태</span><div id="status-box"></div></div>
    </aside>
  </div>`;

  const ed = $('#ed'), sheets = $('#sheets'), scr = $('#scr');

  /* ---------------- 패널 ---------------- */
  function applyUI(save = true) {
    ed.classList.toggle('l-closed', ui.l);
    ed.classList.toggle('r-closed', ui.r);
    ed.classList.toggle('r-wide', ui.w);
    $('#focus').classList.toggle('on', ui.l && ui.r);
    $$('[data-zoom]').forEach(b => b.classList.toggle('on', String(ui.z) === b.dataset.zoom));
    if (save && !narrow()) lsSet('mm.ui', JSON.stringify(ui));
    setTimeout(fit, 220);
  }
  function setPanel(side, closed) {
    ui[side] = closed;
    if (narrow() && !closed) ui[side === 'l' ? 'r' : 'l'] = true; // 좁은 화면: 한쪽만
    applyUI();
  }

  /* ---------------- 저장 ---------------- */
  const saveEl = $('#save');
  function setSave(state) {
    const t = st.savedAt ? `${String(st.savedAt.getHours()).padStart(2, '0')}:${String(st.savedAt.getMinutes()).padStart(2, '0')}` : '';
    saveEl.textContent = state === 'saving' ? '저장 중…' : state === 'dirty' ? '저장 대기' : state === 'error' ? '저장 실패 · 다시 시도합니다' : `저장됨${t ? ' ' + t : ''}`;
    saveEl.className = 'save ' + state;
  }
  const doSave = async () => {
    if (!st.dirty) return;
    st.dirty = false;
    setSave('saving');
    try {
      await updateDoc(ref('reports', id), { data, studentName: data.student_name || report.studentName, updatedAt: serverTimestamp(), updatedBy: me.name || me.email, updatedByEmail: me.email });
      st.savedAt = new Date(); setSave('saved');
    } catch (e) {
      console.error(e); st.dirty = true; setSave('error'); setTimeout(() => save(), 4000);
    }
  };
  const save = debounce(doSave, 1200);
  function touch() { st.dirty = true; setSave('dirty'); save(); checkOverflowSoon(); }
  const flush = () => { if (st.dirty) save.flush(); };
  const onVis = () => { if (document.hidden) flush(); };
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('pagehide', flush);
  ctx.onLeave = () => { flush(); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('resize', onResize); probe.remove(); };

  /* ---------------- 지면 ---------------- */
  function renderSheets(keepScroll = false) {
    const top = scr.scrollTop;
    const edit = st.view === 'edit';
    const pages = sheetPages(report, { edit });
    const idx = (st.all || !edit) ? [0, 1, 2, 3] : [st.page];
    sheets.innerHTML = idx.map(i => `<div class="pg-wrap" data-p="${i}">${pages[i]}<div class="over-badge" hidden>이 쪽 내용이 넘쳐서 인쇄할 때 아래가 잘립니다. 글을 조금 줄여 주세요.</div></div>`).join('');
    sheets.classList.toggle('editing', edit);
    $$('textarea.e', sheets).forEach(grow);
    $$('#pages button').forEach(b => b.classList.toggle('on', +b.dataset.pg === st.page));
    $('#v-one').classList.toggle('on', !st.all); $('#v-all').classList.toggle('on', st.all);
    $('#pnav').hidden = st.all || !edit;
    $('#prev').disabled = st.page === 0;
    $('#next').textContent = st.page === 3 ? (isAdmin ? 'PDF 출력' : '완료 처리') : '다음 →';
    $('#dots').innerHTML = PAGES.map((p, i) => `<button type="button" class="${i === st.page ? 'on' : ''}" data-pg="${i}" aria-label="${p.label}">${p.n}</button>`).join('');
    fit();
    if (keepScroll) scr.scrollTop = top;
    checkOverflowSoon();
  }
  function grow(t) { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }
  function fit() {
    const pg = sheets.querySelector('.pr-page'); if (!pg) return;
    const w = pg.offsetWidth;
    const avail = scr.clientWidth - 32;
    const z = ui.z === 'fit' ? Math.max(0.45, Math.min(1.4, avail / w)) : 1;
    sheets.style.zoom = z;
  }
  const onResize = () => fit();
  window.addEventListener('resize', onResize);

  // 인쇄 쪽 넘침 확인 — 실제 인쇄 모양을 화면 밖에 그려 재고, 넘치는 쪽에 표시
  const probe = document.createElement('div');
  probe.className = 'overflow-probe'; probe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(probe);
  const checkOverflowSoon = debounce(() => {
    probe.innerHTML = printHTML(report);
    const over = [...probe.querySelectorAll('.pr-page')].map(pg => {
      const inEl = pg.querySelector('.s-in'); const ftEl = pg.querySelector('.s-ft');
      if (!inEl || !ftEl) return false;
      const limit = ftEl.getBoundingClientRect().top;
      let bottom = 0;
      [...inEl.children].forEach(c => { if (c !== ftEl) bottom = Math.max(bottom, c.getBoundingClientRect().bottom); });
      return bottom > limit + 1;
    });
    $$('.pg-wrap', sheets).forEach(w => {
      const o = !!over[+w.dataset.p];
      w.classList.toggle('over', o);
      w.querySelector('.over-badge').hidden = !o;
    });
    $$('#pages button').forEach(b => b.classList.toggle('warn', !!over[+b.dataset.pg]));
  }, 300);
  function refreshCalc() {
    const S = sums(data);
    $$('[data-sum]', sheets).forEach(el => {
      const k = el.dataset.sum;
      if (k === 'hwRatePct') el.textContent = S.hwRate === '' ? '–' : S.hwRate + '%';
      else el.textContent = S[k] === '' ? '–' : S[k];
    });
    const r = S.hwRate === '' ? 0 : Math.max(0, Math.min(100, +S.hwRate));
    $$('[data-donut]', sheets).forEach(c => c.setAttribute('stroke-dasharray', `${(r / 100 * 314.16).toFixed(1)} 314.16`));
    $$('[data-bar-sum]', sheets).forEach(i => { i.style.width = r + '%'; });
    data.teachers.forEach((t, i) => $$(`[data-bar-t="${i}"]`, sheets).forEach(b => { b.style.width = Math.max(0, Math.min(100, +t.hwRate || 0)) + '%'; }));
  }
  function refreshWho() {
    const sg = [data.school, data.grade].filter(Boolean).join(' ');
    $$('[data-who="sg"]', sheets).forEach(e => { e.textContent = sg; });
    $$('[data-who="nm"],[data-who="nm2"]', sheets).forEach(e => { e.textContent = data.student_name; });
    $$('[data-who="school"]', sheets).forEach(e => { e.textContent = data.school; });
    $$('[data-who="grade"]', sheets).forEach(e => { e.textContent = data.grade; });
    const tl = teacherLine(data);
    $$('[data-who="teachers"]', sheets).forEach(e => { e.textContent = tl; });
    const period = [data.att_from, data.att_to].filter(Boolean).join(' – ');
    $$('[data-who="period2"]', sheets).forEach(e => { e.textContent = period ? period + ' 기준' : ''; });
    $$('[data-who="period"]', sheets).forEach(e => { e.textContent = (period ? '지도 기간 ' + period + ' · ' : '') + tl; });
    const w = $('#who-line'); if (w) w.textContent = tl || '담임 미지정';
  }

  /* ---------------- 오른쪽 패널 ---------------- */
  function renderRight() {
    $$('.tabs2 button').forEach(b => b.classList.toggle('on', b.dataset.r === st.right));
    $('#rail-cnt').textContent = `${answeredCount(data)}/${SUMMARY_ORDER.length}`;
    const body = $('#right-body');
    if (st.right === 'summary') {
      body.innerHTML = `<span class="s2-lb">관찰 평가 ${answeredCount(data)} / ${SUMMARY_ORDER.length} · 누르면 그 문항으로 이동</span>
        <div class="ans-list">${SUMMARY_ORDER.map(k => {
          const v = data.answers[k]; const txt = Array.isArray(v) ? v.join(', ') : v;
          return `<button type="button" class="ans jump ${txt ? '' : 'none'}" data-jump="${k}"><b>${esc(Q[k].label)}</b>${esc(txt || '아직 안 고름')}</button>`;
        }).join('')}</div>`;
    } else { body.innerHTML = filesHTML(); bindFiles(); }
    renderStatus();
  }
  function jumpTo(k) {
    st.view = 'edit'; $$('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === 'edit'));
    if (!st.all) st.page = PAGE_OF[k] ?? st.page;
    renderSheets();
    const el = $('#q-' + k, sheets);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1400); }
    if (narrow()) setPanel('r', true);
  }
  function renderStatus() {
    const s = STATUS[report.status] || STATUS.draft;
    let h = `<div class="status-now"><span class="s ${s.cls}">${s.label}</span><small>${report.updatedBy ? '마지막 수정 ' + esc(report.updatedBy) : ''}</small></div>`;
    if (isAdmin) h += `<select class="fi sel full" id="st-sel" aria-label="상태 바꾸기">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${report.status === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select>`;
    else h += `<button type="button" class="btn primary full" id="btn-done">완료 처리</button>`;
    h += `<div class="row-btns"><a class="btn ghost sm" href="#/view/${id}">휴대폰 보기</a>${isAdmin ? '<button type="button" class="btn ghost sm danger-t" id="btn-del">삭제</button>' : ''}</div>`;
    $('#status-box').innerHTML = h;
    const sel = $('#st-sel');
    if (sel) sel.onchange = async () => {
      const v = sel.value;
      try { await flushAndSet({ status: v }); report.status = v; toast(`상태를 "${STATUS[v].label}"(으)로 바꿨습니다`); renderStatus(); }
      catch (e) { console.error(e); toast('상태를 바꾸지 못했습니다', 'err'); }
    };
    const bd = $('#btn-done'); if (bd) bd.onclick = markDone;
    const del = $('#btn-del');
    if (del) del.onclick = async () => {
      if (!await confirmBox({ title: '보고서를 삭제할까요?', body: `<p>${esc(report.studentName)} 학생의 보고서가 지워지고 되돌릴 수 없습니다.</p>`, ok: '삭제', danger: true })) return;
      save.cancel(); await deleteDoc(ref('reports', id)); toast('삭제했습니다'); go('#/list');
    };
  }
  async function flushAndSet(extra) {
    save.cancel(); st.dirty = false;
    await updateDoc(ref('reports', id), { data, ...extra, updatedAt: serverTimestamp(), updatedBy: me.name || me.email, updatedByEmail: me.email });
    st.savedAt = new Date(); setSave('saved');
  }
  async function markDone() {
    const missing = SUMMARY_ORDER.length - answeredCount(data);
    const body = missing ? `<p>관찰 평가 ${missing}개 문항이 아직 비어 있습니다.</p>` : '';
    if (!await confirmBox({ title: '보고서를 완료 처리할까요?', body: body + '<p>완료하면 선생님 계정으로는 더 고칠 수 없습니다.</p>', ok: '완료 처리' })) return;
    try { await flushAndSet({ status: 'done' }); toast('완료 처리했습니다'); go('#/view/' + id); }
    catch (e) { console.error(e); toast('완료 처리하지 못했습니다', 'err'); }
  }

  /* ---------------- 자료 보기 ---------------- */
  function filesHTML() {
    const T = data.teachers;
    const list = uploads.files.map(f => `<li class="${f.id === uploads.cur ? 'on' : ''}"><button type="button" data-file="${f.id}"><span class="ic ${f.kind}">${{ img: 'JPG', sheet: 'XLS', json: 'DR', pdf: 'PDF' }[f.kind]}</span><span class="fn">${esc(f.name)}</span></button>
      ${T.length > 1 ? `<select class="fi sel tsel" data-ft="${f.id}" aria-label="누구의 자료인지">${T.map((t, i) => `<option value="${i}" ${f.teacherIdx === i ? 'selected' : ''}>${t.role} ${esc(t.name || '')}</option>`).join('')}</select>` : ''}
      <button type="button" class="x" data-rm="${f.id}" aria-label="빼기">×</button></li>`).join('');
    const ai = config.aiEndpoint ? `<button type="button" class="btn gold full" id="btn-ai">AI로 읽어서 채우기</button>` : `<p class="hint">자동 인식(AI)은 관리자가 설정에서 연결하면 켜집니다. 지금은 자료를 옆에 띄워 놓고 직접 입력하세요.</p>`;
    return `<div class="files">
      <label class="drop" for="up-in"><b>＋ 사진 · 엑셀 올리기</b><small>입회원서 사진, 수업 기록 엑셀·CSV, 데일리 리포트 백업(json)</small></label>
      <input type="file" id="up-in" multiple accept="image/*,.xlsx,.xls,.csv,.json,.pdf" hidden>
      ${T.length > 1 ? `<label class="lb">새로 올릴 자료의 선생님</label><select class="fi sel full" id="up-teacher">${T.map((t, i) => `<option value="${i}">${t.role} ${esc(t.name || '')}</option>`).join('')}</select>` : ''}
      <ul class="flist">${list || '<li class="none">아직 올린 자료가 없습니다.</li>'}</ul>
      ${uploads.files.length ? ai : ''}
      <p class="hint">${ui.w ? '' : '⇔ 버튼으로 패널을 넓히면 자료를 크게 보며 옮겨 적을 수 있습니다. '}올린 자료는 이 기기 화면에만 띄우고 서버에 저장하지 않습니다.</p>
    </div>
    <div class="viewer" id="viewer">${viewerHTML()}</div>`;
  }
  function viewerHTML() {
    const f = uploads.current;
    if (!f) return '';
    if (f.kind === 'img') return `<div class="v-img"><div class="v-tools"><button type="button" class="btn ghost sm" data-zoom-img>확대/맞춤</button><button type="button" class="btn ghost sm" data-rot>회전</button><button type="button" class="btn ghost sm" data-pop>크게 보기</button></div><div class="v-frame ${f.zoom ? 'zoom' : ''}"><img src="${f.url}" alt="${esc(f.name)}" style="transform:rotate(${f.rot || 0}deg)"></div></div>`;
    if (f.kind === 'pdf') return `<div class="v-pdf"><iframe src="${f.url}" title="${esc(f.name)}"></iframe></div>`;
    if (f.kind === 'json') {
      const ok = Array.isArray(f.obj && f.obj.records);
      return `<div class="v-json">${ok ? `<p>데일리 리포트 백업 파일입니다. 기록 ${f.obj.records.length}개.</p><button type="button" class="btn primary" data-json-dr>이 파일로 데일리 리포트 불러오기</button>` : '<p>데일리 리포트 백업 파일이 아닙니다.</p>'}</div>`;
    }
    const s = f.sheets[f.sheet] || f.sheets[0];
    const tabs = f.sheets.map((sh, i) => { const n = sheetHitCount(sh, data.student_name); return `<button type="button" class="${i === f.sheet ? 'on' : ''} ${n ? 'has' : ''}" data-sheet="${i}">${esc(sh.name)}${n ? ` <b>${n}</b>` : ''}</button>`; }).join('');
    const out = sheetHTML(s, data.student_name, f.near !== false);
    const res = typeof out === 'string' ? { html: out, hits: 0 } : out;
    return `<div class="v-sheet"><div class="stabs">${tabs}</div>
      <div class="v-tools"><label class="chk"><input type="checkbox" data-near ${f.near !== false ? 'checked' : ''}> ${esc(data.student_name)} 주변만 보기</label><span class="hint">${res.hits ? `이 시트에서 ${res.strong || 0}곳 찾음${res.weak ? ` · 확인 필요 ${res.weak}곳` : ''}` : '이 시트에는 학생 이름이 없습니다'}</span></div>
      <div class="xl-wrap">${res.html}</div></div>`;
  }
  async function addFiles(list) {
    const ti = $('#up-teacher') ? +$('#up-teacher').value : 0;
    try { await uploads.add(list, ti); } catch (e) { toast(e.message, 'err'); }
    renderRight();
  }
  function bindFiles() {
    const inpEl = $('#up-in');
    if (inpEl) inpEl.onchange = async () => { await addFiles([...inpEl.files]); inpEl.value = ''; };
    const drop = $('.files .drop');
    if (drop) {
      drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
      drop.ondragleave = () => drop.classList.remove('over');
      drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); addFiles([...e.dataTransfer.files]); };
    }
    $$('[data-file]').forEach(b => b.onclick = () => { uploads.cur = b.dataset.file; renderRight(); });
    $$('[data-rm]').forEach(b => b.onclick = () => { uploads.remove(b.dataset.rm); renderRight(); });
    $$('[data-ft]').forEach(s => s.onchange = () => { const f = uploads.files.find(x => x.id === s.dataset.ft); if (f) f.teacherIdx = +s.value; });
    const v = $('#viewer'); if (!v) return;
    v.onclick = async e => {
      const f = uploads.current; if (!f) return;
      const t = e.target.closest('button,input'); if (!t) return;
      if (t.hasAttribute('data-zoom-img')) { f.zoom = !f.zoom; v.innerHTML = viewerHTML(); }
      else if (t.hasAttribute('data-rot')) { f.rot = ((f.rot || 0) + 90) % 360; v.innerHTML = viewerHTML(); }
      else if (t.hasAttribute('data-pop')) popImage(f);
      else if (t.dataset.sheet != null) { f.sheet = +t.dataset.sheet; v.innerHTML = viewerHTML(); }
      else if (t.hasAttribute('data-near')) { f.near = t.checked; v.innerHTML = viewerHTML(); }
      else if (t.hasAttribute('data-json-dr')) { try { setDRFromObject(f.obj); await drImport(true); } catch (er) { toast(er.message, 'err'); } }
    };
    const ai = $('#btn-ai'); if (ai) ai.onclick = runAI;
  }
  function popImage(f) {
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-back img-pop"><div class="pop-in"><img src="${f.url}" alt="${esc(f.name)}" style="transform:rotate(${f.rot || 0}deg)"><button type="button" class="btn primary" id="pop-x">닫기</button></div></div>`;
    $('#pop-x').onclick = () => { root.innerHTML = ''; };
  }
  function openFiles() { st.right = 'files'; ui.r = false; if (!narrow()) ui.w = true; else ui.l = true; applyUI(); renderRight(); }
  async function runAI() {
    const btn = $('#btn-ai'); btn.disabled = true; btn.textContent = 'AI가 읽는 중… (30초 정도 걸립니다)';
    try {
      const out = await aiRead(config.aiEndpoint, { data, uploads });
      const check = applyAI(data, out);
      touch(); renderSheets(true); renderRight(); refreshWho();
      await confirmBox({ title: 'AI가 읽은 내용을 채웠습니다', body: `<p>채운 값을 지면에서 확인하고 필요하면 고쳐주세요.</p>${check.length ? `<p><b>확인이 필요한 부분</b></p><ul>${check.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}${data.ai_memo ? `<p><b>상담 메모 (브리핑 참고)</b><br>${esc(data.ai_memo)}</p>` : ''}`, ok: '확인', cancel: '닫기' });
    } catch (e) { console.error(e); toast(e.message || 'AI 인식에 실패했습니다', 'err'); }
    finally { const b = $('#btn-ai'); if (b) { b.disabled = false; b.textContent = 'AI로 읽어서 채우기'; } }
  }

  /* ---------------- 데일리 리포트 ---------------- */
  async function drImport(fromFile = false) {
    let db;
    try {
      if (!fromFile && !drReady()) {
        const go2 = await confirmBox({ title: '데일리 리포트가 이 기기에 연결되어 있지 않습니다', body: '<p>설정에서 데일리 리포트 저장소를 연결하거나, 데일리 리포트의 <b>설정 · 백업 → 백업 파일 내려받기(JSON)</b>로 받은 파일을 "자료 올리기"로 올려주세요.</p>', ok: '자료 올리기 열기', cancel: '닫기' });
        if (go2) openFiles();
        return;
      }
      toast('데일리 리포트를 불러오는 중…');
      db = await fetchDR(!fromFile);
    } catch (e) { toast(e.message, 'err'); return; }
    const names = drStudentNames(db);
    const T = data.teachers;
    const drTeacher = (db.meta && db.meta.teacher) || '';
    const defRow = Math.max(0, T.findIndex(t => t.name && drTeacher && t.name === drTeacher));
    const res = await formBox({
      title: '데일리 리포트에서 불러오기',
      html: `<label class="lb">데일리 리포트의 학생</label>
        <select name="name" class="fi sel full">${names.map(n => `<option ${n === data.student_name ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
        <div class="row2"><div><label class="lb">시작일</label><input class="fi full" name="from" value="${esc(data.att_from)}" placeholder="2026.09.01"></div><div><label class="lb">종료일</label><input class="fi full" name="to" value="${esc(data.att_to)}" placeholder="2026.09.30"></div></div>
        <p class="hint">이 기간이 보고서의 출결 기간으로 함께 바뀝니다.</p>
        ${T.length > 1 ? `<label class="lb">어느 선생님의 수업 기록인가요?</label><select name="row" class="fi sel full">${T.map((t, i) => `<option value="${i}" ${i === defRow ? 'selected' : ''}>${t.role} ${esc(t.name || '')}</option>`).join('')}</select>` : '<input type="hidden" name="row" value="0">'}
        <p class="hint">데일리 리포트 담당 강사: ${esc(drTeacher || '정보 없음')}.${T.length > 1 ? ' 같은 날 두 선생님 기록이 있으면 선생님별로 각각 셉니다.' : ''}</p>`,
      ok: '계산해 보기'
    });
    if (!res) return;
    const s = computeDR(db, res.name, res.from, res.to);
    if (!s.count) { toast('그 기간에 이 학생의 수업 기록이 없습니다', 'err'); return; }
    const row = T[+res.row];
    const preview = `<table class="mini-t"><tr><th>수업</th><td>${s.sessions}회 (보강 ${s.muAbsent + s.muProgress}회 별도)</td></tr>
      <tr><th>출석 · 지각 · 결석</th><td>${s.present} · ${s.late} · ${s.absent}</td></tr>
      <tr><th>결석보강 · 진도보강 · 미보강</th><td>${s.muAbsent} · ${s.muProgress} · ${s.nomk}</td></tr>
      <tr><th>과제</th><td>총 ${s.hwTotal}회 중 안함 ${s.hwSkip}회 · 달성률 ${s.hwRate === '' ? '–' : s.hwRate + '%'}</td></tr>
      <tr><th>진행 교재</th><td>${s.books.map(b => esc(b.book + (b.unit ? ' · ' + b.unit : '') + (b.rate != null ? ` (${b.rate}%)` : ''))).join('<br>') || '–'}</td></tr>
      <tr><th>태도 · 집중 평균</th><td>${s.attitude || '–'} · ${s.focus || '–'}</td></tr>
      ${s.tests.length ? `<tr><th>테스트</th><td>${s.tests.map(t => esc(`${t.name} ${t.score}${t.total ? '/' + t.total : ''}`)).join('<br>')}</td></tr>` : ''}</table>
      <p class="hint">${esc(row.role + ' ' + (row.name || ''))} 줄에 채웁니다. 채운 뒤에도 지면에서 고칠 수 있어요.</p>`;
    if (!await confirmBox({ title: `${res.name} · ${res.from} ~ ${res.to}`, body: preview, ok: '보고서에 채우기' })) return;
    if (!row.name && drTeacher) row.name = drTeacher;
    applyDR(data, s, +res.row);
    touch(); renderSheets(true); renderRight(); refreshWho();
    toast('데일리 리포트 내용을 채웠습니다');
  }

  /* ---------------- 지면 입력 ---------------- */
  sheets.addEventListener('input', e => {
    const el = e.target;
    if (el.tagName === 'TEXTAREA') grow(el);
    if (el.dataset.k) {
      data[el.dataset.k] = el.value;
      if (['school', 'grade', 'student_name', 'att_from', 'att_to'].includes(el.dataset.k)) refreshWho();
    } else if (el.dataset.t != null) {
      data.teachers[+el.dataset.t][el.dataset.f] = el.value;
      if (el.dataset.f === 'name') refreshWho();
      refreshCalc();
    } else if (el.dataset.b != null) {
      const b = data.books[+el.dataset.b]; if (!b) return;
      b[el.dataset.bf] = el.value;
      if (el.dataset.bf === 'rate') $$(`[data-bar-b="${el.dataset.b}"]`, sheets).forEach(i => { i.style.width = Math.max(0, Math.min(100, +el.value || 0)) + '%'; });
    } else if (el.dataset.r != null) {
      const r = data.road[+el.dataset.r]; if (!r) return;
      r[el.dataset.rf] = el.value;
    } else return;
    touch();
  });
  sheets.addEventListener('change', e => {
    if (e.target.dataset.k === 'hw_type') { data.hw_type = e.target.value; touch(); renderSheets(true); }
  });
  sheets.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b || st.view !== 'edit') return;
    if (b.dataset.q) {
      const qid = b.dataset.q, v = b.dataset.v, q = Q[qid];
      if (q.type === 'multi') {
        let arr = data.answers[qid] || [];
        if (v === '④ 지적할 것이 없다') arr = arr.includes(v) ? [] : [v];
        else { arr = arr.filter(x => x !== '④ 지적할 것이 없다'); arr = arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]; }
        data.answers[qid] = arr;
      } else data.answers[qid] = data.answers[qid] === v ? '' : v;
      // 고른 버튼만 바꿔 표시 (스크롤·입력 위치 유지)
      const box = b.parentElement;
      const sel = q.type === 'multi' ? data.answers[qid] : [data.answers[qid]];
      [...box.children].forEach(c => c.classList.toggle('on', sel.includes(c.dataset.v)));
      touch(); if (st.right === 'summary') renderRight(); else $('#rail-cnt').textContent = `${answeredCount(data)}/${SUMMARY_ORDER.length}`;
      return;
    }
    if (b.dataset.gen) {
      const k = b.dataset.gen;
      if (k === 'briefing') {
        const g = genBriefing3(data);
        const has = ['brief1', 'brief2', 'brief3'].some(x => (data[x] || '').trim());
        if (has && !await confirmBox({ title: '이미 쓴 브리핑이 있습니다', body: '<p>자동생성한 초안으로 세 칸을 모두 바꿀까요? 지금 쓴 내용은 사라집니다.</p>', ok: '바꾸기' })) return;
        Object.assign(data, g);
        touch(); renderSheets(true); return;
      }
      const field = k === 'coaching' ? 'coaching_reason' : 'prelearning_reason';
      const text = k === 'coaching' ? genCoaching(data) : genPrelearning(data);
      if (!text) return toast(k === 'coaching' ? '먼저 공책 교정 항목을 선택해주세요' : '먼저 선행 반응 항목을 선택해주세요', 'err');
      if (data[field] && data[field].trim() && !await confirmBox({ title: '이미 쓴 내용이 있습니다', body: '<p>자동생성한 초안으로 바꿀까요? 지금 쓴 내용은 사라집니다.</p>', ok: '바꾸기' })) return;
      data[field] = text;
      const t = $(`textarea[data-k="${field}"]`, sheets); if (t) { t.value = text; grow(t); t.focus(); }
      touch(); return;
    }
    if (b.hasAttribute('data-add-sub')) {
      const names = Object.entries(staffNames);
      const r = await formBox({ title: '부담임 줄 추가', html: `<label class="lb">부담임 선생님</label><select name="email" class="fi sel full"><option value="">직접 입력</option>${names.map(([em, n]) => `<option value="${esc(em)}">${esc(n)} (${esc(em)})</option>`).join('')}</select><label class="lb">직접 입력할 이름</label><input class="fi full" name="name" placeholder="선생님 이름">`, ok: '추가' });
      if (!r) return;
      data.teachers.push(newTeacherRow('부담임', r.email ? staffNames[r.email] : r.name, r.email || ''));
      touch(); renderSheets(true); refreshWho(); return;
    }
    if (b.dataset.delT) {
      if (!await confirmBox({ title: '부담임 줄을 지울까요?', body: '<p>이 줄에 넣은 출결·과제 숫자도 함께 지워집니다.</p>', ok: '지우기', danger: true })) return;
      data.teachers.splice(+b.dataset.delT, 1);
      touch(); renderSheets(true); refreshWho(); return;
    }
    if (b.hasAttribute('data-add-b')) { data.books.push(newBook()); touch(); renderSheets(true); return; }
    if (b.dataset.delB) { data.books.splice(+b.dataset.delB, 1); if (!data.books.length) data.books.push(newBook()); touch(); renderSheets(true); return; }
    if (b.hasAttribute('data-add-r')) { data.road.push(newRoad()); touch(); renderSheets(true); }
  });

  /* ---------------- 버튼 ---------------- */
  ed.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.panel) { const s = b.dataset.panel; setPanel(s, !ui[s]); return; }
    if (b.dataset.rail) { st.right = b.dataset.rail; setPanel('r', false); renderRight(); return; }
    if (b.id === 'wide') { ui.w = !ui.w; applyUI(); if (st.right === 'files') renderRight(); return; }
    if (b.id === 'focus') { const both = ui.l && ui.r; ui.l = !both; ui.r = !both; applyUI(); return; }
    if (b.dataset.zoom) { ui.z = b.dataset.zoom === 'fit' ? 'fit' : 1; applyUI(); return; }
    if (b.dataset.view) { st.view = b.dataset.view; $$('[data-view]').forEach(x => x.classList.toggle('on', x === b)); renderSheets(); scr.scrollTop = 0; return; }
    if (b.dataset.jump) { jumpTo(b.dataset.jump); return; }
    if (b.dataset.r && b.closest('.tabs2')) { st.right = b.dataset.r; renderRight(); }
  });
  const goPage = p => { st.page = Math.max(0, Math.min(3, p)); if (st.view !== 'edit') { st.view = 'edit'; $$('[data-view]').forEach(x => x.classList.toggle('on', x.dataset.view === 'edit')); } renderSheets(); scr.scrollTop = 0; if (narrow()) setPanel('l', true); };
  $('#pages').onclick = e => {
    const b = e.target.closest('[data-pg]'); if (!b) return;
    if (st.all) { st.page = +b.dataset.pg; $$('#pages button').forEach(x => x.classList.toggle('on', x === b)); const t = $(`.pg-wrap[data-p="${b.dataset.pg}"]`, sheets); if (t) t.scrollIntoView({ behavior: 'smooth' }); }
    else goPage(+b.dataset.pg);
  };
  $('#dots').onclick = e => { const b = e.target.closest('[data-pg]'); if (b) goPage(+b.dataset.pg); };
  $('#prev').onclick = () => goPage(st.page - 1);
  $('#next').onclick = () => { if (st.page === 3) { if (isAdmin) printReport(); else markDone(); } else goPage(st.page + 1); };
  $('#v-one').onclick = () => { st.all = false; renderSheets(); };
  $('#v-all').onclick = () => { st.all = true; renderSheets(); };
  $('#btn-dr').onclick = () => drImport(false);
  $('#btn-up').onclick = openFiles;
  $('#btn-pdf').onclick = () => printReport();
  // 좁은 화면: 패널 밖을 누르면 패널 닫기
  $('#ctr').addEventListener('pointerdown', () => { if (narrow() && (!ui.l || !ui.r)) { ui.l = true; ui.r = true; applyUI(false); } });

  function printReport() { flush(); printNow({ ...report, data }); }

  applyUI(false);
  renderSheets();
  renderRight();
  if (document.fonts) document.fonts.ready.then(() => { $$('textarea.e', sheets).forEach(grow); fit(); checkOverflowSoon(); });
}

// 인쇄 (편집 화면 · 보기 화면 공용) — 시안① 4쪽
export function printNow(report) {
  const root = document.getElementById('print-root');
  root.innerHTML = printHTML(report);
  document.body.classList.add('printing');
  const imgs = [...root.querySelectorAll('img')];
  const ready = Promise.all(imgs.map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })));
  const prevTitle = document.title;
  document.title = `1MM보고서_${report.data.student_name || report.studentName || ''}`;
  const done = () => { document.body.classList.remove('printing'); root.innerHTML = ''; document.title = prevTitle; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  Promise.all([ready, document.fonts ? document.fonts.ready : null]).then(() => setTimeout(() => window.print(), 120));
}
