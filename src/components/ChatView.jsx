import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

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
  const [copyDone, setCopyDone] = useState(false);
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

  const sendMessage = async (text) => {
    const txt = (text ?? input).trim();
    if (!txt || isTyping) return;
    setInput("");
    setIsTyping(true);
    const bot = BOT_MAP[activeBot];

    const userMsg = { id: `u_${Date.now()}`, clientId: CLIENT_ID, role: "user", senderName: "나", content: txt, timestamp: new Date().toISOString() };
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
        body: JSON.stringify({ message: txt, bot: activeBot, channel: activeBot, agentName: bot.name, msgId: aiMsgId }),
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
        </div>

        {/* 메시지 목록 (카카오톡 스타일) */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 0 8px", background: "#b2c7d9" }}>
          {msgs.length === 0 && !isTyping && (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "#94a3b8" }}>
              <div style={{ fontSize: 38 }}>{cur.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>{cur.name}에게 말씀해보세요</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>{cur.desc}</div>
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
          <div style={{ display: "flex", gap: 6 }}>
            <button title="파일 첨부" style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 10px", fontSize: 13, cursor: "pointer" }}>📎</button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={`${cur.name}에게 메시지...`}
              style={{ flex: 1, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 12px", fontSize: 12, color: "#1e293b", outline: "none" }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={isTyping || !input.trim()}
              style={{ background: isTyping || !input.trim() ? "#e2e8f0" : "#6366f1", color: isTyping || !input.trim() ? "#94a3b8" : "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 12, fontWeight: 700, cursor: isTyping || !input.trim() ? "default" : "pointer" }}
            >전송</button>
          </div>
        </div>
      </div>

      {/* ── RIGHT: 봇 정보 ── */}
      <div style={{ width: 220, flexShrink: 0, background: "#fff", borderLeft: "1px solid #e2e8f0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>봇 정보</div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 24 }}>{cur.icon}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{cur.name}</div>
              <div style={{ fontSize: 9, color: cur.color, fontWeight: 700 }}>Gemini · Dify</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.6, marginBottom: 14 }}>{cur.desc}</div>

          <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 12 }}>
            <div style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>📤 내보내기</div>
            <div
              onClick={() => {
                const text = msgs.map((m) => `[${m.agentName || m.senderName || "나"}] ${m.content}`).join("\n\n");
                navigator.clipboard.writeText(text).then(() => { setCopyDone(true); setTimeout(() => setCopyDone(false), 2000); });
              }}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, color: copyDone ? "#22c55e" : "#475569", cursor: "pointer", background: copyDone ? "#f0fdf4" : "#fff" }}
            >
              <span style={{ fontSize: 14 }}>{copyDone ? "✅" : "📋"}</span>
              <span>{copyDone ? "복사됨!" : "대화 내용 복사"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
