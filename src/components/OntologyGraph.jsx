import { useEffect, useRef } from "react";
import * as d3 from "d3";

const TASK_STATUS_COLOR = { done: "#16a34a", active: "#d97706", todo: "#94a3b8", review: "#8b5cf6" };

// 실제 Dify 봇 (채팅/우측패널과 동일)
const BOTS = [
  { id: "director", name: "기획 디렉터",   icon: "🎯", color: "#6366f1" },
  { id: "saup",     name: "사업계획서 봇",  icon: "📑", color: "#f59e0b" },
  { id: "jiwon",    name: "지원사업 봇",    icon: "🏛️", color: "#10b981" },
  { id: "service",  name: "서비스소개서 봇", icon: "📄", color: "#38bdf8" },
  { id: "cs",       name: "CS 문구 봇",     icon: "💬", color: "#f472b6" },
  { id: "meeting",  name: "회의록 봇",      icon: "🗒️", color: "#a78bfa" },
  { id: "qa",       name: "사내 Q&A 봇",   icon: "❓", color: "#94a3b8" },
  { id: "research", name: "리서치 봇",      icon: "🔍", color: "#0ea5e9" },
  { id: "review",   name: "검토·감수 봇",   icon: "✅", color: "#22c55e" },
  { id: "ppt",      name: "발표자료 PPT 봇", icon: "📊", color: "#fb923c" },
];

// ── Graph data: Project-centric ───────────────────────────────────────────────
// Project = hub → Tasks → Assignees (human/AI)
// Department expressed via color only, no dept hub nodes
function buildGraph(projData, departments, humans) {
  const nodes = [];
  const links = [];
  const addedHumans = new Set();
  const addedAgents = new Set();

  projData.forEach((proj) => {
    const dept = departments.find(d => d.id === proj.dept);
    const deptColor = dept?.color || "#6366f1";

    nodes.push({
      id: proj.id,
      type: "proj",
      label: proj.title,
      color: deptColor,
      dept: dept?.name || "",
      deptColor,
      r: 22,
      projData: proj,
    });

    proj.tasks.forEach((task, i) => {
      const taskId = `${proj.id}_t${i}`;
      const sc = TASK_STATUS_COLOR[task.s] || "#94a3b8";

      nodes.push({
        id: taskId,
        type: "task",
        label: task.t,
        color: sc,
        r: 10,
        taskData: task,
        projId: proj.id,
        assignee: task.a,
      });

      links.push({
        id: `pt_${taskId}`,
        source: proj.id,
        target: taskId,
        color: deptColor + "55",
        strokeWidth: 1.5,
        dash: null,
      });

      // Task → Human assignee(s): 구형 task.a 또는 신형 task.assignees[] 둘 다 지원
      const assigneeIds = Array.isArray(task.assignees)
        ? task.assignees
        : (task.a ? [task.a] : []);

      assigneeIds.forEach(aid => {
        const human = humans.find(h => h.id === aid);
        if (!human) return;
        const humanNodeId = `human_${human.id}`;
        if (!addedHumans.has(human.id)) {
          addedHumans.add(human.id);
          nodes.push({
            id: humanNodeId,
            type: "human",
            label: human.name,
            avatar: human.avatar,
            color: human.color,
            r: 16,
            humanData: human,
          });
        }
        links.push({
          id: `th_${taskId}_${human.id}`,
          source: taskId,
          target: humanNodeId,
          color: human.color + "55",
          strokeWidth: 1,
          dash: "4 3",
        });
      });
    });
  });

  // AI 봇 허브 + 10개 봇 → 모든 프로젝트를 지원
  nodes.push({ id: "bothub", type: "bothub", label: "AI 봇 팀", color: "#7c3aed", r: 15 });
  projData.forEach((proj) => {
    links.push({ id: `hub_${proj.id}`, source: "bothub", target: proj.id, color: "#7c3aed22", strokeWidth: 0.8, dash: "2 4" });
  });
  BOTS.forEach((b) => {
    nodes.push({ id: `bot_${b.id}`, type: "bot", label: b.name, icon: b.icon, color: b.color, r: 11, botData: b });
    links.push({ id: `botlink_${b.id}`, source: `bot_${b.id}`, target: "bothub", color: b.color + "55", strokeWidth: 1.2, dash: null });
  });

  return { nodes, links };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function OntologyGraph({ onNodeClick, projData = [], departments = [], humans = [] }) {
  const svgRef      = useRef(null);
  const containerRef = useRef(null);
  const simRef      = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    const svgEl     = svgRef.current;
    if (!container || !svgEl) return;

    const width  = container.clientWidth  || 900;
    const height = container.clientHeight || 480;

    const svg = d3.select(svgEl).attr("width", width).attr("height", height);
    svg.selectAll("*").remove();

    // SVG filter: white semi-transparent halo behind text labels
    const defs = svg.append("defs");
    const textFilter = defs.append("filter")
      .attr("id", "textBg")
      .attr("x", "-8%").attr("y", "-25%")
      .attr("width", "116%").attr("height", "150%");
    textFilter.append("feMorphology")
      .attr("in", "SourceAlpha").attr("operator", "dilate")
      .attr("radius", "2.5").attr("result", "expanded");
    textFilter.append("feFlood")
      .attr("flood-color", "white").attr("flood-opacity", "0.82")
      .attr("result", "white");
    textFilter.append("feComposite")
      .attr("in", "white").attr("in2", "expanded")
      .attr("operator", "in").attr("result", "bg");
    const feMerge = textFilter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "bg");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Zoom / pan
    const g    = svg.append("g");
    const zoom = d3.zoom().scaleExtent([0.2, 4]).on("zoom", (e) => g.attr("transform", e.transform));
    svg.call(zoom);

    const linkLayer = g.append("g");
    const nodeLayer = g.append("g");

    const { nodes, links } = buildGraph(projData, departments, humans);

    if (simRef.current) simRef.current.stop();
    const sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d) => d.id)
        .distance((d) => {
          const st = (d.source?.type || "") + "-" + (d.target?.type || "");
          if (st === "proj-task")    return 75;
          if (st === "task-human")   return 55;
          if (st === "bot-bothub")   return 48;
          if (st === "bothub-proj")  return 120;
          return 70;
        })
        .strength(0.65))
      .force("charge", d3.forceManyBody().strength((d) => {
        if (d.type === "proj")   return -520;
        if (d.type === "bothub") return -420;
        if (d.type === "human")  return -260;
        if (d.type === "task")   return -130;
        return -90;
      }))
      .force("center",  d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide((d) => d.r + 14))
      .force("x", d3.forceX(width  / 2).strength(0.03))
      .force("y", d3.forceY(height / 2).strength(0.03));
    simRef.current = sim;

    // Links
    const linkSel = linkLayer.selectAll("line")
      .data(links, (d) => d.id)
      .join("line")
      .attr("stroke",           (d) => d.color)
      .attr("stroke-width",     (d) => d.strokeWidth)
      .attr("stroke-dasharray", (d) => d.dash || null)
      .attr("stroke-linecap", "round");

    // Node groups
    const nodeG = nodeLayer.selectAll("g.node")
      .data(nodes, (d) => d.id)
      .join("g")
      .attr("class", "node")
      .style("cursor", "pointer")
      .call(d3.drag()
        .on("start", (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on("drag",  (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on("end",   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }))
      .on("click", (e, d) => {
        e.stopPropagation();
        if (!onNodeClick) return;
        if (d.type === "proj")  onNodeClick({ type: "project", id: d.id, data: d.projData });
        if (d.type === "task")  {
          const proj  = projData.find((p) => p.id === d.projId);
          const human = humans.find(h => h.id === d.assignee);
          onNodeClick({ type: "task", proj, task: d.taskData, human });
        }
        if (d.type === "human") onNodeClick({ type: "human", human: d.humanData });
      });

    // Circle fill
    nodeG.append("circle")
      .attr("r",    (d) => d.r)
      .attr("fill", (d) => d.color + (d.type === "proj" ? "20" : d.type === "human" ? "18" : "22"))
      .attr("stroke",       (d) => d.color)
      .attr("stroke-width", (d) => d.type === "proj" ? 2.5 : d.type === "human" ? 2 : 1.5);

    // Outer dashed ring for project nodes
    nodeG.filter((d) => d.type === "proj")
      .append("circle")
      .attr("r", (d) => d.r + 5)
      .attr("fill", "none")
      .attr("stroke",           (d) => d.color + "33")
      .attr("stroke-width",     1)
      .attr("stroke-dasharray", "5 3");

    // Progress arc inside project circle
    nodeG.filter((d) => d.type === "proj")
      .append("path")
      .attr("pointer-events", "none")
      .attr("fill",           "none")
      .attr("stroke",         (d) => d.color)
      .attr("stroke-width",   3)
      .attr("stroke-linecap", "round")
      .attr("d", (d) => {
        const pct = (d.projData?.progress || 0) / 100;
        if (pct <= 0) return "";
        const r2  = d.r - 5;
        const s   = -Math.PI / 2;
        const end = s + pct * 2 * Math.PI;
        const large = pct > 0.5 ? 1 : 0;
        return `M ${Math.cos(s)*r2} ${Math.sin(s)*r2} A ${r2} ${r2} 0 ${large} 1 ${Math.cos(end)*r2} ${Math.sin(end)*r2}`;
      });

    // Avatar emoji for human / agent
    nodeG.filter((d) => d.type === "human" || d.type === "bot" || d.type === "bothub")
      .append("text")
      .attr("text-anchor",        "middle")
      .attr("dominant-baseline",  "central")
      .attr("font-size",          (d) => d.type === "human" ? 14 : d.type === "bothub" ? 15 : 12)
      .attr("pointer-events",     "none")
      .text((d) => d.type === "human" ? d.avatar : d.type === "bothub" ? "🤖" : d.icon);

    // Main label
    nodeG.append("text")
      .attr("text-anchor",    "middle")
      .attr("dy",             (d) => d.r + 13)
      .attr("font-size",      (d) => d.type === "proj" ? 11 : d.type === "human" ? 10 : d.type === "bothub" ? 10 : d.type === "task" ? 9 : 8.5)
      .attr("font-weight",    (d) => (d.type === "proj" || d.type === "human" || d.type === "bothub") ? "600" : "400")
      .attr("fill",           (d) => d.type === "task" ? "#475569" : d.type === "bot" ? d.color : d.type === "bothub" ? "#7c3aed" : "#1e293b")
      .attr("font-family",    "system-ui, -apple-system, sans-serif")
      .attr("pointer-events", "none")
      .attr("filter",         "url(#textBg)")
      .text((d) => d.label.length > 14 ? d.label.slice(0, 13) + "…" : d.label);

    // Dept badge under project label
    nodeG.filter((d) => d.type === "proj")
      .append("text")
      .attr("text-anchor",    "middle")
      .attr("dy",             (d) => d.r + 24)
      .attr("font-size",      8)
      .attr("fill",           (d) => d.deptColor)
      .attr("font-family",    "system-ui, -apple-system, sans-serif")
      .attr("pointer-events", "none")
      .attr("filter",         "url(#textBg)")
      .text((d) => d.dept);

    // Job title under human label
    nodeG.filter((d) => d.type === "human")
      .append("text")
      .attr("text-anchor",    "middle")
      .attr("dy",             (d) => d.r + 24)
      .attr("font-size",      8)
      .attr("fill",           "#94a3b8")
      .attr("font-family",    "system-ui, -apple-system, sans-serif")
      .attr("pointer-events", "none")
      .attr("filter",         "url(#textBg)")
      .text((d) => d.humanData?.title || "");

    // Tick
    sim.on("tick", () => {
      linkSel
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);
      nodeG.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    // Resize
    const ro = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      svg.attr("width", w).attr("height", h);
      sim.force("center", d3.forceCenter(w / 2, h / 2))
         .force("x", d3.forceX(w / 2).strength(0.03))
         .force("y", d3.forceY(h / 2).strength(0.03))
         .alpha(0.3).restart();
    });
    ro.observe(container);

    return () => { sim.stop(); ro.disconnect(); svg.selectAll("*").remove(); };
  }, [projData, departments, humans]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", background: "#f8fafc", position: "relative", overflow: "hidden" }}>
      <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />

      {/* Legend */}
      <div style={{ position: "absolute", top: 10, right: 12, background: "white", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", marginBottom: 2, textTransform: "uppercase", letterSpacing: 1 }}>범례</div>
        {[
          { color: "#f59e0b", label: "프로젝트 (마케팅)" },
          { color: "#38bdf8", label: "프로젝트 (콘텐츠)" },
          { color: "#f472b6", label: "프로젝트 (디자인)" },
          { color: "#22c55e", label: "업무 완료" },
          { color: "#d97706", label: "업무 진행중" },
          { color: "#94a3b8", label: "업무 대기" },
          { color: "#1e293b", label: "팀원" },
          { color: "#7c3aed", label: "AI 봇 팀" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 9, color: "#64748b", fontFamily: "system-ui, sans-serif" }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Hint */}
      <div style={{ position: "absolute", bottom: 8, left: 10, fontSize: 9, color: "#94a3b8", fontFamily: "system-ui, sans-serif" }}>
        스크롤: 줌 · 드래그: 이동 · 클릭: 상세보기
      </div>
    </div>
  );
}
