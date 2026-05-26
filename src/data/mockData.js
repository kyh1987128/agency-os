export const DEPTS = [
  { id: "marketing", name: "마케팅", color: "#f59e0b" },
  { id: "content",   name: "콘텐츠", color: "#38bdf8" },
  { id: "design",    name: "디자인", color: "#f472b6" },
  { id: "dev",       name: "개발",   color: "#34d399" },
  { id: "strategy",  name: "전략",   color: "#a78bfa" },
  { id: "ops",       name: "운영",   color: "#fb923c" },
];

export const PROJS = [
  {
    id: "p1", title: "경남 소상공인 SNS 캠페인", dept: "marketing",
    status: "active", progress: 65,
    desc: "경남 지역 소상공인 인스타그램·유튜브 캠페인", due: "2025-08-31",
    tasks: [
      { t: "시장조사",  a: "h3", s: "done",   due: "06-15" },
      { t: "전략수립",  a: "h1", s: "done",   due: "06-30" },
      { t: "카피작성",  a: "h2", s: "active", due: "07-15" },
      { t: "디자인",    a: "h4", s: "todo",   due: "07-25" },
      { t: "광고집행",  a: "h2", s: "todo",   due: "08-10" },
    ],
  },
  {
    id: "p2", title: "브랜드잇다 유튜브 시리즈", dept: "content",
    status: "planning", progress: 20,
    desc: "브랜드잇다 SNS 대행 서비스 소개 유튜브 시리즈", due: "2025-09-30",
    tasks: [
      { t: "주제리서치", a: "h3", s: "done",   due: "06-20" },
      { t: "스크립트",   a: "h3", s: "active", due: "07-10" },
      { t: "촬영일정",   a: "h6", s: "todo",   due: "07-20" },
      { t: "편집",       a: "h3", s: "todo",   due: "08-20" },
    ],
  },
  {
    id: "p3", title: "KACES 홍보 영상", dept: "content",
    status: "done", progress: 100,
    desc: "KACES 촌촌락락 홍보 영상 제작 완료", due: "2025-06-30",
    tasks: [
      { t: "기획", a: "h3", s: "done", due: "04-10" },
      { t: "촬영", a: "h6", s: "done", due: "05-01" },
      { t: "모션", a: "h4", s: "done", due: "05-20" },
      { t: "편집", a: "h3", s: "done", due: "06-10" },
    ],
  },
  {
    id: "p4", title: "브랜드잇다 랜딩페이지", dept: "design",
    status: "review", progress: 80,
    desc: "branditda.com 랜딩페이지 리뉴얼", due: "2025-07-31",
    tasks: [
      { t: "UX분석", a: "h4", s: "done",   due: "05-10" },
      { t: "시안",   a: "h4", s: "done",   due: "06-01" },
      { t: "개발",   a: "h5", s: "active", due: "07-10" },
      { t: "QA",     a: "h5", s: "todo",   due: "07-25" },
    ],
  },
];

export const STATUS = {
  active:   { label: "진행중", c: "#d97706", bg: "#fef3c7" },
  planning: { label: "기획중", c: "#0284c7", bg: "#e0f2fe" },
  review:   { label: "검토중", c: "#6366f1", bg: "#ede9fe" },
  done:     { label: "완료",   c: "#16a34a", bg: "#dcfce7" },
};

export const TASK_STATUS_COLOR = { done: "#16a34a", active: "#d97706", todo: "#94a3b8" };

export const COLORS = {
  bg:      "#f1f5f9",
  surface: "#ffffff",
  border:  "#e2e8f0",
  text:    "#1e293b",
  muted:   "#64748b",
  accent:  "#6366f1",
};

export const getDept  = (id) => DEPTS.find((d) => d.id === id);
