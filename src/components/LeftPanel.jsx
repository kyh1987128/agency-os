import { HUMANS } from "../data/humans";
import { COLORS } from "../data/mockData";

const { border: BR, text: T, muted: M } = COLORS;

const TABS = [
  { id: "dashboard", e: "⬡", l: "대시보드" },
  { id: "projects",  e: "📋", l: "프로젝트" },
  { id: "kanban",    e: "📌", l: "칸반" },
];

export { TABS };

export default function LeftPanel({ tab, setTab }) {
  return (
    <div style={{ width: 172, background: "#09090f", borderRight: "1px solid " + BR, display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "16px 12px 12px", borderBottom: "1px solid " + BR }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 30, height: 30, background: "linear-gradient(135deg,#818cf8,#38bdf8)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>🏢</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T }}>Agency OS</div>
            <div style={{ fontSize: 9, color: "#34d399" }}>🟢 {HUMANS.filter((h) => h.status === "active").length}명 온라인</div>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: "8px 6px" }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "10px 10px", borderRadius: 7, border: "none", background: tab === t.id ? "#818cf818" : "transparent", color: tab === t.id ? "#818cf8" : M, fontSize: 12, cursor: "pointer", marginBottom: 2, textAlign: "left" }}>
            <span style={{ fontSize: 14 }}>{t.e}</span>{t.l}
            {tab === t.id && <div style={{ marginLeft: "auto", width: 3, height: 16, borderRadius: 2, background: "#818cf8" }} />}
          </button>
        ))}
      </nav>

      <div style={{ padding: "8px 10px", borderTop: "1px solid " + BR }}>
        <div style={{ fontSize: 9, color: "#2a2a3a", marginBottom: 4 }}>v2 예정</div>
        {["🏠 사무공간", "📖 위키", "🤖 챗봇"].map((l) => (
          <div key={l} style={{ fontSize: 10, color: "#1e1e30", padding: "2px 0" }}>{l}</div>
        ))}
      </div>
    </div>
  );
}
