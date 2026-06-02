import "gantt-task-react/dist/index.css";
import { useState, useMemo, useEffect, useRef } from "react";
import { Gantt, ViewMode } from "gantt-task-react";

const selectStyle = {
  fontSize: 11,
  padding: "4px 8px",
  borderRadius: 6,
  border: "1px solid #e2e8f0",
  background: "#fff",
  color: "#1e293b",
  cursor: "pointer",
  outline: "none",
};

// allNodes → gantt-task-react Task 배열 변환
function toGanttTasks(allNodes, projData, departments, collapsedProjects) {
  const tasks = [];

  projData.forEach((proj) => {
    const dept = departments.find((d) => d.id === proj.dept);
    const color = dept?.color || "#6366f1";
    const projNodes = allNodes.filter(
      (n) => n.projectId === proj.id && n.dueDate
    );
    if (projNodes.length === 0) return;

    // 프로젝트 헤더 행 (type: "project")
    const projStart = projNodes.reduce((min, n) => {
      const s = n.startDate || n.dueDate;
      return s < min ? s : min;
    }, projNodes[0].startDate || projNodes[0].dueDate);
    const projEnd = projNodes.reduce(
      (max, n) => (n.dueDate > max ? n.dueDate : max),
      projNodes[0].dueDate
    );

    const isCollapsed = collapsedProjects.has(proj.id);

    tasks.push({
      id: proj.id,
      name: proj.title,
      start: new Date(projStart),
      end: new Date(projEnd),
      progress: proj.progress || 0,
      type: "project",
      hideChildren: isCollapsed,
      styles: {
        progressColor: color,
        progressSelectedColor: color,
        backgroundColor: color + "22",
        backgroundSelectedColor: color + "33",
        color: "#1e293b",
      },
    });

    // 접힌 프로젝트의 자식 task는 포함하지 않음
    if (isCollapsed) return;

    // 개별 업무 행 (type: "task")
    projNodes.forEach((node) => {
      let start = node.startDate || node.dueDate;
      if (!node.startDate) {
        const d = new Date(node.dueDate);
        d.setDate(d.getDate() - 7);
        start = d.toISOString().slice(0, 10);
      }
      const sc =
        {
          todo: "#94a3b8",
          active: "#f59e0b",
          review: "#6366f1",
          done: "#34d399",
        }[node.status] || "#94a3b8";

      tasks.push({
        id: node.id,
        name: node.title,
        start: new Date(start),
        end: new Date(node.dueDate),
        progress: node.progress || 0,
        type: "task",
        project: proj.id,
        _projectId: proj.id,
        _status: node.status,
        _assignees: node.assignees || [],
        _dept: dept,
        styles: {
          progressColor: sc,
          progressSelectedColor: sc,
          backgroundColor: sc + "cc",
          backgroundSelectedColor: sc,
          color: "#1e293b",
        },
      });
    });
  });

  return tasks;
}

// 커스텀 왼쪽 패널 헤더
const TaskListHeaderCustom = ({ headerHeight, fontFamily, rowWidth }) => (
  <div
    style={{
      display: "flex",
      height: headerHeight,
      alignItems: "flex-end",
      borderBottom: "1px solid #e2e8f0",
      background: "#f8fafc",
      fontFamily,
    }}
  >
    <div
      style={{
        width: rowWidth,
        padding: "0 8px 6px",
        fontSize: 10,
        fontWeight: 700,
        color: "#94a3b8",
        textTransform: "uppercase",
      }}
    >
      업무
    </div>
    <div
      style={{
        width: 100,
        padding: "0 8px 6px",
        fontSize: 10,
        fontWeight: 700,
        color: "#94a3b8",
        textTransform: "uppercase",
      }}
    >
      담당자
    </div>
    <div
      style={{
        width: 60,
        padding: "0 8px 6px",
        fontSize: 10,
        fontWeight: 700,
        color: "#94a3b8",
        textTransform: "uppercase",
      }}
    >
      진행률
    </div>
  </div>
);

// 커스텀 왼쪽 패널 행 — humans, departments를 클로저로 캡처
function makeTaskListTable(humans, departments) {
  const statusLabel = {
    todo: "대기",
    active: "진행중",
    review: "검토중",
    done: "완료",
  };
  const statusColor = {
    todo: "#94a3b8",
    active: "#f59e0b",
    review: "#6366f1",
    done: "#34d399",
  };

  return function TaskListTableCustom({
    tasks,
    rowHeight,
    rowWidth,
    fontFamily,
    onExpanderClick,
  }) {
    return (
      <div style={{ fontFamily }}>
        {tasks.map((task) => {
          const isProject = task.type === "project";
          const assigneeIds = task._assignees || [];
          const assignees = assigneeIds
            .map((id) => humans.find((h) => h.id === id))
            .filter(Boolean);
          const sc = statusColor[task._status] || "#94a3b8";
          const dept = task._dept;
          const firstAssignee = assignees[0];
          const assigneeDept = firstAssignee
            ? departments.find((d) => d.id === firstAssignee.deptId)
            : null;
          const progress = task.progress || 0;

          /* ── 프로젝트 헤더 행 ── */
          if (isProject) {
            return (
              <div
                key={task.id}
                onClick={() => onExpanderClick(task)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  height: rowHeight,
                  borderBottom: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  cursor: "pointer",
                  borderLeft: dept ? `3px solid ${dept.color}` : "3px solid transparent",
                }}
              >
                <div style={{ width: rowWidth, padding: "0 8px", display: "flex", alignItems: "center", gap: 5, overflow: "hidden" }}>
                  <span style={{ fontSize: 10, color: "#94a3b8", flexShrink: 0 }}>{task.hideChildren ? "▶" : "▼"}</span>
                  {dept && <div style={{ width: 7, height: 7, borderRadius: "50%", background: dept.color, flexShrink: 0 }} />}
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                    {task.name}
                  </span>
                  {/* 프로젝트 진행률 */}
                  <span style={{ fontSize: 9, color: "#64748b", fontWeight: 600, flexShrink: 0 }}>{progress}%</span>
                </div>
                {/* 담당자 컬럼 (프로젝트는 비움) */}
                <div style={{ width: 100 }} />
                {/* 진행률 바 */}
                <div style={{ width: 60, padding: "0 8px" }}>
                  <div style={{ height: 4, background: "#e2e8f0", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${progress}%`, background: dept?.color || "#6366f1", borderRadius: 2, transition: "width 0.3s" }} />
                  </div>
                </div>
              </div>
            );
          }

          /* ── 자식 업무 행 ── */
          return (
            <div
              key={task.id}
              style={{
                display: "flex",
                alignItems: "center",
                height: rowHeight,
                borderBottom: "1px solid #f1f5f9",
                background: "#fff",
                borderLeft: `3px solid ${sc}44`,
              }}
            >
              {/* 업무명 + 인라인 칩 */}
              <div style={{ width: rowWidth, padding: "0 6px 0 16px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 3, overflow: "hidden" }}>
                {/* 타이틀 라인 */}
                <div style={{ display: "flex", alignItems: "center", gap: 5, overflow: "hidden" }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: sc, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 500, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                    {task.name}
                  </span>
                </div>
                {/* 칩 라인: 상태 + 담당자 아바타 */}
                <div style={{ display: "flex", alignItems: "center", gap: 3, paddingLeft: 10, overflow: "hidden" }}>
                  <span style={{ fontSize: 8, color: sc, background: sc + "1a", padding: "1px 5px", borderRadius: 3, fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap", lineHeight: 1.6 }}>
                    {statusLabel[task._status] || ""}
                  </span>
                  {assignees.slice(0, 3).map((h) => (
                    <span key={h.id} title={h.name} style={{ fontSize: 11, lineHeight: 1, flexShrink: 0 }}>{h.avatar || "👤"}</span>
                  ))}
                  {assignees.length > 3 && (
                    <span style={{ fontSize: 8, color: "#94a3b8", flexShrink: 0 }}>+{assignees.length - 3}</span>
                  )}
                  {assigneeDept && (
                    <span style={{ fontSize: 8, color: assigneeDept.color || "#94a3b8", background: (assigneeDept.color || "#94a3b8") + "18", padding: "1px 4px", borderRadius: 3, fontWeight: 600, flexShrink: 0, maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {assigneeDept.name}
                    </span>
                  )}
                </div>
              </div>

              {/* 담당자 이름 컬럼 */}
              <div style={{ width: 100, padding: "0 6px", overflow: "hidden" }}>
                {firstAssignee && (
                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <span style={{ fontSize: 13, flexShrink: 0 }}>{firstAssignee.avatar || "👤"}</span>
                    <span style={{ fontSize: 9, fontWeight: 600, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {firstAssignee.name}
                      {assignees.length > 1 && <span style={{ color: "#94a3b8", fontWeight: 400 }}> +{assignees.length - 1}</span>}
                    </span>
                  </div>
                )}
              </div>

              {/* 진행률 바 */}
              <div style={{ width: 60, padding: "0 8px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ height: 3, background: "#f1f5f9", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${progress}%`, background: sc, borderRadius: 2, transition: "width 0.3s" }} />
                  </div>
                  <span style={{ fontSize: 8, color: "#94a3b8", textAlign: "right" }}>{progress}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };
}

export default function GanttView({
  allNodes = [],
  projData = [],
  departments = [],
  humans = [],
  onNodesChange = () => {},
}) {
  const [viewMode, setViewMode] = useState(ViewMode.Week);
  const [filterProject, setFilterProject] = useState("all");
  const [filterDept, setFilterDept] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [dateModal, setDateModal] = useState(null);
  const [collapsedProjects, setCollapsedProjects] = useState(new Set());
  const [columnWidth, setColumnWidth] = useState(60);
  const [showNoDate, setShowNoDate] = useState(false);
  const ganttContainerRef = useRef(null);

  // 현재 필터(프로젝트/부서/담당자)를 통과하는지 — dueDate 조건만 분리
  const passesFilter = (n) => {
    if (filterProject !== "all" && n.projectId !== filterProject) return false;
    const proj = projData.find((p) => p.id === n.projectId);
    if (filterDept !== "all" && proj?.dept !== filterDept) return false;
    if (
      filterAssignee !== "all" &&
      !(n.assignees || []).includes(filterAssignee)
    )
      return false;
    return true;
  };

  // 필터링된 nodes (dueDate 있는 것만) → 타임라인에 표시
  const filteredNodes = allNodes.filter((n) => n.dueDate && passesFilter(n));

  // 마감일 미정 nodes (방식 A+D) — 타임라인에서 누락되지 않도록 별도 백로그로 노출
  const noDateNodes = allNodes.filter((n) => !n.dueDate && passesFilter(n));

  const tasks = useMemo(
    () => toGanttTasks(filteredNodes, projData, departments, collapsedProjects),
    [filteredNodes, projData, departments, collapsedProjects]
  );

  // 프로젝트 펼침/접힘 토글
  const handleExpanderClick = (task) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      next.has(task.id) ? next.delete(task.id) : next.add(task.id);
      return next;
    });
  };

  // Ctrl+휠 줌
  useEffect(() => {
    const handleWheel = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setColumnWidth((prev) => {
        const next = e.deltaY < 0 ? prev + 8 : prev - 8;
        return Math.max(20, Math.min(200, next));
      });
    };
    const el = ganttContainerRef.current;
    if (el) el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      if (el) el.removeEventListener("wheel", handleWheel);
    };
  }, []);

  const TaskListTable = useMemo(
    () => makeTaskListTable(humans, departments),
    [humans, departments]
  );

  // 바 클릭 핸들러 — project 바 클릭 시 펼침/접힘, task 클릭 시 날짜/상태/담당자 편집
  const handleTaskClick = (task) => {
    if (task.type === "project") {
      handleExpanderClick(task);
      return;
    }
    const node = allNodes.find((n) => n.id === task.id);
    setDateModal({
      task,
      startDate: task.start.toISOString().slice(0, 10),
      endDate: task.end.toISOString().slice(0, 10),
      status: node?.status || task._status || "todo",
      desc: node?.desc || "",
      assignees: node?.assignees || task._assignees || [],
    });
  };

  // 마감일 미정 노드 클릭 → 동일한 편집 모달을 today 기본값으로 열어 날짜 지정 유도
  const openNoDateNode = (node) => {
    const today = new Date().toISOString().slice(0, 10);
    setDateModal({
      task: { id: node.id, name: node.title },
      startDate: node.startDate || today,
      endDate: node.dueDate || today,
      status: node.status || "todo",
      desc: node.desc || "",
      assignees: node.assignees || [],
    });
  };

  // 저장
  const handleDateSave = async () => {
    const node = allNodes.find((n) => n.id === dateModal.task.id);
    if (!node) return;
    try {
      await fetch(
        `http://localhost:3001/api/data/projects/${node.projectId}/nodes/${node.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startDate: dateModal.startDate,
            dueDate: dateModal.endDate,
            status: dateModal.status,
            desc: dateModal.desc,
            assignees: dateModal.assignees,
          }),
        }
      );
      onNodesChange?.();
    } catch (e) {
      console.error("저장 실패:", e);
    }
    setDateModal(null);
  };

  // 주 뷰 W번호 → 날짜 범위 변환
  useEffect(() => {
    if (viewMode !== ViewMode.Week) return;
    const container = ganttContainerRef.current;
    if (!container) return;

    const replaceWeekNumbers = () => {
      container.querySelectorAll("text").forEach((el) => {
        const txt = el.textContent?.trim() || "";
        const m = txt.match(/^W(\d+)$/);
        if (!m) return;
        const weekNum = parseInt(m[1], 10);
        const year = new Date().getFullYear();
        const jan4 = new Date(year, 0, 4);
        const monday = new Date(jan4);
        monday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (weekNum - 1) * 7);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const fmt = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
        el.textContent = `${fmt(monday)}~${fmt(sunday)}`;
      });
    };

    replaceWeekNumbers();
    const obs = new MutationObserver(replaceWeekNumbers);
    obs.observe(container, { childList: true, subtree: true, characterData: true });
    return () => obs.disconnect();
  }, [viewMode, tasks, columnWidth]);

  // 서브 그리드 라인 — 주뷰: 일별(7등분), 월뷰: 주별(4등분)
  useEffect(() => {
    const container = ganttContainerRef.current;
    if (!container) return;

    const divisions = viewMode === ViewMode.Week ? 7 : 4;

    const addSubLines = () => {
      // gantt-task-react는 SVG를 2개 렌더링:
      //   [0] 헤더 SVG (height ≈ 50), [1] 바/그리드 SVG (height >> 100)
      const allSvgs = Array.from(container.querySelectorAll("svg"));
      const svg = allSvgs.find((s) => parseFloat(s.getAttribute("height") || "0") > 100)
               || allSvgs[allSvgs.length - 1];
      if (!svg) return;

      // 기존 서브라인 제거
      svg.querySelectorAll(".sub-grid-line").forEach((l) => l.remove());

      // 세로선 요소들 찾기 (x1 ≈ x2인 line)
      const allLines = Array.from(svg.querySelectorAll("line"));
      const vertLines = allLines.filter((l) => {
        const x1 = parseFloat(l.getAttribute("x1"));
        const x2 = parseFloat(l.getAttribute("x2"));
        return !isNaN(x1) && Math.abs(x1 - x2) < 1;
      });
      if (vertLines.length < 2) return;

      const xs = vertLines
        .map((l) => parseFloat(l.getAttribute("x1")))
        .filter((x) => !isNaN(x));
      const uniqueXs = [...new Set(xs.map((x) => Math.round(x)))].sort((a, b) => a - b);
      if (uniqueXs.length < 2) return;

      const colW = uniqueXs[1] - uniqueXs[0];
      if (colW < 4) return;

      const svgH = parseFloat(svg.getAttribute("height")) || 2000;
      const svgNS = "http://www.w3.org/2000/svg";

      const fragment = document.createDocumentFragment();
      uniqueXs.forEach((x) => {
        for (let i = 1; i < divisions; i++) {
          const line = document.createElementNS(svgNS, "line");
          const subX = x + (colW / divisions) * i;
          line.setAttribute("x1", String(subX));
          line.setAttribute("x2", String(subX));
          line.setAttribute("y1", "0");
          line.setAttribute("y2", String(svgH));
          line.setAttribute("stroke", "#dde1e9");
          line.setAttribute("stroke-width", "0.8");
          line.setAttribute("stroke-dasharray", "3,3");
          line.classList.add("sub-grid-line");
          fragment.appendChild(line);
        }
      });

      // g.ticks (기존 컬럼 세로선 그룹) 안에 삽입
      // → g.rows(row 배경) 위, 바(bar) 아래 레이어에 렌더링됨
      const ticks = svg.querySelector("g.ticks");
      if (ticks) ticks.appendChild(fragment);
      else {
        const firstG = svg.querySelector("g");
        if (firstG) firstG.appendChild(fragment);
        else svg.appendChild(fragment);
      }
    };

    addSubLines();

    // 무한루프 방지: sub-grid-line 자체 변경은 무시
    const obs = new MutationObserver((mutations) => {
      const relevant = mutations.some((m) => {
        if (m.type === "childList") {
          const nodes = [...Array.from(m.addedNodes), ...Array.from(m.removedNodes)];
          return nodes.some(
            (n) => n.nodeType === 1 && !n.classList?.contains("sub-grid-line")
          );
        }
        return false;
      });
      if (relevant) addSubLines();
    });

    obs.observe(container, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [viewMode, tasks, columnWidth]);

  // 뷰 모드 변경 시 columnWidth 리셋
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    if (mode === ViewMode.Week) setColumnWidth(60);
    else if (mode === ViewMode.Month) setColumnWidth(120);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        background: "#fff",
      }}
    >
      {/* 상단 컨트롤 바 */}
      <div
        style={{
          padding: "8px 16px",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
          flexWrap: "wrap",
          background: "#fff",
        }}
      >
        {/* 뷰 모드 버튼 */}
        <div
          style={{
            display: "flex",
            gap: 2,
            background: "#f1f5f9",
            borderRadius: 6,
            padding: 2,
          }}
        >
          {[
            { mode: ViewMode.Week, label: "주" },
            { mode: ViewMode.Month, label: "월" },
          ].map(({ mode, label }) => (
            <button
              key={label}
              onClick={() => handleViewModeChange(mode)}
              style={{
                padding: "3px 10px",
                borderRadius: 4,
                border: "none",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                background: viewMode === mode ? "#fff" : "transparent",
                color: viewMode === mode ? "#6366f1" : "#64748b",
                boxShadow:
                  viewMode === mode ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 18, background: "#e2e8f0" }} />

        {/* 프로젝트 필터 */}
        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          style={selectStyle}
        >
          <option value="all">전체 프로젝트</option>
          {projData.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>

        {/* 부서 필터 */}
        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          style={selectStyle}
        >
          <option value="all">전체 부서</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        {/* 담당자 필터 */}
        <select
          value={filterAssignee}
          onChange={(e) => setFilterAssignee(e.target.value)}
          style={selectStyle}
        >
          <option value="all">전체 담당자</option>
          {humans.map((h) => (
            <option key={h.id} value={h.id}>
              {h.avatar} {h.name}
            </option>
          ))}
        </select>

        <span style={{ marginLeft: "auto", fontSize: 10, color: "#94a3b8" }}>
          바 클릭 시 날짜/상태/담당자 편집 가능
        </span>
      </div>

      {/* 마감일 미정 백로그 (방식 A+D) — 타임라인에서 누락된 노드를 숨기지 않고 노출 */}
      {noDateNodes.length > 0 && (
        <div style={{ flexShrink: 0, borderBottom: "1px solid #fde68a", background: "#fffbeb" }}>
          <div
            onClick={() => setShowNoDate((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 16px",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <span style={{ fontSize: 12 }}>📋</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#b45309" }}>
              마감일 미정 {noDateNodes.length}건
            </span>
            <span style={{ fontSize: 10, color: "#d97706" }}>
              · 타임라인에 표시되지 않음 (클릭하여 날짜 지정)
            </span>
            <span style={{ marginLeft: "auto", fontSize: 10, color: "#d97706" }}>
              {showNoDate ? "▲ 접기" : "▼ 펼치기"}
            </span>
          </div>
          {showNoDate && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 16px 10px" }}>
              {noDateNodes.map((node) => {
                const proj = projData.find((p) => p.id === node.projectId);
                const dept = departments.find((d) => d.id === proj?.dept);
                const sc =
                  { todo: "#94a3b8", active: "#f59e0b", review: "#6366f1", done: "#34d399" }[
                    node.status
                  ] || "#94a3b8";
                const assignees = (node.assignees || [])
                  .map((id) => humans.find((h) => h.id === id))
                  .filter(Boolean);
                return (
                  <button
                    key={node.id}
                    onClick={() => openNoDateNode(node)}
                    title="클릭하여 시작일/마감일 지정"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 10px",
                      borderRadius: 7,
                      border: "1px solid #fcd34d",
                      background: "#fff",
                      cursor: "pointer",
                      maxWidth: 240,
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: sc, flexShrink: 0 }} />
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#1e293b",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {node.title}
                    </span>
                    {dept && (
                      <span
                        style={{
                          fontSize: 8,
                          color: dept.color || "#94a3b8",
                          background: (dept.color || "#94a3b8") + "18",
                          padding: "1px 5px",
                          borderRadius: 3,
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        {proj?.title || dept.name}
                      </span>
                    )}
                    {assignees.slice(0, 3).map((h) => (
                      <span key={h.id} title={h.name} style={{ fontSize: 11, lineHeight: 1, flexShrink: 0 }}>
                        {h.avatar || "👤"}
                      </span>
                    ))}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 간트 차트 또는 빈 화면 */}
      {tasks.length === 0 ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            color: "#94a3b8",
            fontSize: 13,
          }}
        >
          표시할 업무가 없습니다
        </div>
      ) : (
        <div
          ref={ganttContainerRef}
          style={{ flex: 1, overflow: "auto", cursor: "grab" }}
          onMouseDown={(e) => {
            if (e.target.closest("button, input, select")) return;
            e.preventDefault();
            const scrollEl = ganttContainerRef.current?.querySelector('._2k9Ys');
            if (!scrollEl) return;
            const startX = e.clientX;
            const startScrollLeft = scrollEl.scrollLeft;
            const container = ganttContainerRef.current;
            container.style.cursor = "grabbing";
            container.style.userSelect = "none";
            const onMove = (ev) => {
              const dx = ev.clientX - startX;
              scrollEl.scrollLeft = startScrollLeft - dx;
            };
            const onUp = () => {
              container.style.cursor = "grab";
              container.style.userSelect = "";
              document.removeEventListener("mousemove", onMove);
              document.removeEventListener("mouseup", onUp);
            };
            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
          }}
        >
          {/* bar label 전부 숨김, 드래그 핸들 비활성화 */}
          <style>{`
            ._3zRJQ {
              fill: transparent !important;
            }
            ._3KcaM {
              fill: transparent !important;
            }
            ._3w_5u {
              display: none !important;
            }
            ._9w8d5 {
              font-size: 11px !important;
              font-weight: 700 !important;
            }
            ._2q1Kt {
              font-size: 11px !important;
              font-weight: 600 !important;
            }
          `}</style>
          <Gantt
            tasks={tasks}
            viewMode={viewMode}
            onClick={handleTaskClick}
            onExpanderClick={handleExpanderClick}
            listCellWidth="240px"
            columnWidth={columnWidth}
            rowHeight={40}
            barFill={75}
            barCornerRadius={3}
            handleWidth={8}
            fontSize="11"
            TaskListHeader={TaskListHeaderCustom}
            TaskListTable={TaskListTable}
            todayColor="rgba(99,102,241,0.12)"
            locale="ko-KR"
          />
        </div>
      )}

      {/* 날짜/상태/담당자 편집 팝업 */}
      {dateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setDateModal(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 20,
              minWidth: 360,
              boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#1e293b",
                marginBottom: 14,
              }}
            >
              {dateModal.task.name}
            </div>

            {/* 날짜 필드 */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginBottom: 14,
              }}
            >
              <label style={{ fontSize: 11, color: "#64748b" }}>
                시작일
                <input
                  type="date"
                  value={dateModal.startDate}
                  onChange={(e) =>
                    setDateModal((prev) => ({
                      ...prev,
                      startDate: e.target.value,
                    }))
                  }
                  style={{
                    display: "block",
                    marginTop: 4,
                    width: "100%",
                    padding: "6px 8px",
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    fontSize: 12,
                    boxSizing: "border-box",
                  }}
                />
              </label>
              <label style={{ fontSize: 11, color: "#64748b" }}>
                종료일
                <input
                  type="date"
                  value={dateModal.endDate}
                  onChange={(e) =>
                    setDateModal((prev) => ({
                      ...prev,
                      endDate: e.target.value,
                    }))
                  }
                  style={{
                    display: "block",
                    marginTop: 4,
                    width: "100%",
                    padding: "6px 8px",
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    fontSize: 12,
                    boxSizing: "border-box",
                  }}
                />
              </label>
            </div>

            {/* 상태 선택 */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: "#64748b", marginBottom: 6, fontWeight: 700 }}>상태</div>
              <div style={{ display: "flex", gap: 4 }}>
                {[
                  { key: "todo",   label: "대기",   color: "#94a3b8" },
                  { key: "active", label: "진행중", color: "#f59e0b" },
                  { key: "review", label: "검토중", color: "#6366f1" },
                  { key: "done",   label: "완료",   color: "#34d399" },
                ].map(({ key, label, color }) => (
                  <button
                    key={key}
                    onClick={() => setDateModal((prev) => ({ ...prev, status: key }))}
                    style={{
                      flex: 1,
                      padding: "5px 0",
                      borderRadius: 6,
                      border: `1.5px solid ${dateModal.status === key ? color : "#e2e8f0"}`,
                      background: dateModal.status === key ? color + "22" : "transparent",
                      color: dateModal.status === key ? color : "#94a3b8",
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 메모 */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4, fontWeight: 700 }}>메모</div>
              <textarea
                value={dateModal.desc}
                onChange={(e) => setDateModal((prev) => ({ ...prev, desc: e.target.value }))}
                placeholder="메모를 입력하세요..."
                rows={2}
                style={{
                  width: "100%",
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  padding: "6px 8px",
                  fontSize: 11,
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* 담당자 */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4, fontWeight: 700 }}>담당자</div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 6, maxHeight: 120, overflowY: "auto" }}>
                {humans.map((h) => {
                  const sel = (dateModal.assignees || []).includes(h.id);
                  const dept = departments.find((d) => d.id === h.deptId);
                  return (
                    <div
                      key={h.id}
                      onClick={() =>
                        setDateModal((prev) => ({
                          ...prev,
                          assignees: sel
                            ? prev.assignees.filter((x) => x !== h.id)
                            : [...(prev.assignees || []), h.id],
                        }))
                      }
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 10px",
                        cursor: "pointer",
                        background: sel ? "#ede9fe" : "#fff",
                        borderBottom: "1px solid #f1f5f9",
                      }}
                    >
                      <input type="checkbox" checked={sel} readOnly style={{ pointerEvents: "none" }} />
                      <span style={{ fontSize: 13 }}>{h.avatar}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: "#1e293b", fontWeight: sel ? 700 : 400 }}>{h.name}</div>
                        {dept && (
                          <span style={{ fontSize: 9, color: dept.color || "#94a3b8", background: (dept.color || "#94a3b8") + "18", padding: "1px 5px", borderRadius: 3, fontWeight: 600 }}>
                            {dept.name}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 버튼 */}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setDateModal(null)}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: 7,
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  color: "#64748b",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                취소
              </button>
              <button
                onClick={handleDateSave}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: 7,
                  border: "none",
                  background: "#6366f1",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
