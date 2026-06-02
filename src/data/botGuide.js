// 봇별 업무 가이드 설정 — 채팅 우측 "업무 가이드" 패널을 구동.
// 모든 봇이 자기 특성대로 동작하도록 여기에 데이터로 정의(하드코딩 아님).
// playbook[].kw : 대화 텍스트에서 그 키워드가 보이면 해당 단계 완료로 간주(규칙 기반, LLM 비용 0).

export const BOT_GUIDE = {
  team: {
    playbook: [
      { key: "analyze", label: "요청 분석", kw: ["분석", "계획"] },
      { key: "assign",  label: "봇 배정",  kw: ["배정", "담당", "맡"] },
      { key: "run",     label: "전문봇 실행", kw: ["작업 중", "실행", "완료"] },
      { key: "report",  label: "취합 보고", kw: ["모든 작업", "보고", "정리"] },
    ],
    starters: [
      { icon: "🤝", label: "여러 봇 협업 진행", prompt: "이 업무를 리서치부터 검토까지 적절한 봇들에게 순서대로 맡겨서 진행해줘." },
      { icon: "🧭", label: "업무 순서 짜기", prompt: "이 업무를 어떤 순서와 담당 봇으로 진행하면 좋을지 계획만 먼저 알려줘." },
    ],
    templates: [],
    quality: ["목표가 명확한가?", "담당 봇 배정이 적절한가?", "빠진 단계는 없나?"],
    nextBots: ["saup", "jiwon", "service", "research"],
  },

  director: {
    playbook: [
      { key: "grasp",  label: "요청 파악", kw: ["무엇", "목표", "파악"] },
      { key: "dir",    label: "방향 제시", kw: ["방향", "전략", "추천"] },
      { key: "assign", label: "업무 배분", kw: ["배분", "담당", "나눠"] },
      { key: "wrap",   label: "정리",     kw: ["정리", "요약"] },
    ],
    starters: [
      { icon: "🧩", label: "이 일 어떻게 진행?", prompt: "이 업무를 어떻게 진행하면 좋을지 단계별로 알려줘." },
      { icon: "🗂️", label: "업무 나누기", prompt: "이 프로젝트의 할 일을 담당별로 나눠서 정리해줘." },
    ],
    templates: [],
    quality: ["목표가 분명한가?", "우선순위가 있나?", "담당이 정해졌나?"],
    nextBots: ["saup", "jiwon", "service", "research", "ppt"],
  },

  saup: {
    playbook: [
      { key: "notice", label: "공고 분석", kw: ["공고", "요건 분석", "분석"] },
      { key: "req",    label: "요건 체크", kw: ["충족", "미충족", "자격", "체크리스트"] },
      { key: "toc",    label: "목차",      kw: ["목차", "구성", "챕터"] },
      { key: "draft",  label: "초안 작성", kw: ["초안", "사업 개요", "시장 분석", "추진"] },
      { key: "review", label: "검토",      kw: ["검토", "감수", "보완"] },
    ],
    starters: [
      { icon: "📎", label: "공고문 분석", prompt: "첨부한 공고문을 분석해서 핵심 지원요건을 정리해줘." },
      { icon: "📝", label: "사업계획서 초안", prompt: "우리 사업에 대한 사업계획서 초안을 작성해줘." },
      { icon: "📊", label: "요건 표로 정리", prompt: "공고 지원요건을 충족/미충족 표로 정리해줘." },
    ],
    templates: [
      { cmd: "/사업계획서", title: "사업계획서 초안", fields: [
          { key: "name",   label: "사업명",     type: "text" },
          { key: "target", label: "대상 공고",  type: "text" },
          { key: "len",    label: "분량",       type: "select", options: ["1페이지", "5페이지", "15페이지"] },
        ],
        build: (v) => `다음 조건으로 사업계획서 초안을 작성해줘.\n- 사업명: ${v.name}\n- 대상 공고: ${v.target}\n- 분량: ${v.len}` },
    ],
    quality: ["핵심 결론이 먼저 나오나?", "정량 수치(데이터)가 있나?", "문제→해결 스토리가 일관되나?", "공고 요건을 다 반영했나?"],
    nextBots: ["review", "ppt"],
  },

  jiwon: {
    playbook: [
      { key: "notice", label: "공고 분석", kw: ["공고", "분석"] },
      { key: "elig",   label: "자격 진단", kw: ["자격", "대상", "진단"] },
      { key: "bonus",  label: "가점 전략", kw: ["가점", "우대", "전략"] },
      { key: "form",   label: "신청서 작성", kw: ["신청서", "작성", "초안"] },
      { key: "review", label: "검토",      kw: ["검토", "감수"] },
    ],
    starters: [
      { icon: "📎", label: "공고 분석", prompt: "첨부한 지원사업 공고를 분석해서 자격요건과 마감을 정리해줘." },
      { icon: "✅", label: "자격 진단", prompt: "우리가 이 지원사업에 신청 자격이 되는지 진단해줘." },
      { icon: "📝", label: "신청서 초안", prompt: "이 지원사업 신청서 초안을 작성해줘." },
    ],
    templates: [
      { cmd: "/지원사업", title: "지원사업 신청서", fields: [
          { key: "name", label: "사업명",   type: "text" },
          { key: "org",  label: "주관기관", type: "text" },
          { key: "item", label: "신청 아이템", type: "text" },
        ],
        build: (v) => `다음 지원사업 신청서 초안을 작성해줘.\n- 사업명: ${v.name}\n- 주관기관: ${v.org}\n- 신청 아이템: ${v.item}` },
    ],
    quality: ["자격요건을 충족하나?", "가점 항목을 반영했나?", "예산이 타당한가?", "제출서류 목록을 챙겼나?"],
    nextBots: ["saup", "review"],
  },

  service: {
    playbook: [
      { key: "msg",    label: "핵심 메시지", kw: ["핵심 메시지", "메시지", "한 문장"] },
      { key: "struct", label: "구성",        kw: ["구성", "목차", "흐름"] },
      { key: "copy",   label: "카피 작성",   kw: ["카피", "문구", "초안"] },
      { key: "visual", label: "비주얼 안",   kw: ["비주얼", "이미지", "디자인"] },
      { key: "review", label: "검토",        kw: ["검토", "감수"] },
    ],
    starters: [
      { icon: "💡", label: "핵심 메시지 뽑기", prompt: "우리 서비스의 핵심 메시지를 한 문장으로 뽑아줘." },
      { icon: "📄", label: "소개서 초안", prompt: "서비스 소개서 초안을 작성해줘." },
      { icon: "🎨", label: "비주얼 제안", prompt: "각 섹션에 어울리는 비주얼/이미지 안을 제안해줘." },
    ],
    templates: [],
    quality: ["고객 관점으로 썼나?", "차별점이 명확한가?", "행동 유도(CTA)가 있나?"],
    nextBots: ["ppt", "review"],
  },

  cs: {
    playbook: [
      { key: "situation", label: "상황 파악", kw: ["상황", "문의", "내용"] },
      { key: "tone",      label: "톤 설정",   kw: ["톤", "어조", "정중"] },
      { key: "draft",     label: "초안",      kw: ["초안", "문구", "답변"] },
      { key: "ab",        label: "A/B 변형",  kw: ["변형", "다른 버전", "대안"] },
    ],
    starters: [
      { icon: "📋", label: "문의 상황 붙여넣기", prompt: "아래 고객 문의에 대한 응대 문구를 작성해줘:\n(여기에 문의 내용을 붙여넣으세요)" },
      { icon: "🙇", label: "사과/안내문", prompt: "정중한 사과 및 안내 문구를 작성해줘." },
    ],
    templates: [],
    quality: ["공감 표현이 있나?", "해결책이 명확한가?", "브랜드 톤에 맞나?"],
    nextBots: ["review"],
  },

  meeting: {
    playbook: [
      { key: "raw",    label: "원문 입력",   kw: ["원문", "녹취", "메모"] },
      { key: "key",    label: "핵심 추출",   kw: ["핵심", "요약", "결정"] },
      { key: "action", label: "액션 아이템", kw: ["액션", "할 일", "담당"] },
      { key: "tidy",   label: "정리",        kw: ["정리", "회의록"] },
    ],
    starters: [
      { icon: "📋", label: "녹취·메모 붙여넣기", prompt: "아래 회의 내용을 회의록으로 정리해줘:\n(여기에 녹취/메모를 붙여넣으세요)" },
      { icon: "✅", label: "액션아이템 추출", prompt: "이 회의에서 나온 할 일(액션아이템)을 담당자와 함께 정리해줘." },
    ],
    templates: [],
    quality: ["결정사항이 명확한가?", "담당자·기한이 있나?", "빠진 내용은 없나?"],
    nextBots: ["review"],
  },

  qa: {
    playbook: [
      { key: "q",      label: "질문 확인", kw: ["질문", "문의"] },
      { key: "check",  label: "자료 확인", kw: ["자료", "규정", "확인"] },
      { key: "answer", label: "답변",      kw: ["답변", "안내"] },
      { key: "src",    label: "근거 제시", kw: ["근거", "출처"] },
    ],
    starters: [
      { icon: "❓", label: "업무 문의", prompt: "사내 업무 관련해서 궁금한 점을 물어볼게: " },
      { icon: "📑", label: "규정 확인", prompt: "관련 규정/절차를 확인해서 알려줘: " },
    ],
    templates: [],
    quality: ["정확한가?", "근거가 있나?", "최신 정보인가?"],
    nextBots: ["research"],
  },

  research: {
    playbook: [
      { key: "define",  label: "질문 정의", kw: ["정의", "범위", "목적"] },
      { key: "collect", label: "자료 수집", kw: ["수집", "검색", "자료"] },
      { key: "analyze", label: "분석",      kw: ["분석", "비교", "인사이트"] },
      { key: "report",  label: "요약 보고", kw: ["요약", "보고", "결론"] },
    ],
    starters: [
      { icon: "🔍", label: "시장 조사", prompt: "이 분야의 시장 규모와 트렌드를 조사해줘." },
      { icon: "🏢", label: "경쟁사 분석", prompt: "주요 경쟁사를 조사해서 비교 표로 정리해줘." },
    ],
    templates: [
      { cmd: "/리서치", title: "리서치 의뢰", fields: [
          { key: "topic", label: "조사 주제", type: "text" },
          { key: "scope", label: "범위",     type: "text" },
        ],
        build: (v) => `다음 주제를 웹검색을 포함해 조사하고 요약 보고해줘.\n- 주제: ${v.topic}\n- 범위: ${v.scope}` },
    ],
    quality: ["출처가 신뢰할 만한가?", "최신 정보인가?", "편향 없이 균형 잡혔나?"],
    nextBots: ["saup", "service"],
  },

  review: {
    playbook: [
      { key: "std",    label: "기준 선택", kw: ["기준", "관점"] },
      { key: "check",  label: "점검",      kw: ["점검", "검토"] },
      { key: "fix",    label: "수정 제안", kw: ["수정", "제안", "보완"] },
      { key: "final",  label: "최종",      kw: ["최종", "완료"] },
    ],
    starters: [
      { icon: "📋", label: "문서 붙여넣어 검토", prompt: "아래 문서를 검토하고 개선점을 알려줘:\n(여기에 문서를 붙여넣으세요)" },
      { icon: "🔎", label: "논리·표현 점검", prompt: "이 글의 논리 흐름과 표현을 점검해줘." },
    ],
    templates: [],
    quality: ["사실이 정확한가?", "논리가 일관되나?", "표현이 적절한가?"],
    nextBots: [],
  },

  ppt: {
    playbook: [
      { key: "toc",    label: "목차",         kw: ["목차", "구성", "흐름"] },
      { key: "slide",  label: "슬라이드 내용", kw: ["슬라이드", "내용", "본문"] },
      { key: "img",    label: "이미지 프롬프트", kw: ["이미지", "프롬프트", "비주얼"] },
      { key: "layout", label: "배치 안",      kw: ["배치", "레이아웃", "구성안"] },
    ],
    starters: [
      { icon: "🧾", label: "발표 목차", prompt: "이 주제로 발표자료 목차를 짜줘." },
      { icon: "📊", label: "슬라이드 내용", prompt: "각 슬라이드에 들어갈 내용을 작성해줘." },
      { icon: "🖼️", label: "이미지 프롬프트", prompt: "각 슬라이드에 어울리는 이미지 생성 프롬프트를 제안해줘." },
    ],
    templates: [
      { cmd: "/발표자료", title: "발표자료 기획", fields: [
          { key: "topic",  label: "발표 주제", type: "text" },
          { key: "aud",    label: "발표 대상", type: "text" },
          { key: "slides", label: "슬라이드 수", type: "select", options: ["5장", "10장", "20장"] },
        ],
        build: (v) => `발표자료를 기획해줘.\n- 주제: ${v.topic}\n- 대상: ${v.aud}\n- 분량: ${v.slides}` },
    ],
    quality: ["슬라이드당 메시지 1개인가?", "시각화(표/그림)가 있나?", "분량이 적절한가?"],
    nextBots: ["review"],
  },
};

// 봇 이름 (흐름도/넘기기 표시용)
export const BOT_LABEL = {
  team: "통합 디렉터", director: "기획 디렉터", saup: "사업계획서", jiwon: "지원사업",
  service: "서비스소개서", cs: "CS 문구", meeting: "회의록", qa: "사내 Q&A",
  research: "리서치", review: "검토·감수", ppt: "발표자료 PPT",
};
export const BOT_EMOJI = {
  team: "🏢", director: "🎯", saup: "📑", jiwon: "🏛️", service: "📄", cs: "💬",
  meeting: "🗒️", qa: "❓", research: "🔍", review: "✅", ppt: "📊",
};

// 대화 텍스트로 현재 플레이북 단계 추정 (규칙 기반, LLM 비용 0)
export function detectStep(playbook, convText) {
  const text = (convText || "").toLowerCase();
  let done = 0;
  for (let i = 0; i < playbook.length; i++) {
    const hit = (playbook[i].kw || []).some((k) => text.includes(k.toLowerCase()));
    if (hit) done = i + 1;
    else if (done === i) break; // 연속 완료가 끊기면 거기까지
  }
  // done = 완료된 단계 수, 현재 진행 단계 index = done (마지막이면 마지막)
  const current = Math.min(done, playbook.length - 1);
  return { doneCount: done, current };
}
