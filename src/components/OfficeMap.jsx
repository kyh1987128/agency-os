import { useState } from "react";
import { HUMANS } from "../data/humans";
import { DEPTS } from "../data/mockData";

// ─── Isometric constants ────────────────────────────────────────────────────
const TILE_W = 72;
const TILE_H = 36;
const ORIGIN_Y = 60;
const GRID_COLS = 18;
const GRID_ROWS = 10;

function toISO(col, row, originX) {
  return {
    x: originX + (col - row) * (TILE_W / 2),
    y: ORIGIN_Y + (col + row) * (TILE_H / 2),
  };
}

function tilePoly(col, row, originX) {
  const { x, y } = toISO(col, row, originX);
  return [
    `${x},${y}`,
    `${x + TILE_W / 2},${y + TILE_H / 2}`,
    `${x},${y + TILE_H}`,
    `${x - TILE_W / 2},${y + TILE_H / 2}`,
  ].join(" ");
}

// ─── Dept zone map ───────────────────────────────────────────────────────────
// d1=마케팅, d2=콘텐츠, d3=디자인, d4=전략, d5=개발
const DEPT_ZONES = [
  { id: "marketing", name: "마케팅", colMin: 0,  colMax: 7,  rowMin: 0, rowMax: 4, color: "#f97316" },
  { id: "content",   name: "콘텐츠", colMin: 8,  colMax: 15, rowMin: 0, rowMax: 4, color: "#8b5cf6" },
  { id: "design",    name: "디자인", colMin: 0,  colMax: 7,  rowMin: 5, rowMax: 9, color: "#ec4899" },
  { id: "strategy",  name: "전략",   colMin: 8,  colMax: 11, rowMin: 5, rowMax: 9, color: "#06b6d4" },
  { id: "dev",       name: "개발",   colMin: 12, colMax: 15, rowMin: 5, rowMax: 9, color: "#22c55e" },
];

function getDeptForTile(col, row) {
  return DEPT_ZONES.find(
    (d) => col >= d.colMin && col <= d.colMax && row >= d.rowMin && row <= d.rowMax
  );
}

// ─── Human desk assignments ──────────────────────────────────────────────────
const DESK_MAP = {
  h1: { col: 2,  row: 1 },
  h2: { col: 5,  row: 1 },
  h3: { col: 10, row: 1 },
  h4: { col: 2,  row: 6 },
  h5: { col: 13, row: 6 },
  h6: { col: 9,  row: 6 },
};

// ─── Plant positions ─────────────────────────────────────────────────────────
const PLANTS = [
  { col: 0,  row: 0 },
  { col: 15, row: 0 },
  { col: 7,  row: 4 },
  { col: 0,  row: 9 },
  { col: 15, row: 9 },
];

// ─── Isometric Box helper ────────────────────────────────────────────────────
function IsoBox({ col, row, h, topColor, rightColor, leftColor, originX, children }) {
  const { x, y } = toISO(col, row, originX);
  const TW = TILE_W;
  const TH = TILE_H;

  const topPoints = [
    `${x},${y - h}`,
    `${x + TW / 2},${y + TH / 2 - h}`,
    `${x},${y + TH - h}`,
    `${x - TW / 2},${y + TH / 2 - h}`,
  ].join(" ");

  const rightPoints = [
    `${x + TW / 2},${y + TH / 2 - h}`,
    `${x},${y + TH - h}`,
    `${x},${y + TH}`,
    `${x + TW / 2},${y + TH / 2}`,
  ].join(" ");

  const leftPoints = [
    `${x - TW / 2},${y + TH / 2 - h}`,
    `${x},${y + TH - h}`,
    `${x},${y + TH}`,
    `${x - TW / 2},${y + TH / 2}`,
  ].join(" ");

  return (
    <g>
      <polygon points={leftPoints}  fill={leftColor}  stroke="#00000018" strokeWidth={0.5} />
      <polygon points={rightPoints} fill={rightColor} stroke="#00000018" strokeWidth={0.5} />
      <polygon points={topPoints}   fill={topColor}   stroke="#00000018" strokeWidth={0.5} />
      {children}
    </g>
  );
}

// ─── Plant component ─────────────────────────────────────────────────────────
function Plant({ col, row, originX }) {
  const { x, y } = toISO(col, row, originX);
  const potH = 10;
  const { x: px, y: py } = { x, y };

  return (
    <g>
      {/* Pot box */}
      <IsoBox col={col} row={row} h={potH} topColor="#a16207" rightColor="#78350f" leftColor="#92400e" originX={originX} />
      {/* Plant circle on top */}
      <circle cx={px} cy={py - potH - 6} r={8} fill="#16a34a" fillOpacity={0.85} stroke="#15803d" strokeWidth={1} />
      <circle cx={px - 4} cy={py - potH - 9} r={5} fill="#22c55e" fillOpacity={0.8} stroke="#16a34a" strokeWidth={0.5} />
      <circle cx={px + 4} cy={py - potH - 8} r={5} fill="#4ade80" fillOpacity={0.8} stroke="#16a34a" strokeWidth={0.5} />
    </g>
  );
}

// ─── Desk + Monitor component ────────────────────────────────────────────────
function Desk({ col, row, deptColor, originX }) {
  const { x, y } = toISO(col, row, originX);
  const deskH = 18;
  const monH  = 14;

  // Desk colors
  const deskTop   = "#cbd5e1";
  const deskRight = "#94a3b8";
  const deskLeft  = "#7f8fa4";

  // Monitor colors (slightly darker, with dept accent on top)
  const monTop   = deptColor + "cc";
  const monRight = "#334155";
  const monLeft  = "#1e293b";

  // Monitor is offset slightly toward back-center
  const mCol = col;
  const mRow = row;
  const mx = x;
  const my = y;

  return (
    <g>
      {/* Desk */}
      <IsoBox col={col} row={row} h={deskH} topColor={deskTop} rightColor={deskRight} leftColor={deskLeft} originX={originX} />
      {/* Monitor (same tile, taller, shifted back) */}
      <g transform={`translate(0, ${-deskH})`}>
        <IsoBox col={mCol} row={mRow} h={monH} topColor={monTop} rightColor={monRight} leftColor={monLeft} originX={originX} />
      </g>
      {/* Monitor screen glow */}
      <ellipse
        cx={mx}
        cy={my - deskH - monH + 2}
        rx={14}
        ry={7}
        fill={deptColor}
        fillOpacity={0.18}
      />
    </g>
  );
}

// ─── Chair component (small rhombus behind desk) ──────────────────────────────
function Chair({ col, row, originX }) {
  // Place chair at row+1 (in front of desk in iso = row+1 rendered closer)
  const chairRow = row + 1;
  const { x, y } = toISO(col, chairRow, originX);
  const TW = TILE_W * 0.5;
  const TH = TILE_H * 0.5;
  const chairH = 10;

  const topPoints = [
    `${x},${y - chairH}`,
    `${x + TW / 2},${y + TH / 2 - chairH}`,
    `${x},${y + TH - chairH}`,
    `${x - TW / 2},${y + TH / 2 - chairH}`,
  ].join(" ");

  const rightPoints = [
    `${x + TW / 2},${y + TH / 2 - chairH}`,
    `${x},${y + TH - chairH}`,
    `${x},${y + TH}`,
    `${x + TW / 2},${y + TH / 2}`,
  ].join(" ");

  const leftPoints = [
    `${x - TW / 2},${y + TH / 2 - chairH}`,
    `${x},${y + TH - chairH}`,
    `${x},${y + TH}`,
    `${x - TW / 2},${y + TH / 2}`,
  ].join(" ");

  return (
    <g>
      <polygon points={leftPoints}  fill="#475569" stroke="#00000018" strokeWidth={0.5} />
      <polygon points={rightPoints} fill="#334155" stroke="#00000018" strokeWidth={0.5} />
      <polygon points={topPoints}   fill="#64748b" stroke="#00000018" strokeWidth={0.5} />
    </g>
  );
}

// ─── Character Avatar component ───────────────────────────────────────────────
function CharAvatar({ human, col, row, selected, onClick, originX }) {
  const { x, y } = toISO(col, row, originX);
  const deskH = 18;
  const floatY = y - deskH - 20;

  const strokeW = selected ? 2.5 : 1.5;
  const ringR   = selected ? 20  : 16;
  const glowR   = selected ? 26  : 0;

  return (
    <g
      style={{ cursor: "pointer" }}
      onClick={onClick}
    >
      {/* Glow ring when selected */}
      {selected && (
        <circle
          cx={x}
          cy={floatY}
          r={glowR}
          fill="none"
          stroke={human.color}
          strokeWidth={1}
          strokeOpacity={0.35}
        />
      )}
      {/* Avatar circle background */}
      <circle
        cx={x}
        cy={floatY}
        r={ringR}
        fill={human.color}
        fillOpacity={0.15}
        stroke={human.color}
        strokeWidth={strokeW}
      />
      {/* Avatar emoji */}
      <text
        x={x}
        y={floatY + 5}
        textAnchor="middle"
        fontSize={selected ? 18 : 16}
        style={{ userSelect: "none", pointerEvents: "none" }}
      >
        {human.avatar}
      </text>
      {/* Name label */}
      <text
        x={x}
        y={y - deskH + 2}
        textAnchor="middle"
        fontSize={8}
        fill="#475569"
        fontFamily="monospace"
        style={{ userSelect: "none", pointerEvents: "none" }}
      >
        {human.name}
      </text>
      {/* Status dot (green = active) */}
      <circle
        cx={x + (ringR - 2)}
        cy={floatY - (ringR - 2)}
        r={4}
        fill="#22c55e"
        stroke="#ffffff"
        strokeWidth={1}
      />
    </g>
  );
}

// ─── Fixed canvas dimensions — independent of container CSS width ─────────────
const SVG_W = 1000;
const FIXED_ORIGIN_X = SVG_W / 2;

// ─── Main component ───────────────────────────────────────────────────────────
export default function OfficeMap({ onCharClick }) {
  const [selected, setSelected] = useState(null);

  // Compute total SVG height needed
  const svgHeight =
    ORIGIN_Y +
    (GRID_COLS + GRID_ROWS) * (TILE_H / 2) +
    80; // extra for tallest elements

  // originX is always the fixed center of the SVG canvas
  const originX = FIXED_ORIGIN_X;

  function handleCharClick(human) {
    const next = selected === human.id ? null : human.id;
    setSelected(next);
    if (next && onCharClick) {
      onCharClick({ type: "human", human });
    }
  }

  // ── Build render elements with depth key (col + row) ──────────────────────

  const elements = [];

  // 1. Floor tiles (back to front by col+row)
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const dept = getDeptForTile(col, row);
      const isEven = (col + row) % 2 === 0;
      const deptFill = dept ? dept.color + (isEven ? "18" : "22") : (isEven ? "#f1f5f9" : "#e9eef4");
      const pts = tilePoly(col, row, originX);
      elements.push({
        depth: col + row - 0.9, // render tiles beneath everything at same depth
        key: `tile-${col}-${row}`,
        node: (
          <polygon
            key={`tile-${col}-${row}`}
            points={pts}
            fill={deptFill}
            stroke="#e2e8f0"
            strokeWidth={0.5}
          />
        ),
      });
    }
  }

  // 2. Dept zone labels (placed at top-left tile of each zone)
  DEPT_ZONES.forEach((dz) => {
    const labelCol = dz.colMin;
    const labelRow = dz.rowMin;
    const { x, y } = toISO(labelCol, labelRow, originX);
    elements.push({
      depth: labelCol + labelRow - 0.5,
      key: `dept-label-${dz.id}`,
      node: (
        <text
          key={`dept-label-${dz.id}`}
          x={x}
          y={y - 4}
          textAnchor="middle"
          fill={dz.color}
          fontSize={10}
          fontWeight={700}
          fontFamily="monospace"
          fillOpacity={0.8}
          style={{ userSelect: "none", pointerEvents: "none" }}
        >
          {dz.name}
        </text>
      ),
    });
  });

  // 3. Plants
  PLANTS.forEach((p, i) => {
    elements.push({
      depth: p.col + p.row + 0.1,
      key: `plant-${i}`,
      node: <Plant key={`plant-${i}`} col={p.col} row={p.row} originX={originX} />,
    });
  });

  // 4. Chairs (behind desks, row+1 = closer in iso)
  HUMANS.forEach((h) => {
    const dp = DESK_MAP[h.id];
    if (!dp) return;
    const dept = getDeptForTile(dp.col, dp.row);
    const deptColor = dept ? dept.color : "#94a3b8";
    elements.push({
      depth: dp.col + (dp.row + 1) + 0.2,
      key: `chair-${h.id}`,
      node: <Chair key={`chair-${h.id}`} col={dp.col} row={dp.row} originX={originX} />,
    });
  });

  // 5. Desks + monitors
  HUMANS.forEach((h) => {
    const dp = DESK_MAP[h.id];
    if (!dp) return;
    const dept = getDeptForTile(dp.col, dp.row);
    const deptColor = dept ? dept.color : "#94a3b8";
    elements.push({
      depth: dp.col + dp.row + 0.3,
      key: `desk-${h.id}`,
      node: (
        <Desk
          key={`desk-${h.id}`}
          col={dp.col}
          row={dp.row}
          deptColor={deptColor}
          originX={originX}
        />
      ),
    });
  });

  // 6. Character avatars
  HUMANS.forEach((h) => {
    const dp = DESK_MAP[h.id];
    if (!dp) return;
    elements.push({
      depth: dp.col + dp.row + 0.8,
      key: `char-${h.id}`,
      node: (
        <CharAvatar
          key={`char-${h.id}`}
          human={h}
          col={dp.col}
          row={dp.row}
          selected={selected === h.id}
          onClick={() => handleCharClick(h)}
          originX={originX}
        />
      ),
    });
  });

  // Sort by depth ascending (lower depth = rendered first = appears behind)
  elements.sort((a, b) => a.depth - b.depth);

  const selHuman = selected ? HUMANS.find((h) => h.id === selected) : null;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#f8fafc",
        overflow: "hidden",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header bar */}
      <div
        style={{
          padding: "6px 12px",
          borderBottom: "1px solid #e2e8f0",
          fontSize: 9,
          fontFamily: "monospace",
          color: "#6366f188",
          letterSpacing: 1.5,
          flexShrink: 0,
          background: "#f8fafc",
        }}
      >
        OFFICE · MAP (ISO) // 클릭 → 선택 · 부서 색상 구분
      </div>

      {/* Selected character info bar */}
      {selHuman && (
        <div
          style={{
            padding: "6px 12px",
            borderBottom: "1px solid " + selHuman.color + "33",
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#ffffff",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 15 }}>{selHuman.avatar}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: selHuman.color }}>
            {selHuman.name}
          </span>
          <span style={{ fontSize: 10, color: "#94a3b8" }}>{selHuman.title}</span>
          <span style={{ fontSize: 10, color: "#64748b", marginLeft: "auto" }}>
            {selHuman.mood}
          </span>
          <button
            onClick={() => setSelected(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              fontSize: 13,
              padding: "0 4px",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* SVG canvas — fixed width so isometric grid always renders correctly */}
      <div
        style={{ flex: 1, overflow: "auto", position: "relative" }}
      >
        <svg
          width={SVG_W}
          height={svgHeight}
          style={{ display: "block" }}
        >
          {/* Background gradient */}
          <defs>
            <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f0f4f8" />
              <stop offset="100%" stopColor="#e8edf4" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#bgGrad)" />

          {/* Render all elements depth-sorted */}
          {elements.map((el) => el.node)}
        </svg>
      </div>
    </div>
  );
}
