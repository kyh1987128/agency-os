import { useState, useEffect } from "react";

const API = "";

// 담당자별 할 일 메모 — 칸반 하단 패널 (항상 펼침, 칸반과 50:50)
export default function TodoPanel({ humans = [] }) {
  const [todos, setTodos] = useState([]);
  const [drafts, setDrafts] = useState({}); // colId -> 입력값

  const load = () =>
    fetch(`${API}/api/todos`).then((r) => r.json()).then((d) => setTodos(Array.isArray(d) ? d : [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const add = async (humanId) => {
    const text = (drafts[humanId] || "").trim();
    if (!text) return;
    setDrafts((p) => ({ ...p, [humanId]: "" }));
    try {
      const r = await fetch(`${API}/api/todos`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ humanId, text }),
      });
      const item = await r.json();
      setTodos((p) => [...p, item]);
    } catch {}
  };

  const toggle = async (t) => {
    setTodos((p) => p.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)));
    try { await fetch(`${API}/api/todos/${t.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done: !t.done }) }); } catch {}
  };

  const del = async (t) => {
    setTodos((p) => p.filter((x) => x.id !== t.id));
    try { await fetch(`${API}/api/todos/${t.id}`, { method: "DELETE" }); } catch {}
  };

  const total = todos.length;
  const doneCount = todos.filter((t) => t.done).length;

  const cols = [
    ...humans.map((h) => ({ id: h.id, name: h.name, avatar: h.avatar, color: h.color || "#6366f1" })),
    { id: "unassigned", name: "미지정", avatar: "📌", color: "#94a3b8" },
  ];

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", borderTop: "2px solid #cbd5e1", background: "#fff" }}>
      {/* 헤더 (고정) */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
        <span style={{ fontSize: 13 }}>✅</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>할 일 메모 (담당자별)</span>
        <span style={{ fontSize: 10, color: "#94a3b8" }}>· {doneCount}/{total} 완료</span>
      </div>

      {/* 본문 (가로 스크롤, 컬럼별 세로 스크롤) */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 10, padding: "10px 16px", overflowX: "auto", overflowY: "hidden" }}>
        {cols.map((col) => {
          const items = todos.filter((t) => (t.humanId || "unassigned") === col.id);
          return (
            <div key={col.id} style={{ flexShrink: 0, width: 210, height: "100%", display: "flex", flexDirection: "column", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 9px", borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
                <span style={{ fontSize: 14 }}>{col.avatar}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: col.color }}>{col.name}</span>
                <span style={{ marginLeft: "auto", fontSize: 9, color: "#94a3b8", background: "#fff", padding: "1px 6px", borderRadius: 7 }}>{items.length}</span>
              </div>
              <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 6 }}>
                {items.length === 0 && <div style={{ fontSize: 10, color: "#cbd5e1", padding: "6px 4px" }}>할 일 없음</div>}
                {items.map((t) => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 6px", borderRadius: 6, marginBottom: 3, background: "#fff", border: "1px solid #f1f5f9" }}>
                    <input type="checkbox" checked={t.done} onChange={() => toggle(t)} style={{ accentColor: col.color, cursor: "pointer", flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 11, color: t.done ? "#94a3b8" : "#334155", textDecoration: t.done ? "line-through" : "none", wordBreak: "break-word" }}>{t.text}</span>
                    <span onClick={() => del(t)} title="삭제" style={{ cursor: "pointer", color: "#cbd5e1", fontSize: 12, flexShrink: 0 }}>✕</span>
                  </div>
                ))}
              </div>
              <div style={{ padding: 6, borderTop: "1px solid #e2e8f0", flexShrink: 0 }}>
                <input
                  value={drafts[col.id] || ""}
                  onChange={(e) => setDrafts((p) => ({ ...p, [col.id]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") add(col.id); }}
                  placeholder="+ 할 일 입력 후 Enter"
                  style={{ width: "100%", boxSizing: "border-box", border: "1px solid #e2e8f0", borderRadius: 6, padding: "5px 7px", fontSize: 10.5, outline: "none", color: "#1e293b" }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
