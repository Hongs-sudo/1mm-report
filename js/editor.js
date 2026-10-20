// 보고서 작성 화면 (PC 풀버전 · 태블릿)
import { $, $$, esc, debounce, toast, confirmBox, formBox, todayStr } from './util.js';
import { ref, getDoc, updateDoc, deleteDoc, serverTimestamp } from './fb.js';
import { Q, INTRO, STATUS, PAGE3_Q, SUMMARY_ORDER, sums, teacherLine, newTeacherRow, genCoaching, genPrelearning, genBriefing, answeredCount } from './schema.js';
import { printHTML } from './render.js';
import { drReady, fetchDR, setDRFromObject, drStudentNames, computeDR, applyDR, Uploads, sheetHTML, sheetHitCount, aiRead, applyAI } from './sources.js';

const PAGES = [
  { n: '·', label: '표지 (인쇄용)' },
  { n: '1', label: '기본 정보 · 출결 · 과제' },
  { n: '2', label: '관찰 평가 (1) · 지도계획' },
  { n: '3', label: '관찰 평가 (2) · 브리핑' }
];

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

  const data = report.data;
  data.answers = data.answers || {};
  data.hints = data.hints || {};
  data.teachers = data.teachers && data.teachers.length ? data.teachers : [newTeacherRow('담임')];

  const st = { page: 1, all: false, right: 'summary', saveState: 'saved', savedAt: null, dirty: false };
  const uploads = new Uploads();

  main.innerHTML = `
  <div class="ed">
    <aside class="ed-left" id="ed-left">
      <section class="pn">
        <h3>학생</h3>
        <div class="stu"><span class="av">${esc((report.studentName || '?').slice(0, 1))}</span><div><b>${esc(report.studentName)}</b><small>${esc([data.school, data.grade].filter(Boolean).join(' '))}${data.join_date ? ' · 입회 ' + esc(data.join_date) : ''}</small></div></div>
        <div class="who-line" id="who-line">${esc(teacherLine(data)) || '담임 미지정'}</div>
      </section>
      <section class="pn">
        <h3>기본 내용 불러오기</h3>
        <button type="button" class="btn line full" id="btn-dr">데일리 리포트에서 불러오기</button>
        <button type="button" class="btn line full" id="btn-up">자료 올리기 (입회원서 · 엑셀)</button>
        <p class="hint">${drReady() ? '데일리 리포트 저장소가 이 기기에 연결되어 있습니다.' : '데일리 리포트는 설정에서 연결하거나, 백업 파일(json)을 자료로 올려도 됩니다.'}</p>
      </section>
      <section class="pn">
        <h3>페이지</h3>
        <nav class="pages" id="pages">${PAGES.map((p, i) => `<button type="button" data-pg="${i}"><em>${p.n}</em>${p.label}</button>`).join('')}</nav>
        <div class="seg" role="group" aria-label="보기 방식"><button type="button" id="v-one" class="on">한 장씩</button><button type="button" id="v-all">전체 펼쳐 보기</button></div>
      </section>
    </aside>

    <main class="ed-center" id="ed-center">
      <div class="ed-bar">
        <button type="button" class="btn ghost sm" id="btn-left" aria-label="왼쪽 패널 열기">☰ 학생·페이지</button>
        <span class="save" id="save">저장됨</span>
        <span class="sp"></span>
        <button type="button" class="btn ghost sm" id="btn-right">자료 · 현황</button>
        <button type="button" class="btn line sm" id="btn-pdf">PDF</button>
      </div>
      <div class="sheets" id="sheets"></div>
      <div class="pnav" id="pnav"><button type="button" class="btn line" id="prev">← 이전</button><div class="dots" id="dots"></div><button type="button" class="btn primary" id="next">다음 →</button></div>
    </main>

    <aside class="ed-right" id="ed-right">
      <div class="tabs2"><button type="button" data-r="summary" class="on">선택 현황</button><button type="button" data-r="files">자료 보기</button></div>
      <div id="right-body"></div>
      <div class="pn act">
        <h3>보고서 상태</h3>
        <div id="status-box"></div>
      </div>
    </aside>
  </div>`;

  const sheets = $('#sheets');

  /* ---------------- 저장 ---------------- */
  const saveEl = $('#save');
  function setSave(state) {
    st.saveState = state;
    const t = st.savedAt ? `${String(st.savedAt.getHours()).padStart(2, '0')}:${String(st.savedAt.getMinutes()).padStart(2, '0')}` : '';
    saveEl.textContent = state === 'saving' ? '저장 중…' : state === 'dirty' ? '고친 내용 저장 대기' : state === 'error' ? '저장 실패 · 다시 시도합니다' : `저장됨${t ? ' ' + t : ''}`;
    saveEl.className = 'save ' + state;
  }
  const doSave = async () => {
    if (!st.dirty) return;
    st.dirty = false;
    setSave('saving');
    try {
      await updateDoc(ref('reports', id), {
        data, studentName: data.student_name || report.studentName,
        updatedAt: serverTimestamp(), updatedBy: me.name || me.email, updatedByEmail: me.email
      });
      st.savedAt = new Date();
      setSave('saved');
    } catch (e) {
      console.error(e);
      st.dirty = true;
      setSave('error');
      setTimeout(() => save(), 4000);
    }
  };
  const save = debounce(doSave, 1200);
  function touch() { st.dirty = true; setSave('dirty'); save(); }
  const flush = () => { if (st.dirty) save.flush(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  window.addEventListener('pagehide', flush);
  ctx.onLeave = flush;

  /* ---------------- 입력 칸 도구 ---------------- */
  const inp = (k, ph = '', cls = '') => `<input class="fi ${cls}" data-k="${k}" value="${esc(data[k] ?? '')}" placeholder="${esc(ph)}">`;
  const ta = (k, ph = '', rows = 3) => `<textarea class="ta" data-k="${k}" rows="${rows}" placeholder="${esc(ph)}">${esc(data[k] ?? '')}</textarea>`;
  const tin = (i, f, ph = '', cls = 'num') => `<input class="fi ${cls}" data-t="${i}" data-f="${f}" value="${esc(data.teachers[i][f] ?? '')}" placeholder="${esc(ph)}" ${cls === 'num' ? 'inputmode="numeric"' : ''}>`;

  function qHTML(id) {
    const q = Q[id];
    const v = data.answers[id];
    const hint = data.hints[id];
    let body;
    if (q.type === 'scale') {
      body = `<div class="ed-scale">${q.opts.map((o, i) => {
        const lab = i === 0 ? `(${q.ends[0]}) 1` : i === 4 ? `5 (${q.ends[1]})` : String(i + 1);
        return `<button type="button" class="${v === o ? 'on' : ''}" data-q="${id}" data-v="${esc(o)}" title="${esc(o)}">${lab}<i></i></button>`;
      }).join('')}</div>`;
    } else {
      const sel = q.type === 'multi' ? (v || []) : [v];
      body = `<div class="ed-opts ${q.grid ? 'g' + q.grid : ''}">${q.opts.map(o => `<button type="button" class="${sel.includes(o) ? 'on' : ''}" data-q="${id}" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
    }
    let extra = '';
    if (id === 'coaching') extra = `<div class="gen"><button type="button" class="btn line sm" data-gen="coaching">지도계획 자동생성</button><span>선택한 항목을 바탕으로 지도 방향과 개선 계획 초안을 생성합니다. 중복 선택 가능합니다.</span></div>${ta('coaching_reason', '지도 방향과 개선 계획을 입력하세요', 4)}`;
    if (id === 'prelearning_reaction') extra = `<div class="gen"><button type="button" class="btn line sm" data-gen="prelearning">지도계획 자동생성</button><span>선택한 항목을 바탕으로 지도 방향과 개선 계획 초안을 생성합니다.</span></div>${ta('prelearning_reason', '지도 방향과 개선 계획을 입력하세요', 4)}`;
    return `<div class="ed-q" id="q-${id}"><div class="ed-qh"><b>${esc(q.label)}</b>${hint ? `<span class="hint-chip">${esc(hint)}</span>` : (q.type === 'multi' ? '<span class="mute">중복 선택</span>' : '')}</div><div class="ed-qb">${body}${extra}</div></div>`;
  }

  function sumCells(key) { const S = sums(data); return `<td class="sumc" data-sum="${key}">${S[key] === '' ? '–' : S[key]}${key === 'hwRate' && S[key] !== '' ? '%' : ''}</td>`; }

  function head(n, sub) {
    return `<div class="sh-hd"><img src="img/logo_h.png" alt="수학도서관"><div class="sh-who"><span>학교<b>${esc([data.school, data.grade].filter(Boolean).join(' '))}</b></span><span>이름<b>${esc(data.student_name)}</b></span></div></div>
      <div class="sh-ttl"><span class="lat">Math Library</span><h1>1개월 학습보고서</h1></div>
      <div class="sh-sub"><span class="n">${n}</span>${sub}</div>`;
  }

  function page0() {
    return `<div class="cover-prev">${printHTML(report).split('</section>')[0]}</section></div>
      <p class="hint center">표지는 인쇄할 때 첫 장으로 나옵니다. 학교·이름·지도 기간·선생님은 1페이지 내용으로 자동 채워집니다.</p>`;
  }

  function page1() {
    const T = data.teachers;
    const canAddSub = T.length < 2;
    return `${head('I', '상담 기록 · 출결 · 관찰 평가')}
    <p class="greet">${INTRO.join('<br>')}</p>
    <div class="sec"><h2>상담 기록</h2><span class="r"></span></div>
    <div class="tw"><table class="info">
      <tr><th>상담일자</th><td>${inp('consult_date', '예) ' + todayStr())}</td><th>학생명</th><td>${inp('student_name', '이름')}</td></tr>
      <tr><th>학교/학년</th><td class="two">${inp('school', '학교')}${inp('grade', '학년', 'short')}</td><th>교사명</th><td><span class="ro" id="teacher-line">${esc(teacherLine(data)) || '아래 출결 표에서 선생님 이름을 넣어주세요'}</span></td></tr>
      <tr><th>확인</th><td>${inp('confirmer', '확인자 이름')}</td><th>입회일자</th><td>${inp('join_date', '예) 2026.09.01')}</td></tr>
      <tr><th>직전학기<br>내신성적</th><td>${inp('prev_score', '예) 중간 100점 / 기말 97점')}</td><th>진단평가</th><td class="two">${inp('entry_score', '1차 점수')}${inp('entry_score2', '2차 점수')}</td></tr>
      <tr><th>현재<br>진행 과정</th><td colspan="3">${inp('current_course', '예) 중2-2 내신대비교재, 공통수학1 쎈')}</td></tr>
      <tr><th>월평가</th><td>${inp('monthly_eval_name', '시험명')}</td><th>점수 / 평균</th><td class="two">${inp('monthly_eval_score', '점수')}${inp('monthly_eval_avg', '학년 평균')}</td></tr>
      <tr><th>인증시험</th><td>${inp('cert_eval_name', '시험명')}</td><th>점수 / P·F</th><td class="two">${inp('cert_eval_score', '점수')}${inp('cert_eval_pf', '통과 / 미통과')}</td></tr>
    </table></div>

    <div class="sec"><h2>출결 현황</h2><span class="r"></span>${canAddSub ? '<button type="button" class="btn ghost sm" id="add-sub">＋ 부담임 줄 추가</button>' : ''}</div>
    <div class="period-row"><label>기간</label>${inp('att_from', '시작일', 'mid')}<span>~</span>${inp('att_to', '종료일', 'mid')}</div>
    <div class="tw"><table class="tt">
      <thead><tr><th class="l">선생님</th><th class="l">수업 요일</th><th>수업</th><th>출석</th><th>지각</th><th>결석</th><th>미보강</th><th>결석보강</th><th>진도보강</th></tr></thead>
      <tbody>${T.map((t, i) => `<tr><td class="l nm"><span class="tg ${t.role === '담임' ? 'a' : 's'}">${t.role}</span>${tin(i, 'name', '이름', 'name')}${i > 0 ? `<button type="button" class="x" data-del-t="${i}" aria-label="부담임 줄 지우기">×</button>` : ''}</td><td class="l">${tin(i, 'days', '예) 화·금', 'days')}</td>${['sessions', 'present', 'late', 'absent', 'nomk', 'muAbsent', 'muProgress'].map(f => `<td>${tin(i, f, '0')}</td>`).join('')}</tr>`).join('')}
      <tr class="sum"><td class="l">합계</td><td></td>${['sessions', 'present', 'late', 'absent', 'nomk', 'muAbsent', 'muProgress'].map(sumCells).join('')}</tr></tbody>
    </table></div>
    <div class="row2"><div><label class="lb">결석·보강일</label>${inp('att_days', '예) 결석 9/15(화) / 보강 9/19(토)')}</div><div><label class="lb">출결 메모</label>${inp('att_note', '예) 9/25 추석 휴강')}</div></div>

    <div class="sec"><h2>과제</h2><span class="r"></span><label class="inline">단위 <select class="fi sel" data-k="hw_type">${['문제수', 'Page', '단원'].map(o => `<option ${data.hw_type === o ? 'selected' : ''}>${o}</option>`).join('')}</select></label></div>
    <div class="tw"><table class="tt">
      <thead><tr><th class="l">선생님</th><th class="l">과정</th><th>총 (회)</th><th>안함 (회)</th><th>달성률 (%)</th></tr></thead>
      <tbody>${T.map((t, i) => `<tr><td class="l"><span class="tg ${t.role === '담임' ? 'a' : 's'}">${t.role}</span> ${esc(t.name || '')}</td><td class="l">${tin(i, 'hwCourse', '예) 내신대비교재', 'course')}</td><td>${tin(i, 'hwTotal', '0')}</td><td>${tin(i, 'hwSkip', '0')}</td><td>${tin(i, 'hwRate', '%')}</td></tr>`).join('')}
      <tr class="sum"><td class="l">합계</td><td></td>${sumCells('hwTotal')}${sumCells('hwSkip')}${sumCells('hwRate')}</tr></tbody>
    </table></div>
    <label class="lb">안해온 날짜 &amp; 분량</label>${ta('hw_note', '예) 9/11(금) 내신대비교재 A p.34–41', 2)}

    <div class="sec"><h2>관찰 평가</h2><span class="r"></span></div>
    ${qHTML('homework_error')}`;
  }

  function page2() {
    return `${head('II', '관찰 평가 · 지도 계획')}
    ${qHTML('focus')}${qHTML('motivation')}${qHTML('coaching')}
    <div class="ed-q"><div class="ed-qh"><b>현재 진행 교재 · <input class="fi inl" data-k="roadmap_label" value="${esc(data.roadmap_label || '분기 로드맵')}" aria-label="로드맵 제목"></b></div>
      <div class="ed-qb pair"><div><label class="lb">현재 진행 교재</label>${ta('current_progress', '데일리 리포트에서 불러오거나 직접 입력하세요', 4)}</div><div><label class="lb">${esc(data.roadmap_label || '분기 로드맵')}</label>${ta('roadmap_text', '예) 10월 2학기 중간고사 대비 → 공통수학1 경우의 수', 4)}</div></div></div>
    ${qHTML('roadmap_speed')}${qHTML('prelearning_reaction')}`;
  }

  function page3() {
    const home = data.teachers.find(t => t.role === '담임') || {};
    const sub = data.teachers.find(t => t.role === '부담임') || {};
    return `${head('III', '관찰 평가')}
    <div class="grid2">${qHTML('arithmetic')}${qHTML('problem_speed')}</div>
    ${qHTML('health')}${qHTML('question_frequency')}
    <div class="bh"><img src="img/logo_h.png" alt="수학도서관"><h2><small>Math Library</small>상담을 위한 학생 Briefing</h2></div>
    <p class="note">상담 내용, 특이사항, 부모 상담 기록 등을 자유롭게 작성하세요.</p>
    <div class="tw"><table class="info">
      <tr><th>학교</th><td><span class="ro">${esc(data.school)}</span></td><th>학년</th><td><span class="ro">${esc(data.grade)}</span></td></tr>
      <tr><th>이름</th><td><span class="ro">${esc(data.student_name)}</span></td><th>담임</th><td><span class="ro">${esc(home.name || '')}</span></td></tr>
      <tr><th>부담임</th><td>${sub.name ? `<span class="ro">${esc(sub.name)}</span>` : inp('briefing_sub', '부담임 이름')}</td><th>작성일</th><td>${inp('write_date', todayStr())}</td></tr>
    </table></div>
    <div class="gen"><button type="button" class="btn primary sm" data-gen="briefing">설문 기반 브리핑 자동생성</button><span>선택 항목과 선생님별 출결·과제·진도 정보를 종합해 브리핑 초안을 생성합니다. 생성 후 직접 수정하세요.</span></div>
    ${ta('briefing_text', '학생 상담 내용을 입력하세요\n\n(수업 태도, 학습 수준, 특이사항, 부모 상담 내용 등)', 14)}`;
  }

  const builders = [page0, page1, page2, page3];
  function renderSheets() {
    const idx = st.all ? [0, 1, 2, 3] : [st.page];
    sheets.innerHTML = idx.map(i => `<article class="sheet ${i === 0 ? 'is-cover' : ''}" data-p="${i}"><div class="sh-in">${builders[i]()}</div><div class="sh-pg">${i === 0 ? '표지' : i + ' / 3'}</div></article>`).join('');
    $$('textarea.ta', sheets).forEach(autoGrow);
    $$('#pages button').forEach(b => b.classList.toggle('on', +b.dataset.pg === st.page));
    $('#v-one').classList.toggle('on', !st.all); $('#v-all').classList.toggle('on', st.all);
    $('#pnav').hidden = st.all;
    $('#prev').disabled = st.page === 0;
    $('#next').textContent = st.page === 3 ? (isAdmin ? 'PDF 출력' : '완료 처리') : '다음 →';
    fitCover();
    $('#dots').innerHTML = PAGES.map((p, i) => `<button type="button" class="${i === st.page ? 'on' : ''}" data-pg="${i}" aria-label="${p.label}">${p.n}</button>`).join('');
  }
  function fitCover() {
    $$('.cover-prev', sheets).forEach(w => {
      const pg = w.querySelector('.pr-page'); if (!pg) return;
      const sc = w.clientWidth / pg.offsetWidth;
      pg.style.transform = `scale(${sc})`;
      w.style.height = (pg.offsetHeight * sc) + 'px';
    });
  }
  window.addEventListener('resize', fitCover);
  function autoGrow(el) { el.style.height = 'auto'; el.style.height = Math.max(el.scrollHeight + 2, 40) + 'px'; }

  /* ---------------- 오른쪽 패널 ---------------- */
  function renderRight() {
    $$('.tabs2 button').forEach(b => b.classList.toggle('on', b.dataset.r === st.right));
    $('.ed').classList.toggle('files-open', st.right === 'files');
    const body = $('#right-body');
    if (st.right === 'summary') {
      const items = SUMMARY_ORDER.map(k => {
        const v = data.answers[k];
        const txt = Array.isArray(v) ? v.join(', ') : v;
        return `<div class="ans ${txt ? '' : 'none'}"><b>${esc(Q[k].label)}</b>${esc(txt || '아직 안 고름')}</div>`;
      }).join('');
      body.innerHTML = `<div class="pn"><h3>관찰 평가 <span class="cnt">${answeredCount(data)} / ${SUMMARY_ORDER.length}</span></h3><div class="ans-list">${items}</div></div>`;
    } else {
      body.innerHTML = filesHTML();
      bindFiles();
    }
    renderStatus();
  }
  function renderStatus() {
    const s = STATUS[report.status] || STATUS.draft;
    let h = `<div class="status-now"><span class="s ${s.cls}">${s.label}</span><small>${report.updatedBy ? '마지막 수정 ' + esc(report.updatedBy) : ''}</small></div>`;
    if (isAdmin) {
      h += `<label class="lb" for="st-sel">상태 바꾸기</label><select class="fi sel full" id="st-sel">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${report.status === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select>`;
    } else {
      h += `<button type="button" class="btn primary full" id="btn-done">완료 처리</button><p class="hint">완료하면 더 고칠 수 없고, 다시 열려면 관리자에게 요청해야 합니다.</p>`;
    }
    h += `<button type="button" class="btn line full" id="btn-pdf2">PDF 출력</button><a class="btn ghost full" href="#/view/${id}">휴대폰 보기 화면</a>`;
    if (isAdmin) h += `<button type="button" class="btn ghost full danger-t" id="btn-del">보고서 삭제</button>`;
    $('#status-box').innerHTML = h;
    const sel = $('#st-sel');
    if (sel) sel.onchange = async () => {
      const v = sel.value;
      try { await flushAndSet({ status: v }); report.status = v; toast(`상태를 "${STATUS[v].label}"(으)로 바꿨습니다`); renderStatus(); }
      catch (e) { console.error(e); toast('상태를 바꾸지 못했습니다', 'err'); }
    };
    const bd = $('#btn-done'); if (bd) bd.onclick = markDone;
    $('#btn-pdf2').onclick = () => printReport();
    const del = $('#btn-del');
    if (del) del.onclick = async () => {
      if (!await confirmBox({ title: '보고서를 삭제할까요?', body: `<p>${esc(report.studentName)} 학생의 보고서가 지워지고 되돌릴 수 없습니다.</p>`, ok: '삭제', danger: true })) return;
      save.cancel();
      await deleteDoc(ref('reports', id));
      toast('삭제했습니다'); go('#/list');
    };
  }
  async function flushAndSet(extra) {
    save.cancel();
    st.dirty = false;
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

  /* ---------------- 자료 보기 패널 ---------------- */
  function filesHTML() {
    const T = data.teachers;
    const list = uploads.files.map(f => `<li class="${f.id === uploads.cur ? 'on' : ''}"><button type="button" data-file="${f.id}"><span class="ic ${f.kind}">${{ img: 'JPG', sheet: 'XLS', json: 'DR', pdf: 'PDF' }[f.kind]}</span><span class="fn">${esc(f.name)}</span></button>
      <select class="fi sel tsel" data-ft="${f.id}" aria-label="누구의 자료인지">${T.map((t, i) => `<option value="${i}" ${f.teacherIdx === i ? 'selected' : ''}>${t.role} ${esc(t.name || '')}</option>`).join('')}</select>
      <button type="button" class="x" data-rm="${f.id}" aria-label="빼기">×</button></li>`).join('');
    const ai = config.aiEndpoint ? `<button type="button" class="btn gold full" id="btn-ai">AI로 읽어서 채우기</button>` : `<p class="hint">자동 인식(AI)은 관리자가 설정에서 연결하면 켜집니다. 지금은 자료를 옆에 띄워 놓고 직접 입력하세요.</p>`;
    return `<div class="pn files">
      <h3>올린 자료</h3>
      <label class="drop" for="up-in"><b>＋ 사진 · 엑셀 올리기</b><small>입회원서 사진, 수업 기록 엑셀·CSV, 데일리 리포트 백업(json)</small></label>
      <input type="file" id="up-in" multiple accept="image/*,.xlsx,.xls,.csv,.json,.pdf" hidden>
      ${T.length > 1 ? `<label class="lb">새로 올릴 자료의 선생님</label><select class="fi sel full" id="up-teacher">${T.map((t, i) => `<option value="${i}">${t.role} ${esc(t.name || '')}</option>`).join('')}</select>` : ''}
      <ul class="flist">${list || '<li class="none">아직 올린 자료가 없습니다.</li>'}</ul>
      ${uploads.files.length ? ai : ''}
      <p class="hint">올린 자료는 이 기기 화면에만 띄우고 서버에 저장하지 않습니다.</p>
    </div>
    <div class="viewer" id="viewer">${viewerHTML()}</div>`;
  }
  function viewerHTML() {
    const f = uploads.current;
    if (!f) return '';
    if (f.kind === 'img') return `<div class="v-img"><div class="v-tools"><button type="button" class="btn ghost sm" data-zoom>확대/맞춤</button><button type="button" class="btn ghost sm" data-rot>회전</button><button type="button" class="btn ghost sm" data-pop>크게 보기</button></div><div class="v-frame ${f.zoom ? 'zoom' : ''}"><img src="${f.url}" alt="${esc(f.name)}" style="transform:rotate(${f.rot || 0}deg)"></div></div>`;
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
  function bindFiles() {
    const inpEl = $('#up-in');
    if (inpEl) inpEl.onchange = async () => {
      const ti = $('#up-teacher') ? +$('#up-teacher').value : 0;
      try { await uploads.add([...inpEl.files], ti); } catch (e) { toast(e.message, 'err'); }
      inpEl.value = '';
      renderRight();
    };
    const drop = $('.files .drop');
    if (drop) {
      drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
      drop.ondragleave = () => drop.classList.remove('over');
      drop.ondrop = async e => {
        e.preventDefault(); drop.classList.remove('over');
        const ti = $('#up-teacher') ? +$('#up-teacher').value : 0;
        try { await uploads.add([...e.dataTransfer.files], ti); } catch (er) { toast(er.message, 'err'); }
        renderRight();
      };
    }
    $$('[data-file]').forEach(b => b.onclick = () => { uploads.cur = b.dataset.file; renderRight(); });
    $$('[data-rm]').forEach(b => b.onclick = () => { uploads.remove(b.dataset.rm); renderRight(); });
    $$('[data-ft]').forEach(s => s.onchange = () => { const f = uploads.files.find(x => x.id === s.dataset.ft); if (f) f.teacherIdx = +s.value; });
    const v = $('#viewer'); if (!v) return;
    v.onclick = async e => {
      const f = uploads.current; if (!f) return;
      const t = e.target.closest('button,input'); if (!t) return;
      if (t.hasAttribute('data-zoom')) { f.zoom = !f.zoom; v.innerHTML = viewerHTML(); }
      else if (t.hasAttribute('data-rot')) { f.rot = ((f.rot || 0) + 90) % 360; v.innerHTML = viewerHTML(); }
      else if (t.hasAttribute('data-pop')) { popImage(f); }
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
  async function runAI() {
    const btn = $('#btn-ai'); btn.disabled = true; btn.textContent = 'AI가 읽는 중… (30초 정도 걸립니다)';
    try {
      const out = await aiRead(config.aiEndpoint, { data, uploads });
      const check = applyAI(data, out);
      touch(); renderSheets(); renderRight(); updateTeacherLine();
      await confirmBox({ title: 'AI가 읽은 내용을 채웠습니다', body: `<p>채운 값을 지면에서 확인하고 필요하면 고쳐주세요.</p>${check.length ? `<p><b>확인이 필요한 부분</b></p><ul>${check.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}${data.ai_memo ? `<p><b>상담 메모 (브리핑 참고)</b><br>${esc(data.ai_memo)}</p>` : ''}`, ok: '확인', cancel: '닫기' });
    } catch (e) { console.error(e); toast(e.message || 'AI 인식에 실패했습니다', 'err'); }
    finally { const b = $('#btn-ai'); if (b) { b.disabled = false; b.textContent = 'AI로 읽어서 채우기'; } }
  }

  /* ---------------- 데일리 리포트 불러오기 ---------------- */
  async function drImport(fromFile = false) {
    let db;
    try {
      if (!fromFile && !drReady()) {
        const go2 = await confirmBox({ title: '데일리 리포트가 이 기기에 연결되어 있지 않습니다', body: '<p>설정에서 데일리 리포트 저장소를 연결하거나, 데일리 리포트의 <b>설정 · 백업 → 백업 파일 내려받기(JSON)</b>로 받은 파일을 "자료 올리기"로 올려주세요.</p>', ok: '자료 올리기 열기', cancel: '닫기' });
        if (go2) { st.right = 'files'; openRight(); renderRight(); }
        return;
      }
      toast('데일리 리포트를 불러오는 중…');
      db = await fetchDR(fromFile ? false : true);
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
        <label class="lb">어느 선생님의 수업 기록인가요?</label>
        <select name="row" class="fi sel full">${T.map((t, i) => `<option value="${i}" ${i === defRow ? 'selected' : ''}>${t.role} ${esc(t.name || '')}</option>`).join('')}</select>
        <p class="hint">데일리 리포트 담당 강사: ${esc(drTeacher || '정보 없음')}. 같은 날 두 선생님 기록이 있으면 선생님별로 각각 셉니다.</p>`,
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
      <tr><th>진행 교재</th><td>${s.books.map(b => esc(b.book + (b.rate != null ? ` (${b.rate}%)` : ''))).join('<br>') || '–'}</td></tr>
      <tr><th>태도 · 집중 평균</th><td>${s.attitude || '–'} · ${s.focus || '–'}</td></tr>
      ${s.tests.length ? `<tr><th>테스트</th><td>${s.tests.map(t => esc(`${t.name} ${t.score}${t.total ? '/' + t.total : ''}`)).join('<br>')}</td></tr>` : ''}</table>
      <p class="hint">${esc(row.role + ' ' + (row.name || ''))} 줄에 채웁니다. 채운 뒤에도 지면에서 고칠 수 있어요.</p>`;
    if (!await confirmBox({ title: `${res.name} · ${res.from} ~ ${res.to}`, body: preview, ok: '보고서에 채우기' })) return;
    if (!row.name && drTeacher) row.name = drTeacher;
    applyDR(data, s, +res.row);
    touch(); renderSheets(); renderRight(); updateTeacherLine();
    toast('데일리 리포트 내용을 채웠습니다');
  }

  function updateTeacherLine() {
    const t = teacherLine(data);
    const a = $('#teacher-line'); if (a) a.textContent = t || '아래 출결 표에서 선생님 이름을 넣어주세요';
    const b = $('#who-line'); if (b) b.textContent = t || '담임 미지정';
  }
  function updateSums() {
    const S = sums(data);
    $$('[data-sum]', sheets).forEach(td => { const k = td.dataset.sum; td.textContent = S[k] === '' ? '–' : S[k] + (k === 'hwRate' ? '%' : ''); });
  }

  /* ---------------- 이벤트 ---------------- */
  sheets.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.k) {
      data[el.dataset.k] = el.value;
      if (el.tagName === 'TEXTAREA') autoGrow(el);
      if (['school', 'grade', 'student_name'].includes(el.dataset.k)) $$('.sh-who', sheets).forEach(w => { w.innerHTML = `<span>학교<b>${esc([data.school, data.grade].filter(Boolean).join(' '))}</b></span><span>이름<b>${esc(data.student_name)}</b></span>`; });
      touch();
    } else if (el.dataset.t != null) {
      data.teachers[+el.dataset.t][el.dataset.f] = el.value;
      if (el.dataset.f === 'name') updateTeacherLine();
      updateSums(); touch();
    }
  });
  sheets.addEventListener('change', e => { if (e.target.dataset.k === 'roadmap_label') renderSheets(); });
  sheets.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.q) {
      const id = b.dataset.q, v = b.dataset.v, q = Q[id];
      if (q.type === 'multi') {
        let arr = data.answers[id] || [];
        if (v === '④ 지적할 것이 없다') arr = arr.includes(v) ? [] : [v];
        else { arr = arr.filter(x => x !== '④ 지적할 것이 없다'); arr = arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]; }
        data.answers[id] = arr;
      } else data.answers[id] = data.answers[id] === v ? '' : v;
      const block = $('#q-' + id, sheets);
      if (block) { const tmp = document.createElement('div'); tmp.innerHTML = qHTML(id); block.replaceWith(tmp.firstElementChild); $$('#q-' + id + ' textarea', sheets).forEach(autoGrow); }
      touch(); if (st.right === 'summary') renderRight();
      return;
    }
    if (b.dataset.gen) {
      const k = b.dataset.gen;
      let text = '', field = '';
      if (k === 'coaching') { text = genCoaching(data); field = 'coaching_reason'; if (!text) return toast('먼저 공책 교정 항목을 선택해주세요', 'err'); }
      if (k === 'prelearning') { text = genPrelearning(data); field = 'prelearning_reason'; if (!text) return toast('먼저 선행 반응 항목을 선택해주세요', 'err'); }
      if (k === 'briefing') {
        field = 'briefing_text';
        const d0 = new Date(); const m = data.att_to ? data.att_to.match(/(\d{4})\D+(\d{1,2})/) : null;
        text = genBriefing(data, m ? `${m[1]}년 ${+m[2]}월` : `${d0.getFullYear()}년 ${d0.getMonth() + 1}월`);
        if (data.ai_memo) text += `\n\n■ 입회 상담 메모\n${data.ai_memo}`;
      }
      if (data[field] && data[field].trim() && !await confirmBox({ title: '이미 쓴 내용이 있습니다', body: '<p>자동생성한 초안으로 바꿀까요? 지금 쓴 내용은 사라집니다.</p>', ok: '바꾸기' })) return;
      data[field] = text;
      const t = $(`textarea[data-k="${field}"]`, sheets); if (t) { t.value = text; autoGrow(t); t.focus(); }
      touch(); return;
    }
    if (b.id === 'add-sub') {
      const names = Object.entries(staffNames);
      const r = await formBox({ title: '부담임 줄 추가', html: `<label class="lb">부담임 선생님</label><select name="email" class="fi sel full"><option value="">직접 입력</option>${names.map(([em, n]) => `<option value="${esc(em)}">${esc(n)} (${esc(em)})</option>`).join('')}</select><label class="lb">직접 입력할 이름</label><input class="fi full" name="name" placeholder="선생님 이름">`, ok: '추가' });
      if (!r) return;
      data.teachers.push(newTeacherRow('부담임', r.email ? staffNames[r.email] : r.name, r.email || ''));
      touch(); renderSheets(); updateTeacherLine(); return;
    }
    if (b.dataset.delT) {
      if (!await confirmBox({ title: '부담임 줄을 지울까요?', body: '<p>이 줄에 넣은 출결·과제 숫자도 함께 지워집니다.</p>', ok: '지우기', danger: true })) return;
      data.teachers.splice(+b.dataset.delT, 1);
      touch(); renderSheets(); updateTeacherLine();
    }
  });

  const goPage = p => { st.page = Math.max(0, Math.min(3, p)); renderSheets(); $('#ed-center').scrollTo({ top: 0 }); window.scrollTo({ top: 0 }); closePanels(); };
  $('#pages').onclick = e => { const b = e.target.closest('[data-pg]'); if (!b) return; if (st.all) { const t = $(`.sheet[data-p="${b.dataset.pg}"]`); st.page = +b.dataset.pg; $$('#pages button').forEach(x => x.classList.toggle('on', x === b)); if (t) t.scrollIntoView({ behavior: 'smooth' }); closePanels(); } else goPage(+b.dataset.pg); };
  $('#dots').onclick = e => { const b = e.target.closest('[data-pg]'); if (b) goPage(+b.dataset.pg); };
  $('#prev').onclick = () => goPage(st.page - 1);
  $('#next').onclick = () => { if (st.page === 3) { if (isAdmin) printReport(); else markDone(); } else goPage(st.page + 1); };
  $('#v-one').onclick = () => { st.all = false; renderSheets(); };
  $('#v-all').onclick = () => { st.all = true; renderSheets(); };
  $('#btn-dr').onclick = () => drImport(false);
  $('#btn-up').onclick = () => { st.right = 'files'; renderRight(); openRight(); };
  $$('.tabs2 button').forEach(b => b.onclick = () => { st.right = b.dataset.r; renderRight(); });
  $('#btn-pdf').onclick = () => printReport();

  // 태블릿: 좌우 패널을 서랍처럼
  const wrap = $('.ed');
  function closePanels() { wrap.classList.remove('show-left', 'show-right'); }
  function openRight() { wrap.classList.add('show-right'); wrap.classList.remove('show-left'); }
  $('#btn-left').onclick = () => { wrap.classList.toggle('show-left'); wrap.classList.remove('show-right'); };
  $('#btn-right').onclick = () => { wrap.classList.toggle('show-right'); wrap.classList.remove('show-left'); };
  wrap.addEventListener('click', e => { if (e.target === wrap) closePanels(); });

  function printReport() {
    flush();
    printNow({ ...report, data });
  }

  renderSheets();
  renderRight();
}

// 인쇄 (편집 화면 · 보기 화면 공용)
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
