/**
 * Agency OS - Claude Code MCP 서버
 * Claude Code CLI를 subprocess로 호출해서 AI 에이전트 응답 생성
 * 실행: node server.js
 */

import express from "express";
import cors from "cors";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { randomUUID, scryptSync, randomBytes, timingSafeEqual } from "crypto";
import MiniSearch from "minisearch";

// .env 로드 (Dify API 키 등) — Node 20.12+ 내장. 없으면 무시.
try { process.loadEnvFile(); } catch {}

const app = express();
const PORT = 3001;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR   = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(__dirname, "uploads");

app.use(cors({ origin: ["http://localhost:5173", "http://localhost:5174", /\.trycloudflare\.com$/] }));
app.use(express.json());
app.use("/uploads", express.static(UPLOAD_DIR));

// ── 파일 업로드 설정 (multer) ─────────────────────────────────────────────────
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB

// ── data/ 디렉토리 및 초기 파일 보장 ────────────────────────────────────────────
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// ── 프로젝트 파일 경로 헬퍼 ──────────────────────────────────────────────────────
function projectsFilePath() {
  return path.join(DATA_DIR, "projects.json");
}

function messagesFilePath(projectId) {
  return path.join(DATA_DIR, `messages_${projectId}.json`);
}

function kanbanFilePath(projectId) {
  return path.join(DATA_DIR, `kanban_${projectId}.json`);
}

// ── archive-folders 헬퍼 ─────────────────────────────────────────────────────
function loadArchiveFolders() {
  const fp = path.join(DATA_DIR, "archive-folders.json");
  if (!fs.existsSync(fp)) return [];
  try {
    return JSON.parse(fs.readFileSync(fp, "utf8"));
  } catch { return []; }
}
function saveArchiveFolders(data) {
  ensureDataDir();
  fs.writeFileSync(path.join(DATA_DIR, "archive-folders.json"), JSON.stringify(data, null, 2), "utf8");
}

// ── departments 헬퍼 ─────────────────────────────────────────────────────────
function loadDepartments() {
  const fp = path.join(DATA_DIR, "departments.json");
  if (!fs.existsSync(fp)) return [];
  return JSON.parse(fs.readFileSync(fp, "utf8"));
}
function saveDepartments(data) {
  fs.writeFileSync(path.join(DATA_DIR, "departments.json"), JSON.stringify(data, null, 2), "utf8");
}

// ── humans 헬퍼 ──────────────────────────────────────────────────────────────
function loadHumans() {
  const fp = path.join(DATA_DIR, "humans.json");
  if (!fs.existsSync(fp)) return [];
  return JSON.parse(fs.readFileSync(fp, "utf8"));
}
function saveHumans(data) {
  fs.writeFileSync(path.join(DATA_DIR, "humans.json"), JSON.stringify(data, null, 2), "utf8");
}
// 배포/최초 실행 시 기본 구성원 시드 + 이메일·권한 백필 (humans.json은 gitignore라 코드로 보장)
const DEFAULT_HUMANS = [
  { id: "h1", deptId: "marketing", name: "한지수", title: "브랜드 전략가",  avatar: "👩‍💼", color: "#f59e0b", status: "active", mood: "집중모드 🎯",     email: "jisoo@contentitda.co.kr",    role: "admin" },
  { id: "h2", deptId: "marketing", name: "박도현", title: "SNS 매니저",     avatar: "👨‍💻", color: "#f59e0b", status: "active", mood: "트렌드 스캐닝 📱", email: "dohyun@contentitda.co.kr",   role: "member" },
  { id: "h3", deptId: "content",   name: "오민준", title: "영상 PD",        avatar: "🎬",  color: "#38bdf8", status: "active", mood: "스토리보드 작성 📋", email: "minjun@contentitda.co.kr",   role: "member" },
  { id: "h4", deptId: "design",    name: "윤서아", title: "UI/UX 디자이너", avatar: "🎨",  color: "#f472b6", status: "active", mood: "와이어프레임 중 📐", email: "seoa@contentitda.co.kr",     role: "member" },
  { id: "h5", deptId: "dev",       name: "남현석", title: "프론트엔드",      avatar: "⚡",  color: "#34d399", status: "active", mood: "코드 리뷰 중 💻",   email: "hyunseok@contentitda.co.kr", role: "member" },
  { id: "h6", deptId: "ops",       name: "송예린", title: "PM",             avatar: "📋",  color: "#fb923c", status: "active", mood: "스탠드업 준비 📅",   email: "yerin@contentitda.co.kr",    role: "member" },
];
function ensureHumans() {
  let humans = loadHumans();
  if (!Array.isArray(humans) || humans.length === 0) { saveHumans(DEFAULT_HUMANS); return; }
  const seedByName = Object.fromEntries(DEFAULT_HUMANS.map((h) => [h.name, h]));
  let changed = false;
  humans = humans.map((h) => {
    const s = seedByName[h.name];
    if (s && (!h.email || !h.role)) { changed = true; return { ...h, email: h.email || s.email, role: h.role || s.role }; }
    return h;
  });
  if (changed) saveHumans(humans);
}
ensureHumans();

// ── projects_data 헬퍼 (projects_data.json — 기존 loadProjData와 동일 파일) ──
function loadProjectsData() {
  const fp = path.join(DATA_DIR, "projects_data.json");
  if (!fs.existsSync(fp)) return [];
  return JSON.parse(fs.readFileSync(fp, "utf8"));
}
function saveProjectsData(data) {
  fs.writeFileSync(path.join(DATA_DIR, "projects_data.json"), JSON.stringify(data, null, 2), "utf8");
}

// ── 프로젝트 목록 로드/저장 ───────────────────────────────────────────────────────
function loadProjects() {
  ensureDataDir();
  const filePath = projectsFilePath();
  try {
    if (!fs.existsSync(filePath)) {
      const initial = [
        {
          id: "default",
          name: "기본 워크스페이스",
          color: "#6366f1",
          createdAt: new Date().toISOString(),
        },
      ];
      fs.writeFileSync(filePath, JSON.stringify(initial, null, 2), "utf8");
      return initial;
    }
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return [
      {
        id: "default",
        name: "기본 워크스페이스",
        color: "#6366f1",
        createdAt: new Date().toISOString(),
      },
    ];
  }
}

function saveProjects(projects) {
  ensureDataDir();
  fs.writeFileSync(projectsFilePath(), JSON.stringify(projects, null, 2), "utf8");
}

// ── 메시지 로드/저장 (프로젝트별) ────────────────────────────────────────────────
function loadMessages(projectId = "default") {
  ensureDataDir();
  const filePath = messagesFilePath(projectId);
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify({}), "utf8");
    }
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveMessages(data, projectId = "default") {
  ensureDataDir();
  fs.writeFileSync(messagesFilePath(projectId), JSON.stringify(data, null, 2), "utf8");
}

// ── 칸반 로드/저장 (프로젝트별) ─────────────────────────────────────────────────
const DEFAULT_KANBAN = {
  columns: [
    { id: "todo",   label: "할일",   color: "#475569" },
    { id: "active", label: "진행중", color: "#f59e0b" },
    { id: "review", label: "검토중", color: "#6366f1" },
    { id: "done",   label: "완료",   color: "#34d399" },
  ],
  cards: [],
};

function loadKanban(projectId) {
  ensureDataDir();
  const filePath = kanbanFilePath(projectId);
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(DEFAULT_KANBAN, null, 2), "utf8");
      return JSON.parse(JSON.stringify(DEFAULT_KANBAN));
    }
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    // Migrate: add missing columns (e.g. "review" added in v2)
    const existingIds = new Set(data.columns.map(c => c.id));
    let migrated = false;
    for (const col of DEFAULT_KANBAN.columns) {
      if (!existingIds.has(col.id)) {
        // Insert before "done" if exists, else append
        const doneIdx = data.columns.findIndex(c => c.id === "done");
        if (doneIdx >= 0) data.columns.splice(doneIdx, 0, col);
        else data.columns.push(col);
        migrated = true;
      }
    }
    if (migrated) fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    return data;
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_KANBAN));
  }
}

function saveKanban(data, projectId) {
  ensureDataDir();
  fs.writeFileSync(kanbanFilePath(projectId), JSON.stringify(data, null, 2), "utf8");
}

// ── 노트 로드/저장 (프로젝트별) ──────────────────────────────────────────────
function notesFilePath(projectId) {
  return path.join(DATA_DIR, `notes_${projectId}.json`);
}

function loadNotes(projectId) {
  ensureDataDir();
  const fp = notesFilePath(projectId);
  try {
    if (!fs.existsSync(fp)) { fs.writeFileSync(fp, "[]", "utf8"); }
    return JSON.parse(fs.readFileSync(fp, "utf8"));
  } catch { return []; }
}

function saveNotes(notes, projectId) {
  ensureDataDir();
  fs.writeFileSync(notesFilePath(projectId), JSON.stringify(notes, null, 2), "utf8");
}

// ── 기록(Records) 로드/저장 ──────────────────────────────────────────────────
function recordsFilePath(entityType, entityId) {
  return path.join(DATA_DIR, `records_${entityType}_${entityId}.json`);
}

function loadRecords(entityType, entityId) {
  ensureDataDir();
  const fp = recordsFilePath(entityType, entityId);
  try {
    if (!fs.existsSync(fp)) { fs.writeFileSync(fp, "[]", "utf8"); }
    return JSON.parse(fs.readFileSync(fp, "utf8"));
  } catch { return []; }
}

function saveRecords(records, entityType, entityId) {
  ensureDataDir();
  fs.writeFileSync(recordsFilePath(entityType, entityId), JSON.stringify(records, null, 2), "utf8");
}

// ── 프로젝트 데이터(projects_data) 헬퍼 ─────────────────────────────────────
const INITIAL_PROJ_DATA = [
  {
    id: "p1", title: "경남 소상공인 SNS 캠페인", dept: "marketing",
    status: "active", progress: 65,
    desc: "경남 지역 소상공인 인스타그램·유튜브 캠페인", due: "2026-08-31",
    tasks: [
      { id: "t1", t: "시장조사", a: "h3", s: "done", due: "06-15", dueDate: "2026-06-15", subtasks: [
        { id: "sub_t1_1", t: "경쟁사 SNS 분석",      a: "h3", s: "done", dueDate: "2026-06-05", desc: "주요 경쟁 브랜드 인스타·유튜브 분석" },
        { id: "sub_t1_2", t: "타겟 오디언스 조사",    a: "h3", s: "done", dueDate: "2026-06-10", desc: "2030 소상공인 SNS 이용 패턴 조사" },
        { id: "sub_t1_3", t: "키워드 트렌드 분석",    a: "h2", s: "done", dueDate: "2026-06-15", desc: "인스타그램 해시태그·검색어 트렌드" },
      ]},
      { id: "t2", t: "전략수립", a: "h1", s: "done", due: "06-30", dueDate: "2026-06-30", subtasks: [
        { id: "sub_t2_1", t: "포지셔닝 전략 수립",    a: "h1", s: "done", dueDate: "2026-06-20", desc: "소상공인 공감 스토리텔링 방향 설정" },
        { id: "sub_t2_2", t: "콘텐츠 방향 정의",      a: "h1", s: "done", dueDate: "2026-06-25", desc: "피드·릴스·스토리 유형별 전략" },
        { id: "sub_t2_3", t: "KPI 및 일정 확정",      a: "h6", s: "done", dueDate: "2026-06-30", desc: "팔로워 증가율·도달률 목표 수치" },
      ]},
      { id: "t3", t: "카피작성", a: "h2", s: "active", due: "07-15", dueDate: "2026-07-15", subtasks: [
        { id: "sub_t3_1", t: "메인 슬로건 3종",        a: "h2", s: "active", dueDate: "2026-07-05", desc: "브랜드 핵심 메시지 반영한 슬로건" },
        { id: "sub_t3_2", t: "인스타그램 캡션 8종",    a: "h2", s: "active", dueDate: "2026-07-10", desc: "게시물별 CTA 포함 캡션" },
        { id: "sub_t3_3", t: "해시태그 풀 구성",        a: "h2", s: "todo",   dueDate: "2026-07-13", desc: "대·중·소 카테고리별 해시태그 40개" },
        { id: "sub_t3_4", t: "CTA 문구 3종",            a: "h2", s: "todo",   dueDate: "2026-07-15", desc: "클릭 유도·DM 유도·저장 유도용" },
      ]},
      { id: "t4", t: "디자인", a: "h4", s: "todo", due: "07-25", dueDate: "2026-07-25", subtasks: [
        { id: "sub_t4_1", t: "피드 이미지 10종",        a: "h4", s: "todo", dueDate: "2026-07-18", desc: "정사각형 1080×1080 피드 이미지" },
        { id: "sub_t4_2", t: "스토리 템플릿 5종",       a: "h4", s: "todo", dueDate: "2026-07-22", desc: "수직형 1080×1920 스토리 디자인" },
        { id: "sub_t4_3", t: "릴스 썸네일 4종",          a: "h4", s: "todo", dueDate: "2026-07-25", desc: "릴스용 커버 이미지" },
      ]},
      { id: "t5", t: "광고집행", a: "h2", s: "todo", due: "08-10", dueDate: "2026-08-10", subtasks: [
        { id: "sub_t5_1", t: "광고 소재 업로드",         a: "h2", s: "todo", dueDate: "2026-08-01", desc: "메타 광고 관리자 소재 세팅" },
        { id: "sub_t5_2", t: "타겟 오디언스 세팅",       a: "h1", s: "todo", dueDate: "2026-08-03", desc: "경남 지역·소상공인 관심사 타겟" },
        { id: "sub_t5_3", t: "예산 배분 및 입찰 전략",   a: "h6", s: "todo", dueDate: "2026-08-05", desc: "일일 예산·캠페인 목표 설정" },
      ]},
    ],
  },
  {
    id: "p2", title: "브랜드잇다 유튜브 시리즈", dept: "content",
    status: "planning", progress: 20,
    desc: "브랜드잇다 SNS 대행 서비스 소개 유튜브 시리즈", due: "2026-09-30",
    tasks: [
      { id: "t6", t: "주제리서치", a: "h3", s: "done", due: "06-20", dueDate: "2026-06-20", subtasks: [
        { id: "sub_t6_1", t: "유사 채널 벤치마킹",   a: "h3", s: "done", dueDate: "2026-06-15", desc: "마케팅 에이전시 유튜브 채널 분석" },
        { id: "sub_t6_2", t: "시청자 페르소나 설정", a: "h3", s: "done", dueDate: "2026-06-20", desc: "예비 창업자·SMB 사장님 페르소나" },
      ]},
      { id: "t7", t: "스크립트", a: "h3", s: "active", due: "07-10", dueDate: "2026-07-10", subtasks: [
        { id: "sub_t7_1", t: "1편 스크립트 (서비스 소개)", a: "h3", s: "active", dueDate: "2026-07-03", desc: "브랜드잇다 핵심 서비스 3분 소개" },
        { id: "sub_t7_2", t: "2편 스크립트 (성공 사례)",   a: "h3", s: "todo",   dueDate: "2026-07-07", desc: "클라이언트 성공 케이스 스터디" },
        { id: "sub_t7_3", t: "3편 스크립트 (Q&A)",         a: "h3", s: "todo",   dueDate: "2026-07-10", desc: "자주 묻는 SNS 운영 질문 답변" },
      ]},
      { id: "t8", t: "촬영일정", a: "h6", s: "todo", due: "07-20", dueDate: "2026-07-20", subtasks: [] },
      { id: "t9", t: "편집", a: "h3", s: "todo", due: "08-20", dueDate: "2026-08-20", subtasks: [] },
    ],
  },
  {
    id: "p3", title: "KACES 홍보 영상", dept: "content",
    status: "done", progress: 100,
    desc: "KACES 촌촌락락 홍보 영상 제작 완료", due: "2026-06-30",
    tasks: [
      { id: "t10", t: "기획", a: "h3", s: "done", due: "04-10", dueDate: "2026-04-10", subtasks: [
        { id: "sub_t10_1", t: "기획안 작성",     a: "h3", s: "done", dueDate: "2026-04-05", desc: "방향성·콘셉트·구성 기획안" },
        { id: "sub_t10_2", t: "클라이언트 확인", a: "h6", s: "done", dueDate: "2026-04-10", desc: "기획안 승인 및 피드백 반영" },
      ]},
      { id: "t11", t: "촬영", a: "h6", s: "done", due: "05-01", dueDate: "2026-05-01", subtasks: [] },
      { id: "t12", t: "모션", a: "h4", s: "done", due: "05-20", dueDate: "2026-05-20", subtasks: [] },
      { id: "t13", t: "편집", a: "h3", s: "done", due: "06-10", dueDate: "2026-06-10", subtasks: [] },
    ],
  },
  {
    id: "p4", title: "브랜드잇다 랜딩페이지", dept: "design",
    status: "review", progress: 80,
    desc: "branditda.com 랜딩페이지 리뉴얼", due: "2026-07-31",
    tasks: [
      { id: "t14", t: "UX분석", a: "h4", s: "done", due: "05-10", dueDate: "2026-05-10", subtasks: [
        { id: "sub_t14_1", t: "사용자 인터뷰 5건",    a: "h4", s: "done", dueDate: "2026-05-05", desc: "기존 랜딩페이지 UX 문제점 조사" },
        { id: "sub_t14_2", t: "히트맵 분석",          a: "h4", s: "done", dueDate: "2026-05-08", desc: "Hotjar 데이터 기반 이탈 구간 분석" },
        { id: "sub_t14_3", t: "개선 방향 정리",        a: "h4", s: "done", dueDate: "2026-05-10", desc: "개선 우선순위 및 와이어프레임 초안" },
      ]},
      { id: "t15", t: "시안",   a: "h4", s: "done",   due: "06-01", dueDate: "2026-06-01", subtasks: [] },
      { id: "t16", t: "개발",   a: "h5", s: "active", due: "07-10", dueDate: "2026-07-10", subtasks: [
        { id: "sub_t16_1", t: "퍼블리싱 (HTML/CSS)", a: "h5", s: "done",   dueDate: "2026-06-20", desc: "반응형 마크업 작업" },
        { id: "sub_t16_2", t: "JS 인터랙션",          a: "h5", s: "active", dueDate: "2026-07-05", desc: "스크롤 애니메이션·폼 유효성 검사" },
        { id: "sub_t16_3", t: "배포 및 DNS 연결",      a: "h5", s: "todo",   dueDate: "2026-07-10", desc: "Vercel 배포·도메인 연결" },
      ]},
      { id: "t17", t: "QA", a: "h5", s: "todo", due: "07-25", dueDate: "2026-07-25", subtasks: [
        { id: "sub_t17_1", t: "크로스 브라우저 테스트", a: "h5", s: "todo", dueDate: "2026-07-18", desc: "Chrome·Safari·Firefox·모바일" },
        { id: "sub_t17_2", t: "성능 최적화",            a: "h5", s: "todo", dueDate: "2026-07-22", desc: "Lighthouse 점수 90+ 달성" },
      ]},
    ],
  },
];

function projDataFilePath() {
  return path.join(DATA_DIR, "projects_data.json");
}

function loadProjData() {
  ensureDataDir();
  const fp = projDataFilePath();
  try {
    if (!fs.existsSync(fp)) {
      fs.writeFileSync(fp, JSON.stringify(INITIAL_PROJ_DATA, null, 2), "utf8");
      return JSON.parse(JSON.stringify(INITIAL_PROJ_DATA));
    }
    return JSON.parse(fs.readFileSync(fp, "utf8"));
  } catch {
    return JSON.parse(JSON.stringify(INITIAL_PROJ_DATA));
  }
}

function saveProjData(data) {
  ensureDataDir();
  fs.writeFileSync(projDataFilePath(), JSON.stringify(data, null, 2), "utf8");
}

function recalcProgress(project) {
  if (!project.tasks || project.tasks.length === 0) return 0;
  const doneCount = project.tasks.filter((t) => t.s === "done").length;
  return Math.round((doneCount / project.tasks.length) * 100);
}

// ── SSE 클라이언트 관리 ───────────────────────────────────────────────────────
const sseClients = new Set();

function broadcastMessage(message) {
  const payload = `data: ${JSON.stringify(message)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// ── 에이전트 시스템 프롬프트 ──────────────────────────────────────────────────
const AGENT_PROMPTS = {
  ai_m1: "너는 마루야. Agency OS 마케팅팀의 브랜드 전략 AI 에이전트야. 브랜드 포지셔닝, 경쟁사 분석, 캠페인 전략을 전문으로 해. 한국어로 간결하고 전문적으로 답해.",
  ai_m2: "너는 소나야. Agency OS 마케팅팀의 SNS 최적화 AI야. 인스타그램/유튜브 알고리즘 분석, 최적 게시 시간 산출, 트렌드 분석이 특기야. 한국어로 답해.",
  ai_m3: "너는 카이야. Agency OS 마케팅팀의 카피라이팅 AI야. 타깃 고객 맞춤 카피와 광고 문구 생성이 특기야. 창의적이고 임팩트 있는 한국어로 답해.",
  ai_m4: "너는 애즈야. Agency OS 마케팅팀의 광고 기획 AI야. 광고 예산 배분, 채널별 성과 예측, ROI 분석이 특기야. 한국어로 답해.",
  ai_c1: "너는 비전이야. Agency OS 콘텐츠팀의 영상 기획 AI야. 유튜브 영상 기획서, 썸네일 컨셉, 시리즈 구성이 특기야. 한국어로 답해.",
  ai_c2: "너는 노벨이야. Agency OS 콘텐츠팀의 스크립트 AI야. 영상 스크립트, 자막, 내레이션 작성이 특기야. 한국어로 자연스럽게 답해.",
  ai_c3: "너는 컷이야. Agency OS 콘텐츠팀의 편집 디렉팅 AI야. 컷 편집 순서, 색보정 방향, 편집 리듬 제안이 특기야. 한국어로 답해.",
  ai_d1: "너는 픽스야. Agency OS 디자인팀의 UI/UX AI야. 사용자 행동 분석, UI 개선안, UX 플로우 제안이 특기야. 한국어로 답해.",
  ai_d2: "너는 플로우야. Agency OS 디자인팀의 모션그래픽 AI야. 브랜드 모션, 인트로/아웃트로, 트랜지션 제안이 특기야. 한국어로 답해.",
  ai_d3: "너는 스케치야. Agency OS 디자인팀의 브랜드 디자인 AI야. 로고, 컬러팔레트, 타이포그래피 제안이 특기야. 한국어로 답해.",
  ai_v1: "너는 코드야. Agency OS 개발팀의 프론트엔드 AI야. React 컴포넌트 설계, 디자인→코드 변환이 특기야. 한국어로 답해.",
  ai_v2: "너는 서버야. Agency OS 개발팀의 백엔드 AI야. API 설계, DB 쿼리 최적화, 아키텍처 설계가 특기야. 한국어로 답해.",
  ai_v3: "너는 데브야. Agency OS 개발팀의 DevOps AI야. 배포 파이프라인, CI/CD, 서버 모니터링이 특기야. 한국어로 답해.",
  ai_s1: "너는 오라클이야. Agency OS 전략팀의 시장 분석 AI야. 시장 데이터 수집, 경쟁사 분석, 트렌드 예측이 특기야. 한국어로 답해.",
  ai_s2: "너는 인사이트야. Agency OS 전략팀의 비즈니스 전략 AI야. 데이터 기반 전략 인사이트, KPI 분석, 사업 방향 제안이 특기야. 한국어로 답해.",
  ai_o1: "너는 플랜이야. Agency OS 운영팀의 프로젝트 관리 AI야. 업무 우선순위 정리, 일정 최적화, 병목 구간 해결이 특기야. 한국어로 답해.",
  ai_o2: "너는 옵스야. Agency OS 운영팀의 워크플로우 AI야. 반복 업무 자동화, 프로세스 개선, 효율화 방안이 특기야. 한국어로 답해.",
};

const DIRECTOR_PROMPT = `너는 디렉터야. Agency OS의 총괄 AI 에이전트로, 직원들의 업무 요청을 분석해서 적절한 전문 에이전트들에게 배분하는 역할이야.

대화 흐름:
1. 처음엔 업무를 파악하기 위한 질문을 1-2개만 해 (자연어로)
2. 충분한 정보가 모이면 반드시 아래 JSON 형식으로만 제안해

제안 JSON 형식:
{"type":"proposal","summary":"한줄요약","tasks":[{"agent":"마루","agentId":"ai_m1","task":"업무명","dept":"마케팅"},{"agent":"소나","agentId":"ai_m2","task":"업무명","dept":"마케팅"}]}

사용 가능한 에이전트:
- 마루(ai_m1): 브랜드전략, 마케팅
- 소나(ai_m2): SNS최적화, 마케팅
- 카이(ai_m3): 카피라이팅, 마케팅
- 애즈(ai_m4): 광고기획, 마케팅
- 비전(ai_c1): 영상기획, 콘텐츠
- 노벨(ai_c2): 스크립트, 콘텐츠
- 픽스(ai_d1): UI/UX, 디자인
- 오라클(ai_s1): 시장분석, 전략
- 인사이트(ai_s2): 비즈니스전략, 전략
- 플랜(ai_o1): 프로젝트관리, 운영

규칙: 업무 제안 시 반드시 JSON만 출력. 질문할 땐 자연어로.
한국어로 답해.`;

// 채널별 기본 에이전트
const CHANNEL_AGENTS = {
  general:   "ai_o1",
  marketing: "ai_m1",
  content:   "ai_c1",
  design:    "ai_d1",
  dev:       "ai_v1",
  strategy:  "ai_s1",
  ops:       "ai_o1",
};

// ── 공통 Claude CLI 스트리밍 핸들러 ─────────────────────────────────────────
function runClaudeStream({ res, systemPrompt, prompt, onComplete }) {
  const claudeExe = process.platform === "win32"
    ? "C:\\Users\\jhkoo\\AppData\\Roaming\\npm\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe"
    : "claude";

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const proc = spawn(claudeExe, [
    "--print",
    "--output-format", "text",
    "--append-system-prompt", systemPrompt,
    prompt,
  ], {
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let fullText = "";

  proc.stdout.on("data", (data) => {
    const text = data.toString();
    fullText += text;
    console.log(`[STDOUT] ${text.slice(0, 50)}`);
    res.write(`data: ${JSON.stringify({ text })}\n\n`);
  });

  proc.stderr.on("data", (data) => {
    console.error("[STDERR]", data.toString().slice(0, 100));
  });

  proc.on("close", (code, signal) => {
    console.log(`[CLOSE] exit=${code} signal=${signal}`);
    res.write(`data: [DONE]\n\n`);
    res.end();
    if (onComplete) onComplete(fullText);
  });

  proc.on("error", (err) => {
    console.error("[Claude spawn error]", err.message);
    res.write(`data: ${JSON.stringify({ text: `\n[오류] Claude Code CLI를 찾을 수 없습니다. 'claude' 명령어가 PATH에 있는지 확인해주세요.\n오류: ${err.message}` })}\n\n`);
    res.write(`data: [DONE]\n\n`);
    res.end();
  });

  res.socket?.on("close", () => {
    console.log("[SOCKET CLOSE] client disconnected — killing proc");
    if (!proc.killed) proc.kill();
  });
}

// ── Dify 챗 API 스트리밍 프록시 (에이전트 봇) ────────────────────────────────
// Dify 백엔드의 봇을 호출해 응답을 agency-os SSE 형식(data:{text})으로 중계한다.
const DIFY_BASE = process.env.DIFY_BASE || "http://localhost:8088/v1";
// Dify 봇별 API 키 — .env 에서 로드 (코드에 하드코딩 금지)
const DIFY_KEYS = {
  director: process.env.DIFY_KEY_DIRECTOR || "",
  saup:     process.env.DIFY_KEY_SAUP     || "",
  jiwon:    process.env.DIFY_KEY_JIWON    || "",
  service:  process.env.DIFY_KEY_SERVICE  || "",
  cs:       process.env.DIFY_KEY_CS       || "",
  meeting:  process.env.DIFY_KEY_MEETING  || "",
  qa:       process.env.DIFY_KEY_QA       || "",
  research: process.env.DIFY_KEY_RESEARCH || "",
  review:   process.env.DIFY_KEY_REVIEW   || "",
  ppt:      process.env.DIFY_KEY_PPT      || "",
};
// 프로젝트+채널별 Dify conversation_id 유지 → 대화 맥락 보존
// 재시작에도 봇이 맥락을 잊지 않도록 파일로 영속화한다.
const difyConvPath = path.join(DATA_DIR, "dify_conversations.json");
let difyConversations = {};
try { difyConversations = JSON.parse(fs.readFileSync(difyConvPath, "utf8")) || {}; } catch { difyConversations = {}; }
let difyConvSaveTimer = null;
function saveDifyConversations() {
  clearTimeout(difyConvSaveTimer);
  difyConvSaveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(difyConvPath, JSON.stringify(difyConversations));
    } catch (e) { console.error("[difyConv save]", e.message); }
  }, 400);
}

async function runDifyStream({ res, apiKey, query, user, convKey, files, onComplete }) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let fullText = "";
  try {
    const r = await fetch(`${DIFY_BASE}/chat-messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        inputs: {},
        query,
        response_mode: "streaming",
        user: user || "agencyos",
        conversation_id: difyConversations[convKey] || "",
        files: Array.isArray(files) ? files : [],
      }),
    });
    if (!r.ok) throw new Error(`Dify HTTP ${r.status}`);
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data) continue;
        try {
          const o = JSON.parse(data);
          if (o.conversation_id && difyConversations[convKey] !== o.conversation_id) {
            difyConversations[convKey] = o.conversation_id;
            saveDifyConversations();
          }
          if (o.answer) {
            fullText += o.answer;
            res.write(`data: ${JSON.stringify({ text: o.answer })}\n\n`);
          }
        } catch {}
      }
    }
  } catch (e) {
    console.error("[Dify stream error]", e.message);
    res.write(`data: ${JSON.stringify({ text: `\n[Dify 연결 오류: ${e.message}]` })}\n\n`);
  }
  res.write(`data: [DONE]\n\n`);
  res.end();
  if (onComplete) onComplete(fullText);
}

// ── 통합 디렉터 오케스트레이터 ───────────────────────────────────────────────
// 디렉터가 요청을 분석해 전문봇들을 순서대로 호출하고, 각 봇이 보고하게 한다.
const ORCH_BOTS = {
  research: { name: "리서치 봇",      icon: "🔍", key: DIFY_KEYS.research },
  saup:     { name: "사업계획서 봇",   icon: "📑", key: DIFY_KEYS.saup },
  jiwon:    { name: "지원사업 봇",     icon: "🏛️", key: DIFY_KEYS.jiwon },
  service:  { name: "서비스소개서 봇",  icon: "📄", key: DIFY_KEYS.service },
  cs:       { name: "CS 문구 봇",      icon: "💬", key: DIFY_KEYS.cs },
  meeting:  { name: "회의록 봇",       icon: "🗒️", key: DIFY_KEYS.meeting },
  review:   { name: "검토·감수 봇",    icon: "✅", key: DIFY_KEYS.review },
  ppt:      { name: "발표자료 PPT 봇",  icon: "📊", key: DIFY_KEYS.ppt },
  qa:       { name: "사내 Q&A 봇",    icon: "❓", key: DIFY_KEYS.qa },
};

// Dify 봇 1회 호출 — 스트리밍 청크를 onChunk로 흘리고 전체 텍스트 반환
async function callDifyBot(apiKey, query, user, onChunk) {
  let full = "";
  const r = await fetch(`${DIFY_BASE}/chat-messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ inputs: {}, query, response_mode: "streaming", user: user || "orch", conversation_id: "" }),
  });
  if (!r.ok) throw new Error(`Dify HTTP ${r.status}`);
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const d = line.slice(5).trim();
      if (!d) continue;
      try { const o = JSON.parse(d); if (o.answer) { full += o.answer; if (onChunk) onChunk(o.answer); } } catch {}
    }
  }
  return full;
}

async function runOrchestrator({ res, pid, message, attachBlock = "", onComplete }) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  let full = "";
  const write = (t) => { full += t; res.write(`data: ${JSON.stringify({ text: t })}\n\n`); };
  const attachNote = attachBlock ? `\n\n[첨부파일 본문]\n${attachBlock}` : "";

  try {
    write("🎯 **디렉터**가 요청을 분석하고 있습니다...\n\n");
    if (attachBlock) write("📎 첨부파일을 함께 분석합니다.\n\n");
    const planPrompt =
      `너는 업무 오케스트레이터다. 아래 요청을 처리하기 위해 호출할 전문봇을 순서대로 골라라.\n` +
      `사용 가능한 봇 id: research(시장조사·웹검색), saup(사업계획서), jiwon(정부지원사업), service(서비스소개서), cs(고객응대문구), meeting(회의록), review(문서 검토감수), ppt(발표자료).\n` +
      `반드시 JSON 배열로만 답하라. 형식: [{"bot":"research","task":"그 봇에게 시킬 구체 지시(한국어)"}]. 불필요한 봇은 빼고 최대 3개. 설명 금지, JSON만.\n` +
      `요청: ${message}${attachNote}`;
    const planRaw = await callDifyBot(DIFY_KEYS.director, planPrompt, `proj_${pid}`);
    let plan = [];
    try { const m = planRaw.match(/\[[\s\S]*\]/); if (m) plan = JSON.parse(m[0]); } catch {}
    plan = (Array.isArray(plan) ? plan : []).filter((s) => s && ORCH_BOTS[s.bot]).slice(0, 3);

    if (plan.length === 0) {
      write("→ 디렉터가 직접 답변합니다.\n\n---\n\n");
      await callDifyBot(DIFY_KEYS.director, `${message}${attachNote}`, `proj_${pid}`, (c) => write(c));
      res.write(`data: [DONE]\n\n`); res.end(); if (onComplete) onComplete(full); return;
    }

    write("📋 **작업 계획**\n");
    plan.forEach((s, i) => write(`${i + 1}. ${ORCH_BOTS[s.bot].icon} ${ORCH_BOTS[s.bot].name} — ${s.task}\n`));
    write("\n---\n");

    let context = "";
    for (const s of plan) {
      const b = ORCH_BOTS[s.bot];
      write(`\n### ${b.icon} ${b.name} 작업 중...\n\n`);
      let q = s.task + attachNote;
      if (context) q += `\n\n[이전 단계 결과 참고]\n${context.slice(0, 1800)}`;
      const ans = await callDifyBot(b.key, q, `proj_${pid}`, (c) => write(c));
      context += `\n[${b.name}]\n${ans}\n`;
      write(`\n\n✅ **${b.name} 완료**\n\n---\n`);
    }
    write("\n🎯 **모든 작업이 완료되었습니다.**\n");
  } catch (e) {
    console.error("[orchestrator]", e.message);
    write(`\n[오케스트레이터 오류: ${e.message}]`);
  }
  res.write(`data: [DONE]\n\n`);
  res.end();
  if (onComplete) onComplete(full);
}

// ── 메시지 저장 헬퍼 (프로젝트 ID 지원) ──────────────────────────────────────
function persistMessage(channel, messageObj, projectId = "default") {
  const data = loadMessages(projectId);
  if (!data[channel]) data[channel] = [];
  data[channel].push(messageObj);
  if (data[channel].length > 500) {
    data[channel] = data[channel].slice(-500);
  }

  // AI 에이전트 응답은 전체로그(general)에도 미러링
  if (channel !== "general" && messageObj.role === "assistant") {
    if (!data["general"]) data["general"] = [];
    const logEntry = {
      ...messageObj,
      id: `log_${messageObj.id}`,
      logChannel: channel,
    };
    data["general"].push(logEntry);
    if (data["general"].length > 1000) {
      data["general"] = data["general"].slice(-1000);
    }
    broadcastMessage({ type: "new_message", channel: "general", message: logEntry, projectId });
  }

  saveMessages(data, projectId);
  broadcastMessage({ type: "new_message", channel, message: messageObj, projectId });
}

// ════════════════════════════════════════════════════════════════════════════════
// 프로젝트 API
// ════════════════════════════════════════════════════════════════════════════════

// GET /api/projects → 프로젝트 목록
app.get("/api/projects", (req, res) => {
  const projects = loadProjects();
  res.json(projects);
});

// POST /api/projects → 프로젝트 생성
app.post("/api/projects", (req, res) => {
  const { name, color } = req.body;
  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }
  const projects = loadProjects();
  const newProject = {
    id: `proj_${Date.now()}`,
    name,
    color: color || "#6366f1",
    createdAt: new Date().toISOString(),
  };
  projects.push(newProject);
  saveProjects(projects);
  res.status(201).json(newProject);
});

// PATCH /api/projects/:id/archive → 프로젝트 아카이브
app.patch("/api/projects/:id/archive", (req, res) => {
  const { id } = req.params;
  const projects = loadProjects();
  let project = projects.find((p) => p.id === id);
  if (!project) {
    // projects_data.json 에서도 찾아서 projects.json 에 추가
    const projDataList = loadProjData();
    const pd = projDataList.find(p => p.id === id);
    if (!pd) return res.status(404).json({ error: "프로젝트를 찾을 수 없습니다." });
    project = { id: pd.id, name: pd.title, color: "#6366f1", createdAt: new Date().toISOString() };
    projects.push(project);
  }
  project.archived = true;
  project.archivedYear = String(new Date().getFullYear());
  saveProjects(projects);
  broadcastMessage({ type: "data_update", resource: "projects" });
  res.json(project);
});

// PATCH /api/projects/:id/unarchive → 프로젝트 아카이브 해제
app.patch("/api/projects/:id/unarchive", (req, res) => {
  const { id } = req.params;
  const projects = loadProjects();
  let project = projects.find((p) => p.id === id);
  if (!project) {
    const projDataList = loadProjData();
    const pd = projDataList.find(p => p.id === id);
    if (!pd) return res.status(404).json({ error: "프로젝트를 찾을 수 없습니다." });
    project = { id: pd.id, name: pd.title, color: "#6366f1", createdAt: new Date().toISOString() };
    projects.push(project);
  }
  project.archived = false;
  project.archivedYear = null;
  saveProjects(projects);
  broadcastMessage({ type: "data_update", resource: "projects" });
  res.json(project);
});

// PATCH /api/projects/:id → 프로젝트 필드 수정 (archiveFolderId 등)
app.patch("/api/projects/:id", (req, res) => {
  const { id } = req.params;
  const projects = loadProjects();
  const idx = projects.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: "프로젝트를 찾을 수 없습니다." });
  // archive/unarchive 전용 필드(archived, archivedYear)를 제외한 나머지 필드 병합
  const { archived, archivedYear, ...rest } = req.body;
  projects[idx] = { ...projects[idx], ...rest };
  saveProjects(projects);
  broadcastMessage({ type: "data_update", resource: "projects" });
  res.json(projects[idx]);
});

// DELETE /api/projects/:id → 프로젝트 삭제 (default 불가)
app.delete("/api/projects/:id", (req, res) => {
  const { id } = req.params;
  if (id === "default") {
    return res.status(403).json({ error: "기본 워크스페이스는 삭제할 수 없습니다." });
  }
  const projects = loadProjects();
  const idx = projects.findIndex((p) => p.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "프로젝트를 찾을 수 없습니다." });
  }
  projects.splice(idx, 1);
  saveProjects(projects);

  // 해당 프로젝트 파일들 삭제 (optional cleanup)
  [messagesFilePath(id), kanbanFilePath(id)].forEach((fp) => {
    try {
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    } catch (e) {
      console.error(`[DELETE PROJECT] 파일 삭제 실패: ${fp}`, e.message);
    }
  });

  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════════════════════
// 칸반 API
// ════════════════════════════════════════════════════════════════════════════════

// GET /api/projects/:pid/kanban → 칸반 데이터
app.get("/api/projects/:pid/kanban", (req, res) => {
  const { pid } = req.params;
  const kanban = loadKanban(pid);
  res.json(kanban);
});

// POST /api/projects/:pid/kanban/cards → 카드 추가
app.post("/api/projects/:pid/kanban/cards", (req, res) => {
  const { pid } = req.params;
  const { title, desc, agentId, agentName, agentAvatar, column, dept, projectId, dueDate } = req.body;
  if (!title) {
    return res.status(400).json({ error: "title is required" });
  }
  const kanban = loadKanban(pid);
  const newCard = {
    id: `card_${randomUUID()}`,
    title,
    desc: desc || "",
    agentId: agentId || null,
    agentName: agentName || null,
    agentAvatar: agentAvatar || null,
    column: column || "todo",
    dept: dept || null,
    projectId: projectId || null,
    dueDate: dueDate || null,
    createdAt: new Date().toISOString(),
  };
  kanban.cards.push(newCard);
  saveKanban(kanban, pid);
  broadcastMessage({ type: "kanban_update", projectId: pid, action: "add", card: newCard });
  res.status(201).json(newCard);
});

// PATCH /api/projects/:pid/kanban/cards/:cid → 카드 업데이트
app.patch("/api/projects/:pid/kanban/cards/:cid", (req, res) => {
  const { pid, cid } = req.params;
  const { column, title, desc, agentId, agentName, agentAvatar, dept, projectId, dueDate } = req.body;
  const kanban = loadKanban(pid);
  const card = kanban.cards.find((c) => c.id === cid);
  if (!card) {
    return res.status(404).json({ error: "카드를 찾을 수 없습니다." });
  }
  if (column      !== undefined) card.column      = column;
  if (title       !== undefined) card.title       = title;
  if (desc        !== undefined) card.desc        = desc;
  if (agentId     !== undefined) card.agentId     = agentId;
  if (agentName   !== undefined) card.agentName   = agentName;
  if (agentAvatar !== undefined) card.agentAvatar = agentAvatar;
  if (dept        !== undefined) card.dept        = dept;
  if (projectId   !== undefined) card.projectId   = projectId;
  if (dueDate     !== undefined) card.dueDate     = dueDate;
  card.updatedAt = new Date().toISOString();
  saveKanban(kanban, pid);
  broadcastMessage({ type: "kanban_update", projectId: pid, action: "update", card });
  res.json(card);
});

// DELETE /api/projects/:pid/kanban/cards/:cid → 카드 삭제
app.delete("/api/projects/:pid/kanban/cards/:cid", (req, res) => {
  const { pid, cid } = req.params;
  const kanban = loadKanban(pid);
  const idx = kanban.cards.findIndex((c) => c.id === cid);
  if (idx === -1) {
    return res.status(404).json({ error: "카드를 찾을 수 없습니다." });
  }
  const [removed] = kanban.cards.splice(idx, 1);
  saveKanban(kanban, pid);
  broadcastMessage({ type: "kanban_update", projectId: pid, action: "delete", cardId: cid });
  res.json({ ok: true, card: removed });
});

// ════════════════════════════════════════════════════════════════════════════════
// 프로젝트별 채팅 / 메시지 API
// ════════════════════════════════════════════════════════════════════════════════

// 첨부파일 → 질문 주입 / Dify 파일포맷 정리 헬퍼
function buildQueryWithFiles(message, files) {
  if (!Array.isArray(files) || !files.length) return message;
  const parts = files.filter((f) => f && f.text).map((f) => `[첨부파일: ${f.name || "문서"}]\n${f.text}`);
  if (!parts.length) return message;
  return `${parts.join("\n\n")}\n\n----------\n위 첨부파일 내용을 근거로 다음 요청에 답하세요.\n\n${message || "첨부한 파일을 분석해줘."}`;
}
function toDifyFiles(files) {
  if (!Array.isArray(files)) return [];
  return files
    .filter((f) => f && f.upload_file_id)
    .map((f) => ({ type: f.type || "document", transfer_method: f.transfer_method || "local_file", upload_file_id: f.upload_file_id }));
}
// 첨부파일 본문만 모아 블록으로 (오케스트레이터가 전문봇에 전달용)
function attachmentBlock(files) {
  if (!Array.isArray(files)) return "";
  const parts = files.filter((f) => f && f.text).map((f) => `[첨부파일: ${f.name || "문서"}]\n${f.text}`);
  return parts.length ? parts.join("\n\n") : "";
}

// POST /api/projects/:pid/chat → 프로젝트 채팅 (스트리밍)
app.post("/api/projects/:pid/chat", (req, res) => {
  const { pid } = req.params;
  const { message, agentId, agentName, agentTitle, channelName, channel, history = [], msgId, bot, files } = req.body;
  console.log(`[REQ:${pid}] bot=${bot || agentId} / ${message?.slice(0, 30)}${files?.length ? ` (+${files.length}파일)` : ""}`);

  const targetChannel = channel || channelName || bot || "general";
  // 첨부파일 본문을 질문에 주입(모든 봇 공통) + Dify 파일포맷 정리
  let injectedMessage = buildQueryWithFiles(message, files);
  const difyFiles = toDifyFiles(files);
  // 회사 드라이브 지식 자동 참조 (관련 문서 본문을 컨텍스트로 주입)
  const refCtx = [searchDriveForChat(message), searchBoardsForChat(message)].filter(Boolean).join("\n\n");
  if (refCtx) injectedMessage = `[참고용 회사 자료 — 질문과 관련될 때만 근거로 쓰고, 관련 없으면 이 자료를 언급하지 말고 평소대로 답하세요]\n${refCtx}\n----------\n질문: ${injectedMessage}`;

  // 통합 디렉터 (오케스트레이터): 여러 전문봇을 조율
  if (bot === "team" || channel === "team") {
    return runOrchestrator({
      res, pid, message: message || "첨부한 파일을 분석해줘.", attachBlock: attachmentBlock(files),
      onComplete: (full) => {
        if (full.trim()) persistMessage(targetChannel, {
          id: msgId || Date.now().toString(), role: "assistant",
          agentId: "team", agentName: "통합 디렉터",
          content: full.trim(), timestamp: new Date().toISOString(),
        }, pid);
      },
    });
  }

  // Dify 봇으로 라우팅 (bot/channel/agentId 가 키와 일치하면)
  const difyKey = DIFY_KEYS[bot] || DIFY_KEYS[channel] || DIFY_KEYS[agentId];
  if (difyKey) {
    return runDifyStream({
      res,
      apiKey: difyKey,
      query: injectedMessage,
      user: `proj_${pid}`,
      convKey: `${pid}:${targetChannel}`,
      files: difyFiles,
      onComplete: (fullText) => {
        if (fullText.trim()) {
          persistMessage(targetChannel, {
            id: msgId || Date.now().toString(),
            role: "assistant",
            agentId: bot || agentId,
            agentName: agentName || "AI",
            content: fullText.trim(),
            timestamp: new Date().toISOString(),
          }, pid);
        }
      },
    });
  }

  // 폴백: 기존 Claude CLI
  const systemPrompt = AGENT_PROMPTS[agentId] || `너는 ${agentName || "AI"}야. Agency OS의 AI 에이전트로 팀을 지원해. 한국어로 답해.`;
  const historyContext = history.length > 0
    ? "\n\n[이전 대화]\n" + history.map(h => `${h.role === "user" ? "사용자" : agentName}: ${h.content}`).join("\n")
    : "";
  const prompt = historyContext ? `${historyContext}\n사용자: ${injectedMessage}` : injectedMessage;
  runClaudeStream({
    res,
    systemPrompt,
    prompt,
    onComplete: (fullText) => {
      if (fullText.trim()) {
        persistMessage(targetChannel, {
          id: msgId || Date.now().toString(),
          role: "assistant",
          agentId,
          agentName: agentName || "AI",
          content: fullText.trim(),
          timestamp: new Date().toISOString(),
        }, pid);
      }
    },
  });
});

// POST /api/projects/:pid/chat/director → 프로젝트 디렉터 채팅 (스트리밍)
app.post("/api/projects/:pid/chat/director", (req, res) => {
  const { pid } = req.params;
  const { message, channel, history = [], msgId } = req.body;
  console.log(`[DIRECTOR REQ:${pid}] ${message?.slice(0, 30)}`);

  const historyContext = history.length > 0
    ? "\n\n[이전 대화]\n" + history.map(h => `${h.role === "user" ? "사용자" : "디렉터"}: ${h.content}`).join("\n")
    : "";

  const targetChannel = channel || "general";

  // Dify 기획 디렉터 봇으로 연결 (Claude CLI 대신)
  runDifyStream({
    res,
    apiKey: DIFY_KEYS.director,
    query: message,
    user: `proj_${pid}`,
    convKey: `${pid}:${targetChannel}`,
    onComplete: (fullText) => {
      if (fullText.trim()) {
        persistMessage(targetChannel, {
          id: msgId || Date.now().toString(),
          role: "assistant",
          agentId: "director",
          agentName: "디렉터",
          content: fullText.trim(),
          timestamp: new Date().toISOString(),
        }, pid);
      }
    },
  });
});

// GET /api/projects/:pid/messages/:channel → 프로젝트 채널 메시지 조회
app.get("/api/projects/:pid/messages/:channel", (req, res) => {
  const { pid, channel } = req.params;
  const data = loadMessages(pid);
  res.json(data[channel] || []);
});

// POST /api/projects/:pid/messages → 프로젝트 메시지 저장
app.post("/api/projects/:pid/messages", (req, res) => {
  const { pid } = req.params;
  const { channel, message } = req.body;
  if (!channel || !message) {
    return res.status(400).json({ error: "channel and message are required" });
  }
  const messageObj = {
    id: message.id || Date.now().toString(),
    role: message.role || "user",
    agentId: message.agentId || null,
    agentName: message.agentName || null,
    content: message.content,
    timestamp: message.timestamp || new Date().toISOString(),
  };
  persistMessage(channel, messageObj, pid);
  res.json({ ok: true, message: messageObj });
});

// ════════════════════════════════════════════════════════════════════════════════
// 기존 엔드포인트 (하위 호환 — projectId = "default")
// ════════════════════════════════════════════════════════════════════════════════

// POST /api/chat
app.post("/api/chat", (req, res) => {
  const { message, agentId, agentName, agentTitle, channelName, channel, history = [], msgId } = req.body;
  console.log(`[REQ:default] ${agentName} / ${message?.slice(0, 30)}`);

  const systemPrompt = AGENT_PROMPTS[agentId] || `너는 ${agentName || "AI"}야. Agency OS의 AI 에이전트로 팀을 지원해. 한국어로 답해.`;

  const historyContext = history.length > 0
    ? "\n\n[이전 대화]\n" + history.map(h => `${h.role === "user" ? "사용자" : agentName}: ${h.content}`).join("\n")
    : "";

  const prompt = historyContext ? `${historyContext}\n사용자: ${message}` : message;
  const targetChannel = channel || channelName || "general";

  runClaudeStream({
    res,
    systemPrompt,
    prompt,
    onComplete: (fullText) => {
      if (fullText.trim()) {
        persistMessage(targetChannel, {
          id: msgId || Date.now().toString(),
          role: "assistant",
          agentId,
          agentName: agentName || "AI",
          content: fullText.trim(),
          timestamp: new Date().toISOString(),
        }, "default");
      }
    },
  });
});

// POST /api/chat/director
app.post("/api/chat/director", (req, res) => {
  const { message, channel, history = [], msgId } = req.body;
  console.log(`[DIRECTOR REQ:default] ${message?.slice(0, 30)}`);

  const historyContext = history.length > 0
    ? "\n\n[이전 대화]\n" + history.map(h => `${h.role === "user" ? "사용자" : "디렉터"}: ${h.content}`).join("\n")
    : "";

  const prompt = historyContext ? `${historyContext}\n사용자: ${message}` : message;
  const targetChannel = channel || "general";

  runClaudeStream({
    res,
    systemPrompt: DIRECTOR_PROMPT,
    prompt,
    onComplete: (fullText) => {
      if (fullText.trim()) {
        persistMessage(targetChannel, {
          id: msgId || Date.now().toString(),
          role: "assistant",
          agentId: "director",
          agentName: "디렉터",
          content: fullText.trim(),
          timestamp: new Date().toISOString(),
        }, "default");
      }
    },
  });
});

// GET /api/messages/:channel
app.get("/api/messages/:channel", (req, res) => {
  const { channel } = req.params;
  const data = loadMessages("default");
  res.json(data[channel] || []);
});

// POST /api/messages
app.post("/api/messages", (req, res) => {
  const { channel, message } = req.body;
  if (!channel || !message) {
    return res.status(400).json({ error: "channel and message are required" });
  }
  const messageObj = {
    id: message.id || Date.now().toString(),
    role: message.role || "user",
    agentId: message.agentId || null,
    agentName: message.agentName || null,
    content: message.content,
    timestamp: message.timestamp || new Date().toISOString(),
  };
  persistMessage(channel, messageObj, "default");
  res.json({ ok: true, message: messageObj });
});

// ════════════════════════════════════════════════════════════════════════════════
// 파일 업로드 API
// ════════════════════════════════════════════════════════════════════════════════

// POST /api/upload
app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "파일이 없습니다" });
  const url = `/uploads/${req.file.filename}`;
  res.json({
    ok: true,
    url,
    name: req.file.originalname,
    size: req.file.size,
    mime: req.file.mimetype,
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 지식센터 (위키 · 업무매뉴얼) API
// ════════════════════════════════════════════════════════════════════════════════
const WIKI_DIR = path.join(DATA_DIR, "wiki");
function ensureWikiDir() { try { fs.mkdirSync(WIKI_DIR, { recursive: true }); } catch {} }
function wikiPath(id) { return path.join(WIKI_DIR, `${id}.json`); }
function loadWikiDoc(id) {
  try { return JSON.parse(fs.readFileSync(wikiPath(id), "utf8")); } catch { return null; }
}
function saveWikiDoc(doc) {
  ensureWikiDir();
  fs.writeFileSync(wikiPath(doc.id), JSON.stringify(doc, null, 2), "utf8");
  return doc;
}
function listWikiDocs() {
  ensureWikiDir();
  return fs.readdirSync(WIKI_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => { try { return JSON.parse(fs.readFileSync(path.join(WIKI_DIR, f), "utf8")); } catch { return null; } })
    .filter(Boolean)
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}
// 최초 1회 시드 (디렉터리 비었을 때)
function ensureWikiSeed() {
  ensureWikiDir();
  if (fs.readdirSync(WIKI_DIR).filter((f) => f.endsWith(".json")).length > 0) return;
  const now = new Date().toISOString();
  const seeds = [
    {
      id: "welcome", type: "wiki", title: "지식센터 사용법", category: "회사", tags: ["가이드"],
      body: "# 지식센터에 오신 걸 환영합니다\n\n이곳은 **사내위키**와 **업무매뉴얼**이 함께 사는 공간입니다.\n\n## 할 수 있는 것\n- 📖 **위키**: 회사 지식·용어·정책을 자유롭게 정리\n- 📋 **매뉴얼**: 업무 절차를 단계로 정리하고 봇·칸반과 연결\n- 🔗 `[[다른 문서]]` 로 문서끼리 링크\n- 🖼 이미지 드래그&드롭, ▶ 유튜브 링크 붙여넣기\n\n관련 문서: [[사업계획서 작성 매뉴얼]]\n",
      steps: [], links: [], createdAt: now, updatedAt: now, history: [],
    },
    {
      id: "manual-saup", type: "manual", title: "사업계획서 작성 매뉴얼", category: "사업", tags: ["사업계획서", "절차"],
      body: "", links: [],
      steps: [
        { id: "s1", title: "공고문 분석", owner: "", desc: "공고문에서 지원금·마감·자격요건·가점을 추출한다.", checklist: [{ text: "요건 추출", done: false }, { text: "마감 확인", done: false }, { text: "가점 확인", done: false }], refs: [], botId: "saup", done: false },
        { id: "s2", title: "요건 충족 점검", owner: "", desc: "우리 회사가 자격을 충족하는지, 가점 항목을 어떻게 채울지 점검.", checklist: [], refs: [], botId: "jiwon", done: false },
        { id: "s3", title: "목차 구성", owner: "", desc: "심사 배점에 맞춰 목차를 잡는다.", checklist: [], refs: [], botId: "saup", done: false },
        { id: "s4", title: "초안 작성", owner: "", desc: "목차별 초안을 작성한다.", checklist: [], refs: [], botId: "saup", done: false },
        { id: "s5", title: "검토·제출", owner: "", desc: "검토 봇으로 보완 후 제출.", checklist: [], refs: [], botId: "review", done: false },
      ],
      createdAt: now, updatedAt: now, history: [],
    },
  ];
  seeds.forEach(saveWikiDoc);
}
ensureWikiSeed();

// GET /api/wiki — 전체 문서(메타+본문) — 클라 검색/트리용
app.get("/api/wiki", (req, res) => res.json(listWikiDocs()));
// GET /api/wiki/:id
app.get("/api/wiki/:id", (req, res) => {
  const doc = loadWikiDoc(req.params.id);
  if (!doc) return res.status(404).json({ error: "not found" });
  res.json(doc);
});
// POST /api/wiki — 생성
app.post("/api/wiki", (req, res) => {
  const { type = "wiki", title = "제목 없음", category = "미분류", tags = [], body = "", steps = [],
          manualType, routine, form } = req.body || {};
  const now = new Date().toISOString();
  const doc = {
    id: randomUUID().slice(0, 8), type, title, category, tags, body, steps, links: [],
    // 업무매뉴얼 유형: procedure(절차) | routine(반복) | form(양식)
    manualType: type === "manual" ? (manualType || "procedure") : undefined,
    routine: routine || (manualType === "routine" ? { cycle: "daily", resetAt: "09:00", items: [], rotation: [], lastReset: null } : undefined),
    form: form || (manualType === "form" ? { templates: [], goodExample: "", badExample: "" } : undefined),
    createdAt: now, updatedAt: now, history: [],
  };
  saveWikiDoc(doc);
  res.json(doc);
});
// PATCH /api/wiki/:id — 수정 (직전 버전 history 보관)
app.patch("/api/wiki/:id", (req, res) => {
  const doc = loadWikiDoc(req.params.id);
  if (!doc) return res.status(404).json({ error: "not found" });
  const prev = { at: doc.updatedAt, title: doc.title, body: doc.body, steps: doc.steps, routine: doc.routine, form: doc.form };
  const history = [prev, ...(doc.history || [])].slice(0, 20);
  const { title, category, tags, body, steps, type, manualType, routine, form } = req.body || {};
  const next = {
    ...doc,
    title: title ?? doc.title, category: category ?? doc.category, tags: tags ?? doc.tags,
    body: body ?? doc.body, steps: steps ?? doc.steps, type: type ?? doc.type,
    manualType: manualType ?? doc.manualType, routine: routine ?? doc.routine, form: form ?? doc.form,
    updatedAt: new Date().toISOString(), history,
  };
  saveWikiDoc(next);
  res.json(next);
});
// DELETE /api/wiki/:id
app.delete("/api/wiki/:id", (req, res) => {
  try { fs.unlinkSync(wikiPath(req.params.id)); } catch {}
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════════════════════
// 노트 API
// ════════════════════════════════════════════════════════════════════════════════

// GET /api/projects/:pid/notes
app.get("/api/projects/:pid/notes", (req, res) => {
  res.json(loadNotes(req.params.pid));
});

// POST /api/projects/:pid/notes
app.post("/api/projects/:pid/notes", (req, res) => {
  const { content, author, files = [] } = req.body;
  if (!content?.trim() && files.length === 0)
    return res.status(400).json({ error: "내용 또는 파일이 필요합니다" });

  const notes = loadNotes(req.params.pid);
  const note = {
    id: `note_${randomUUID()}`,
    content: content?.trim() || "",
    author: author || "나",
    files,
    createdAt: new Date().toISOString(),
  };
  notes.unshift(note);
  if (notes.length > 200) notes.splice(200);
  saveNotes(notes, req.params.pid);
  broadcastMessage({ type: "new_note", projectId: req.params.pid, note });
  res.status(201).json(note);
});

// DELETE /api/projects/:pid/notes/:nid
app.delete("/api/projects/:pid/notes/:nid", (req, res) => {
  const notes = loadNotes(req.params.pid);
  const idx = notes.findIndex(n => n.id === req.params.nid);
  if (idx === -1) return res.status(404).json({ error: "노트를 찾을 수 없습니다" });
  notes.splice(idx, 1);
  saveNotes(notes, req.params.pid);
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════════════════════
// 기록(Records) API
// ════════════════════════════════════════════════════════════════════════════════

// GET /api/data/projects/:id/records
app.get("/api/data/projects/:id/records", (req, res) => {
  res.json(loadRecords("proj", req.params.id));
});

// POST /api/data/projects/:id/records
app.post("/api/data/projects/:id/records", (req, res) => {
  const { id } = req.params;
  const { template, title, fields, author } = req.body;
  const records = loadRecords("proj", id);
  const record = {
    id: `rec_${randomUUID()}`,
    template: template || "memo",
    title: title || "",
    fields: fields || {},
    author: author || "나",
    createdAt: new Date().toISOString(),
  };
  records.unshift(record);
  if (records.length > 500) records.splice(500);
  saveRecords(records, "proj", id);
  broadcastMessage({ type: "data_update", resource: "records", entityId: id });
  res.status(201).json(record);
});

// DELETE /api/data/projects/:id/records/:rid
app.delete("/api/data/projects/:id/records/:rid", (req, res) => {
  const { id, rid } = req.params;
  const records = loadRecords("proj", id);
  const idx = records.findIndex(r => r.id === rid);
  if (idx === -1) return res.status(404).json({ error: "기록을 찾을 수 없습니다" });
  records.splice(idx, 1);
  saveRecords(records, "proj", id);
  res.json({ ok: true });
});

// PATCH /api/data/projects/:id/records/:rid
app.patch("/api/data/projects/:id/records/:rid", (req, res) => {
  const { id, rid } = req.params;
  const { title, fields } = req.body;
  const records = loadRecords("proj", id);
  const idx = records.findIndex(r => r.id === rid);
  if (idx === -1) return res.status(404).json({ error: "기록을 찾을 수 없습니다" });
  if (title !== undefined) records[idx].title = title;
  if (fields !== undefined) records[idx].fields = fields;
  records[idx].updatedAt = new Date().toISOString();
  saveRecords(records, "proj", id);
  res.json(records[idx]);
});

// GET /api/projects/:pid/kanban/cards/:cid/records
app.get("/api/projects/:pid/kanban/cards/:cid/records", (req, res) => {
  res.json(loadRecords("card", req.params.cid));
});

// POST /api/projects/:pid/kanban/cards/:cid/records
app.post("/api/projects/:pid/kanban/cards/:cid/records", (req, res) => {
  const { pid, cid } = req.params;
  const { template, title, fields, author } = req.body;
  const records = loadRecords("card", cid);
  const record = {
    id: `rec_${randomUUID()}`,
    template: template || "memo",
    title: title || "",
    fields: fields || {},
    author: author || "나",
    createdAt: new Date().toISOString(),
  };
  records.unshift(record);
  if (records.length > 500) records.splice(500);
  saveRecords(records, "card", cid);
  broadcastMessage({ type: "kanban_update", projectId: pid, action: "record_add", cardId: cid });
  res.status(201).json(record);
});

// DELETE /api/projects/:pid/kanban/cards/:cid/records/:rid
app.delete("/api/projects/:pid/kanban/cards/:cid/records/:rid", (req, res) => {
  const { cid, rid } = req.params;
  const records = loadRecords("card", cid);
  const idx = records.findIndex(r => r.id === rid);
  if (idx === -1) return res.status(404).json({ error: "기록을 찾을 수 없습니다" });
  records.splice(idx, 1);
  saveRecords(records, "card", cid);
  res.json({ ok: true });
});

// PATCH /api/projects/:pid/kanban/cards/:cid/records/:rid
app.patch("/api/projects/:pid/kanban/cards/:cid/records/:rid", (req, res) => {
  const { cid, rid } = req.params;
  const { title, fields } = req.body;
  const records = loadRecords("card", cid);
  const idx = records.findIndex(r => r.id === rid);
  if (idx === -1) return res.status(404).json({ error: "기록을 찾을 수 없습니다" });
  if (title !== undefined) records[idx].title = title;
  if (fields !== undefined) records[idx].fields = fields;
  records[idx].updatedAt = new Date().toISOString();
  saveRecords(records, "card", cid);
  res.json(records[idx]);
});

// ── 담당자별 투두리스트 (칸반 하단 패널) ──────────────────────────────────────
function todosPath() { return path.join(DATA_DIR, "todos.json"); }
function loadTodos() { ensureDataDir(); try { return JSON.parse(fs.readFileSync(todosPath(), "utf8")); } catch { return []; } }
function saveTodos(t) { ensureDataDir(); fs.writeFileSync(todosPath(), JSON.stringify(t, null, 2), "utf8"); }

app.get("/api/todos", (req, res) => res.json(loadTodos()));

app.post("/api/todos", (req, res) => {
  const { humanId, text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: "text required" });
  const todos = loadTodos();
  const item = { id: `td_${randomUUID()}`, humanId: humanId || "unassigned", text: text.trim(), done: false, createdAt: new Date().toISOString() };
  todos.push(item);
  saveTodos(todos);
  res.status(201).json(item);
});

app.patch("/api/todos/:id", (req, res) => {
  const todos = loadTodos();
  const item = todos.find((t) => t.id === req.params.id);
  if (!item) return res.status(404).json({ error: "not found" });
  if (req.body.done !== undefined) item.done = !!req.body.done;
  if (req.body.text !== undefined) item.text = String(req.body.text);
  if (req.body.humanId !== undefined) item.humanId = req.body.humanId;
  saveTodos(todos);
  res.json(item);
});

app.delete("/api/todos/:id", (req, res) => {
  saveTodos(loadTodos().filter((t) => t.id !== req.params.id));
  res.json({ ok: true });
});

// ── 첨부파일 텍스트 추출 ─────────────────────────────────────────────────────
// Dify 앱별 문서 처리 동작이 일관되지 않아(일부 봇은 첨부파일 텍스트를 못 읽음),
// 백엔드에서 직접 텍스트를 추출해 질문에 주입한다. → 모든 봇에서 동일하게 동작.
const MAX_EXTRACT_CHARS = 16000;
async function extractFileText(buffer, filename = "", mimetype = "") {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  const mt = (mimetype || "").toLowerCase();
  try {
    // 플레인 텍스트 계열
    if (
      mt.startsWith("text/") ||
      ["txt", "md", "markdown", "csv", "tsv", "json", "log", "xml", "yaml", "yml", "html", "htm"].includes(ext)
    ) {
      return clip(buffer.toString("utf8"));
    }
    // PDF
    if (ext === "pdf" || mt === "application/pdf") {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      const r = await parser.getText();
      return clip((r.text || "").replace(/\n--\s*\d+ of \d+\s*--\n?/g, "\n"));
    }
    // DOCX
    if (ext === "docx" || mt.includes("officedocument.wordprocessingml")) {
      const mammoth = (await import("mammoth")).default;
      const r = await mammoth.extractRawText({ buffer });
      return clip(r.value || "");
    }
    // PPTX (슬라이드 텍스트)
    if (ext === "pptx" || mt.includes("presentationml")) {
      const AdmZip = (await import("adm-zip")).default;
      const zip = new AdmZip(buffer);
      let out = "";
      zip.getEntries()
        .filter((e) => /ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
        .sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true }))
        .forEach((e) => {
          const xml = e.getData().toString("utf8");
          const m = xml.match(/<a:t>([^<]*)<\/a:t>/g) || [];
          out += m.map((x) => x.replace(/<[^>]+>/g, "")).join(" ") + "\n";
        });
      return clip(out);
    }
    // XLSX / XLS (시트 → CSV)
    if (["xlsx", "xls"].includes(ext) || mt.includes("spreadsheetml") || mt.includes("ms-excel")) {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(buffer, { type: "buffer" });
      let out = "";
      wb.SheetNames.forEach((n) => { out += `# ${n}\n` + XLSX.utils.sheet_to_csv(wb.Sheets[n]) + "\n"; });
      return clip(out);
    }
    // HWPX (한글 신형식, XML zip)
    if (ext === "hwpx") {
      const AdmZip = (await import("adm-zip")).default;
      const zip = new AdmZip(buffer);
      let out = "";
      zip.getEntries()
        .filter((e) => /Contents\/section\d+\.xml$/i.test(e.entryName))
        .forEach((e) => { out += e.getData().toString("utf8").replace(/<[^>]+>/g, " ") + "\n"; });
      return clip(out.replace(/\s+/g, " "));
    }
    // HWP (한글 바이너리 — PrvText 미리보기 텍스트 사용)
    if (ext === "hwp") {
      const XLSX = await import("xlsx");
      const cfb = XLSX.CFB.read(buffer, { type: "buffer" });
      const i = cfb.FullPaths.findIndex((p) => /PrvText$/i.test(p));
      if (i >= 0) return clip(Buffer.from(cfb.FileIndex[i].content).toString("utf16le").replace(/\0/g, "").trim());
      return "";
    }
  } catch (e) {
    console.error("[extractFileText]", filename, e.message);
  }
  return ""; // 미지원(.doc/.ppt 구형, 이미지 등) → 빈 문자열 (위치/Dify 폴백)
}
function clip(s) {
  s = (s || "").trim();
  return s.length > MAX_EXTRACT_CHARS ? s.slice(0, MAX_EXTRACT_CHARS) + "\n…(이하 생략, 내용이 길어 일부만 표시)" : s;
}

// ── Dify 파일 업로드 프록시 (채팅 첨부) ───────────────────────────────────────
const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
app.post("/api/dify-upload", memUpload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "no file" });
  const bot = req.body.bot || "director";
  const apiKey = DIFY_KEYS[bot] || DIFY_KEYS.director;
  const user = `proj_${req.body.pid || "default"}`;
  const isImage = (req.file.mimetype || "").startsWith("image/");
  // multer/busboy가 파일명을 latin1로 디코딩 → 한글 깨짐. utf8로 복원.
  let originalName = req.file.originalname;
  try { originalName = Buffer.from(req.file.originalname, "latin1").toString("utf8"); } catch {}

  // 1) 백엔드 텍스트 추출 (모든 봇에서 동일하게 동작하도록 질문에 주입할 텍스트)
  const text = isImage ? "" : await extractFileText(req.file.buffer, originalName, req.file.mimetype);

  // 2) Dify 파일 업로드 (이미지 비전 / 추출 실패 시 폴백). 베스트-에포트.
  let upload_file_id = null;
  try {
    const form = new FormData();
    form.append("file", new Blob([req.file.buffer], { type: req.file.mimetype || "application/octet-stream" }), originalName);
    form.append("user", user);
    const r = await fetch(`${DIFY_BASE}/files/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    const j = await r.json();
    if (r.ok) upload_file_id = j.id;
    else console.error("[dify-upload]", r.status, JSON.stringify(j).slice(0, 200));
  } catch (e) {
    console.error("[dify-upload]", e.message);
  }

  // 텍스트도 못 뽑고 Dify 업로드도 실패하면 에러
  if (!upload_file_id && !text) {
    return res.status(502).json({ error: "파일을 처리하지 못했습니다(텍스트 추출·업로드 모두 실패)." });
  }

  res.json({
    id: upload_file_id,
    name: originalName,
    type: isImage ? "image" : "document",
    transfer_method: "local_file",
    upload_file_id,
    text,                       // 추출된 본문(질문에 주입)
    textLen: text.length,
    extracted: text.length > 0, // 텍스트 추출 성공 여부
  });
});

// ── 회사 드라이브 지식 색인 (구글드라이브 동기화 폴더) — 키워드 검색 ────────────────
// 문서: 본문 추출 색인 / 이미지·영상: 파일명·폴더 위치 색인. 임베딩·외부호출 없음(무료).
// 색인 소스(여러 곳 가능): 구글드라이브 + S드라이브 등
const DRIVE_SOURCES = [
  { label: "구글드라이브", root: process.env.DRIVE_KNOWLEDGE_DIR || "G:\\내 드라이브\\콘텐츠잇다" },
  { label: "S드라이브", root: "S:\\콘텐츠잇다 주요 파일" },
];
const DRIVE_SKIP_DIRS = new Set(["$RECYCLE.BIN", "System Volume Information", "Recovery", ".Encrypted", ".shortcut-targets-by-id"]);
// 민감문서 제외(블랙리스트) — 폴더/파일 이름에 아래 단어가 들어가면 색인 제외. .env DRIVE_EXCLUDE 로 수정 가능
const DRIVE_EXCLUDE = (process.env.DRIVE_EXCLUDE ||
  "비번,비밀번호,패스워드,password,passwd,계약서,급여,급여명세,급여대장,연봉,인건비,인사기록,개인정보,주민등록,주민번호,신분증,여권,계좌,통장,카드번호,대외비,기밀,보안서약,이력서,근로계약")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
function driveExcluded(name) { const n = (name || "").toLowerCase(); return DRIVE_EXCLUDE.some((p) => n.includes(p)); }
// 민감정보 마스킹 — 정상 이름 문서 안에 든 비번·주민번호·카드·계좌를 가림
function maskSensitive(text) {
  if (!text) return text;
  let s = text;
  s = s.replace(/(비밀번호|비번|패스워드|password|passwd|pwd|pw)\s*[:：=]\s*\S+/gi, "$1: [비밀번호 가림]");
  s = s.replace(/\b\d{6}[-\s]?[1-4]\d{6}\b/g, "[주민번호 가림]");
  s = s.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, "[카드번호 가림]");
  s = s.replace(/(계좌|통장)\s*(번호)?\s*[:：]?\s*\d[\d-]{6,}/g, "$1$2: [계좌번호 가림]");
  return s;
}
const DRIVE_INDEX_PATH = path.join(DATA_DIR, "drive_index.json");
const DRIVE_DOC_EXT = new Set(["pdf", "docx", "txt", "md", "csv", "pptx", "xlsx", "xls", "hwp", "hwpx"]); // 본문 추출
const DRIVE_IMG = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "heic", "bmp", "tif", "tiff"]);
const DRIVE_VID = new Set(["mp4", "mov", "avi", "mkv", "webm", "wmv", "m4v"]);
const DRIVE_META_EXT = new Set(["doc", "ppt", ...DRIVE_IMG, ...DRIVE_VID]); // 구형 바이너리·미디어 = 위치만
let driveIndex = [];
let driveMini = null;
let driveStatus = { state: "idle", scanned: 0, withText: 0, total: 0, startedAt: null, finishedAt: null, sources: DRIVE_SOURCES.map((s) => s.root) };

function driveTypeOf(ext) { if (DRIVE_IMG.has(ext)) return "image"; if (DRIVE_VID.has(ext)) return "video"; return "doc"; }
function buildDriveMini() {
  driveMini = new MiniSearch({ fields: ["name", "folder", "text"], storeFields: ["name", "folder", "path", "type", "mtime"], searchOptions: { boost: { name: 3, folder: 1.5 }, prefix: true, fuzzy: 0.2 } });
  driveMini.addAll(driveIndex);
}
function loadDriveIndex() {
  try { driveIndex = JSON.parse(fs.readFileSync(DRIVE_INDEX_PATH, "utf8")); buildDriveMini(); driveStatus.total = driveIndex.length; driveStatus.state = "done"; console.log(`[drive] 색인 로드: ${driveIndex.length}건`); }
  catch { driveIndex = []; }
}
// 윈도우 긴경로(>260자) 지원 + 스트리밍 폴더 읽기 3회 재시도
const longPath = (p) => (process.platform === "win32" && !p.startsWith("\\\\?\\") ? "\\\\?\\" + path.resolve(p) : p);
async function readdirSafe(dir) {
  for (let i = 0; i < 3; i++) {
    try { return await fs.promises.readdir(longPath(dir), { withFileTypes: true }); }
    catch { if (i === 2) { driveStatus.failedDirs = (driveStatus.failedDirs || 0) + 1; return []; } await new Promise((r) => setTimeout(r, 250 * (i + 1))); }
  }
  return [];
}
async function reindexDrive({ limit = 0, subdir = "" } = {}) {
  if (driveStatus.state === "running") return driveStatus;
  const sources = subdir
    ? [{ label: DRIVE_SOURCES[0].label, root: path.join(DRIVE_SOURCES[0].root, subdir), base: DRIVE_SOURCES[0].root }]
    : DRIVE_SOURCES.map((s) => ({ label: s.label, root: s.root, base: s.root }));
  driveStatus = { state: "running", scanned: 0, withText: 0, excluded: 0, failedDirs: 0, total: 0, startedAt: new Date().toISOString(), finishedAt: null, sources: sources.map((s) => s.root) };
  const idx = [];
  let id = 0;
  const walk = async (dir, src) => {
    if (limit && idx.length >= limit) return;
    const entries = await readdirSafe(dir);
    for (const e of entries) {
      if (limit && idx.length >= limit) return;
      if (e.name.startsWith(".") || DRIVE_SKIP_DIRS.has(e.name)) continue;
      if (driveExcluded(e.name)) { driveStatus.excluded = (driveStatus.excluded || 0) + 1; continue; } // 민감문서 제외(블랙리스트)
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { await walk(full, src); continue; }
      const ext = (e.name.split(".").pop() || "").toLowerCase();
      if (!DRIVE_DOC_EXT.has(ext) && !DRIVE_META_EXT.has(ext)) continue;
      let stat; try { stat = await fs.promises.stat(longPath(full)); } catch { continue; }
      const rel = path.relative(src.base, dir);
      const rec = { id: id++, path: full, name: e.name, folder: `${src.label}${rel ? "/" + rel : ""}`, source: src.label, type: driveTypeOf(ext), mtime: stat.mtime.toISOString(), size: stat.size, text: "" };
      if (DRIVE_DOC_EXT.has(ext) && stat.size < 50 * 1024 * 1024) {
        try { const buf = await fs.promises.readFile(longPath(full)); rec.text = maskSensitive(await extractFileText(buf, e.name, "")); if (rec.text) driveStatus.withText++; } catch {}
      }
      idx.push(rec);
      driveStatus.scanned = idx.length;
      // 중간 저장 + 부분 색인 반영(긴 작업 견고화 / 진행 중에도 검색 가능)
      if (idx.length % 100 === 0) {
        driveIndex = idx.slice();
        try { fs.writeFileSync(DRIVE_INDEX_PATH, JSON.stringify(idx)); } catch {}
        try { buildDriveMini(); } catch {}
      }
    }
  };
  try { for (const src of sources) await walk(src.root, src); } catch (e) { console.error("[drive] walk err", e.message); }
  driveIndex = idx;
  try { fs.writeFileSync(DRIVE_INDEX_PATH, JSON.stringify(idx)); } catch (e) { console.error("[drive] save err", e.message); }
  buildDriveMini();
  driveStatus.state = "done"; driveStatus.total = idx.length; driveStatus.finishedAt = new Date().toISOString();
  console.log(`[drive] 색인 완료: ${idx.length}건 (본문추출 ${driveStatus.withText})`);
  return driveStatus;
}
// 채팅 시 질문과 관련된 회사 문서 본문을 찾아 컨텍스트로 반환(상위 2건)
function searchDriveForChat(query) {
  if (!driveMini || !query || query.trim().length < 6) return "";
  // 여러 단어 질문은 최소 2개 단어가 일치할 때만(오탐 줄이기)
  const qWords = query.trim().split(/\s+/).filter((w) => w.length >= 2).length;
  const minTerms = qWords >= 2 ? 2 : 1;
  let hits; try { hits = driveMini.search(query); } catch { return ""; }
  const top = hits[0]?.score || 0;
  const docHits = hits
    .filter((h) => (h.terms || []).length >= minTerms && h.score >= top * 0.55)
    .filter((h) => { const d = driveIndex[h.id]; return d && d.type === "doc" && d.text; })
    .slice(0, 2);
  if (!docHits.length) return "";
  let ctx = "";
  for (const h of docHits) { const d = driveIndex[h.id]; ctx += `\n[회사문서: ${d.name}${d.folder ? ` (${d.folder})` : ""}]\n${maskSensitive((d.text || "").slice(0, 2500))}\n`; }
  return ctx.trim();
}
loadDriveIndex();

app.post("/api/drive/reindex", (req, res) => {
  if (driveStatus.state === "running") return res.json({ ok: false, status: driveStatus });
  const { limit = 0, subdir = "" } = req.body || {};
  reindexDrive({ limit: +limit || 0, subdir });          // 비동기 — 기다리지 않음
  res.json({ ok: true, started: true, sources: DRIVE_SOURCES.map((s) => s.root) });
});
app.get("/api/drive/status", (req, res) => res.json(driveStatus));
app.get("/api/drive/search", (req, res) => {
  const q = (req.query.q || "").trim(); const limit = +(req.query.limit || 10);
  if (!driveMini || !q) return res.json([]);
  let hits; try { hits = driveMini.search(q); } catch { hits = []; }
  res.json(hits.slice(0, limit).map((h) => { const d = driveIndex[h.id] || {}; return { id: h.id, name: d.name, folder: d.folder, path: d.path, type: d.type, mtime: d.mtime, hasText: !!d.text, snippet: maskSensitive((d.text || "").slice(0, 160)) }; }));
});
// 드라이브 문서 전체 본문 (근거 탭에서 클릭 시 주입용)
app.get("/api/drive/doc", (req, res) => {
  const d = driveIndex.find((x) => String(x.id) === String(req.query.id) || x.path === req.query.path);
  if (!d) return res.status(404).json({ error: "not found" });
  res.json({ name: d.name, folder: d.folder, type: d.type, text: maskSensitive(d.text || "") });
});

// ════════════════════════════════════════════════════════════════════════════════
// 사내 게시판 API
// ════════════════════════════════════════════════════════════════════════════════
const boardsPath = () => path.join(DATA_DIR, "boards.json");
const bPostsPath = () => path.join(DATA_DIR, "board_posts.json");
const bCommentsPath = () => path.join(DATA_DIR, "board_comments.json");
const bNotisPath = () => path.join(DATA_DIR, "board_notis.json");
function loadJSON(p, def) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return def; } }
function saveJSON(p, d) { ensureDataDir(); fs.writeFileSync(p, JSON.stringify(d, null, 2), "utf8"); }
const DEFAULT_BOARDS = [
  // 소통
  { id: "notice", name: "공지사항", icon: "📢", color: "#ef4444", group: "소통", type: "post", writePerm: "admin", mustRead: true },
  { id: "free", name: "자유게시판", icon: "💬", color: "#6366f1", group: "소통", type: "post", writePerm: "all" },
  { id: "suggest", name: "건의·제안", icon: "💡", color: "#f59e0b", group: "소통", type: "post", writePerm: "all", anonymous: true },
  { id: "praise", name: "칭찬·감사", icon: "👏", color: "#ec4899", group: "소통", type: "post", writePerm: "all" },
  { id: "lunch", name: "맛집·점심", icon: "🍜", color: "#f97316", group: "소통", type: "post", writePerm: "all" },
  { id: "event", name: "경조사", icon: "🎉", color: "#a855f7", group: "소통", type: "post", writePerm: "all" },
  // 업무
  { id: "request", name: "업무요청", icon: "🙋", color: "#10b981", group: "업무", type: "request", writePerm: "all" },
  { id: "fixreq", name: "장비 수리신고", icon: "🔧", color: "#64748b", group: "업무", type: "request", writePerm: "all" },
  { id: "booking", name: "장비·스튜디오 예약", icon: "📷", color: "#3b82f6", group: "업무", type: "post", writePerm: "all" },
  { id: "grant", name: "지원사업·공모전 공고", icon: "🏛️", color: "#0ea5e9", group: "업무", type: "post", writePerm: "all" },
  { id: "edu", name: "교육·세미나", icon: "🎓", color: "#8b5cf6", group: "업무", type: "post", writePerm: "all" },
  // 자료
  { id: "resource", name: "자료공유", icon: "📁", color: "#0ea5e9", group: "자료", type: "post", writePerm: "all" },
  { id: "links", name: "링크 바로가기", icon: "🔗", color: "#06b6d4", group: "자료", type: "post", writePerm: "all" },
  { id: "price", name: "견적·단가표", icon: "💰", color: "#eab308", group: "자료", type: "post", writePerm: "all" },
  { id: "portfolio", name: "포트폴리오", icon: "🎞️", color: "#f43f5e", group: "자료", type: "post", writePerm: "all" },
  { id: "client", name: "거래처 정보", icon: "🤝", color: "#14b8a6", group: "자료", type: "post", writePerm: "all" },
  // 보안
  { id: "vault", name: "공유 계정", icon: "🔑", color: "#dc2626", group: "보안", type: "post", writePerm: "all", secret: true },
];
// 게시판별 말머리(글 분류)
const BOARD_FLAIRS = {
  notice: ["설문", "이슈", "AD"], free: ["잡담", "질문", "후기", "정보"], suggest: ["건의", "불만", "아이디어"],
  praise: ["칭찬", "감사"], lunch: ["맛집", "점심모집"], event: ["경사", "조사"],
  request: ["편집", "디자인", "촬영", "기타"], fixreq: ["조명", "카메라", "음향", "공간"], booking: ["호리존", "크리에이팅룸", "카메라"],
  grant: ["공고", "마감임박", "결과"], edu: ["강의", "세미나", "자격증"], resource: ["양식", "레퍼런스", "체크리스트"],
  links: ["업무", "마케팅", "행정"], price: ["영상", "디자인"], portfolio: ["영상", "디자인", "행사"],
  client: ["거래처", "협력사"], vault: ["SNS", "구독서비스", "기타"],
};
function ensureBoards() {
  const def = (b, i) => ({ color: "#6366f1", group: "기타", type: "post", writePerm: "all", anonymous: false, mustRead: false, secret: false, hidden: false, flairs: BOARD_FLAIRS[b.id] || [], ...b, order: i + 1 });
  let boards = loadJSON(boardsPath(), null);
  if (!boards) { saveJSON(boardsPath(), DEFAULT_BOARDS.map(def)); return; }
  const ids = new Set(boards.map((b) => b.id));
  let changed = false;
  DEFAULT_BOARDS.forEach((b, i) => { if (!ids.has(b.id)) { boards.push(def(b, boards.length)); changed = true; } });
  boards.forEach((b) => { if ((!b.flairs || !b.flairs.length) && BOARD_FLAIRS[b.id]) { b.flairs = BOARD_FLAIRS[b.id]; changed = true; } }); // 말머리 마이그레이션
  if (changed) saveJSON(boardsPath(), boards);
}
ensureBoards();
// 게시판별 사용안내 글 (비어있는 게시판에만 1회 시드)
const BOARD_GUIDES = {
  notice: "# 📢 공지사항 사용안내\n회사 공식 알림을 올리는 곳입니다. **관리자만** 글을 쓸 수 있고, 중요한 글은 📌고정됩니다.\n\n- 모든 직원이 봐야 하는 내용 → **필독확인** 으로 누가 읽었는지 체크됩니다.\n- 예: 워크샵 일정, 사내 규정 변경, 휴무 안내",
  free: "# 💬 자유게시판 사용안내\n아무 얘기나 편하게! 잡담·소식·질문 환영합니다.\n\n- 예: \"오늘 날씨 좋네요\", \"이거 아시는 분?\", 소소한 일상 공유",
  suggest: "# 💡 건의·제안 사용안내\n회사를 더 좋게 만들 아이디어·불편사항을 올려주세요. **익명**으로 쓸 수 있습니다.\n\n- 예: \"휴게실에 정수기 있으면 좋겠어요\", \"회의가 너무 길어요\"",
  praise: "# 👏 칭찬·감사 사용안내\n동료에게 고마운 일, 잘한 일을 남겨주세요. 서로 칭찬하면 분위기가 좋아집니다.\n\n- 예: \"@민호 님 덕분에 마감 무사히! 감사합니다 🙏\"",
  lunch: "# 🍜 맛집·점심 사용안내\n회사 근처 맛집 공유, 점심 같이 먹을 사람 모집!\n\n- 예: \"회성동 국밥집 추천\", \"오늘 1시 같이 가실 분?\"",
  event: "# 🎉 경조사 사용안내\n결혼·출산·부고 등 경조사를 알리는 곳입니다.\n\n- 예: \"OO님 결혼식 안내\", \"부친상 알림\"",
  request: "# 🙋 업무요청 사용안내\n다른 사람/팀에게 일을 요청하는 곳입니다. **담당·마감·상태(요청→진행→완료)** 로 추적됩니다.\n\n- 글을 쓰면 [목록/칸반] 으로 볼 수 있고, **칸반 카드로 전환** 가능\n- 예: \"세영테크 CF 편집 요청 (마감 6/8)\"",
  fixreq: "# 🔧 장비 수리신고 사용안내\n고장난 장비·시설을 신고하는 곳입니다. 상태(요청→진행→완료)로 처리됩니다.\n\n- 예: \"호리존 조명 1개 깜빡임\", \"3번 카메라 배터리 안 됨\"",
  booking: "# 📷 장비·스튜디오 예약 사용안내\n호리존·크리에이팅룸·카메라 등 **예약·사용 현황**을 공유합니다.\n\n- 예: \"6/10 오후 호리존 촬영 예약\", \"SONY 카메라 2번 외부반출\"",
  grant: "# 🏛️ 지원사업·공모전 공고 사용안내\n지원사업·공모전 **공고와 마감일**을 모아둡니다. (지원사업 봇과 연계)\n\n- 예: \"2026 청년창업 지원사업 (마감 7/14)\" + 공고문 첨부",
  edu: "# 🎓 교육·세미나 사용안내\n유용한 교육·웨비나·세미나 정보를 공유합니다.\n\n- 예: \"영상 색보정 무료 강의\", \"마케팅 세미나 6/20\"",
  resource: "# 📁 자료공유 사용안내\n업무에 쓰는 양식·자료·레퍼런스를 공유합니다. **드라이브 첨부**·파일 첨부 활용.\n\n- 예: \"제안서 최신 양식\", \"촬영 체크리스트\"",
  links: "# 🔗 링크 바로가기 사용안내\n자주 쓰는 사이트 링크를 모아둡니다. URL을 붙이면 **미리보기 카드**로 보입니다.\n\n- 예: 기업마당, 인스타 관리, 유튜브 스튜디오, 세금계산서 사이트",
  price: "# 💰 견적·단가표 사용안내\n표준 견적·단가를 정리합니다. 제안서 쓸 때 참고용.\n\n- 예: \"영상 제작 단가표\", \"드론 촬영 단가\"",
  portfolio: "# 🎞️ 포트폴리오 사용안내\n완성한 작업물(영상·디자인)을 모아둡니다. 실적 증빙·제안서에 재활용.\n\n- 예: \"성산구청 홍보영상\" + 유튜브 임베드",
  client: "# 🤝 거래처 정보 사용안내\n거래처·협력사 연락처·과거 작업·특이사항을 정리합니다.\n\n- 예: \"(주)오니트 - 담당 OOO, 과거 5건 진행\"",
  vault: "# 🔑 공유 계정 사용안내\n⚠️ **회사 공용 계정(인스타·유튜브 등) ID/비번을 공유하는 곳입니다.**\n\n- 🔒 이 게시판은 **봇 검색·통합검색에서 제외**됩니다 (외부 노출 방지)\n- 내부 직원만 보세요. 개인 계정·민감 정보는 올리지 마세요.\n- 예: \"회사 인스타: ID xxx / PW xxx\"",
};
function ensureBoardGuides() {
  const posts = loadJSON(bPostsPath(), []);
  const boards = loadJSON(boardsPath(), []);
  let changed = false;
  boards.forEach((b) => {
    if (posts.some((p) => p.boardId === b.id && (p.authorId === "system" || (p.tags || []).includes("안내")))) return; // 이미 안내글 있으면 스킵
    const guide = BOARD_GUIDES[b.id];
    if (!guide) return;
    const no = Math.max(0, ...posts.filter((p) => p.boardId === b.id).map((p) => p.no || 0)) + 1;
    posts.push({ id: randomUUID().slice(0, 8), no, boardId: b.id, title: "📌 " + (guide.split("\n")[0].replace(/^#+\s*/, "")), body: guide, authorId: "system", authorName: "운영", authorAvatar: "🛠️", anonymous: false, pinned: true, tags: ["안내"], attachments: [], driveRefs: [], wikiRefs: [], views: 0, likes: [], readBy: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    changed = true;
  });
  if (changed) saveJSON(bPostsPath(), posts);
}
ensureBoardGuides();
// 게시판별 예시 게시물 (안내글 외에 실제 예시 1개 — 비어 보이지 않게)
const BOARD_EXAMPLES = {
  notice: { title: "6월 상반기 워크샵 안내 (참석 필수)", author: "김용현", avatar: "🧑", tags: ["워크샵"], body: "안녕하세요, 콘텐츠잇다입니다.\n\n## 일정\n- **일시**: 6/20(금) 오후 2시\n- **장소**: 호리존 스튜디오 (3층)\n- **내용**: 상반기 성과 공유 + 하반기 방향 + 저녁 회식\n\n전원 참석입니다. 아래 **필독확인** 눌러주세요 🙏" },
  free: { title: "오늘 날씨 너무 좋네요 ☀️", author: "송예린", avatar: "🧑‍💼", tags: [], body: "점심에 잠깐 산책이라도 하고 싶은 날씨네요.\n다들 좋은 하루 보내세요!" },
  suggest: { title: "휴게실에 커피머신 있으면 좋겠어요 ☕", author: "익명", avatar: "🙈", tags: ["복지"], body: "편집 작업이 길어질 때 카페인이 절실합니다 ㅎㅎ\n캡슐 머신 정도면 부담 없을 것 같은데, 검토 부탁드려요." },
  praise: { title: "김호근 팀장님 감사합니다 🙏", author: "윤서아", avatar: "🧑‍🎨", tags: [], body: "어제 제안서 마감 직전에 디자인 같이 봐주셔서 무사히 제출했어요.\n덕분에 살았습니다. 정말 감사합니다!" },
  lunch: { title: "회성동 순대국밥 강력추천 🍜", author: "박도현", avatar: "🧑", tags: ["맛집"], body: "회사에서 도보 5분, 양 많고 깊은 맛입니다.\n오늘 **1시 로비 집합**, 같이 가실 분 댓글 주세요!" },
  event: { title: "신예지 대리님 결혼 소식 💐", author: "김용현", avatar: "🧑", tags: ["경사"], body: "신예지 대리님이 7월에 결혼합니다.\n\n- **일시**: 7/12(토) 오후\n- **장소**: 창원 OO웨딩홀\n\n많은 축하 부탁드립니다 🎉" },
  request: { title: "세영테크 CF 1차 편집 요청 (마감 6/8)", author: "한지수", avatar: "🧑‍💼", status: "요청", body: "세영테크 무선드라이기 CF 촬영본 드라이브에 업로드했습니다.\n\n- **요청**: 1차 가편\n- **담당**: 오민준 PD\n- **마감**: 6/8\n\n레퍼런스는 댓글에 남길게요." },
  fixreq: { title: "호리존 키라이트 깜빡임 🔧", author: "오민준", avatar: "🧑", status: "요청", body: "호리존 왼쪽 **키라이트 조명**이 가끔 깜빡입니다.\n촬영 중 끊기면 곤란해서 점검 요청드립니다. (6/10 촬영 전까지)" },
  booking: { title: "6/10 오후 호리존 촬영 예약 📷", author: "오민준", avatar: "🧑", tags: ["예약"], body: "KACES 홍보영상 촬영으로 호리존 사용합니다.\n\n- **날짜**: 6/10(화)\n- **시간**: 13:00 ~ 18:00\n- **장비**: SONY HXR-NX100 2대, 조명 풀세트" },
  grant: { title: "2026 청년창업 지원사업 공고 (마감 7/14)", author: "한지수", avatar: "🧑‍💼", tags: ["지원사업"], body: "기업마당에 신규 공고가 떴습니다.\n\n- **지원금**: 최대 7,000만원 (자부담 20%)\n- **마감**: 7/14 18시\n- **대상**: 만 39세 이하 대표\n\n우리 해당 여부 검토 필요. 공고문은 지원사업 봇에 첨부해서 분석 돌려보겠습니다." },
  edu: { title: "프리미어 색보정 무료 강의 추천 🎓", author: "오민준", avatar: "🧑", tags: ["교육"], body: "유튜브에 색보정 기초~중급 강의가 잘 정리돼 있어요.\n편집팀 신규 분들 보면 도움 될 것 같아 공유합니다." },
  resource: { title: "제안서 최신 양식 v3 공유 📁", author: "김호근", avatar: "🧑", tags: ["양식"], body: "정성/정량 제안서 최신 양식입니다.\n이번 분기부터 이걸로 통일해주세요. (드라이브 첨부)\n변경점: 회사소개·실적 페이지 디자인 업데이트." },
  links: { title: "자주 쓰는 사이트 모음 🔗", author: "송예린", avatar: "🧑‍💼", tags: ["링크"], body: "북마크처럼 모아둡니다.\n\n- 기업마당 (지원사업)\n- 인스타 크리에이터 스튜디오\n- 유튜브 스튜디오\n- 홈택스 (세금계산서)\n- 네이버 광고관리" },
  price: { title: "영상 제작 표준 단가표 💰", author: "김호근", avatar: "🧑", tags: ["단가"], body: "제안서 작성 시 참고용 기준 단가입니다.\n\n| 항목 | 기준 단가 |\n|---|---|\n| 기획·구성 | 50만원~ |\n| 촬영(1일) | 80만원~ |\n| 편집(2~3분) | 100만원~ |\n| 드론 | 50만원~ |\n\n※ 실제는 규모·기간 따라 조정" },
  portfolio: { title: "성산구청 숏폼 홍보영상 🎞️", author: "오민준", avatar: "🧑", tags: ["포트폴리오"], body: "지난달 납품한 성산구 숏폼입니다. 조회수·반응 좋았습니다.\n제안서 실적 페이지에 활용하면 좋을 것 같아요.\n\n(영상 링크/임베드는 편집 눌러서 추가)" },
  client: { title: "(주)오니트 거래처 정보 🤝", author: "한지수", avatar: "🧑‍💼", tags: ["거래처"], body: "- **담당**: OOO 부장\n- **과거 작업**: 제로플페스타, 패션쇼 스케치 등 5건\n- **특이사항**: 결제 빠름, 현장 요청 많은 편\n- **연락**: (사내 연락처 참고)" },
  vault: { title: "회사 공식 인스타 계정 🔑", author: "송예린", avatar: "🧑‍💼", tags: ["계정"], body: "⚠️ 내부 전용 — 외부 공유 금지\n\n- **계정**: @contentitda_official\n- **ID**: contentitda_official\n- **PW**: (여기에 직접 입력 — 이 게시판은 봇/검색에서 제외됩니다)\n\n게시 전 팀장 컨펌 부탁드립니다." },
};
function ensureBoardExamples() {
  const posts = loadJSON(bPostsPath(), []);
  let changed = false;
  Object.entries(BOARD_EXAMPLES).forEach(([bid, ex]) => {
    if (posts.some((p) => p.boardId === bid && (p.tags || []).includes("예시"))) return; // 이미 예시 있으면 스킵
    const no = Math.max(0, ...posts.filter((p) => p.boardId === bid).map((p) => p.no || 0)) + 1;
    posts.push({ id: randomUUID().slice(0, 8), no, boardId: bid, title: ex.title, body: ex.body, authorId: "sample", authorName: ex.author, authorAvatar: ex.avatar, anonymous: ex.author === "익명", pinned: false, tags: [...(ex.tags || []), "예시"], attachments: [], driveRefs: [], wikiRefs: [], views: 0, likes: [], readBy: [], status: ex.status || "요청", assignees: [], dueDate: "", priority: "normal", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    changed = true;
  });
  if (changed) saveJSON(bPostsPath(), posts);
}
ensureBoardExamples();
// 기존 글에 말머리 배정 (안내=공지, 그 외=게시판 첫 말머리)
function ensurePostFlairs() {
  const posts = loadJSON(bPostsPath(), []);
  const bf = Object.fromEntries(loadJSON(boardsPath(), []).map((b) => [b.id, b.flairs || []]));
  let changed = false;
  posts.forEach((p) => {
    if (p.flair !== undefined && p.flair !== null && p.flair !== "") return;
    p.flair = (p.tags || []).includes("안내") ? "공지" : ((bf[p.boardId] || [])[0] || "");
    changed = true;
  });
  if (changed) saveJSON(bPostsPath(), posts);
}
ensurePostFlairs();
function addNoti({ userId, type, postId, boardId, fromName, text }) {
  if (!userId) return;
  const notis = loadJSON(bNotisPath(), []);
  notis.unshift({ id: randomUUID().slice(0, 8), userId, type, postId, boardId, fromName, text, read: false, createdAt: new Date().toISOString() });
  saveJSON(bNotisPath(), notis.slice(0, 500));
}

// ── 게시판 CRUD ──
app.get("/api/boards", (req, res) => res.json(loadJSON(boardsPath(), []).sort((a, b) => (a.order || 0) - (b.order || 0))));
// 실시간 전체글 (디씨 메인 피드 — 모든 게시판 최근글, 금고 제외)
app.get("/api/posts/recent", (req, res) => {
  const limit = +(req.query.limit || 30);
  const boards = loadJSON(boardsPath(), []);
  const secret = new Set(boards.filter((b) => b.secret).map((b) => b.id));
  const bm = Object.fromEntries(boards.map((b) => [b.id, b]));
  const comments = loadJSON(bCommentsPath(), []);
  const cc = {}; comments.forEach((c) => { cc[c.postId] = (cc[c.postId] || 0) + 1; });
  const posts = loadJSON(bPostsPath(), []).filter((p) => !secret.has(p.boardId))
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, limit)
    .map((p) => ({ id: p.id, boardId: p.boardId, boardName: bm[p.boardId]?.name, boardIcon: bm[p.boardId]?.icon, title: p.title, author: p.authorName, avatar: p.authorAvatar, date: p.createdAt, views: p.views || 0, likes: (p.likes || []).length, comments: cc[p.id] || 0, hasThumb: (p.attachments || []).some((f) => f.mime?.startsWith("image/")), thumb: (p.attachments || []).find((f) => f.mime?.startsWith("image/"))?.url }));
  res.json(posts);
});
// 홈 카드용 요약 (게시판 + 글 수 + 최근 글)
app.get("/api/boards/summary", (req, res) => {
  const boards = loadJSON(boardsPath(), []).filter((b) => !b.hidden).sort((a, b) => (a.order || 0) - (b.order || 0));
  const posts = loadJSON(bPostsPath(), []);
  res.json(boards.map((b) => {
    const bp = posts.filter((p) => p.boardId === b.id).sort((a, b2) => (b2.createdAt || "").localeCompare(a.createdAt || ""));
    const latest = bp.find((p) => !p.pinned) || bp[0] || null;
    return { ...b, count: bp.length, latest: latest ? { title: latest.title, date: latest.createdAt, author: latest.authorName } : null };
  }));
});
app.post("/api/boards", (req, res) => {
  const boards = loadJSON(boardsPath(), []);
  const { name, icon = "📋", color = "#6366f1", group = "기타", type = "post", writePerm = "all", anonymous = false, mustRead = false } = req.body || {};
  if (!name) return res.status(400).json({ error: "name required" });
  const b = { id: randomUUID().slice(0, 8), name, icon, color, group, type, writePerm, anonymous, mustRead, order: boards.length + 1, hidden: false };
  boards.push(b); saveJSON(boardsPath(), boards); res.json(b);
});
app.patch("/api/boards/:id", (req, res) => {
  const boards = loadJSON(boardsPath(), []);
  const b = boards.find((x) => x.id === req.params.id);
  if (!b) return res.status(404).json({ error: "not found" });
  Object.assign(b, req.body || {}); saveJSON(boardsPath(), boards); res.json(b);
});
app.delete("/api/boards/:id", (req, res) => {
  saveJSON(boardsPath(), loadJSON(boardsPath(), []).filter((b) => b.id !== req.params.id));
  res.json({ ok: true });
});

// ── 글 목록 (페이지네이션 + 검색) ──
app.get("/api/boards/:bid/posts", (req, res) => {
  const { page = 1, size = 20, q = "", filter = "전체", flair = "" } = req.query;
  let posts = loadJSON(bPostsPath(), []).filter((p) => p.boardId === req.params.bid);
  if (q.trim()) { const s = q.trim().toLowerCase(); posts = posts.filter((p) => (`${p.title} ${p.body} ${p.authorName}`).toLowerCase().includes(s)); }
  if (flair && flair !== "전체") posts = posts.filter((p) => p.flair === flair);
  posts.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const cc = {}; loadJSON(bCommentsPath(), []).forEach((c) => { cc[c.postId] = (cc[c.postId] || 0) + 1; });
  const strip = (p) => ({ ...p, body: undefined, commentCount: cc[p.id] || 0 });
  const pg = Math.max(1, +page), sz = +size;
  const paged = (list) => ({ pinned: [], posts: list.slice((pg - 1) * sz, pg * sz).map(strip), total: list.length, page: pg, size: sz, pages: Math.ceil(list.length / sz) });
  if (filter === "공지") return res.json(paged(posts.filter((p) => p.pinned)));
  if (filter === "개념") return res.json(paged(posts.filter((p) => (p.likes || []).length >= 3)));
  const pinned = posts.filter((p) => p.pinned), rest = posts.filter((p) => !p.pinned);
  res.json({ ...paged(rest), pinned: pinned.map(strip) });
});

// ── 글 작성 ──
app.post("/api/boards/:bid/posts", (req, res) => {
  const posts = loadJSON(bPostsPath(), []);
  const boards = loadJSON(boardsPath(), []);
  const board = boards.find((b) => b.id === req.params.bid);
  const { title, body = "", flair = "", authorId, authorName = "익명", authorAvatar = "🧑", anonymous = false, tags = [], attachments = [], driveRefs = [], wikiRefs = [], mentions = [], status = "요청", assignees = [], dueDate = "", priority = "normal" } = req.body || {};
  if (!title) return res.status(400).json({ error: "title required" });
  const no = Math.max(0, ...posts.filter((p) => p.boardId === req.params.bid).map((p) => p.no || 0)) + 1;
  const now = new Date().toISOString();
  const post = { id: randomUUID().slice(0, 8), no, boardId: req.params.bid, title, body, flair, authorId, authorName: anonymous ? "익명" : authorName, authorAvatar: anonymous ? "🙈" : authorAvatar, anonymous, pinned: false, tags, attachments, driveRefs, wikiRefs, views: 0, likes: [], readBy: [], status, assignees, dueDate, priority, createdAt: now, updatedAt: now };
  posts.unshift(post); saveJSON(bPostsPath(), posts);
  // @멘션 알림
  (mentions || []).forEach((uid) => addNoti({ userId: uid, type: "mention", postId: post.id, boardId: post.boardId, fromName: authorName, text: `${board?.name || ""} "${title}"에서 회원님을 멘션` }));
  res.json(post);
});

// ── 글 상세 (조회수++) ──
app.get("/api/posts/:pid", (req, res) => {
  const posts = loadJSON(bPostsPath(), []);
  const post = posts.find((p) => p.id === req.params.pid);
  if (!post) return res.status(404).json({ error: "not found" });
  post.views = (post.views || 0) + 1; saveJSON(bPostsPath(), posts);
  res.json(post);
});
app.patch("/api/posts/:pid", (req, res) => {
  const posts = loadJSON(bPostsPath(), []);
  const post = posts.find((p) => p.id === req.params.pid);
  if (!post) return res.status(404).json({ error: "not found" });
  const { title, body, tags, pinned, attachments, driveRefs, wikiRefs, status, assignees, dueDate, priority } = req.body || {};
  Object.assign(post, { ...(title !== undefined && { title }), ...(body !== undefined && { body }), ...(tags !== undefined && { tags }), ...(pinned !== undefined && { pinned }), ...(attachments !== undefined && { attachments }), ...(driveRefs !== undefined && { driveRefs }), ...(wikiRefs !== undefined && { wikiRefs }), ...(status !== undefined && { status }), ...(assignees !== undefined && { assignees }), ...(dueDate !== undefined && { dueDate }), ...(priority !== undefined && { priority }), updatedAt: new Date().toISOString() });
  saveJSON(bPostsPath(), posts); res.json(post);
});
app.delete("/api/posts/:pid", (req, res) => {
  saveJSON(bPostsPath(), loadJSON(bPostsPath(), []).filter((p) => p.id !== req.params.pid));
  saveJSON(bCommentsPath(), loadJSON(bCommentsPath(), []).filter((c) => c.postId !== req.params.pid));
  res.json({ ok: true });
});
// 좋아요 토글
app.post("/api/posts/:pid/like", (req, res) => {
  const posts = loadJSON(bPostsPath(), []); const post = posts.find((p) => p.id === req.params.pid);
  if (!post) return res.status(404).json({ error: "not found" });
  const uid = req.body?.userId || "anon";
  post.likes = post.likes || [];
  post.likes = post.likes.includes(uid) ? post.likes.filter((x) => x !== uid) : [...post.likes, uid];
  saveJSON(bPostsPath(), posts); res.json({ likes: post.likes.length, liked: post.likes.includes(uid) });
});
// 필독 확인
app.post("/api/posts/:pid/read", (req, res) => {
  const posts = loadJSON(bPostsPath(), []); const post = posts.find((p) => p.id === req.params.pid);
  if (!post) return res.status(404).json({ error: "not found" });
  const uid = req.body?.userId; post.readBy = post.readBy || [];
  if (uid && !post.readBy.includes(uid)) post.readBy.push(uid);
  saveJSON(bPostsPath(), posts); res.json({ readBy: post.readBy });
});

// ── 댓글 ──
app.get("/api/posts/:pid/comments", (req, res) => res.json(loadJSON(bCommentsPath(), []).filter((c) => c.postId === req.params.pid).sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""))));
app.post("/api/posts/:pid/comments", (req, res) => {
  const comments = loadJSON(bCommentsPath(), []);
  const posts = loadJSON(bPostsPath(), []); const post = posts.find((p) => p.id === req.params.pid);
  const { body, authorId, authorName = "익명", authorAvatar = "🧑", parentId = null, mentions = [] } = req.body || {};
  if (!body) return res.status(400).json({ error: "body required" });
  const c = { id: randomUUID().slice(0, 8), postId: req.params.pid, parentId, body, authorId, authorName, authorAvatar, likes: [], createdAt: new Date().toISOString() };
  comments.push(c); saveJSON(bCommentsPath(), comments);
  // 글쓴이에게 알림 (본인 제외)
  if (post && post.authorId && post.authorId !== authorId) addNoti({ userId: post.authorId, type: "comment", postId: post.id, boardId: post.boardId, fromName: authorName, text: `"${post.title}"에 댓글: ${body.slice(0, 30)}` });
  (mentions || []).forEach((uid) => uid !== authorId && addNoti({ userId: uid, type: "mention", postId: req.params.pid, boardId: post?.boardId, fromName: authorName, text: `댓글에서 회원님을 멘션: ${body.slice(0, 30)}` }));
  res.json(c);
});
app.delete("/api/comments/:cid", (req, res) => {
  saveJSON(bCommentsPath(), loadJSON(bCommentsPath(), []).filter((c) => c.id !== req.params.cid));
  res.json({ ok: true });
});

// ── 알림 ──
app.get("/api/notifications/:userId", (req, res) => res.json(loadJSON(bNotisPath(), []).filter((n) => n.userId === req.params.userId).slice(0, 50)));
app.post("/api/notifications/:userId/read", (req, res) => {
  const notis = loadJSON(bNotisPath(), []);
  notis.forEach((n) => { if (n.userId === req.params.userId) n.read = true; });
  saveJSON(bNotisPath(), notis); res.json({ ok: true });
});

// ── 링크 미리보기 (OG 태그) ──
app.get("/api/link-preview", async (req, res) => {
  const url = req.query.url;
  if (!url || !/^https?:\/\//.test(url)) return res.status(400).json({ error: "invalid url" });
  if (/localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\./.test(url)) return res.status(400).json({ error: "blocked" });
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0 AgencyOS-LinkPreview" } });
    clearTimeout(t);
    const html = (await r.text()).slice(0, 200000);
    const meta = (prop) => { const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i")) || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i")); return m ? m[1] : ""; };
    const title = meta("og:title") || (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || "").trim();
    res.json({ url, title: title.slice(0, 120), description: (meta("og:description") || meta("description")).slice(0, 200), image: meta("og:image"), site: meta("og:site_name") });
  } catch (e) { res.json({ url, title: url, description: "", image: "", site: "" }); }
});

// ── 봇 연동: 게시판 글 검색 → 채팅 컨텍스트 (금고/secret 게시판 제외) ──
function searchBoardsForChat(query) {
  if (!query || query.trim().length < 4) return "";
  const boards = loadJSON(boardsPath(), []);
  const secret = new Set(boards.filter((b) => b.secret).map((b) => b.id));
  const bn = Object.fromEntries(boards.map((b) => [b.id, b.name]));
  const terms = query.toLowerCase().split(/\s+/).filter((w) => w.length >= 2);
  if (!terms.length) return "";
  const scored = loadJSON(bPostsPath(), []).filter((p) => !secret.has(p.boardId))
    .map((p) => ({ p, score: terms.filter((t) => (`${p.title} ${p.body}`).toLowerCase().includes(t)).length }))
    .filter((x) => x.score >= Math.min(2, terms.length)).sort((a, b) => b.score - a.score).slice(0, 2);
  if (!scored.length) return "";
  return scored.map(({ p }) => `\n[게시판:${bn[p.boardId] || ""}] ${p.title}\n${maskSensitive((p.body || "").slice(0, 1500))}`).join("\n").trim();
}
// 위키 간단 검색 (data/wiki 직접 읽기, 구조 바뀌어도 안전)
function searchWikiSimple(ql) {
  try {
    const dir = path.join(DATA_DIR, "wiki");
    return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch { return null; } }).filter(Boolean)
      .filter((d) => (`${d.title || ""} ${d.body || ""}`).toLowerCase().includes(ql)).slice(0, 8)
      .map((d) => ({ id: d.id, title: d.title, type: d.type || "wiki", snippet: (d.body || "").replace(/[#*`>\[\]!()]/g, "").slice(0, 80) }));
  } catch { return []; }
}
// ── 통합검색: 게시판 + 위키 + 드라이브 ──
app.get("/api/search/all", (req, res) => {
  const q = (req.query.q || "").trim(); if (!q) return res.json({ boards: [], wiki: [], drive: [] });
  const ql = q.toLowerCase();
  const boards = loadJSON(boardsPath(), []);
  const secret = new Set(boards.filter((b) => b.secret).map((b) => b.id));
  const bm = Object.fromEntries(boards.map((b) => [b.id, b]));
  const bResults = loadJSON(bPostsPath(), []).filter((p) => !secret.has(p.boardId)).filter((p) => (`${p.title} ${p.body} ${p.authorName}`).toLowerCase().includes(ql)).slice(0, 8)
    .map((p) => ({ id: p.id, boardId: p.boardId, boardName: bm[p.boardId]?.name, boardIcon: bm[p.boardId]?.icon, title: p.title, snippet: (p.body || "").replace(/[#*`>\[\]]/g, "").slice(0, 80), author: p.authorName, date: p.createdAt }));
  let drive = [];
  try { if (driveMini) drive = driveMini.search(q).slice(0, 6).map((h) => { const d = driveIndex[h.id] || {}; return { name: d.name, folder: d.folder, type: d.type, hasText: !!d.text }; }); } catch {}
  res.json({ boards: bResults, wiki: searchWikiSimple(ql), drive });
});

// ── SSE 브로드캐스트 스트림 ───────────────────────────────────────────────────
app.get("/api/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // 연결 확인 이벤트
  res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

  sseClients.add(res);
  console.log(`[SSE] client connected (total: ${sseClients.size})`);

  // 30초마다 keepalive ping
  const pingInterval = setInterval(() => {
    try {
      res.write(`: ping\n\n`);
    } catch {
      clearInterval(pingInterval);
      sseClients.delete(res);
    }
  }, 30000);

  req.on("close", () => {
    clearInterval(pingInterval);
    sseClients.delete(res);
    console.log(`[SSE] client disconnected (total: ${sseClients.size})`);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 프로젝트 데이터 API (/api/data/projects)
// ════════════════════════════════════════════════════════════════════════════════

// GET /api/data/projects
app.get("/api/data/projects", (req, res) => {
  res.json(loadProjData());
});

// POST /api/data/projects
app.post("/api/data/projects", (req, res) => {
  const { title, dept, desc, due, status } = req.body;
  if (!title) return res.status(400).json({ error: "title is required" });
  const projects = loadProjData();
  const newProject = {
    id: randomUUID(),
    title,
    dept: dept || "general",
    status: status || "planning",
    members: Array.isArray(req.body.members) ? req.body.members : [],
    progress: 0,
    desc: desc || "",
    due: due || "",
    tasks: [],
  };
  projects.push(newProject);
  saveProjData(projects);
  broadcastMessage({ type: "data_update", resource: "projects" });
  res.status(201).json(newProject);
});

// PATCH /api/data/projects/:id
app.patch("/api/data/projects/:id", (req, res) => {
  const { id } = req.params;
  const { title, status, progress, due, desc, dept, startDate, members } = req.body;
  const projects = loadProjData();
  const project = projects.find((p) => p.id === id);
  if (!project) return res.status(404).json({ error: "프로젝트를 찾을 수 없습니다." });
  if (title     !== undefined) project.title     = title;
  if (status    !== undefined) project.status    = status;
  if (progress  !== undefined) project.progress  = progress;
  if (due       !== undefined) project.due       = due;
  if (desc      !== undefined) project.desc      = desc;
  if (dept      !== undefined) project.dept      = dept;
  if (startDate !== undefined) project.startDate = startDate;
  if (members   !== undefined) project.members   = Array.isArray(members) ? members : [];
  saveProjData(projects);
  broadcastMessage({ type: "data_update", resource: "projects" });
  res.json(project);
});

// DELETE /api/data/projects/:id
app.delete("/api/data/projects/:id", (req, res) => {
  const { id } = req.params;
  const projects = loadProjData();
  const idx = projects.findIndex((p) => p.id === id);
  if (idx === -1) return res.status(404).json({ error: "프로젝트를 찾을 수 없습니다." });
  const [removed] = projects.splice(idx, 1);
  saveProjData(projects);
  broadcastMessage({ type: "data_update", resource: "projects" });
  res.json({ ok: true, project: removed });
});

// POST /api/data/projects/:id/tasks
app.post("/api/data/projects/:id/tasks", (req, res) => {
  const { id } = req.params;
  const { t, a, s, due, startDate, dueDate } = req.body;
  if (!t) return res.status(400).json({ error: "t (task name) is required" });
  const projects = loadProjData();
  const project = projects.find((p) => p.id === id);
  if (!project) return res.status(404).json({ error: "프로젝트를 찾을 수 없습니다." });
  const newTask = {
    id: randomUUID(),
    t,
    a: a || "",
    s: s || "todo",
    due: due || "",
    startDate: startDate || "",
    dueDate: dueDate || "",
  };
  project.tasks.push(newTask);
  project.progress = recalcProgress(project);
  saveProjData(projects);
  broadcastMessage({ type: "data_update", resource: "projects" });
  res.status(201).json(newTask);
});

// PATCH /api/data/projects/:id/tasks/:tid
app.patch("/api/data/projects/:id/tasks/:tid", (req, res) => {
  const { id, tid } = req.params;
  const { t, a, s, due, startDate, dueDate } = req.body;
  const projects = loadProjData();
  const project = projects.find((p) => p.id === id);
  if (!project) return res.status(404).json({ error: "프로젝트를 찾을 수 없습니다." });
  const task = project.tasks.find((tk) => tk.id === tid);
  if (!task) return res.status(404).json({ error: "태스크를 찾을 수 없습니다." });
  if (t         !== undefined) task.t         = t;
  if (a         !== undefined) task.a         = a;
  if (s         !== undefined) task.s         = s;
  if (due       !== undefined) task.due       = due;
  if (startDate !== undefined) task.startDate = startDate;
  if (dueDate   !== undefined) task.dueDate   = dueDate;
  project.progress = recalcProgress(project);
  saveProjData(projects);
  broadcastMessage({ type: "data_update", resource: "projects" });
  res.json(task);
});

// DELETE /api/data/projects/:id/tasks/:tid
app.delete("/api/data/projects/:id/tasks/:tid", (req, res) => {
  const { id, tid } = req.params;
  const projects = loadProjData();
  const project = projects.find((p) => p.id === id);
  if (!project) return res.status(404).json({ error: "프로젝트를 찾을 수 없습니다." });
  const idx = project.tasks.findIndex((tk) => tk.id === tid);
  if (idx === -1) return res.status(404).json({ error: "태스크를 찾을 수 없습니다." });
  const [removed] = project.tasks.splice(idx, 1);
  project.progress = recalcProgress(project);
  saveProjData(projects);
  broadcastMessage({ type: "data_update", resource: "projects" });
  res.json({ ok: true, task: removed });
});

// POST /api/data/projects/:id/tasks/:tid/subtasks
app.post("/api/data/projects/:id/tasks/:tid/subtasks", (req, res) => {
  const { id, tid } = req.params;
  const { t, a, s, dueDate, desc } = req.body;
  if (!t) return res.status(400).json({ error: "t is required" });
  const projects = loadProjData();
  const project = projects.find(p => p.id === id);
  if (!project) return res.status(404).json({ error: "프로젝트를 찾을 수 없습니다." });
  const task = project.tasks.find(tk => tk.id === tid);
  if (!task) return res.status(404).json({ error: "태스크를 찾을 수 없습니다." });
  if (!task.subtasks) task.subtasks = [];
  const sub = {
    id: `sub_${randomUUID()}`,
    t, a: a || "", s: s || "todo",
    dueDate: dueDate || "",
    desc: desc || "",
    createdAt: new Date().toISOString(),
  };
  task.subtasks.push(sub);
  saveProjData(projects);
  broadcastMessage({ type: "data_update", resource: "projects" });
  res.status(201).json(sub);
});

// PATCH /api/data/projects/:id/tasks/:tid/subtasks/:sid
app.patch("/api/data/projects/:id/tasks/:tid/subtasks/:sid", (req, res) => {
  const { id, tid, sid } = req.params;
  const projects = loadProjData();
  const project = projects.find(p => p.id === id);
  if (!project) return res.status(404).json({ error: "프로젝트를 찾을 수 없습니다." });
  const task = project.tasks.find(tk => tk.id === tid);
  if (!task) return res.status(404).json({ error: "태스크를 찾을 수 없습니다." });
  const sidx = (task.subtasks || []).findIndex(s => s.id === sid);
  if (sidx === -1) return res.status(404).json({ error: "서브태스크를 찾을 수 없습니다." });
  const { t, a, s, dueDate, desc } = req.body;
  if (t       !== undefined) task.subtasks[sidx].t       = t;
  if (a       !== undefined) task.subtasks[sidx].a       = a;
  if (s       !== undefined) task.subtasks[sidx].s       = s;
  if (dueDate !== undefined) task.subtasks[sidx].dueDate = dueDate;
  if (desc    !== undefined) task.subtasks[sidx].desc    = desc;
  task.subtasks[sidx].updatedAt = new Date().toISOString();
  saveProjData(projects);
  broadcastMessage({ type: "data_update", resource: "projects" });
  res.json(task.subtasks[sidx]);
});

// DELETE /api/data/projects/:id/tasks/:tid/subtasks/:sid
app.delete("/api/data/projects/:id/tasks/:tid/subtasks/:sid", (req, res) => {
  const { id, tid, sid } = req.params;
  const projects = loadProjData();
  const project = projects.find(p => p.id === id);
  if (!project) return res.status(404).json({ error: "프로젝트를 찾을 수 없습니다." });
  const task = project.tasks.find(tk => tk.id === tid);
  if (!task) return res.status(404).json({ error: "태스크를 찾을 수 없습니다." });
  const before = (task.subtasks || []).length;
  task.subtasks = (task.subtasks || []).filter(s => s.id !== sid);
  if (task.subtasks.length === before) return res.status(404).json({ error: "서브태스크를 찾을 수 없습니다." });
  saveProjData(projects);
  broadcastMessage({ type: "data_update", resource: "projects" });
  res.json({ ok: true });
});

// ── 재귀 노드 트리 ────────────────────────────────────────────────────────────
const INITIAL_NODES = {
  p1: [
    { id:"nn1", title:"시장조사", assignee:"h3", status:"done", dueDate:"2026-06-15", desc:"", attachments:[], children:[
      { id:"nn1_1", title:"경쟁사 SNS 분석", assignee:"h3", status:"done", dueDate:"2026-06-05", desc:"주요 경쟁 브랜드 인스타·유튜브 분석", attachments:[], children:[] },
      { id:"nn1_2", title:"타겟 오디언스 조사", assignee:"h3", status:"done", dueDate:"2026-06-10", desc:"2030 소상공인 SNS 이용 패턴 조사", attachments:[], children:[] },
      { id:"nn1_3", title:"키워드 트렌드 분석", assignee:"h2", status:"done", dueDate:"2026-06-15", desc:"인스타그램 해시태그·검색어 트렌드", attachments:[], children:[] },
    ]},
    { id:"nn2", title:"전략수립", assignee:"h1", status:"done", dueDate:"2026-06-30", desc:"", attachments:[
      { id:"att_nn2_1", type:"file", name:"SNS전략보고서_v1.pdf", url:"", size:"2.4MB", desc:"" },
      { id:"att_nn2_2", type:"link", name:"", url:"https://notion.so/strategy", size:"", desc:"전략 노션 문서" },
    ], children:[
      { id:"nn2_1", title:"포지셔닝 전략 수립", assignee:"h1", status:"done", dueDate:"2026-06-20", desc:"소상공인 공감 스토리텔링 방향 설정", attachments:[], children:[] },
      { id:"nn2_2", title:"콘텐츠 방향 정의", assignee:"h1", status:"done", dueDate:"2026-06-25", desc:"피드·릴스·스토리 유형별 전략", attachments:[], children:[] },
      { id:"nn2_3", title:"KPI 및 일정 확정", assignee:"h6", status:"done", dueDate:"2026-06-30", desc:"팔로워 증가율·도달률 목표 수치", attachments:[], children:[] },
    ]},
    { id:"nn3", title:"카피작성", assignee:"h2", status:"active", dueDate:"2026-07-15", desc:"", attachments:[], children:[
      { id:"nn3_1", title:"메인 슬로건 3종", assignee:"h2", status:"active", dueDate:"2026-07-05", desc:"브랜드 핵심 메시지 반영한 슬로건", attachments:[
        { id:"att_nn3_1", type:"link", name:"", url:"https://figma.com/slogan-draft", size:"", desc:"슬로건 초안 피그마" },
      ], children:[
        { id:"nn3_1_1", title:"브랜드 키워드 20선", assignee:"h2", status:"done", dueDate:"2026-06-28", desc:"", attachments:[{ id:"att_k1", type:"file", name:"키워드리스트.xlsx", url:"", size:"145KB", desc:"" }], children:[] },
        { id:"nn3_1_2", title:"슬로건 후보 선정", assignee:"h1", status:"active", dueDate:"2026-07-03", desc:"3종 최종 선정 후 클라이언트 컨펌", attachments:[], children:[] },
      ]},
      { id:"nn3_2", title:"인스타그램 캡션 8종", assignee:"h2", status:"active", dueDate:"2026-07-10", desc:"게시물별 CTA 포함 캡션", attachments:[], children:[] },
      { id:"nn3_3", title:"해시태그 풀 구성", assignee:"h2", status:"todo", dueDate:"2026-07-13", desc:"대·중·소 카테고리별 해시태그 40개", attachments:[], children:[] },
      { id:"nn3_4", title:"CTA 문구 3종", assignee:"h2", status:"todo", dueDate:"2026-07-15", desc:"클릭 유도·DM 유도·저장 유도용", attachments:[], children:[] },
    ]},
    { id:"nn4", title:"디자인", assignee:"h4", status:"todo", dueDate:"2026-07-25", desc:"", attachments:[], children:[
      { id:"nn4_1", title:"피드 이미지 10종", assignee:"h4", status:"todo", dueDate:"2026-07-18", desc:"정사각형 1080×1080", attachments:[], children:[] },
      { id:"nn4_2", title:"스토리 템플릿 5종", assignee:"h4", status:"todo", dueDate:"2026-07-22", desc:"수직형 1080×1920", attachments:[], children:[] },
      { id:"nn4_3", title:"릴스 썸네일 4종", assignee:"h4", status:"todo", dueDate:"2026-07-25", desc:"릴스용 커버 이미지", attachments:[], children:[] },
    ]},
    { id:"nn5", title:"광고집행", assignee:"h2", status:"todo", dueDate:"2026-08-10", desc:"", attachments:[], children:[
      { id:"nn5_1", title:"광고 소재 업로드", assignee:"h2", status:"todo", dueDate:"2026-08-01", desc:"메타 광고 관리자 세팅", attachments:[], children:[] },
      { id:"nn5_2", title:"타겟 오디언스 세팅", assignee:"h1", status:"todo", dueDate:"2026-08-03", desc:"경남 지역·소상공인 관심사 타겟", attachments:[], children:[] },
      { id:"nn5_3", title:"예산 배분 및 입찰 전략", assignee:"h6", status:"todo", dueDate:"2026-08-05", desc:"일일 예산·캠페인 목표 설정", attachments:[], children:[] },
    ]},
  ],
  p2: [
    { id:"mm1", title:"주제리서치", assignee:"h3", status:"done", dueDate:"2026-06-20", desc:"", attachments:[], children:[
      { id:"mm1_1", title:"유사 채널 벤치마킹", assignee:"h3", status:"done", dueDate:"2026-06-15", desc:"마케팅 에이전시 유튜브 채널 분석", attachments:[], children:[] },
      { id:"mm1_2", title:"시청자 페르소나 설정", assignee:"h3", status:"done", dueDate:"2026-06-20", desc:"예비 창업자·SMB 사장님 페르소나", attachments:[{ id:"att_p1", type:"file", name:"페르소나_v1.pdf", url:"", size:"890KB", desc:"" }], children:[] },
    ]},
    { id:"mm2", title:"스크립트", assignee:"h3", status:"active", dueDate:"2026-07-10", desc:"", attachments:[], children:[
      { id:"mm2_1", title:"1편 스크립트 (서비스 소개)", assignee:"h3", status:"active", dueDate:"2026-07-03", desc:"브랜드잇다 핵심 서비스 3분 소개", attachments:[{ id:"att_s1", type:"link", name:"", url:"https://docs.google.com/ep1", size:"", desc:"1편 구글독스" }], children:[] },
      { id:"mm2_2", title:"2편 스크립트 (성공 사례)", assignee:"h3", status:"todo", dueDate:"2026-07-07", desc:"클라이언트 성공 케이스 스터디", attachments:[], children:[] },
      { id:"mm2_3", title:"3편 스크립트 (Q&A)", assignee:"h3", status:"todo", dueDate:"2026-07-10", desc:"자주 묻는 SNS 운영 질문 답변", attachments:[], children:[] },
    ]},
    { id:"mm3", title:"촬영일정", assignee:"h6", status:"todo", dueDate:"2026-07-20", desc:"3편 분량 촬영 스케줄 조율", attachments:[], children:[] },
    { id:"mm4", title:"편집", assignee:"h3", status:"todo", dueDate:"2026-08-20", desc:"", attachments:[], children:[] },
  ],
  p3: [
    { id:"kk1", title:"기획", assignee:"h3", status:"done", dueDate:"2026-04-10", desc:"", attachments:[{ id:"att_kk1", type:"file", name:"촌촌락락_기획안_최종.pdf", url:"", size:"4.1MB", desc:"" }], children:[
      { id:"kk1_1", title:"촬영 콘셉트 확정", assignee:"h3", status:"done", dueDate:"2026-03-25", desc:"지역 문화·자연 중심 따뜻한 다큐 스타일", attachments:[], children:[] },
      { id:"kk1_2", title:"로케이션 헌팅", assignee:"h6", status:"done", dueDate:"2026-04-05", desc:"경남 5개 지역 촬영지 선정", attachments:[], children:[] },
    ]},
    { id:"kk2", title:"촬영", assignee:"h6", status:"done", dueDate:"2026-05-01", desc:"", attachments:[], children:[] },
    { id:"kk3", title:"모션", assignee:"h4", status:"done", dueDate:"2026-05-20", desc:"", attachments:[], children:[] },
    { id:"kk4", title:"편집", assignee:"h3", status:"done", dueDate:"2026-06-10", desc:"", attachments:[{ id:"att_kk4", type:"link", name:"", url:"https://vimeo.com/kaces-final", size:"", desc:"최종 납품 영상" }], children:[] },
  ],
  p4: [
    { id:"ll1", title:"UX분석", assignee:"h4", status:"done", dueDate:"2026-05-10", desc:"", attachments:[{ id:"att_ll1", type:"file", name:"UX리서치보고서.pdf", url:"", size:"3.7MB", desc:"" }], children:[
      { id:"ll1_1", title:"사용자 인터뷰 (5인)", assignee:"h4", status:"done", dueDate:"2026-05-05", desc:"주요 고객 5인 심층 인터뷰", attachments:[], children:[] },
      { id:"ll1_2", title:"히트맵 분석", assignee:"h4", status:"done", dueDate:"2026-05-08", desc:"기존 사이트 Hotjar 분석", attachments:[{ id:"att_hm", type:"link", name:"", url:"https://hotjar.com/report", size:"", desc:"히트맵 리포트" }], children:[] },
      { id:"ll1_3", title:"IA 설계", assignee:"h5", status:"done", dueDate:"2026-05-10", desc:"정보구조 재설계", attachments:[], children:[] },
    ]},
    { id:"ll2", title:"시안", assignee:"h4", status:"done", dueDate:"2026-06-01", desc:"", attachments:[{ id:"att_ll2", type:"link", name:"", url:"https://figma.com/landing-design", size:"", desc:"피그마 시안 파일" }], children:[
      { id:"ll2_1", title:"와이어프레임", assignee:"h4", status:"done", dueDate:"2026-05-20", desc:"전체 페이지 로우파이 구조", attachments:[], children:[] },
      { id:"ll2_2", title:"UI 디자인 (하이파이)", assignee:"h4", status:"done", dueDate:"2026-05-30", desc:"최종 시안 3종 클라이언트 선택", attachments:[], children:[] },
    ]},
    { id:"ll3", title:"개발", assignee:"h5", status:"active", dueDate:"2026-07-10", desc:"React + Tailwind 기반 구현", attachments:[], children:[
      { id:"ll3_1", title:"퍼블리싱", assignee:"h5", status:"active", dueDate:"2026-07-01", desc:"HTML/CSS 마크업", attachments:[], children:[] },
      { id:"ll3_2", title:"애니메이션 구현", assignee:"h5", status:"todo", dueDate:"2026-07-05", desc:"GSAP 스크롤 인터랙션", attachments:[], children:[] },
      { id:"ll3_3", title:"성능 최적화", assignee:"h5", status:"todo", dueDate:"2026-07-10", desc:"Lighthouse 90+ 달성", attachments:[], children:[] },
    ]},
    { id:"ll4", title:"QA", assignee:"h5", status:"todo", dueDate:"2026-07-25", desc:"", attachments:[], children:[
      { id:"ll4_1", title:"크로스브라우저 테스트", assignee:"h5", status:"todo", dueDate:"2026-07-20", desc:"Chrome/Safari/Firefox/Edge 검수", attachments:[], children:[] },
      { id:"ll4_2", title:"모바일 반응형 검수", assignee:"h4", status:"todo", dueDate:"2026-07-22", desc:"iPhone/Android 다양한 해상도 확인", attachments:[], children:[] },
    ]},
  ],
};

function nodesFilePath(projId) {
  return path.join(DATA_DIR, `nodes_proj_${projId}.json`);
}
function loadNodes(projId) {
  ensureDataDir();
  const fp = nodesFilePath(projId);
  try {
    if (!fs.existsSync(fp)) {
      const init = JSON.parse(JSON.stringify(INITIAL_NODES[projId] || []));
      fs.writeFileSync(fp, JSON.stringify(init, null, 2), "utf8");
      return init;
    }
    return JSON.parse(fs.readFileSync(fp, "utf8"));
  } catch { return JSON.parse(JSON.stringify(INITIAL_NODES[projId] || [])); }
}
function saveNodes(nodes, projId) {
  ensureDataDir();
  fs.writeFileSync(nodesFilePath(projId), JSON.stringify(nodes, null, 2), "utf8");
}

// 트리를 평탄화하는 헬퍼
function flattenNodes(nodes, projectId, parentId = null) {
  const result = [];
  for (const node of nodes) {
    // assignee(string) → assignees(array) 마이그레이션
    const assignees = Array.isArray(node.assignees)
      ? node.assignees
      : (node.assignee ? [node.assignee] : []);
    result.push({ ...node, assignees, projectId, parentId, children: undefined, startDate: node.startDate || null });
    if (node.children?.length) {
      result.push(...flattenNodes(node.children, projectId, node.id));
    }
  }
  return result;
}

function getNodeById(nodes, nid) {
  for (const n of nodes) {
    if (n.id === nid) return n;
    const f = getNodeById(n.children || [], nid);
    if (f) return f;
  }
  return null;
}
function deleteNodeFromTree(nodes, nid) {
  return nodes
    .filter(n => n.id !== nid)
    .map(n => ({ ...n, children: deleteNodeFromTree(n.children || [], nid) }));
}

// GET /api/data/projects/:id/nodes
app.get("/api/data/projects/:id/nodes", (req, res) => {
  res.json(loadNodes(req.params.id));
});

// GET /api/data/projects/:id/nodes/:nid  (단일 노드 조회)
app.get("/api/data/projects/:id/nodes/:nid", (req, res) => {
  const nodes = loadNodes(req.params.id);
  const node = getNodeById(nodes, req.params.nid);
  if (!node) return res.status(404).json({ error: "not found" });
  res.json(node);
});

// GET /api/data/projects/:id/nodes/flat  (트리 평탄화)
app.get("/api/data/projects/:id/nodes/flat", (req, res) => {
  const nodes = loadNodes(req.params.id);
  res.json(flattenNodes(nodes, req.params.id));
});

// GET /api/data/nodes/all-flat  (전체 프로젝트 노드 평탄화)
app.get("/api/data/nodes/all-flat", (req, res) => {
  const projects = loadProjectsData();
  const all = [];
  for (const proj of projects) {
    const nodes = loadNodes(proj.id);
    all.push(...flattenNodes(nodes, proj.id));
  }
  res.json(all);
});

// POST /api/data/projects/:id/nodes  (루트 노드 추가)
app.post("/api/data/projects/:id/nodes", (req, res) => {
  const { title, assignee, assignees, status, dueDate, desc, progress, startDate, startTime, endTime } = req.body;
  if (!title) return res.status(400).json({ error: "title required" });
  const resolvedAssignees = Array.isArray(assignees) ? assignees : (assignee ? [assignee] : []);
  const node = {
    id:`n_${randomUUID()}`, title,
    assignees: resolvedAssignees,
    status: status||"todo", dueDate: dueDate||null, startDate: startDate||null,
    startTime: startTime||null, endTime: endTime||null,
    desc: desc||"",
    progress: Number(progress)||0,
    attachments:[], comments:[], children:[]
  };
  const nodes = loadNodes(req.params.id);
  nodes.push(node);
  saveNodes(nodes, req.params.id);
  broadcastMessage({ type:"data_update", resource:"nodes", projId:req.params.id });
  res.status(201).json(node);
});

// POST /api/data/projects/:id/nodes/:nid/children  (자식 노드 추가)
app.post("/api/data/projects/:id/nodes/:nid/children", (req, res) => {
  const { title, assignee, assignees, status, dueDate, desc, progress } = req.body;
  if (!title) return res.status(400).json({ error: "title required" });
  const nodes = loadNodes(req.params.id);
  const parent = getNodeById(nodes, req.params.nid);
  if (!parent) return res.status(404).json({ error: "parent not found" });
  const resolvedAssignees = Array.isArray(assignees) ? assignees : (assignee ? [assignee] : []);
  const child = {
    id:`n_${randomUUID()}`, title,
    assignees: resolvedAssignees,
    status: status||"todo", dueDate: dueDate||"", desc: desc||"",
    progress: Number(progress)||0,
    attachments:[], comments:[], children:[]
  };
  parent.children.push(child);
  saveNodes(nodes, req.params.id);
  broadcastMessage({ type:"data_update", resource:"nodes", projId:req.params.id });
  res.status(201).json(child);
});

// PATCH /api/data/projects/:id/nodes/:nid
app.patch("/api/data/projects/:id/nodes/:nid", async (req, res) => {
  const { id, nid } = req.params;
  const { title, assignee, assignees, status, dueDate, desc, progress, startDate, startTime, endTime, newProjectId } = req.body;

  // 프로젝트 이동 처리
  if (newProjectId && newProjectId !== id) {
    let oldNodes = loadNodes(id);
    const node = getNodeById(oldNodes, nid);
    if (!node) return res.status(404).json({ error: "not found" });
    // 필드 업데이트
    if (title     !== undefined) node.title    = title;
    if (assignees !== undefined) node.assignees = Array.isArray(assignees) ? assignees : [];
    else if (assignee !== undefined) node.assignees = assignee ? [assignee] : [];
    if (status    !== undefined) node.status   = status;
    if (dueDate   !== undefined) node.dueDate  = dueDate;
    if (startDate !== undefined) node.startDate = startDate;
    if (startTime !== undefined) node.startTime = startTime;
    if (endTime   !== undefined) node.endTime   = endTime;
    if (desc      !== undefined) node.desc     = desc;
    if (progress  !== undefined) node.progress = Number(progress);
    // 구 프로젝트에서 제거
    oldNodes = deleteNodeFromTree(oldNodes, nid);
    saveNodes(oldNodes, id);
    // 신 프로젝트에 추가
    const newNodes = loadNodes(newProjectId);
    newNodes.push({ ...node, children: node.children || [] });
    saveNodes(newNodes, newProjectId);
    broadcastMessage({ type:"data_update", resource:"nodes" });
    return res.json(node);
  }

  const nodes = loadNodes(id);
  const node = getNodeById(nodes, nid);
  if (!node) return res.status(404).json({ error: "not found" });
  if (title     !== undefined) node.title    = title;
  if (assignees !== undefined) node.assignees = Array.isArray(assignees) ? assignees : [];
  else if (assignee !== undefined) node.assignees = assignee ? [assignee] : [];
  if (status    !== undefined) node.status   = status;
  if (dueDate   !== undefined) node.dueDate  = dueDate;
  if (startDate !== undefined) node.startDate = startDate;
  if (startTime !== undefined) node.startTime = startTime;
  if (endTime   !== undefined) node.endTime   = endTime;
  if (desc      !== undefined) node.desc     = desc;
  if (progress  !== undefined) node.progress = Number(progress);
  saveNodes(nodes, id);

  // 역방향 동기화: projData 진행도 업데이트
  try {
    const allProjectNodes = loadNodes(id);
    const flat = flattenNodes(allProjectNodes, id);
    if (flat.length > 0) {
      const doneCount = flat.filter(n => n.status === "done").length;
      const newProgress = Math.round((doneCount / flat.length) * 100);
      const projDataList = loadProjData();
      const proj = projDataList.find(p => p.id === id);
      if (proj) {
        proj.progress = newProgress;
        saveProjData(projDataList);
        broadcastMessage({ type:"data_update", resource:"projects" });
      }
    }
  } catch(e) { console.error("[sync progress]", e.message); }

  broadcastMessage({ type:"data_update", resource:"nodes", projId:id });
  res.json(node);
});

// DELETE /api/data/projects/:id/nodes/:nid
app.delete("/api/data/projects/:id/nodes/:nid", (req, res) => {
  let nodes = loadNodes(req.params.id);
  if (!getNodeById(nodes, req.params.nid)) return res.status(404).json({ error: "not found" });
  nodes = deleteNodeFromTree(nodes, req.params.nid);
  saveNodes(nodes, req.params.id);
  broadcastMessage({ type:"data_update", resource:"nodes", projId:req.params.id });
  res.json({ ok: true });
});

// POST /api/data/projects/:id/nodes/:nid/attachments
app.post("/api/data/projects/:id/nodes/:nid/attachments", (req, res) => {
  const { type, name, url, size, desc } = req.body;
  if (!type) return res.status(400).json({ error: "type required" });
  const nodes = loadNodes(req.params.id);
  const node = getNodeById(nodes, req.params.nid);
  if (!node) return res.status(404).json({ error: "not found" });
  const att = { id:`att_${randomUUID()}`, type, name:name||"", url:url||"", size:size||"", desc:desc||"" };
  if (!node.attachments) node.attachments = [];
  node.attachments.push(att);
  saveNodes(nodes, req.params.id);
  broadcastMessage({ type: "data_update", resource: "nodes", projId: req.params.id });
  res.status(201).json(att);
});

// DELETE /api/data/projects/:id/nodes/:nid/attachments/:aid
app.delete("/api/data/projects/:id/nodes/:nid/attachments/:aid", (req, res) => {
  const nodes = loadNodes(req.params.id);
  const node = getNodeById(nodes, req.params.nid);
  if (!node) return res.status(404).json({ error: "not found" });
  node.attachments = (node.attachments||[]).filter(a => a.id !== req.params.aid);
  saveNodes(nodes, req.params.id);
  broadcastMessage({ type: "data_update", resource: "nodes", projId: req.params.id });
  res.json({ ok: true });
});

// POST /api/data/projects/:id/nodes/:nid/comments
app.post("/api/data/projects/:id/nodes/:nid/comments", (req, res) => {
  const { text, author } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: "text required" });
  const nodes = loadNodes(req.params.id);
  const node = getNodeById(nodes, req.params.nid);
  if (!node) return res.status(404).json({ error: "not found" });
  const comment = {
    id: `c_${randomUUID()}`,
    text: text.trim(),
    author: author?.trim() || "익명",
    createdAt: new Date().toISOString(),
  };
  if (!node.comments) node.comments = [];
  node.comments.push(comment);
  saveNodes(nodes, req.params.id);
  broadcastMessage({ type: "data_update", resource: "nodes", projId: req.params.id });
  res.status(201).json({ comments: node.comments });
});

// DELETE /api/data/projects/:id/nodes/:nid/comments/:cid
app.delete("/api/data/projects/:id/nodes/:nid/comments/:cid", (req, res) => {
  const nodes = loadNodes(req.params.id);
  const node = getNodeById(nodes, req.params.nid);
  if (!node) return res.status(404).json({ error: "not found" });
  node.comments = (node.comments||[]).filter(c => c.id !== req.params.cid);
  saveNodes(nodes, req.params.id);
  broadcastMessage({ type: "data_update", resource: "nodes", projId: req.params.id });
  res.json({ comments: node.comments });
});

// ── 프로젝트 스레드 ──────────────────────────────────────────────────────────
function threadFilePath(projId) {
  return path.join(DATA_DIR, `thread_proj_${projId}.json`);
}
function loadThread(projId) {
  ensureDataDir();
  const fp = threadFilePath(projId);
  try {
    if (!fs.existsSync(fp)) { fs.writeFileSync(fp, "[]", "utf8"); }
    return JSON.parse(fs.readFileSync(fp, "utf8"));
  } catch { return []; }
}
function saveThread(entries, projId) {
  ensureDataDir();
  fs.writeFileSync(threadFilePath(projId), JSON.stringify(entries, null, 2), "utf8");
}

// GET /api/data/projects/:id/thread
app.get("/api/data/projects/:id/thread", (req, res) => {
  res.json(loadThread(req.params.id));
});

// POST /api/data/projects/:id/thread
app.post("/api/data/projects/:id/thread", (req, res) => {
  const { type, content, url, fileName, fileSize, author } = req.body;
  if (!type) return res.status(400).json({ error: "type required" });
  const entry = {
    id: `th_${randomUUID()}`,
    type,                        // "text" | "link" | "file"
    content: content || "",
    url:      url      || "",
    fileName: fileName || "",
    fileSize: fileSize || "",
    author:   author   || "",
    createdAt: new Date().toISOString(),
  };
  const entries = loadThread(req.params.id);
  entries.push(entry);
  saveThread(entries, req.params.id);
  broadcastMessage({ type: "data_update", resource: "thread", projId: req.params.id });
  res.status(201).json(entry);
});

// DELETE /api/data/projects/:id/thread/:eid
app.delete("/api/data/projects/:id/thread/:eid", (req, res) => {
  const entries = loadThread(req.params.id).filter(e => e.id !== req.params.eid);
  saveThread(entries, req.params.id);
  broadcastMessage({ type: "data_update", resource: "nodes", projId: req.params.id });
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════════════════════
// 보관함 폴더 API (/api/archive/folders)
// ════════════════════════════════════════════════════════════════════════════════

// GET /api/archive/folders → 전체 폴더 목록 반환
app.get("/api/archive/folders", (req, res) => {
  res.json(loadArchiveFolders());
});

// POST /api/archive/folders → 새 폴더 생성 { name, parentId }
app.post("/api/archive/folders", (req, res) => {
  const { name, parentId } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "name is required" });
  const folders = loadArchiveFolders();
  const folder = {
    id: `af_${randomUUID()}`,
    name: name.trim(),
    parentId: parentId || null,
    createdAt: new Date().toISOString(),
  };
  folders.push(folder);
  saveArchiveFolders(folders);
  broadcastMessage({ type: "data_update", resource: "archive-folders" });
  res.status(201).json(folder);
});

// PATCH /api/archive/folders/:id → 폴더 수정 { name?, parentId? }
app.patch("/api/archive/folders/:id", (req, res) => {
  const { id } = req.params;
  const { name, parentId } = req.body;
  const folders = loadArchiveFolders();
  const idx = folders.findIndex(f => f.id === id);
  if (idx === -1) return res.status(404).json({ error: "폴더를 찾을 수 없습니다." });
  if (name     !== undefined) folders[idx].name     = name.trim();
  if (parentId !== undefined) folders[idx].parentId = parentId;
  folders[idx].updatedAt = new Date().toISOString();
  saveArchiveFolders(folders);
  broadcastMessage({ type: "data_update", resource: "archive-folders" });
  res.json(folders[idx]);
});

// DELETE /api/archive/folders/:id → 폴더 삭제
// - 하위 폴더: 삭제된 폴더의 parentId로 올라옴
// - 해당 폴더에 속한 프로젝트: archiveFolderId를 부모 폴더 id로 업데이트
app.delete("/api/archive/folders/:id", (req, res) => {
  const { id } = req.params;
  const folders = loadArchiveFolders();
  const idx = folders.findIndex(f => f.id === id);
  if (idx === -1) return res.status(404).json({ error: "폴더를 찾을 수 없습니다." });

  const deleted = folders[idx];
  const parentId = deleted.parentId || null;

  // 하위 폴더들의 parentId를 삭제된 폴더의 parentId로 업데이트
  const updatedFolders = folders
    .filter(f => f.id !== id)
    .map(f => f.parentId === id ? { ...f, parentId } : f);
  saveArchiveFolders(updatedFolders);

  // projects.json에서 해당 폴더에 속한 프로젝트들의 archiveFolderId를 부모로 업데이트
  try {
    const projects = loadProjects();
    let changed = false;
    for (const p of projects) {
      if (p.archiveFolderId === id) {
        p.archiveFolderId = parentId;
        changed = true;
      }
    }
    if (changed) saveProjects(projects);
  } catch (e) {
    console.error("[DELETE archive folder] projects.json 업데이트 실패:", e.message);
  }

  broadcastMessage({ type: "data_update", resource: "archive-folders" });
  res.json({ ok: true, folder: deleted });
});

// ════════════════════════════════════════════════════════════════════════════════
// Departments API
// ════════════════════════════════════════════════════════════════════════════════

// GET /api/departments
app.get("/api/departments", (req, res) => {
  res.json(loadDepartments());
});

// POST /api/departments
app.post("/api/departments", (req, res) => {
  const { name, color } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "name required" });
  const depts = loadDepartments();
  const dept = { id: `dept_${randomUUID().slice(0, 8)}`, name: name.trim(), color: color || "#6366f1" };
  depts.push(dept);
  saveDepartments(depts);
  res.status(201).json(dept);
});

// PATCH /api/departments/:id
app.patch("/api/departments/:id", (req, res) => {
  const depts = loadDepartments();
  const idx = depts.findIndex(d => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "not found" });
  depts[idx] = { ...depts[idx], ...req.body };
  saveDepartments(depts);
  res.json(depts[idx]);
});

// DELETE /api/departments/:id
app.delete("/api/departments/:id", (req, res) => {
  const depts = loadDepartments();
  const filtered = depts.filter(d => d.id !== req.params.id);
  saveDepartments(filtered);
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════════════════════
// Humans API
// ════════════════════════════════════════════════════════════════════════════════

// GET /api/humans (비밀번호 해시는 절대 노출하지 않음 — hasPassword 플래그만)
app.get("/api/humans", (req, res) => {
  res.json(loadHumans().map(({ passwordHash, ...h }) => ({ ...h, hasPassword: !!passwordHash })));
});

// POST /api/humans
app.post("/api/humans", (req, res) => {
  const { name, title, avatar, deptId, color } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "name required" });
  const humans = loadHumans();
  const human = {
    id: `h_${randomUUID().slice(0, 8)}`,
    name: name.trim(), title: title || "", avatar: avatar || "👤",
    deptId: deptId || "", color: color || "#6366f1",
    status: "active", mood: "",
  };
  humans.push(human);
  saveHumans(humans);
  res.status(201).json(human);
});

// PATCH /api/humans/:id (passwordHash는 이 경로로 못 바꾸게 — 별도 비번 API 사용)
app.patch("/api/humans/:id", (req, res) => {
  const humans = loadHumans();
  const idx = humans.findIndex(h => h.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "not found" });
  const { passwordHash, ...body } = req.body || {};
  humans[idx] = { ...humans[idx], ...body };
  saveHumans(humans);
  const { passwordHash: _ph, ...out } = humans[idx];
  res.json({ ...out, hasPassword: !!humans[idx].passwordHash });
});

// DELETE /api/humans/:id
app.delete("/api/humans/:id", (req, res) => {
  const humans = loadHumans();
  saveHumans(humans.filter(h => h.id !== req.params.id));
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════════════════════
// 내부 로그인 (이메일 + 개별 비밀번호) — scrypt 해시, 평문 저장 안 함
// ════════════════════════════════════════════════════════════════════════════════
function hashPw(pw) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(String(pw), salt, 64).toString("hex")}`;
}
function verifyPw(pw, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const a = Buffer.from(hash, "hex");
  const b = scryptSync(String(pw), salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}
const pubUser = ({ passwordHash, ...h }) => ({ ...h, hasPassword: !!passwordHash });

// 로그인 무차별 대입(brute-force) 방어 — IP당 10분 20회 초과 시 차단 (외부 노출 대비)
const _loginHits = new Map();
const _clientIp = (req) => req.headers["cf-connecting-ip"] || String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.ip || "?";
function _loginLimited(req) {
  const ip = _clientIp(req), now = Date.now();
  const r = _loginHits.get(ip) || { c: 0, t: now };
  if (now - r.t > 600000) { r.c = 0; r.t = now; }
  r.c++; _loginHits.set(ip, r);
  return r.c > 20;
}

// POST /api/login { email, password }
app.post("/api/login", (req, res) => {
  if (_loginLimited(req)) return res.status(429).json({ error: "로그인 시도가 너무 많습니다. 10분 후 다시 시도하세요" });
  const { email, password } = req.body || {};
  if (!email) return res.status(400).json({ error: "이메일을 입력하세요" });
  const u = loadHumans().find((h) => (h.email || "").toLowerCase() === String(email).toLowerCase().trim());
  if (!u) return res.status(401).json({ error: "등록되지 않은 이메일입니다" });
  if (u.status === "blocked") return res.status(403).json({ error: "차단된 계정입니다. 관리자에게 문의하세요" });
  if (!u.passwordHash) return res.json({ needSetup: true, userId: u.id, name: u.name }); // 첫 로그인 — 비번 설정
  if (!password || !verifyPw(password, u.passwordHash)) return res.status(401).json({ error: "비밀번호가 일치하지 않습니다" });
  res.json({ ok: true, user: pubUser(u) });
});

// POST /api/users/:id/password { current, next } — 본인 비밀번호 설정/변경
app.post("/api/users/:id/password", (req, res) => {
  const { current, next } = req.body || {};
  if (!next || String(next).length < 4) return res.status(400).json({ error: "비밀번호는 4자 이상이어야 합니다" });
  const humans = loadHumans();
  const idx = humans.findIndex((h) => h.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
  if (humans[idx].passwordHash && !verifyPw(current, humans[idx].passwordHash)) return res.status(401).json({ error: "현재 비밀번호가 일치하지 않습니다" });
  humans[idx].passwordHash = hashPw(next);
  saveHumans(humans);
  res.json({ ok: true, user: pubUser(humans[idx]) });
});

// ════════════════════════════════════════════════════════════════════════════════
// Projects Data API (/api/projects-data)
// ════════════════════════════════════════════════════════════════════════════════

// GET /api/projects-data
app.get("/api/projects-data", (req, res) => {
  res.json(loadProjectsData());
});

// GET /api/projects-data/:id
app.get("/api/projects-data/:id", (req, res) => {
  const projects = loadProjectsData();
  const proj = projects.find(p => p.id === req.params.id);
  if (!proj) return res.status(404).json({ error: "not found" });
  res.json(proj);
});

// POST /api/projects-data
app.post("/api/projects-data", (req, res) => {
  const { title, deptId, status, startDate, dueDate, description } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: "title required" });
  const projects = loadProjectsData();
  const proj = {
    id: `proj_${randomUUID().slice(0, 8)}`,
    title: title.trim(),
    deptId: deptId || "",
    status: status || "planning",
    startDate: startDate || "",
    dueDate: dueDate || "",
    description: description || "",
    createdAt: new Date().toISOString(),
  };
  projects.push(proj);
  saveProjectsData(projects);
  res.status(201).json(proj);
});

// PATCH /api/projects-data/:id
app.patch("/api/projects-data/:id", (req, res) => {
  const projects = loadProjectsData();
  const idx = projects.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "not found" });
  projects[idx] = { ...projects[idx], ...req.body };
  saveProjectsData(projects);
  res.json(projects[idx]);
});

// DELETE /api/projects-data/:id
app.delete("/api/projects-data/:id", (req, res) => {
  const projects = loadProjectsData();
  saveProjectsData(projects.filter(p => p.id !== req.params.id));
  res.json({ ok: true });
});

// ── 전자결재(기안·결재) ───────────────────────────────────────────────────────
const approvalsPath = () => path.join(DATA_DIR, "approvals.json");
app.get("/api/approvals", (_req, res) => { res.json(loadJSON(approvalsPath(), [])); });
app.post("/api/approvals", (req, res) => {
  const list = loadJSON(approvalsPath(), []);
  const now = new Date().toISOString();
  const doc = { ...req.body, id: req.body.id || ("ap" + Date.now().toString(36) + Math.floor(Math.random() * 1e3)), createdAt: req.body.createdAt || now, updatedAt: now };
  list.unshift(doc); saveJSON(approvalsPath(), list);
  broadcastMessage({ type: "data_update", resource: "approvals" });
  res.status(201).json(doc);
});
app.patch("/api/approvals/:id", (req, res) => {
  const list = loadJSON(approvalsPath(), []);
  const idx = list.findIndex((d) => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "not found" });
  list[idx] = { ...list[idx], ...req.body, id: list[idx].id, updatedAt: new Date().toISOString() };
  saveJSON(approvalsPath(), list);
  broadcastMessage({ type: "data_update", resource: "approvals" });
  res.json(list[idx]);
});
app.delete("/api/approvals/:id", (req, res) => {
  saveJSON(approvalsPath(), loadJSON(approvalsPath(), []).filter((d) => d.id !== req.params.id));
  broadcastMessage({ type: "data_update", resource: "approvals" });
  res.json({ ok: true });
});

// ── 헬스체크 ─────────────────────────────────────────────────────────────────
app.get("/health", (_, res) => {
  res.json({ status: "ok", message: "Agency OS server running" });
});

// ── 프로덕션: 빌드된 프론트엔드(dist) 서빙 + SPA 폴백 (단일 서버 배포용) ──
// dev에서는 dist가 없으니 자동 비활성(Vite가 5174에서 서빙). build 후에는 한 서버가 앱+API 제공.
const DIST_DIR = path.join(process.cwd(), "dist");
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api") || req.path.startsWith("/uploads") || req.path === "/health") return next();
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
  console.log("   [배포] dist/ 정적 서빙 활성화");
}

app.listen(PORT, () => {
  console.log(`\n Agency OS Server`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   Claude Code CLI 연결 대기 중...\n`);
  // data/ 디렉토리 초기화 및 프로젝트 목록 보장
  ensureDataDir();
  loadProjects();
  loadProjData();
  console.log(`   data 디렉토리: ${DATA_DIR}`);
});
