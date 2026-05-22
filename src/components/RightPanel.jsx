import { useState } from "react";
import { HUMANS } from "../data/humans";
import { AI_AGENTS } from "../data/agents";
import { DEPTS, PROJS, COLORS, getDept, STATUS } from "../data/mockData";

const { bg: B, surface: S, border: BR, text: T, muted: M } = COLORS;

export default function RightPanel({ onSelect }) {
  const [view,       setView]       = useState("list");
  const [selItem,    setSelItem]    = useState(null);
  const [deptFilter, setDeptFilter] = useState("all");

  const selectHuman = (h)  => { setSelItem({ type: "human", ...h  }); setView("human-detail"); onSelect({ type: "human", id: h.id  }); };
  const selectAI    = (ai) => { setSelItem({ type: "ai",    ...ai }); setView("ai-detail");    onSelect({ type: "ai",   id: ai.id }); };

  return (
    <div style={{ width: 268, background: "#09090f", borderLeft: "1px solid " + BR, display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "11px 12px 8px", borderBottom: "1px solid " + BR, flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T }}>팀원 · 에이전트</div>
          {view !== "list" && (
            <button onClick={() => setView("list")} style={{ background: "transparent", border: "1px solid " + BR, color: M, cursor: "pointer", borderRadius: 5, padding: "3px 8px", fontSize: 10 }}>← 목록</button>
          )}
        </div>
      </div>

      {/* LIST VIEW */}
      {view === "list" && (
        <div style={{ flex: 1, overflowY: "auto" }}>
          {/* 사람 */}
          <div style={{ padding: "7px 10px 4px", fontSize: 10, fontWeight: 700, color: M, background: B, borderBottom: "1px solid " + BR, position: "sticky", top: 0, zIndex: 2 }}>
            👤 사람 ({HUMANS.length})
          </div>
          {HUMANS.map((h) => (
            <div key={h.id} onClick={() => selectHuman(h)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", cursor: "pointer", borderBottom: "1px solid " + BR + "44", transition: "background .1s" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#13131e"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: h.color + "18", border: "1.5px solid " + h.color + "33", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{h.avatar}</div>
                <div style={{ position: "absolute", bottom: -1, right: -1, width: 8, height: 8, borderRadius: "50%", background: h.status === "active" ? "#34d399" : "#f59e0b", border: "1.5px solid #09090f" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</div>
                <div style={{ fontSize: 10, color: h.color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.title}</div>
              </div>
              <span style={{ fontSize: 8, color: M, flexShrink: 0 }}>{getDept(h.dept)?.name}</span>
            </div>
          ))}

          {/* AI 에이전트 */}
          <div style={{ padding: "7px 10px 4px", fontSize: 10, fontWeight: 700, color: M, background: B, borderBottom: "1px solid " + BR, position: "sticky", top: 0, zIndex: 2 }}>
            🤖 AI 에이전트 ({AI_AGENTS.length})
          </div>
          {/* 부서 필터 */}
          <div style={{ padding: "6px 8px", borderBottom: "1px solid " + BR, display: "flex", gap: 4, flexWrap: "wrap" }}>
            <button onClick={() => setDeptFilter("all")}
              style={{ padding: "3px 8px", borderRadius: 8, border: "1px solid " + (deptFilter === "all" ? "#818cf8" : BR), background: deptFilter === "all" ? "#818cf815" : "transparent", color: deptFilter === "all" ? "#818cf8" : M, fontSize: 9, cursor: "pointer" }}>
              전체
            </button>
            {DEPTS.map((d) => (
              <button key={d.id} onClick={() => setDeptFilter(d.id)}
                style={{ padding: "3px 8px", borderRadius: 8, border: "1px solid " + (deptFilter === d.id ? d.color : BR), background: deptFilter === d.id ? d.color + "15" : "transparent", color: deptFilter === d.id ? d.color : M, fontSize: 9, cursor: "pointer" }}>
                {d.name}
              </button>
            ))}
          </div>

          {/* 부서별 그룹 */}
          {(deptFilter === "all" ? DEPTS : DEPTS.filter((d) => d.id === deptFilter)).map((dept) => {
            const deptAIs = AI_AGENTS.filter((a) => a.dept === dept.id);
            if (!deptAIs.length) return null;
            return (
              <div key={dept.id}>
                <div style={{ padding: "5px 10px 3px", fontSize: 9, color: dept.color, fontWeight: 700, background: dept.color + "08", borderBottom: "1px solid " + dept.color + "18", fontFamily: "monospace", letterSpacing: 1 }}>{dept.name}팀</div>
                {deptAIs.map((ai) => (
                  <div key={ai.id} onClick={() => selectAI(ai)}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", cursor: "pointer", borderBottom: "1px solid " + BR + "33", transition: "background .1s" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#13131e"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 7, background: ai.color + "15", border: "1.5px solid " + ai.color + "33", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>{ai.avatar}</div>
                      <div style={{ position: "absolute", bottom: -1, right: -1, width: 7, height: 7, borderRadius: "50%", background: ai.status === "active" ? "#34d399" : "#475569", border: "1.5px solid #09090f" }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: ai.color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ai.name}</div>
                      <div style={{ fontSize: 9, color: M, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ai.status === "active" ? "▶ " + ai.task : "대기중"}</div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* HUMAN DETAIL */}
      {view === "human-detail" && selItem && (
        <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, background: S, border: "1px solid " + selItem.color + "33", borderRadius: 8, padding: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: selItem.color + "18", border: "2px solid " + selItem.color + "44", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{selItem.avatar}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T }}>{selItem.name}</div>
              <div style={{ fontSize: 11, color: selItem.color }}>{selItem.title}</div>
              <div style={{ fontSize: 10, color: "#34d399", marginTop: 2 }}>{selItem.mood}</div>
            </div>
          </div>
          <div style={{ fontSize: 10, color: M, fontWeight: 600, marginBottom: 6 }}>담당 프로젝트</div>
          {PROJS.filter((p) => p.tasks.some((t) => t.a === selItem.id)).map((proj) => {
            const d = getDept(proj.dept);
            const s = STATUS[proj.status];
            return (
              <div key={proj.id} style={{ background: S, border: "1px solid " + BR, borderRadius: 6, padding: "9px 10px", marginBottom: 6 }}>
                <div style={{ fontSize: 12, color: T, marginBottom: 4 }}>{proj.title}</div>
                <div style={{ display: "flex", gap: 5, marginBottom: 6 }}>
                  <span style={{ fontSize: 9, color: d?.color, background: d?.color + "15", padding: "2px 6px", borderRadius: 8 }}>{d?.name}</span>
                  <span style={{ fontSize: 9, color: s?.c, background: s?.bg, padding: "2px 6px", borderRadius: 8 }}>{s?.label}</span>
                </div>
                <div style={{ height: 3, background: BR, borderRadius: 2 }}>
                  <div style={{ height: 3, width: proj.progress + "%", background: d?.color, borderRadius: 2 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* AI DETAIL */}
      {view === "ai-detail" && selItem && (
        <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
          <div style={{ background: S, border: "1px solid " + selItem.color + "33", borderRadius: 8, padding: 14, marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: selItem.color + "18", border: "2px solid " + selItem.color + "44", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{selItem.avatar}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: selItem.color }}>{selItem.name}</div>
                <div style={{ fontSize: 11, color: T }}>{selItem.title}</div>
                <div style={{ fontSize: 9, color: getDept(selItem.dept)?.color, fontFamily: "monospace" }}>{getDept(selItem.dept)?.name}팀</div>
              </div>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: selItem.status === "active" ? "#34d399" : "#475569", flexShrink: 0 }} />
            </div>
            <div style={{ fontSize: 11, color: M, lineHeight: 1.7, padding: "8px 10px", background: B, borderRadius: 6, marginBottom: 10, fontStyle: "italic" }}>"{selItem.desc}"</div>
            <div style={{ fontSize: 10, color: M, marginBottom: 4 }}>현재 작업</div>
            <div style={{ fontSize: 12, color: selItem.status === "active" ? selItem.color : M, fontWeight: selItem.status === "active" ? 600 : 400 }}>
              {selItem.status === "active" ? "▶ " + selItem.task : "● 대기중"}
            </div>
          </div>
          <div style={{ fontSize: 10, color: M, fontWeight: 600, marginBottom: 6 }}>연관 프로젝트</div>
          {PROJS.filter((p) => p.dept === selItem.dept).map((proj) => {
            const d = getDept(proj.dept);
            return (
              <div key={proj.id} style={{ background: S, border: "1px solid " + BR, borderRadius: 6, padding: "8px 10px", marginBottom: 6 }}>
                <div style={{ fontSize: 11, color: T, marginBottom: 4 }}>{proj.title}</div>
                <div style={{ height: 3, background: BR, borderRadius: 2 }}>
                  <div style={{ height: 3, width: proj.progress + "%", background: d?.color, borderRadius: 2 }} />
                </div>
                <div style={{ fontSize: 9, color: d?.color, marginTop: 2 }}>{proj.progress}%</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
