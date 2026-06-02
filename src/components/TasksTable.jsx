import { useState, useMemo } from "react";
import { COLORS, TASK_STATUS_COLOR } from "../data/mockData";

const { surface: S, border: BR, text: T, muted: M, bg: B } = COLORS;

const STATUS_LABEL = { done: "완료", active: "진행중", todo: "대기" };

const STATUS_COLOR = {
  done:   "#16a34a",
  active: "#f59e0b",
  todo:   "#94a3b8",
};

function exportCSV(groups) {
  const header = ["프로젝트", "부서", "담당자", "업무", "상태", "진행도", "마감"];
  const rows = [];
  groups.forEach(g => {
    g.allNodes.forEach(row => {
      rows.push([g.projTitle, g.deptName, row.humanNames, row.task, STATUS_LABEL[row.s] || row.s, (row.progress || 0) + "%", row.dueDate || ""]);
    });
  });
  const lines = [header, ...rows];
  const csv = lines.map(l => l.map(v => `"${v}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "tasks.csv"; a.click();
  URL.revokeObjectURL(url);
}

/* 작은 진행도 바 */
function MiniBar({ pct, color, showText = true }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{ flex: 1, height: 4, background: "#e2e8f0", borderRadius: 2, minWidth: 50 }}>
        <div style={{ height: 4, width: `${pct}%`, background: color, borderRadius: 2, transition: "width .3s" }} />
      </div>
      {showText && <span style={{ fontSize: 10, color: M, minWidth: 28, textAlign: "right" }}>{pct}%</span>}
    </div>
  );
}

/* 상태 칩 */
function StatusChip({ status }) {
  const c = STATUS_COLOR[status] || "#94a3b8";
  return (
    <span style={{
      fontSize: 10, color: c, background: c + "18",
      padding: "2px 8px", borderRadius: 8, fontWeight: 600,
      whiteSpace: "nowrap",
    }}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export default function TasksTable({ onTaskClick, projData = [], allNodes = [], departments = [], humans = [] }) {
  const [openProjects, setOpenProjects] = useState(new Set()); // 기본 모두 접힘
  const [statusFilter, setStatusFilter] = useState("all");
  const [deptFilter,   setDeptFilter]   = useState("all");

  const toggle = (pid) => setOpenProjects(prev => {
    const next = new Set(prev);
    next.has(pid) ? next.delete(pid) : next.add(pid);
    return next;
  });

  /* 프로젝트별 그룹핑 */
  const groups = useMemo(() => {
    // 노드를 프로젝트별로 묶기
    const projMap = new Map();

    const getNodeRow = (node) => {
      const proj = projData.find(p => p.id === node.projectId);
      const dept = departments.find(d => d.id === proj?.dept);
      const assigneeHumans = (node.assignees || []).map(id => humans.find(h => h.id === id)).filter(Boolean);
      return {
        key:         node.id,
        projId:      node.projectId,
        projTitle:   proj?.title    || "알 수 없음",
        deptName:    dept?.name     || "",
        deptId:      proj?.dept     || "",
        deptColor:   dept?.color    || "#888",
        humanNames:  assigneeHumans.map(h => h.name).join(", ") || "",
        humanAvatars: assigneeHumans.map(h => h.avatar).join("") || "",
        assignees:   assigneeHumans,
        task:        node.title,
        s:           node.status   || "todo",
        progress:    node.progress || 0,
        dueDate:     node.dueDate  || "",
        rawNode:     node,
        rawProj:     proj,
      };
    };

    // allNodes 기반
    const sourceNodes = allNodes.length > 0
      ? allNodes.map(getNodeRow)
      : projData.flatMap(p =>
          (p.tasks || []).map((t, i) => {
            const dept  = departments.find(d => d.id === p.dept);
            const human = humans.find(h => h.id === t.a);
            return {
              key:         p.id + "_" + i,
              projId:      p.id,
              projTitle:   p.title,
              deptName:    dept?.name  || "",
              deptId:      p.dept,
              deptColor:   dept?.color || "#888",
              humanNames:  human?.name || "",
              humanAvatars: human?.avatar || "",
              assignees:   human ? [human] : [],
              task:        t.t,
              s:           t.s,
              progress:    p.progress || 0,
              dueDate:     t.dueDate  || t.due || "",
              rawNode:     t,
              rawProj:     p,
            };
          })
        );

    // 프로젝트별로 묶기
    sourceNodes.forEach(row => {
      const pid = row.projId || "__unknown__";
      if (!projMap.has(pid)) {
        projMap.set(pid, {
          projId:    pid,
          projTitle: row.projTitle,
          deptName:  row.deptName,
          deptId:    row.deptId,
          deptColor: row.deptColor,
          allNodes:  [],
        });
      }
      projMap.get(pid).allNodes.push(row);
    });

    // 그룹 배열로 변환
    return [...projMap.values()]
      .filter(g => deptFilter === "all" || g.deptId === deptFilter)
      .map(g => {
        const total  = g.allNodes.length;
        const done   = g.allNodes.filter(r => r.s === "done").length;
        const active = g.allNodes.filter(r => r.s === "active").length;
        const todo   = g.allNodes.filter(r => r.s === "todo").length;
        const avgPct = total ? Math.round((done / total) * 100) : 0;

        const filteredNodes = statusFilter === "all"
          ? g.allNodes
          : g.allNodes.filter(r => r.s === statusFilter);

        return { ...g, total, done, active, todo, avgPct, filteredNodes };
      });
  }, [allNodes, projData, departments, humans, deptFilter, statusFilter]);

  const totalAll     = groups.reduce((s, g) => s + g.total, 0);
  const totalFiltered = groups.reduce((s, g) => s + g.filteredNodes.length, 0);

  return (
    <div style={{ padding: "10px 12px" }}>
      {/* 툴바 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: T }}>누적 작업 현황</span>
        <span style={{ fontSize: 10, color: M, background: BR, padding: "2px 7px", borderRadius: 8 }}>
          {totalFiltered} / {totalAll}개
        </span>

        {/* 상태 필터 */}
        <div style={{ display: "flex", gap: 4 }}>
          {[["all", "전체"], ["active", "진행중"], ["todo", "대기"], ["done", "완료"]].map(([v, l]) => (
            <button key={v} onClick={() => setStatusFilter(v)}
              style={{
                padding: "4px 10px", borderRadius: 12, cursor: "pointer", fontSize: 10,
                border: "1px solid " + (statusFilter === v ? "#6366f1" : "#e2e8f0"),
                background: statusFilter === v ? "#6366f118" : "transparent",
                color: statusFilter === v ? "#6366f1" : M,
              }}>
              {l}
            </button>
          ))}
        </div>

        {/* 부서 필터 */}
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
          style={{ padding: "4px 8px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#ffffff", color: "#1e293b", fontSize: 10, cursor: "pointer" }}>
          <option value="all">전체 부서</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>

        {/* CSV */}
        <button onClick={() => exportCSV(groups)}
          style={{ marginLeft: "auto", padding: "4px 12px", borderRadius: 8, border: "1px solid " + BR, background: "transparent", color: M, fontSize: 10, cursor: "pointer" }}>
          CSV 내보내기
        </button>
      </div>

      {/* 그룹 목록 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {groups.length === 0 && (
          <div style={{ textAlign: "center", color: M, fontSize: 12, padding: "30px 0" }}>
            조건에 맞는 프로젝트가 없습니다
          </div>
        )}

        {groups.map(group => {
          const isOpen = openProjects.has(group.projId);
          const c = group.deptColor;

          return (
            <div key={group.projId} style={{ border: "1px solid " + BR, borderRadius: 10, overflow: "hidden", background: "#fff" }}>

              {/* 프로젝트 헤더 행 */}
              <div
                onClick={() => toggle(group.projId)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", cursor: "pointer",
                  background: isOpen ? c + "08" : "#fafbfc",
                  borderBottom: isOpen ? "1px solid " + BR : "none",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = c + "10"; }}
                onMouseLeave={e => { e.currentTarget.style.background = isOpen ? c + "08" : "#fafbfc"; }}
              >
                {/* 토글 아이콘 */}
                <span style={{ fontSize: 10, color: M, width: 12, flexShrink: 0, userSelect: "none" }}>
                  {isOpen ? "▼" : "▶"}
                </span>

                {/* 부서색 배지 + 프로젝트명 */}
                <div style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, minWidth: 0 }}>
                  <span style={{
                    fontSize: 10, color: c, background: c + "18",
                    padding: "2px 8px", borderRadius: 8, fontWeight: 700,
                    flexShrink: 0, whiteSpace: "nowrap",
                  }}>{group.deptName || "기타"}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {group.projTitle}
                  </span>
                </div>

                {/* 상태별 카운트 칩 */}
                <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                  {group.active > 0 && (
                    <span style={{ fontSize: 9, color: STATUS_COLOR.active, background: STATUS_COLOR.active + "18", padding: "2px 7px", borderRadius: 8, fontWeight: 600, whiteSpace: "nowrap" }}>
                      진행중 {group.active}
                    </span>
                  )}
                  {group.done > 0 && (
                    <span style={{ fontSize: 9, color: STATUS_COLOR.done, background: STATUS_COLOR.done + "18", padding: "2px 7px", borderRadius: 8, fontWeight: 600, whiteSpace: "nowrap" }}>
                      완료 {group.done}
                    </span>
                  )}
                  {group.todo > 0 && (
                    <span style={{ fontSize: 9, color: STATUS_COLOR.todo, background: STATUS_COLOR.todo + "18", padding: "2px 7px", borderRadius: 8, fontWeight: 600, whiteSpace: "nowrap" }}>
                      대기 {group.todo}
                    </span>
                  )}
                  <span style={{ fontSize: 9, color: M, background: BR, padding: "2px 7px", borderRadius: 8, whiteSpace: "nowrap" }}>
                    전체 {group.total}
                  </span>
                </div>

                {/* 진행도 바 */}
                <div style={{ width: 120, flexShrink: 0 }}>
                  <MiniBar pct={group.avgPct} color={c} />
                </div>
              </div>

              {/* 자식 행들 (펼쳐진 경우만) */}
              {isOpen && (
                <div>
                  {group.filteredNodes.length === 0 ? (
                    <div style={{ padding: "12px 24px", fontSize: 11, color: M, textAlign: "center" }}>
                      해당 상태의 업무가 없습니다
                    </div>
                  ) : (
                    group.filteredNodes.map(row => {
                      const tc = STATUS_COLOR[row.s] || "#94a3b8";
                      return (
                        <div
                          key={row.key}
                          onClick={() => onTaskClick?.({ type: "task", proj: row.rawProj, task: row.rawNode })}
                          style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "8px 14px 8px 28px",
                            borderBottom: "1px solid #f1f5f9",
                            cursor: "pointer", background: "#fff",
                            transition: "background 0.12s",
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = "#f8fafc"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "#fff"; }}
                        >
                          {/* 들여쓰기 + 업무명 */}
                          <span style={{ color: "#cbd5e1", fontSize: 12, flexShrink: 0 }}>└</span>
                          <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: T, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                            {row.task}
                          </span>

                          {/* 상태 칩 */}
                          <div style={{ flexShrink: 0 }}>
                            <StatusChip status={row.s} />
                          </div>

                          {/* 담당자 */}
                          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4, minWidth: 80 }}>
                            {row.assignees.length > 0 ? (
                              <>
                                <span style={{ fontSize: 13 }}>{row.assignees[0].avatar}</span>
                                <span style={{ fontSize: 10, color: "#475569", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 56 }}>
                                  {row.assignees[0].name}
                                </span>
                                {row.assignees.length > 1 && (
                                  <span style={{ fontSize: 9, color: M }}>+{row.assignees.length - 1}</span>
                                )}
                              </>
                            ) : (
                              <span style={{ fontSize: 10, color: "#cbd5e1" }}>—</span>
                            )}
                          </div>

                          {/* 마감일 */}
                          <span style={{ fontSize: 10, color: M, flexShrink: 0, minWidth: 36 }}>
                            {row.dueDate ? row.dueDate.slice(5) : "—"}
                          </span>

                          {/* 진행도 바 (작은 것) */}
                          <div style={{ width: 90, flexShrink: 0 }}>
                            <MiniBar pct={row.progress} color={tc} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
