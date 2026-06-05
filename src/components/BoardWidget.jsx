import { useState, useEffect } from "react";

const API = "";

// 우측 패널 상단용 게시판 위젯 — 최근 공지 + 나에게 온 알림 (세로 컴팩트)
export default function BoardWidget({ onGo }) {
  const [notices, setNotices] = useState([]);
  const [notis, setNotis] = useState([]);
  const me = (() => { try { return JSON.parse(localStorage.getItem("boardMe")); } catch { return null; } })();

  useEffect(() => {
    fetch(`${API}/api/boards/notice/posts?size=3`).then((r) => r.json()).then((d) => setNotices([...(d.pinned || []), ...(d.posts || [])].slice(0, 3))).catch(() => {});
    if (me) fetch(`${API}/api/notifications/${me.id}`).then((r) => r.json()).then((d) => setNotis((Array.isArray(d) ? d : []).filter((n) => !n.read).slice(0, 4))).catch(() => {});
  }, []);

  const Sec = ({ icon, label, color, bg, count, empty, items, render }) => (
    <div onClick={onGo} style={{ cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px 5px", fontSize: 10, fontWeight: 700, color, background: bg, borderBottom: "1px solid #e2e8f0" }}>
        <span>{icon} {label}</span>
        {count > 0 && <span style={{ background: color, color: "#fff", borderRadius: 8, padding: "0 5px", fontSize: 8.5, fontWeight: 700 }}>{count}</span>}
      </div>
      <div style={{ padding: "5px 10px 7px" }}>
        {items.length === 0
          ? <div style={{ fontSize: 10.5, color: "#cbd5e1" }}>{empty}</div>
          : items.map(render)}
      </div>
    </div>
  );

  return (
    <div style={{ borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
      <Sec icon="📢" label="최근 공지" color="#ef4444" bg="#fef2f2" count={0} empty="공지가 없습니다" items={notices}
        render={(n) => <div key={n.id} style={{ fontSize: 11.5, color: "#334155", padding: "2px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.pinned ? "📌 " : "· "}{n.title}</div>} />
      <Sec icon="🔔" label="나에게 온 알림" color="#6366f1" bg="#eef2ff" count={notis.length} empty="새 알림이 없습니다" items={notis}
        render={(n) => <div key={n.id} style={{ fontSize: 11.5, color: "#334155", padding: "2px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.type === "comment" ? "💬 " : n.type === "mention" ? "@ " : "📢 "}{n.text}</div>} />
    </div>
  );
}
