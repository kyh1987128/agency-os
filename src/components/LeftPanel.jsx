import { HUMANS } from "../data/humans";
import { COLORS } from "../data/mockData";

const { border: BR, text: T, muted: M } = COLORS;

const TABS = [
  { id: "dashboard", e: "⬡", l: "대시보드" },
  { id: "projects",  e: "📋", l: "프로젝트" },
  { id: "kanban",    e: "📌", l: "칸반" },
  { id: "gantt",     e: "📊", l: "간트" },
  { id: "calendar",  e: "📅", l: "캘린더" },
  { id: "chat",      e: "💬", l: "채팅" },
  { id: "approval",  e: "🖋", l: "전자결재", grp: "업무" },
  { id: "daily",     e: "✅", l: "일과·체크" },
  { id: "knowledge", e: "📖", l: "사내위키", grp: "지식" },
  { id: "manual",    e: "📒", l: "업무매뉴얼" },
  { id: "onboarding",e: "🎓", l: "온보딩" },
  { id: "board",     e: "📋", l: "게시판", grp: "소통" },
  { id: "archive",   e: "📦", l: "보관함" },
];

export { TABS };

export default function LeftPanel({ tab, setTab, projects = [], allNodes = [], projData = [] }) {
  return (
    <>
      <div style={{ width: 172, background: "#ffffff", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "16px 12px 12px", borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 30, height: 30, background: "linear-gradient(135deg,#6366f1,#38bdf8)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>🏢</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: T }}>Agency OS</div>
              <div style={{ fontSize: 9, color: "#16a34a" }}>🟢 {HUMANS.filter((h) => h.status === "active").length}명 온라인</div>
            </div>
          </div>
        </div>

        <nav style={{ padding: "8px 6px 4px", overflowY: "auto" }}>
          {TABS.map((t) => (
            <div key={t.id}>
              {t.grp && <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9.5, fontWeight: 800, color: "#64748b", letterSpacing: 1, padding: "9px 10px 5px", marginTop: 7, borderTop: "1px solid #e2e8f0" }}><span style={{ width: 3, height: 11, borderRadius: 2, background: "#6366f1", display: "inline-block" }} />{t.grp}</div>}
              <button onClick={() => setTab(t.id)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 10px", borderRadius: 7, border: "none", background: tab === t.id ? "#ede9fe" : "transparent", color: tab === t.id ? "#6366f1" : M, fontSize: 12, fontWeight: tab === t.id ? 700 : 400, cursor: "pointer", marginBottom: 1, textAlign: "left" }}>
                <span style={{ fontSize: 14 }}>{t.e}</span>{t.l}
                {tab === t.id && <div style={{ marginLeft: "auto", width: 3, height: 16, borderRadius: 2, background: "#6366f1" }} />}
              </button>
            </div>
          ))}
        </nav>

        <div style={{ flex: 1 }} />

        <div style={{ padding: "8px 10px", borderTop: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 9, color: "#cbd5e1", marginBottom: 4 }}>v2 예정</div>
          {["🏠 사무공간"].map((l) => (
            <div key={l} style={{ fontSize: 10, color: "#e2e8f0", padding: "2px 0" }}>{l}</div>
          ))}
        </div>
      </div>
    </>
  );
}
