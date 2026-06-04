import { useState, useEffect, useMemo, useRef, useLayoutEffect, memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import MiniSearch from "minisearch";
import { ReactFlow, Background, Controls, MiniMap, Handle, Position } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const API = "";

const BOTS = [
  { id: "saup", name: "사업계획서 봇", icon: "📑" },
  { id: "jiwon", name: "지원사업 봇", icon: "🏛️" },
  { id: "service", name: "서비스소개서 봇", icon: "📄" },
  { id: "cs", name: "CS 문구 봇", icon: "💬" },
  { id: "meeting", name: "회의록 봇", icon: "📋" },
  { id: "qa", name: "사내 Q&A 봇", icon: "❓" },
  { id: "research", name: "리서치 봇", icon: "🔍" },
  { id: "review", name: "검토·감수 봇", icon: "✅" },
  { id: "ppt", name: "PPT 봇", icon: "📊" },
];
const CAT_COLORS = ["#6366f1", "#0ea5e9", "#f59e0b", "#ec4899", "#10b981", "#8b5cf6", "#ef4444"];
const catColor = (c) => CAT_COLORS[Math.abs((c || "").split("").reduce((a, x) => a + x.charCodeAt(0), 0)) % CAT_COLORS.length];

// ── 유틸 ──────────────────────────────────────────────────────────────────
const slug = (s) => (s || "").toLowerCase().replace(/[^\w가-힣]+/g, "-").replace(/^-|-$/g, "");
function ytIframe(id) {
  return `<iframe width="100%" height="260" src="https://www.youtube.com/embed/${id}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="border-radius:8px;border:1px solid #e2e8f0;margin:6px 0"></iframe>`;
}
function ytId(url) {
  const m = (url || "").match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return m ? m[1] : null;
}
function preprocess(body, docs) {
  let s = body || "";
  const stash = [];
  s = s.replace(/```[\s\S]*?```|`[^`\n]*`/g, (m) => { stash.push(m); return `@@CODE${stash.length - 1}@@`; });
  s = s.replace(/\{\{youtube:([\w-]{11})\}\}/g, (_, id) => ytIframe(id));
  s = s.replace(/^(https?:\/\/\S*(?:youtu\.be|youtube\.com)\/\S+)\s*$/gim, (m, url) => { const id = ytId(url); return id ? ytIframe(id) : m; });
  s = s.replace(/\[\[([^\]|#]+)(#[^\]]+)?\]\]/g, (_, title) => {
    const t = title.trim(); const d = docs.find((x) => x.title === t);
    return `[${t}](${d ? `#wiki:${d.id}` : `#wikinew:${encodeURIComponent(t)}`})`;
  });
  // 각주: [* 내용] → GFM 각주([^n] + 하단 정의)
  const fns = [];
  s = s.replace(/\[\*\s*([^\]]+?)\]/g, (_, c) => { const n = fns.length + 1; fns.push(`[^${n}]: ${c.trim()}`); return `[^${n}]`; });
  if (fns.length) s += "\n\n" + fns.join("\n");
  s = s.replace(/@@CODE(\d+)@@/g, (_, i) => stash[+i]);
  return s;
}

// ── 메인 ──────────────────────────────────────────────────────────────────
export default function KnowledgeCenter({ humans = [], activeProject = "default", onSendToBot }) {
  const [docs, setDocs] = useState([]);
  const [mode, setMode] = useState("manual"); // wiki | manual
  const [selId, setSelId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(null);
  const [favs, setFavs] = useState(() => { try { return JSON.parse(localStorage.getItem("wikiFavs") || "[]"); } catch { return []; } });
  const [obProgress, setObProgress] = useState(() => { try { return JSON.parse(localStorage.getItem("onboardingProgress") || "{}"); } catch { return {}; } });
  const [wikiSplit, setWikiSplit] = useState(34); // 위키 2분할: 왼쪽 패널 %
  const wikiWrapRef = useRef(null);
  const startWikiResize = (e) => {
    e.preventDefault();
    const wrap = wikiWrapRef.current; if (!wrap) return;
    const onMove = (ev) => { const r = wrap.getBoundingClientRect(); setWikiSplit(Math.max(22, Math.min(58, ((ev.clientX - r.left) / r.width) * 100))); };
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
  };

  const load = () => fetch(`${API}/api/wiki`).then((r) => r.json()).then((d) => setDocs(Array.isArray(d) ? d : [])).catch(() => {});
  useEffect(() => { load(); }, []);

  // 모드별 문서: 위키 / 매뉴얼(코스 제외) / 온보딩(코스만)
  const modeDocs = docs.filter((d) => {
    if (mode === "wiki") return d.type === "wiki";
    if (mode === "onboarding") return d.type === "manual" && d.manualType === "course";
    return d.type === "manual" && d.manualType !== "course"; // manual
  });

  // 온보딩 진도 (전역, localStorage) — 사람 구분 없이 "이 화면 기준" 진행 체크
  const obKey = (courseId, lessonId) => `${courseId}:${lessonId}`;
  const obDone = (courseId, lessonId) => !!obProgress[obKey(courseId, lessonId)];
  const obToggle = (courseId, lessonId) => setObProgress((p) => { const k = obKey(courseId, lessonId); const n = { ...p, [k]: !p[k] }; localStorage.setItem("onboardingProgress", JSON.stringify(n)); return n; });
  const courseProgress = (c) => { const st = c.steps || []; if (!st.length) return 0; return Math.round(st.filter((s) => obDone(c.id, s.id)).length / st.length * 100); };
  const sel = modeDocs.find((d) => d.id === selId) || null;

  const mini = useMemo(() => {
    const ms = new MiniSearch({ fields: ["title", "body", "tags", "category", "stepsText"], storeFields: ["title"], searchOptions: { boost: { title: 3, tags: 2 }, prefix: true, fuzzy: 0.2 } });
    ms.addAll(docs.map((d) => ({ id: d.id, title: d.title, category: d.category, body: d.body || "", tags: (d.tags || []).join(" "), stepsText: (d.steps || []).map((s) => `${s.title} ${s.desc || ""}`).join(" ") })));
    return ms;
  }, [docs]);

  const results = useMemo(() => {
    let list = modeDocs;
    if (query.trim()) { const ids = new Set(mini.search(query.trim()).map((r) => r.id)); list = list.filter((d) => ids.has(d.id)); }
    return list;
  }, [modeDocs, query, mini]);

  const switchMode = (m) => { setMode(m); setSelId(null); setEditing(false); setDraft(null); setCreating(null); setQuery(""); };
  const selectDoc = (id) => { setEditing(false); setDraft(null); setCreating(null); setSelId(id); };
  const startEdit = () => { if (sel) { setDraft(JSON.parse(JSON.stringify(sel))); setEditing(true); } };
  const toggleFav = (id) => setFavs((p) => { const n = p.includes(id) ? p.filter((x) => x !== id) : [...p, id]; localStorage.setItem("wikiFavs", JSON.stringify(n)); return n; });

  const saveDraft = async () => {
    if (!draft) return;
    const r = await fetch(`${API}/api/wiki/${draft.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: draft.title, category: draft.category, tags: draft.tags, body: draft.body, steps: draft.steps }) });
    const u = await r.json(); setDocs((p) => p.map((d) => (d.id === u.id ? u : d))); setEditing(false); setDraft(null);
  };
  const patchDoc = async (id, patch) => {
    const r = await fetch(`${API}/api/wiki/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const u = await r.json(); setDocs((p) => p.map((d) => (d.id === u.id ? u : d)));
  };
  const createDoc = async () => {
    const c = creating;
    const r = await fetch(`${API}/api/wiki`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: mode, title: c.title || "제목 없음", category: c.category || "미분류", body: mode === "wiki" ? "# " + (c.title || "") + "\n" : "", steps: mode === "manual" ? [{ id: "s" + Date.now(), title: "1단계", desc: "", owner: "", checklist: [], refs: [], botId: "", done: false }] : [] }) });
    const doc = await r.json(); setDocs((p) => [doc, ...p]); setCreating(null); setSelId(doc.id); setDraft(JSON.parse(JSON.stringify(doc))); setEditing(true);
  };
  const delDoc = async (id) => { await fetch(`${API}/api/wiki/${id}`, { method: "DELETE" }); setDocs((p) => p.filter((d) => d.id !== id)); if (selId === id) { setSelId(null); setEditing(false); } };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "#f1f5f9" }}>
      {/* 모드 탭 */}
      <div style={{ display: "flex", gap: 8, padding: "10px 16px 0", background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
        {[["wiki", "📖 사내위키", "찾아 읽는 지식"], ["manual", "📋 업무매뉴얼", "늘 찾는 업무 절차·양식"], ["onboarding", "🎓 온보딩", "신입 학습 · 진도 체크"]].map(([m, l, sub]) => (
          <button key={m} onClick={() => switchMode(m)} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1, padding: "8px 18px 10px", border: "none", borderBottom: "3px solid " + (mode === m ? "#6366f1" : "transparent"), background: "transparent", cursor: "pointer" }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: mode === m ? "#4338ca" : "#94a3b8" }}>{l}</span>
            <span style={{ fontSize: 9.5, color: mode === m ? "#818cf8" : "#cbd5e1" }}>{sub}</span>
          </button>
        ))}
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* 본문 (사이드바 없음 — 각 홈 화면에 검색·분류 내장) */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: (mode === "manual" && sel && (sel.manualType || "procedure") === "procedure") ? "#0f172a" : "#fff", minHeight: 0 }}>
          {creating ? (
            <div style={{ background: "#fff", flex: 1 }}><NewDocForm mode={mode === "onboarding" ? "manual" : mode} creating={creating} setCreating={setCreating} onCreate={createDoc} /></div>
          ) : editing ? (
            <div style={{ background: "#fff", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}><Editor draft={draft} setDraft={setDraft} onSave={saveDraft} onCancel={() => { setEditing(false); setDraft(null); }} humans={humans} docs={docs} /></div>
          ) : mode === "onboarding" ? (
            sel ? <CoursePlayer doc={sel} docs={docs} obDone={obDone} obToggle={obToggle} onEdit={startEdit} onDelete={delDoc} onSelect={selectDoc} onBack={() => setSelId(null)} />
              : <OnboardingHome courses={results} courseProgress={courseProgress} onSelect={selectDoc} onNew={() => setCreating({ title: "", category: "온보딩-공통" })} />
          ) : mode === "manual" ? (
            sel ? <ManualDetail doc={sel} humans={humans} docs={docs} patchDoc={patchDoc} onEdit={startEdit} onDelete={delDoc} onSelect={selectDoc} onBack={() => setSelId(null)} onSendToBot={onSendToBot} activeProject={activeProject} />
              : <ManualBoard manuals={results} onSelect={selectDoc} onNew={() => setCreating({ title: "", category: "" })} query={query} setQuery={setQuery} favs={favs} />
          ) : (
            <div ref={wikiWrapRef} style={{ flex: 1, display: "flex", minHeight: 0 }}>
              {/* 왼쪽: 제목 목록 내비 — 리사이즈 */}
              <div style={{ width: wikiSplit + "%", minWidth: 200, display: "flex", flexDirection: "column", minHeight: 0 }}>
                <WikiNav wikis={results} onSelect={selectDoc} onNew={() => setCreating({ title: "", category: "" })} query={query} setQuery={setQuery} selId={selId} favs={favs} />
              </div>
              {/* 리사이즈 바 */}
              <div onMouseDown={startWikiResize} title="드래그해서 너비 조절" style={{ width: 6, flexShrink: 0, cursor: "col-resize", background: "#eef2f7" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#c7d2fe")} onMouseLeave={(e) => (e.currentTarget.style.background = "#eef2f7")} />
              {/* 오른쪽: 문서 내용 또는 환영 */}
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0, background: "#fff" }}>
                {sel ? <WikiReadPane doc={sel} docs={docs} humans={humans} favs={favs} toggleFav={toggleFav} onEdit={startEdit} onDelete={delDoc} onSelect={selectDoc} onNewByTitle={(t) => setCreating({ title: t, category: sel.category })} patchDoc={patchDoc} onBack={() => setSelId(null)} />
                  : <WikiWelcome wikis={results} onSelect={selectDoc} />}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 위키 지식 지도 (React Flow 그래프) ─────────────────────────────────────────
const DocNode = memo(({ data }) => {
  const c = data.color;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 13px", background: "#fff", border: `2px solid ${c}`, borderRadius: 22, boxShadow: `0 2px 10px ${c}33`, cursor: "pointer", maxWidth: 200 }}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <span style={{ width: 9, height: 9, borderRadius: "50%", background: c, flexShrink: 0 }} />
      <span style={{ fontSize: 12.5, fontWeight: 700, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📖 {data.label}</span>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
});
const CatNode = memo(({ data }) => (
  <div style={{ fontSize: 14, fontWeight: 900, color: data.color, letterSpacing: 1, opacity: 0.55, pointerEvents: "none" }}>
    ◆ {data.label}
  </div>
));
const wikiNodeTypes = { doc: DocNode, cat: CatNode };

function ZoneMap({ wikis, onSelect, onNew, query }) {
  const { nodes, edges, cats } = useMemo(() => {
    const byCat = {};
    wikis.forEach((d) => { (byCat[d.category || "미분류"] ||= []).push(d); });
    const catList = Object.keys(byCat);
    const cols = Math.max(1, Math.ceil(Math.sqrt(catList.length)));
    const GAPX = 520, GAPY = 460;
    const nodes = [];
    catList.forEach((cat, ci) => {
      const cx = (ci % cols) * GAPX + 260;
      const cy = Math.floor(ci / cols) * GAPY + 200;
      const c = catColor(cat);
      // 카테고리 라벨 노드(중앙, 배경처럼)
      nodes.push({ id: `cat:${cat}`, type: "cat", position: { x: cx - 30, y: cy - 120 }, data: { label: cat, color: c }, draggable: false, selectable: false });
      const list = byCat[cat];
      list.forEach((d, i) => {
        const k = list.length;
        const ang = (i / Math.max(k, 1)) * Math.PI * 2 - Math.PI / 2;
        const rad = k === 1 ? 0 : 90 + k * 16;
        nodes.push({ id: d.id, type: "doc", position: { x: cx + Math.cos(ang) * rad, y: cy + Math.sin(ang) * rad }, data: { label: d.title, color: c } });
      });
    });
    // [[링크]] 엣지
    const byTitle = {}; wikis.forEach((d) => { byTitle[d.title] = d.id; });
    const edges = [];
    wikis.forEach((d) => {
      const seen = new Set();
      (d.body || "").replace(/\[\[([^\]|#]+)(?:#[^\]]+)?\]\]/g, (_, t) => {
        const id = byTitle[t.trim()];
        if (id && id !== d.id && !seen.has(id)) { seen.add(id); edges.push({ id: `${d.id}-${id}`, source: d.id, target: id, style: { stroke: "#a5b4fc", strokeWidth: 2 }, animated: true }); }
        return "";
      });
    });
    return { nodes, edges, cats: catList };
  }, [wikis]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, position: "relative", background: "#f8fafc" }}>
      {/* 헤더 (오버레이) */}
      <div style={{ position: "absolute", top: 10, left: 16, right: 16, zIndex: 5, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", pointerEvents: "none" }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: "#1e293b", background: "#ffffffcc", padding: "3px 8px", borderRadius: 8, pointerEvents: "auto" }}>🗺️ 사내위키 지식 지도</span>
        <span style={{ fontSize: 11, color: "#64748b", background: "#ffffffcc", padding: "3px 8px", borderRadius: 8 }}>드래그로 이동 · 휠로 확대/축소 · 점 클릭 → 문서</span>
        <button onClick={onNew} style={{ marginLeft: "auto", pointerEvents: "auto", background: "#6366f1", color: "#fff", border: "none", borderRadius: 7, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px #6366f155" }}>+ 새 위키</button>
      </div>
      {/* 범례 */}
      {cats.length > 0 && (
        <div style={{ position: "absolute", bottom: 14, left: 16, zIndex: 5, display: "flex", flexWrap: "wrap", gap: 8, background: "#ffffffdd", padding: "7px 10px", borderRadius: 10, border: "1px solid #e2e8f0" }}>
          {cats.map((cat) => (
            <span key={cat} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#475569", fontWeight: 600 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: catColor(cat) }} />{cat}
            </span>
          ))}
        </div>
      )}
      {wikis.length === 0 && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 4, color: "#94a3b8", fontSize: 13 }}>
          {query ? "검색 결과 없음" : "위키가 없습니다. + 새 위키로 시작하세요."}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ReactFlow
          nodes={nodes} edges={edges} nodeTypes={wikiNodeTypes}
          onNodeClick={(_, node) => { if (node.type === "doc") onSelect(node.id); }}
          fitView fitViewOptions={{ padding: 0.3 }} minZoom={0.2} maxZoom={2.5}
          proOptions={{ hideAttribution: true }} nodesConnectable={false}
          style={{ background: "#f8fafc" }}
        >
          <Background color="#dbe3ef" gap={24} size={1.4} />
          <Controls showInteractive={false} />
          <MiniMap nodeColor={(n) => n.data?.color || "#94a3b8"} nodeStrokeWidth={2} pannable zoomable style={{ background: "#fff", border: "1px solid #e2e8f0" }} />
        </ReactFlow>
      </div>
    </div>
  );
}

// ── 사이드바 ─────────────────────────────────────────────────────────────────
function Sidebar({ mode, results, query, setQuery, selId, selectDoc, onNew }) {
  const tree = useMemo(() => { const m = {}; results.forEach((d) => { (m[d.category || "미분류"] ||= []).push(d); }); return m; }, [results]);
  return (
    <div style={{ width: 230, flexShrink: 0, background: "#fff", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 8 }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`🔍 ${mode === "wiki" ? "위키" : "매뉴얼"} 검색`} style={{ border: "1px solid #e2e8f0", borderRadius: 7, padding: "7px 10px", fontSize: 12, outline: "none", color: "#1e293b" }} />
        <button onClick={onNew} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 7, padding: "7px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ 새 {mode === "wiki" ? "위키" : "매뉴얼"}</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 6px 16px" }}>
        {Object.keys(tree).sort().map((cat) => (
          <div key={cat} style={{ marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", fontSize: 11, fontWeight: 700, color: "#475569" }}>
              <span style={{ width: 7, height: 7, borderRadius: 2, background: catColor(cat) }} />{cat}
              <span style={{ marginLeft: "auto", fontSize: 9, color: "#cbd5e1" }}>{tree[cat].length}</span>
            </div>
            {tree[cat].map((d) => {
              const active = selId === d.id;
              const pct = d.type === "manual" && d.steps?.length ? Math.round(d.steps.filter((s) => s.done).length / d.steps.length * 100) : null;
              return (
                <div key={d.id} onClick={() => selectDoc(d.id)} style={{ padding: "6px 8px 6px 18px", borderRadius: 6, cursor: "pointer", background: active ? "#eef2ff" : "transparent" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: active ? 700 : 500, color: active ? "#4338ca" : "#334155" }}>
                    <span>{d.type === "manual" ? "📋" : "📖"}</span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</span>
                  </div>
                  {pct !== null && <div style={{ height: 3, background: "#e2e8f0", borderRadius: 2, marginTop: 4, marginLeft: 18 }}><div style={{ height: 3, width: pct + "%", background: pct === 100 ? "#16a34a" : "#6366f1", borderRadius: 2 }} /></div>}
                </div>
              );
            })}
          </div>
        ))}
        {results.length === 0 && <div style={{ fontSize: 11, color: "#cbd5e1", textAlign: "center", padding: "20px 0" }}>없음</div>}
      </div>
    </div>
  );
}

// ── 업무매뉴얼: 퀘스트 맵 (게임 퀘스트 체인 흐름도) ───────────────────────────────
const QSTATUS = {
  done: { label: "완료", badge: "✅", color: "#16a34a", bg: "linear-gradient(160deg,#f0fdf4,#dcfce7)", border: "#86efac" },
  active: { label: "다음 차례", badge: "⚔️", color: "#4f46e5", bg: "linear-gradient(160deg,#eef2ff,#e0e7ff)", border: "#818cf8" },
  todo: { label: "예정", badge: "⬜", color: "#64748b", bg: "linear-gradient(160deg,#ffffff,#f8fafc)", border: "#cbd5e1" },
};
function QuestMap({ doc, humans, docs, patchDoc, onEdit, onDelete, onSelect, onBack, onSendToBot, activeProject }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const [kanbanState, setKanbanState] = useState("idle"); // idle | confirm | done
  const steps = doc.steps || [];
  const doneN = steps.filter((s) => s.done).length;
  const pct = steps.length ? Math.round((doneN / steps.length) * 100) : 0;
  const currentIdx = steps.findIndex((s) => !s.done);
  const cur = currentIdx === -1 ? null : steps[currentIdx];

  const statusOf = (s, i) => (s.done ? "done" : i === currentIdx ? "active" : "todo");
  const setStep = (idx, patch) => patchDoc(doc.id, { steps: steps.map((s, i) => (i === idx ? { ...s, ...patch } : s)) });
  const setCheck = (idx, ci, done) => patchDoc(doc.id, { steps: steps.map((s, i) => i === idx ? { ...s, checklist: s.checklist.map((c, j) => j === ci ? { ...c, done } : c) } : s) });

  // 퀘스트 → 봇 채팅 인계
  const sendStepToBot = (s) => {
    if (!onSendToBot || !s.botId) return;
    let msg = `[${doc.title} · ${s.title}]\n${s.desc || s.title}`;
    if (s.checklist?.length) msg += `\n\n확인할 목표:\n` + s.checklist.map((c) => `- ${c.text}`).join("\n");
    if (s.refs?.length) msg += `\n\n참고 문서: ${s.refs.join(", ")}`;
    onSendToBot({ botId: s.botId, message: msg, label: `📋 ${doc.title} · ${s.title} → 봇에게 의뢰` });
  };

  // 매뉴얼 → 칸반 카드 생성 (단계별 1장)
  const createKanbanCards = async () => {
    try {
      for (const s of steps) {
        const owner = humans.find((h) => h.id === s.owner);
        const desc = `${s.desc || ""}${s.checklist?.length ? "\n\n목표: " + s.checklist.map((c) => c.text).join(", ") : ""}\n\n📋 매뉴얼: ${doc.title}`;
        await fetch(`${API}/api/projects/${activeProject}/kanban/cards`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: s.title, desc, column: "todo", agentId: owner?.id || null, agentName: owner?.name || null, agentAvatar: owner?.avatar || null, projectId: activeProject }),
        });
      }
      setKanbanState("done");
      setTimeout(() => setKanbanState("idle"), 2500);
    } catch { setKanbanState("idle"); }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, color: "#e2e8f0" }}>
      {/* 헤더 */}
      <div style={{ padding: "14px 22px", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button onClick={onBack} style={{ border: "1px solid #334155", background: "#1e293b", color: "#94a3b8", borderRadius: 7, padding: "5px 11px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>← 목록</button>
        <span style={{ fontSize: 18 }}>📋</span>
        <span style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>{doc.title}</span>
        <span style={{ fontSize: 11, color: "#64748b", background: "#1e293b", padding: "2px 9px", borderRadius: 8 }}>{doc.category}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          {kanbanState === "done" ? (
            <span style={{ fontSize: 12, color: "#4ade80", fontWeight: 700 }}>✅ 칸반에 {steps.length}장 추가됨</span>
          ) : kanbanState === "confirm" ? (
            <>
              <span style={{ fontSize: 11, color: "#cbd5e1" }}>{steps.length}장 추가할까요?</span>
              <button onClick={createKanbanCards} style={{ border: "none", background: "#6366f1", color: "#fff", borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>확인</button>
              <button onClick={() => setKanbanState("idle")} style={{ border: "1px solid #334155", background: "#1e293b", color: "#94a3b8", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 11 }}>취소</button>
            </>
          ) : (
            <button onClick={() => setKanbanState("confirm")} title="단계별로 칸반 카드를 만듭니다" style={{ border: "1px solid #334155", background: "#1e293b", color: "#a5b4fc", borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>📌 칸반 카드 생성</button>
          )}
          <button onClick={onEdit} style={{ border: "1px solid #4f46e5", background: "#312e81", color: "#c7d2fe", borderRadius: 7, padding: "5px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✏ 편집</button>
          {confirmDel ? <>
            <button onClick={() => onDelete(doc.id)} style={{ border: "none", background: "#dc2626", color: "#fff", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>삭제확인</button>
            <button onClick={() => setConfirmDel(false)} style={{ border: "1px solid #334155", background: "#1e293b", color: "#94a3b8", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 11 }}>취소</button>
          </> : <button onClick={() => setConfirmDel(true)} style={{ border: "1px solid #7f1d1d", background: "#1e293b", color: "#f87171", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 12 }}>🗑</button>}
        </div>
      </div>

      {/* 진행 바 (XP 느낌) */}
      <div style={{ padding: "14px 22px 6px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ flex: 1, maxWidth: 420, height: 14, background: "#1e293b", borderRadius: 8, overflow: "hidden", border: "1px solid #334155" }}>
          <div style={{ height: "100%", width: pct + "%", background: "linear-gradient(90deg,#6366f1,#22d3ee)", borderRadius: 8, transition: "width .4s", boxShadow: "0 0 12px #6366f1aa" }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>{doneN}/{steps.length} 완료 · {pct}%</span>
        {cur && <span style={{ fontSize: 12, color: "#a5b4fc" }}>⚔️ 지금: <b style={{ color: "#fff" }}>{cur.title}</b></span>}
        {!cur && steps.length > 0 && <span style={{ fontSize: 12, color: "#4ade80", fontWeight: 700 }}>🎉 모든 퀘스트 완료!</span>}
      </div>

      {/* 퀘스트 체인 (가로 흐름도) */}
      <div style={{ flex: 1, overflowX: "auto", overflowY: "auto", padding: "18px 22px 28px", minHeight: 0 }}>
        <div style={{ display: "flex", alignItems: "stretch", gap: 0, minHeight: "min-content" }}>
          {steps.map((s, i) => {
            const st = statusOf(s, i);
            const cfg = QSTATUS[st];
            const owner = humans.find((h) => h.id === s.owner);
            const bot = BOTS.find((b) => b.id === s.botId);
            return (
              <div key={s.id || i} style={{ display: "flex", alignItems: "center" }}>
                {/* 카드 */}
                <div style={{ width: 244, alignSelf: "stretch", display: "flex", flexDirection: "column", background: cfg.bg, border: `2px solid ${cfg.border}`, borderRadius: 14, padding: "12px 14px", boxShadow: st === "active" ? `0 0 0 3px ${cfg.border}55, 0 8px 24px #4f46e555` : "0 4px 14px #00000022", position: "relative" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1, color: cfg.color, background: "#fff", padding: "2px 8px", borderRadius: 20, border: `1px solid ${cfg.border}` }}>QUEST {i + 1}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, marginLeft: "auto" }}>{cfg.badge} {cfg.label}</span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginBottom: 4, lineHeight: 1.3 }}>{s.title}</div>
                  {s.desc && <div style={{ fontSize: 11.5, color: "#475569", lineHeight: 1.55, marginBottom: 8, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{s.desc.replace(/[#*`>\[\]]/g, "")}</div>}

                  {s.checklist?.length > 0 && (
                    <div style={{ marginBottom: 8, background: "#ffffffaa", borderRadius: 8, padding: "6px 8px" }}>
                      <div style={{ fontSize: 9, fontWeight: 800, color: "#94a3b8", marginBottom: 3 }}>🎯 목표</div>
                      {s.checklist.map((c, ci) => (
                        <label key={ci} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: c.done ? "#94a3b8" : "#334155", cursor: "pointer", padding: "1px 0" }}>
                          <input type="checkbox" checked={!!c.done} onChange={(e) => setCheck(i, ci, e.target.checked)} style={{ accentColor: cfg.color, cursor: "pointer" }} />
                          <span style={{ textDecoration: c.done ? "line-through" : "none" }}>{c.text}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      {owner && <span style={{ fontSize: 10.5, color: "#475569", background: "#fff", border: "1px solid #e2e8f0", padding: "2px 7px", borderRadius: 12 }}>{owner.avatar} {owner.name}</span>}
                    </div>
                    {bot && <button onClick={() => sendStepToBot(s)} title={`${bot.name}에게 이 단계를 채팅으로 의뢰합니다`} style={{ border: "1px solid #ddd6fe", background: "#fff", color: "#7c3aed", borderRadius: 8, padding: "5px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>🤖 {bot.icon} {bot.name}에게 시키기</button>}
                    {(s.refs || []).length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {s.refs.map((rt) => { const rd = docs.find((x) => x.title === rt); return <span key={rt} onClick={() => rd && onSelect(rd.id)} style={{ fontSize: 10, color: rd ? "#4338ca" : "#94a3b8", background: "#fff", border: "1px solid #c7d2fe", padding: "1px 6px", borderRadius: 8, cursor: rd ? "pointer" : "default" }}>🔗 {rt}</span>; })}
                      </div>
                    )}
                    <button onClick={() => setStep(i, { done: !s.done })} style={{ border: "none", borderRadius: 8, padding: "6px", fontSize: 11.5, fontWeight: 800, cursor: "pointer", background: s.done ? "#fff" : cfg.color, color: s.done ? cfg.color : "#fff", boxShadow: s.done ? "inset 0 0 0 1.5px " + cfg.border : "none" }}>
                      {s.done ? "↩ 되돌리기" : "✓ 완료하기"}
                    </button>
                  </div>
                </div>
                {/* 연결 화살표 */}
                {i < steps.length - 1 && (
                  <div style={{ width: 40, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <div style={{ height: 3, width: "100%", background: s.done ? "linear-gradient(90deg,#22d3ee,#6366f1)" : "#334155", position: "relative", borderRadius: 2 }}>
                      <span style={{ position: "absolute", right: -2, top: -7, fontSize: 14, color: s.done ? "#6366f1" : "#475569" }}>▶</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {steps.length === 0 && <div style={{ color: "#64748b", fontSize: 13, padding: 20 }}>단계가 없습니다. ✏ 편집에서 추가하세요.</div>}
        </div>
      </div>
    </div>
  );
}

// ── 매뉴얼 갤러리 (선택 전) ─────────────────────────────────────────────────────
function ManualGallery({ manuals, onSelect, onNew }) {
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 24, background: "#0f172a", color: "#e2e8f0" }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginBottom: 4 }}>📋 업무매뉴얼 — 퀘스트를 골라 시작하세요</div>
      <div style={{ fontSize: 11.5, color: "#64748b", marginBottom: 18 }}>각 매뉴얼은 단계별 퀘스트로 이어집니다.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14 }}>
        {manuals.map((d) => {
          const total = d.steps?.length || 0; const done = (d.steps || []).filter((s) => s.done).length; const pct = total ? Math.round(done / total * 100) : 0;
          return (
            <div key={d.id} onClick={() => onSelect(d.id)} style={{ background: "linear-gradient(160deg,#1e293b,#0f172a)", border: "1px solid #334155", borderRadius: 14, padding: 16, cursor: "pointer", boxShadow: "0 6px 18px #00000044" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 22 }}>📋</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{d.title}</span>
              </div>
              <div style={{ fontSize: 10.5, color: "#64748b", marginBottom: 10 }}>{d.category} · {total}단계 퀘스트</div>
              <div style={{ height: 8, background: "#0f172a", borderRadius: 5, overflow: "hidden", border: "1px solid #334155" }}>
                <div style={{ height: "100%", width: pct + "%", background: "linear-gradient(90deg,#6366f1,#22d3ee)" }} />
              </div>
              <div style={{ fontSize: 10.5, color: "#a5b4fc", marginTop: 5 }}>{done}/{total} 완료 · {pct}%</div>
            </div>
          );
        })}
        <div onClick={onNew} style={{ border: "2px dashed #334155", borderRadius: 14, padding: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: 13, fontWeight: 700, minHeight: 120 }}>＋ 새 매뉴얼</div>
      </div>
    </div>
  );
}

// ── 위키 갤러리 (선택 전) ──────────────────────────────────────────────────────
function WikiGallery({ wikis, onSelect, onNew }) {
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 24, background: "#f8fafc" }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#1e293b", marginBottom: 14 }}>📖 사내위키</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 14 }}>
        {wikis.map((d) => (
          <div key={d.id} onClick={() => onSelect(d.id)} style={{ background: "#fff", border: "1px solid #e2e8f0", borderTop: `3px solid ${catColor(d.category)}`, borderRadius: 12, padding: 16, cursor: "pointer", boxShadow: "0 2px 8px #00000010" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginBottom: 6 }}>📖 {d.title}</div>
            <div style={{ fontSize: 11.5, color: "#94a3b8", lineHeight: 1.5, height: 51, overflow: "hidden" }}>{(d.body || "").replace(/[#*`>\[\]!()]/g, "").replace(/\n+/g, " ").slice(0, 90)}</div>
            <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 9.5, color: catColor(d.category), background: catColor(d.category) + "18", padding: "1px 7px", borderRadius: 8 }}>{d.category}</span>
              {(d.tags || []).slice(0, 2).map((t) => <span key={t} style={{ fontSize: 9.5, color: "#94a3b8", background: "#f1f5f9", padding: "1px 7px", borderRadius: 8 }}>#{t}</span>)}
            </div>
          </div>
        ))}
        <div onClick={onNew} style={{ border: "2px dashed #cbd5e1", borderRadius: 12, padding: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13, fontWeight: 700, minHeight: 110 }}>＋ 새 위키</div>
      </div>
    </div>
  );
}

// ── 위키 읽기 (3패널: 본문 + 도구) ───────────────────────────────────────────────
function WikiReadPane({ doc, docs, humans, favs, toggleFav, onEdit, onDelete, onSelect, onNewByTitle, patchDoc, onBack }) {
  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <Reader doc={doc} docs={docs} humans={humans} favs={favs} toggleFav={toggleFav} onEdit={onEdit} onDelete={onDelete} onSelect={onSelect} onNewByTitle={onNewByTitle} patchDoc={patchDoc} onBack={onBack} />
      </div>
      <ToolPanel doc={doc} docs={docs} onSelect={onSelect} />
    </div>
  );
}

// ── 새 문서 폼 ────────────────────────────────────────────────────────────────
function NewDocForm({ mode, creating, setCreating, onCreate }) {
  return (
    <div style={{ padding: 24, maxWidth: 460 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>새 {mode === "wiki" ? "위키 페이지" : "업무매뉴얼"} 만들기</div>
      <input autoFocus value={creating.title} onChange={(e) => setCreating((p) => ({ ...p, title: e.target.value }))} placeholder="제목" style={inp} />
      <input value={creating.category} onChange={(e) => setCreating((p) => ({ ...p, category: e.target.value }))} placeholder="카테고리 (예: 사업, 고객, 회사)" style={{ ...inp, marginTop: 10, marginBottom: 16 }} />
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onCreate} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 7, padding: "9px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>만들기</button>
        <button onClick={() => setCreating(null)} style={{ background: "#fff", color: "#64748b", border: "1px solid #e2e8f0", borderRadius: 7, padding: "9px 20px", fontSize: 13, cursor: "pointer" }}>취소</button>
      </div>
    </div>
  );
}
const inp = { width: "100%", boxSizing: "border-box", border: "1px solid #e2e8f0", borderRadius: 7, padding: "9px 12px", fontSize: 13, outline: "none", color: "#1e293b" };

// ── 마크다운 컴포넌트 ──────────────────────────────────────────────────────────
function mdComponents(docs, onSelect, onNewByTitle) {
  const Heading = (lvl) => ({ children }) => {
    const id = slug(String(children));
    if (lvl === 1) return <h1 id={id} style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: "8px 0 12px" }}>{children}</h1>;
    if (lvl === 2) return <h2 id={id} style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", margin: "18px 0 8px", borderBottom: "1px solid #f1f5f9", paddingBottom: 4 }}>{children}</h2>;
    return <h3 id={id} style={{ fontSize: 15, fontWeight: 700, color: "#334155", margin: "14px 0 6px" }}>{children}</h3>;
  };
  return {
    h1: Heading(1), h2: Heading(2), h3: Heading(3),
    p: ({ children }) => <p style={{ fontSize: 13.5, lineHeight: 1.85, color: "#334155", margin: "8px 0" }}>{children}</p>,
    li: ({ children }) => <li style={{ fontSize: 13.5, lineHeight: 1.8, color: "#334155", marginBottom: 3 }}>{children}</li>,
    strong: ({ children }) => <strong style={{ fontWeight: 700, color: "#1e293b" }}>{children}</strong>,
    table: ({ children }) => <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5, margin: "10px 0" }}>{children}</table>,
    th: ({ children }) => <th style={{ border: "1px solid #e2e8f0", padding: "7px 10px", background: "#f8fafc", fontWeight: 700, textAlign: "left", color: "#475569" }}>{children}</th>,
    td: ({ children }) => <td style={{ border: "1px solid #e2e8f0", padding: "7px 10px", color: "#334155" }}>{children}</td>,
    img: ({ src, alt }) => <img src={src} alt={alt} style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid #e2e8f0", margin: "6px 0" }} />,
    blockquote: ({ children }) => <blockquote style={{ borderLeft: "3px solid #c7d2fe", paddingLeft: 12, margin: "10px 0", color: "#64748b" }}>{children}</blockquote>,
    code: ({ children }) => <code style={{ background: "#f1f5f9", padding: "1px 5px", borderRadius: 4, fontSize: 12.5, color: "#db2777" }}>{children}</code>,
    a: ({ href, children }) => {
      if (href && href.startsWith("#wiki:")) { const id = href.slice(6).split("#")[0]; return <a onClick={(e) => { e.preventDefault(); onSelect(id); }} style={{ color: "#4338ca", background: "#eef2ff", padding: "1px 5px", borderRadius: 4, cursor: "pointer", textDecoration: "none", fontWeight: 600 }}>{children}</a>; }
      if (href && href.startsWith("#wikinew:")) { const t = decodeURIComponent(href.slice(9)); return <a onClick={(e) => { e.preventDefault(); onNewByTitle(t); }} title="없는 문서 — 클릭해 새로 만들기" style={{ color: "#dc2626", borderBottom: "1px dashed #fca5a5", cursor: "pointer", textDecoration: "none" }}>{children}</a>; }
      return <a href={href} target="_blank" rel="noreferrer" style={{ color: "#2563eb" }}>{children}</a>;
    },
  };
}

// ── 위키 Reader ──────────────────────────────────────────────────────────────
function Reader({ doc, docs, favs, toggleFav, onEdit, onDelete, onSelect, onNewByTitle, onBack }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const isFav = favs.includes(doc.id);
  const comps = mdComponents(docs, onSelect, onNewByTitle);
  return (
    <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 20px", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
        <button onClick={onBack} style={{ border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>← 목록</button>
        <span style={{ fontSize: 18 }}>📖</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}>{doc.title}</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button onClick={() => toggleFav(doc.id)} style={{ border: "1px solid #e2e8f0", background: isFav ? "#fef9c3" : "#fff", borderRadius: 6, padding: "4px 9px", cursor: "pointer", fontSize: 12 }}>{isFav ? "⭐" : "☆"}</button>
          <button onClick={onEdit} style={{ border: "1px solid #c7d2fe", background: "#eef2ff", color: "#4338ca", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✏ 편집</button>
          {confirmDel ? <>
            <button onClick={() => onDelete(doc.id)} style={{ border: "none", background: "#dc2626", color: "#fff", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>삭제확인</button>
            <button onClick={() => setConfirmDel(false)} style={{ border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11 }}>취소</button>
          </> : <button onClick={() => setConfirmDel(true)} style={{ border: "1px solid #fecaca", background: "#fff", color: "#dc2626", borderRadius: 6, padding: "4px 9px", cursor: "pointer", fontSize: 12 }}>🗑</button>}
        </span>
      </div>
      <div style={{ fontSize: 10.5, color: "#94a3b8", padding: "6px 20px 0" }}>
        {doc.category} · {doc.updatedAt ? new Date(doc.updatedAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}
        {(doc.tags || []).map((t) => <span key={t} style={{ marginLeft: 6, background: "#f1f5f9", padding: "1px 7px", borderRadius: 8, color: "#64748b" }}>#{t}</span>)}
      </div>
      <div style={{ padding: "10px 24px 40px" }}>
        <NumberedTOC body={doc.body} />
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={comps}>{preprocess(doc.body, docs)}</ReactMarkdown>
      </div>
    </div>
  );
}

// ── 편집기 (위키 마크다운 / 매뉴얼 단계) ─────────────────────────────────────────
function Editor({ draft, setDraft, onSave, onCancel, humans, docs }) {
  const taRef = useRef();
  const fileRef = useRef();
  const isManual = draft.type === "manual";
  const set = (patch) => setDraft((p) => ({ ...p, ...patch }));
  const insertAtCursor = (text) => {
    const ta = taRef.current; if (!ta) { set({ body: (draft.body || "") + text }); return; }
    const s = ta.selectionStart, e = ta.selectionEnd, v = draft.body || "";
    set({ body: v.slice(0, s) + text + v.slice(e) });
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = s + text.length; });
  };
  const wrap = (pre, post = pre) => {
    const ta = taRef.current; if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd, v = draft.body || "", sel = v.slice(s, e) || "텍스트";
    set({ body: v.slice(0, s) + pre + sel + post + v.slice(e) });
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = s + pre.length; ta.selectionEnd = s + pre.length + sel.length; });
  };
  const uploadImage = async (file) => { const fd = new FormData(); fd.append("file", file); try { const r = await fetch(`${API}/api/upload`, { method: "POST", body: fd }); const j = await r.json(); if (j.ok) insertAtCursor(`\n![${j.name}](${j.url})\n`); } catch {} };
  const onPaste = (e) => { const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith("image/")); if (f) { e.preventDefault(); uploadImage(f); } };
  const onDrop = (e) => { e.preventDefault(); const f = [...(e.dataTransfer?.files || [])].find((x) => x.type.startsWith("image/")); if (f) uploadImage(f); };
  const addYoutube = () => { const u = window.prompt("유튜브 링크 또는 영상 ID"); if (!u) return; const id = ytId(u) || (/^[\w-]{11}$/.test(u) ? u : null); if (id) insertAtCursor(`\n{{youtube:${id}}}\n`); };
  const comps = mdComponents(docs, () => {}, () => {});
  const TB = ({ label, onClick, title }) => <button onClick={onClick} title={title} style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 5, padding: "4px 8px", fontSize: 11, cursor: "pointer", color: "#475569" }}>{label}</button>;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderBottom: "1px solid #e2e8f0", flexWrap: "wrap" }}>
        <input value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="제목" style={{ flex: 1, minWidth: 160, border: "1px solid #e2e8f0", borderRadius: 6, padding: "7px 10px", fontSize: 14, fontWeight: 700, outline: "none", color: "#1e293b" }} />
        <input value={draft.category} onChange={(e) => set({ category: e.target.value })} placeholder="카테고리" style={{ width: 110, border: "1px solid #e2e8f0", borderRadius: 6, padding: "7px 10px", fontSize: 12, outline: "none", color: "#1e293b" }} />
        <input value={(draft.tags || []).join(", ")} onChange={(e) => set({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} placeholder="태그(쉼표)" style={{ width: 130, border: "1px solid #e2e8f0", borderRadius: 6, padding: "7px 10px", fontSize: 12, outline: "none", color: "#1e293b" }} />
        <button onClick={onSave} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 6, padding: "7px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>저장</button>
        <button onClick={onCancel} style={{ background: "#fff", color: "#64748b", border: "1px solid #e2e8f0", borderRadius: 6, padding: "7px 14px", fontSize: 12, cursor: "pointer" }}>취소</button>
      </div>
      {isManual ? <ManualEditor draft={draft} setDraft={setDraft} humans={humans} /> : (
        <>
          <div style={{ display: "flex", gap: 4, padding: "7px 16px", borderBottom: "1px solid #f1f5f9", flexWrap: "wrap", alignItems: "center" }}>
            <TB label="B" onClick={() => wrap("**")} title="굵게" /><TB label="I" onClick={() => wrap("*")} title="기울임" />
            <TB label="H2" onClick={() => insertAtCursor("\n## ")} /><TB label="H3" onClick={() => insertAtCursor("\n### ")} />
            <TB label="•" onClick={() => insertAtCursor("\n- ")} /><TB label="☑" onClick={() => insertAtCursor("\n- [ ] ")} />
            <TB label="표" onClick={() => insertAtCursor("\n\n| 항목 | 값 |\n|---|---|\n| a | b |\n")} /><TB label="❝" onClick={() => insertAtCursor("\n> ")} />
            <TB label="🔗" onClick={() => wrap("[", "](url)")} /><TB label="[[ ]]" onClick={() => wrap("[[", "]]")} title="위키링크" />
            <TB label="🖼 이미지" onClick={() => fileRef.current?.click()} /><TB label="▶ 동영상" onClick={addYoutube} />
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ""; }} />
            <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: "auto" }}>이미지 드래그&드롭 · [[ 로 문서 링크</span>
          </div>
          <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
            <textarea ref={taRef} value={draft.body || ""} onChange={(e) => set({ body: e.target.value })} onPaste={onPaste} onDrop={onDrop} style={{ flex: 1, minWidth: 0, border: "none", borderRight: "1px solid #e2e8f0", padding: "16px 18px", fontSize: 13.5, lineHeight: 1.8, outline: "none", resize: "none", fontFamily: "ui-monospace,Menlo,monospace", color: "#1e293b" }} />
            <div style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "8px 20px", background: "#fafbfc" }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={comps}>{preprocess(draft.body, docs)}</ReactMarkdown>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── 매뉴얼 단계 편집 ─────────────────────────────────────────────────────────────
function ManualEditor({ draft, setDraft, humans }) {
  const steps = draft.steps || [];
  const setSteps = (next) => setDraft((p) => ({ ...p, steps: next }));
  const upd = (i, patch) => setSteps(steps.map((s, j) => j === i ? { ...s, ...patch } : s));
  const add = () => setSteps([...steps, { id: "s" + Date.now(), title: "새 단계", desc: "", owner: "", checklist: [], refs: [], botId: "", done: false }]);
  const del = (i) => setSteps(steps.filter((_, j) => j !== i));
  const move = (i, dir) => { const j = i + dir; if (j < 0 || j >= steps.length) return; const n = [...steps]; [n[i], n[j]] = [n[j], n[i]]; setSteps(n); };
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px", minHeight: 0 }}>
      <button onClick={add} style={{ background: "#eef2ff", color: "#4338ca", border: "1px solid #c7d2fe", borderRadius: 7, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}>＋ 단계(퀘스트) 추가</button>
      {steps.map((s, i) => (
        <div key={s.id || i} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", marginBottom: 10, background: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#6366f1" }}>Q{i + 1}</span>
            <input value={s.title} onChange={(e) => upd(i, { title: e.target.value })} placeholder="퀘스트 제목" style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 6, padding: "6px 9px", fontSize: 13, fontWeight: 600, outline: "none", color: "#1e293b" }} />
            <select value={s.owner || ""} onChange={(e) => upd(i, { owner: e.target.value })} style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "6px", fontSize: 11, color: "#475569" }}><option value="">담당 미정</option>{humans.map((h) => <option key={h.id} value={h.id}>{h.avatar} {h.name}</option>)}</select>
            <select value={s.botId || ""} onChange={(e) => upd(i, { botId: e.target.value })} style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "6px", fontSize: 11, color: "#475569" }}><option value="">봇 없음</option>{BOTS.map((b) => <option key={b.id} value={b.id}>{b.icon} {b.name}</option>)}</select>
            <button onClick={() => move(i, -1)} style={btnGhost}>↑</button><button onClick={() => move(i, 1)} style={btnGhost}>↓</button><button onClick={() => del(i)} style={{ ...btnGhost, color: "#dc2626" }}>🗑</button>
          </div>
          <textarea value={s.desc || ""} onChange={(e) => upd(i, { desc: e.target.value })} placeholder="설명 ([[위키링크]] 가능)" rows={2} style={{ width: "100%", boxSizing: "border-box", border: "1px solid #e2e8f0", borderRadius: 6, padding: "7px 9px", fontSize: 12.5, outline: "none", resize: "vertical", color: "#334155", marginBottom: 8 }} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            {(s.checklist || []).map((c, ci) => <span key={ci} style={{ display: "flex", alignItems: "center", gap: 4, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "3px 8px", fontSize: 11, color: "#475569" }}>{c.text}<span onClick={() => upd(i, { checklist: s.checklist.filter((_, j) => j !== ci) })} style={{ cursor: "pointer", color: "#cbd5e1" }}>✕</span></span>)}
            <input placeholder="+ 목표 후 Enter" onKeyDown={(e) => { if (e.key === "Enter" && e.target.value.trim()) { upd(i, { checklist: [...(s.checklist || []), { text: e.target.value.trim(), done: false }] }); e.target.value = ""; } }} style={{ border: "1px dashed #cbd5e1", borderRadius: 6, padding: "3px 8px", fontSize: 11, outline: "none", width: 130, color: "#475569" }} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginTop: 6 }}>
            {(s.refs || []).map((rt, ri) => <span key={ri} style={{ display: "flex", alignItems: "center", gap: 4, background: "#eef2ff", borderRadius: 6, padding: "3px 8px", fontSize: 11, color: "#4338ca" }}>🔗 {rt}<span onClick={() => upd(i, { refs: s.refs.filter((_, j) => j !== ri) })} style={{ cursor: "pointer", color: "#a5b4fc" }}>✕</span></span>)}
            <input placeholder="+ 참조 위키 후 Enter" onKeyDown={(e) => { if (e.key === "Enter" && e.target.value.trim()) { upd(i, { refs: [...(s.refs || []), e.target.value.trim()] }); e.target.value = ""; } }} style={{ border: "1px dashed #c7d2fe", borderRadius: 6, padding: "3px 8px", fontSize: 11, outline: "none", width: 160, color: "#475569" }} />
          </div>
        </div>
      ))}
    </div>
  );
}
const btnGhost = { border: "1px solid #e2e8f0", background: "#fff", borderRadius: 5, padding: "4px 8px", fontSize: 11, cursor: "pointer", color: "#64748b" };

// ── 도구 패널 (위키) ────────────────────────────────────────────────────────────
function ToolPanel({ doc, docs, onSelect }) {
  const toc = useMemo(() => { const out = []; (doc.body || "").split("\n").forEach((ln) => { const m = ln.match(/^(#{1,3})\s+(.+)/); if (m) out.push({ lvl: m[1].length, text: m[2].trim() }); }); return out; }, [doc]);
  const backlinks = useMemo(() => docs.filter((d) => d.id !== doc.id && ((d.body || "").includes(`[[${doc.title}]]`) || (d.steps || []).some((s) => (s.desc || "").includes(`[[${doc.title}]]`) || (s.refs || []).includes(doc.title)))), [docs, doc]);
  const L = { fontSize: 9.5, fontWeight: 700, color: "#94a3b8", letterSpacing: 0.5, textTransform: "uppercase", margin: "0 0 6px" };
  return (
    <div style={{ width: 220, flexShrink: 0, background: "#fff", borderLeft: "1px solid #e2e8f0", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ padding: "10px 14px", borderBottom: "1px solid #e2e8f0", fontSize: 11, fontWeight: 700, color: "#475569" }}>문서 도구</div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
        {toc.length > 0 && <div style={{ marginBottom: 16 }}><div style={L}>▣ 목차</div>{toc.map((t, i) => <div key={i} onClick={() => { const el = document.getElementById(slug(t.text)); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }} style={{ fontSize: 11.5, color: "#475569", padding: "3px 0", paddingLeft: (t.lvl - 1) * 10, cursor: "pointer" }}>· {t.text}</div>)}</div>}
        <div style={{ marginBottom: 16 }}><div style={L}>🔗 역링크 ({backlinks.length})</div>{backlinks.length === 0 && <div style={{ fontSize: 11, color: "#cbd5e1" }}>참조하는 곳 없음</div>}{backlinks.map((d) => <div key={d.id} onClick={() => onSelect(d.id)} style={{ fontSize: 11.5, color: "#4338ca", padding: "3px 0", cursor: "pointer" }}>{d.type === "manual" ? "📋" : "📖"} {d.title}</div>)}</div>
        <div><div style={L}>🤖 봇 지식</div><div style={{ fontSize: 11, color: "#94a3b8", display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#cbd5e1" }} />동기화 (3단계 예정)</div></div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 업무매뉴얼 (조직도형 보드 + 유형별 상세) · 온보딩 (인강)
// ════════════════════════════════════════════════════════════════════════════
const MTYPE = {
  procedure: { label: "절차", icon: "📋", color: "#6366f1", bg: "#eef2ff" },
  routine:   { label: "반복", icon: "🔁", color: "#16a34a", bg: "#f0fdf4" },
  form:      { label: "양식", icon: "📄", color: "#f59e0b", bg: "#fffbeb" },
};
const mtypeOf = (d) => MTYPE[d.manualType] || MTYPE.procedure;
const CAT_ICON = { 보고: "📊", 근태: "🕐", 재무: "💰", 인사: "👥", 영업: "🤝", 프로젝트: "📦", "IT·보안": "🔐", 총무: "🧰", 사업: "📑", 공통: "🧩", 복지: "🎁",
  회사: "🏢", 정책: "📜", 노하우: "💡", 브랜드: "🎨", 용어집: "📘", 자료실: "🗂️", 법무: "⚖️", AI운영: "🤖", 미분류: "📁" };
const cycleKo = (c) => ({ daily: "매일", weekly: "매주", monthly: "매월" }[c] || "반복");
const backBtn  = { border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", borderRadius: 7, padding: "5px 11px", cursor: "pointer", fontSize: 12, fontWeight: 600 };
const ghostBtn = { border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", borderRadius: 7, padding: "5px 11px", cursor: "pointer", fontSize: 12, fontWeight: 600 };

// ── 나무위키식 번호 목차 (접기) ────────────────────────────────────────────────
function NumberedTOC({ body }) {
  const [open, setOpen] = useState(true);
  const items = useMemo(() => {
    const raw = [];
    (body || "").split("\n").forEach((ln) => { const m = ln.match(/^(#{2,4})\s+(.+)/); if (m) raw.push({ lvl: m[1].length, text: m[2].trim() }); }); // h1(제목) 제외
    const cnt = [0, 0, 0];
    return raw.map((it) => { const d = it.lvl - 2; cnt[d]++; for (let j = d + 1; j < 3; j++) cnt[j] = 0; return { ...it, num: cnt.slice(0, d + 1).join(".") }; });
  }, [body]);
  if (items.length < 2) return null;
  return (
    <div style={{ display: "inline-block", minWidth: 220, maxWidth: "100%", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", margin: "2px 0 18px", padding: "9px 16px" }}>
      <div onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "#475569" }}>
        <span style={{ fontSize: 10 }}>{open ? "▼" : "▶"}</span>목차 <span style={{ color: "#94a3b8", fontWeight: 400, fontSize: 11 }}>[{open ? "숨기기" : "펼치기"}]</span>
      </div>
      {open && (
        <div style={{ marginTop: 8 }}>
          {items.map((it, i) => (
            <div key={i} onClick={() => { const el = document.getElementById(slug(it.text)); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }}
              style={{ fontSize: 12.5, padding: "2px 0", paddingLeft: (it.lvl - 2) * 16, cursor: "pointer", color: "#2563eb" }}>
              <span style={{ color: "#64748b", marginRight: 6 }}>{it.num}</span>{it.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 반복 주기 키 (자동 리셋 판정용)
function periodKey(cycle, d = new Date()) {
  if (cycle === "weekly") { const oneJan = new Date(d.getFullYear(), 0, 1); const wk = Math.ceil(((d - oneJan) / 86400000 + oneJan.getDay() + 1) / 7); return d.getFullYear() + "-W" + wk; }
  if (cycle === "monthly") return d.getFullYear() + "-" + (d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

// ── 사내위키: 왼쪽 제목 목록 내비 (말줄임·세로 스크롤만) ──────────────────────────
function WikiNav({ wikis, onSelect, onNew, query, setQuery, selId, favs = [] }) {
  const [open, setOpen] = useState({});
  const groups = useMemo(() => {
    const m = {}; wikis.forEach((d) => { (m[d.category || "미분류"] ||= []).push(d); });
    return Object.entries(m).sort((a, b) => b[1].length - a[1].length);
  }, [wikis]);
  const selCat = useMemo(() => (wikis.find((d) => d.id === selId) || {}).category, [wikis, selId]);
  const isOpen = (c) => (open[c] !== undefined ? open[c] : c === selCat); // 기본 접힘 · 현재 문서 분류만 자동 펼침
  const favDocs = wikis.filter((d) => favs.includes(d.id));
  const recent = useMemo(() => [...wikis].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")).slice(0, 5), [wikis]);
  const searching = !!query.trim();
  const Row = ({ d, indent }) => { const on = d.id === selId;
    return (
      <div onClick={() => onSelect(d.id)} title={d.title} style={{ fontSize: 12, color: on ? "#4338ca" : "#475569", fontWeight: on ? 700 : 400, background: on ? "#eef2ff" : "transparent", padding: `5px 8px 5px ${indent}px`, cursor: "pointer", borderRadius: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "#eef2ff66"; }} onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "transparent"; }}>{d.title}</div>
    );
  };
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "#fafbfd", borderRight: "1px solid #e2e8f0" }}>
      <div style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: "#1e293b" }}>📖 사내위키</span>
          <button onClick={onNew} style={{ marginLeft: "auto", background: "#6366f1", color: "#fff", border: "none", borderRadius: 7, padding: "4px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>+ 새</button>
        </div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="🔍 검색" style={{ width: "100%", boxSizing: "border-box", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px", fontSize: 12, outline: "none", color: "#1e293b" }} />
      </div>
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "6px 5px 20px" }}>
        {searching ? (
          <>
            {wikis.map((d) => <Row key={d.id} d={d} indent={10} />)}
            {wikis.length === 0 && <div style={{ fontSize: 11, color: "#cbd5e1", padding: 16, textAlign: "center" }}>검색 결과 없음</div>}
          </>
        ) : (
          <>
            {favDocs.length > 0 && (
              <div style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#f59e0b", padding: "4px 8px" }}>⭐ 즐겨찾기</div>
                {favDocs.map((d) => <Row key={d.id} d={d} indent={16} />)}
              </div>
            )}
            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", padding: "4px 8px" }}>🕒 최근</div>
              {recent.map((d) => <Row key={d.id} d={d} indent={16} />)}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", padding: "8px 8px 4px", borderTop: "1px solid #eef2f7", marginTop: 4 }}>분류</div>
            {groups.map(([cat, docs]) => {
              const c = catColor(cat), o = isOpen(cat);
              return (
                <div key={cat} style={{ marginBottom: 1 }}>
                  <div onClick={() => setOpen((p) => ({ ...p, [cat]: !(p[cat] !== undefined ? p[cat] : cat === selCat) }))} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 8px", cursor: "pointer", borderRadius: 6 }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#eef2f7")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <span style={{ fontSize: 9, color: "#94a3b8", width: 8, flexShrink: 0 }}>{o ? "▾" : "▸"}</span>
                    <span style={{ width: 7, height: 7, borderRadius: 2, background: c, flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{CAT_ICON[cat] || "📁"} {cat}</span>
                    <span style={{ marginLeft: "auto", fontSize: 10, color: "#cbd5e1", flexShrink: 0 }}>{docs.length}</span>
                  </div>
                  {o && docs.map((d) => <Row key={d.id} d={d} indent={25} />)}
                </div>
              );
            })}
            {groups.length === 0 && <div style={{ fontSize: 11, color: "#cbd5e1", padding: 16, textAlign: "center" }}>문서 없음</div>}
          </>
        )}
      </div>
    </div>
  );
}

// ── 사내위키: 오른쪽 환영(문서 미선택 시) ──────────────────────────────────────
function WikiWelcome({ wikis, onSelect }) {
  const starters = [{ icon: "📘", title: "지식센터 사용법", sub: "위키·매뉴얼 쓰는 법" }, { icon: "🏢", title: "회사 소개", sub: "미션·사업·조직" }, { icon: "🤖", title: "AI 사용 범위 정책", sub: "AI를 어디까지 쓰나" }];
  const recent = [...wikis].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")).slice(0, 8);
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "44px 32px", display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 560, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>📖</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#1e293b", marginBottom: 5 }}>무엇을 찾으세요?</div>
          <div style={{ fontSize: 12.5, color: "#94a3b8", lineHeight: 1.6 }}>왼쪽에서 문서를 고르거나 아래에서 시작하세요.<br />문서 안 파란 링크로 계속 이동할 수 있어요.</div>
        </div>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: "#16a34a", marginBottom: 9 }}>🌱 처음이세요? 여기부터</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginBottom: 26 }}>
          {starters.map((s) => { const d = wikis.find((x) => x.title === s.title);
            return (
              <div key={s.title} onClick={() => d && onSelect(d.id)} style={{ display: "flex", alignItems: "center", gap: 9, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "12px 13px", cursor: d ? "pointer" : "default", opacity: d ? 1 : 0.45 }}>
                <span style={{ fontSize: 22 }}>{s.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#14532d", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                  <div style={{ fontSize: 10, color: "#16a34a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.sub}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: "#64748b", marginBottom: 8 }}>🕒 최근 변경</div>
        <div>
          {recent.map((d) => (
            <div key={d.id} onClick={() => onSelect(d.id)} style={{ fontSize: 12.5, color: "#475569", padding: "6px 8px", cursor: "pointer", borderRadius: 6 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>· {d.title}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 사내위키: 나무위키식 대문 (미사용 — WikiNav/WikiWelcome로 대체) ─────────────
function WikiHome({ wikis, onSelect, onNew, query, setQuery, favs, compact, selId }) {
  const [openCats, setOpenCats] = useState({});
  const groups = useMemo(() => {
    const m = {};
    wikis.forEach((d) => { (m[d.category || "미분류"] ||= []).push(d); });
    return Object.entries(m).sort((a, b) => b[1].length - a[1].length);
  }, [wikis]);
  const recent = useMemo(() => [...wikis].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")).slice(0, 6), [wikis]);
  const favDocs = wikis.filter((d) => favs.includes(d.id));
  const searching = !!query.trim();
  const isOpen = (cat) => openCats[cat] !== false;
  const toggle = (cat) => setOpenCats((p) => ({ ...p, [cat]: p[cat] === false ? true : false }));
  const ago = (iso) => { if (!iso) return ""; const s = (Date.now() - new Date(iso).getTime()) / 1000; if (s < 60) return "방금"; if (s < 3600) return Math.floor(s / 60) + "분 전"; if (s < 86400) return Math.floor(s / 3600) + "시간 전"; return Math.floor(s / 86400) + "일 전"; };
  return (
    <div style={{ flex: 1, overflowY: "auto", background: compact ? "#fafbfd" : "linear-gradient(180deg,#fbfcff,#fff 220px)" }}>
      <div style={{ maxWidth: compact ? "none" : 1240, margin: "0 auto", padding: compact ? "14px 14px 30px" : "22px 32px 50px" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: compact ? 15 : 20, fontWeight: 800, color: "#1e293b" }}>📖 사내위키</div>
            {!compact && <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 3 }}>회사의 모든 지식이 여기 있어요. 검색하거나 아래에서 골라보세요 👇</div>}
          </div>
          <button onClick={onNew} style={{ marginLeft: "auto", background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: compact ? "5px 10px" : "8px 15px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>+ 새 위키</button>
        </div>
        {/* 큰 검색 */}
        <div style={{ position: "relative", marginBottom: 18 }}>
          <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", fontSize: 16 }}>🔍</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="무엇을 찾으세요?" style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "14px 16px 14px 44px", fontSize: 14, outline: "none", color: "#1e293b" }} />
        </div>
        {searching ? (
          <div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>검색 결과 {wikis.length}건</div>
            {wikis.map((d) => (
              <div key={d.id} onClick={() => onSelect(d.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                <span>📖</span><span style={{ fontSize: 13.5, fontWeight: 600, color: "#334155" }}>{d.title}</span>
                <span style={{ marginLeft: "auto", fontSize: 10, color: "#94a3b8" }}>{d.category}</span>
              </div>
            ))}
            {wikis.length === 0 && <div style={{ color: "#cbd5e1", fontSize: 13, padding: 20 }}>검색 결과 없음</div>}
          </div>
        ) : (
          <>
            {/* 🌱 처음이세요? 여기부터 */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: "#16a34a", marginBottom: 9 }}>🌱 처음이세요? 여기부터</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                {[{ icon: "📘", title: "지식센터 사용법", sub: "위키·매뉴얼 쓰는 법" }, { icon: "🏢", title: "회사 소개", sub: "미션·사업·조직" }, { icon: "🤖", title: "AI 사용 범위 정책", sub: "AI를 어디까지 쓰나" }].map((s) => {
                  const d = wikis.find((x) => x.title === s.title);
                  return (
                    <div key={s.title} onClick={() => d && onSelect(d.id)} style={{ display: "flex", alignItems: "center", gap: 11, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "13px 15px", cursor: d ? "pointer" : "default", opacity: d ? 1 : 0.45 }}
                      onMouseEnter={(e) => { if (d) e.currentTarget.style.boxShadow = "0 4px 14px #16a34a22"; }} onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}>
                      <span style={{ fontSize: 24 }}>{s.icon}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#14532d", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                        <div style={{ fontSize: 10.5, color: "#16a34a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.sub}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 🕒 최근 변경 */}
            <div style={{ marginBottom: 16, lineHeight: 2 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginRight: 6 }}>🕒 최근 변경</span>
              {recent.map((d) => <span key={d.id} onClick={() => onSelect(d.id)} style={{ fontSize: 12, color: "#475569", cursor: "pointer", marginRight: 12 }}>· {d.title} <span style={{ color: "#cbd5e1" }}>{ago(d.updatedAt)}</span></span>)}
            </div>

            {/* 분류 컬러 타일 보드 */}
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, borderTop: "1px solid #f1f5f9", paddingTop: 16 }}>분류</div>
            <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "repeat(auto-fill, minmax(250px, 1fr))", gap: compact ? 10 : 14, alignItems: "start" }}>
              {groups.map(([cat, docs]) => {
                const c = catColor(cat), open = openCats[cat] === true, shown = open ? docs : docs.slice(0, 4);
                return (
                  <div key={cat} style={{ background: "#fff", border: "1px solid #e2e8f0", borderTop: `3px solid ${c}`, borderRadius: 12, boxShadow: "0 2px 10px #00000010", overflow: "hidden" }}>
                    <div style={{ padding: "10px 14px", background: c + "0e", display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ fontSize: 16 }}>{CAT_ICON[cat] || "📁"}</span>
                      <span style={{ fontSize: 13.5, fontWeight: 800, color: "#1e293b" }}>{cat}</span>
                      <span style={{ marginLeft: "auto", fontSize: 11, color: c, fontWeight: 700, background: "#fff", borderRadius: 10, padding: "1px 9px" }}>{docs.length}</span>
                    </div>
                    <div style={{ padding: "6px 10px 9px" }}>
                      {shown.map((d) => (
                        <div key={d.id} onClick={() => onSelect(d.id)} style={{ fontSize: 12.5, color: "#475569", padding: "5px 7px", cursor: "pointer", borderRadius: 6 }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = c + "12"; e.currentTarget.style.color = "#1e293b"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#475569"; }}>
                          <span style={{ color: c, marginRight: 4 }}>·</span>{d.title}
                        </div>
                      ))}
                      {docs.length > 4 && (
                        <div onClick={() => setOpenCats((p) => ({ ...p, [cat]: !p[cat] }))} style={{ fontSize: 11, color: c, fontWeight: 700, cursor: "pointer", padding: "6px 7px" }}>
                          {open ? "▴ 접기" : `+ ${docs.length - 4}개 더보기 →`}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {groups.length === 0 && <div style={{ color: "#cbd5e1", fontSize: 13, padding: 20 }}>위키가 없습니다. + 새 위키로 시작하세요.</div>}
          </>
        )}
      </div>
    </div>
  );
}

// ── 업무매뉴얼: 조직도형 보드 ──────────────────────────────────────────────────
function ManualBoard({ manuals, onSelect, onNew, query, setQuery, favs }) {
  const [filter, setFilter] = useState("all");
  const list = manuals.filter((d) => filter === "all" || (d.manualType || "procedure") === filter);
  const groups = useMemo(() => {
    const m = {};
    list.forEach((d) => { (m[d.category || "기타"] ||= []).push(d); });
    return Object.entries(m).sort((a, b) => b[1].length - a[1].length);
  }, [list]);
  const favM = manuals.filter((d) => favs.includes(d.id));
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px 22px 30px", background: "#f8fafc" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: "#1e293b" }}>📋 업무매뉴얼</span>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="🔍 매뉴얼 검색" style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, outline: "none", width: 180, color: "#1e293b" }} />
        <div style={{ display: "flex", gap: 5 }}>
          {[["all", "전체", "#6366f1"], ["procedure", "📋 절차", "#6366f1"], ["routine", "🔁 반복", "#16a34a"], ["form", "📄 양식", "#f59e0b"]].map(([v, l, c]) => (
            <button key={v} onClick={() => setFilter(v)} style={{ padding: "5px 12px", borderRadius: 14, fontSize: 11.5, cursor: "pointer", fontWeight: 600, border: "1px solid " + (filter === v ? c : "#e2e8f0"), background: filter === v ? c + "15" : "#fff", color: filter === v ? c : "#94a3b8" }}>{l}</button>
          ))}
        </div>
        <button onClick={onNew} style={{ marginLeft: "auto", background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ 새 매뉴얼</button>
      </div>
      {favM.length > 0 && filter === "all" && !query && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", marginBottom: 6 }}>⭐ 자주 찾는</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {favM.map((d) => { const mt = mtypeOf(d); return <span key={d.id} onClick={() => onSelect(d.id)} style={{ display: "flex", alignItems: "center", gap: 5, background: "#fff", border: `1px solid ${mt.color}44`, borderRadius: 16, padding: "5px 11px", fontSize: 12, color: "#334155", cursor: "pointer", fontWeight: 600 }}>{mt.icon} {d.title}</span>; })}
          </div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 14, alignItems: "start" }}>
        {groups.map(([cat, docs]) => {
          const c = catColor(cat);
          return (
            <div key={cat} style={{ background: "#fff", border: "1px solid #e2e8f0", borderTop: `3px solid ${c}`, borderRadius: 12, boxShadow: "0 2px 10px #00000010", overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", background: c + "0e", display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: 15 }}>{CAT_ICON[cat] || "📁"}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#1e293b" }}>{cat}</span>
                <span style={{ marginLeft: "auto", fontSize: 10, color: "#94a3b8" }}>{docs.length}</span>
              </div>
              <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
                {docs.map((d) => { const mt = mtypeOf(d);
                  return (
                    <div key={d.id} onClick={() => onSelect(d.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 9, cursor: "pointer", border: "1px solid #f1f5f9", background: "#fff" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = mt.bg; e.currentTarget.style.borderColor = mt.color + "44"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#f1f5f9"; }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: mt.color, background: mt.bg, border: `1px solid ${mt.color}33`, padding: "1px 6px", borderRadius: 6, flexShrink: 0, whiteSpace: "nowrap" }}>{mt.icon}{mt.label}</span>
                      <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</span>
                      {d.manualType === "routine" && d.routine?.cycle && <span style={{ fontSize: 9, color: "#16a34a", flexShrink: 0 }}>{cycleKo(d.routine.cycle)}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {groups.length === 0 && <div style={{ color: "#cbd5e1", fontSize: 13, padding: 30 }}>{query ? "검색 결과 없음" : "매뉴얼이 없습니다."}</div>}
      </div>
    </div>
  );
}

// ── 업무매뉴얼: 유형별 상세 라우터 ──────────────────────────────────────────────
function ManualDetail(props) {
  const t = props.doc.manualType || "procedure";
  if (t === "routine") return <RoutineView {...props} />;
  if (t === "form") return <FormView {...props} />;
  return <QuestMap {...props} />;
}

// ── 반복형: 루틴 체크리스트 ─────────────────────────────────────────────────────
function RoutineView({ doc, patchDoc, onEdit, onDelete, onBack }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const r = doc.routine || { cycle: "daily", items: [] };
  const items = r.items || [];
  // 주기 도래 시 자동 초기화 (열 때 1회 판정)
  const [autoReset, setAutoReset] = useState(false);
  useEffect(() => {
    const cur = periodKey(r.cycle);
    const last = r.lastReset ? periodKey(r.cycle, new Date(r.lastReset)) : null;
    if (last !== cur && items.some((i) => i.done)) {
      patchDoc(doc.id, { routine: { ...r, items: items.map((it) => ({ ...it, done: false })), lastReset: new Date().toISOString() } });
      setAutoReset(true);
    }
  }, [doc.id]); // eslint-disable-line
  const done = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round(done / items.length * 100) : 0;
  const toggle = (idx) => patchDoc(doc.id, { routine: { ...r, items: items.map((it, i) => (i === idx ? { ...it, done: !it.done } : it)) } });
  const resetAll = () => patchDoc(doc.id, { routine: { ...r, items: items.map((it) => ({ ...it, done: false })), lastReset: new Date().toISOString() } });
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "20px 26px", background: "#f0fdf4" }}>
      <button onClick={onBack} style={backBtn}>← 목록</button>
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 0 4px", flexWrap: "wrap" }}>
        <span style={{ fontSize: 20 }}>🔁</span>
        <span style={{ fontSize: 19, fontWeight: 800, color: "#14532d" }}>{doc.title}</span>
        <span style={{ fontSize: 11, color: "#16a34a", background: "#dcfce7", padding: "2px 9px", borderRadius: 10, fontWeight: 700 }}>{cycleKo(r.cycle)} 반복</span>
        <span style={{ fontSize: 11, color: "#64748b" }}>{doc.category}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button onClick={resetAll} style={{ ...ghostBtn, color: "#16a34a", borderColor: "#bbf7d0" }}>↻ 초기화</button>
          <button onClick={onEdit} style={ghostBtn}>✏ 편집</button>
          {confirmDel ? <button onClick={() => onDelete(doc.id)} style={{ ...ghostBtn, color: "#fff", background: "#dc2626", border: "none" }}>삭제확인</button> : <button onClick={() => setConfirmDel(true)} style={{ ...ghostBtn, color: "#dc2626" }}>🗑</button>}
        </div>
      </div>
      <div style={{ height: 10, background: "#dcfce7", borderRadius: 6, overflow: "hidden", margin: "10px 0 4px", maxWidth: 480 }}>
        <div style={{ height: "100%", width: pct + "%", background: "linear-gradient(90deg,#22c55e,#16a34a)", borderRadius: 6, transition: "width .3s" }} />
      </div>
      <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 700, marginBottom: 14 }}>{done}/{items.length} 완료 · {pct}%{pct === 100 ? " 🎉 끝!" : ""}{autoReset && <span style={{ marginLeft: 8, color: "#0ea5e9", fontWeight: 600 }}>↻ 새 {cycleKo(r.cycle)} 시작 — 자동 초기화됨</span>}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 560 }}>
        {items.map((it, i) => (
          <label key={i} style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", background: "#fff", border: "1px solid " + (it.done ? "#bbf7d0" : "#e2e8f0"), borderRadius: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={!!it.done} onChange={() => toggle(i)} style={{ width: 18, height: 18, accentColor: "#16a34a", cursor: "pointer" }} />
            <span style={{ fontSize: 13.5, color: it.done ? "#94a3b8" : "#1e293b", textDecoration: it.done ? "line-through" : "none", fontWeight: 500 }}>{it.text}</span>
          </label>
        ))}
        {items.length === 0 && <div style={{ color: "#94a3b8", fontSize: 12 }}>항목이 없습니다.</div>}
      </div>
    </div>
  );
}

// ── 양식형: 작성법 + 템플릿 다운로드 ────────────────────────────────────────────
function FormView({ doc, docs, patchDoc, onEdit, onDelete, onBack }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();
  const f = doc.form || {};
  const comps = mdComponents(docs, () => {}, () => {});
  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await fetch(`${API}/api/upload`, { method: "POST", body: fd });
      const j = await r.json();
      if (j.ok) patchDoc(doc.id, { form: { ...f, templates: [...(f.templates || []), { name: j.name, url: j.url }] } });
    } catch {}
    setUploading(false);
  };
  const removeTpl = (i) => patchDoc(doc.id, { form: { ...f, templates: (f.templates || []).filter((_, j) => j !== i) } });
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "20px 26px", background: "#fffbeb" }}>
      <button onClick={onBack} style={backBtn}>← 목록</button>
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 0 8px", flexWrap: "wrap" }}>
        <span style={{ fontSize: 20 }}>📄</span>
        <span style={{ fontSize: 19, fontWeight: 800, color: "#92400e" }}>{doc.title}</span>
        <span style={{ fontSize: 11, color: "#b45309", background: "#fef3c7", padding: "2px 9px", borderRadius: 10, fontWeight: 700 }}>양식</span>
        <span style={{ fontSize: 11, color: "#64748b" }}>{doc.category}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button onClick={onEdit} style={ghostBtn}>✏ 편집</button>
          {confirmDel ? <button onClick={() => onDelete(doc.id)} style={{ ...ghostBtn, color: "#fff", background: "#dc2626", border: "none" }}>삭제확인</button> : <button onClick={() => setConfirmDel(true)} style={{ ...ghostBtn, color: "#dc2626" }}>🗑</button>}
        </div>
      </div>
      <div style={{ background: "#fff", border: "1px solid #fde68a", borderRadius: 10, padding: "12px 16px", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#b45309" }}>📎 템플릿</div>
          <input ref={fileRef} type="file" style={{ display: "none" }} accept=".doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,.hwp,.txt,.zip" onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(file); e.target.value = ""; }} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ marginLeft: "auto", background: "#fef3c7", border: "1px solid #fde68a", color: "#92400e", borderRadius: 7, padding: "5px 11px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>{uploading ? "⏳ 업로드중…" : "＋ 템플릿 업로드"}</button>
        </div>
        {(f.templates || []).length === 0 ? <div style={{ fontSize: 11.5, color: "#94a3b8" }}>아직 템플릿이 없습니다. 위 버튼으로 .docx/.xlsx 등을 올리세요.</div>
          : <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{f.templates.map((t, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "7px 10px", fontSize: 12, color: "#92400e", fontWeight: 600 }}>
                <a href={t.url} target="_blank" rel="noreferrer" style={{ color: "#92400e", textDecoration: "none" }}>⤓ {t.name}</a>
                <span onClick={() => removeTpl(i)} style={{ cursor: "pointer", color: "#d97706" }}>✕</span>
              </span>))}</div>}
      </div>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "16px 20px" }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={comps}>{preprocess(doc.body, docs)}</ReactMarkdown>
      </div>
    </div>
  );
}

// ── 온보딩: 홈(과정 카드 + 진도) ───────────────────────────────────────────────
const Ring = ({ pct, accent = "#6366f1" }) => {
  const r = 18, cir = 2 * Math.PI * r, off = cir * (1 - pct / 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <svg width="44" height="44" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={r} fill="none" stroke="#e2e8f0" strokeWidth="5" />
        <circle cx="22" cy="22" r={r} fill="none" stroke={pct === 100 ? "#16a34a" : accent} strokeWidth="5" strokeDasharray={cir} strokeDashoffset={off} strokeLinecap="round" transform="rotate(-90 22 22)" />
        <text x="22" y="26" textAnchor="middle" fontSize="11" fontWeight="700" fill={pct === 100 ? "#16a34a" : accent}>{pct}</text>
      </svg>
      <span style={{ fontSize: 11, color: pct === 100 ? "#16a34a" : "#94a3b8", fontWeight: 600 }}>{pct === 100 ? "수료 완료" : pct > 0 ? "학습 중" : "시작 전"}</span>
    </div>
  );
};
function OnboardingHome({ courses, courseProgress, onSelect, onNew }) {
  const common = courses.filter((c) => (c.tags || []).includes("공통"));
  const role = courses.filter((c) => (c.tags || []).includes("직무"));
  const total = courses.length;
  const completed = courses.filter((c) => courseProgress(c) === 100).length;
  const overall = total ? Math.round(courses.reduce((s, c) => s + courseProgress(c), 0) / total) : 0;
  const Sec = ({ title, list, accent }) => (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "#1e293b", marginBottom: 10 }}>{title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: 14 }}>
        {list.map((c) => { const pct = courseProgress(c), d = pct === 100;
          return (
            <div key={c.id} onClick={() => onSelect(c.id)} style={{ background: "#fff", border: "1px solid " + (d ? "#bbf7d0" : "#e2e8f0"), borderRadius: 14, padding: 16, cursor: "pointer", boxShadow: "0 2px 10px #00000010", position: "relative" }}>
              {d && <span style={{ position: "absolute", top: 10, right: 12, fontSize: 18 }}>🏅</span>}
              <div style={{ fontSize: 14, fontWeight: 800, color: "#1e293b", marginBottom: 4 }}>🎓 {c.title}</div>
              <div style={{ fontSize: 10.5, color: "#94a3b8", marginBottom: 12 }}>{(c.steps || []).length}개 강의</div>
              <Ring pct={pct} accent={accent} />
            </div>
          );
        })}
        {list.length === 0 && <div style={{ color: "#cbd5e1", fontSize: 12 }}>과정 없음</div>}
      </div>
    </div>
  );
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "18px 24px 30px", background: "#f8fafc" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ fontSize: 17, fontWeight: 800, color: "#1e293b" }}>🎓 신입 온보딩</span>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>순서대로 학습하고 완료를 체크하세요</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 150, height: 9, background: "#e2e8f0", borderRadius: 5, overflow: "hidden" }}><div style={{ height: "100%", width: overall + "%", background: "linear-gradient(90deg,#6366f1,#22d3ee)" }} /></div>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#4338ca" }}>{overall}% · 수료 {completed}/{total}</span>
          <button onClick={onNew} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>+ 새 과정</button>
        </div>
      </div>
      <Sec title="📦 공통 과정 (전원 필수)" list={common} accent="#6366f1" />
      <Sec title="👔 직무별 과정" list={role} accent="#0ea5e9" />
    </div>
  );
}

// ── 온보딩: 강의 플레이어(인강) ────────────────────────────────────────────────
function CoursePlayer({ doc, docs, obDone, obToggle, onEdit, onBack, onSelect }) {
  const lessons = doc.steps || [];
  const [sel, setSel] = useState(0);
  const lesson = lessons[sel] || null;
  const done = lessons.filter((l) => obDone(doc.id, l.id)).length;
  const pct = lessons.length ? Math.round(done / lessons.length * 100) : 0;
  const comps = mdComponents(docs, onSelect, () => {});
  const isDone = lesson && obDone(doc.id, lesson.id);
  const next = () => { if (lesson) obToggle(doc.id, lesson.id); if (sel < lessons.length - 1) setSel(sel + 1); };
  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0, background: "#fff" }}>
      <div style={{ width: 240, flexShrink: 0, borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", minHeight: 0, background: "#f8fafc" }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0" }}>
          <button onClick={onBack} style={{ ...ghostBtn, fontSize: 11 }}>← 과정 목록</button>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#1e293b", marginTop: 8 }}>🎓 {doc.title}</div>
          <div style={{ height: 7, background: "#e2e8f0", borderRadius: 4, overflow: "hidden", marginTop: 8 }}><div style={{ height: "100%", width: pct + "%", background: "linear-gradient(90deg,#6366f1,#22d3ee)" }} /></div>
          <div style={{ fontSize: 10.5, color: "#6366f1", fontWeight: 700, marginTop: 4 }}>{done}/{lessons.length} · {pct}%{pct === 100 ? " 🏅수료" : ""}</div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 6px" }}>
          {lessons.map((l, i) => { const d = obDone(doc.id, l.id);
            return (
              <div key={l.id} onClick={() => setSel(i)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 7, cursor: "pointer", background: i === sel ? "#eef2ff" : "transparent" }}>
                <span style={{ fontSize: 13 }}>{d ? "✅" : i === sel ? "▶" : "○"}</span>
                <span style={{ fontSize: 11.5, fontWeight: i === sel ? 700 : 500, color: d ? "#94a3b8" : i === sel ? "#4338ca" : "#475569" }}>{i + 1}. {l.title}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "22px 30px" }}>
        {!lesson ? <div style={{ color: "#94a3b8" }}>강의가 없습니다.</div> : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: "#6366f1", background: "#eef2ff", padding: "2px 9px", borderRadius: 8, fontWeight: 700 }}>강의 {sel + 1}/{lessons.length}</span>
              <span style={{ marginLeft: "auto" }}><button onClick={onEdit} style={ghostBtn}>✏ 편집</button></span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1e293b", marginBottom: 12 }}>{lesson.title}</div>
            {lesson.desc ? <div style={{ marginBottom: 18 }}><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={comps}>{preprocess(lesson.desc, docs)}</ReactMarkdown></div>
              : <div style={{ color: "#cbd5e1", fontSize: 13, marginBottom: 18 }}>(강의 내용 작성 예정 — ✏ 편집에서 글·이미지·영상 추가)</div>}
            <div style={{ display: "flex", gap: 8, alignItems: "center", borderTop: "1px solid #f1f5f9", paddingTop: 14 }}>
              <button onClick={next} style={{ background: isDone ? "#fff" : "#16a34a", color: isDone ? "#16a34a" : "#fff", border: isDone ? "1px solid #bbf7d0" : "none", borderRadius: 9, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {isDone ? "✓ 완료됨 (다시 들으려면 클릭)" : sel < lessons.length - 1 ? "✓ 완료하고 다음 강의 ▶" : "✓ 완료 (마지막 강의)"}
              </button>
              {sel > 0 && <button onClick={() => setSel(sel - 1)} style={ghostBtn}>◀ 이전</button>}
              {sel < lessons.length - 1 && <button onClick={() => setSel(sel + 1)} style={ghostBtn}>다음 ▶</button>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
