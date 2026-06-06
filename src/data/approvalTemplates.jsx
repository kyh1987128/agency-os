// ════════════════════════════════════════════════════════════════════════════
// 전자결재 양식(템플릿) 30종 — 입력 필드 + "실제 문서" 본문 생성기
//   fields   : 입력 항목 (작성 폼 + 요약표)
//   docKind  : form | contract | cert | letter  (문서 렌더 방식)
//   body(v)  : 채워진 값으로 만드는 문서 본문(마크다운) — 조항/증명문/서신
//   signers(v): 서명란 배열 [{role,name,seal}] | null
// ════════════════════════════════════════════════════════════════════════════

export const COMPANY = "콘텐츠잇다";
export const DOC_GROUPS = ["근태", "재무", "인사", "계약", "보고", "업무", "자산"];

// 빈칸 표시
const d = (v, ph = "________") => (v == null || v === "" ? ph : v);
const won = (v) => (v == null || v === "" ? "________" : String(v).replace(/[^\d]/g, "") ? Number(String(v).replace(/[^\d]/g, "")).toLocaleString("ko-KR") : v);

export const DOC_TYPES = [
  // ─────────────────────────── 근태 ───────────────────────────
  {
    key: "vacation", label: "휴가 신청서", icon: "🏖", color: "#0ea5e9", group: "근태", docKind: "form",
    guide: "연차·반차·병가·경조 휴가를 사전에 신청합니다. 시작일 최소 1일 전 상신 권장, 인수인계 필수.", line: "팀장 → (3일↑ 시 대표)",
    fields: [{ k: "kind", label: "휴가 종류", type: "select", opts: ["연차", "반차(오전)", "반차(오후)", "병가", "경조", "공가", "무급휴가"] }, { k: "from", label: "시작일", type: "date" }, { k: "to", label: "종료일", type: "date" }, { k: "days", label: "사용 일수", type: "text" }, { k: "reason", label: "사유", type: "text" }, { k: "handover", label: "업무 인수인계", type: "area" }, { k: "contact", label: "비상 연락처", type: "text" }],
    body: (v) => `아래와 같이 **${d(v.kind, "휴가")}**를 신청하오니 재가하여 주시기 바랍니다.\n\n- **기간** : ${d(v.from)} ~ ${d(v.to)} (${d(v.days, "__")}일)\n- **사유** : ${d(v.reason)}\n- **인수인계** : ${d(v.handover, "—")}\n- **비상 연락처** : ${d(v.contact, "—")}\n\n> 휴가 기간 중 긴급사항은 위 연락처로 대응 가능하며, 담당 업무는 인수인계 내용대로 처리됩니다.`,
    signers: null,
  },
  {
    key: "leave_early", label: "조퇴·외출·지각", icon: "🚪", color: "#0ea5e9", group: "근태", docKind: "form",
    guide: "당일 조퇴·외출·지각을 보고/승인받습니다. 부득이한 경우 사후 상신도 가능.", line: "팀장",
    fields: [{ k: "kind", label: "구분", type: "select", opts: ["조퇴", "외출", "지각"] }, { k: "date", label: "일자", type: "date" }, { k: "time", label: "시간(예: 14:00~16:00)", type: "text" }, { k: "reason", label: "사유", type: "text" }],
    body: (v) => `아래와 같이 **${d(v.kind, "조퇴/외출/지각")}**을(를) 신청합니다.\n\n- **일자** : ${d(v.date)}\n- **시간** : ${d(v.time)}\n- **사유** : ${d(v.reason)}\n\n> 부재 시간 동안의 업무 공백은 발생하지 않도록 조치하였습니다.`,
    signers: null,
  },
  {
    key: "trip", label: "출장 신청서", icon: "✈️", color: "#0ea5e9", group: "근태", docKind: "form",
    guide: "국내·외 출장 일정과 예상 경비를 사전 승인받습니다. 복귀 후 출장비 정산서 별도 상신.", line: "팀장 → 대표",
    fields: [{ k: "place", label: "출장지", type: "text" }, { k: "from", label: "시작일", type: "date" }, { k: "to", label: "종료일", type: "date" }, { k: "with", label: "동행자", type: "text" }, { k: "purpose", label: "목적", type: "area" }, { k: "cost", label: "예상 경비(원)", type: "text" }, { k: "transport", label: "이동수단", type: "select", opts: ["자차", "대중교통", "법인차량", "렌트", "항공"] }],
    body: (v) => `아래와 같이 출장을 신청합니다.\n\n- **출장지** : ${d(v.place)}\n- **기간** : ${d(v.from)} ~ ${d(v.to)}\n- **동행자** : ${d(v.with, "—")}\n- **이동수단** : ${d(v.transport)}\n- **예상 경비** : ${won(v.cost)}원\n\n**출장 목적**\n\n${d(v.purpose)}\n\n> 복귀 후 실제 사용 경비는 「출장비 정산서」로 별도 상신하겠습니다.`,
    signers: null,
  },
  {
    key: "overtime", label: "시간외근무(야근)", icon: "🌙", color: "#0ea5e9", group: "근태", docKind: "form",
    guide: "연장·야간·휴일 근무를 사전 신청합니다. 식대·교통비 정산 근거가 됩니다.", line: "팀장",
    fields: [{ k: "date", label: "일자", type: "date" }, { k: "kind", label: "구분", type: "select", opts: ["연장(평일)", "야간(22시 이후)", "휴일근무"] }, { k: "time", label: "예상 시간(예: 19:00~22:00)", type: "text" }, { k: "reason", label: "사유", type: "area" }],
    body: (v) => `아래와 같이 시간외근무를 신청합니다.\n\n- **일자** : ${d(v.date)}\n- **구분** : ${d(v.kind)}\n- **예상 시간** : ${d(v.time)}\n\n**업무 사유**\n\n${d(v.reason)}\n\n> 본 근무는 식대·교통비 정산 및 보상휴가 산정의 근거가 됩니다.`,
    signers: null,
  },
  {
    key: "remote", label: "재택·유연근무 신청", icon: "🏠", color: "#0ea5e9", group: "근태", docKind: "form",
    guide: "재택근무 또는 시차출퇴근 등 유연근무를 신청합니다. 업무 연락 가능 시간 명시.", line: "팀장 → (정기 시 대표)",
    fields: [{ k: "kind", label: "유형", type: "select", opts: ["재택근무", "시차출퇴근", "선택근무"] }, { k: "from", label: "시작일", type: "date" }, { k: "to", label: "종료일", type: "date" }, { k: "hours", label: "근무 시간대", type: "text" }, { k: "work", label: "수행 업무", type: "area" }, { k: "contact", label: "연락 가능 채널", type: "text" }],
    body: (v) => `아래와 같이 **${d(v.kind, "유연근무")}**를 신청합니다.\n\n- **기간** : ${d(v.from)} ~ ${d(v.to)}\n- **근무 시간대** : ${d(v.hours)}\n- **연락 가능 채널** : ${d(v.contact)}\n\n**수행 업무**\n\n${d(v.work)}\n\n> 근무 시간 중 상시 연락 가능하며, 업무 산출물로 근태를 갈음합니다.`,
    signers: null,
  },
  {
    key: "leave_long", label: "휴직·복직계", icon: "🗓", color: "#0ea5e9", group: "근태", docKind: "letter",
    guide: "장기 휴직(육아·질병·개인 등) 또는 복직을 신청합니다. 인사 처리 근거 문서.", line: "팀장 → 대표",
    fields: [{ k: "kind", label: "구분", type: "select", opts: ["휴직", "복직"] }, { k: "reason_kind", label: "휴직 사유", type: "select", opts: ["육아", "질병", "가족돌봄", "개인사유", "기타"] }, { k: "from", label: "시작일", type: "date" }, { k: "to", label: "예정 종료일", type: "date" }, { k: "reason", label: "상세 사유", type: "area" }, { k: "handover", label: "인수인계 계획", type: "area" }],
    body: (v) => `수신 : 대표이사\n\n제목 : **${d(v.kind, "휴직")}계**\n\n본인은 아래와 같은 사유로 **${d(v.kind, "휴직")}**하고자 하오니 허락하여 주시기 바랍니다.\n\n- **사유 구분** : ${d(v.reason_kind, "—")}\n- **기간** : ${d(v.from)} ~ ${d(v.to)}\n\n**상세 사유**\n\n${d(v.reason)}\n\n**인수인계 계획**\n\n${d(v.handover, "—")}`,
    signers: (v) => [{ role: "신청인", name: "(기안자 본인)" }],
  },

  // ─────────────────────────── 재무 ───────────────────────────
  {
    key: "expense", label: "지출결의서", icon: "💳", color: "#16a34a", group: "재무", docKind: "form",
    guide: "이미 지출했거나 확정된 비용의 결재·정산을 올립니다. 영수증·증빙 첨부 필수.", line: "팀장 → 재무 → (고액 시 대표)",
    fields: [{ k: "item", label: "항목", type: "text" }, { k: "amount", label: "금액(원)", type: "text" }, { k: "date", label: "지출일", type: "date" }, { k: "method", label: "결제수단", type: "select", opts: ["법인카드", "개인카드(환급)", "계좌이체", "현금"] }, { k: "account", label: "환급 계좌(개인카드 시)", type: "text" }, { k: "detail", label: "내역", type: "area" }],
    body: (v) => `아래와 같이 지출하였기에 결의합니다.\n\n- **항목** : ${d(v.item)}\n- **금액** : **${won(v.amount)}원**\n- **지출일** : ${d(v.date)}\n- **결제수단** : ${d(v.method)}${v.account ? `\n- **환급 계좌** : ${v.account}` : ""}\n\n**지출 내역**\n\n${d(v.detail)}\n\n> 관련 영수증·세금계산서 등 증빙을 첨부합니다.`,
    signers: null,
  },
  {
    key: "purchase", label: "구매 품의서", icon: "🛒", color: "#16a34a", group: "재무", docKind: "form",
    guide: "물품·서비스를 구매하기 전에 사전 승인받습니다. 견적서 첨부 권장, 50만원↑ 견적 2곳 비교.", line: "팀장 → 재무 → 대표",
    fields: [{ k: "item", label: "품목", type: "text" }, { k: "qty", label: "수량", type: "text" }, { k: "amount", label: "예상 금액(원)", type: "text" }, { k: "vendor", label: "구매처", type: "text" }, { k: "reason", label: "필요 사유", type: "area" }, { k: "compare", label: "견적 비교(2곳↑ 시)", type: "area" }],
    body: (v) => `아래와 같이 구매하고자 하오니 재가하여 주시기 바랍니다.\n\n- **품목** : ${d(v.item)}\n- **수량** : ${d(v.qty)}\n- **예상 금액** : **${won(v.amount)}원**\n- **구매처** : ${d(v.vendor)}\n\n**필요 사유**\n\n${d(v.reason)}${v.compare ? `\n\n**견적 비교**\n\n${v.compare}` : ""}`,
    signers: null,
  },
  {
    key: "settle_trip", label: "출장비 정산서", icon: "🧾", color: "#16a34a", group: "재무", docKind: "form",
    guide: "출장 복귀 후 실제 사용 경비를 정산합니다. 출장 신청서 번호와 영수증 첨부.", line: "팀장 → 재무",
    fields: [{ k: "tripref", label: "출장 신청 건", type: "text" }, { k: "period", label: "출장 기간", type: "text" }, { k: "transport", label: "교통비(원)", type: "text" }, { k: "stay", label: "숙박비(원)", type: "text" }, { k: "meal", label: "식대(원)", type: "text" }, { k: "etc", label: "기타(원)", type: "text" }, { k: "total", label: "합계(원)", type: "text" }, { k: "detail", label: "내역 설명", type: "area" }],
    body: (v) => `아래와 같이 출장비를 정산합니다.\n\n- **관련 출장** : ${d(v.tripref)}\n- **출장 기간** : ${d(v.period)}\n\n| 항목 | 금액 |\n|---|---|\n| 교통비 | ${won(v.transport)}원 |\n| 숙박비 | ${won(v.stay)}원 |\n| 식대 | ${won(v.meal)}원 |\n| 기타 | ${won(v.etc)}원 |\n| **합계** | **${won(v.total)}원** |\n\n${v.detail ? `**내역 설명**\n\n${v.detail}\n\n` : ""}> 항목별 영수증을 첨부합니다.`,
    signers: null,
  },
  {
    key: "corp_card", label: "법인카드 사용·발급", icon: "🪪", color: "#16a34a", group: "재무", docKind: "form",
    guide: "법인카드 신규 발급 또는 한도 초과 사용을 승인받습니다. 사용 목적·예상 한도 기재.", line: "재무 → 대표",
    fields: [{ k: "kind", label: "구분", type: "select", opts: ["신규 발급", "한도 상향", "사용 사전승인"] }, { k: "holder", label: "사용자", type: "text" }, { k: "limit", label: "필요 한도(월, 원)", type: "text" }, { k: "purpose", label: "사용 목적", type: "area" }],
    body: (v) => `아래와 같이 법인카드 **${d(v.kind)}**을(를) 신청합니다.\n\n- **사용자** : ${d(v.holder)}\n- **필요 한도(월)** : ${won(v.limit)}원\n\n**사용 목적**\n\n${d(v.purpose)}\n\n> 법인카드는 업무 용도로만 사용하며, 사용 내역은 매월 증빙과 함께 정산합니다.`,
    signers: null,
  },
  {
    key: "edu_fee", label: "교육비 지원 신청", icon: "🎓", color: "#16a34a", group: "재무", docKind: "form",
    guide: "직무 관련 교육·도서·세미나 비용 지원을 신청합니다. 수료 후 결과 공유 조건.", line: "팀장 → 재무",
    fields: [{ k: "course", label: "교육/도서명", type: "text" }, { k: "org", label: "기관", type: "text" }, { k: "period", label: "기간", type: "text" }, { k: "amount", label: "금액(원)", type: "text" }, { k: "benefit", label: "기대 효과·업무 연관", type: "area" }],
    body: (v) => `아래와 같이 교육비 지원을 신청합니다.\n\n- **교육/도서** : ${d(v.course)}\n- **기관** : ${d(v.org, "—")}\n- **기간** : ${d(v.period, "—")}\n- **금액** : **${won(v.amount)}원**\n\n**기대 효과 · 업무 연관성**\n\n${d(v.benefit)}\n\n> 수료(완료) 후 핵심 내용을 사내에 공유하겠습니다.`,
    signers: null,
  },
  {
    key: "event_money", label: "경조사비 신청", icon: "🎗", color: "#16a34a", group: "재무", docKind: "form",
    guide: "임직원 경조사에 대한 회사 지원금·화환을 신청합니다. 규정 금액표 기준.", line: "팀장 → 재무",
    fields: [{ k: "kind", label: "경조 구분", type: "select", opts: ["결혼", "출산", "조사(본인)", "조사(가족)", "기타"] }, { k: "target", label: "대상", type: "text" }, { k: "date", label: "일자", type: "date" }, { k: "amount", label: "금액(원)", type: "text" }, { k: "wreath", label: "화환 여부", type: "select", opts: ["불필요", "화환 신청"] }],
    body: (v) => `아래와 같이 경조사비를 신청합니다.\n\n- **경조 구분** : ${d(v.kind)}\n- **대상** : ${d(v.target)}\n- **일자** : ${d(v.date)}\n- **지원금** : **${won(v.amount)}원**\n- **화환** : ${d(v.wreath, "불필요")}\n\n> 사규 경조 지원 기준에 따라 신청합니다.`,
    signers: null,
  },
  {
    key: "budget", label: "예산 집행 품의", icon: "📊", color: "#16a34a", group: "재무", docKind: "form",
    guide: "프로젝트·부서 예산을 집행하기 위한 사전 품의입니다. 항목별 예산 대비 사용 계획.", line: "팀장 → 재무 → 대표",
    fields: [{ k: "project", label: "프로젝트/항목", type: "text" }, { k: "budget", label: "배정 예산(원)", type: "text" }, { k: "spend", label: "집행 예정(원)", type: "text" }, { k: "plan", label: "집행 계획", type: "area" }],
    body: (v) => `아래와 같이 예산 집행을 품의합니다.\n\n- **프로젝트/항목** : ${d(v.project)}\n- **배정 예산** : ${won(v.budget)}원\n- **집행 예정액** : **${won(v.spend)}원**\n\n**집행 계획**\n\n${d(v.plan)}`,
    signers: null,
  },

  // ─────────────────────────── 인사 ───────────────────────────
  {
    key: "hire", label: "채용 품의서", icon: "🧑‍💼", color: "#f59e0b", group: "인사", docKind: "form",
    guide: "신규 인력 채용을 위한 품의입니다. 충원 사유·직무·예산을 명확히 합니다.", line: "팀장 → 대표",
    fields: [{ k: "position", label: "채용 직무", type: "text" }, { k: "count", label: "인원", type: "text" }, { k: "type", label: "고용 형태", type: "select", opts: ["정규직", "계약직", "인턴", "프리랜서", "파트타임"] }, { k: "reason", label: "충원 사유", type: "area" }, { k: "salary", label: "예상 처우(연봉/월)", type: "text" }, { k: "when", label: "희망 입사 시기", type: "text" }],
    body: (v) => `아래와 같이 인력 채용을 품의합니다.\n\n- **직무** : ${d(v.position)}\n- **인원** : ${d(v.count, "__")}명\n- **고용 형태** : ${d(v.type)}\n- **예상 처우** : ${d(v.salary)}\n- **희망 입사** : ${d(v.when)}\n\n**충원 사유**\n\n${d(v.reason)}`,
    signers: null,
  },
  {
    key: "onboard_req", label: "입사 처리 요청", icon: "📥", color: "#f59e0b", group: "인사", docKind: "form",
    guide: "확정된 신규 입사자의 계정·장비·온보딩 세팅을 요청합니다.", line: "인사/총무",
    fields: [{ k: "name", label: "입사자", type: "text" }, { k: "position", label: "직무/부서", type: "text" }, { k: "joindate", label: "입사일", type: "date" }, { k: "needs", label: "필요 항목(계정·장비·자리)", type: "area" }],
    body: (v) => `아래 신규 입사자의 입사 처리를 요청합니다.\n\n- **성명** : ${d(v.name)}\n- **직무/부서** : ${d(v.position)}\n- **입사일** : ${d(v.joindate)}\n\n**필요 세팅 항목**\n\n${d(v.needs)}`,
    signers: null,
  },
  {
    key: "resign", label: "사직·퇴사 처리", icon: "📤", color: "#f59e0b", group: "인사", docKind: "letter",
    guide: "퇴사 의사 표명 및 퇴사 처리(인수인계·반납·정산) 요청입니다.", line: "팀장 → 대표",
    fields: [{ k: "name", label: "성명", type: "text" }, { k: "lastday", label: "최종 근무일", type: "date" }, { k: "reason", label: "사유", type: "area" }, { k: "handover", label: "인수인계 계획", type: "area" }, { k: "return", label: "반납 항목(장비·카드 등)", type: "area" }],
    body: (v) => `수신 : 대표이사\n\n제목 : **사직서**\n\n본인 **${d(v.name)}**은(는) 일신상의 사유로 **${d(v.lastday)}**부로 사직하고자 하오니 처리하여 주시기 바랍니다.\n\n**사유**\n\n${d(v.reason)}\n\n**인수인계 계획**\n\n${d(v.handover, "—")}\n\n**반납 항목**\n\n${d(v.return, "—")}`,
    signers: (v) => [{ role: "사직인", name: d(v.name, "(본인)") }],
  },
  {
    key: "hr_order", label: "인사발령 품의", icon: "🔀", color: "#f59e0b", group: "인사", docKind: "form",
    guide: "부서 이동·직책 변경·승진 등 인사발령을 품의합니다.", line: "대표",
    fields: [{ k: "name", label: "대상자", type: "text" }, { k: "kind", label: "발령 구분", type: "select", opts: ["부서이동", "직책변경", "승진", "겸직", "전환"] }, { k: "before", label: "현재", type: "text" }, { k: "after", label: "변경", type: "text" }, { k: "effective", label: "발령일", type: "date" }, { k: "reason", label: "사유", type: "area" }],
    body: (v) => `아래와 같이 인사발령을 품의합니다.\n\n- **대상자** : ${d(v.name)}\n- **발령 구분** : ${d(v.kind)}\n- **현재 → 변경** : ${d(v.before)} → **${d(v.after)}**\n- **발령일** : ${d(v.effective)}\n\n**사유**\n\n${d(v.reason)}`,
    signers: null,
  },
  {
    key: "cert_employ", label: "재직증명서", icon: "📜", color: "#f59e0b", group: "인사", docKind: "cert",
    guide: "재직 사실 증명서 발급을 신청/발급합니다. 제출처와 용도를 기재하세요.", line: "인사",
    fields: [{ k: "name", label: "성명", type: "text" }, { k: "rrn", label: "생년월일", type: "text" }, { k: "dept", label: "소속/직위", type: "text" }, { k: "joined", label: "입사일", type: "date" }, { k: "purpose", label: "용도", type: "text" }, { k: "to", label: "제출처", type: "text" }],
    body: (v) => `### 재 직 증 명 서\n\n| 구분 | 내용 |\n|---|---|\n| 성명 | ${d(v.name)} |\n| 생년월일 | ${d(v.rrn)} |\n| 소속 / 직위 | ${d(v.dept)} |\n| 입사일 | ${d(v.joined)} |\n| 용도 | ${d(v.purpose)} |\n| 제출처 | ${d(v.to)} |\n\n위 사람은 현재 **${COMPANY}**에 재직하고 있음을 증명합니다.`,
    signers: () => [{ role: COMPANY + " 대표이사", name: "(직인)", seal: true }],
  },
  {
    key: "cert_career", label: "경력증명서", icon: "📃", color: "#f59e0b", group: "인사", docKind: "cert",
    guide: "재직/퇴직자의 경력증명서 발급을 신청/발급합니다.", line: "인사",
    fields: [{ k: "name", label: "성명", type: "text" }, { k: "rrn", label: "생년월일", type: "text" }, { k: "period", label: "재직 기간", type: "text" }, { k: "dept", label: "소속/직위", type: "text" }, { k: "duty", label: "담당 업무", type: "area" }, { k: "purpose", label: "용도", type: "text" }, { k: "to", label: "제출처", type: "text" }],
    body: (v) => `### 경 력 증 명 서\n\n| 구분 | 내용 |\n|---|---|\n| 성명 | ${d(v.name)} |\n| 생년월일 | ${d(v.rrn)} |\n| 재직 기간 | ${d(v.period)} |\n| 소속 / 직위 | ${d(v.dept)} |\n| 용도 / 제출처 | ${d(v.purpose)} / ${d(v.to)} |\n\n**담당 업무**\n\n${d(v.duty)}\n\n위 사람은 **${COMPANY}**에서 위 기간 동안 위와 같이 근무하였음을 증명합니다.`,
    signers: () => [{ role: COMPANY + " 대표이사", name: "(직인)", seal: true }],
  },

  // ─────────────────────────── 계약 ───────────────────────────
  {
    key: "ctr_service", label: "용역·외주 계약서", icon: "🤝", color: "#8b5cf6", group: "계약", docKind: "contract",
    guide: "외부 업체·프리랜서와의 용역/외주 계약을 체결합니다. 갑·을, 조항, 서명란 포함.", line: "팀장 → 재무 → 대표",
    fields: [{ k: "party", label: "계약 상대(상호/대표)", type: "text" }, { k: "subject", label: "용역명·목적", type: "text" }, { k: "scope", label: "용역 범위", type: "area" }, { k: "amount", label: "계약 금액(원, VAT 별도)", type: "text" }, { k: "pay", label: "대금 지급 조건", type: "text" }, { k: "from", label: "시작일", type: "date" }, { k: "to", label: "종료일", type: "date" }, { k: "deliver", label: "산출물·납기", type: "text" }],
    body: (v) => `**${COMPANY}**(이하 "갑")과 **${d(v.party, "(상대)")}**(이하 "을")은 「${d(v.subject, "용역")}」에 관하여 다음과 같이 계약을 체결한다.\n\n**제1조 (목적)** 본 계약은 갑이 을에게 위탁하는 용역의 수행 조건과 권리·의무를 정함을 목적으로 한다.\n\n**제2조 (용역 범위)**\n${d(v.scope, "— 별첨에 따른다")}\n\n**제3조 (계약 금액 및 지급)** ① 계약 금액은 **${won(v.amount)}원**(부가세 별도)으로 한다. ② 지급 조건은 「${d(v.pay, "협의에 따른다")}」로 한다.\n\n**제4조 (계약 기간)** ${d(v.from)} ~ ${d(v.to)}.\n\n**제5조 (산출물 및 납품)** 을은 「${d(v.deliver, "합의된 산출물")}」을 기한 내 납품하며, 갑의 검수 후 인수한다.\n\n**제6조 (비밀유지)** 양 당사자는 본 계약과 관련하여 알게 된 상대방의 비밀정보를 제3자에게 누설하지 아니한다.\n\n**제7조 (지식재산권)** 용역 결과물의 저작권 및 일체의 권리는 대금 완납과 동시에 갑에게 귀속된다.\n\n**제8조 (계약 해지)** 일방이 본 계약을 위반하고 상당 기간 내 시정하지 아니할 경우 상대방은 계약을 해지할 수 있다.\n\n**제9조 (손해배상)** 일방의 귀책으로 손해가 발생한 경우 그 당사자는 상대방의 손해를 배상한다.\n\n**제10조 (분쟁 해결)** 본 계약의 분쟁은 상호 협의로 해결하되, 협의가 안 될 경우 갑의 주소지 관할 법원을 전속관할로 한다.\n\n> 본 계약을 증명하기 위하여 계약서 2부를 작성, 갑과 을이 각 1부씩 보관한다.`,
    signers: (v) => [{ role: "갑 (도급인)", name: COMPANY, seal: true }, { role: "을 (수급인)", name: d(v.party, "________"), seal: true }],
  },
  {
    key: "ctr_labor", label: "근로계약서", icon: "📋", color: "#8b5cf6", group: "계약", docKind: "contract",
    guide: "신규 입사자 근로계약을 체결합니다. 근로기준법 필수 기재사항 포함, 갑·을 서명.", line: "인사 → 대표",
    fields: [{ k: "name", label: "근로자", type: "text" }, { k: "type", label: "계약 형태", type: "select", opts: ["정규직(기간없음)", "계약직(기간제)", "수습 포함"] }, { k: "start", label: "근로 시작일", type: "date" }, { k: "end", label: "계약 종료일(계약직)", type: "date" }, { k: "duty", label: "업무 내용", type: "text" }, { k: "place", label: "근무 장소", type: "text" }, { k: "hours", label: "근로시간(예: 09~18, 주40)", type: "text" }, { k: "salary", label: "임금(연/월, 구성)", type: "text" }, { k: "payday", label: "임금 지급일", type: "text" }, { k: "etc", label: "수습·연차·기타 조건", type: "area" }],
    body: (v) => `**${COMPANY}**(이하 "갑")과(와) **${d(v.name, "(근로자)")}**(이하 "을")은 다음과 같이 근로계약을 체결한다.\n\n**제1조 (근로계약기간)** ${d(v.type)} — ${d(v.start)} 부터${String(v.type || "").includes("계약직") ? ` ${d(v.end)} 까지` : " (기간의 정함이 없음)"}.\n\n**제2조 (근무 장소)** ${d(v.place)} (업무상 필요 시 변경될 수 있다).\n\n**제3조 (업무 내용)** ${d(v.duty)}.\n\n**제4조 (소정근로시간)** ${d(v.hours, "09:00 ~ 18:00 (휴게 1시간), 주 40시간")}.\n\n**제5조 (근무일 / 휴일)** 주 5일 근무, 주휴일은 일요일로 하며 그 밖의 휴일은 관계 법령 및 회사 규정에 따른다.\n\n**제6조 (임금)** ① 임금은 **${d(v.salary)}**로 한다. ② 지급일은 **${d(v.payday, "매월 말일")}**이며 본인 명의 계좌로 지급한다.\n\n**제7조 (연차유급휴가)** 연차유급휴가는 근로기준법이 정하는 바에 따라 부여한다.\n\n**제8조 (4대 보험)** 갑은 관계 법령에 따라 국민연금·건강보험·고용보험·산재보험에 가입한다.\n\n**제9조 (계약의 해지)** 을이 직무를 현저히 태만히 하거나 회사 규정을 중대하게 위반한 경우 갑은 관계 법령에 따라 계약을 해지할 수 있다.\n\n**제10조 (기타)** ${d(v.etc, "본 계약에 정함이 없는 사항은 근로기준법 및 취업규칙에 따른다.")}\n\n> 본 계약을 증명하기 위해 2부를 작성하여 갑과 을이 각 1부씩 보관한다.`,
    signers: (v) => [{ role: "갑 (사업주)", name: COMPANY, seal: true }, { role: "을 (근로자)", name: d(v.name, "________"), seal: true }],
  },
  {
    key: "ctr_nda", label: "비밀유지서약(NDA)", icon: "🔒", color: "#8b5cf6", group: "계약", docKind: "contract",
    guide: "임직원·외주사와 비밀유지·정보보호 서약을 체결합니다.", line: "팀장 → 대표",
    fields: [{ k: "party", label: "서약 상대", type: "text" }, { k: "scope", label: "비밀정보 범위", type: "area" }, { k: "period", label: "유지 기간(예: 종료 후 3년)", type: "text" }, { k: "reason", label: "체결 사유·배경", type: "text" }],
    body: (v) => `**${COMPANY}**(이하 "공개자")와 **${d(v.party, "(수령자)")}**(이하 "수령자")는 ${d(v.reason, "업무 수행")}과 관련하여 다음과 같이 비밀유지를 서약한다.\n\n**제1조 (비밀정보의 정의)** 본 서약상 비밀정보라 함은 다음을 포함한다.\n${d(v.scope, "— 공개자가 제공한 기술·영업·고객·재무 등 일체의 비공개 정보")}\n\n**제2조 (사용 제한)** 수령자는 비밀정보를 본래 목적 외로 사용하거나 공개자의 사전 서면 동의 없이 제3자에게 제공·누설하지 아니한다.\n\n**제3조 (예외)** 공지의 사실이거나 법령·법원의 요구에 따른 공개는 비밀정보로 보지 아니한다.\n\n**제4조 (유지 기간)** 본 서약의 효력은 ${d(v.period, "계약 종료 후 3년")}까지 존속한다.\n\n**제5조 (반환·폐기)** 목적 달성 또는 공개자 요청 시 수령자는 비밀정보 및 그 사본을 즉시 반환·폐기한다.\n\n**제6조 (위반 시 책임)** 본 서약 위반으로 손해가 발생한 경우 수령자는 이를 배상하며, 공개자는 침해 금지 등 법적 조치를 취할 수 있다.`,
    signers: (v) => [{ role: "공개자 (갑)", name: COMPANY, seal: true }, { role: "수령자 (을)", name: d(v.party, "________"), seal: true }],
  },
  {
    key: "ctr_freelancer", label: "프리랜서 계약서", icon: "🧑‍🎨", color: "#8b5cf6", group: "계약", docKind: "contract",
    guide: "프리랜서(촬영·편집·디자인 등) 건별/기간 계약을 체결합니다. 3.3% 원천징수 안내.", line: "팀장 → 재무",
    fields: [{ k: "name", label: "프리랜서명", type: "text" }, { k: "work", label: "작업 내용", type: "area" }, { k: "amount", label: "지급액(원)", type: "text" }, { k: "tax", label: "세금 처리", type: "select", opts: ["3.3% 원천징수", "세금계산서", "현금영수증"] }, { k: "deadline", label: "납기", type: "text" }, { k: "revise", label: "수정 범위", type: "text" }, { k: "pay", label: "지급 시점", type: "text" }],
    body: (v) => `**${COMPANY}**(이하 "갑")과 프리랜서 **${d(v.name, "(작업자)")}**(이하 "을")은 다음과 같이 계약한다.\n\n**제1조 (작업 범위)**\n${d(v.work)}\n\n**제2조 (대금 및 지급)** ① 대금은 **${won(v.amount)}원**으로 하고 세금 처리는 「${d(v.tax)}」로 한다. ② 지급 시점은 「${d(v.pay, "검수 완료 후 협의")}」로 한다.\n\n**제3조 (납기)** ${d(v.deadline)}.\n\n**제4조 (수정)** 수정 범위는 「${d(v.revise, "최초 합의 범위 내 2회")}」로 하며, 초과 수정은 별도 협의한다.\n\n**제5조 (저작권)** 작업 결과물의 저작재산권은 대금 완납과 동시에 갑에게 귀속하며, 을은 갑의 동의 없이 포트폴리오 외 사용을 하지 아니한다.\n\n**제6조 (지위)** 을은 갑의 근로자가 아닌 독립된 사업자로서, 4대보험·근로기준법상 근로자에 해당하지 아니한다.`,
    signers: (v) => [{ role: "갑 (의뢰인)", name: COMPANY, seal: true }, { role: "을 (작업자)", name: d(v.name, "________"), seal: true }],
  },
  {
    key: "ctr_review", label: "계약 검토 요청", icon: "🔍", color: "#8b5cf6", group: "계약", docKind: "form",
    guide: "외부에서 받은 계약서·MOU 등의 법무/내부 검토를 요청합니다. 원본 첨부.", line: "대표(또는 법무)",
    fields: [{ k: "party", label: "상대방", type: "text" }, { k: "kind", label: "문서 종류", type: "text" }, { k: "deadline", label: "회신 기한", type: "date" }, { k: "concern", label: "검토 요청 포인트", type: "area" }],
    body: (v) => `아래 계약 문서의 검토를 요청합니다.\n\n- **상대방** : ${d(v.party)}\n- **문서 종류** : ${d(v.kind)}\n- **회신 기한** : ${d(v.deadline)}\n\n**검토 요청 포인트**\n\n${d(v.concern)}\n\n> 원본 문서를 첨부합니다.`,
    signers: null,
  },

  // ─────────────────────────── 업무 ───────────────────────────
  {
    key: "coop", label: "업무협조전", icon: "📨", color: "#6366f1", group: "업무", docKind: "form",
    guide: "타 부서·담당에게 협조를 공식 요청합니다.", line: "팀장",
    fields: [{ k: "to", label: "협조 대상(부서/담당)", type: "text" }, { k: "due", label: "희망 기한", type: "date" }, { k: "content", label: "협조 요청 내용", type: "area" }],
    body: (v) => `**수신** : ${d(v.to)}\n\n아래와 같이 업무 협조를 요청합니다.\n\n- **희망 기한** : ${d(v.due)}\n\n**요청 내용**\n\n${d(v.content)}`,
    signers: null,
  },
  {
    key: "project_start", label: "프로젝트 착수 품의", icon: "🚀", color: "#6366f1", group: "업무", docKind: "form",
    guide: "신규 프로젝트 수주·착수를 위한 품의입니다. 범위·일정·예산·인력을 정리.", line: "팀장 → 대표",
    fields: [{ k: "name", label: "프로젝트명", type: "text" }, { k: "client", label: "클라이언트", type: "text" }, { k: "scope", label: "범위", type: "area" }, { k: "period", label: "기간", type: "text" }, { k: "budget", label: "예산/계약액(원)", type: "text" }, { k: "members", label: "투입 인력", type: "text" }],
    body: (v) => `아래와 같이 프로젝트 착수를 품의합니다.\n\n- **프로젝트** : ${d(v.name)}\n- **클라이언트** : ${d(v.client)}\n- **기간** : ${d(v.period)}\n- **예산/계약액** : **${won(v.budget)}원**\n- **투입 인력** : ${d(v.members)}\n\n**범위**\n\n${d(v.scope)}`,
    signers: null,
  },
  {
    key: "event_host", label: "행사·워크샵 개최", icon: "🎉", color: "#6366f1", group: "업무", docKind: "form",
    guide: "워크샵·회식·세미나 등 사내 행사 개최를 품의합니다. 일정·장소·예산.", line: "팀장 → 대표",
    fields: [{ k: "name", label: "행사명", type: "text" }, { k: "date", label: "일시", type: "text" }, { k: "place", label: "장소", type: "text" }, { k: "people", label: "참석 인원", type: "text" }, { k: "budget", label: "예산(원)", type: "text" }, { k: "plan", label: "진행 계획", type: "area" }],
    body: (v) => `아래와 같이 행사 개최를 품의합니다.\n\n- **행사명** : ${d(v.name)}\n- **일시** : ${d(v.date)}\n- **장소** : ${d(v.place)}\n- **참석 인원** : ${d(v.people)}\n- **예산** : **${won(v.budget)}원**\n\n**진행 계획**\n\n${d(v.plan)}`,
    signers: null,
  },
  {
    key: "pr_release", label: "대외 공문·보도자료", icon: "📰", color: "#6366f1", group: "업무", docKind: "letter",
    guide: "외부로 발송하는 공문·보도자료·SNS 공식 게시물의 발송 승인을 받습니다.", line: "팀장 → 대표",
    fields: [{ k: "kind", label: "구분", type: "select", opts: ["공문", "보도자료", "SNS 게시", "뉴스레터"] }, { k: "to", label: "수신처/채널", type: "text" }, { k: "when", label: "발송 예정일", type: "date" }, { k: "title", label: "제목", type: "text" }, { k: "body", label: "내용(본문)", type: "area" }],
    body: (v) => `아래 **${d(v.kind)}**의 발송 승인을 요청합니다.\n\n- **수신처/채널** : ${d(v.to)}\n- **발송 예정일** : ${d(v.when)}\n- **제목** : ${d(v.title)}\n\n**본문**\n\n${d(v.body)}`,
    signers: null,
  },
  {
    key: "report_doc", label: "사유서·경위서", icon: "📝", color: "#6366f1", group: "업무", docKind: "letter",
    guide: "사고·실수·규정 위반 등에 대한 경위와 재발방지를 보고합니다.", line: "팀장 → 대표",
    fields: [{ k: "kind", label: "구분", type: "select", opts: ["사유서", "경위서", "시말서"] }, { k: "subject", label: "제목", type: "text" }, { k: "when", label: "발생 일시", type: "text" }, { k: "content", label: "경위 내용", type: "area" }, { k: "prevent", label: "재발 방지 대책", type: "area" }],
    body: (v) => `수신 : 대표이사\n\n제목 : **${d(v.subject, d(v.kind, "사유서"))}** (${d(v.kind, "사유서")})\n\n- **발생 일시** : ${d(v.when)}\n\n**경위 내용**\n\n${d(v.content)}\n\n**재발 방지 대책**\n\n${d(v.prevent, "—")}\n\n> 위 내용은 사실과 다름이 없음을 확인합니다.`,
    signers: (v) => [{ role: "작성자", name: "(기안자 본인)" }],
  },
  {
    key: "general", label: "일반 기안", icon: "🗂", color: "#6366f1", group: "업무", docKind: "form",
    guide: "정해진 양식이 없는 일반 안건을 자유롭게 기안합니다.", line: "팀장(자유 지정)",
    fields: [{ k: "subject", label: "제목", type: "text" }, { k: "content", label: "기안 내용", type: "area" }],
    body: (v) => `${v.subject ? `**${v.subject}**\n\n` : ""}${d(v.content)}`,
    signers: null,
  },

  // ─────────────────────────── 보고 ───────────────────────────
  {
    key: "report_daily", label: "일일 업무보고", icon: "🗒", color: "#0891b2", group: "보고", docKind: "form",
    guide: "오늘 한 일과 내일 할 일을 보고합니다. 매일 퇴근 전, 본인 → 팀.", line: "팀장",
    fields: [{ k: "date", label: "일자", type: "date" }, { k: "done", label: "오늘 한 일", type: "area" }, { k: "issue", label: "진행률·이슈", type: "area" }, { k: "tomorrow", label: "내일 계획", type: "area" }],
    body: (v) => `**${d(v.date)} 일일 업무보고**\n\n**오늘 한 일**\n\n${d(v.done)}\n\n**진행률 · 이슈**\n\n${d(v.issue, "—")}\n\n**내일 계획**\n\n${d(v.tomorrow)}`,
    signers: null,
  },
  {
    key: "report_weekly", label: "주간 업무보고", icon: "📅", color: "#0891b2", group: "보고", docKind: "form",
    guide: "한 주의 성과·리스크를 정리하고 다음 주 우선순위를 공유합니다.", line: "팀장 → (대표)",
    fields: [{ k: "week", label: "주차·기간", type: "text" }, { k: "achieve", label: "주요 성과", type: "area" }, { k: "delay", label: "지연·이슈", type: "area" }, { k: "next", label: "다음 주 계획", type: "area" }, { k: "help", label: "도움 필요 사항", type: "text" }],
    body: (v) => `**주간 업무보고** (${d(v.week)})\n\n**주요 성과**\n\n${d(v.achieve)}\n\n**지연 · 이슈**\n\n${d(v.delay, "—")}\n\n**다음 주 계획**\n\n${d(v.next)}\n\n**도움 필요 사항** : ${d(v.help, "—")}`,
    signers: null,
  },
  {
    key: "report_monthly", label: "월간 업무보고", icon: "📆", color: "#0891b2", group: "보고", docKind: "form",
    guide: "월 단위 목표 대비 성과를 점검하고 다음 달 계획을 보고합니다.", line: "팀장 → 대표",
    fields: [{ k: "month", label: "해당 월", type: "text" }, { k: "goal", label: "목표 달성도", type: "area" }, { k: "achieve", label: "주요 성과", type: "area" }, { k: "metric", label: "주요 수치(매출·산출물 등)", type: "text" }, { k: "next", label: "다음 달 목표", type: "area" }],
    body: (v) => `**월간 업무보고** (${d(v.month)})\n\n**목표 달성도**\n\n${d(v.goal)}\n\n**주요 성과**\n\n${d(v.achieve)}\n\n**주요 수치** : ${d(v.metric, "—")}\n\n**다음 달 목표**\n\n${d(v.next)}`,
    signers: null,
  },
  {
    key: "report_meeting", label: "회의록", icon: "🗣", color: "#0891b2", group: "보고", docKind: "form",
    guide: "회의 안건·결정사항·할 일을 기록해 공유합니다.", line: "참석자 보고",
    fields: [{ k: "title", label: "회의명", type: "text" }, { k: "datetime", label: "일시·장소", type: "text" }, { k: "attendees", label: "참석자", type: "text" }, { k: "agenda", label: "안건", type: "area" }, { k: "decisions", label: "결정 사항", type: "area" }, { k: "todos", label: "할 일 · 담당 · 기한", type: "area" }],
    body: (v) => `**회의록 — ${d(v.title)}**\n\n- **일시·장소** : ${d(v.datetime)}\n- **참석자** : ${d(v.attendees)}\n\n**안건**\n\n${d(v.agenda)}\n\n**결정 사항**\n\n${d(v.decisions)}\n\n**할 일 (담당·기한)**\n\n${d(v.todos)}`,
    signers: null,
  },
  {
    key: "report_project", label: "프로젝트 결과보고서", icon: "🏁", color: "#0891b2", group: "보고", docKind: "form",
    guide: "완료된 프로젝트의 결과·성과·개선점을 보고합니다.", line: "팀장 → 대표",
    fields: [{ k: "project", label: "프로젝트명", type: "text" }, { k: "client", label: "클라이언트", type: "text" }, { k: "period", label: "수행 기간", type: "text" }, { k: "result", label: "결과 · 성과", type: "area" }, { k: "metric", label: "주요 수치(매출·조회수 등)", type: "text" }, { k: "issue", label: "이슈 · 개선점", type: "area" }, { k: "next", label: "후속 계획", type: "area" }],
    body: (v) => `**프로젝트 결과보고서**\n\n- **프로젝트** : ${d(v.project)}\n- **클라이언트** : ${d(v.client, "—")}\n- **수행 기간** : ${d(v.period)}\n\n**결과 · 성과**\n\n${d(v.result)}\n\n**주요 수치** : ${d(v.metric, "—")}\n\n**이슈 · 개선점**\n\n${d(v.issue, "—")}\n\n**후속 계획**\n\n${d(v.next, "—")}`,
    signers: null,
  },
  {
    key: "report_field", label: "외근·현장 보고", icon: "📍", color: "#0891b2", group: "보고", docKind: "form",
    guide: "외근·현장 방문 결과를 보고합니다.", line: "팀장",
    fields: [{ k: "place", label: "방문지", type: "text" }, { k: "date", label: "일자", type: "date" }, { k: "purpose", label: "목적", type: "text" }, { k: "content", label: "내용 · 결과", type: "area" }, { k: "next", label: "후속 조치", type: "area" }],
    body: (v) => `**외근 · 현장 보고**\n\n- **방문지** : ${d(v.place)}\n- **일자** : ${d(v.date)}\n- **목적** : ${d(v.purpose)}\n\n**내용 · 결과**\n\n${d(v.content)}\n\n**후속 조치**\n\n${d(v.next, "—")}`,
    signers: null,
  },

  // ─────────────────────────── 업무(계획·조사) ───────────────────────────
  {
    key: "plan_work", label: "업무 계획서", icon: "🗓", color: "#6366f1", group: "업무", docKind: "form",
    guide: "주간·월간 단위 업무 목표와 일정을 미리 계획·공유합니다.", line: "팀장",
    fields: [{ k: "kind", label: "구분", type: "select", opts: ["주간 계획", "월간 계획", "분기 계획"] }, { k: "period", label: "대상 기간", type: "text" }, { k: "goals", label: "목표", type: "area" }, { k: "tasks", label: "주요 업무", type: "area" }, { k: "schedule", label: "일정", type: "area" }],
    body: (v) => `**${d(v.kind, "업무 계획")}** (${d(v.period)})\n\n**목표**\n\n${d(v.goals)}\n\n**주요 업무**\n\n${d(v.tasks)}\n\n**일정**\n\n${d(v.schedule, "—")}`,
    signers: null,
  },
  {
    key: "research", label: "시장조사·리서치 보고", icon: "🔎", color: "#6366f1", group: "업무", docKind: "form",
    guide: "시장·경쟁사·트렌드 조사 결과와 시사점을 보고합니다.", line: "팀장",
    fields: [{ k: "subject", label: "조사 주제", type: "text" }, { k: "method", label: "조사 방법·범위", type: "text" }, { k: "finding", label: "주요 발견", type: "area" }, { k: "insight", label: "시사점 · 제안", type: "area" }],
    body: (v) => `**시장조사 · 리서치 보고**\n\n- **주제** : ${d(v.subject)}\n- **방법·범위** : ${d(v.method, "—")}\n\n**주요 발견**\n\n${d(v.finding)}\n\n**시사점 · 제안**\n\n${d(v.insight)}`,
    signers: null,
  },

  // ─────────────────────────── 자산 ───────────────────────────
  {
    key: "asset_out", label: "장비·물품 불출/반납", icon: "📦", color: "#0d9488", group: "자산", docKind: "form",
    guide: "촬영 장비·노트북 등 회사 자산의 불출(대여) 또는 반납을 신청합니다.", line: "총무",
    fields: [{ k: "kind", label: "구분", type: "select", opts: ["불출(대여)", "반납"] }, { k: "item", label: "품목", type: "text" }, { k: "qty", label: "수량", type: "text" }, { k: "period", label: "사용 기간", type: "text" }, { k: "purpose", label: "용도", type: "text" }, { k: "state", label: "상태(반납 시)", type: "text" }],
    body: (v) => `아래와 같이 자산 **${d(v.kind, "불출/반납")}**을(를) 신청합니다.\n\n- **품목** : ${d(v.item)}\n- **수량** : ${d(v.qty)}\n- **사용 기간** : ${d(v.period, "—")}\n- **용도** : ${d(v.purpose, "—")}\n- **상태(반납 시)** : ${d(v.state, "—")}\n\n> 분실·파손 시 즉시 보고하며, 반납 시 상태를 확인받습니다.`,
    signers: null,
  },

  // ─────────────────────────── 인사(추가) ───────────────────────────
  {
    key: "interview_eval", label: "면접 평가표", icon: "🧑‍⚖️", color: "#f59e0b", group: "인사", docKind: "form",
    guide: "면접 지원자에 대한 역량 평가와 합격 의견을 기록합니다.", line: "면접관 → 대표",
    fields: [{ k: "candidate", label: "지원자", type: "text" }, { k: "position", label: "지원 직무", type: "text" }, { k: "date", label: "면접일", type: "date" }, { k: "score", label: "역량 평가(직무·태도·소통 등)", type: "area" }, { k: "comment", label: "종합 의견", type: "area" }, { k: "result", label: "결과", type: "select", opts: ["합격", "보류", "불합격"] }],
    body: (v) => `**면접 평가표**\n\n- **지원자** : ${d(v.candidate)}\n- **지원 직무** : ${d(v.position)}\n- **면접일** : ${d(v.date)}\n\n**역량 평가**\n\n${d(v.score)}\n\n**종합 의견**\n\n${d(v.comment)}\n\n**평가 결과** : **${d(v.result, "보류")}**`,
    signers: null,
  },
  {
    key: "edu_report", label: "교육 수료 보고", icon: "🎓", color: "#f59e0b", group: "인사", docKind: "form",
    guide: "지원받은 교육·세미나 수료 결과와 업무 적용 계획을 보고합니다.", line: "팀장",
    fields: [{ k: "course", label: "교육명", type: "text" }, { k: "org", label: "기관", type: "text" }, { k: "period", label: "기간", type: "text" }, { k: "content", label: "주요 학습 내용", type: "area" }, { k: "apply", label: "업무 적용 계획", type: "area" }],
    body: (v) => `**교육 수료 보고**\n\n- **교육명** : ${d(v.course)}\n- **기관** : ${d(v.org, "—")}\n- **기간** : ${d(v.period, "—")}\n\n**주요 학습 내용**\n\n${d(v.content)}\n\n**업무 적용 계획**\n\n${d(v.apply)}`,
    signers: null,
  },
];

export const typeOf = (k) => DOC_TYPES.find((t) => t.key === k) || DOC_TYPES[DOC_TYPES.length - 1];
