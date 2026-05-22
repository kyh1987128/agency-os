import { PROJS, COLORS, getDept, STATUS } from "../data/mockData";
import { getHuman } from "../data/humans";

const { surface: S, border: BR, text: T, muted: M } = COLORS;

export default function ProjectsView({ onSelect }) {
  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      {PROJS.map((proj) => {
        const d   = getDept(proj.dept);
        const s   = STATUS[proj.status];
        const hus = [...new Set(proj.tasks.map((t) => t.a))].map((id) => getHuman(id)).filter(Boolean);
        return (
          <div key={proj.id} onClick={() => onSelect({ type: "project", id: proj.id })}
            style={{ background: S, border: "1px solid " + BR, borderRadius: 10, padding: "13px 14px", cursor: "pointer" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#16162a"}
            onMouseLeave={(e) => e.currentTarget.style.background = S}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T, marginBottom: 5 }}>{proj.title}</div>
                <div style={{ display: "flex", gap: 5 }}>
                  <span style={{ fontSize: 10, color: d?.color, background: d?.color + "15", padding: "2px 8px", borderRadius: 10, border: "1px solid " + d?.color + "22" }}>{d?.name}</span>
                  <span style={{ fontSize: 10, color: s?.c, background: s?.bg, padding: "2px 8px", borderRadius: 10 }}>{s?.label}</span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: d?.color }}>{proj.progress}%</div>
                <div style={{ fontSize: 9, color: M }}>{proj.due}</div>
              </div>
            </div>
            <div style={{ height: 5, background: BR, borderRadius: 3, marginBottom: 8 }}>
              <div style={{ height: 5, width: proj.progress + "%", background: d?.color, borderRadius: 3 }} />
            </div>
            <div style={{ display: "flex", gap: 3 }}>
              {hus.map((h) => (
                <div key={h.id} title={h.name} style={{ width: 24, height: 24, borderRadius: 6, background: h.color + "15", border: "1px solid " + h.color + "33", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>{h.avatar}</div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
