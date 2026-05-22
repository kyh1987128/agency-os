import { PROJS, COLORS, getDept } from "../data/mockData";
import { getHuman } from "../data/humans";

const { surface: S, border: BR, text: T, muted: M } = COLORS;

const COLS = [
  { id: "todo",   l: "대기",   c: "#475569" },
  { id: "active", l: "진행중", c: "#f59e0b" },
  { id: "done",   l: "완료",   c: "#34d399" },
];

export default function KanbanView({ onSelect }) {
  const tasks = PROJS.flatMap((p) => p.tasks.map((t, i) => ({ ...t, proj: p, key: p.id + "_" + i })));

  return (
    <div style={{ padding: 12, display: "flex", gap: 10, height: "calc(100% - 24px)" }}>
      {COLS.map((col) => {
        const list = tasks.filter((t) => t.s === col.id);
        return (
          <div key={col.id} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: S, border: "1px solid " + BR, borderRadius: 8, padding: "9px 12px", flexShrink: 0 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: col.c }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: T }}>{col.l}</span>
              <span style={{ marginLeft: "auto", fontSize: 10, color: M, background: BR, padding: "1px 7px", borderRadius: 8 }}>{list.length}</span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
              {list.map((task) => {
                const hu = getHuman(task.a);
                const d  = getDept(task.proj.dept);
                return (
                  <div key={task.key} onClick={() => onSelect({ type: "task", proj: task.proj, task, human: hu })}
                    style={{ background: S, border: "1px solid " + BR, borderLeft: "3px solid " + col.c, borderRadius: 7, padding: "10px 11px", cursor: "pointer" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#16162a"}
                    onMouseLeave={(e) => e.currentTarget.style.background = S}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: T, marginBottom: 5 }}>{task.t}</div>
                    <div style={{ fontSize: 10, color: d?.color, marginBottom: 6 }}>{task.proj.title.slice(0, 22)}</div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ fontSize: 13 }}>{hu?.avatar}</span>
                        <span style={{ fontSize: 10, color: M }}>{hu?.name}</span>
                      </div>
                      <span style={{ fontSize: 9, color: M }}>{task.due}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
