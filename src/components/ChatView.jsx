import { useState, useRef, useEffect } from "react";
import { AI_AGENTS } from "../data/agents";

const CHANNELS = [
  { id: "general",   name: "전체",   type: "channel", icon: "#", agents: AI_AGENTS.map(a => a.id) },
  { id: "marketing", name: "마케팅", type: "channel", icon: "#", deptId: "marketing", agents: AI_AGENTS.filter(a => a.dept === "marketing").map(a => a.id) },
  { id: "content",   name: "콘텐츠", type: "channel", icon: "#", deptId: "content",   agents: AI_AGENTS.filter(a => a.dept === "content").map(a => a.id) },
  { id: "design",    name: "디자인", type: "channel", icon: "#", deptId: "design",    agents: AI_AGENTS.filter(a => a.dept === "design").map(a => a.id) },
  { id: "dev",       name: "개발",   type: "channel", icon: "#", deptId: "dev",       agents: AI_AGENTS.filter(a => a.dept === "dev").map(a => a.id) },
  { id: "strategy",  name: "전략",   type: "channel", icon: "#", deptId: "strategy",  agents: AI_AGENTS.filter(a => a.dept === "strategy").map(a => a.id) },
  { id: "ops",       name: "운영",   type: "channel", icon: "#", deptId: "ops",       agents: AI_AGENTS.filter(a => a.dept === "ops").map(a => a.id) },
];

const DM_CHANNELS = AI_AGENTS.map(a => ({
  id: `dm_${a.id}`,
  name: a.name,
  type: "dm",
  icon: a.avatar,
  agentId: a.id,
  agent: a,
}));

const ALL_CHANNELS = [...CHANNELS, ...DM_CHANNELS];

export default function ChatView() {
  const [activeChannel, setActiveChannel] = useState("general");
  const [messages, setMessages] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("agency_chat") || "{}");
    } catch {
      return {};
    }
  });
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("agency_chat", JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeChannel, isTyping]);

  const addMessage = (channelId, msg) => {
    setMessages(prev => ({
      ...prev,
      [channelId]: [...(prev[channelId] || []), msg],
    }));
  };

  const updateMessage = (channelId, msgId, content) => {
    setMessages(prev => ({
      ...prev,
      [channelId]: (prev[channelId] || []).map(m =>
        m.id === msgId ? { ...m, content } : m
      ),
    }));
  };

  const sendMessage = async () => {
    if (!input.trim() || isTyping) return;
    const text = input.trim();
    setInput("");

    const userMsg = {
      id: Date.now() + Math.random(),
      sender: "user",
      senderName: "나",
      senderAvatar: "👤",
      senderColor: "#6366f1",
      content: text,
      timestamp: Date.now(),
      isAI: false,
    };
    addMessage(activeChannel, userMsg);

    const channel = ALL_CHANNELS.find(c => c.id === activeChannel);
    let respondingAgent = null;

    // @멘션 체크
    const mentionMatch = text.match(/@(\S+)/);
    if (mentionMatch) {
      respondingAgent = AI_AGENTS.find(a => a.name === mentionMatch[1]);
    }
    // DM이면 해당 에이전트
    if (!respondingAgent && channel?.type === "dm") {
      respondingAgent = AI_AGENTS.find(a => a.id === channel.agentId);
    }
    // 채널이면 active 에이전트 우선, 없으면 첫 번째
    if (!respondingAgent && channel?.agents?.length > 0) {
      respondingAgent =
        AI_AGENTS.find(a => channel.agents.includes(a.id) && a.status === "active") ||
        AI_AGENTS.find(a => channel.agents.includes(a.id));
    }

    if (!respondingAgent) return;

    setIsTyping(true);

    const history = (messages[activeChannel] || []).slice(-10).map(m => ({
      role: m.isAI ? "assistant" : "user",
      content: m.content,
    }));

    try {
      const res = await fetch("http://localhost:3001/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          agentId: respondingAgent.id,
          agentName: respondingAgent.name,
          agentTitle: respondingAgent.title,
          agentDesc: respondingAgent.desc,
          channelName: channel?.name || "전체",
          history,
        }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let aiContent = "";
      const aiMsgId = Date.now() + Math.random();

      addMessage(activeChannel, {
        id: aiMsgId,
        sender: respondingAgent.id,
        senderName: respondingAgent.name,
        senderAvatar: respondingAgent.avatar,
        senderColor: respondingAgent.color,
        content: "",
        timestamp: Date.now(),
        isAI: true,
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                aiContent += parsed.text;
                updateMessage(activeChannel, aiMsgId, aiContent);
              }
            } catch {
              // JSON 파싱 실패 시 무시
            }
          }
        }
      }
    } catch {
      addMessage(activeChannel, {
        id: Date.now() + Math.random(),
        sender: respondingAgent.id,
        senderName: respondingAgent.name,
        senderAvatar: respondingAgent.avatar,
        senderColor: respondingAgent.color,
        content: `[서버 연결 필요] http://localhost:3001 서버를 먼저 실행해주세요.\n\`node server.js\``,
        timestamp: Date.now(),
        isAI: true,
      });
    } finally {
      setIsTyping(false);
    }
  };

  const currentChannel = ALL_CHANNELS.find(c => c.id === activeChannel);
  const currentChannelAgents =
    currentChannel?.type === "dm"
      ? [currentChannel.agent]
      : AI_AGENTS.filter(a => currentChannel?.agents?.includes(a.id));

  const channelMessages = messages[activeChannel] || [];

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>

      {/* 채널 사이드바 */}
      <div style={{ width: 220, background: "#1e1e2e", display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 14px 10px", color: "white", fontSize: 13, fontWeight: 700, flexShrink: 0, borderBottom: "1px solid #2d2d3f" }}>
          💬 Agency Chat
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {/* 채널 섹션 */}
          <div style={{ padding: "12px 14px 4px", fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>
            채널
          </div>
          {CHANNELS.map(ch => (
            <button
              key={ch.id}
              onClick={() => setActiveChannel(ch.id)}
              className="chat-channel-hover"
              style={{
                width: "100%",
                textAlign: "left",
                padding: "6px 14px",
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                background: activeChannel === ch.id ? "#312e81" : "transparent",
                color: activeChannel === ch.id ? "white" : "#9ca3af",
                borderRadius: 0,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span style={{ color: "#6b7280", marginRight: 2 }}>#</span>
              {ch.name}
            </button>
          ))}

          {/* DM 섹션 */}
          <div style={{ padding: "14px 14px 4px", fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>
            다이렉트
          </div>
          {DM_CHANNELS.map(dm => (
            <button
              key={dm.id}
              onClick={() => setActiveChannel(dm.id)}
              className="chat-channel-hover"
              style={{
                width: "100%",
                textAlign: "left",
                padding: "5px 14px",
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                background: activeChannel === dm.id ? "#312e81" : "transparent",
                color: activeChannel === dm.id ? "white" : "#9ca3af",
                borderRadius: 0,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>{dm.icon}</span>
              <span style={{ flex: 1 }}>{dm.name}</span>
              <span style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: dm.agent.status === "active" ? "#22c55e" : "#6b7280",
                display: "inline-block",
                flexShrink: 0,
              }} />
            </button>
          ))}
        </div>
      </div>

      {/* 메시지 영역 */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#f8fafc", overflow: "hidden" }}>

        {/* 채널 헤더 */}
        <div style={{
          padding: "12px 20px",
          borderBottom: "1px solid #e2e8f0",
          background: "white",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 14, color: "#6366f1", fontWeight: 700 }}>
            {currentChannel?.type === "dm" ? currentChannel?.icon : "#"}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
            {currentChannel?.name}
          </span>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {currentChannelAgents.slice(0, 5).map(a => (
              <span
                key={a.id}
                title={`${a.name} (${a.title})`}
                style={{ fontSize: 14, cursor: "default" }}
              >
                {a.avatar}
              </span>
            ))}
            {currentChannelAgents.length > 5 && (
              <span style={{ fontSize: 10, color: "#94a3b8" }}>+{currentChannelAgents.length - 5}</span>
            )}
          </div>
        </div>

        {/* 메시지 목록 */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {channelMessages.length === 0 ? (
            <div style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              color: "#94a3b8",
            }}>
              <div style={{ fontSize: 40 }}>
                {currentChannel?.type === "dm" ? currentChannel?.icon : "💬"}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#64748b" }}>
                {currentChannel?.type === "dm"
                  ? `${currentChannel.name}과 대화를 시작해보세요`
                  : `#${currentChannel?.name} 채널에서 대화를 시작해보세요`}
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>
                @에이전트명으로 특정 AI를 호출할 수 있습니다
              </div>
            </div>
          ) : (
            channelMessages.map(msg => (
              <div
                key={msg.id}
                className="msg-hover"
                style={{ display: "flex", gap: 10, padding: "8px 20px", alignItems: "flex-start" }}
              >
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: msg.senderColor + "20",
                  border: "1px solid " + msg.senderColor + "33",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  flexShrink: 0,
                }}>
                  {msg.senderAvatar}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: msg.isAI ? msg.senderColor : "#1e293b",
                    }}>
                      {msg.senderName}
                    </span>
                    {msg.isAI && (
                      <span style={{
                        fontSize: 9,
                        background: "#8b5cf620",
                        color: "#8b5cf6",
                        padding: "1px 6px",
                        borderRadius: 4,
                        fontWeight: 600,
                      }}>
                        AI
                      </span>
                    )}
                    <span style={{ fontSize: 9, color: "#94a3b8" }}>
                      {new Date(msg.timestamp).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 12,
                    color: "#1e293b",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}>
                    {msg.content || (msg.isAI && (
                      <span style={{ color: "#94a3b8", fontStyle: "italic" }}>입력 중...</span>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}

          {/* 타이핑 인디케이터 */}
          {isTyping && (
            <div style={{ display: "flex", gap: 10, padding: "8px 20px", alignItems: "center" }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "#8b5cf620",
                border: "1px solid #8b5cf633",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
              }}>
                🤖
              </div>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#8b5cf6",
                      animation: `typing 1s ${i * 0.2}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 입력창 */}
        <div style={{
          padding: "12px 20px",
          borderTop: "1px solid #e2e8f0",
          background: "white",
          display: "flex",
          gap: 10,
          flexShrink: 0,
        }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={
              currentChannel?.type === "dm"
                ? `${currentChannel.name}에게 메시지 보내기...`
                : `#${currentChannel?.name || ""} 에 메시지 보내기... (@에이전트명 으로 특정 AI 호출)`
            }
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              fontSize: 12,
              color: "#1e293b",
              outline: "none",
              background: "#f8fafc",
            }}
          />
          <button
            onClick={sendMessage}
            disabled={isTyping || !input.trim()}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: "none",
              background: isTyping || !input.trim() ? "#e2e8f0" : "#6366f1",
              color: isTyping || !input.trim() ? "#94a3b8" : "white",
              cursor: isTyping || !input.trim() ? "default" : "pointer",
              fontSize: 12,
              fontWeight: 600,
              flexShrink: 0,
              transition: "background 0.15s",
            }}
          >
            전송
          </button>
        </div>
      </div>
    </div>
  );
}
