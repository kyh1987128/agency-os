import { useState, useEffect, useMemo, useRef } from "react";
import {
  DndContext, DragOverlay, PointerSensor,
  useSensor, useSensors, closestCorners, useDroppable,
  pointerWithin, rectIntersection,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import NodeComments from "./NodeComments";

const API = "";

const COLS = [
  { id: "todo",   label: "📋 대기중", color: "#475569" },
  { id: "active", label: "⚡ 진행중", color: "#f59e0b" },
  { id: "review", label: "🔍 검토중", color: "#6366f1" },
  { id: "done",   label: "✅ 완료",   color: "#34d399" },
];

// 칸반 멀티컬럼 충돌 감지: 포인터 우선(빈 컬럼도 정확히 인식),
// 포인터가 어떤 드롭 영역에도 없을 때만 rect/corner 기반으로 폴백.
// closestCorners 단독은 세로로 긴 빈 컬럼을 놓쳐 빈 컬럼 드롭이 안 되는 문제가 있어 교체.
function kanbanCollision(args) {
  const pointer = pointerWithin(args);
  if (pointer.length > 0) return pointer;
  const rect = rectIntersection(args);
  if (rect.length > 0) return rect;
  return closestCorners(args);
}

const STATUS_INFO = [
  { id: "todo",   label: "대기중", color: "#475569" },
  { id: "active", label: "진행중", color: "#f59e0b" },
  { id: "review", label: "검토중", color: "#6366f1" },
  { id: "done",   label: "완료",   color: "#34d399" },
];

/* ─── 유틸 ─── */
function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
}

function DueBadge({ dueDate }) {
  if (!dueDate) return null;
  const d = daysUntil(dueDate);
  let color = "#94a3b8", label = `D-${d}`, prefix = "";
  if (d < 0)        { color = "#dc2626"; label = `${Math.abs(d)}일 지연`; prefix = "⚠️ "; }
  else if (d === 0) { color = "#ea580c"; label = "오늘 마감"; }
  else if (d <= 3)  { color = "#d97706"; }
  return (
    <span style={{ fontSize: 9, color, fontWeight: d !== null && d <= 3 ? 700 : 400 }}>
      {prefix}{label}
    </span>
  );
}

/* ─── CardItem (순수 표시용, DragOverlay에도 사용) ─── */
function CardItem({ card, projData, departments, humans, isOverlay }) {
  const proj = projData.find(p => p.id === card.projectId);
  const dept = departments.find(d => d.id === proj?.dept);
  const assigneeHumans = (card.assignees || [])
    .map(id => humans.find(h => h.id === id))
    .filter(Boolean);
  const statusColor = {
    todo: "#94a3b8", active: "#f59e0b", review: "#6366f1", done: "#34d399",
  }[card.status] || "#94a3b8";

  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e2e8f0",
      borderLeft: `3px solid ${statusColor}`,
      borderRadius: 8,
      padding: "8px 10px",
      marginBottom: 6,
      boxShadow: isOverlay
        ? "0 4px 12px rgba(0,0,0,0.15)"
        : "0 1px 2px rgba(0,0,0,0.04)",
      userSelect: "none",
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 4, lineHeight: 1.4 }}>
        {card.title}
      </div>
      {proj && (
        <div style={{ marginBottom: 4 }}>
          <span style={{
            fontSize: 9,
            color: dept?.color || "#6366f1",
            background: (dept?.color || "#6366f1") + "15",
            padding: "1px 6px",
            borderRadius: 8,
          }}>
            {proj.title}
          </span>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
        <div style={{ display: "flex", gap: 3, flexWrap: "wrap", flex: 1, minWidth: 0 }}>
          {assigneeHumans.length === 0 ? (
            <span style={{ fontSize: 10, color: "#94a3b8" }}>담당자 없음</span>
          ) : assigneeHumans.slice(0, 2).map(h => (
            <span key={h.id} style={{
              fontSize: 10, color: h.color || "#6366f1",
              background: (h.color || "#6366f1") + "18",
              border: `1px solid ${(h.color || "#6366f1")}33`,
              padding: "1px 6px", borderRadius: 10, fontWeight: 600,
              whiteSpace: "nowrap",
            }}>
              {h.name}
            </span>
          ))}
          {assigneeHumans.length > 2 && (
            <span style={{ fontSize: 9, color: "#6366f1", background: "#ede9fe", borderRadius: 10, padding: "1px 5px", fontWeight: 700 }}>
              +{assigneeHumans.length - 2}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {card.comments?.length > 0 && (
            <span style={{ fontSize: 9, color: "#6366f1", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 2 }}>
              💬 {card.comments.length}
            </span>
          )}
          <DueBadge dueDate={card.dueDate} />
        </div>
      </div>
      {card.progress > 0 && (
        <div style={{ marginTop: 6, height: 3, background: "#e2e8f0", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ width: `${card.progress}%`, height: "100%", background: "#6366f1", borderRadius: 2 }} />
        </div>
      )}
    </div>
  );
}

/* ─── SortableCard (드래그 핸들 래퍼) ─── */
function SortableCard({ card, projData, departments, humans, onCardClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: "grab",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={e => { e.stopPropagation(); onCardClick(card); }}
    >
      <CardItem card={card} projData={projData} departments={departments} humans={humans} />
    </div>
  );
}

/* ─── DroppableColumn ─── */
function DroppableColumn({ colId, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: colId });
  return (
    <div ref={setNodeRef} style={{
      flex: 1,
      minHeight: 200,
      background: isOver ? "#f0f9ff" : "transparent",
      borderRadius: 8,
      transition: "background 0.15s",
    }}>
      {children}
    </div>
  );
}

/* ─── CardDetail 모달 ─── */
function CardDetail({
  card, isNew = false, defaultStatus = "todo", defaultProjectId = "",
  projData, departments, humans, onClose, onUpdate, onAdd, onDelete, activeProject,
}) {
  const [title,     setTitle]     = useState(card?.title     || "");
  const [assignees, setAssignees] = useState(card?.assignees || []);
  const [status,    setStatus]    = useState(card?.status    || defaultStatus);
  const [projectId, setProjectId] = useState(card?.projectId || defaultProjectId);
  const [dueDate,   setDueDate]   = useState(card?.dueDate   || "");
  const [startDate, setStartDate] = useState(card?.startDate || "");
  const [startTime, setStartTime] = useState(card?.startTime || "");
  const [endTime,   setEndTime]   = useState(card?.endTime   || "");
  const [progress,  setProgress]  = useState(card?.progress  ?? 0);
  const [desc,      setDesc]      = useState(card?.desc      || "");
  const [saving,    setSaving]    = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [cardTab,   setCardTab]   = useState("info");

  const toggleAssignee = (hid) => {
    setAssignees(prev => prev.includes(hid) ? prev.filter(x => x !== hid) : [...prev, hid]);
  };

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    if (isNew) {
      await onAdd({
        title: title.trim(), status, assignees,
        projectId: projectId || null,
        dueDate: dueDate || null,
        startDate: startDate || null,
        startTime: startTime || null,
        endTime: endTime || null,
        progress: Number(progress),
        desc,
      });
    } else {
      const originalProjectId = card.projectId;
      const updates = {
        title: title.trim(), assignees, status,
        dueDate: dueDate || null,
        startDate: startDate || null,
        startTime: startTime || null,
        endTime: endTime || null,
        progress: Number(progress),
        desc,
      };
      if (projectId && projectId !== originalProjectId) {
        updates.newProjectId = projectId;
      }
      await onUpdate(card.id, updates, originalProjectId);
    }
    setSaving(false);
    onClose();
  };

  const S = {
    width: "100%", border: "1px solid #e2e8f0", borderRadius: 7,
    padding: "7px 10px", fontSize: 12, color: "#1e293b",
    outline: "none", background: "#fff", boxSizing: "border-box",
  };
  const L = {
    fontSize: 10, fontWeight: 700, color: "#94a3b8",
    marginBottom: 4, textTransform: "uppercase",
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "#00000044", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#fff", borderRadius: 12, width: isNew ? 440 : 780, maxWidth: "92vw", maxHeight: "88vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.14)" }}>
        {/* 헤더 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: 1 }}>
            {isNew ? "새 카드 추가" : "카드 상세"}
          </span>
          <button onClick={onClose} style={{ background: "transparent", border: "1px solid #e2e8f0", color: "#94a3b8", cursor: "pointer", borderRadius: 6, padding: "2px 10px", fontSize: 11 }}>✕</button>
        </div>

        {/* 본문: 좌(기본 정보) / 우(댓글) 2분할 — 좁은 화면에선 자동 줄바꿈 */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "stretch" }}>
          <div style={{ flex: "1 1 360px", minWidth: 0, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14, borderRight: !isNew ? "1px solid #e2e8f0" : "none" }}>
            <div>
              <div style={L}>업무명</div>
              <input value={title} onChange={e => setTitle(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") save(); }}
                style={S} placeholder="업무명 입력..." autoFocus={isNew} />
            </div>

            <div>
              <div style={L}>상태</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {STATUS_INFO.map(s => (
                  <button key={s.id} onClick={() => setStatus(s.id)}
                    style={{
                      flex: 1, minWidth: 70, padding: "7px 0", borderRadius: 8,
                      border: `2px solid ${status === s.id ? s.color : "#e2e8f0"}`,
                      background: status === s.id ? s.color + "18" : "#fff",
                      color: status === s.id ? s.color : "#64748b",
                      fontSize: 11, fontWeight: status === s.id ? 700 : 400, cursor: "pointer",
                    }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={L}>진행도 ({progress}%)</div>
              <input type="range" min={0} max={100} value={progress}
                onChange={e => setProgress(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#6366f1" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#94a3b8", marginTop: 2 }}>
                <span>0%</span><span>50%</span><span>100%</span>
              </div>
            </div>

            <div>
              <div style={L}>담당자 (복수 선택 가능)</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 180, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 8px" }}>
                {(humans || []).map(h => (
                  <div key={h.id} onClick={() => toggleAssignee(h.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                      padding: "5px 6px", borderRadius: 6, userSelect: "none",
                      background: assignees.includes(h.id) ? h.color + "15" : "transparent",
                    }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: 4,
                      border: `2px solid ${assignees.includes(h.id) ? h.color : "#cbd5e1"}`,
                      background: assignees.includes(h.id) ? h.color : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      {assignees.includes(h.id) && (
                        <span style={{ color: "white", fontSize: 10, fontWeight: 700, lineHeight: 1 }}>✓</span>
                      )}
                    </div>
                    <span style={{ fontSize: 14 }}>{h.avatar}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#1e293b" }}>{h.name}</div>
                      <div style={{ fontSize: 9, color: "#94a3b8" }}>{h.title}</div>
                    </div>
                    {assignees.includes(h.id) && (
                      <span style={{ fontSize: 9, color: h.color, fontWeight: 700 }}>✓</span>
                    )}
                  </div>
                ))}
                {(humans || []).length === 0 && (
                  <div style={{ fontSize: 10, color: "#94a3b8", padding: 4 }}>팀원 데이터 없음</div>
                )}
              </div>
            </div>

            <div>
              <div style={L}>연결 프로젝트</div>
              <select value={projectId} onChange={e => setProjectId(e.target.value)} style={S}>
                <option value="">프로젝트 없음</option>
                {(projData || []).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={L}>시작일</div>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={S} />
              </div>
              <div>
                <div style={L}>마감일</div>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={S} />
              </div>
              <div>
                <div style={L}>시작 시간</div>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={S} />
              </div>
              <div>
                <div style={L}>종료 시간</div>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={S} />
              </div>
            </div>

            <div>
              <div style={L}>메모</div>
              <textarea
                value={desc}
                onChange={e => setDesc(e.target.value)}
                placeholder="메모를 입력하세요..."
                rows={3}
                style={{ ...S, resize: "vertical", lineHeight: 1.6 }}
              />
            </div>
          </div>

          {/* 우측: 댓글 (기존 카드만, pid는 카드가 실제 속한 프로젝트) */}
          {!isNew && (
            <div style={{ flex: "1 1 300px", minWidth: 0, padding: "14px 16px", display: "flex", flexDirection: "column" }}>
              <div style={L}>댓글</div>
              <NodeComments pid={card.projectId || activeProject} nodeId={card.id} />
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div style={{ display: "flex", gap: 8, padding: "12px 16px", borderTop: "1px solid #e2e8f0", alignItems: "center" }}>
          {!isNew && (
            confirmDel ? (
              <>
                <span style={{ fontSize: 11, color: "#dc2626", fontWeight: 600 }}>삭제할까요?</span>
                <button onClick={() => onDelete(card.id)}
                  style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#dc2626", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>확인</button>
                <button onClick={() => setConfirmDel(false)}
                  style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", fontSize: 11, cursor: "pointer" }}>취소</button>
              </>
            ) : (
              <button onClick={() => setConfirmDel(true)}
                style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid #fecaca", background: "#fff5f5", color: "#dc2626", fontSize: 11, cursor: "pointer" }}>삭제</button>
            )
          )}
          <div style={{ flex: 1 }} />
          <button onClick={onClose}
            style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", fontSize: 11, cursor: "pointer" }}>취소</button>
          <button onClick={save} disabled={saving || !title.trim()}
            style={{
              padding: "6px 14px", borderRadius: 7, border: "none",
              background: saving || !title.trim() ? "#e2e8f0" : "#6366f1",
              color: saving || !title.trim() ? "#94a3b8" : "#fff",
              fontSize: 11, fontWeight: 700, cursor: "pointer",
            }}>
            {saving ? "저장중..." : isNew ? "추가" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main KanbanView ─── */
export default function KanbanView({
  activeProject = "default",
  projData = [],
  allNodes = [],
  onNodesChange,
  onSelect,
  departments = [],
  humans = [],
}) {
  const [groupBy,         setGroupBy]         = useState(null); // null | 'project' | 'dept' | 'assignee'
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [filterProject,   setFilterProject]   = useState("all");
  const [filterDept,      setFilterDept]      = useState("all");
  const [filterAssignee,  setFilterAssignee]  = useState("all");
  const [addingModal,     setAddingModal]     = useState(null); // { colId, groupId? }
  const [editingCard,     setEditingCard]     = useState(null);
  const [cards,           setCards]           = useState([]);
  const [activeCard,      setActiveCard]      = useState(null);
  const dragOriginStatus = useRef(null); // 드래그 시작 시 원래 status 저장

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  /* ── allNodes → cards ── */
  useEffect(() => {
    setCards(allNodes.map(n => ({
      id:        n.id,
      title:     n.title,
      status:    n.status || "todo",
      assignees: n.assignees || (n.assignee ? [n.assignee] : []),
      dueDate:   n.dueDate   || null,
      startDate: n.startDate || null,
      startTime: n.startTime || null,
      endTime:   n.endTime   || null,
      progress:  n.progress  || 0,
      projectId: n.projectId,
      desc:      n.desc      || "",
      comments:  n.comments  || [],
    })));
  }, [allNodes]);

  /* ── 필터 ── */
  const filteredCards = cards.filter(c => {
    if (filterProject !== "all" && c.projectId !== filterProject) return false;
    const proj = projData.find(p => p.id === c.projectId);
    if (filterDept !== "all" && proj?.dept !== filterDept) return false;
    if (filterAssignee !== "all" && !c.assignees.includes(filterAssignee)) return false;
    return true;
  });

  /* ── 그룹 계산 ── */
  const groups = useMemo(() => {
    if (!groupBy) return [];
    if (groupBy === "project") {
      return projData.map(p => {
        const dept = departments.find(d => d.id === p.dept);
        return { id: p.id, label: p.title, color: dept?.color || "#6366f1" };
      });
    }
    if (groupBy === "dept") {
      return departments.map(d => ({ id: d.id, label: d.name, color: d.color }));
    }
    if (groupBy === "assignee") {
      return humans.map(h => ({ id: h.id, label: `${h.avatar} ${h.name}`, color: h.color }));
    }
    return [];
  }, [groupBy, projData, departments, humans]);

  function getGroupId(card) {
    if (groupBy === "project") return card.projectId;
    if (groupBy === "dept") {
      const proj = projData.find(p => p.id === card.projectId);
      return proj?.dept;
    }
    if (groupBy === "assignee") return card.assignees?.[0];
    return null;
  }

  /* ── 드래그 ── */
  function handleDragStart(event) {
    const card = cards.find(c => c.id === event.active.id);
    setActiveCard(card || null);
    dragOriginStatus.current = card?.status || null; // 원래 status 기억
  }

  // onDragOver: 드래그 중 실시간으로 카드의 status를 바꿔줘야
  // 각 컬럼의 SortableContext가 해당 카드를 인식하고 드롭 가능해짐
  function handleDragOver(event) {
    const { active, over } = event;
    if (!over) return;

    const draggedCard = cards.find(c => c.id === active.id);
    if (!draggedCard) return;

    let targetStatus = null;
    if (COLS.find(c => c.id === over.id)) {
      // 빈 컬럼 위에 올렸을 때
      targetStatus = over.id;
    } else {
      // 다른 카드 위에 올렸을 때 → 그 카드의 status 컬럼으로
      const overCard = cards.find(c => c.id === over.id);
      if (overCard) targetStatus = overCard.status;
    }

    if (targetStatus && draggedCard.status !== targetStatus) {
      // 로컬 state만 즉시 변경 (API 아직 호출 X)
      setCards(prev => prev.map(c =>
        c.id === draggedCard.id ? { ...c, status: targetStatus } : c
      ));
    }
  }

  function handleDragEnd(event) {
    const { active } = event;
    const movedCard = cards.find(c => c.id === active.id);
    setActiveCard(null);

    if (!movedCard) return;

    // handleDragOver에서 이미 로컬 status가 바뀌었으므로
    // 원래 status와 달라졌으면 API 호출
    if (dragOriginStatus.current && movedCard.status !== dragOriginStatus.current) {
      handleUpdateCard(movedCard.id, { status: movedCard.status }, movedCard.projectId);
    }
    dragOriginStatus.current = null;
  }

  /* ── CRUD ── */
  async function handleUpdateCard(cardId, updates, projectId) {
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, ...updates } : c));
    try {
      await fetch(`${API}/api/data/projects/${projectId}/nodes/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      onNodesChange?.();
    } catch (e) {
      console.error(e);
      onNodesChange?.();
    }
  }

  async function handleAddCard(data) {
    const projectId = data.projectId || (activeProject !== "default" ? activeProject : projData[0]?.id);
    if (!projectId) return;
    try {
      await fetch(`${API}/api/data/projects/${projectId}/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:     data.title,
          status:    data.status || "todo",
          assignees: data.assignees || [],
          dueDate:   data.dueDate   || null,
          startDate: data.startDate || null,
          progress:  Number(data.progress || 0),
          desc:      data.desc      || "",
        }),
      });
      onNodesChange?.();
      setAddingModal(null);
    } catch (e) { console.error(e); }
  }

  async function handleDeleteCard(cardId) {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;
    setCards(prev => prev.filter(c => c.id !== cardId));
    setEditingCard(null);
    await fetch(`${API}/api/data/projects/${card.projectId}/nodes/${cardId}`, { method: "DELETE" });
    onNodesChange?.();
  }

  /* ── 스타일 상수 ── */
  const selectStyle = {
    fontSize: 11, padding: "4px 8px", borderRadius: 6,
    border: "1px solid #e2e8f0", background: "#fff",
    color: "#1e293b", cursor: "pointer", outline: "none",
  };
  const thStyle = {
    padding: "8px 12px", fontSize: 10, fontWeight: 700,
    color: "#64748b", background: "#f8fafc",
    borderBottom: "2px solid #e2e8f0",
    borderRight: "1px solid #e2e8f0",
  };
  const btnStyle = {
    padding: "4px 12px", borderRadius: 6, border: "1px solid #e2e8f0",
    background: "#f8fafc", color: "#64748b", fontSize: 10,
    cursor: "pointer",
  };

  return (
    <>
      {/* 카드 추가 / 수정 모달 */}
      {(editingCard || addingModal) && (
        <CardDetail
          card={editingCard}
          isNew={!!addingModal}
          defaultStatus={addingModal?.colId || "todo"}
          defaultProjectId={activeProject !== "default" ? activeProject : (projData[0]?.id || "")}
          projData={projData}
          departments={departments}
          humans={humans}
          onClose={() => { setEditingCard(null); setAddingModal(null); }}
          onUpdate={handleUpdateCard}
          onAdd={handleAddCard}
          onDelete={handleDeleteCard}
          activeProject={activeProject}
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

        {/* ── 상단 컨트롤 바 ── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 16px", borderBottom: "1px solid #e2e8f0",
          background: "#fff", flexShrink: 0, flexWrap: "wrap",
        }}>
          {/* 그룹기준 선택 */}
          <select
            value={groupBy || ""}
            onChange={e => {
              setGroupBy(e.target.value || null);
              setCollapsedGroups(new Set());
            }}
            style={{ ...selectStyle, fontWeight: 600, color: groupBy ? "#6366f1" : "#1e293b" }}
          >
            <option value="">그룹없음 (보드)</option>
            <option value="project">프로젝트별</option>
            <option value="dept">부서별</option>
            <option value="assignee">담당자별</option>
          </select>

          <div style={{ width: 1, height: 18, background: "#e2e8f0", flexShrink: 0 }} />

          {/* 필터: 보드모드에서만 표시 (스윔레인은 그룹기준으로 충분) */}
          {!groupBy && (
            <>
              <select value={filterProject} onChange={e => setFilterProject(e.target.value)} style={selectStyle}>
                <option value="all">전체 프로젝트</option>
                {projData.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
              <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={selectStyle}>
                <option value="all">전체 부서</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} style={selectStyle}>
                <option value="all">전체 담당자</option>
                {humans.map(h => <option key={h.id} value={h.id}>{h.avatar} {h.name}</option>)}
              </select>
            </>
          )}

          {/* 스윔레인 모드: 전체 접기/펴기 */}
          {groupBy && (
            <>
              <div style={{ width: 1, height: 18, background: "#e2e8f0", flexShrink: 0 }} />
              <button
                onClick={() => setCollapsedGroups(new Set(groups.map(g => g.id)))}
                style={btnStyle}
              >전체 접기</button>
              <button
                onClick={() => setCollapsedGroups(new Set())}
                style={btnStyle}
              >전체 펴기</button>
            </>
          )}

          <span style={{ marginLeft: "auto", fontSize: 10, color: "#94a3b8" }}>
            {filteredCards.length}개 업무
          </span>
        </div>

        {/* ── 콘텐츠 영역 ── */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

          {/* ── 일반 보드 모드 ── */}
          {!groupBy && (
            <DndContext
              sensors={sensors}
              collisionDetection={kanbanCollision}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <div style={{ display: "flex", gap: 12, flex: 1, overflow: "hidden", padding: "12px 16px" }}>
                {COLS.map(col => {
                  const colCards = filteredCards.filter(c => c.status === col.id);
                  return (
                    <div key={col.id} style={{
                      flex: 1, display: "flex", flexDirection: "column",
                      background: "#f8fafc", borderRadius: 10,
                      border: "1px solid #e2e8f0", overflow: "hidden", minWidth: 0,
                    }}>
                      {/* 컬럼 헤더 */}
                      <div style={{
                        padding: "10px 12px", borderBottom: "1px solid #e2e8f0",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        flexShrink: 0,
                      }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: col.color }}>
                          {col.label}
                        </span>
                        <span style={{
                          fontSize: 10, background: "#e2e8f0",
                          borderRadius: 10, padding: "1px 7px",
                        }}>{colCards.length}</span>
                      </div>

                      {/* 드롭 영역 */}
                      <DroppableColumn colId={col.id}>
                        <SortableContext
                          items={colCards.map(c => c.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px 0" }}>
                            {colCards.length === 0 && (
                              <div style={{
                                textAlign: "center", color: "#cbd5e1",
                                fontSize: 11, padding: "20px 0",
                              }}>드롭 또는 추가</div>
                            )}
                            {colCards.map(card => (
                              <SortableCard
                                key={card.id}
                                card={card}
                                projData={projData}
                                departments={departments}
                                humans={humans}
                                onCardClick={setEditingCard}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DroppableColumn>

                      {/* + 카드 추가 */}
                      <button
                        onClick={() => setAddingModal({ colId: col.id })}
                        style={{
                          margin: 8, padding: 6, background: "none",
                          border: "1px dashed #cbd5e1", borderRadius: 6,
                          cursor: "pointer", color: "#94a3b8", fontSize: 11,
                          flexShrink: 0,
                        }}
                      >+ 카드 추가</button>
                    </div>
                  );
                })}
              </div>

              <DragOverlay>
                {activeCard ? (
                  <CardItem
                    card={activeCard}
                    projData={projData}
                    departments={departments}
                    humans={humans}
                    isOverlay
                  />
                ) : null}
              </DragOverlay>
            </DndContext>
          )}

          {/* ── 스윔레인 모드 ── */}
          {groupBy && (
            <div style={{ flex: 1, overflow: "auto", padding: "12px 16px" }}>

              {/* 테이블 헤더 */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "200px repeat(4, 1fr)",
                gap: 1,
                marginBottom: 1,
                position: "sticky",
                top: 0,
                zIndex: 10,
              }}>
                <div style={thStyle}>그룹</div>
                {COLS.map(col => (
                  <div key={col.id} style={{ ...thStyle, color: col.color }}>
                    {col.label}
                  </div>
                ))}
              </div>

              {/* 그룹 행들 */}
              {groups.map(group => {
                const isCollapsed = collapsedGroups.has(group.id);
                const groupCards  = filteredCards.filter(c => getGroupId(c) === group.id);
                const total       = groupCards.length;

                return (
                  <div key={group.id} style={{ marginBottom: 2 }}>
                    {/* 그룹 헤더 행 */}
                    <div
                      onClick={() => {
                        const next = new Set(collapsedGroups);
                        isCollapsed ? next.delete(group.id) : next.add(group.id);
                        setCollapsedGroups(next);
                      }}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "200px repeat(4, 1fr)",
                        gap: 1,
                        cursor: "pointer",
                        background: "#f1f5f9",
                      }}
                    >
                      <div style={{
                        padding: "8px 12px", fontWeight: 700, fontSize: 12,
                        display: "flex", alignItems: "center", gap: 6,
                        borderLeft: `3px solid ${group.color}`,
                      }}>
                        <span style={{ fontSize: 10 }}>{isCollapsed ? "▶" : "▼"}</span>
                        <span>{group.label}</span>
                        <span style={{ color: "#94a3b8", fontWeight: 400, fontSize: 11 }}>
                          {total}개
                        </span>
                      </div>
                      {COLS.map(col => {
                        const cnt = groupCards.filter(c => c.status === col.id).length;
                        return (
                          <div key={col.id} style={{
                            padding: "8px 12px", fontSize: 11,
                            color: cnt > 0 ? col.color : "#cbd5e1",
                            textAlign: "center", fontWeight: cnt > 0 ? 600 : 400,
                          }}>
                            {cnt > 0 ? cnt : ""}
                          </div>
                        );
                      })}
                    </div>

                    {/* 그룹 내용 (펼쳐진 경우) */}
                    {!isCollapsed && (
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "200px repeat(4, 1fr)",
                        gap: 1,
                      }}>
                        {/* 그룹 레이블 열 */}
                        <div style={{
                          background: "#f8fafc",
                          borderLeft: `3px solid ${group.color}`,
                          borderBottom: "1px solid #e2e8f0",
                          minHeight: 60,
                        }} />
                        {/* 각 컬럼 셀 */}
                        {COLS.map(col => {
                          const cellCards = groupCards.filter(c => c.status === col.id);
                          return (
                            <div key={col.id} style={{
                              background: "#fff",
                              border: "1px solid #f1f5f9",
                              minHeight: 80,
                              padding: 6,
                            }}>
                              {cellCards.map(card => (
                                <div
                                  key={card.id}
                                  onClick={() => setEditingCard(card)}
                                  style={{
                                    background: "#f8fafc",
                                    border: "1px solid #e2e8f0",
                                    borderLeft: `2px solid ${col.color}`,
                                    borderRadius: 6,
                                    padding: "6px 8px",
                                    marginBottom: 4,
                                    cursor: "pointer",
                                    fontSize: 11,
                                  }}
                                >
                                  <div style={{ fontWeight: 600, color: "#1e293b", marginBottom: 2 }}>
                                    {card.title}
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                                    <div style={{ display: "flex", gap: 2 }}>
                                      {(card.assignees || []).slice(0, 2).map(hid => {
                                        const h = humans.find(x => x.id === hid);
                                        return h ? (
                                          <span key={hid} title={h.name} style={{ fontSize: 11 }}>{h.avatar}</span>
                                        ) : null;
                                      })}
                                    </div>
                                    {card.dueDate && (
                                      <span style={{ color: "#94a3b8", fontSize: 9 }}>
                                        {card.dueDate.slice(5)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                              <button
                                onClick={() => setAddingModal({ colId: col.id, groupId: group.id })}
                                style={{
                                  width: "100%", padding: 4, background: "none",
                                  border: "1px dashed #e2e8f0", borderRadius: 4,
                                  cursor: "pointer", color: "#cbd5e1", fontSize: 10,
                                }}
                              >+ 추가</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {groups.length === 0 && (
                <div style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
                  데이터 없음
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
