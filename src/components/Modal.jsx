import { PROJS, COLORS, getDept, STATUS, TASK_STATUS_COLOR } from "../data/mockData";
import { HUMANS, getHuman } from "../data/humans";

const { bg: B, surface: S, border: BR, text: T, muted: M } = COLORS;

export default function Modal({ item, onClose }) {
  if (!item) return null;

  const proj   = item.type === "project" ? PROJS.find((p) => p.id === item.id) : item.proj;
  const human  = item.type === "human"   ? HUMANS.find((h) => h.id === item.id) : item.human;
  const task   = item.task;
  const d      = proj ? getDept(proj.dept) : null;
  const ac     = human?.color || d?.color || "#818cf8";

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0009", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: S, border: "1px solid " + ac + "44", borderRadius: 12, padding: 20, width: 460, maxWidth: "90vw", maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <span style={{ fontSize: 11, color: M }}>{item.type === "project" ? "프로젝트 상세" : item.type === "task" ? "업무 상세" : "팀원 상세"}</span>
          <button onClick={onClose} style={{ background: "transparent", border: "1px solid " + BR, color: M, cursor: "pointer", borderRadius: 5, padding: "3px 10px", fontSize: 11 }}>닫기</button>
        </div>

        {/* 프로젝트 */}
        {proj && !task && (
          <>
            <div style={{ fontSize: 15, fontWeight: 700, color: T, marginBottom: 6 }}>{proj.title}</div>
            <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
              <span style={{ fontSize: 10, color: d?.color, background: d?.color + "18", padding: "2px 8px", borderRadius: 10, border: "1px solid " + d?.color + "22" }}>{d?.name}</span>
              <span style={{ fontSize: 10, color: STATUS[proj.status]?.c, background: STATUS[proj.status]?.bg, padding: "2px 8px", borderRadius: 10 }}>{STATUS[proj.status]?.label}</span>
            </div>
            <div style={{ height: 6, background: BR, borderRadius: 3, marginBottom: 4 }}>
              <div style={{ height: 6, width: proj.progress + "%", background: d?.color, borderRadius: 3 }} />
            </div>
            <div style={{ fontSize: 11, color: d?.color, marginBottom: 10 }}>{proj.progress}% · 마감 {proj.due}</div>
            <div style={{ fontSize: 11, color: M, lineHeight: 1.6, marginBottom: 12 }}>{proj.desc}</div>
            {proj.tasks.map((t, i) => {
              const hu = getHuman(t.a);
              const tc = TASK_STATUS_COLOR[t.s];
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: B, borderRadius: 6, marginBottom: 5, borderLeft: "3px solid " + tc }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: tc, fontWeight: 600 }}>{t.t}</div>
                    <div style={{ fontSize: 10, color: M }}>{hu?.name} · {t.due}</div>
                  </div>
                  <span style={{ fontSize: 9, color: tc }}>{t.s === "done" ? "완료" : t.s === "active" ? "진행중" : "대기"}</span>
                </div>
              );
            })}
          </>
        )}

        {/* 업무 */}
        {task && (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, color: TASK_STATUS_COLOR[task.s], marginBottom: 4 }}>{task.t}</div>
            <div style={{ fontSize: 11, color: M, marginBottom: 10 }}>{proj?.title}</div>
            {human && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: B, borderRadius: 8 }}>
                <span style={{ fontSize: 20 }}>{human.avatar}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T }}>{human.name}</div>
                  <div style={{ fontSize: 11, color: human.color }}>{human.title}</div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
