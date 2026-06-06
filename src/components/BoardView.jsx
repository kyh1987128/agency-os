import { useState, useEffect, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

const API = "";

// ── 유틸 ──────────────────────────────────────────────────────────────────
function ytId(url) { const m = (url || "").match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/); return m ? m[1] : null; }
function ytIframe(id) { return `<iframe width="100%" height="300" src="https://www.youtube.com/embed/${id}" frameborder="0" allowfullscreen style="border-radius:8px;border:1px solid #e2e8f0;margin:8px 0"></iframe>`; }
function preprocess(body) {
  let s = body || "";
  const stash = [];
  s = s.replace(/```[\s\S]*?```|`[^`\n]*`/g, (m) => { stash.push(m); return `@@C${stash.length - 1}@@`; });
  s = s.replace(/\{\{youtube:([\w-]{11})\}\}/g, (_, id) => ytIframe(id));
  s = s.replace(/^(https?:\/\/\S*(?:youtu\.be|youtube\.com)\/\S+)\s*$/gim, (m, url) => { const id = ytId(url); return id ? ytIframe(id) : m; });
  s = s.replace(/\[\[([^\]]+)\]\]/g, (_, t) => `[📖 ${t.trim()}](#wiki)`);
  s = s.replace(/@@C(\d+)@@/g, (_, i) => stash[+i]);
  return s;
}
const md = {
  h1: (p) => <div style={{ fontSize: 19, fontWeight: 800, margin: "12px 0 6px", color: "#1e293b" }} {...p} />,
  h2: (p) => <div style={{ fontSize: 16, fontWeight: 700, margin: "12px 0 5px", color: "#1e293b", borderBottom: "1px solid #f1f5f9", paddingBottom: 3 }} {...p} />,
  h3: (p) => <div style={{ fontSize: 14, fontWeight: 700, margin: "10px 0 4px", color: "#334155" }} {...p} />,
  p: (p) => <p style={{ margin: "8px 0", lineHeight: 1.85, fontSize: 14, color: "#334155" }} {...p} />,
  li: (p) => <li style={{ margin: "3px 0", lineHeight: 1.7, fontSize: 14, color: "#334155" }} {...p} />,
  strong: (p) => <strong style={{ fontWeight: 700, color: "#0f172a" }} {...p} />,
  img: ({ src, alt }) => <img src={src} alt={alt} style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid #e2e8f0", margin: "8px 0" }} />,
  table: (p) => <div style={{ overflowX: "auto", margin: "8px 0" }}><table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }} {...p} /></div>,
  th: (p) => <th style={{ border: "1px solid #e2e8f0", background: "#f8fafc", padding: "7px 10px", textAlign: "left", fontWeight: 700 }} {...p} />,
  td: (p) => <td style={{ border: "1px solid #e2e8f0", padding: "7px 10px" }} {...p} />,
  code: (p) => <code style={{ background: "#f1f5f9", padding: "1px 5px", borderRadius: 4, fontSize: 13, color: "#db2777" }} {...p} />,
  blockquote: (p) => <blockquote style={{ borderLeft: "3px solid #c7d2fe", margin: "8px 0", paddingLeft: 12, color: "#64748b" }} {...p} />,
  a: ({ href, children }) => href === "#wiki"
    ? <a style={{ color: "#4338ca", background: "#eef2ff", padding: "1px 5px", borderRadius: 4, textDecoration: "none", fontWeight: 600 }}>{children}</a>
    : <a href={href} target="_blank" rel="noreferrer" style={{ color: "#2563eb" }}>{children}</a>,
};
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" }).replace(/\.$/, "") : "";
const fmtFull = (d) => d ? new Date(d).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

// ── 메인 ──────────────────────────────────────────────────────────────────
export default function BoardView({ humans = [], activeProject = "default" }) {
  const [boards, setBoards] = useState([]);
  const [me, setMe] = useState(() => { try { return JSON.parse(localStorage.getItem("boardMe")); } catch { return null; } });
  const [activeBoard, setActiveBoard] = useState(null);
  const [view, setView] = useState("list"); // list | detail | write
  const [selPostId, setSelPostId] = useState(null);
  const [notis, setNotis] = useState([]);
  const [showNoti, setShowNoti] = useState(false);
  const [creatingBoard, setCreatingBoard] = useState(false);
  const [gq, setGq] = useState("");           // 통합검색어
  const [gres, setGres] = useState(null);     // 통합검색 결과

  const loadBoards = () => fetch(`${API}/api/boards`).then((r) => r.json()).then((d) => setBoards(d)).catch(() => {});
  const goHome = () => { setActiveBoard(null); setView("list"); setSelPostId(null); setCreatingBoard(false); setGq(""); setGres(null); };
  useEffect(() => { loadBoards(); }, []);
  useEffect(() => { if (!me && humans.length) { setMe(humans[0]); localStorage.setItem("boardMe", JSON.stringify(humans[0])); } }, [humans]);
  const loadNotis = () => { if (me) fetch(`${API}/api/notifications/${me.id}`).then((r) => r.json()).then((d) => setNotis(Array.isArray(d) ? d : [])).catch(() => {}); };
  useEffect(() => { loadNotis(); const t = setInterval(loadNotis, 15000); return () => clearInterval(t); }, [me]);
  useEffect(() => {
    const q = gq.trim();
    if (q.length < 2) { setGres(null); return; }
    const t = setTimeout(() => fetch(`${API}/api/search/all?q=${encodeURIComponent(q)}`).then((r) => r.json()).then(setGres).catch(() => {}), 350);
    return () => clearTimeout(t);
  }, [gq]);

  const board = boards.find((b) => b.id === activeBoard) || null;
  const unread = notis.filter((n) => !n.read).length;
  const setMeBy = (h) => { setMe(h); localStorage.setItem("boardMe", JSON.stringify(h)); };
  const goBoard = (id) => { setActiveBoard(id); setView("list"); setSelPostId(null); setCreatingBoard(false); };
  const openPost = (id) => { setSelPostId(id); setView("detail"); };

  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0, background: "#f8fafc", position: "relative" }}>
      {/* 사이드바 */}
      <div style={{ width: 240, flexShrink: 0, background: "#fff", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 8 }}>
          <span onClick={goHome} style={{ fontSize: 14, fontWeight: 800, color: "#1e293b", cursor: "pointer" }}>📋 게시판 홈</span>
          <button onClick={() => { setShowNoti((v) => !v); }} style={{ marginLeft: "auto", position: "relative", border: "none", background: "transparent", cursor: "pointer", fontSize: 16 }}>
            🔔{unread > 0 && <span style={{ position: "absolute", top: -4, right: -6, background: "#ef4444", color: "#fff", fontSize: 9, borderRadius: 8, padding: "0 4px", fontWeight: 700 }}>{unread}</span>}
          </button>
        </div>
        {/* 나 */}
        <div style={{ padding: "8px 14px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
          <span style={{ color: "#94a3b8" }}>나:</span>
          <select value={me?.id || ""} onChange={(e) => setMeBy(humans.find((h) => h.id === e.target.value))} style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 6px", fontSize: 11.5, color: "#334155" }}>
            {humans.map((h) => <option key={h.id} value={h.id}>{h.avatar} {h.name}</option>)}
          </select>
        </div>
        <div style={{ padding: "7px 12px", borderBottom: "1px solid #f1f5f9" }}>
          <input value={gq} onChange={(e) => setGq(e.target.value)} placeholder="🔍 통합검색 (게시판·위키·드라이브)" style={{ width: "100%", boxSizing: "border-box", border: "1px solid #e2e8f0", borderRadius: 7, padding: "6px 10px", fontSize: 11.5, outline: "none", color: "#1e293b" }} />
        </div>
        <div style={{ padding: "8px 10px" }}>
          <button onClick={() => { setCreatingBoard(true); setView("list"); }} style={{ width: "100%", background: "#eef2ff", color: "#4338ca", border: "1px dashed #c7d2fe", borderRadius: 7, padding: "7px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ 게시판 만들기</button>
        </div>
        <div className="board-scroll" style={{ flex: 1, overflowY: "auto", padding: "0 6px 16px", minHeight: 0 }}>
          {Object.entries(boards.filter((b) => !b.hidden).reduce((m, b) => { (m[b.group || "기타"] ||= []).push(b); return m; }, {})).map(([g, list]) => (
            <div key={g} style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, color: "#64748b", padding: "6px 8px 2px", letterSpacing: 0.8, display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 3, height: 9, borderRadius: 2, background: "#c7d2fe", display: "inline-block" }} />{g}</div>
              {list.map((b) => (
                <div key={b.id} onClick={() => goBoard(b.id)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 9px", borderRadius: 7, cursor: "pointer", background: activeBoard === b.id && view !== "write" && !creatingBoard ? "#eef2ff" : "transparent", color: activeBoard === b.id ? "#4338ca" : "#334155", fontSize: 12.5, fontWeight: activeBoard === b.id ? 700 : 500 }}>
                  <span>{b.icon}</span><span>{b.name}</span>
                  {b.type === "request" && <span style={{ marginLeft: "auto", fontSize: 8, background: "#dcfce7", color: "#16a34a", padding: "1px 5px", borderRadius: 6 }}>요청</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* 본문 */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {gres && gq.trim().length >= 2 ? (
          <SearchResults gres={gres} q={gq} onOpenPost={(boardId, postId) => { setActiveBoard(boardId); setGq(""); setGres(null); openPost(postId); }} onClear={() => { setGq(""); setGres(null); }} />
        ) : creatingBoard ? (
          <NewBoardForm onCreate={async (data) => { await fetch(`${API}/api/boards`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); setCreatingBoard(false); loadBoards(); }} onCancel={() => setCreatingBoard(false)} />
        ) : !board ? (
          <BoardHome onOpen={goBoard} onOpenPost={(boardId, postId) => { setActiveBoard(boardId); openPost(postId); }} />
        ) : view === "write" ? (
          <PostWrite board={board} me={me} humans={humans} onCancel={() => setView("list")} onDone={(p) => { setView("detail"); setSelPostId(p.id); }} />
        ) : view === "detail" && selPostId ? (
          <PostDetail postId={selPostId} board={board} me={me} humans={humans} activeProject={activeProject} onBack={() => setView("list")} onDeleted={() => setView("list")} onEdit={() => setView("write")} />
        ) : (
          <PostList board={board} me={me} onOpen={openPost} onWrite={() => setView("write")} />
        )}
      </div>

      {showNoti && <NotiDropdown notis={notis} onClose={() => setShowNoti(false)} onRead={async () => { await fetch(`${API}/api/notifications/${me.id}/read`, { method: "POST" }); loadNotis(); }} onOpen={(n) => { setShowNoti(false); if (n.boardId) setActiveBoard(n.boardId); openPost(n.postId); }} />}
    </div>
  );
}

// ── 글 목록 (여유 표 + 페이지네이션) ──────────────────────────────────────────
function PostList({ board, me, onOpen, onWrite }) {
  const [data, setData] = useState({ pinned: [], posts: [], total: 0, page: 1, pages: 1 });
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("전체");   // 전체 | 개념 | 공지
  const [flair, setFlair] = useState("");          // 말머리
  const [size, setSize] = useState(50);
  const [mode, setMode] = useState("list");
  const [kb, setKb] = useState([]);
  const isReq = board.type === "request";

  const load = () => fetch(`${API}/api/boards/${board.id}/posts?page=${page}&size=${size}&q=${encodeURIComponent(query)}&filter=${encodeURIComponent(filter)}&flair=${encodeURIComponent(flair)}`).then((r) => r.json()).then(setData).catch(() => {});
  useEffect(() => { load(); }, [board.id, page, query, filter, flair, size]);
  useEffect(() => { setPage(1); setFilter("전체"); setFlair(""); setMode("list"); setQ(""); setQuery(""); }, [board.id]);
  useEffect(() => { if (isReq && mode === "kanban") fetch(`${API}/api/boards/${board.id}/posts?size=200`).then((r) => r.json()).then((d) => setKb([...d.pinned, ...d.posts])).catch(() => {}); }, [board.id, mode]);

  const Row = ({ p, pinned }) => (
    <div onClick={() => onOpen(p.id)} style={{ display: "flex", alignItems: "center", borderBottom: "1px solid #f1f5f9", cursor: "pointer", background: pinned ? "#fffbeb" : "#fff", fontSize: 13 }}
      onMouseEnter={(e) => e.currentTarget.style.background = pinned ? "#fef3c7" : "#f6f8fb"} onMouseLeave={(e) => e.currentTarget.style.background = pinned ? "#fffbeb" : "#fff"}>
      <span style={{ width: 50, textAlign: "center", fontSize: 11.5, color: pinned ? "#d97706" : "#cbd5e1", fontWeight: pinned ? 700 : 400, flexShrink: 0, padding: "9px 0" }}>{pinned ? "공지" : p.no}</span>
      <span style={{ width: 64, textAlign: "center", flexShrink: 0 }}>{p.flair && <span style={{ fontSize: 10.5, color: pinned ? "#d97706" : "#6366f1", background: pinned ? "#fef3c7" : "#eef2ff", padding: "1px 7px", borderRadius: 5 }}>{p.flair}</span>}</span>
      <div style={{ flex: 1, minWidth: 0, padding: "9px 8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        <span style={{ color: "#1e293b", fontWeight: pinned ? 700 : 500 }}>{p.title}</span>
        {p.commentCount > 0 && <span style={{ marginLeft: 6, fontSize: 12, color: "#ef4444", fontWeight: 700 }}>[{p.commentCount}]</span>}
        {p.attachments?.length > 0 && <span style={{ marginLeft: 5, fontSize: 11 }}>📎</span>}
        {isReq && p.status && <span style={{ marginLeft: 7, fontSize: 9.5, background: p.status === "완료" ? "#dcfce7" : p.status === "진행" ? "#dbeafe" : "#fef9c3", color: p.status === "완료" ? "#16a34a" : p.status === "진행" ? "#2563eb" : "#a16207", padding: "1px 7px", borderRadius: 8, fontWeight: 700 }}>{p.status}</span>}
      </div>
      <span style={{ width: 92, fontSize: 12, color: "#475569", flexShrink: 0, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.authorAvatar} {p.authorName}</span>
      <span style={{ width: 54, fontSize: 11.5, color: "#94a3b8", flexShrink: 0, textAlign: "center" }}>{fmtDate(p.createdAt)}</span>
      <span style={{ width: 46, fontSize: 11.5, color: "#94a3b8", flexShrink: 0, textAlign: "center" }}>{p.views || 0}</span>
      <span style={{ width: 46, fontSize: 11.5, color: (p.likes?.length >= 3) ? "#ef4444" : "#cbd5e1", fontWeight: (p.likes?.length >= 3) ? 700 : 400, flexShrink: 0, textAlign: "center" }}>{p.likes?.length || 0}</span>
    </div>
  );
  const Tab = ({ id, label }) => <button onClick={() => { setFilter(id); setPage(1); }} style={{ border: "none", borderBottom: "2px solid " + (filter === id ? "#6366f1" : "transparent"), background: "transparent", color: filter === id ? "#4338ca" : "#94a3b8", padding: "9px 14px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>{label}</button>;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "2px 16px 0", borderBottom: "1px solid #e2e8f0" }}>
        <span style={{ fontSize: 15, marginRight: 6 }}>{board.icon}</span>
        <Tab id="전체" label="전체글" /><Tab id="개념" label="개념글" /><Tab id="공지" label="공지" />
        <div style={{ marginLeft: "auto", display: "flex", gap: 7, alignItems: "center", paddingBottom: 4 }}>
          {isReq && <div style={{ display: "flex", border: "1px solid #e2e8f0", borderRadius: 7, overflow: "hidden" }}>
            {[["list", "목록"], ["kanban", "칸반"]].map(([m, l]) => <button key={m} onClick={() => setMode(m)} style={{ border: "none", background: mode === m ? "#6366f1" : "#fff", color: mode === m ? "#fff" : "#64748b", padding: "5px 10px", fontSize: 11.5, cursor: "pointer", fontWeight: 700 }}>{l}</button>)}
          </div>}
          <select value={size} onChange={(e) => { setSize(+e.target.value); setPage(1); }} style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "5px", fontSize: 11.5, color: "#475569" }}>{[30, 50, 100].map((s) => <option key={s} value={s}>{s}개</option>)}</select>
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { setQuery(q); setPage(1); } }} placeholder="🔍 검색" style={{ border: "1px solid #e2e8f0", borderRadius: 7, padding: "5px 9px", fontSize: 12, outline: "none", width: 130, color: "#1e293b" }} />
          <button onClick={onWrite} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 7, padding: "6px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>✏ 글쓰기</button>
        </div>
      </div>
      {(board.flairs || []).length > 0 && mode === "list" && filter === "전체" && (
        <div style={{ display: "flex", gap: 5, padding: "7px 16px", borderBottom: "1px solid #f1f5f9", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#cbd5e1", marginRight: 2 }}>말머리</span>
          {["", ...board.flairs].map((f) => <span key={f || "all"} onClick={() => { setFlair(f); setPage(1); }} style={{ fontSize: 11.5, padding: "3px 11px", borderRadius: 12, cursor: "pointer", background: flair === f ? "#6366f1" : "#f1f5f9", color: flair === f ? "#fff" : "#64748b", fontWeight: flair === f ? 700 : 500 }}>{f || "전체"}</span>)}
        </div>
      )}
      {!(isReq && mode === "kanban") && (
        <div style={{ display: "flex", alignItems: "center", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>
          <span style={{ width: 50, textAlign: "center", padding: "7px 0" }}>번호</span>
          <span style={{ width: 64, textAlign: "center" }}>말머리</span>
          <span style={{ flex: 1, padding: "0 8px" }}>제목</span>
          <span style={{ width: 92, textAlign: "center" }}>글쓴이</span>
          <span style={{ width: 54, textAlign: "center" }}>작성일</span>
          <span style={{ width: 46, textAlign: "center" }}>조회</span>
          <span style={{ width: 46, textAlign: "center" }}>추천</span>
        </div>
      )}
      {isReq && mode === "kanban" ? (
        <div style={{ flex: 1, display: "flex", gap: 12, padding: 16, overflowX: "auto", minHeight: 0, background: "#f8fafc" }}>
          {["요청", "진행", "완료"].map((st) => {
            const items = kb.filter((p) => (p.status || "요청") === st);
            return (
              <div key={st} style={{ flex: "1 1 0", minWidth: 220, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, display: "flex", flexDirection: "column", minHeight: 0 }}>
                <div style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9", fontSize: 12.5, fontWeight: 700, color: st === "완료" ? "#16a34a" : st === "진행" ? "#2563eb" : "#a16207" }}>{st} <span style={{ color: "#cbd5e1" }}>{items.length}</span></div>
                <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
                  {items.map((p) => <div key={p.id} onClick={() => onOpen(p.id)} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 11px", marginBottom: 6, cursor: "pointer", background: "#fff" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{p.title}</div>
                    <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 4 }}>{p.authorAvatar} {p.authorName}{p.dueDate ? ` · ~${p.dueDate}` : ""}{p.commentCount ? ` · 💬${p.commentCount}` : ""}</div>
                  </div>)}
                  {items.length === 0 && <div style={{ fontSize: 10.5, color: "#cbd5e1", textAlign: "center", padding: "10px 0" }}>없음</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {data.pinned.map((p) => <Row key={p.id} p={p} pinned />)}
          {data.posts.map((p) => <Row key={p.id} p={p} />)}
          {data.posts.length === 0 && data.pinned.length === 0 && <div style={{ textAlign: "center", color: "#cbd5e1", fontSize: 13, padding: "50px 0" }}>아직 글이 없습니다. 첫 글을 써보세요!</div>}
        </div>
      )}
      {mode === "list" && data.pages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 4, padding: "12px", borderTop: "1px solid #f1f5f9" }}>
          {Array.from({ length: data.pages }, (_, i) => i + 1).map((n) => (
            <button key={n} onClick={() => setPage(n)} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid " + (page === n ? "#6366f1" : "#e2e8f0"), background: page === n ? "#6366f1" : "#fff", color: page === n ? "#fff" : "#64748b", cursor: "pointer", fontSize: 12, fontWeight: page === n ? 700 : 400 }}>{n}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 글 상세 ────────────────────────────────────────────────────────────────────
function PostDetail({ postId, board, me, humans, activeProject, onBack, onDeleted, onEdit }) {
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [ctext, setCtext] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [kanbanMsg, setKanbanMsg] = useState("");

  const load = () => fetch(`${API}/api/posts/${postId}`).then((r) => r.json()).then(setPost).catch(() => {});
  const loadC = () => fetch(`${API}/api/posts/${postId}/comments`).then((r) => r.json()).then((d) => setComments(Array.isArray(d) ? d : [])).catch(() => {});
  useEffect(() => { load(); loadC(); }, [postId]);
  if (!post) return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>불러오는 중…</div>;

  const mine = post.authorId === me?.id;
  const liked = (post.likes || []).includes(me?.id);
  const read = (post.readBy || []).includes(me?.id);
  const toggleLike = async () => { const r = await (await fetch(`${API}/api/posts/${postId}/like`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: me?.id }) })).json(); setPost((p) => ({ ...p, likes: liked ? (p.likes || []).filter((x) => x !== me.id) : [...(p.likes || []), me.id] })); };
  const markRead = async () => { await fetch(`${API}/api/posts/${postId}/read`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: me?.id }) }); load(); };
  const togglePin = async () => { await fetch(`${API}/api/posts/${postId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pinned: !post.pinned }) }); load(); };
  const setStatus = async (s) => { await fetch(`${API}/api/posts/${postId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: s }) }); load(); };
  const toKanban = async () => { try { await fetch(`${API}/api/projects/${activeProject}/kanban/cards`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: post.title, desc: (post.body || "") + `\n\n📋 게시판 업무요청: ${board.name}`, column: "todo", projectId: activeProject }) }); setKanbanMsg("✅ 칸반에 추가됨"); setTimeout(() => setKanbanMsg(""), 2500); } catch {} };
  const del = async () => { await fetch(`${API}/api/posts/${postId}`, { method: "DELETE" }); onDeleted(); };
  const submitComment = async () => {
    if (!ctext.trim()) return;
    const mentions = (ctext.match(/@(\S+)/g) || []).map((m) => humans.find((h) => h.name === m.slice(1))?.id).filter(Boolean);
    await fetch(`${API}/api/posts/${postId}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: ctext, authorId: me?.id, authorName: me?.name, authorAvatar: me?.avatar, mentions }) });
    setCtext(""); loadC();
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", minHeight: 0, background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 20px", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
        <button onClick={onBack} style={btn}>← 목록</button>
        <span style={{ fontSize: 12, color: "#94a3b8" }}>{board.icon} {board.name}</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button onClick={togglePin} style={{ ...btn, background: post.pinned ? "#fef9c3" : "#fff" }}>📌 {post.pinned ? "고정해제" : "고정"}</button>
          {mine && <button onClick={onEdit} style={{ ...btn, color: "#4338ca", borderColor: "#c7d2fe" }}>✏ 수정</button>}
          {mine && (confirmDel
            ? <><button onClick={del} style={{ ...btn, background: "#dc2626", color: "#fff", border: "none" }}>삭제확인</button><button onClick={() => setConfirmDel(false)} style={btn}>취소</button></>
            : <button onClick={() => setConfirmDel(true)} style={{ ...btn, color: "#dc2626", borderColor: "#fecaca" }}>🗑</button>)}
        </span>
      </div>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "20px 24px 50px" }}>
        <div style={{ fontSize: 21, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>
          {post.flair && <span style={{ fontSize: 13, color: "#4338ca", background: "#eef2ff", padding: "2px 10px", borderRadius: 7, marginRight: 8, verticalAlign: "middle", fontWeight: 700 }}>{post.flair}</span>}
          {(post.likes?.length >= 3) && <span style={{ fontSize: 12, color: "#fff", background: "#ef4444", padding: "2px 8px", borderRadius: 7, marginRight: 8, verticalAlign: "middle", fontWeight: 700 }}>개념</span>}
          {post.title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#94a3b8", paddingBottom: 12, borderBottom: "1px solid #f1f5f9", marginBottom: 16, flexWrap: "wrap" }}>
          <span style={{ color: "#475569", fontWeight: 600 }}>{post.authorAvatar} {post.authorName}</span>
          <span>· {fmtFull(post.createdAt)}</span><span>· 👁 {post.views}</span>
          {board.type === "request" && (
            <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>상태
              <select value={post.status || "요청"} onChange={(e) => setStatus(e.target.value)} style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "2px 6px", fontSize: 11 }}>
                <option>요청</option><option>진행</option><option>완료</option>
              </select>
              {kanbanMsg ? <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 700 }}>{kanbanMsg}</span>
                : <button onClick={toKanban} style={{ border: "1px solid #c7d2fe", background: "#eef2ff", color: "#4338ca", borderRadius: 6, padding: "3px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>📌 칸반 카드로</button>}
            </span>
          )}
          {(post.tags || []).map((t) => <span key={t} style={{ background: "#f1f5f9", padding: "1px 7px", borderRadius: 8, color: "#64748b" }}>#{t}</span>)}
        </div>

        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={md}>{preprocess(post.body)}</ReactMarkdown>

        {/* 첨부 */}
        {(post.attachments || []).length > 0 && (
          <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {post.attachments.map((f, i) => f.mime?.startsWith("image/")
              ? <a key={i} href={f.url} target="_blank" rel="noreferrer"><img src={f.url} alt={f.name} style={{ height: 90, borderRadius: 8, border: "1px solid #e2e8f0" }} /></a>
              : <a key={i} href={f.url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 5, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 12px", fontSize: 12, color: "#4338ca", textDecoration: "none" }}>📎 {f.name}</a>)}
          </div>
        )}
        {(post.driveRefs || []).length > 0 && (
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {post.driveRefs.map((d, i) => <span key={i} style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 8, padding: "6px 11px", fontSize: 12, color: "#047857" }}>📁 {d.name}</span>)}
          </div>
        )}

        {/* 필독확인 / 좋아요 */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 24, padding: "14px 0", borderTop: "1px solid #f1f5f9" }}>
          {board.mustRead && (
            <span style={{ fontSize: 12, color: "#64748b" }}>✅ 필독확인 <b>{(post.readBy || []).length}</b>명
              {!read && <button onClick={markRead} style={{ marginLeft: 8, background: "#16a34a", color: "#fff", border: "none", borderRadius: 7, padding: "5px 12px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>나 확인했어요</button>}
              {read && <span style={{ marginLeft: 8, color: "#16a34a", fontWeight: 700 }}>✓ 확인함</span>}
            </span>
          )}
          <button onClick={toggleLike} style={{ marginLeft: "auto", border: "1px solid " + (liked ? "#fca5a5" : "#e2e8f0"), background: liked ? "#fef2f2" : "#fff", color: liked ? "#dc2626" : "#64748b", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>♥ {(post.likes || []).length}</button>
        </div>

        {/* 댓글 */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 10 }}>💬 댓글 {comments.length}</div>
          {comments.map((c) => (
            <div key={c.id} style={{ display: "flex", gap: 9, padding: "10px 0", borderBottom: "1px solid #f8fafc", marginLeft: c.parentId ? 28 : 0 }}>
              <span style={{ fontSize: 18 }}>{c.authorAvatar}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, marginBottom: 2 }}><b style={{ color: "#1e293b" }}>{c.authorName}</b> <span style={{ color: "#cbd5e1", fontSize: 11 }}>{fmtFull(c.createdAt)}</span></div>
                <div style={{ fontSize: 13.5, color: "#334155", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{c.body.replace(/@(\S+)/g, (m) => m)}</div>
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <input value={ctext} onChange={(e) => setCtext(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submitComment(); }} placeholder="댓글 입력… (@이름 으로 멘션)" style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 12px", fontSize: 13, outline: "none", color: "#1e293b" }} />
            <button onClick={submitComment} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>등록</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 글 작성 (리치 에디터) ────────────────────────────────────────────────────────
function PostWrite({ board, me, humans, onCancel, onDone }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [flair, setFlair] = useState((board.flairs && board.flairs[0]) || "");
  const [anonymous, setAnonymous] = useState(board.anonymous);
  const [attachments, setAttachments] = useState([]);
  const [driveRefs, setDriveRefs] = useState([]);
  const [driveOpen, setDriveOpen] = useState(false);
  const taRef = useRef(); const fileRef = useRef();

  const ins = (t) => { const ta = taRef.current; if (!ta) { setBody((b) => b + t); return; } const s = ta.selectionStart, e = ta.selectionEnd, v = body; setBody(v.slice(0, s) + t + v.slice(e)); requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = s + t.length; }); };
  const wrap = (a, b = a) => { const ta = taRef.current; if (!ta) return; const s = ta.selectionStart, e = ta.selectionEnd, sel = body.slice(s, e) || "텍스트"; setBody(body.slice(0, s) + a + sel + b + body.slice(e)); };
  const upload = async (file) => { const fd = new FormData(); fd.append("file", file); try { const j = await (await fetch(`${API}/api/upload`, { method: "POST", body: fd })).json(); if (j.ok) { if (j.mime?.startsWith("image/")) ins(`\n![${j.name}](${j.url})\n`); setAttachments((p) => [...p, j]); } } catch {} };
  const onPaste = (e) => { const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith("image/")); if (f) { e.preventDefault(); upload(f); } };
  const onDrop = (e) => { e.preventDefault(); [...(e.dataTransfer?.files || [])].forEach(upload); };
  const addYoutube = () => { const u = prompt("유튜브 링크"); if (!u) return; const id = ytId(u) || (/^[\w-]{11}$/.test(u) ? u : null); if (id) ins(`\n{{youtube:${id}}}\n`); };
  const addLinkCard = async () => { const u = prompt("링크 URL"); if (!u) return; try { const og = await (await fetch(`${API}/api/link-preview?url=${encodeURIComponent(u)}`)).json(); ins(`\n<a href="${og.url}" target="_blank" style="display:flex;gap:10px;border:1px solid #e2e8f0;border-radius:10px;padding:10px;margin:8px 0;text-decoration:none;background:#fff;max-width:480px">${og.image ? `<img src="${og.image}" style="width:80px;height:80px;object-fit:cover;border-radius:7px"/>` : ""}<span><b style="color:#1e293b;font-size:13px">${og.title || og.url}</b><br><span style="color:#64748b;font-size:11.5px">${og.description || ""}</span><br><span style="color:#94a3b8;font-size:10px">🔗 ${og.site || og.url}</span></span></a>\n`); } catch {} };

  const submit = async () => {
    if (!title.trim()) { alert("제목을 입력하세요"); return; }
    const p = await (await fetch(`${API}/api/boards/${board.id}/posts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, body, flair, tags: tags.split(",").map((t) => t.trim()).filter(Boolean), anonymous, authorId: me?.id, authorName: me?.name, authorAvatar: me?.avatar, attachments, driveRefs, mentions: (body.match(/@(\S+)/g) || []).map((m) => humans.find((h) => h.name === m.slice(1))?.id).filter(Boolean) }) })).json();
    onDone(p);
  };
  const TB = ({ l, on, t }) => <button onClick={on} title={t} style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 5, padding: "4px 8px", fontSize: 11, cursor: "pointer", color: "#475569" }}>{l}</button>;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 18px", borderBottom: "1px solid #e2e8f0", flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{board.icon} {board.name} · 글쓰기</span>
        <label style={{ marginLeft: "auto", fontSize: 11.5, color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}>{board.anonymous && <><input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} /> 익명</>}</label>
        <button onClick={onCancel} style={btn}>취소</button>
        <button onClick={submit} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 7, padding: "7px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>등록</button>
      </div>
      <div style={{ padding: "10px 18px", display: "flex", gap: 8, borderBottom: "1px solid #f1f5f9" }}>
        {(board.flairs || []).length > 0 && (
          <select value={flair} onChange={(e) => setFlair(e.target.value)} style={{ width: 96, border: "1px solid #e2e8f0", borderRadius: 7, padding: "9px 8px", fontSize: 13, fontWeight: 600, outline: "none", color: "#4338ca", background: "#f8faff" }}>
            {board.flairs.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        )}
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목" style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 7, padding: "9px 12px", fontSize: 15, fontWeight: 600, outline: "none", color: "#1e293b" }} />
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="태그(쉼표)" style={{ width: 150, border: "1px solid #e2e8f0", borderRadius: 7, padding: "9px 12px", fontSize: 12, outline: "none", color: "#1e293b" }} />
      </div>
      <div style={{ display: "flex", gap: 4, padding: "7px 18px", borderBottom: "1px solid #f1f5f9", flexWrap: "wrap", alignItems: "center" }}>
        <TB l="B" on={() => wrap("**")} /><TB l="I" on={() => wrap("*")} /><TB l="H2" on={() => ins("\n## ")} /><TB l="•" on={() => ins("\n- ")} /><TB l="☑" on={() => ins("\n- [ ] ")} /><TB l="표" on={() => ins("\n\n| a | b |\n|---|---|\n| 1 | 2 |\n")} /><TB l="❝" on={() => ins("\n> ")} />
        <TB l="🖼 이미지" on={() => fileRef.current?.click()} /><TB l="▶ 영상" on={addYoutube} /><TB l="🔗 링크카드" on={addLinkCard} /><TB l="📁 드라이브" on={() => setDriveOpen((v) => !v)} /><TB l="[[위키]]" on={() => wrap("[[", "]]")} />
        <input ref={fileRef} type="file" multiple style={{ display: "none" }} onChange={(e) => { [...e.target.files].forEach(upload); e.target.value = ""; }} />
        <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: "auto" }}>이미지 드래그&드롭·붙여넣기 가능</span>
      </div>
      {driveOpen && <DrivePicker onPick={(d) => { setDriveRefs((p) => [...p, d]); setDriveOpen(false); }} />}
      {(attachments.length > 0 || driveRefs.length > 0) && (
        <div style={{ padding: "8px 18px", display: "flex", gap: 6, flexWrap: "wrap", borderBottom: "1px solid #f1f5f9" }}>
          {attachments.map((f, i) => <span key={i} style={{ fontSize: 11, background: "#eef2ff", color: "#4338ca", borderRadius: 6, padding: "3px 8px" }}>📎 {f.name} <span style={{ cursor: "pointer" }} onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}>✕</span></span>)}
          {driveRefs.map((d, i) => <span key={i} style={{ fontSize: 11, background: "#ecfdf5", color: "#047857", borderRadius: 6, padding: "3px 8px" }}>📁 {d.name} <span style={{ cursor: "pointer" }} onClick={() => setDriveRefs((p) => p.filter((_, j) => j !== i))}>✕</span></span>)}
        </div>
      )}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <textarea ref={taRef} value={body} onChange={(e) => setBody(e.target.value)} onPaste={onPaste} onDrop={onDrop} placeholder="내용을 입력하세요…" style={{ flex: 1, border: "none", borderRight: "1px solid #e2e8f0", padding: "16px 18px", fontSize: 14, lineHeight: 1.8, outline: "none", resize: "none", color: "#1e293b", fontFamily: "ui-monospace,Menlo,monospace" }} />
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 20px", background: "#fafbfc" }}>
          <div style={{ fontSize: 10, color: "#cbd5e1", marginBottom: 6 }}>미리보기</div>
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={md}>{preprocess(body)}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

// 드라이브 첨부 picker
function DrivePicker({ onPick }) {
  const [q, setQ] = useState(""); const [res, setRes] = useState([]);
  useEffect(() => { if (q.trim().length < 2) { setRes([]); return; } const t = setTimeout(() => fetch(`${API}/api/drive/search?q=${encodeURIComponent(q)}&limit=6`).then((r) => r.json()).then(setRes).catch(() => {}), 300); return () => clearTimeout(t); }, [q]);
  return (
    <div style={{ padding: "10px 18px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 회사 드라이브 파일 검색" style={{ width: 280, border: "1px solid #e2e8f0", borderRadius: 7, padding: "6px 10px", fontSize: 12, outline: "none", color: "#1e293b" }} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
        {res.map((d, i) => <span key={i} onClick={() => onPick({ name: d.name, path: d.path })} style={{ fontSize: 11, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 9px", cursor: "pointer", color: "#475569" }}>{d.type === "image" ? "🖼" : d.type === "video" ? "🎬" : "📄"} {d.name}</span>)}
      </div>
    </div>
  );
}

// 새 게시판 폼
function NewBoardForm({ onCreate, onCancel }) {
  const [f, setF] = useState({ name: "", icon: "📋", color: "#6366f1", group: "기타", type: "post", writePerm: "all", anonymous: false, mustRead: false });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ flex: 1, background: "#fff", padding: 28, maxWidth: 520 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: "#1e293b", marginBottom: 18 }}>+ 새 게시판 만들기</div>
      <Field l="이름"><input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="예: 세미나 정보" style={inp} /></Field>
      <div style={{ display: "flex", gap: 10 }}>
        <Field l="아이콘"><input value={f.icon} onChange={(e) => set("icon", e.target.value)} style={{ ...inp, width: 70, textAlign: "center" }} /></Field>
        <Field l="그룹"><input value={f.group} onChange={(e) => set("group", e.target.value)} placeholder="소통/업무/자료" style={inp} /></Field>
      </div>
      <Field l="타입"><div style={{ display: "flex", gap: 8 }}>
        {[["post", "일반글"], ["request", "업무요청(담당·마감·상태)"]].map(([v, l]) => <button key={v} onClick={() => set("type", v)} style={{ flex: 1, padding: "9px", borderRadius: 7, cursor: "pointer", border: "2px solid " + (f.type === v ? "#6366f1" : "#e2e8f0"), background: f.type === v ? "#eef2ff" : "#fff", color: f.type === v ? "#4338ca" : "#64748b", fontSize: 12.5, fontWeight: 700 }}>{l}</button>)}
      </div></Field>
      <div style={{ display: "flex", gap: 16, alignItems: "center", margin: "12px 0" }}>
        <label style={{ fontSize: 12.5, color: "#475569", display: "flex", gap: 5, alignItems: "center" }}>쓰기 <select value={f.writePerm} onChange={(e) => set("writePerm", e.target.value)} style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px", fontSize: 12 }}><option value="all">전체</option><option value="admin">관리자만</option></select></label>
        <label style={{ fontSize: 12.5, color: "#475569", display: "flex", gap: 4, alignItems: "center" }}><input type="checkbox" checked={f.anonymous} onChange={(e) => set("anonymous", e.target.checked)} /> 익명 허용</label>
        <label style={{ fontSize: 12.5, color: "#475569", display: "flex", gap: 4, alignItems: "center" }}><input type="checkbox" checked={f.mustRead} onChange={(e) => set("mustRead", e.target.checked)} /> 필독확인</label>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
        <button onClick={() => f.name.trim() && onCreate(f)} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 7, padding: "9px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>만들기</button>
        <button onClick={onCancel} style={btn}>취소</button>
      </div>
    </div>
  );
}
const Field = ({ l, children }) => <div style={{ marginBottom: 12 }}><div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 5 }}>{l}</div>{children}</div>;

// 알림 드롭다운
function NotiDropdown({ notis, onClose, onRead, onOpen }) {
  return (
    <div style={{ position: "absolute", top: 50, left: 200, width: 300, maxHeight: 400, overflowY: "auto", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.15)", zIndex: 100 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid #f1f5f9" }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "#1e293b" }}>🔔 알림</span>
        <span style={{ display: "flex", gap: 8 }}><span onClick={onRead} style={{ fontSize: 11, color: "#6366f1", cursor: "pointer" }}>모두 읽음</span><span onClick={onClose} style={{ cursor: "pointer", color: "#cbd5e1" }}>✕</span></span>
      </div>
      {notis.length === 0 && <div style={{ padding: 20, textAlign: "center", color: "#cbd5e1", fontSize: 12 }}>알림이 없습니다</div>}
      {notis.map((n) => (
        <div key={n.id} onClick={() => onOpen(n)} style={{ padding: "10px 14px", borderBottom: "1px solid #f8fafc", cursor: "pointer", background: n.read ? "#fff" : "#eff6ff" }}>
          <div style={{ fontSize: 12, color: "#334155" }}>{n.type === "comment" ? "💬" : n.type === "mention" ? "@" : "📢"} {n.text}</div>
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{fmtFull(n.createdAt)}</div>
        </div>
      ))}
    </div>
  );
}

// 게시판 홈 — 카드 그리드 (왼쪽 리스트 대신 직관적인 진입)
function BoardHome({ onOpen, onOpenPost }) {
  const [boards, setBoards] = useState([]);
  const [recent, setRecent] = useState([]);
  const [feedView, setFeedView] = useState("전체");  // 전체 | 베스트
  useEffect(() => {
    fetch(`${API}/api/boards/summary`).then((r) => r.json()).then((d) => setBoards(Array.isArray(d) ? d : [])).catch(() => {});
    fetch(`${API}/api/posts/recent?limit=60`).then((r) => r.json()).then((d) => setRecent(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);
  const groups = boards.reduce((m, b) => { (m[b.group || "기타"] = m[b.group || "기타"] || []).push(b); return m; }, {});
  const ranked = [...boards].sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 8);
  const best = [...recent].filter((p) => (p.likes || 0) >= 3).sort((a, b) => (b.likes || 0) - (a.likes || 0));
  const feed = feedView === "베스트" ? best : recent;

  const FeedRow = ({ p }) => (
    <div onClick={() => onOpenPost(p.boardId, p.id)} style={{ display: "flex", alignItems: "center", borderBottom: "1px solid #f1f5f9", cursor: "pointer", fontSize: 13, background: "#fff" }}
      onMouseEnter={(e) => e.currentTarget.style.background = "#f6f8fb"} onMouseLeave={(e) => e.currentTarget.style.background = "#fff"}>
      <span style={{ width: 118, flexShrink: 0, fontSize: 11, color: "#64748b", padding: "9px 10px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.boardIcon} {p.boardName}</span>
      <div style={{ flex: 1, minWidth: 0, padding: "9px 6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {(p.likes || 0) >= 3 && <span style={{ fontSize: 10, color: "#fff", background: "#ef4444", padding: "1px 6px", borderRadius: 5, marginRight: 6, fontWeight: 700 }}>개념</span>}
        <span style={{ color: "#1e293b", fontWeight: 500 }}>{p.title}</span>
        {p.comments > 0 && <span style={{ marginLeft: 6, fontSize: 12, color: "#ef4444", fontWeight: 700 }}>[{p.comments}]</span>}
        {p.hasThumb && <span style={{ marginLeft: 5, fontSize: 11 }}>🖼</span>}
      </div>
      <span style={{ width: 82, fontSize: 11.5, color: "#475569", flexShrink: 0, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.avatar} {p.author}</span>
      <span style={{ width: 50, fontSize: 11, color: "#94a3b8", flexShrink: 0, textAlign: "center" }}>{fmtDate(p.date)}</span>
      <span style={{ width: 38, fontSize: 11, color: "#94a3b8", flexShrink: 0, textAlign: "center" }}>{p.views}</span>
      <span style={{ width: 38, fontSize: 11, color: (p.likes >= 3) ? "#ef4444" : "#cbd5e1", fontWeight: (p.likes >= 3) ? 700 : 400, flexShrink: 0, textAlign: "center" }}>{p.likes || 0}</span>
    </div>
  );

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "#f1f5f9", padding: "16px 20px 40px" }}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", maxWidth: 1180, margin: "0 auto" }}>
        {/* 좌측: 실시간 전체글 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "4px 14px 0", borderBottom: "1px solid #e2e8f0" }}>
              <button onClick={() => setFeedView("전체")} style={{ border: "none", borderBottom: "2px solid " + (feedView === "전체" ? "#6366f1" : "transparent"), background: "transparent", color: feedView === "전체" ? "#4338ca" : "#94a3b8", padding: "10px 14px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>🔥 실시간 전체글</button>
              <button onClick={() => setFeedView("베스트")} style={{ border: "none", borderBottom: "2px solid " + (feedView === "베스트" ? "#ef4444" : "transparent"), background: "transparent", color: feedView === "베스트" ? "#dc2626" : "#94a3b8", padding: "10px 14px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>⭐ 개념글 베스트</button>
              <span style={{ marginLeft: "auto", fontSize: 10.5, color: "#cbd5e1", paddingBottom: 6 }}>추천 3개 이상 = 개념글</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontSize: 10.5, color: "#94a3b8", fontWeight: 600 }}>
              <span style={{ width: 118, padding: "6px 10px" }}>게시판</span>
              <span style={{ flex: 1, padding: "0 6px" }}>제목</span>
              <span style={{ width: 82, textAlign: "center" }}>글쓴이</span>
              <span style={{ width: 50, textAlign: "center" }}>작성일</span>
              <span style={{ width: 38, textAlign: "center" }}>조회</span>
              <span style={{ width: 38, textAlign: "center" }}>추천</span>
            </div>
            {feed.map((p) => <FeedRow key={p.id} p={p} />)}
            {feed.length === 0 && <div style={{ textAlign: "center", color: "#cbd5e1", fontSize: 13, padding: "40px 0" }}>{feedView === "베스트" ? "아직 개념글이 없습니다 (추천 3개 이상)" : "아직 글이 없습니다"}</div>}
          </div>
        </div>

        {/* 우측: 게시판 목록 + 인기 랭킹 */}
        <div style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: "#1e293b", marginBottom: 8 }}>🏆 인기 게시판</div>
            {ranked.map((b, i) => (
              <div key={b.id} onClick={() => onOpen(b.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 4px", cursor: "pointer", borderRadius: 6 }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#f6f8fb"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                <span style={{ width: 16, fontSize: 12, fontWeight: 800, color: i < 3 ? "#ef4444" : "#cbd5e1", textAlign: "center" }}>{i + 1}</span>
                <span style={{ fontSize: 14 }}>{b.icon}</span>
                <span style={{ flex: 1, fontSize: 12.5, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</span>
                <span style={{ fontSize: 10.5, color: "#94a3b8" }}>{b.count}</span>
              </div>
            ))}
          </div>
          {Object.entries(groups).map(([g, list]) => (
            <div key={g} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: "#64748b", marginBottom: 6 }}>{g}</div>
              {list.map((b) => (
                <div key={b.id} onClick={() => onOpen(b.id)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 4px", cursor: "pointer", borderRadius: 6 }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#f6f8fb"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  <span style={{ fontSize: 14 }}>{b.icon}</span>
                  <span style={{ flex: 1, fontSize: 12.5, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</span>
                  {b.secret ? <span style={{ fontSize: 9, color: "#dc2626" }}>🔒</span>
                    : b.type === "request" ? <span style={{ fontSize: 8.5, background: "#dcfce7", color: "#16a34a", padding: "1px 5px", borderRadius: 5 }}>요청</span> : null}
                  <span style={{ fontSize: 10, color: "#cbd5e1" }}>{b.count}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 통합검색 결과
function SearchResults({ gres, q, onOpenPost, onClear }) {
  const { boards = [], wiki = [], drive = [] } = gres || {};
  const total = boards.length + wiki.length + drive.length;
  const Sec = ({ title, children }) => <div style={{ marginBottom: 18 }}><div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 8 }}>{title}</div>{children}</div>;
  const rowS = { border: "1px solid #f1f5f9", borderRadius: 8, padding: "10px 12px", marginBottom: 6 };
  return (
    <div style={{ flex: 1, overflowY: "auto", background: "#fff", padding: "18px 24px" }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: "#1e293b", marginBottom: 14 }}>🔍 "{q}" 통합검색 <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 400 }}>· {total}건</span> <span onClick={onClear} style={{ marginLeft: 8, fontSize: 11, color: "#6366f1", cursor: "pointer" }}>✕ 닫기</span></div>
      {total === 0 && <div style={{ color: "#cbd5e1", fontSize: 13, padding: "30px 0", textAlign: "center" }}>결과 없음</div>}
      {boards.length > 0 && <Sec title="📋 게시판">{boards.map((b) => <div key={b.id} onClick={() => onOpenPost(b.boardId, b.id)} style={{ ...rowS, cursor: "pointer" }}><b style={{ fontSize: 13, color: "#1e293b" }}>{b.boardIcon} {b.title}</b><div style={{ fontSize: 11.5, color: "#64748b", marginTop: 3 }}>{b.snippet}</div><div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 3 }}>{b.boardName} · {b.author}</div></div>)}</Sec>}
      {wiki.length > 0 && <Sec title="📖 위키/매뉴얼">{wiki.map((w) => <div key={w.id} style={rowS}><b style={{ fontSize: 13, color: "#1e293b" }}>{w.type === "manual" ? "📋" : "📖"} {w.title}</b><div style={{ fontSize: 11.5, color: "#64748b", marginTop: 3 }}>{w.snippet}</div></div>)}</Sec>}
      {drive.length > 0 && <Sec title="📁 회사 드라이브">{drive.map((d, i) => <div key={i} style={rowS}><b style={{ fontSize: 13, color: "#1e293b" }}>{d.type === "image" ? "🖼" : d.type === "video" ? "🎬" : "📄"} {d.name}</b><div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 3 }}>{d.folder}{d.hasText ? " · 본문있음" : ""}</div></div>)}</Sec>}
    </div>
  );
}

const btn = { border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", borderRadius: 6, padding: "5px 11px", cursor: "pointer", fontSize: 12, fontWeight: 600 };
const inp = { width: "100%", boxSizing: "border-box", border: "1px solid #e2e8f0", borderRadius: 7, padding: "8px 11px", fontSize: 13, outline: "none", color: "#1e293b" };
