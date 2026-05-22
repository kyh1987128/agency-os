import { useState, useMemo } from "react";
import { PROJS, COLORS, getDept, TASK_STATUS_COLOR } from "../data/mockData";
import { getHuman } from "../data/humans";
import { DEPTS } from "../data/mockData";

const { surface: S, border: BR, text: T, muted: M, bg: B } = COLORS;

const STATUS_LABEL = { done: "완료", active: "진행중", todo: "대기" };

function exportCSV(rows) {
  const header = ["업체명", "부서", "담당자", "업무", "상태", "진행도", "마감"];
  const lines = [header, ...rows.map((r) => [r.projTitle, r.dept, r.human, r.task, STATUS_LABEL[r.s], r.progress + "%", r.due])];
  const csv = lines.map((l) => l.map((v) => `"${v}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "tasks.csv"; a.click();
  URL.revokeObjectURL(url);
}

export default function TasksTable({ onTaskClick }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [deptFilter,   setDeptFilter]   = useState("all");
  const [sortKey,      setSortKey]       = useState("due");
  const [sortDir,      setSortDir]       = useState("asc");
  const [dupScan,      setDupScan]       = useState(false);

  const allRows = useMemo(() =>
    PROJS.flatMap((p) =>
      p.tasks.map((t, i) => {
        const hu = getHuman(t.a);
        const d  = getDept(p.dept);
        return {
          key:       p.id + "_" + i,
          projTitle: p.title,
          dept:      d?.name  || "",
          deptId:    p.dept,
          deptColor: d?.color || "#888",
          human:     hu?.name  || "",
          humanAvatar: hu?.avatar || "",
          task:      t.t,
          s:         t.s,
          progress:  p.progress,
          due:       t.due,
          rawProj:   p,
          rawTask:   t,
          rawHuman:  hu,
        };
      })
    ),
  []);

  const filtered = useMemo(() => {
    let rows = allRows;
    if (statusFilter !== "all") rows = rows.filter((r) => r.s === statusFilter);
    if (deptFilter   !== "all") rows = rows.filter((r) => r.deptId === deptFilter);

    const dupeSet = dupScan
      ? new Set(allRows.map((r) => r.task).filter((t, _, a) => a.filter((x) => x === t).length > 1))
      : new Set();
    if (dupScan) rows = rows.filter((r) => dupeSet.has(r.task));

    rows = [...rows].sort((a, b) => {
      let va = a[sortKey] ?? "", vb = b[sortKey] ?? "";
      if (sortKey === "progress") { va = Number(va); vb = Number(vb); }
      return sortDir === "asc" ? (va < vb ? -1 : va > vb ? 1 : 0) : (va > vb ? -1 : va < vb ? 1 : 0);
    });
    return rows;
  }, [allRows, statusFilter, deptFilter, sortKey, sortDir, dupScan]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };
  const sortIcon = (key) => sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  const thStyle = (key) => ({
    padding: "8px 10px", textAlign: "left", fontSize: 10, fontWeight: 700, color: M,
    background: B, borderBottom: "1px solid " + BR, cursor: "pointer", whiteSpace: "nowrap",
    userSelect: "none",
  });
  const tdStyle = { padding: "9px 10px", fontSize: 11, color: T, borderBottom: "1px solid " + BR + "55", verticalAlign: "middle" };

  return (
    <div style={{ padding: "10px 12px" }}>
      {/* 툴바 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: T }}>누적 작업 현황</span>
        <span style={{ fontSize: 10, color: M, background: BR, padding: "2px 7px", borderRadius: 8 }}>{filtered.length} / {allRows.length}개</span>

        {/* 상태 필터 */}
        <div style={{ display: "flex", gap: 4 }}>
          {[["all", "전체"], ["active", "진행중"], ["todo", "대기"], ["done", "완료"]].map(([v, l]) => (
            <button key={v} onClick={() => setStatusFilter(v)}
              style={{ padding: "4px 10px", borderRadius: 12, border: "1px solid " + (statusFilter === v ? "#818cf8" : BR), background: statusFilter === v ? "#818cf818" : "transparent", color: statusFilter === v ? "#818cf8" : M, fontSize: 10, cursor: "pointer" }}>
              {l}
            </button>
          ))}
        </div>

        {/* 부서 필터 */}
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
          style={{ padding: "4px 8px", borderRadius: 8, border: "1px solid " + BR, background: S, color: T, fontSize: 10, cursor: "pointer" }}>
          <option value="all">전체 부서</option>
          {DEPTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>

        {/* 중복 스캔 */}
        <button onClick={() => setDupScan((v) => !v)}
          style={{ padding: "4px 10px", borderRadius: 12, border: "1px solid " + (dupScan ? "#f59e0b" : BR), background: dupScan ? "#f59e0b18" : "transparent", color: dupScan ? "#f59e0b" : M, fontSize: 10, cursor: "pointer" }}>
          🔍 중복스캔
        </button>

        {/* CSV */}
        <button onClick={() => exportCSV(filtered)}
          style={{ marginLeft: "auto", padding: "4px 12px", borderRadius: 8, border: "1px solid " + BR, background: "transparent", color: M, fontSize: 10, cursor: "pointer" }}>
          ⬇ CSV
        </button>
      </div>

      {/* 테이블 */}
      <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid " + BR }}>
        <table style={{ width: "100%", borderCollapse: "collapse", background: S }}>
          <thead>
            <tr>
              <th style={thStyle("projTitle")} onClick={() => toggleSort("projTitle")}>업체명(프로젝트){sortIcon("projTitle")}</th>
              <th style={thStyle("dept")}      onClick={() => toggleSort("dept")}>업종(부서){sortIcon("dept")}</th>
              <th style={thStyle("human")}     onClick={() => toggleSort("human")}>담당자{sortIcon("human")}</th>
              <th style={thStyle("task")}      onClick={() => toggleSort("task")}>업무{sortIcon("task")}</th>
              <th style={thStyle("s")}         onClick={() => toggleSort("s")}>상태{sortIcon("s")}</th>
              <th style={thStyle("progress")}  onClick={() => toggleSort("progress")}>진행도{sortIcon("progress")}</th>
              <th style={thStyle("due")}       onClick={() => toggleSort("due")}>마감{sortIcon("due")}</th>
              <th style={{ ...thStyle(""), cursor: "default" }}>액션</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const tc = TASK_STATUS_COLOR[row.s];
              return (
                <tr key={row.key}
                  onClick={() => onTaskClick({ type: "task", proj: row.rawProj, task: row.rawTask, human: row.rawHuman })}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#16162a"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  <td style={{ ...tdStyle, maxWidth: 180 }}>
                    <span style={{ fontSize: 11, color: row.deptColor }}>{row.projTitle}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 10, color: row.deptColor, background: row.deptColor + "15", padding: "2px 7px", borderRadius: 8 }}>{row.dept}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 13, marginRight: 4 }}>{row.humanAvatar}</span>
                    <span style={{ fontSize: 11 }}>{row.human}</span>
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{row.task}</td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 10, color: tc, background: tc + "18", padding: "2px 8px", borderRadius: 8 }}>{STATUS_LABEL[row.s]}</span>
                  </td>
                  <td style={{ ...tdStyle, minWidth: 90 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ flex: 1, height: 4, background: "#1e1e30", borderRadius: 2 }}>
                        <div style={{ height: 4, width: row.progress + "%", background: row.deptColor, borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 10, color: M, minWidth: 28 }}>{row.progress}%</span>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, color: M }}>{row.due}</td>
                  <td style={tdStyle}>
                    <button onClick={(e) => { e.stopPropagation(); onTaskClick({ type: "task", proj: row.rawProj, task: row.rawTask, human: row.rawHuman }); }}
                      style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid " + BR, background: "transparent", color: M, fontSize: 9, cursor: "pointer" }}>
                      상세
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ ...tdStyle, textAlign: "center", color: M, padding: 24 }}>조건에 맞는 업무가 없습니다</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
