import { useState } from "react";
import { HUMANS } from "../data/humans";
import { COLORS } from "../data/mockData";

const { surface: S, border: BR, muted: M } = COLORS;
const CELL = 46;

const DESK_POS = { h1: { x: 1, y: 1 }, h2: { x: 3, y: 1 }, h3: { x: 7, y: 1 }, h4: { x: 13, y: 1 }, h5: { x: 1, y: 5 }, h6: { x: 7, y: 5 } };
const ZONES = [
  { n: "마케팅", x: 0,  y: 0, w: 6, h: 5, c: "#f59e0b" },
  { n: "콘텐츠", x: 6,  y: 0, w: 6, h: 5, c: "#38bdf8" },
  { n: "디자인", x: 12, y: 0, w: 5, h: 5, c: "#f472b6" },
  { n: "개발",   x: 0,  y: 5, w: 5, h: 4, c: "#34d399" },
  { n: "전략",   x: 5,  y: 5, w: 4, h: 4, c: "#a78bfa" },
  { n: "운영",   x: 9,  y: 5, w: 4, h: 4, c: "#fb923c" },
  { n: "회의실", x: 17, y: 0, w: 3, h: 9, c: "#555" },
];
const CHAR_STATUSES = [
  { id: "working", l: "근무중",   c: "#34d399" },
  { id: "focus",   l: "집중",     c: "#818cf8" },
  { id: "meeting", l: "회의중",   c: "#38bdf8" },
  { id: "away",    l: "자리비움", c: "#f59e0b" },
  { id: "off",     l: "퇴근",     c: "#475569" },
];

const OW = 20 * CELL, OH = 9 * CELL;

export default function OfficeMap({ onCharClick }) {
  const [charPos, setCharPos] = useState(() => {
    const m = {};
    HUMANS.forEach((h) => { if (DESK_POS[h.id]) m[h.id] = { ...DESK_POS[h.id] }; });
    return m;
  });
  const [charSt, setCharSt] = useState(() => {
    const m = {};
    HUMANS.forEach((h) => { m[h.id] = "working"; });
    return m;
  });
  const [sel, setSel] = useState(null);
  const selH = sel ? HUMANS.find((h) => h.id === sel) : null;

  return (
    <div style={{ background: "#080c08", borderBottom: "1px solid " + BR, flexShrink: 0, padding: "8px 10px" }}>
      <div style={{ fontSize: 9, color: "#34d39944", fontFamily: "monospace", marginBottom: 6, letterSpacing: 1 }}>OFFICE·MAP // 클릭→선택 · 빈 자리→이동</div>
      <div style={{ overflowX: "auto" }}>
        <div style={{
          position: "relative", width: OW, height: OH, background: "#060a06", borderRadius: 6,
          backgroundImage: `repeating-linear-gradient(90deg,#0c100c 0,#0c100c 1px,transparent 1px,transparent ${CELL}px),repeating-linear-gradient(#0c100c 0,#0c100c 1px,transparent 1px,transparent ${CELL}px)`,
          backgroundSize: `${CELL}px ${CELL}px`,
        }}>
          {ZONES.map((z) => (
            <div key={z.n} style={{ position: "absolute", left: z.x * CELL, top: z.y * CELL, width: z.w * CELL, height: z.h * CELL, background: z.c + "07", border: "1px solid " + z.c + "18", boxSizing: "border-box", pointerEvents: "none" }}>
              <div style={{ fontSize: 8, color: z.c + "55", padding: "2px 4px", fontFamily: "monospace" }}>{z.n}</div>
            </div>
          ))}

          {Array.from({ length: OH / CELL }, (_, gy) =>
            Array.from({ length: OW / CELL }, (_, gx) => (
              <div key={gx + "," + gy}
                onClick={() => {
                  if (!sel) return;
                  const occ = Object.entries(charPos).find(([id, p]) => id !== sel && p.x === gx && p.y === gy);
                  if (!occ) setCharPos((p) => ({ ...p, [sel]: { x: gx, y: gy } }));
                }}
                style={{ position: "absolute", left: gx * CELL, top: gy * CELL, width: CELL, height: CELL, cursor: sel ? "crosshair" : "default" }}
              />
            ))
          )}

          {Object.entries(DESK_POS).map(([hid, dp]) => (
            <div key={"desk" + hid} style={{ position: "absolute", left: dp.x * CELL + 5, top: dp.y * CELL + 5, width: CELL - 10, height: CELL - 10, background: "#0d110d", border: "1px solid #141814", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, pointerEvents: "none" }}>🖥️</div>
          ))}

          {HUMANS.map((h) => {
            const pos = charPos[h.id];
            if (!pos) return null;
            const sta = CHAR_STATUSES.find((s) => s.id === charSt[h.id]) || CHAR_STATUSES[0];
            const isSel = sel === h.id;
            return (
              <div key={h.id}
                onClick={(e) => { e.stopPropagation(); setSel(isSel ? null : h.id); if (!isSel) onCharClick({ type: "human", id: h.id }); }}
                style={{ position: "absolute", left: pos.x * CELL + (CELL - 32) / 2, top: pos.y * CELL + (CELL - 32) / 2 - 2, width: 32, height: 32, transition: "left .4s cubic-bezier(.34,1.56,.64,1),top .4s cubic-bezier(.34,1.56,.64,1)", cursor: "pointer", zIndex: isSel ? 20 : 5 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: h.color + "18", border: "2px solid " + (isSel ? h.color : h.color + "44"), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, boxShadow: isSel ? "0 0 0 3px " + h.color + "33" : "none" }}>{h.avatar}</div>
                <div style={{ position: "absolute", bottom: 0, right: 0, width: 8, height: 8, borderRadius: "50%", background: sta.c, border: "1.5px solid #060a06" }} />
                <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", fontSize: 7, color: "#2a3a2a", whiteSpace: "nowrap", fontFamily: "monospace", marginTop: 1 }}>{h.name}</div>
              </div>
            );
          })}
        </div>
      </div>

      {selH && (
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, background: S, borderRadius: 6, padding: "6px 10px", border: "1px solid " + selH.color + "33" }}>
          <span style={{ fontSize: 15 }}>{selH.avatar}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: selH.color }}>{selH.name}</span>
          <div style={{ flex: 1, display: "flex", gap: 4, flexWrap: "wrap" }}>
            {CHAR_STATUSES.map((s) => (
              <button key={s.id} onClick={() => setCharSt((p) => ({ ...p, [selH.id]: s.id }))}
                style={{ padding: "3px 8px", borderRadius: 10, border: "1px solid " + (charSt[selH.id] === s.id ? s.c : BR), background: charSt[selH.id] === s.id ? s.c + "22" : "transparent", color: charSt[selH.id] === s.id ? s.c : M, fontSize: 9, cursor: "pointer" }}>
                {s.l}
              </button>
            ))}
          </div>
          <button onClick={() => setSel(null)} style={{ background: "transparent", border: "none", color: M, cursor: "pointer", fontSize: 12 }}>✕</button>
        </div>
      )}
    </div>
  );
}
