// 1MM 보고서 · AI 인식 중계 서버 (Cloudflare Worker)
// 아직 사용하지 않습니다. API 키를 준비한 뒤 아래 순서로 올리면, 관리자 설정에 주소를 넣는 순간 켜집니다.
//
// 1) Cloudflare 대시보드 → Workers & Pages → Create → Worker → 이름 예) mathlibrary-ai
// 2) 이 파일 내용을 붙여넣고 Deploy
// 3) Worker → Settings → Variables and Secrets
//      ANTHROPIC_API_KEY (Secret)  : Anthropic API 키
//      ALLOWED_ORIGIN    (Text)    : https://hongs-sudo.github.io
//      MODEL             (Text,선택): 사용할 모델 이름 (비우면 아래 기본값)
// 4) 1MM 보고서 → 설정 · 연동 → AI 중계 서버 주소에 https://mathlibrary-ai.○○○.workers.dev 입력
//
// 보내는 것: 입회원서 사진(축소본)과 엑셀 시트 내용(글자). 저장하지 않고 결과만 돌려줍니다.

const DEFAULT_MODEL = 'claude-sonnet-5-5';

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

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = env.ALLOWED_ORIGIN || 'https://hongs-sudo.github.io';
    const cors = {
      'Access-Control-Allow-Origin': allowed,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin'
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST' || origin !== allowed) return new Response('Forbidden', { status: 403, headers: cors });

    let body;
    try { body = await request.json(); } catch { return new Response('Bad request', { status: 400, headers: cors }); }

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

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: env.MODEL || DEFAULT_MODEL, max_tokens: 4000, system: PROMPT, messages: [{ role: 'user', content }] })
    });
    if (!res.ok) return new Response(JSON.stringify({ error: 'AI 응답 오류 ' + res.status }), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
    const out = await res.json();
    const text = (out.content || []).map(c => c.text || '').join('');
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    let parsed;
    try { parsed = JSON.parse(json); } catch { parsed = { fields: {}, teachers: [], check: ['AI 결과를 읽지 못했습니다. 다시 시도해 주세요.'] }; }
    return new Response(JSON.stringify(parsed), { headers: { ...cors, 'Content-Type': 'application/json' } });
  }
};
