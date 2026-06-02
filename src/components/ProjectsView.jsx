import { useState, useRef, useCallback, useEffect } from "react";
import { COLORS, STATUS } from "../data/mockData";
import ProjectModal from "./ProjectModal";
import MindMapView from "./MindMapView";

const API = "";
const { surface: S, border: BR, text: T, muted: M } = COLORS;

const STATUS_TABS = [
  { id: "all",      label: "전체" },
  { id: "active",   label: "진행중" },
  { id: "planning", label: "기획중" },
  { id: "review",   label: "검토중" },
  { id: "done",     label: "완료" },
];

const STATUS_OPTIONS = [
  { id: "planning", label: "기획중", color: "#6366f1" },
  { id: "active",   label: "진행중", color: "#f59e0b" },
  { id: "review",   label: "검토중", color: "#8b5cf6" },
  { id: "done",     label: "완료",   color: "#16a34a" },
];

function fullDate(d) {
  if (!d) return "";
  if (d.length === 10) return d;
  return `${new Date().getFullYear()}-${d}`;
}

function tasksToCards(tasks, dept, humans) {
  return tasks.map(t => {
    const human = humans.find(h => h.id === t.a);
    return {
      id: t.id, title: t.t,
      column: t.s === "done" ? "done" : t.s === "active" ? "active" : t.s === "review" ? "review" : "todo",
      dueDate: t.dueDate || fullDate(t.due) || null,
      createdAt: t.startDate || null,
      dept: dept || null,
      agentId: t.a || null,
      agentName: human?.name || null,
      agentAvatar: human?.avatar || null,
    };
  });
}

/* ── StatCard ── */
function StatCard({ icon, label, value, color, bg }) {
  return (
    <div style={{ flex: 1, background: S, border: "1px solid " + BR, borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 36, height: 36, borderRadius: 9, background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
        <div style={{ fontSize: 10, color: M, marginTop: 1 }}>{label}</div>
      </div>
    </div>
  );
}

/* ── AI 현황 요약 생성 ── */
function buildSummary(nodes, project) {
  const done    = nodes.filter(n => n.status === "done").length;
  const active  = nodes.filter(n => n.status === "active");
  const review  = nodes.filter(n => n.status === "review");
  const todo    = nodes.filter(n => n.status === "todo").length;
  const total   = nodes.length;
  const pct     = total ? Math.round((done / total) * 100) : 0;
  const daysLeft = project.due ? Math.ceil((new Date(project.due) - new Date()) / 864e5) : null;
  const isDelayed = daysLeft !== null && daysLeft < 0 && project.status !== "done";

  const lines = [];
  lines.push({ icon: "📊", text: `전체 진행률 ${pct}% — 업무 ${done}/${total}개 완료` });

  if (daysLeft !== null) {
    if (project.status === "done")   lines.push({ icon: "✅", text: "프로젝트 완료" });
    else if (isDelayed)               lines.push({ icon: "⚠️", text: `마감일 ${Math.abs(daysLeft)}일 초과 — 일정 재검토 필요` });
    else if (daysLeft === 0)          lines.push({ icon: "🔴", text: "오늘 마감" });
    else if (daysLeft <= 7)           lines.push({ icon: "🟠", text: `마감 D-${daysLeft} — 마감 임박` });
    else                              lines.push({ icon: "📅", text: `마감 D-${daysLeft}` });
  }

  if (active.length > 0)
    lines.push({ icon: "🔄", text: `진행중: ${active.map(n => n.title).join(", ")}` });
  if (review.length > 0)
    lines.push({ icon: "🔍", text: `검토중: ${review.map(n => n.title).join(", ")}` });
  if (todo > 0)
    lines.push({ icon: "⏸", text: `대기중 ${todo}개` });
  if (total === 0)
    lines.push({ icon: "📝", text: "칸반에서 업무를 추가하면 현황이 표시됩니다" });

  return lines;
}

/* ── bottom detail panel ── */
function ProjectDetailPanel({ project, onProjDataChange, onDeselect, departments, humans, allNodes = [] }) {
  const [tab,        setTab]        = useState("info");
  const [editMode,   setEditMode]   = useState(false);
  const [title,      setTitle]      = useState(project.title     || "");
  const [dept,       setDept]       = useState(project.dept      || "");
  const [status,     setStatus]     = useState(project.status    || "planning");
  const [desc,       setDesc]       = useState(project.desc      || "");
  const [startDate,  setStartDate]  = useState(project.startDate || "");
  const [due,        setDue]        = useState(project.due       || "");
  const [saving,     setSaving]     = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  // sync when project changes
  useEffect(() => {
    setTitle(project.title     || "");
    setDept(project.dept       || "");
    setStatus(project.status   || "planning");
    setDesc(project.desc       || "");
    setStartDate(project.startDate || "");
    setDue(project.due         || "");
    setTab("info");
    setEditMode(false);
    setConfirmDel(false);
  }, [project.id]);

  const cancelEdit = () => {
    setTitle(project.title     || "");
    setDept(project.dept       || "");
    setStatus(project.status   || "planning");
    setDesc(project.desc       || "");
    setStartDate(project.startDate || "");
    setDue(project.due         || "");
    setEditMode(false);
    setConfirmDel(false);
  };

  const saveProject = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await fetch(`${API}/api/data/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), dept, status, desc, due, startDate }),
    });
    onProjDataChange?.();
    setSaving(false);
    setEditMode(false);
  };

  const deleteProject = async () => {
    if (!confirmDel) { setConfirmDel(true); return; }
    await fetch(`${API}/api/data/projects/${project.id}`, { method: "DELETE" });
    onProjDataChange?.();
    onDeselect?.();
  };

  const projNodes = allNodes.filter(n => n.projectId === project.id);
  const progress  = project.progress || 0;
  const doneCount = projNodes.filter(n => n.status === "done").length;
  const totalCount = projNodes.length;
  const dColor    = departments.find(d => d.id === dept)?.color || "#6366f1";
  const deptObj   = departments.find(d => d.id === (editMode ? dept : project.dept));
  const statusObj = STATUS_OPTIONS.find(s => s.id === (editMode ? status : project.status));
  const summary   = buildSummary(projNodes, project);

  const TABS_DEF = [
    { id: "info", label: "기본 정보" },
  ];

  const IS = { width: "100%", boxSizing: "border-box", border: "1px solid #e2e8f0", borderRadius: 7, padding: "7px 10px", fontSize: 12, outline: "none", background: "#fff", color: "#1e293b", fontFamily: "inherit" };
  const LS = { fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 4, textTransform: "uppercase" };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Panel header */}
      <div style={{ padding: "8px 16px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: dColor }} />
        <span style={{ fontSize: 13, fontWeight: 800, color: "#1e293b", flex: 1 }}>{project.title}</span>
        <span style={{ fontSize: 11, color: "#64748b", background: "#e2e8f0", padding: "2px 10px", borderRadius: 8 }}>진행률 {progress}%</span>
        <button onClick={onDeselect} style={{ background: "transparent", border: "1px solid #e2e8f0", color: "#94a3b8", cursor: "pointer", borderRadius: 6, padding: "2px 10px", fontSize: 11 }}>✕</button>
      </div>

      {/* Tab bar — 저장/삭제 버튼 없음 */}
      <div style={{ display: "flex", gap: 2, padding: "0 16px", borderBottom: "1px solid #e2e8f0", flexShrink: 0, background: "#fff" }}>
        {TABS_DEF.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); if (t.id !== "info") setEditMode(false); }} style={{
            padding: "7px 16px", border: "none", cursor: "pointer",
            fontSize: 11, fontWeight: 600, background: "transparent",
            color: tab === t.id ? "#6366f1" : "#94a3b8",
            borderBottom: tab === t.id ? "2px solid #6366f1" : "2px solid transparent",
          }}>{t.label}</button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{
        flex: 1,
        overflow: "auto",
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}>

        {/* ══ 기본 정보 — 2패널 ══ */}
        {tab === "info" && (() => {
          // 담당 인력: allNodes 기반으로 assignees 배열로 그룹핑
          const teamMap = new Map();
          projNodes.forEach(node => {
            const assigneeIds = node.assignees || (node.assignee ? [node.assignee] : []);
            if (assigneeIds.length === 0) {
              const key = "__unassigned__";
              if (!teamMap.has(key)) teamMap.set(key, { human: null, nodes: [] });
              teamMap.get(key).nodes.push(node);
            } else {
              assigneeIds.forEach(aid => {
                const human = humans.find(h => h.id === aid);
                if (!teamMap.has(aid)) teamMap.set(aid, { human, nodes: [] });
                teamMap.get(aid).nodes.push(node);
              });
            }
          });
          const teamList = Array.from(teamMap.values());

          return (
            <div style={{ display: "flex", gap: 16, flex: 1, minHeight: 0, overflow: "auto" }}>

              {/* ── LEFT: 프로젝트 정보 + 담당 인력 ── */}
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>

                {/* 프로젝트 정보 섹션 */}
                {!editMode ? (
                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>프로젝트 정보</span>
                      <button onClick={() => setEditMode(true)}
                        style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 10, cursor: "pointer" }}>
                        ✏️ 수정
                      </button>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#1e293b", marginBottom: 8 }}>{project.title}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 8 }}>
                      <div>
                        <div style={LS}>부서</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          {deptObj && <div style={{ width: 7, height: 7, borderRadius: "50%", background: deptObj.color, flexShrink: 0 }} />}
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#1e293b" }}>{deptObj?.name || "—"}</span>
                        </div>
                      </div>
                      <div>
                        <div style={LS}>상태</div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: statusObj?.color || "#94a3b8", background: (statusObj?.color || "#94a3b8") + "18", padding: "2px 8px", borderRadius: 8 }}>
                          {statusObj?.label || "—"}
                        </span>
                      </div>
                      <div>
                        <div style={LS}>시작일</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b" }}>{project.startDate || "—"}</div>
                      </div>
                      <div>
                        <div style={LS}>마감일</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b" }}>{project.due || "—"}</div>
                      </div>
                    </div>
                    {project.desc && (
                      <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.7, background: "#fff", border: "1px solid #f1f5f9", borderRadius: 7, padding: "7px 10px" }}>
                        {project.desc}
                      </div>
                    )}
                  </div>
                ) : (
                  /* ── 수정 모드 ── */
                  <div style={{ background: "#f0f0ff", border: "1.5px solid #c4b5fd", borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#6366f1", textTransform: "uppercase" }}>✏️ 수정 모드</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        {confirmDel ? (
                          <>
                            <span style={{ fontSize: 11, color: "#dc2626", fontWeight: 600 }}>삭제할까요?</span>
                            <button onClick={deleteProject} style={{ padding: "3px 8px", borderRadius: 6, border: "none", background: "#dc2626", color: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>확인</button>
                            <button onClick={() => setConfirmDel(false)} style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 10, cursor: "pointer" }}>취소</button>
                          </>
                        ) : (
                          <button onClick={() => setConfirmDel(true)} style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid #fecaca", background: "#fff5f5", color: "#dc2626", fontSize: 10, cursor: "pointer" }}>삭제</button>
                        )}
                        <button onClick={cancelEdit} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 11, cursor: "pointer" }}>취소</button>
                        <button onClick={saveProject} disabled={saving || !title.trim()} style={{ padding: "3px 12px", borderRadius: 6, border: "none", background: saving || !title.trim() ? "#e2e8f0" : "#6366f1", color: saving || !title.trim() ? "#94a3b8" : "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                          {saving ? "저장중..." : "저장"}
                        </button>
                      </div>
                    </div>
                    <div><div style={LS}>프로젝트명 *</div><input value={title} onChange={e => setTitle(e.target.value)} style={{ ...IS, fontSize: 13, fontWeight: 600 }} /></div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div><div style={LS}>부서</div>
                        <select value={dept} onChange={e => setDept(e.target.value)} style={IS}>
                          <option value="">부서 선택</option>
                          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      </div>
                      <div><div style={LS}>상태</div>
                        <select value={status} onChange={e => setStatus(e.target.value)} style={IS}>
                          {STATUS_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                        </select>
                      </div>
                      <div><div style={LS}>시작일</div><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={IS} /></div>
                      <div><div style={LS}>마감일</div><input type="date" value={due} onChange={e => setDue(e.target.value)} style={IS} /></div>
                    </div>
                    <div><div style={LS}>프로젝트 설명</div><textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="프로젝트 설명 (선택)" rows={2} style={{ ...IS, resize: "vertical" }} /></div>
                  </div>
                )}

                {/* ── 담당 인력 섹션 ── */}
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
                    👥 담당 인력 및 업무
                  </div>
                  {teamList.length === 0 ? (
                    <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", padding: "10px 0" }}>칸반에서 업무를 추가하면 표시됩니다</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {teamList.map(({ human, nodes: hnodes }, idx) => (
                        <div key={idx} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                          {/* Person avatar */}
                          <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, width: 52 }}>
                            <div style={{ fontSize: 22, lineHeight: 1 }}>{human?.avatar || "👤"}</div>
                            <div style={{ fontSize: 9, fontWeight: 700, color: "#1e293b", textAlign: "center", lineHeight: 1.3 }}>{human?.name || "미지정"}</div>
                            {human?.role && <div style={{ fontSize: 8, color: "#94a3b8", textAlign: "center" }}>{human.role}</div>}
                          </div>
                          {/* Nodes for this person */}
                          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                            {hnodes.map(node => {
                              const statusColors = { todo: "#94a3b8", active: "#f59e0b", review: "#6366f1", done: "#34d399" };
                              const statusLabels = { todo: "대기", active: "진행중", review: "검토중", done: "완료" };
                              const sc = statusColors[node.status] || "#94a3b8";
                              const due = node.dueDate ? node.dueDate.slice(5) : null;
                              return (
                                <div key={node.id} style={{ display: "flex", alignItems: "center", gap: 6, background: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: 7, padding: "5px 9px" }}>
                                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: sc, flexShrink: 0 }} />
                                  <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.title}</span>
                                  <span style={{ fontSize: 9, color: sc, background: sc + "15", padding: "1px 6px", borderRadius: 6, flexShrink: 0, fontWeight: 600 }}>{statusLabels[node.status] || "—"}</span>
                                  {node.progress > 0 && <span style={{ fontSize: 9, color: "#94a3b8", flexShrink: 0 }}>{node.progress}%</span>}
                                  {due && <span style={{ fontSize: 9, color: "#94a3b8", flexShrink: 0 }}>~{due}</span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── RIGHT: 진행 현황 + 핵심 목표 + AI 분석 ── */}
              <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 10 }}>

                {/* 진행률 카드 */}
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 8 }}>진행 현황</div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: "#64748b" }}>완료율</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: dColor }}>{progress}%</span>
                  </div>
                  <div style={{ height: 6, background: "#e2e8f0", borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
                    <div style={{ height: 6, width: `${progress}%`, background: dColor, borderRadius: 3, transition: "width .3s" }} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                    {[
                      { label: "완료",  count: projNodes.filter(n => n.status === "done").length,   color: "#16a34a" },
                      { label: "진행중", count: projNodes.filter(n => n.status === "active").length, color: "#f59e0b" },
                      { label: "검토중", count: projNodes.filter(n => n.status === "review").length, color: "#8b5cf6" },
                      { label: "대기",  count: projNodes.filter(n => n.status === "todo").length,   color: "#94a3b8" },
                    ].map(s => (
                      <div key={s.label} style={{ background: "#fff", border: "1px solid #f1f5f9", borderRadius: 6, padding: "5px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 9, color: s.color, fontWeight: 600 }}>{s.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: s.color }}>{s.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 핵심 목표 (미완료 업무) */}
                {projNodes.filter(n => n.status !== "done").length > 0 && (
                  <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#92400e", textTransform: "uppercase", marginBottom: 8 }}>🎯 해결해야 할 업무</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {projNodes.filter(n => n.status !== "done").map(node => {
                        const sOpt  = STATUS_OPTIONS.find(o => o.id === node.status);
                        const firstAssigneeId = (node.assignees && node.assignees[0]) || node.assignee || null;
                        const human = humans.find(h => h.id === firstAssigneeId);
                        const due   = node.dueDate ? node.dueDate.slice(5) : null;
                        return (
                          <div key={node.id} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                            <div style={{ width: 5, height: 5, borderRadius: "50%", background: sOpt?.color || "#94a3b8", flexShrink: 0, marginTop: 4 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.title}</div>
                              <div style={{ display: "flex", gap: 4, marginTop: 2, alignItems: "center" }}>
                                {human && <span style={{ fontSize: 9, color: "#64748b" }}>{human.avatar} {human.name}</span>}
                                <span style={{ fontSize: 9, color: sOpt?.color || "#94a3b8", fontWeight: 600 }}>{sOpt?.label}</span>
                                {due && <span style={{ fontSize: 9, color: "#92400e" }}>~{due}</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* AI 현황 분석 */}
                <div style={{ background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: 10, padding: "12px 14px", flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
                    <span>✦</span> AI 현황 분석
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {summary.map((line, i) => (
                      <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                        <span style={{ fontSize: 12, flexShrink: 0 }}>{line.icon}</span>
                        <span style={{ fontSize: 11, color: "#475569", lineHeight: 1.5 }}>{line.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════ */
/* ── main ProjectsView (2-panel split)        ── */
/* ══════════════════════════════════════════════ */
export default function ProjectsView({ onSelect, projData = [], onProjDataChange, departments = [], humans = [], allNodes = [] }) {
  const [statusFilter,     setStatusFilter]     = useState("all");
  const [selectedProject,  setSelectedProject]  = useState(null);
  const [showNewModal,     setShowNewModal]      = useState(false);
  const [editProject,      setEditProject]       = useState(null);
  const [topRatio,         setTopRatio]          = useState(45); // % of split area
  const [resizeHover,      setResizeHover]       = useState(false);
  const [viewMode,         setViewMode]          = useState("mindmap");

  const splitRef = useRef(null);

  const filtered = statusFilter === "all" ? projData : projData.filter(p => p.status === statusFilter);

  const stats = {
    total:   projData.length,
    active:  projData.filter(p => p.status === "active").length,
    done:    projData.filter(p => p.status === "done").length,
    delayed: projData.filter(p => p.status !== "done" && new Date(p.due) < new Date()).length,
  };

  // sync selectedProject with fresh data
  useEffect(() => {
    if (selectedProject) {
      const fresh = projData.find(p => p.id === selectedProject.id);
      if (fresh) setSelectedProject(fresh);
    }
  }, [projData]);

  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    const startY     = e.clientY;
    const startRatio = topRatio;
    const onMove = (e) => {
      const container = splitRef.current;
      if (!container) return;
      const h = container.getBoundingClientRect().height;
      const delta = ((e.clientY - startY) / h) * 100;
      setTopRatio(Math.min(85, Math.max(15, startRatio + delta)));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [topRatio]);

  return (
    <>
      {/* New project modal */}
      {showNewModal && (
        <ProjectModal
          project={null}
          onClose={() => setShowNewModal(false)}
          onSaved={() => { setShowNewModal(false); onProjDataChange?.(); }}
          onDeleted={() => { setShowNewModal(false); onProjDataChange?.(); }}
          humans={humans}
        />
      )}

      {/* Edit project modal */}
      {editProject && (
        <ProjectModal
          mode="edit"
          initialData={editProject}
          onClose={() => setEditProject(null)}
          onSaved={() => { setEditProject(null); onProjDataChange?.(); }}
          onDeleted={() => { setEditProject(null); onProjDataChange?.(); }}
          humans={humans}
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

        {/* ── Top bar (new button) ── */}
        <div style={{ padding: "8px 16px", borderBottom: "1px solid " + BR, background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          {/* 상태 탭 — Map 뷰일 때 숨김 */}
          {viewMode !== "mindmap" && (
            <div style={{ display: "flex", gap: 3, background: "#f1f5f9", borderRadius: 8, padding: 3 }}>
              {STATUS_TABS.map(tab => (
                <button key={tab.id} onClick={() => setStatusFilter(tab.id)} style={{
                  padding: "4px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600,
                  background: statusFilter === tab.id ? "#6366f1" : "transparent",
                  color: statusFilter === tab.id ? "#fff" : M,
                }}>{tab.label}</button>
              ))}
            </div>
          )}
          {viewMode === "mindmap" && <div />}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* 뷰 모드 토글 */}
            <div style={{ display: "flex", gap: 2, background: "#f1f5f9", borderRadius: 8, padding: 3 }}>
              <button
                onClick={() => setViewMode("mindmap")}
                style={{
                  padding: "4px 12px", borderRadius: 6, border: "none", cursor: "pointer",
                  fontSize: 11, fontWeight: 600,
                  background: viewMode === "mindmap" ? "#fff" : "transparent",
                  color: viewMode === "mindmap" ? "#6366f1" : M,
                  boxShadow: viewMode === "mindmap" ? "0 1px 3px #0000001a" : "none",
                  transition: "all .15s",
                }}
              >
                Map 뷰
              </button>
              <button
                onClick={() => setViewMode("list")}
                style={{
                  padding: "4px 12px", borderRadius: 6, border: "none", cursor: "pointer",
                  fontSize: 11, fontWeight: 600,
                  background: viewMode === "list" ? "#fff" : "transparent",
                  color: viewMode === "list" ? "#6366f1" : M,
                  boxShadow: viewMode === "list" ? "0 1px 3px #0000001a" : "none",
                  transition: "all .15s",
                }}
              >
                목록
              </button>
            </div>
            <button onClick={() => setShowNewModal(true)} style={{ padding: "6px 16px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 13 }}>+</span> 새 프로젝트
            </button>
          </div>
        </div>

        {/* ── MindMap 뷰 ── */}
        {viewMode === "mindmap" && (
          <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
            <MindMapView projData={projData} onProjDataChange={onProjDataChange} departments={departments} humans={humans} />
          </div>
        )}

        {/* ── Split area (목록 뷰) ── */}
        {viewMode === "list" && <div ref={splitRef} style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>

          {/* ── Top: project cards ── */}
          <div style={{ flex: selectedProject ? topRatio : 1, minHeight: 100, overflow: "auto" }}>
            <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
              {/* stat cards */}
              <div style={{ display: "flex", gap: 8 }}>
                <StatCard icon="📁" label="전체 프로젝트" value={stats.total}   color="#1e293b" bg="#f1f5f9" />
                <StatCard icon="🔄" label="진행중"         value={stats.active}  color="#d97706" bg="#fef3c7" />
                <StatCard icon="✅" label="완료"           value={stats.done}    color="#16a34a" bg="#dcfce7" />
                <StatCard icon="⚠️" label="지연"           value={stats.delayed} color="#dc2626" bg="#fee2e2" />
              </div>

              {/* project grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {filtered.map(proj => {
                  const d        = departments.find(dep => dep.id === proj.dept);
                  const s        = STATUS[proj.status];
                  const cardNodes = allNodes.filter(n => n.projectId === proj.id);
                  const done     = cardNodes.filter(n => n.status === "done").length;
                  const total    = cardNodes.length;
                  const daysLeft = Math.ceil((new Date(proj.due) - new Date()) / (1000 * 60 * 60 * 24));
                  const isDelayed = daysLeft < 0 && proj.status !== "done";
                  const isSelected = selectedProject?.id === proj.id;

                  // members 필드 우선, 없으면 allNodes assignees 기반 인력으로 폴백
                  const nodeAssigneeIds = [...new Set(
                    cardNodes.flatMap(n => n.assignees || (n.assignee ? [n.assignee] : []))
                  )];
                  const hus = nodeAssigneeIds.map(id => humans.find(h => h.id === id)).filter(Boolean);
                  const memberHumans = Array.isArray(proj.members) && proj.members.length > 0
                    ? proj.members.map(id => humans.find(h => h.id === id)).filter(Boolean)
                    : hus;

                  return (
                    <div
                      key={proj.id}
                      onClick={() => setSelectedProject(isSelected ? null : proj)}
                      className="card-hover"
                      style={{
                        background: isSelected ? "#ede9fe" : S,
                        border: isSelected ? "2px solid #6366f1" : "1px solid " + BR,
                        borderTop: `3px solid ${d?.color}`,
                        borderRadius: 10, padding: "12px 14px", cursor: "pointer",
                        display: "flex", flexDirection: "column", gap: 8,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: T, marginBottom: 5, lineHeight: 1.3 }}>{proj.title}</div>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 9, color: d?.color, background: d?.color + "15", padding: "1px 7px", borderRadius: 8 }}>{d?.name}</span>
                            <span style={{ fontSize: 9, color: s?.c, background: s?.bg, padding: "1px 7px", borderRadius: 8 }}>{s?.label}</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 6, flexShrink: 0, marginLeft: 8 }}>
                          <div style={{ fontSize: 20, fontWeight: 800, color: d?.color, lineHeight: 1 }}>{proj.progress}%</div>
                          <button
                            onClick={e => { e.stopPropagation(); setEditProject(proj); }}
                            style={{ padding: "2px 8px", borderRadius: 5, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569", fontSize: 9, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
                          >수정</button>
                        </div>
                      </div>
                      <div style={{ height: 4, background: BR, borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: 4, width: proj.progress + "%", background: d?.color, borderRadius: 2 }} />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ fontSize: 9, color: M }}>태스크 <span style={{ fontWeight: 700, color: "#16a34a" }}>{done}</span>/{total}</div>
                        <div style={{ fontSize: 9, color: isDelayed ? "#dc2626" : M, fontWeight: isDelayed ? 700 : 400 }}>
                          {isDelayed ? `⚠️ ${Math.abs(daysLeft)}일 지연` : proj.status === "done" ? "✅ 완료" : `D-${daysLeft}`}
                        </div>
                      </div>
                      {proj.desc && (
                        <div style={{
                          fontSize: 11,
                          color: "#64748b",
                          lineHeight: 1.4,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}>
                          {proj.desc}
                        </div>
                      )}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid " + BR, paddingTop: 7 }}>
                        <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                          {memberHumans.slice(0, 2).map(h => (
                            <span key={h.id} style={{
                              fontSize: 10, color: h.color || "#6366f1",
                              background: (h.color || "#6366f1") + "18",
                              border: `1px solid ${(h.color || "#6366f1")}33`,
                              padding: "1px 6px", borderRadius: 10, fontWeight: 600,
                              whiteSpace: "nowrap",
                            }}>{h.name}</span>
                          ))}
                          {memberHumans.length > 2 && (
                            <span style={{ fontSize: 9, color: "#6366f1", background: "#ede9fe", borderRadius: 10, padding: "1px 5px", fontWeight: 700 }}>
                              +{memberHumans.length - 2}
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 9, color: M }}>{proj.due}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <div style={{ gridColumn: "1/-1", padding: "30px 0", textAlign: "center", color: M, fontSize: 12 }}>해당 상태의 프로젝트가 없습니다</div>
                )}
              </div>
            </div>
          </div>

          {/* ── Resize handle + bottom panel (only when project selected) ── */}
          {selectedProject && (
            <>
              <div
                onMouseDown={handleResizeStart}
                onMouseEnter={() => setResizeHover(true)}
                onMouseLeave={() => setResizeHover(false)}
                style={{
                  height: 10,
                  flexShrink: 0,
                  cursor: "row-resize",
                  background: resizeHover ? "#dde3f0" : "#e8edf5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  userSelect: "none",
                  gap: 3,
                  transition: "background 0.15s",
                }}
              >
                {[0,1,2,3,4].map(i => (
                  <div key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: resizeHover ? "#6366f1" : "#b0bec8" }} />
                ))}
              </div>

              <div style={{ flex: 100 - topRatio, minHeight: 80, overflow: "hidden", display: "flex", flexDirection: "column", borderTop: "1px solid " + BR }}>
                <ProjectDetailPanel
                  project={selectedProject}
                  onProjDataChange={onProjDataChange}
                  onDeselect={() => setSelectedProject(null)}
                  departments={departments}
                  humans={humans}
                  allNodes={allNodes}
                />
              </div>
            </>
          )}

          {/* ── Placeholder when nothing selected ── */}
          {!selectedProject && (
            <div style={{ padding: "10px 14px", borderTop: "1px solid " + BR, background: "#f8fafc", color: M, fontSize: 12, textAlign: "center", flexShrink: 0 }}>
              프로젝트 카드를 클릭하면 상세 정보가 여기에 표시됩니다
            </div>
          )}
        </div>}

      </div>
    </>
  );
}
