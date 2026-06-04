import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { BOT_GUIDE, BOT_LABEL, BOT_EMOJI, detectStep } from "../data/botGuide";

const API = "";
const CLIENT_ID = Math.random().toString(36).slice(2);

// ── Dify 봇 채널 목록 (백엔드 DIFY_KEYS 의 키와 id 일치) ──
const BOTS = [
  { id: "team",     name: "통합 디렉터",    icon: "🏢", color: "#7c3aed", desc: "팀 협업 · 디렉터가 전문봇들을 조율해 보고" },
  { id: "director", name: "기획 디렉터",   icon: "🎯", color: "#6366f1", desc: "무엇이든 물어보세요 · 업무 안내·배분" },
  { id: "saup",     name: "사업계획서 봇",  icon: "📑", color: "#f59e0b", desc: "공고/양식 분석 + 웹검색 기반 사업계획서" },
  { id: "jiwon",    name: "지원사업 봇",    icon: "🏛️", color: "#10b981", desc: "정부지원사업 신청서 작성" },
  { id: "service",  name: "서비스소개서 봇", icon: "📄", color: "#38bdf8", desc: "서비스소개서·제안서" },
  { id: "cs",       name: "CS 문구 봇",     icon: "💬", color: "#f472b6", desc: "고객문의 응대 문구" },
  { id: "meeting",  name: "회의록 봇",      icon: "🗒️", color: "#a78bfa", desc: "회의록 정리·요약" },
  { id: "qa",       name: "사내 Q&A 봇",   icon: "❓", color: "#94a3b8", desc: "사내 업무 문의" },
  { id: "research", name: "리서치 봇",      icon: "🔍", color: "#0ea5e9", desc: "시장·자료 조사 (웹검색)" },
  { id: "review",   name: "검토·감수 봇",   icon: "✅", color: "#22c55e", desc: "문서 검토·감수" },
  { id: "ppt",      name: "발표자료 PPT 봇", icon: "📊", color: "#fb923c", desc: "발표자료 기획·작성" },
];
const BOT_MAP = Object.fromEntries(BOTS.map((b) => [b.id, b]));

// ── 마크다운 렌더 스타일 (표·제목·코드 포함) ──
const md = {
  h1: (p) => <div style={{ fontSize: 15, fontWeight: 800, margin: "10px 0 4px", color: "#1e293b" }} {...p} />,
  h2: (p) => <div style={{ fontSize: 14, fontWeight: 800, margin: "9px 0 4px", color: "#1e293b" }} {...p} />,
  h3: (p) => <div style={{ fontSize: 13, fontWeight: 700, margin: "8px 0 3px", color: "#334155" }} {...p} />,
  h4: (p) => <div style={{ fontSize: 12, fontWeight: 700, margin: "6px 0 2px", color: "#334155" }} {...p} />,
  p:  (p) => <p style={{ margin: "7px 0", lineHeight: 1.8 }} {...p} />,
  ul: (p) => <ul style={{ margin: "7px 0", paddingLeft: 18 }} {...p} />,
  ol: (p) => <ol style={{ margin: "7px 0", paddingLeft: 18 }} {...p} />,
  li: (p) => <li style={{ margin: "4px 0", lineHeight: 1.7 }} {...p} />,
  strong: (p) => <strong style={{ fontWeight: 700, color: "#0f172a" }} {...p} />,
  table: (p) => (
    <div style={{ overflowX: "auto", margin: "8px 0" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }} {...p} />
    </div>
  ),
  th: (p) => <th style={{ border: "1px solid #e2e8f0", background: "#f8fafc", padding: "6px 9px", textAlign: "left", fontWeight: 700, lineHeight: 1.5 }} {...p} />,
  td: (p) => <td style={{ border: "1px solid #e2e8f0", padding: "6px 9px", lineHeight: 1.5 }} {...p} />,
  code: (p) => <code style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: 4, fontSize: 12, fontFamily: "monospace" }} {...p} />,
  a: (p) => <a style={{ color: "#6366f1" }} target="_blank" rel="noreferrer" {...p} />,
  blockquote: (p) => <blockquote style={{ borderLeft: "3px solid #e2e8f0", margin: "4px 0", paddingLeft: 10, color: "#64748b" }} {...p} />,
  hr: () => <hr style={{ border: "none", borderTop: "1px solid #f1f5f9", margin: "8px 0" }} />,
};

export default function ChatView({ activeProject = "default" }) {
  const [activeBot, setActiveBot] = useState("director");
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [cockpitTab, setCockpitTab] = useState("guide"); // guide | flow | evidence
  const [savedFlash, setSavedFlash] = useState("");        // 저장/복사 피드백
  const [templateForm, setTemplateForm] = useState(null);  // 슬래시 템플릿 폼 {tpl, values}
  const [pendingHandoff, setPendingHandoff] = useState(null); // 봇→봇 인계 {bot,text,label}
  const [checkedQ, setCheckedQ] = useState({});            // 품질체크 토글 {`${bot}:${i}`:true}
  const fileInputRef = useRef(null);
  const bottomRef = useRef(null);
  const activeBotRef = useRef(activeBot);
  activeBotRef.current = activeBot;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, isTyping]);

  // 봇 전환 시 메시지 로드
  useEffect(() => {
    setMsgs([]);
    fetch(`${API}/api/projects/${activeProject}/messages/${activeBot}`)
      .then((r) => r.json())
      .then((d) => setMsgs(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [activeBot, activeProject]);

  // SSE 실시간 수신
  useEffect(() => {
    let es;
    const connect = () => {
      es = new EventSource(`${API}/api/stream`);
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "new_message" && data.channel === activeBotRef.current) {
            if (data.message.clientId === CLIENT_ID) return;
            setMsgs((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]));
          }
        } catch {}
      };
      es.onerror = () => { es.close(); setTimeout(connect, 3000); };
    };
    connect();
    return () => es?.close();
  }, []);

  const addMsg = (m) => setMsgs((prev) => [...prev, m]);
  const updateMsg = (id, patch) => setMsgs((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  // 파일 첨부 → Dify 업로드
  const handleFilePick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("bot", activeBot === "team" ? "director" : activeBot);
      fd.append("pid", activeProject);
      const r = await fetch(`${API}/api/dify-upload`, { method: "POST", body: fd });
      const j = await r.json();
      if (r.ok && (j.upload_file_id || j.text)) {
        setAttachedFiles((p) => [...p, { ...j, cid: `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` }]);
      } else {
        alert("파일 업로드 실패: " + (j.message || j.error || "지원되지 않는 형식일 수 있어요"));
      }
    } catch (err) { alert("업로드 오류"); }
    setUploading(false);
  };
  const removeFile = (cid) => setAttachedFiles((p) => p.filter((f) => f.cid !== cid));

  const sendMessage = async (text, displayText) => {
    const txt = (text ?? input).trim();
    if ((!txt && attachedFiles.length === 0) || isTyping) return;
    const filesToSend = attachedFiles.map((f) => ({ type: f.type, transfer_method: f.transfer_method, upload_file_id: f.upload_file_id, name: f.name, text: f.text }));
    const fileNames = attachedFiles.map((f) => f.name);
    setInput("");
    setAttachedFiles([]);
    setIsTyping(true);
    const bot = BOT_MAP[activeBot];
    const query = txt || "첨부한 파일을 분석해줘.";
    // displayText: 봇에 보내는 query와 별개로 사용자 말풍선에 보일 짧은 라벨(코크핏 액션용)
    const displayContent = (displayText ?? txt) + (fileNames.length ? `\n📎 ${fileNames.join(", ")}` : "");

    const userMsg = { id: `u_${Date.now()}`, clientId: CLIENT_ID, role: "user", senderName: "나", content: displayContent, timestamp: new Date().toISOString() };
    addMsg(userMsg);
    fetch(`${API}/api/projects/${activeProject}/messages`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: activeBot, message: userMsg }),
    }).catch(() => {});

    const aiMsgId = `ai_${Date.now()}`;
    addMsg({ id: aiMsgId, role: "assistant", agentId: bot.id, agentName: bot.name, avatar: bot.icon, color: bot.color, content: "", timestamp: new Date().toISOString(), isStreaming: true });
    try {
      const res = await fetch(`${API}/api/projects/${activeProject}/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: query, bot: activeBot, channel: activeBot, agentName: bot.name, msgId: aiMsgId, files: filesToSend }),
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let content = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6);
          if (raw === "[DONE]") break;
          try { const p = JSON.parse(raw); if (p.text) { content += p.text; updateMsg(aiMsgId, { content, isStreaming: false }); } } catch {}
        }
      }
    } catch {
      updateMsg(aiMsgId, { content: "[서버 연결 오류. node server.js 실행 여부 확인]", isStreaming: false });
    }
    setIsTyping(false);
  };

  const cur = BOT_MAP[activeBot];

  // ── 코크핏: 마지막 봇 "산출물" (질문/군더더기 메시지는 제외) ──
  // 마지막 메시지가 "내용을 붙여넣어 주세요" 같은 되묻기면 산출물이 아니므로 건너뛴다.
  const isDeliverable = (c) => {
    const s = (c || "").trim();
    if (s.length < 60) return false;                 // 너무 짧으면 결과물 아님
    if (/[?？]\s*$/.test(s)) return false;             // 질문으로 끝나면 제외
    if (/(붙여넣|입력해\s*주세요|적어\s*주세요|무엇부터|고민\s*중|알려\s*주시면|준비.*되[셨시])/.test(s)) return false; // 되묻기 패턴
    return true;
  };
  const botMsgs = [...msgs].reverse().filter((m) => m.role !== "user" && !m.isStreaming && (m.content || "").trim());
  const lastBotMsg = botMsgs.find((m) => isDeliverable(m.content)) || botMsgs[0]; // 없으면 마지막 봇 메시지로 폴백
  const artifact = lastBotMsg?.content || "";
  const artifactTitle = (() => {
    if (!artifact) return "";
    const first = artifact.split("\n").find((l) => l.trim()) || "";
    return first.replace(/^#+\s*/, "").replace(/[*_`]/g, "").trim().slice(0, 40) || `${cur.name} 결과`;
  })();

  const flash = (msg) => { setSavedFlash(msg); setTimeout(() => setSavedFlash(""), 2000); };

  const copyArtifact = () => { navigator.clipboard.writeText(artifact).then(() => flash("복사됨!")); };

  const downloadBlob = (content, filename, mime) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };
  const exportMd = () => downloadBlob(artifact, `${artifactTitle || "결과물"}.md`, "text/markdown;charset=utf-8");
  const exportDoc = () => {
    // HTML 래핑 → Word가 .doc로 열림 (라이브러리 불필요, 한글 OK)
    const htmlBody = artifact
      .split("\n").map((l) => l.trim() ? `<p>${l.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>` : "<br/>").join("");
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'></head><body>${htmlBody}</body></html>`;
    downloadBlob("﻿" + html, `${artifactTitle || "결과물"}.doc`, "application/msword");
  };

  const saveToKanban = async () => {
    if (!artifact) return;
    try {
      const r = await fetch(`${API}/api/projects/${activeProject}/kanban/cards`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: artifactTitle || `${cur.name} 결과`,
          desc: artifact,
          column: "todo",
          agentId: cur.id, agentName: cur.name, agentAvatar: cur.icon,
          projectId: activeProject !== "default" ? activeProject : null,
        }),
      });
      if (r.ok) flash("📌 칸반에 저장됨!"); else flash("저장 실패");
    } catch { flash("저장 실패"); }
  };

  const saveToTodo = async () => {
    if (!artifact) return;
    try {
      const r = await fetch(`${API}/api/todos`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ humanId: "unassigned", text: `[${cur.name}] ${artifactTitle}` }),
      });
      if (r.ok) flash("✅ 할 일에 추가됨!"); else flash("추가 실패");
    } catch { flash("추가 실패"); }
  };

  const copyConversation = () => {
    const text = msgs.map((m) => `[${m.agentName || m.senderName || "나"}] ${m.content}`).join("\n\n");
    navigator.clipboard.writeText(text).then(() => flash("대화 복사됨!"));
  };

  // ── 업무 가이드 (봇별 플레이북 / 진행 단계 / 다음 봇) ──
  const guide = BOT_GUIDE[activeBot] || BOT_GUIDE.director;
  const convText = msgs.map((m) => m.content || "").join("\n");
  const { current: stepIdx, doneCount } = detectStep(guide.playbook, convText);
  const progress = Math.round((doneCount / guide.playbook.length) * 100);

  // 슬래시 템플릿 보내기
  const submitTemplate = () => {
    if (!templateForm) return;
    const { tpl, values } = templateForm;
    const missing = tpl.fields.some((f) => !(values[f.key] || "").trim());
    if (missing) { flash("빈 칸을 채워주세요"); return; }
    const prompt = tpl.build(values);
    setTemplateForm(null);
    sendMessage(prompt, `📋 ${tpl.title} 요청`);
  };

  // 다른 봇에게 산출물째 넘기기 (유기적 인계)
  const handoffTo = (targetBot) => {
    if (!artifact) { flash("넘길 결과물이 없어요"); return; }
    setPendingHandoff({
      bot: targetBot,
      text: `다음은 '${cur.name}'의 결과물입니다. 이어서 작업해 주세요.\n\n${artifact}`,
      label: `↪ ${cur.name} → ${BOT_MAP[targetBot]?.name || "봇"} 인계\n📎 전달: "${artifactTitle}"`,
    });
    setCockpitTab("guide");
    setActiveBot(targetBot);
    flash(`${BOT_MAP[targetBot]?.name || "봇"}에게 인계 중…`);
  };
  // 봇 전환 완료 후 인계 메시지 자동 전송
  useEffect(() => {
    if (pendingHandoff && pendingHandoff.bot === activeBot) {
      const t = setTimeout(() => {
        sendMessage(pendingHandoff.text, pendingHandoff.label);
        setPendingHandoff(null);
      }, 700);
      return () => clearTimeout(t);
    }
  }, [pendingHandoff, activeBot]); // eslint-disable-line

  // 인계 카드(사람용) — 요약 요청 (클릭 시 1회 호출)
  const makeHandoffCard = () => {
    if (isTyping) return;
    sendMessage(
      "지금까지 진행한 이 업무를 다음 담당자가 이어받을 수 있도록 정리해줘. 형식: ① 업무 요약(2~3줄) ② 완료한 것 ③ 산출물 ④ 다음 할 일.",
      "📋 업무 인계 카드 만들기"
    );
  };

  return (
    <div style={{ display: "flex", flex: 1, height: "100%", overflow: "hidden", fontFamily: "-apple-system, sans-serif" }}>

      {/* ── LEFT: 봇 채널 목록 ── */}
      <div style={{ width: 232, flexShrink: 0, background: "#1a1a2e", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid #252540" }}>
          <div style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>🏢 Agency OS</div>
          <div style={{ color: "#6b7280", fontSize: 10, marginTop: 3 }}>AI 봇과 대화하세요</div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px 14px" }}>
          <div style={{ padding: "6px 8px 4px", fontSize: 9, color: "#4b5563", textTransform: "uppercase", letterSpacing: 1 }}>AI 봇</div>
          {BOTS.map((b) => {
            const on = activeBot === b.id;
            return (
              <div
                key={b.id}
                onClick={() => setActiveBot(b.id)}
                style={{
                  margin: "2px 2px", padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 9,
                  background: on ? (b.id === "director" ? "linear-gradient(135deg,#4f46e5,#7c3aed)" : "#252540") : "transparent",
                }}
                onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "#1e1e3a"; }}
                onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontSize: 16 }}>{b.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: on ? "#fff" : "#cbd5e1", fontWeight: on ? 700 : 500 }}>{b.name}</div>
                </div>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: b.color, flexShrink: 0 }} />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── MIDDLE: 대화 ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#f8fafc", overflow: "hidden" }}>
        {/* 헤더 */}
        <div style={{ padding: "10px 18px", background: "#fff", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 9, flexShrink: 0 }}>
          <span style={{ fontSize: 18 }}>{cur.icon}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{cur.name}</span>
          <span style={{ fontSize: 10, color: "#94a3b8" }}>— {cur.desc}</span>
          <button title="대화 전체 복사" onClick={copyConversation} style={{ marginLeft: "auto", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 7, padding: "5px 10px", fontSize: 11, color: "#475569", cursor: "pointer" }}>📋 대화 복사</button>
        </div>

        {/* 메시지 목록 (카카오톡 스타일) */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 0 8px", background: "#b2c7d9" }}>
          {msgs.length === 0 && !isTyping && (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, padding: "0 20px" }}>
              <div style={{ fontSize: 38 }}>{cur.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#334155" }}>{cur.name}</div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 14 }}>{cur.desc}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>이렇게 시작해 보세요 ↓</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 440 }}>
                {(guide.starters || []).map((s, i) => (
                  <button key={i} onClick={() => sendMessage(s.prompt)} style={{ display: "flex", alignItems: "center", gap: 7, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#334155", fontWeight: 600, cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                    <span style={{ fontSize: 16 }}>{s.icon}</span>{s.label}
                  </button>
                ))}
              </div>
              {(guide.templates || []).length > 0 && (
                <div style={{ display: "flex", gap: 6, marginTop: 12, alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: "#94a3b8" }}>또는 템플릿:</span>
                  {guide.templates.map((tpl) => (
                    <button key={tpl.cmd} onClick={() => setTemplateForm({ tpl, values: {} })} style={{ background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 8, padding: "5px 11px", fontSize: 11, color: "#4338ca", fontWeight: 700, cursor: "pointer" }}>{tpl.cmd}</button>
                  ))}
                </div>
              )}
            </div>
          )}

          {msgs.map((msg) => {
            const isUser = msg.role === "user";
            const bot = BOT_MAP[msg.agentId] || cur;
            const color = msg.color || bot.color || "#6366f1";
            const time = new Date(msg.timestamp).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

            // ── 내 메시지 (오른쪽, 노란 말풍선) ──
            if (isUser) {
              return (
                <div key={msg.id} style={{ display: "flex", justifyContent: "flex-end", alignItems: "flex-end", gap: 5, padding: "4px 16px" }}>
                  <span style={{ fontSize: 9.5, color: "#52616b", marginBottom: 2, flexShrink: 0 }}>{time}</span>
                  <div style={{ maxWidth: "70%", background: "#fee500", color: "#1a1a1a", borderRadius: "16px 5px 16px 16px", padding: "9px 13px", fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word", boxShadow: "0 1px 1.5px rgba(0,0,0,0.12)" }}>
                    {msg.content}
                  </div>
                </div>
              );
            }
            // ── AI 메시지 (왼쪽, 넓은 흰 카드 + 아바타) ──
            return (
              <div key={msg.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 18px 6px 14px" }}>
                <div style={{ width: 34, height: 34, borderRadius: 11, flexShrink: 0, background: color + "22", border: `1px solid ${color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>
                  {msg.avatar || bot.icon || "🤖"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#2d3a47", marginBottom: 4, marginLeft: 3 }}>{msg.agentName || bot.name}</div>
                  <div style={{ background: "#fff", borderRadius: "5px 15px 15px 15px", padding: "13px 16px", fontSize: 13.5, lineHeight: 1.8, color: "#1e293b", wordBreak: "break-word", boxShadow: "0 1px 2px rgba(0,0,0,0.08)", maxWidth: 720 }}>
                    {msg.isStreaming && !msg.content
                      ? <span style={{ color: "#94a3b8", fontStyle: "italic" }}>입력 중...</span>
                      : <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={md}>{msg.content}</ReactMarkdown>}
                  </div>
                  <div style={{ fontSize: 9.5, color: "#52616b", marginTop: 4, marginLeft: 3 }}>{time}</div>
                </div>
              </div>
            );
          })}

          {isTyping && (
            <div style={{ display: "flex", gap: 9, padding: "6px 18px", alignItems: "center" }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: cur.color + "20", border: `1px solid ${cur.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{cur.icon}</div>
              <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: cur.color, animation: `typing 1s ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* 입력창 */}
        <div style={{ padding: "10px 18px", background: "#fff", borderTop: "1px solid #e2e8f0", flexShrink: 0 }}>
          {/* 슬래시 템플릿 폼 */}
          {templateForm && (
            <div style={{ marginBottom: 8, border: "1px solid #c7d2fe", borderRadius: 10, padding: "10px 12px", background: "#f5f7ff" }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#4338ca" }}>📋 {templateForm.tpl.title}</span>
                <span onClick={() => setTemplateForm(null)} style={{ marginLeft: "auto", cursor: "pointer", color: "#94a3b8", fontSize: 12 }}>✕</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {templateForm.tpl.fields.map((f) => (
                  <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "#64748b", width: 64, flexShrink: 0 }}>{f.label}</span>
                    {f.type === "select" ? (
                      <select value={templateForm.values[f.key] || ""} onChange={(e) => setTemplateForm((p) => ({ ...p, values: { ...p.values, [f.key]: e.target.value } }))} style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 6, padding: "5px 8px", fontSize: 11.5, color: "#1e293b" }}>
                        <option value="">선택…</option>
                        {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input value={templateForm.values[f.key] || ""} onChange={(e) => setTemplateForm((p) => ({ ...p, values: { ...p.values, [f.key]: e.target.value } }))} placeholder={f.label} style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 6, padding: "5px 8px", fontSize: 11.5, color: "#1e293b", outline: "none" }} />
                    )}
                  </div>
                ))}
              </div>
              <button onClick={submitTemplate} style={{ marginTop: 9, width: "100%", background: "#6366f1", color: "#fff", border: "none", borderRadius: 7, padding: "7px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>요청 생성 ▶</button>
            </div>
          )}
          {/* 첨부 파일 칩 */}
          {(attachedFiles.length > 0 || uploading) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {attachedFiles.map((f) => (
                <span key={f.cid} title={f.extracted ? `본문 추출됨 (${f.textLen}자)` : "본문 추출 불가 — 파일째 전달"} style={{ display: "flex", alignItems: "center", gap: 5, background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 7, padding: "3px 8px", fontSize: 11, color: "#4338ca" }}>
                  {f.extracted ? "📄" : "📎"} {f.name}{f.extracted ? <span style={{ color: "#16a34a", fontSize: 10 }}>✓</span> : null}
                  <span onClick={() => removeFile(f.cid)} style={{ cursor: "pointer", color: "#818cf8" }}>✕</span>
                </span>
              ))}
              {uploading && <span style={{ fontSize: 11, color: "#94a3b8" }}>⏳ 업로드 중...</span>}
            </div>
          )}
          <div style={{ display: "flex", gap: 6 }}>
            {/* label로 감싸면 input을 네이티브로 트리거 → 모든 브라우저에서 확실히 동작 */}
            <label title="파일 첨부 (공고문·양식 등)" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 10px", fontSize: 13, cursor: uploading ? "default" : "pointer", flexShrink: 0 }}>
              {uploading ? "⏳" : "📎"}
              <input ref={fileInputRef} type="file" onChange={handleFilePick} disabled={uploading} style={{ display: "none" }} accept=".pdf,.doc,.docx,.txt,.md,.csv,.xlsx,.xls,.png,.jpg,.jpeg" />
            </label>
            {(guide.templates || []).length > 0 && (
              <button title="업무 템플릿" onClick={() => setTemplateForm({ tpl: guide.templates[0], values: {} })} style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 9px", fontSize: 13, cursor: "pointer", flexShrink: 0 }}>📋</button>
            )}
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={`${cur.name}에게 메시지...`}
              style={{ flex: 1, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 12px", fontSize: 12, color: "#1e293b", outline: "none" }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={isTyping || (!input.trim() && attachedFiles.length === 0)}
              style={{ background: isTyping || (!input.trim() && attachedFiles.length === 0) ? "#e2e8f0" : "#6366f1", color: isTyping || (!input.trim() && attachedFiles.length === 0) ? "#94a3b8" : "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 12, fontWeight: 700, cursor: isTyping || (!input.trim() && attachedFiles.length === 0) ? "default" : "pointer" }}
            >전송</button>
          </div>
        </div>
      </div>

      {/* ── RIGHT: 업무 가이드 (가이드 / 흐름도 / 근거) ── */}
      <div style={{ width: 400, flexShrink: 0, background: "#fff", borderLeft: "1px solid #e2e8f0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* 탭 */}
        <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
          {[["guide", "🧭 가이드"], ["flow", "🔄 흐름도"], ["evidence", "📎 근거"]].map(([id, label]) => (
            <button key={id} onClick={() => setCockpitTab(id)} style={{
              flex: 1, padding: "11px 4px", border: "none", background: cockpitTab === id ? "#fff" : "#f8fafc",
              borderBottom: cockpitTab === id ? "2px solid #6366f1" : "2px solid transparent",
              color: cockpitTab === id ? "#6366f1" : "#94a3b8", fontWeight: cockpitTab === id ? 700 : 500,
              fontSize: 11.5, cursor: "pointer",
            }}>{label}</button>
          ))}
        </div>

        {/* 🧭 가이드 */}
        {cockpitTab === "guide" && (
          <>
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
              {/* 진행 단계 */}
              <Section title="📊 진행 단계">
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: "#475569", fontWeight: 700 }}>{cur.name}</span>
                  <span style={{ fontSize: 9, color: "#cbd5e1" }}>· 대화 기반 추정</span>
                  <span style={{ marginLeft: "auto", fontSize: 10, color: "#6366f1", fontWeight: 700 }}>{progress}%</span>
                </div>
                <div style={{ height: 5, background: "#eef2ff", borderRadius: 3, marginBottom: 10, overflow: "hidden" }}>
                  <div style={{ width: `${progress}%`, height: "100%", background: "#6366f1", borderRadius: 3, transition: "width .4s" }} />
                </div>
                {guide.playbook.map((s, i) => {
                  const done = i < doneCount, here = i === stepIdx && doneCount < guide.playbook.length;
                  return (
                    <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                      <span style={{ fontSize: 13 }}>{done ? "✅" : here ? "🔵" : "⚪"}</span>
                      <span style={{ fontSize: 12, color: done ? "#94a3b8" : here ? "#1e293b" : "#64748b", fontWeight: here ? 700 : 500, textDecoration: done ? "line-through" : "none" }}>{s.label}</span>
                      {here && <span style={{ fontSize: 9, color: "#6366f1", background: "#eef2ff", padding: "1px 6px", borderRadius: 6 }}>지금</span>}
                    </div>
                  );
                })}
              </Section>

              {/* 다음 액션 */}
              <Section title="👉 다음 액션">
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {guide.starters.map((s, i) => (
                    <button key={i} disabled={isTyping} onClick={() => sendMessage(s.prompt)} style={{ ...cock(isTyping), textAlign: "left", padding: "7px 10px" }}>
                      › {s.label}
                    </button>
                  ))}
                  {guide.nextBots.map((nb) => (
                    <button key={nb} disabled={!artifact} onClick={() => handoffTo(nb)} title="현재 결과물을 함께 넘깁니다" style={{ ...cock(!artifact), textAlign: "left", padding: "7px 10px", background: artifact ? "#fff7ed" : "#f8fafc", borderColor: "#fed7aa", color: artifact ? "#c2410c" : "#94a3b8" }}>
                      ↪ {BOT_MAP[nb]?.icon} {BOT_MAP[nb]?.name}에게 넘기기
                    </button>
                  ))}
                </div>
              </Section>

              {/* 품질 체크 */}
              <Section title="✅ 품질 체크">
                {guide.quality.map((q, i) => {
                  const key = `${activeBot}:${i}`;
                  return (
                    <label key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", cursor: "pointer" }}>
                      <input type="checkbox" checked={!!checkedQ[key]} onChange={() => setCheckedQ((p) => ({ ...p, [key]: !p[key] }))} style={{ accentColor: "#6366f1", cursor: "pointer" }} />
                      <span style={{ fontSize: 11.5, color: checkedQ[key] ? "#94a3b8" : "#475569", textDecoration: checkedQ[key] ? "line-through" : "none" }}>{q}</span>
                    </label>
                  );
                })}
              </Section>

              {/* 인계 */}
              <Section title="📋 업무 인계">
                <button disabled={isTyping || msgs.length === 0} onClick={makeHandoffCard} style={{ ...cock(isTyping || msgs.length === 0), width: "100%", padding: "8px", background: "#f0fdf4", borderColor: "#bbf7d0", color: msgs.length ? "#16a34a" : "#94a3b8" }}>
                  📋 인계 카드 만들기 (요약+산출물+다음 할 일)
                </button>
              </Section>
            </div>

            {/* 결과물 액션 바 (하단 고정) */}
            <div style={{ borderTop: "1px solid #f1f5f9", padding: "9px 12px", flexShrink: 0, background: "#fff" }}>
              {savedFlash && <div style={{ fontSize: 11, color: "#16a34a", fontWeight: 700, marginBottom: 6, textAlign: "center" }}>{savedFlash}</div>}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {[["📋 복사", copyArtifact], [".docx", exportDoc], [".md", exportMd]].map(([l, fn]) => (
                  <button key={l} disabled={!artifact} onClick={fn} style={cock(!artifact)}>{l}</button>
                ))}
                <button disabled={!artifact} onClick={saveToKanban} style={{ ...cock(!artifact), background: artifact ? "#eef2ff" : "#f8fafc", color: artifact ? "#4338ca" : "#94a3b8", borderColor: "#c7d2fe" }}>📌 칸반</button>
                <button disabled={!artifact} onClick={saveToTodo} style={{ ...cock(!artifact), background: artifact ? "#f0fdf4" : "#f8fafc", color: artifact ? "#16a34a" : "#94a3b8", borderColor: "#bbf7d0" }}>✅ 할일</button>
              </div>
            </div>
          </>
        )}

        {/* 🔄 흐름도 */}
        {cockpitTab === "flow" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
            <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>이 업무의 흐름</div>
            {(() => {
              const chain = [{ id: activeBot, who: "bot", state: "now" },
                ...guide.nextBots.map((nb) => ({ id: nb, who: "bot", state: "wait" })),
                { id: "person", who: "person", state: "wait" }];
              return chain.map((node, i) => (
                <div key={i}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid " + (node.state === "now" ? "#6366f1" : "#e2e8f0"), borderRadius: 10, background: node.state === "now" ? "#eef2ff" : "#fff" }}>
                    <span style={{ fontSize: 20 }}>{node.who === "person" ? "👤" : BOT_MAP[node.id]?.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#1e293b" }}>{node.who === "person" ? "사람이 이어받기" : BOT_MAP[node.id]?.name}</div>
                      <div style={{ fontSize: 10, color: "#94a3b8" }}>{node.state === "now" ? "지금 진행 중" : node.who === "person" ? "인계 카드로 전달" : "대기 (넘기면 진행)"}</div>
                    </div>
                    {node.state === "now" && <span style={{ fontSize: 9, color: "#6366f1", background: "#fff", border: "1px solid #c7d2fe", padding: "2px 7px", borderRadius: 7, fontWeight: 700 }}>현재</span>}
                  </div>
                  {i < chain.length - 1 && <div style={{ textAlign: "center", color: "#cbd5e1", fontSize: 14, margin: "1px 0" }}>↓</div>}
                </div>
              ));
            })()}
            <div style={{ marginTop: 14, fontSize: 11, color: "#94a3b8", lineHeight: 1.7, background: "#f8fafc", borderRadius: 8, padding: "10px 12px" }}>
              💡 봇에게 넘길 땐 <b style={{ color: "#c2410c" }}>현재 결과물이 함께 전달</b>됩니다. 사람에게는 <b style={{ color: "#16a34a" }}>인계 카드</b>로 넘어갑니다.
            </div>
          </div>
        )}

        {/* 📎 근거 (다음 단계) */}
        {cockpitTab === "evidence" && (
          <div style={cockEmpty}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>📎</div>
            <b style={{ color: "#64748b" }}>근거·출처</b><br />
            봇 답변의 웹검색 출처와<br />사내위키 근거를 표시합니다.<br />
            <span style={{ color: "#cbd5e1" }}>(위키 연결 후 제공)</span>
          </div>
        )}
      </div>
    </div>
  );
}

// 가이드 섹션 래퍼
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#334155", marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

// 코크핏 버튼/빈상태 공용 스타일
const cockBtn = { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 7, padding: "6px 9px", fontSize: 11, color: "#475569", cursor: "pointer", fontWeight: 600 };
const cock = (disabled) => ({ ...cockBtn, opacity: disabled ? 0.45 : 1, cursor: disabled ? "default" : "pointer" });
const cockEmpty = { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", color: "#94a3b8", fontSize: 12, lineHeight: 1.7, padding: 20 };
