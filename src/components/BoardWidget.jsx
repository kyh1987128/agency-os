import { useState, useEffect } from "react";

const API = "";

// 대시보드용 게시판 위젯 — 최근 공지 + 나에게 온 알림
export default function BoardWidget({ onGo }) {
  const [notices, setNotices] = useState([]);
  const [notis, setNotis] = useState([]);
  const me = (() => { try { return JSON.parse(localStorage.getItem("boardMe")); } catch { return null; } })();

  useEffect(() => {
    fetch(`${API}/api/boards/notice/posts?size=3`).then((r) => r.json()).then((d) => setNotices([...(d.pinned || []), ...(d.posts || [])].slice(0, 3))).catch(() => {});
    if (me) fetch(`${API}/api/notifications/${me.id}`).then((r) => r.json()).then((d) => setNotis((Array.isArray(d) ? d : []).filter((n) => !n.read).slice(0, 4))).catch(() => {});
  }, []);

  const Card = ({ title, color, empty, children }) => (
    <div onClick={onGo} style={{ flex: 1, minWidth: 0, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "11px 14px", cursor: "pointer" }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color, marginBottom: 7 }}>{title}</div>
      {(!children || children.length === 0) ? <div style={{ fontSize: 11, color: "#cbd5e1" }}>{empty}</div> : children}
    </div>
  );

  return (
    <div style={{ display: "flex", gap: 12, padding: "10px 14px 0" }}>
      <Card title="📢 최근 공지" color="#ef4444" empty="공지가 없습니다">
        {notices.map((n) => (
          <div key={n.id} style={{ fontSize: 12, color: "#334155", padding: "2px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.pinned ? "📌 " : "· "}{n.title}</div>
        ))}
      </Card>
      <Card title="🔔 나에게 온 알림" color="#6366f1" empty="새 알림이 없습니다">
        {notis.map((n) => (
          <div key={n.id} style={{ fontSize: 12, color: "#334155", padding: "2px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.type === "comment" ? "💬 " : n.type === "mention" ? "@ " : "📢 "}{n.text}</div>
        ))}
      </Card>
    </div>
  );
}
