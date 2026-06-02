import { useState, useEffect } from "react";

const API = "";

export default function NodeComments({ pid, nodeId }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    if (!pid || !nodeId) return;
    fetch(`${API}/api/data/projects/${pid}/nodes/${nodeId}`)
      .then(r => r.json())
      .then(data => setComments(data.comments || []))
      .catch(() => {});
  }, [pid, nodeId]);

  const handleAdd = async () => {
    if (!text.trim() || !author.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API}/api/data/projects/${pid}/nodes/${nodeId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.trim(), author: author.trim() }),
        }
      );
      const updated = await res.json();
      setComments(updated.comments || []);
      setText("");
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleDelete = async (cid) => {
    if (confirmDeleteId !== cid) {
      setConfirmDeleteId(cid);
      return;
    }
    try {
      const res = await fetch(
        `${API}/api/data/projects/${pid}/nodes/${nodeId}/comments/${cid}`,
        { method: "DELETE" }
      );
      const updated = await res.json();
      setComments(updated.comments || []);
      setConfirmDeleteId(null);
    } catch (e) { console.error(e); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* 댓글 목록 */}
      {comments.length === 0 && (
        <div style={{ color: "#94a3b8", fontSize: 12, textAlign: "center", padding: "16px 0" }}>
          댓글이 없습니다
        </div>
      )}
      {comments.map(c => (
        <div key={c.id} style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 10px", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 12, color: "#1e293b" }}>{c.author}</span>
            <span style={{ fontSize: 10, color: "#94a3b8" }}>{new Date(c.createdAt).toLocaleString("ko-KR")}</span>
            {confirmDeleteId === c.id ? (
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
                <span style={{ fontSize: 10, color: "#dc2626" }}>삭제?</span>
                <button
                  onClick={() => handleDelete(c.id)}
                  style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, border: "none", background: "#dc2626", color: "#fff", cursor: "pointer" }}
                >확인</button>
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", cursor: "pointer" }}
                >취소</button>
              </div>
            ) : (
              <button
                onClick={() => handleDelete(c.id)}
                style={{ marginLeft: "auto", background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 12, padding: "0 2px" }}
              >✕</button>
            )}
          </div>
          <div style={{ fontSize: 13, color: "#334155", whiteSpace: "pre-wrap" }}>{c.text}</div>
        </div>
      ))}
      {/* 입력창 */}
      <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 10 }}>
        <input
          placeholder="이름"
          value={author}
          onChange={e => setAuthor(e.target.value)}
          style={{ width: "100%", marginBottom: 6, padding: "6px 8px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, boxSizing: "border-box" }}
        />
        <textarea
          placeholder="댓글을 입력하세요"
          value={text}
          onChange={e => setText(e.target.value)}
          rows={3}
          style={{ width: "100%", marginBottom: 6, padding: "6px 8px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, resize: "vertical", boxSizing: "border-box" }}
        />
        <button
          onClick={handleAdd}
          disabled={loading || !text.trim() || !author.trim()}
          style={{ padding: "6px 14px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer", opacity: (loading || !text.trim() || !author.trim()) ? 0.5 : 1 }}
        >
          댓글 추가
        </button>
      </div>
    </div>
  );
}
