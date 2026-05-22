import { useState, useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";
import { PROJS, COLORS, getDept } from "../data/mockData";
import { getHuman } from "../data/humans";

const { border: BR } = COLORS;
const W = 700, H = 260;

export default function OntologyGraph({ onNodeClick }) {
  const svgRef = useRef(null);
  const [expanded, setExpanded] = useState({});
  const [positions, setPositions] = useState({});
  const posRef = useRef({});

  const { nodes, links } = useMemo(() => {
    const ns = [], ls = [];
    PROJS.forEach((p) => {
      const d = getDept(p.dept);
      ns.push({ id: p.id, type: "proj", r: 22, color: "#00d4ff", label: p.title.slice(0, 9) + (p.title.length > 9 ? "…" : ""), data: p });
      if (expanded[p.id]) {
        p.tasks.forEach((t, i) => {
          const tid = p.id + "_t" + i;
          const tc = t.s === "done" ? "#00ff88" : t.s === "active" ? "#ffa500" : "#446688";
          const hu = getHuman(t.a);
          ns.push({ id: tid, type: "task", r: 12, color: tc, label: t.t, sub: hu?.name || "", data: { task: t, proj: p, human: hu } });
          ls.push({ source: p.id, target: tid, c: d?.color || "#444" });
        });
      }
    });
    return { nodes: ns, links: ls };
  }, [expanded]);

  useEffect(() => {
    if (!nodes.length) return;
    const sn = nodes.map((n) => ({
      id: n.id, r: n.r,
      x: posRef.current[n.id]?.x ?? (W / 2 + (Math.random() - 0.5) * 240),
      y: posRef.current[n.id]?.y ?? (H / 2 + (Math.random() - 0.5) * 100),
    }));
    const sl = links.map((l) => ({ source: l.source, target: l.target }));
    const sim = d3.forceSimulation(sn)
      .force("link",    d3.forceLink(sl).id((d) => d.id).distance(85).strength(1))
      .force("charge",  d3.forceManyBody().strength(-600))
      .force("center",  d3.forceCenter(W / 2, H / 2))
      .force("collide", d3.forceCollide().radius((d) => d.r + 20).strength(1))
      .stop();
    for (let i = 0; i < 500; i++) sim.tick();
    const p = {};
    sn.forEach((n) => {
      posRef.current[n.id] = { x: Math.max(30, Math.min(W - 30, n.x)), y: Math.max(25, Math.min(H - 25, n.y)) };
      p[n.id] = posRef.current[n.id];
    });
    setPositions(p);
  }, [nodes.map((n) => n.id).join(",")]);

  const clickNode = (node) => {
    if (node.type === "proj") setExpanded((e) => ({ ...e, [node.id]: !e[node.id] }));
    onNodeClick(node.type === "proj" ? { type: "project", id: node.id } : { type: "task", ...node.data });
  };

  return (
    <div style={{ position: "relative", background: "#000810", borderBottom: "1px solid " + BR, flexShrink: 0 }}>
      {["tl", "tr", "bl", "br"].map((c) => (
        <div key={c} style={{ position: "absolute", [c[0] === "t" ? "top" : "bottom"]: 0, [c[1] === "l" ? "left" : "right"]: 0, width: 14, height: 14, borderTop: c[0] === "t" ? "1px solid #00d4ff44" : 0, borderBottom: c[0] === "b" ? "1px solid #00d4ff44" : 0, borderLeft: c[1] === "l" ? "1px solid #00d4ff44" : 0, borderRight: c[1] === "r" ? "1px solid #00d4ff44" : 0 }} />
      ))}
      <div style={{ position: "absolute", top: 7, left: 12, fontSize: 9, color: "#00d4ff55", fontFamily: "monospace", letterSpacing: 2, zIndex: 2, pointerEvents: "none" }}>ONTOLOGY·GRAPH // 큰 원 클릭 → 업무 펼치기</div>
      <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,8,20,.1) 3px,rgba(0,8,20,.1) 4px)", pointerEvents: "none", zIndex: 1 }} />
      <svg ref={svgRef} width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {Array.from({ length: 9 },  (_, i) => <line key={"h" + i} x1={0}   y1={i * 32} x2={W}   y2={i * 32} stroke="#001122" strokeWidth={0.5} />)}
        {Array.from({ length: 23 }, (_, i) => <line key={"v" + i} x1={i * 32} y1={0}   x2={i * 32} y2={H}   stroke="#001122" strokeWidth={0.5} />)}
        {links.map((l, i) => {
          const sid = typeof l.source === "string" ? l.source : l.source.id;
          const tid = typeof l.target === "string" ? l.target : l.target.id;
          const s = positions[sid], t = positions[tid];
          if (!s || !t) return null;
          return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke={l.c} strokeOpacity={0.45} strokeWidth={1.5} strokeDasharray="5 3" />;
        })}
        {nodes.map((node) => {
          const pos = positions[node.id];
          if (!pos) return null;
          const isExp = expanded[node.id];
          return (
            <g key={node.id} transform={`translate(${pos.x},${pos.y})`} onClick={() => clickNode(node)} style={{ cursor: "pointer" }}>
              {isExp && <circle r={node.r + 9} fill="none" stroke={node.color} strokeWidth={1} strokeOpacity={0.25} strokeDasharray="3 3" />}
              <circle r={node.r} fill={node.color + "18"} stroke={node.color} strokeWidth={node.type === "proj" ? 2 : 1.5} filter="url(#glow)" />
              <text y={node.type === "proj" ? -1 : 1} textAnchor="middle" fill={node.color} fontSize={node.type === "proj" ? 9 : 8} fontWeight="700" fontFamily="monospace" style={{ pointerEvents: "none" }}>{node.label}</text>
              {node.sub && <text y={12} textAnchor="middle" fill="#336688" fontSize={7} fontFamily="monospace" style={{ pointerEvents: "none" }}>{node.sub}</text>}
              {node.type === "proj" && <text y={node.r + 12} textAnchor="middle" fill="#004466" fontSize={7} fontFamily="monospace" style={{ pointerEvents: "none" }}>{isExp ? "▲ 닫기" : "▼ 열기"}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
