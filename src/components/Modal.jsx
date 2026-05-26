import { PROJS, COLORS, getDept, STATUS, TASK_STATUS_COLOR } from "../data/mockData";
import { HUMANS, getHuman } from "../data/humans";
import { AI_AGENTS } from "../data/agents";

const { bg: B, surface: S, border: BR, text: T, muted: M } = COLORS;

const STATUS_LABEL = { done: "완료", active: "진행중", todo: "대기" };

// Stat bar component
function StatBar({ label, value, color }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: M }}>{label}</span>
        <span style={{ fontSize: 10, color, fontWeight: 600 }}>{value}</span>
      </div>
      <div style={{ height: 4, background: BR, borderRadius: 2 }}>
        <div style={{ height: 4, width: `${value}%`, background: color, borderRadius: 2, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

// Human detail panel
function HumanDetail({ human, onClose }) {
  const dept = getDept(human.dept);
  const myTasks = PROJS.flatMap((p) =>
    p.tasks
      .map((t, i) => ({ ...t, proj: p, idx: i }))
      .filter((t) => t.a === human.id)
  );

  // Deterministic stats from id
  const seed = human.id.charCodeAt(human.id.length - 1);
  const stats = [
    { label: "창의력", value: 60 + (seed * 7) % 35, color: "#f472b6" },
    { label: "실행력", value: 55 + (seed * 11) % 40, color: "#34d399" },
    { label: "협업력", value: 65 + (seed * 5)  % 30, color: "#60a5fa" },
  ];

  return (
    <>
      {/* Profile header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: human.color + "10", borderRadius: 10, marginBottom: 16, border: "1px solid " + human.color + "22" }}>
        <div style={{ width: 52, height: 52, borderRadius: 12, background: human.color + "20", border: "2px solid " + human.color + "44", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>
          {human.avatar}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: T }}>{human.name}</span>
            <span style={{ fontSize: 9, background: human.color, color: "white", padding: "2px 7px", borderRadius: 8, fontWeight: 600 }}>
              Lv.{20 + (seed % 15)}
            </span>
          </div>
          <div style={{ fontSize: 11, color: human.color, fontWeight: 600, marginBottom: 2 }}>{human.title}</div>
          <div style={{ fontSize: 10, color: M }}>{dept?.name} · {human.mood}</div>
        </div>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: human.status === "active" ? "#22c55e" : "#94a3b8", flexShrink: 0 }} />
      </div>

      {/* Stats */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: M, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>역량 지표</div>
        {stats.map((s) => <StatBar key={s.label} {...s} />)}
      </div>

      {/* Assigned tasks */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: M, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
          담당 업무 ({myTasks.length}건)
        </div>
        {myTasks.length === 0 && (
          <div style={{ fontSize: 11, color: M, textAlign: "center", padding: "16px 0" }}>담당 업무 없음</div>
        )}
        {myTasks.map((t, i) => {
          const tc   = TASK_STATUS_COLOR[t.s];
          const dept2 = getDept(t.proj.dept);
          return (
            <div key={i} style={{ padding: "10px 12px", background: B, borderRadius: 8, marginBottom: 6, borderLeft: "3px solid " + tc }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: T }}>{t.t}</span>
                <span style={{ fontSize: 9, color: tc, background: tc + "18", padding: "2px 7px", borderRadius: 6 }}>{STATUS_LABEL[t.s]}</span>
              </div>
              <div style={{ fontSize: 10, color: dept2?.color, marginBottom: 2 }}>{t.proj.title}</div>
              <div style={{ display: "flex", gap: 10 }}>
                <span style={{ fontSize: 9, color: M }}>마감 {t.due}</span>
                <span style={{ fontSize: 9, color: M }}>진행도 {t.proj.progress}%</span>
              </div>
              {/* Mini progress */}
              <div style={{ height: 3, background: BR, borderRadius: 2, marginTop: 6 }}>
                <div style={{ height: 3, width: t.proj.progress + "%", background: tc, borderRadius: 2 }} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// Project detail panel
function ProjectDetail({ proj }) {
  const d = getDept(proj.dept);
  const s = STATUS[proj.status];
  return (
    <>
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T, marginBottom: 6 }}>{proj.title}</div>
        <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
          <span style={{ fontSize: 10, color: d?.color, background: d?.color + "18", padding: "2px 8px", borderRadius: 10, border: "1px solid " + d?.color + "22" }}>{d?.name}</span>
          <span style={{ fontSize: 10, color: s?.c, background: s?.bg, padding: "2px 8px", borderRadius: 10 }}>{s?.label}</span>
        </div>
      </div>
      <div style={{ height: 6, background: BR, borderRadius: 3, marginBottom: 4 }}>
        <div style={{ height: 6, width: proj.progress + "%", background: d?.color, borderRadius: 3 }} />
      </div>
      <div style={{ fontSize: 11, color: d?.color, marginBottom: 10 }}>{proj.progress}% · 마감 {proj.due}</div>
      <div style={{ fontSize: 11, color: M, lineHeight: 1.6, marginBottom: 14 }}>{proj.desc}</div>

      <div style={{ fontSize: 10, fontWeight: 700, color: M, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>업무 목록</div>
      {proj.tasks.map((t, i) => {
        const hu = getHuman(t.a);
        const tc = TASK_STATUS_COLOR[t.s];
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: B, borderRadius: 8, marginBottom: 6, borderLeft: "3px solid " + tc }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: T, fontWeight: 600 }}>{t.t}</div>
              <div style={{ fontSize: 10, color: M, marginTop: 2 }}>{hu?.avatar} {hu?.name} · 마감 {t.due}</div>
            </div>
            <span style={{ fontSize: 9, color: tc, background: tc + "18", padding: "2px 8px", borderRadius: 6 }}>{STATUS_LABEL[t.s]}</span>
          </div>
        );
      })}
    </>
  );
}

// Task detail panel
function TaskDetail({ task, proj, human }) {
  const tc   = TASK_STATUS_COLOR[task.s];
  const dept = proj ? getDept(proj.dept) : null;
  return (
    <>
      <div style={{ padding: "12px 14px", background: tc + "10", borderRadius: 10, border: "1px solid " + tc + "33", marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: tc, marginBottom: 4 }}>{task.t}</div>
        <div style={{ fontSize: 10, color: M }}>마감 {task.due}</div>
      </div>

      {proj && (
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          <span style={{ fontSize: 10, color: dept?.color, background: dept?.color + "15", padding: "3px 10px", borderRadius: 8 }}>{dept?.name}</span>
          <span style={{ fontSize: 10, color: T, background: B, padding: "3px 10px", borderRadius: 8 }}>{proj.title}</span>
        </div>
      )}

      {human && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, color: M, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>담당자</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: human.color + "10", borderRadius: 10, border: "1px solid " + human.color + "22" }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: human.color + "20", border: "1px solid " + human.color + "44", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
              {human.avatar}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T }}>{human.name}</div>
              <div style={{ fontSize: 10, color: human.color }}>{human.title}</div>
              <div style={{ fontSize: 9, color: M, marginTop: 2 }}>{human.mood}</div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// Agent detail panel
function AgentDetail({ agentData }) {
  const dept  = getDept(agentData.dept);
  const seed  = agentData.id.charCodeAt(agentData.id.length - 1);
  const stats = [
    { label: "처리속도", value: 70 + (seed * 9) % 28, color: "#a78bfa" },
    { label: "정확도",   value: 75 + (seed * 7) % 22, color: "#34d399" },
    { label: "학습률",   value: 65 + (seed * 13)% 30, color: "#60a5fa" },
  ];
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "#8b5cf610", borderRadius: 10, marginBottom: 16, border: "1px solid #8b5cf622" }}>
        <div style={{ width: 52, height: 52, borderRadius: 12, background: "#8b5cf620", border: "2px solid #8b5cf644", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
          🤖
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: T }}>{agentData.name}</span>
            <span style={{ fontSize: 9, background: "#8b5cf6", color: "white", padding: "2px 7px", borderRadius: 8 }}>AI</span>
          </div>
          <div style={{ fontSize: 11, color: "#8b5cf6", fontWeight: 600, marginBottom: 2 }}>{agentData.role}</div>
          <div style={{ fontSize: 10, color: M }}>{dept?.name}</div>
        </div>
        <div style={{ marginLeft: "auto", width: 8, height: 8, borderRadius: "50%", background: agentData.status === "active" ? "#22c55e" : "#94a3b8" }} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: M, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>성능 지표</div>
        {stats.map((s) => <StatBar key={s.label} {...s} />)}
      </div>
      <div style={{ padding: "10px 14px", background: B, borderRadius: 8, border: "1px solid " + BR }}>
        <div style={{ fontSize: 10, color: M, marginBottom: 4 }}>담당 부서</div>
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ fontSize: 10, color: dept?.color, background: dept?.color + "15", padding: "3px 10px", borderRadius: 8 }}>{dept?.name}</span>
        </div>
      </div>
    </>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function Modal({ item, onClose }) {
  if (!item) return null;

  // Resolve data
  const human = item.type === "human"
    ? (HUMANS.find((h) => h.id === item.id) || item.human)
    : item.human;

  const proj = item.type === "project"
    ? PROJS.find((p) => p.id === item.id) || item.data
    : item.proj;

  const task     = item.task;
  const agentData = item.agentData;

  const accentColor =
    human?.color || getDept(proj?.dept)?.color || "#8b5cf6";

  const title =
    item.type === "human"   ? "팀원 상세" :
    item.type === "project" ? "프로젝트 상세" :
    item.type === "task"    ? "업무 상세" :
    item.type === "agent"   ? "AI 에이전트" : "상세";

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "#00000044", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: S, border: "1px solid " + accentColor + "33", borderRadius: 14, width: 480, maxWidth: "92vw", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid " + BR, position: "sticky", top: 0, background: S, zIndex: 1 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: accentColor, textTransform: "uppercase", letterSpacing: 1 }}>{title}</span>
          <button onClick={onClose} style={{ background: "transparent", border: "1px solid " + BR, color: M, cursor: "pointer", borderRadius: 6, padding: "3px 12px", fontSize: 11 }}>✕ 닫기</button>
        </div>

        <div style={{ padding: "16px 18px" }}>
          {item.type === "human"   && human    && <HumanDetail   human={human} onClose={onClose} />}
          {item.type === "project" && proj      && <ProjectDetail proj={proj} />}
          {item.type === "task"    && task      && <TaskDetail    task={task} proj={proj} human={human} />}
          {item.type === "agent"   && agentData && <AgentDetail   agentData={agentData} />}
        </div>
      </div>
    </div>
  );
}
