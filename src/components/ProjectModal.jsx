import { useState, useEffect } from "react";
import { DEPTS } from "../data/mockData";
import { HUMANS } from "../data/humans";
import RecordPanel from "./RecordPanel";

const API = "";

const STATUS_OPTIONS = [
  { id: "planning", label: "기획중", color: "#6366f1" },
  { id: "active",   label: "진행중", color: "#f59e0b" },
  { id: "review",   label: "검토중", color: "#8b5cf6" },
  { id: "done",     label: "완료",   color: "#16a34a" },
];

// convert "MM-DD" → "YYYY-MM-DD", full date passes through
function fullDate(d) {
  if (!d) return "";
  if (d.length === 10) return d;
  return `${new Date().getFullYear()}-${d}`;
}

// tasks as fake gantt cards
function tasksToCards(tasks, projectDept) {
  return tasks.map(t => ({
    id: t.id,
    title: t.t,
    column: t.s === "done" ? "done" : t.s === "active" ? "active" : t.s === "review" ? "review" : "todo",
    dueDate: t.dueDate || fullDate(t.due) || null,
    createdAt: t.startDate || null,
    dept: projectDept || null,
    agentId: null,
    agentName: null,
  }));
}

/* ── inline task row ── */
function TaskRow({ task, onEdit, onDelete }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const human = HUMANS.find(h => h.id === task.a);
  const statusColor = STATUS_OPTIONS.find(s => s.id === task.s)?.color || "#94a3b8";
  const statusLabel = STATUS_OPTIONS.find(s => s.id === task.s)?.label || task.s;
  const dept = DEPTS.find(d => d.id === task.dept);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 5 }}>
      {/* Status dot */}
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor, flexShrink: 0 }} />

      {/* Task name */}
      <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "#1e293b", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {task.t}
      </div>

      {/* Assignee */}
      <div style={{ fontSize: 11, color: "#64748b", flexShrink: 0 }}>
        {human ? `${human.avatar} ${human.name}` : "—"}
      </div>

      {/* Status badge */}
      <span style={{ fontSize: 9, color: statusColor, background: statusColor + "15", padding: "2px 7px", borderRadius: 8, flexShrink: 0 }}>{statusLabel}</span>

      {/* Due */}
      <span style={{ fontSize: 10, color: "#94a3b8", flexShrink: 0 }}>
        {task.dueDate || fullDate(task.due) || "—"}
      </span>

      {/* Actions */}
      <button onClick={() => onEdit(task)} style={{ padding: "3px 8px", borderRadius: 5, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", fontSize: 10, cursor: "pointer", flexShrink: 0 }}>수정</button>
      {confirmDel ? (
        <>
          <button onClick={() => onDelete(task.id)} style={{ padding: "3px 8px", borderRadius: 5, border: "none", background: "#dc2626", color: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>확인</button>
          <button onClick={() => setConfirmDel(false)} style={{ padding: "3px 8px", borderRadius: 5, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 10, cursor: "pointer", flexShrink: 0 }}>취소</button>
        </>
      ) : (
        <button onClick={() => setConfirmDel(true)} style={{ padding: "3px 8px", borderRadius: 5, border: "1px solid #fecaca", background: "#fff5f5", color: "#dc2626", fontSize: 10, cursor: "pointer", flexShrink: 0 }}>삭제</button>
      )}
    </div>
  );
}

/* ── task add/edit form ── */
function TaskForm({ task, onSave, onCancel }) {
  const [t,         setT]         = useState(task?.t         || "");
  const [a,         setA]         = useState(task?.a         || "");
  const [s,         setS]         = useState(task?.s         || "todo");
  const [startDate, setStartDate] = useState(task?.startDate || "");
  const [dueDate,   setDueDate]   = useState(task?.dueDate   || fullDate(task?.due) || "");

  const IS = { width: "100%", boxSizing: "border-box", border: "1px solid #e2e8f0", borderRadius: 7, padding: "6px 10px", fontSize: 11, outline: "none", background: "#fff", color: "#1e293b" };
  const LS = { fontSize: 9, fontWeight: 700, color: "#94a3b8", marginBottom: 2, textTransform: "uppercase" };

  return (
    <div style={{ background: "#f8fafc", border: "1.5px solid #c4b5fd", borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 8, alignItems: "end" }}>
        <div>
          <div style={LS}>업무명 *</div>
          <input value={t} onChange={e => setT(e.target.value)} placeholder="업무명 입력" style={IS} />
        </div>
        <div>
          <div style={LS}>담당자</div>
          <select value={a} onChange={e => setA(e.target.value)} style={IS}>
            <option value="">선택</option>
            {HUMANS.map(h => <option key={h.id} value={h.id}>{h.avatar} {h.name}</option>)}
          </select>
        </div>
        <div>
          <div style={LS}>상태</div>
          <select value={s} onChange={e => setS(e.target.value)} style={IS}>
            {STATUS_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <div style={LS}>시작일</div>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={IS} />
        </div>
        <div>
          <div style={LS}>마감일</div>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={IS} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
        <button onClick={onCancel} style={{ padding: "5px 14px", borderRadius: 7, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 11, cursor: "pointer" }}>취소</button>
        <button
          onClick={() => { if (!t.trim()) return; onSave({ t: t.trim(), a, s, startDate, dueDate, due: dueDate ? dueDate.slice(5) : "" }); }}
          disabled={!t.trim()}
          style={{ padding: "5px 14px", borderRadius: 7, border: "none", background: !t.trim() ? "#e2e8f0" : "#6366f1", color: !t.trim() ? "#94a3b8" : "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
        >저장</button>
      </div>
    </div>
  );
}

/* ── main modal ── */
export default function ProjectModal({ project, onClose, onSaved, onDeleted, mode, initialData, humans = [] }) {
  // mode="edit" + initialData 방식도 지원; 기존 project prop과 호환 유지
  const effectiveProject = initialData || project;
  const isEdit = mode === "edit";
  const isNew  = !effectiveProject;

  const [tab,        setTab]        = useState("info");
  const [title,      setTitle]      = useState(effectiveProject?.title     || "");
  const [dept,       setDept]       = useState(effectiveProject?.dept      || "");
  const [status,     setStatus]     = useState(effectiveProject?.status    || "planning");
  const [desc,       setDesc]       = useState(effectiveProject?.desc      || "");
  const [startDate,  setStartDate]  = useState(effectiveProject?.startDate || "");
  const [due,        setDue]        = useState(effectiveProject?.due       || "");
  const [tasks,      setTasks]      = useState(effectiveProject?.tasks     || []);
  const [members,    setMembers]    = useState(effectiveProject?.members   || []);
  const [saving,     setSaving]     = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [editTask,   setEditTask]   = useState(null);

  const toggleMember = (id) => {
    setMembers(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  // reload tasks/members when project changes
  useEffect(() => {
    if (!isNew && effectiveProject?.tasks) setTasks(effectiveProject.tasks);
    if (!isNew && effectiveProject?.members) setMembers(effectiveProject.members);
  }, [effectiveProject?.id]);

  const saveProject = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      let saved;
      if (isNew) {
        const r = await fetch(`${API}/api/data/projects`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim(), dept, status, desc, due, startDate, members }),
        });
        saved = await r.json();
      } else {
        const targetId = effectiveProject.id;
        const r = await fetch(`${API}/api/data/projects/${targetId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim(), dept, status, desc, due, startDate, members }),
        });
        saved = await r.json();
      }
      onSaved?.(saved);
      if (isNew) onClose();
    } catch {}
    setSaving(false);
  };

  const deleteProject = async () => {
    if (!confirmDel) { setConfirmDel(true); return; }
    await fetch(`${API}/api/data/projects/${effectiveProject.id}`, { method: "DELETE" });
    onDeleted?.(effectiveProject.id);
    onClose();
  };

  const addTask = async (taskData) => {
    const r = await fetch(`${API}/api/data/projects/${effectiveProject.id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(taskData),
    });
    if (r.ok) {
      const newTask = await r.json();
      setTasks(prev => [...prev, newTask]);
      setAddingTask(false);
    }
  };

  const updateTask = async (tid, taskData) => {
    const r = await fetch(`${API}/api/data/projects/${effectiveProject.id}/tasks/${tid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(taskData),
    });
    if (r.ok) {
      const updated = await r.json();
      setTasks(prev => prev.map(t => t.id === tid ? { ...t, ...updated } : t));
      setEditTask(null);
    }
  };

  const deleteTask = async (tid) => {
    await fetch(`${API}/api/data/projects/${effectiveProject.id}/tasks/${tid}`, { method: "DELETE" });
    setTasks(prev => prev.filter(t => t.id !== tid));
  };

  const doneCount = tasks.filter(t => t.s === "done").length;
  const progress  = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  const IS = { width: "100%", boxSizing: "border-box", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 12, outline: "none", background: "#fff", color: "#1e293b", fontFamily: "inherit" };
  const LS = { fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 };

  const TABS = isNew
    ? [{ id: "info", label: "기본 정보" }]
    : [
        { id: "info",    label: "기본 정보" },
        { id: "tasks",   label: `태스크 (${tasks.length})` },
        { id: "gantt",   label: "간트 차트" },
        { id: "records", label: "기록" },
      ];

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "#00000055", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#fff", borderRadius: 14, width: "min(860px, 96vw)", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 16px 48px rgba(0,0,0,0.18)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {!isNew && dept && (
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: DEPTS.find(d => d.id === dept)?.color || "#6366f1", flexShrink: 0 }} />
          )}
          <span style={{ fontSize: 15, fontWeight: 800, color: "#1e293b", flex: 1 }}>
            {isNew ? "새 프로젝트" : isEdit ? `${title || "프로젝트"} 수정` : title || "프로젝트 상세"}
          </span>
          {!isNew && (
            <span style={{ fontSize: 11, color: "#64748b", background: "#f1f5f9", padding: "3px 10px", borderRadius: 8 }}>
              진행률 {progress}%
            </span>
          )}
          <button onClick={onClose} style={{ background: "transparent", border: "1px solid #e2e8f0", color: "#94a3b8", cursor: "pointer", borderRadius: 7, padding: "3px 12px", fontSize: 11 }}>✕</button>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 2, padding: "8px 20px 0", borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "6px 16px", borderRadius: "8px 8px 0 0", border: "none", cursor: "pointer",
                fontSize: 11, fontWeight: 600,
                background: tab === t.id ? "#fff" : "transparent",
                color: tab === t.id ? "#6366f1" : "#94a3b8",
                borderBottom: tab === t.id ? "2px solid #6366f1" : "2px solid transparent",
                marginBottom: -1,
              }}
            >{t.label}</button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: "20px" }}>

          {/* ── 기본 정보 ── */}
          {tab === "info" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={LS}>프로젝트명 *</div>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="프로젝트명 입력" style={{ ...IS, fontSize: 14, fontWeight: 600 }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <div style={LS}>부서</div>
                  <select value={dept} onChange={e => setDept(e.target.value)} style={IS}>
                    <option value="">부서 선택</option>
                    {DEPTS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <div style={LS}>상태</div>
                  <select value={status} onChange={e => setStatus(e.target.value)} style={IS}>
                    {STATUS_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <div style={LS}>시작일</div>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={IS} />
                </div>
                <div>
                  <div style={LS}>마감일</div>
                  <input type="date" value={due} onChange={e => setDue(e.target.value)} style={IS} />
                </div>
              </div>
              <div>
                <div style={LS}>프로젝트 설명</div>
                <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="프로젝트 설명 (선택)" rows={4} style={{ ...IS, resize: "vertical" }} />
              </div>

              {/* ── 담당자 복수 선택 ── */}
              {humans.length > 0 && (
                <div>
                  <div style={LS}>담당자 (복수 선택)</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {humans.map(h => {
                      const selected = members.includes(h.id);
                      return (
                        <div
                          key={h.id}
                          onClick={() => toggleMember(h.id)}
                          style={{
                            display: "flex", alignItems: "center", gap: 6,
                            padding: "5px 10px", borderRadius: 8, cursor: "pointer",
                            border: selected ? "1.5px solid #6366f1" : "1px solid #e2e8f0",
                            background: selected ? "#ede9fe" : "#f8fafc",
                            transition: "all .12s",
                            userSelect: "none",
                          }}
                        >
                          <span style={{ fontSize: 14 }}>{h.avatar}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: selected ? "#6366f1" : "#475569" }}>{h.name}</span>
                          {h.role && <span style={{ fontSize: 9, color: "#94a3b8" }}>{h.role}</span>}
                          {selected && <span style={{ fontSize: 10, color: "#6366f1", fontWeight: 700 }}>✓</span>}
                        </div>
                      );
                    })}
                  </div>
                  {members.length > 0 && (
                    <div style={{ marginTop: 5, fontSize: 10, color: "#6366f1" }}>
                      {members.length}명 선택됨
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── 태스크 ── */}
          {tab === "tasks" && (
            <div>
              {/* Progress bar */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 11, color: "#64748b" }}>전체 진행률</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: DEPTS.find(d => d.id === dept)?.color || "#6366f1" }}>{progress}%</span>
                </div>
                <div style={{ height: 6, background: "#e2e8f0", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: 6, width: `${progress}%`, background: DEPTS.find(d => d.id === dept)?.color || "#6366f1", borderRadius: 3, transition: "width .4s" }} />
                </div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>{doneCount}/{tasks.length} 완료</div>
              </div>

              {/* Task list */}
              {tasks.map(task =>
                editTask?.id === task.id ? (
                  <TaskForm
                    key={task.id}
                    task={editTask}
                    onSave={data => updateTask(task.id, data)}
                    onCancel={() => setEditTask(null)}
                  />
                ) : (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onEdit={t => setEditTask(t)}
                    onDelete={deleteTask}
                  />
                )
              )}

              {tasks.length === 0 && !addingTask && (
                <div style={{ padding: "20px 0", textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
                  태스크가 없습니다. 아래 버튼으로 추가해보세요.
                </div>
              )}

              {/* Add task form */}
              {addingTask ? (
                <TaskForm
                  onSave={addTask}
                  onCancel={() => setAddingTask(false)}
                />
              ) : (
                <button
                  onClick={() => setAddingTask(true)}
                  style={{ width: "100%", padding: "8px 0", borderRadius: 8, border: "1.5px dashed #c4b5fd", background: "transparent", color: "#6366f1", fontSize: 11, fontWeight: 600, cursor: "pointer", marginTop: 4 }}
                >+ 태스크 추가</button>
              )}
            </div>
          )}

          {/* ── 간트 차트 ── */}
          {tab === "gantt" && (
            <div style={{ height: 400, display: "flex", flexDirection: "column", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "8px 14px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>📊 태스크 타임라인</span>
                <span style={{ fontSize: 10, color: "#94a3b8" }}>(시작일~마감일 기준)</span>
              </div>
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, color: "#94a3b8" }}>
                <span style={{ fontSize: 24 }}>📊</span>
                <span style={{ fontSize: 12 }}>간트 차트는 상단 "간트" 탭에서 확인하세요</span>
              </div>
            </div>
          )}

          {/* ── 기록 ── */}
          {tab === "records" && (
            <RecordPanel entityType="proj" entityId={project.id} />
          )}
        </div>

        {/* Footer */}
        {(tab === "info") && (
          <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            {!isNew && (
              confirmDel ? (
                <>
                  <span style={{ fontSize: 11, color: "#dc2626", fontWeight: 600 }}>프로젝트를 삭제할까요?</span>
                  <button onClick={deleteProject} style={{ padding: "6px 14px", borderRadius: 7, border: "none", background: "#dc2626", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>확인</button>
                  <button onClick={() => setConfirmDel(false)} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 11, cursor: "pointer" }}>취소</button>
                </>
              ) : (
                <button onClick={() => setConfirmDel(true)} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid #fecaca", background: "#fff5f5", color: "#dc2626", fontSize: 11, cursor: "pointer" }}>프로젝트 삭제</button>
              )
            )}
            <div style={{ flex: 1 }} />
            <button onClick={onClose} style={{ padding: "6px 16px", borderRadius: 7, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", fontSize: 11, cursor: "pointer" }}>취소</button>
            <button
              onClick={saveProject}
              disabled={saving || !title.trim()}
              style={{ padding: "6px 18px", borderRadius: 7, border: "none", background: saving || !title.trim() ? "#e2e8f0" : "#6366f1", color: saving || !title.trim() ? "#94a3b8" : "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
            >{saving ? "저장중..." : isNew ? "프로젝트 생성" : "저장"}</button>
          </div>
        )}
      </div>
    </div>
  );
}
