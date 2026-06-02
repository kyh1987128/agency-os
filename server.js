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
import { randomUUID } from "crypto";

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
const difyConversations = {};

async function runDifyStream({ res, apiKey, query, user, convKey, onComplete }) {
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
          if (o.conversation_id) difyConversations[convKey] = o.conversation_id;
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

async function runOrchestrator({ res, pid, message, onComplete }) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  let full = "";
  const write = (t) => { full += t; res.write(`data: ${JSON.stringify({ text: t })}\n\n`); };

  try {
    write("🎯 **디렉터**가 요청을 분석하고 있습니다...\n\n");
    const planPrompt =
      `너는 업무 오케스트레이터다. 아래 요청을 처리하기 위해 호출할 전문봇을 순서대로 골라라.\n` +
      `사용 가능한 봇 id: research(시장조사·웹검색), saup(사업계획서), jiwon(정부지원사업), service(서비스소개서), cs(고객응대문구), meeting(회의록), review(문서 검토감수), ppt(발표자료).\n` +
      `반드시 JSON 배열로만 답하라. 형식: [{"bot":"research","task":"그 봇에게 시킬 구체 지시(한국어)"}]. 불필요한 봇은 빼고 최대 3개. 설명 금지, JSON만.\n` +
      `요청: ${message}`;
    const planRaw = await callDifyBot(DIFY_KEYS.director, planPrompt, `proj_${pid}`);
    let plan = [];
    try { const m = planRaw.match(/\[[\s\S]*\]/); if (m) plan = JSON.parse(m[0]); } catch {}
    plan = (Array.isArray(plan) ? plan : []).filter((s) => s && ORCH_BOTS[s.bot]).slice(0, 3);

    if (plan.length === 0) {
      write("→ 디렉터가 직접 답변합니다.\n\n---\n\n");
      await callDifyBot(DIFY_KEYS.director, message, `proj_${pid}`, (c) => write(c));
      res.write(`data: [DONE]\n\n`); res.end(); if (onComplete) onComplete(full); return;
    }

    write("📋 **작업 계획**\n");
    plan.forEach((s, i) => write(`${i + 1}. ${ORCH_BOTS[s.bot].icon} ${ORCH_BOTS[s.bot].name} — ${s.task}\n`));
    write("\n---\n");

    let context = "";
    for (const s of plan) {
      const b = ORCH_BOTS[s.bot];
      write(`\n### ${b.icon} ${b.name} 작업 중...\n\n`);
      const q = context ? `${s.task}\n\n[이전 단계 결과 참고]\n${context.slice(0, 1800)}` : s.task;
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
  const { title, agentId, agentName, agentAvatar, column, dept, projectId, dueDate } = req.body;
  if (!title) {
    return res.status(400).json({ error: "title is required" });
  }
  const kanban = loadKanban(pid);
  const newCard = {
    id: `card_${randomUUID()}`,
    title,
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
  const { column, title, agentId, agentName, agentAvatar, dept, projectId, dueDate } = req.body;
  const kanban = loadKanban(pid);
  const card = kanban.cards.find((c) => c.id === cid);
  if (!card) {
    return res.status(404).json({ error: "카드를 찾을 수 없습니다." });
  }
  if (column      !== undefined) card.column      = column;
  if (title       !== undefined) card.title       = title;
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

// POST /api/projects/:pid/chat → 프로젝트 채팅 (스트리밍)
app.post("/api/projects/:pid/chat", (req, res) => {
  const { pid } = req.params;
  const { message, agentId, agentName, agentTitle, channelName, channel, history = [], msgId, bot } = req.body;
  console.log(`[REQ:${pid}] bot=${bot || agentId} / ${message?.slice(0, 30)}`);

  const targetChannel = channel || channelName || bot || "general";

  // 통합 디렉터 (오케스트레이터): 여러 전문봇을 조율
  if (bot === "team" || channel === "team") {
    return runOrchestrator({
      res, pid, message,
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
      query: message,
      user: `proj_${pid}`,
      convKey: `${pid}:${targetChannel}`,
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
  const prompt = historyContext ? `${historyContext}\n사용자: ${message}` : message;
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

// GET /api/humans
app.get("/api/humans", (req, res) => {
  res.json(loadHumans());
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

// PATCH /api/humans/:id
app.patch("/api/humans/:id", (req, res) => {
  const humans = loadHumans();
  const idx = humans.findIndex(h => h.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "not found" });
  humans[idx] = { ...humans[idx], ...req.body };
  saveHumans(humans);
  res.json(humans[idx]);
});

// DELETE /api/humans/:id
app.delete("/api/humans/:id", (req, res) => {
  const humans = loadHumans();
  saveHumans(humans.filter(h => h.id !== req.params.id));
  res.json({ ok: true });
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

// ── 헬스체크 ─────────────────────────────────────────────────────────────────
app.get("/health", (_, res) => {
  res.json({ status: "ok", message: "Agency OS server running" });
});

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
