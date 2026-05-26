/**
 * Agency OS - Claude Code MCP 서버
 * Claude Code CLI를 subprocess로 호출해서 AI 에이전트 응답 생성
 * 실행: node server.js
 */

import express from "express";
import cors from "cors";
import { spawn } from "child_process";

const app = express();
const PORT = 3001;

app.use(cors({ origin: ["http://localhost:5173", "http://localhost:5174"] }));
app.use(express.json());

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

// 채널별 기본 에이전트
const CHANNEL_AGENTS = {
  general:  "ai_o1",  // 플랜이 전체 채널 관리
  marketing:"ai_m1",
  content:  "ai_c1",
  design:   "ai_d1",
  dev:      "ai_v1",
  strategy: "ai_s1",
  ops:      "ai_o1",
};

// ── 채팅 엔드포인트 (SSE 스트리밍) ───────────────────────────────────────────
app.post("/api/chat", (req, res) => {
  const { message, agentId, agentName, agentTitle, channelName, history = [] } = req.body;
  console.log(`[REQ] ${agentName} / ${message?.slice(0, 30)}`);

  // 시스템 프롬프트 결정
  const systemPrompt = AGENT_PROMPTS[agentId] || `너는 ${agentName || "AI"}야. Agency OS의 AI 에이전트로 팀을 지원해. 한국어로 답해.`;

  const historyContext = history.length > 0
    ? "\n\n[이전 대화]\n" + history.map(h => `${h.role === "user" ? "사용자" : agentName}: ${h.content}`).join("\n")
    : "";

  // SSE 헤더
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Claude Code CLI subprocess 호출 (positional arg 방식 — Windows stdin 문제 우회)
  const claudeExe = process.platform === "win32"
    ? "C:\\Users\\jhkoo\\AppData\\Roaming\\npm\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe"
    : "claude";
  // test-claude.mjs와 동일한 최소 옵션으로 spawn (cwd/env/detached 제거)
  const proc = spawn(claudeExe, [
    "--print",
    "--output-format", "text",
    "--append-system-prompt", systemPrompt,
    historyContext ? `${historyContext}\n사용자: ${message}` : message,
  ], {
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });

  proc.stdout.on("data", (data) => {
    const text = data.toString();
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
  });

  proc.on("error", (err) => {
    console.error("[Claude spawn error]", err.message);
    res.write(`data: ${JSON.stringify({ text: `\n[오류] Claude Code CLI를 찾을 수 없습니다. 'claude' 명령어가 PATH에 있는지 확인해주세요.\n오류: ${err.message}` })}\n\n`);
    res.write(`data: [DONE]\n\n`);
    res.end();
  });

  // 클라이언트 연결 끊기면 프로세스 종료 (res.socket이 SSE에서 올바른 이벤트)
  res.socket?.on("close", () => {
    console.log("[SOCKET CLOSE] client disconnected — killing proc");
    if (!proc.killed) proc.kill();
  });
});

// ── 헬스체크 ─────────────────────────────────────────────────────────────────
app.get("/health", (_, res) => {
  res.json({ status: "ok", message: "Agency OS server running" });
});

app.listen(PORT, () => {
  console.log(`\n🏢 Agency OS Server`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   Claude Code CLI 연결 대기 중...\n`);
});
