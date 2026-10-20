// 공통 도구
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function nl2br(v) { return esc(v).replace(/\n/g, '<br>'); }

export function debounce(fn, ms) {
  let t;
  const f = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  f.flush = (...a) => { clearTimeout(t); return fn(...a); };
  f.cancel = () => clearTimeout(t);
  return f;
}

let toastT;
export function toast(msg, kind = '') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast show ' + kind;
  clearTimeout(toastT);
  toastT = setTimeout(() => { el.className = 'toast'; }, 2600);
}

// 화면 안 확인창 (브라우저 confirm 대신)
export function confirmBox({ title, body = '', ok = '확인', cancel = '취소', danger = false }) {
  return new Promise(resolve => {
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-back"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="mdl-t">
      <h3 id="mdl-t">${esc(title)}</h3>${body ? `<div class="modal-body">${body}</div>` : ''}
      <div class="modal-act"><button type="button" class="btn ghost" data-r="0">${esc(cancel)}</button>
      <button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-r="1">${esc(ok)}</button></div></div></div>`;
    const done = v => { root.innerHTML = ''; resolve(v); };
    root.querySelector('[data-r="1"]').onclick = () => done(true);
    root.querySelector('[data-r="0"]').onclick = () => done(false);
    root.querySelector('.modal-back').onclick = e => { if (e.target.classList.contains('modal-back')) done(false); };
    root.querySelector('[data-r="1"]').focus();
  });
}

// 입력 폼이 들어간 모달. build(el) 로 내용 연결, 확인 시 collect() 결과 반환
export function formBox({ title, html, ok = '저장', wide = false, onMount }) {
  return new Promise(resolve => {
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-back"><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="mdl-t">
      <h3 id="mdl-t">${esc(title)}</h3><form class="modal-body" id="mdl-form">${html}</form>
      <div class="modal-act"><button type="button" class="btn ghost" data-r="0">취소</button>
      <button type="submit" form="mdl-form" class="btn primary">${esc(ok)}</button></div></div></div>`;
    const form = root.querySelector('#mdl-form');
    const close = v => { root.innerHTML = ''; resolve(v); };
    root.querySelector('[data-r="0"]').onclick = () => close(null);
    form.onsubmit = e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      close(data);
    };
    if (onMount) onMount(form);
    const first = form.querySelector('input,select,textarea');
    if (first) first.focus();
  });
}

export function todayStr(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}
export function isoDate(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
// "2026.09.01" / "2026-09-01" / "2026. 9. 1" → Date
export function parseDate(s) {
  if (!s) return null;
  const m = String(s).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3]);
}
export function dotDate(iso) {
  const d = parseDate(iso);
  return d ? todayStr(d) : '';
}
export function md(iso) {
  const d = parseDate(iso);
  if (!d) return '';
  return `${d.getMonth() + 1}/${d.getDate()}(${'일월화수목금토'[d.getDay()]})`;
}
export function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export function num(v) {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(/[^\d.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}
export function lsGet(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } }
export function lsSet(k, v) { try { localStorage.setItem(k, v); } catch { /* 저장 불가 */ } }
export function lsDel(k) { try { localStorage.removeItem(k); } catch { /* */ } }
