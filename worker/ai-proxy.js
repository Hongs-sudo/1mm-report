// 1MM 보고서 · AI 인식 중계 서버 (Cloudflare Worker)
//
// 배포: Cloudflare 워커(mathlibrary-ai)를 이 저장소에 연결해 두면(Settings → Build, 루트 디렉터리 worker)
//       이 파일이 바뀔 때마다 자동으로 배포됩니다. 실행 위치는 wrangler.jsonc 에서 미국 동부로 고정.
// 1) (수동으로 할 때) Cloudflare 대시보드 → Workers & Pages → mathlibrary-ai → Edit code
// 2) 이 파일 내용을 전부 붙여넣고 Deploy
// 3) Worker → Settings → Variables and Secrets
//      ANTHROPIC_API_KEY (Secret)  : Anthropic API 키
//      ALLOWED_ORIGIN    (Text)    : https://hongs-sudo.github.io
//      MODEL             (Text,선택): 사용할 모델 이름 (비우면 아래 기본값)
// 4) 1MM 보고서 → 설정 · 연동 → AI 중계 서버 주소에 워커 주소 입력
//
// 잠금: 1MM 보고서에 구글로 로그인한, 등록된(사용 중) 선생님만 쓸 수 있습니다.
//   - 요청마다 Firebase 로그인 토큰의 서명·만료·프로젝트를 확인하고
//   - 그 선생님의 Firestore staff 문서가 있는지(사용 중인지) 확인합니다.
// 보내는 것: 입회원서 사진(축소본)과 엑셀 시트 내용(글자). 저장하지 않고 결과만 돌려줍니다.

const DEFAULT_MODEL = 'claude-sonnet-5-5';
const PROJECT_ID = 'mathlibrary-1mm';
const OWNER_EMAIL = 'ilmvm66@gmail.com';
const JWK_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

const PROMPT = `당신은 수학학원 "수학도서관"의 1개월 학습보고서 작성을 돕는 도우미입니다.
학생 한 명에 대한 자료(입회원서 사진, 선생님별 수업 기록 엑셀)를 받습니다.
엑셀은 선생님마다 양식이 다르고, 여러 학생의 기록이 한 시트에 카드처럼 섞여 있습니다.
이름 앞뒤에 학교·학년이 붙거나(예: 정서윤(염경2), 염경2 정서윤) 성이 빠질 수 있습니다.
비슷한 이름의 다른 학생(예: 정서우, 백서윤)은 절대 섞지 마세요. 확실하지 않으면 check에 적으세요.

해야 할 일:
- 입회원서에서: 직전학기 내신(prev_score), 진단평가 점수(entry_score, entry_score2), 입회일(join_date), 학교(school), 학년(grade), 기존 진도/교재(current_course 참고), 상담 메모(memo)를 읽습니다. 보호자 연락처·주소·생년월일은 읽지도 돌려주지도 마세요.
- 수업 기록에서: 지정된 기간 안의 이 학생 수업만 골라 선생님(role)별로 수업 횟수(sessions), 출석(present), 지각(late), 결석(absent), 결석보강(muAbsent), 진도보강(muProgress), 미보강(nomk), 과제 총 횟수(hwTotal), 과제 안 한 횟수(hwSkip), 과제 달성률 평균 %(hwRate, 0~100 숫자), 과정/교재(hwCourse)를 셉니다.
  같은 날 두 선생님 기록이 있으면 선생님별로 각각 셉니다. 셀 수 없는 항목은 비워두고 check에 이유를 씁니다.
- 결석·보강 날짜(att_days, 예: "결석 9/15(화) / 보강 9/19(토)"), 과제를 안 해온 날짜와 분량(hw_note, 줄바꿈으로 구분), 현재 진행 교재(current_progress)를 씁니다.

반드시 아래 JSON 하나만 출력하세요. 설명 문장은 쓰지 마세요.
{"fields":{"prev_score":"","entry_score":"","entry_score2":"","join_date":"","school":"","grade":"","current_course":"","att_days":"","hw_note":"","current_progress":""},
 "teachers":[{"role":"담임","sessions":"","present":"","late":"","absent":"","nomk":"","muAbsent":"","muProgress":"","hwTotal":"","hwSkip":"","hwRate":"","hwCourse":""}],
 "memo":"",
 "check":["확인이 필요한 점"]}`;

/* ---------- Firebase 로그인 토큰 확인 ---------- */
let jwkCache = { keys: null, until: 0 };
async function googleKeys() {
  if (jwkCache.keys && Date.now() < jwkCache.until) return jwkCache.keys;
  const r = await fetch(JWK_URL);
  if (!r.ok) throw new Error('keys');
  const j = await r.json();
  const m = /max-age=(\d+)/.exec(r.headers.get('Cache-Control') || '');
  jwkCache = { keys: j.keys || [], until: Date.now() + (m ? +m[1] : 3600) * 1000 };
  return jwkCache.keys;
}
function b64url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}
async function verifyIdToken(token) {
  const parts = (token || '').split('.');
  if (parts.length !== 3) return null;
  let header, payload;
  try {
    header = JSON.parse(new TextDecoder().decode(b64url(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(b64url(parts[1])));
  } catch { return null; }
  if (header.alg !== 'RS256' || !header.kid) return null;
  const jwk = (await googleKeys()).find(k => k.kid === header.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!ok) return null;
  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== PROJECT_ID) return null;
  if (payload.iss !== 'https://securetoken.google.com/' + PROJECT_ID) return null;
  if (!payload.sub || payload.exp < now || payload.iat > now + 300) return null;
  if (!payload.email || payload.email_verified !== true) return null;
  return payload;
}
// 등록된(사용 중) 선생님인지 — 선생님 본인 토큰으로 자기 staff 문서를 읽어 확인
async function isActiveStaff(email, token) {
  if (email === OWNER_EMAIL) return true;
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/staff/${encodeURIComponent(email)}`;
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) return false;
  const d = await r.json();
  return d.fields && d.fields.active && d.fields.active.booleanValue === true;
}

/* ---------- 요청 처리 ---------- */
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = env.ALLOWED_ORIGIN || 'https://hongs-sudo.github.io';
    const cors = {
      'Access-Control-Allow-Origin': allowed,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Vary': 'Origin'
    };
    const reply = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST' || origin !== allowed) return reply({ error: '허용되지 않은 요청입니다.' }, 403);

    // 로그인 확인
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    let user = null;
    try { user = await verifyIdToken(token); } catch { return reply({ error: '로그인 확인 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, 503); }
    if (!user) return reply({ error: '로그인이 확인되지 않았습니다. 새로고침 후 다시 로그인해 주세요.' }, 401);
    const email = String(user.email).toLowerCase();
    if (!(await isActiveStaff(email, token))) return reply({ error: '등록된 선생님 계정만 AI 인식을 쓸 수 있습니다.' }, 403);

    if (!env.ANTHROPIC_API_KEY) return reply({ error: 'AI 서버에 API 키(ANTHROPIC_API_KEY)가 없습니다.' }, 500);

    let body;
    try { body = await request.json(); } catch { return reply({ error: '요청 형식이 잘못되었습니다.' }, 400); }

    const content = [];
    content.push({ type: 'text', text: `학생: ${JSON.stringify(body.student)}\n기간: ${JSON.stringify(body.period)}\n선생님: ${JSON.stringify(body.teachers)}` });
    for (const f of (body.files || []).slice(0, 12)) {
      if (f.kind === 'image' && f.dataUrl) {
        const m = /^data:(image\/[a-z]+);base64,(.+)$/.exec(f.dataUrl);
        if (!m) continue;
        content.push({ type: 'text', text: `[사진] ${f.name} · ${f.role || ''} ${f.teacher || ''}` });
        content.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } });
      } else if (f.kind === 'sheet' && f.text) {
        content.push({ type: 'text', text: `[엑셀] ${f.name} · ${f.role || ''} ${f.teacher || ''}\n${f.text}` });
      }
    }

    const model = env.MODEL || DEFAULT_MODEL;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 4000, system: PROMPT, messages: [{ role: 'user', content }] })
    });
    if (!res.ok) {
      let msg = '';
      try { const e = await res.json(); msg = (e.error && e.error.message) || ''; } catch {}
      const hint = res.status === 401 ? 'API 키가 올바르지 않습니다.'
        : /credit|balance|billing/i.test(msg) ? 'Anthropic 크레딧이 부족합니다. 콘솔 결제(Billing)에서 충전해 주세요.'
        : res.status === 404 || /model/i.test(msg) ? `모델 이름(${model})을 확인해 주세요.`
        : res.status === 429 ? '요청이 많습니다. 잠시 후 다시 시도해 주세요.'
        : '';
      return reply({ error: `AI 응답 오류 ${res.status}${hint ? ' · ' + hint : ''}`, detail: msg.slice(0, 300) }, 502);
    }
    const out = await res.json();
    const text = (out.content || []).map(c => c.text || '').join('');
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    let parsed;
    try { parsed = JSON.parse(json); } catch { parsed = { fields: {}, teachers: [], check: ['AI 결과를 읽지 못했습니다. 다시 시도해 주세요.'] }; }
    return reply(parsed);
  }
};
