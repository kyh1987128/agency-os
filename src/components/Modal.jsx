import { useState, useEffect, useRef } from "react";
import { COLORS, getDept, STATUS, TASK_STATUS_COLOR } from "../data/mockData";
import { HUMANS, getHuman } from "../data/humans";
import { AI_AGENTS } from "../data/agents";
import NodeComments from "./NodeComments";

const API = "";

const { bg: B, surface: S, border: BR, text: T, muted: M } = COLORS;

const STATUS_LABEL = { done: "완료", active: "진행중", todo: "대기" };

// Stat bar component
function StatBar({ label, value, color }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: M }}>{label}</span>
        <span style={{ fontSize: 10, color, fontWeight: 600 }}>{value}</span>
      </div>
      <div style={{ height: 4, background: BR, borderRadius: 2 }}>
        <div style={{ height: 4, width: `${value}%`, background: color, borderRadius: 2, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

// Human detail panel
function HumanDetail({ human, onClose, projData = [] }) {
  const dept = getDept(human.dept);
  const myTasks = projData.flatMap((p) =>
    p.tasks
      .map((t, i) => ({ ...t, proj: p, idx: i }))
      .filter((t) => t.a === human.id)
  );

  // Deterministic stats from id
  const seed = human.id.charCodeAt(human.id.length - 1);
  const stats = [
    { label: "창의력", value: 60 + (seed * 7) % 35, color: "#f472b6" },
    { label: "실행력", value: 55 + (seed * 11) % 40, color: "#34d399" },
    { label: "협업력", value: 65 + (seed * 5)  % 30, color: "#60a5fa" },
  ];

  return (
    <>
      {/* Profile header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: human.color + "10", borderRadius: 10, marginBottom: 16, border: "1px solid " + human.color + "22" }}>
        <div style={{ width: 52, height: 52, borderRadius: 12, background: human.color + "20", border: "2px solid " + human.color + "44", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>
          {human.avatar}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: T }}>{human.name}</span>
            <span style={{ fontSize: 9, background: human.color, color: "white", padding: "2px 7px", borderRadius: 8, fontWeight: 600 }}>
              Lv.{20 + (seed % 15)}
            </span>
          </div>
          <div style={{ fontSize: 11, color: human.color, fontWeight: 600, marginBottom: 2 }}>{human.title}</div>
          <div style={{ fontSize: 10, color: M }}>{dept?.name} · {human.mood}</div>
        </div>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: human.status === "active" ? "#22c55e" : "#94a3b8", flexShrink: 0 }} />
      </div>

      {/* Stats */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: M, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>역량 지표</div>
        {stats.map((s) => <StatBar key={s.label} {...s} />)}
      </div>

      {/* Assigned tasks */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: M, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
          담당 업무 ({myTasks.length}건)
        </div>
        {myTasks.length === 0 && (
          <div style={{ fontSize: 11, color: M, textAlign: "center", padding: "16px 0" }}>담당 업무 없음</div>
        )}
        {myTasks.map((t, i) => {
          const tc   = TASK_STATUS_COLOR[t.s];
          const dept2 = getDept(t.proj.dept);
          return (
            <div key={i} style={{ padding: "10px 12px", background: B, borderRadius: 8, marginBottom: 6, borderLeft: "3px solid " + tc }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: T }}>{t.t}</span>
                <span style={{ fontSize: 9, color: tc, background: tc + "18", padding: "2px 7px", borderRadius: 6 }}>{STATUS_LABEL[t.s]}</span>
              </div>
              <div style={{ fontSize: 10, color: dept2?.color, marginBottom: 2 }}>{t.proj.title}</div>
              <div style={{ display: "flex", gap: 10 }}>
                <span style={{ fontSize: 9, color: M }}>마감 {t.due}</span>
                <span style={{ fontSize: 9, color: M }}>진행도 {t.proj.progress}%</span>
              </div>
              {/* Mini progress */}
              <div style={{ height: 3, background: BR, borderRadius: 2, marginTop: 6 }}>
                <div style={{ height: 3, width: t.proj.progress + "%", background: tc, borderRadius: 2 }} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// Project detail panel
function ProjectDetail({ proj, projectId = "default" }) {
  const d = getDept(proj.dept);
  const s = STATUS[proj.status];
  const [tab, setTab]       = useState("tasks");
  const [notes, setNotes]   = useState([]);
  const [input, setInput]   = useState("");
  const [files, setFiles]   = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    if (tab === "notes") {
      fetch(`${API}/api/projects/${projectId}/notes`)
        .then(r => r.json()).then(data => setNotes(Array.isArray(data) ? data : [])).catch(() => {});
    }
  }, [tab, projectId]);

  const handleFileChange = async (e) => {
    const picked = Array.from(e.target.files);
    if (!picked.length) return;
    setUploading(true);
    const uploaded = [];
    for (const f of picked) {
      const fd = new FormData();
      fd.append("file", f);
      try {
        const res = await fetch(`${API}/api/upload`, { method: "POST", body: fd });
        const data = await res.json();
        if (data.ok) uploaded.push({ name: data.name, url: data.url, size: data.size, mime: data.mime });
      } catch {}
    }
    setFiles(prev => [...prev, ...uploaded]);
    setUploading(false);
    e.target.value = "";
  };

  const submitNote = async () => {
    if (!input.trim() && files.length === 0) return;
    try {
      const res = await fetch(`${API}/api/projects/${projectId}/notes`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: input, files }),
      });
      const note = await res.json();
      setNotes(prev => [note, ...prev]);
      setInput(""); setFiles([]);
    } catch {}
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const deleteNote = async (nid) => {
    if (confirmDeleteId !== nid) { setConfirmDeleteId(nid); return; }
    await fetch(`${API}/api/projects/${projectId}/notes/${nid}`, { method: "DELETE" });
    setNotes(prev => prev.filter(n => n.id !== nid));
    setConfirmDeleteId(null);
  };

  const isImage = (mime) => mime?.startsWith("image/");
  const fmtSize = (b) => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)}MB` : `${(b / 1024).toFixed(0)}KB`;

  return (
    <>
      {/* 헤더 */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T, marginBottom: 6 }}>{proj.title}</div>
        <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
          <span style={{ fontSize: 10, color: d?.color, background: d?.color + "18", padding: "2px 8px", borderRadius: 10, border: "1px solid " + d?.color + "22" }}>{d?.name}</span>
          <span style={{ fontSize: 10, color: s?.c, background: s?.bg, padding: "2px 8px", borderRadius: 10 }}>{s?.label}</span>
        </div>
      </div>
      <div style={{ height: 6, background: BR, borderRadius: 3, marginBottom: 4 }}>
        <div style={{ height: 6, width: proj.progress + "%", background: d?.color, borderRadius: 3 }} />
      </div>
      <div style={{ fontSize: 11, color: d?.color, marginBottom: 14 }}>{proj.progress}% · 마감 {proj.due}</div>

      {/* 탭 */}
      <div style={{ display: "flex", gap: 2, borderBottom: "1px solid " + BR, marginBottom: 14 }}>
        {[["tasks", "📋 업무"], ["notes", "📝 메모"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding: "6px 14px", border: "none", background: "transparent", cursor: "pointer",
            fontSize: 11, fontWeight: 600,
            color: tab === id ? d?.color : M,
            borderBottom: tab === id ? `2px solid ${d?.color}` : "2px solid transparent",
            marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      {/* 업무 탭 */}
      {tab === "tasks" && (
        <>
          <div style={{ fontSize: 11, color: M, lineHeight: 1.6, marginBottom: 14 }}>{proj.desc}</div>
          {proj.tasks.map((t, i) => {
            const hu = getHuman(t.a);
            const tc = TASK_STATUS_COLOR[t.s];
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: B, borderRadius: 8, marginBottom: 6, borderLeft: "3px solid " + tc }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: T, fontWeight: 600 }}>{t.t}</div>
                  <div style={{ fontSize: 10, color: M, marginTop: 2 }}>{hu?.avatar} {hu?.name} · 마감 {t.due}</div>
                </div>
                <span style={{ fontSize: 9, color: tc, background: tc + "18", padding: "2px 8px", borderRadius: 6 }}>{STATUS_LABEL[t.s]}</span>
              </div>
            );
          })}
        </>
      )}

      {/* 메모 탭 */}
      {tab === "notes" && (
        <>
          {/* 입력창 */}
          <div style={{ border: "1px solid " + BR, borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="메모를 입력하세요..."
              rows={3}
              style={{ width: "100%", boxSizing: "border-box", border: "none", padding: "10px 12px", fontSize: 12, color: T, resize: "none", outline: "none", fontFamily: "inherit" }}
            />
            {/* 첨부 파일 미리보기 */}
            {files.length > 0 && (
              <div style={{ padding: "6px 12px", display: "flex", flexWrap: "wrap", gap: 6, borderTop: "1px solid " + BR }}>
                {files.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, background: B, borderRadius: 6, padding: "4px 8px", fontSize: 10, color: M }}>
                    {isImage(f.mime)
                      ? <img src={`${API}${f.url}`} alt={f.name} style={{ width: 24, height: 24, objectFit: "cover", borderRadius: 3 }} />
                      : <span>📎</span>}
                    <span style={{ maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                    <span style={{ color: "#94a3b8" }}>{fmtSize(f.size)}</span>
                    <span onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} style={{ cursor: "pointer", color: "#cbd5e1", marginLeft: 2 }}>✕</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", borderTop: "1px solid " + BR, background: "#fafafa" }}>
              <input ref={fileRef} type="file" multiple onChange={handleFileChange} style={{ display: "none" }} />
              <button onClick={() => fileRef.current?.click()} style={{ background: "transparent", border: "1px solid " + BR, borderRadius: 6, padding: "4px 10px", fontSize: 11, color: M, cursor: "pointer" }}>
                {uploading ? "업로드중..." : "📎 파일"}
              </button>
              <div style={{ flex: 1 }} />
              <button
                onClick={submitNote}
                disabled={!input.trim() && files.length === 0}
                style={{ background: (!input.trim() && files.length === 0) ? BR : d?.color, color: "#fff", border: "none", borderRadius: 6, padding: "5px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
              >등록</button>
            </div>
          </div>

          {/* 노트 목록 */}
          {notes.length === 0 && (
            <div style={{ textAlign: "center", color: M, fontSize: 12, padding: "20px 0" }}>아직 메모가 없습니다</div>
          )}
          {notes.map(note => (
            <div key={note.id} style={{ border: "1px solid " + BR, borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 13 }}>👤</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: T }}>{note.author}</span>
                  <span style={{ fontSize: 10, color: M }}>{new Date(note.createdAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                {confirmDeleteId === note.id ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ fontSize: 10, color: "#dc2626" }}>삭제할까요?</span>
                    <span onClick={() => deleteNote(note.id)} style={{ fontSize: 10, color: "#dc2626", fontWeight: 700, cursor: "pointer", padding: "1px 6px", border: "1px solid #fecaca", borderRadius: 4 }}>확인</span>
                    <span onClick={() => setConfirmDeleteId(null)} style={{ fontSize: 10, color: M, cursor: "pointer", padding: "1px 6px", border: "1px solid " + BR, borderRadius: 4 }}>취소</span>
                  </div>
                ) : (
                  <span onClick={() => deleteNote(note.id)} style={{ fontSize: 10, color: "#cbd5e1", cursor: "pointer" }}>✕</span>
                )}
              </div>
              {note.content && <div style={{ fontSize: 12, color: T, lineHeight: 1.7, whiteSpace: "pre-wrap", marginBottom: note.files?.length ? 8 : 0 }}>{note.content}</div>}
              {note.files?.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {note.files.map((f, i) => (
                    isImage(f.mime)
                      ? <a key={i} href={`${API}${f.url}`} target="_blank" rel="noreferrer">
                          <img src={`${API}${f.url}`} alt={f.name} style={{ height: 72, borderRadius: 6, objectFit: "cover", border: "1px solid " + BR }} />
                        </a>
                      : <a key={i} href={`${API}${f.url}`} target="_blank" rel="noreferrer"
                          style={{ display: "flex", alignItems: "center", gap: 5, background: B, borderRadius: 6, padding: "5px 10px", fontSize: 11, color: "#6366f1", textDecoration: "none" }}>
                          📎 {f.name} <span style={{ color: M }}>({fmtSize(f.size)})</span>
                        </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </>
  );
}

// Task detail panel
function TaskDetail({ task, proj, human }) {
  const tc   = TASK_STATUS_COLOR[task.s];
  const dept = proj ? getDept(proj.dept) : null;
  // nodeId: allNodes 기반(task.id) 또는 구형(task.id)
  const nodeId = task.id || null;
  const pid    = proj?.id || null;
  const [memo, setMemo] = useState(task.desc || "");
  const [memoSaved, setMemoSaved] = useState(false);
  const saveMemo = async () => {
    if (!nodeId || !pid) return;
    try {
      await fetch(`${API}/api/data/projects/${pid}/nodes/${nodeId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ desc: memo }) });
      setMemoSaved(true); setTimeout(() => setMemoSaved(false), 1500);
    } catch {}
  };
  return (
    <>
      <div style={{ padding: "12px 14px", background: tc + "10", borderRadius: 10, border: "1px solid " + tc + "33", marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: tc, marginBottom: 4 }}>{task.t || task.title}</div>
        <div style={{ fontSize: 10, color: M }}>마감 {task.due || task.dueDate || "—"}</div>
      </div>

      {proj && (
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          <span style={{ fontSize: 10, color: dept?.color, background: dept?.color + "15", padding: "3px 10px", borderRadius: 8 }}>{dept?.name}</span>
          <span style={{ fontSize: 10, color: T, background: B, padding: "3px 10px", borderRadius: 8 }}>{proj.title}</span>
        </div>
      )}

      {human && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, color: M, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>담당자</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: human.color + "10", borderRadius: 10, border: "1px solid " + human.color + "22" }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: human.color + "20", border: "1px solid " + human.color + "44", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
              {human.avatar}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T }}>{human.name}</div>
              <div style={{ fontSize: 10, color: human.color }}>{human.title}</div>
              <div style={{ fontSize: 9, color: M, marginTop: 2 }}>{human.mood}</div>
            </div>
          </div>
        </>
      )}

      {/* 상태·진행 + 메모 (편집 가능) */}
      {nodeId && pid && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 10, color: tc, background: tc + "18", padding: "3px 10px", borderRadius: 8, fontWeight: 600 }}>{STATUS_LABEL[task.s] || task.s || "—"}</span>
            {typeof task.progress === "number" && <span style={{ fontSize: 10, color: M, background: B, padding: "3px 10px", borderRadius: 8 }}>진행 {task.progress}%</span>}
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: M, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>메모</div>
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="메모를 입력하세요..." rows={3}
            style={{ width: "100%", boxSizing: "border-box", border: "1px solid " + BR, borderRadius: 8, padding: "9px 11px", fontSize: 12, color: T, resize: "vertical", outline: "none", fontFamily: "inherit" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <button onClick={saveMemo} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 7, padding: "6px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>메모 저장</button>
            {memoSaved && <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>✓ 저장됨</span>}
          </div>
        </div>
      )}

      {/* 댓글 섹션 — nodeId와 pid가 모두 있을 때만 표시 */}
      {nodeId && pid && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: M, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>댓글</div>
          <NodeComments pid={pid} nodeId={nodeId} />
        </div>
      )}
    </>
  );
}

// Agent detail panel
function AgentDetail({ agentData }) {
  const dept  = getDept(agentData.dept);
  const seed  = agentData.id.charCodeAt(agentData.id.length - 1);
  const stats = [
    { label: "처리속도", value: 70 + (seed * 9) % 28, color: "#a78bfa" },
    { label: "정확도",   value: 75 + (seed * 7) % 22, color: "#34d399" },
    { label: "학습률",   value: 65 + (seed * 13)% 30, color: "#60a5fa" },
  ];
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "#8b5cf610", borderRadius: 10, marginBottom: 16, border: "1px solid #8b5cf622" }}>
        <div style={{ width: 52, height: 52, borderRadius: 12, background: "#8b5cf620", border: "2px solid #8b5cf644", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
          🤖
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: T }}>{agentData.name}</span>
            <span style={{ fontSize: 9, background: "#8b5cf6", color: "white", padding: "2px 7px", borderRadius: 8 }}>AI</span>
          </div>
          <div style={{ fontSize: 11, color: "#8b5cf6", fontWeight: 600, marginBottom: 2 }}>{agentData.role}</div>
          <div style={{ fontSize: 10, color: M }}>{dept?.name}</div>
        </div>
        <div style={{ marginLeft: "auto", width: 8, height: 8, borderRadius: "50%", background: agentData.status === "active" ? "#22c55e" : "#94a3b8" }} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: M, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>성능 지표</div>
        {stats.map((s) => <StatBar key={s.label} {...s} />)}
      </div>
      <div style={{ padding: "10px 14px", background: B, borderRadius: 8, border: "1px solid " + BR }}>
        <div style={{ fontSize: 10, color: M, marginBottom: 4 }}>담당 부서</div>
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ fontSize: 10, color: dept?.color, background: dept?.color + "15", padding: "3px 10px", borderRadius: 8 }}>{dept?.name}</span>
        </div>
      </div>
    </>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function Modal({ item, onClose, activeProject = "default", projData = [] }) {
  if (!item) return null;

  // Resolve data
  const human = item.type === "human"
    ? (HUMANS.find((h) => h.id === item.id) || item.human)
    : item.human;

  const proj = item.type === "project"
    ? projData.find((p) => p.id === item.id) || item.data
    : item.proj;

  const task     = item.task;
  const agentData = item.agentData;

  const accentColor =
    human?.color || getDept(proj?.dept)?.color || "#8b5cf6";

  const title =
    item.type === "human"   ? "팀원 상세" :
    item.type === "project" ? "프로젝트 상세" :
    item.type === "task"    ? "업무 상세" :
    item.type === "agent"   ? "AI 에이전트" : "상세";

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "#00000044", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: S, border: "1px solid " + accentColor + "33", borderRadius: 14, width: 480, maxWidth: "92vw", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid " + BR, position: "sticky", top: 0, background: S, zIndex: 1 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: accentColor, textTransform: "uppercase", letterSpacing: 1 }}>{title}</span>
          <button onClick={onClose} style={{ background: "transparent", border: "1px solid " + BR, color: M, cursor: "pointer", borderRadius: 6, padding: "3px 12px", fontSize: 11 }}>✕ 닫기</button>
        </div>

        <div style={{ padding: "16px 18px" }}>
          {item.type === "human"   && human    && <HumanDetail   human={human} onClose={onClose} projData={projData} />}
          {item.type === "project" && proj      && <ProjectDetail proj={proj} projectId={activeProject} />}
          {item.type === "task"    && task      && <TaskDetail    task={task} proj={proj} human={human} />}
          {item.type === "agent"   && agentData && <AgentDetail   agentData={agentData} />}
        </div>
      </div>
    </div>
  );
}
