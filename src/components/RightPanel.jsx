import { useState, useEffect } from "react";
import { HUMANS } from "../data/humans";
import { AI_AGENTS } from "../data/agents";
import { DEPTS, PROJS, COLORS, getDept, STATUS } from "../data/mockData";
import PixelAvatar from "./PixelAvatar";

const { bg: B, surface: S, border: BR, text: T, muted: M } = COLORS;

// 실제 Dify 봇 (채팅의 BOTS와 동일)
const BOTS = [
  { id: "director", name: "기획 디렉터",   icon: "🎯", color: "#6366f1" },
  { id: "saup",     name: "사업계획서 봇",  icon: "📑", color: "#f59e0b" },
  { id: "jiwon",    name: "지원사업 봇",    icon: "🏛️", color: "#10b981" },
  { id: "service",  name: "서비스소개서 봇", icon: "📄", color: "#38bdf8" },
  { id: "cs",       name: "CS 문구 봇",     icon: "💬", color: "#f472b6" },
  { id: "meeting",  name: "회의록 봇",      icon: "🗒️", color: "#a78bfa" },
  { id: "qa",       name: "사내 Q&A 봇",   icon: "❓", color: "#94a3b8" },
  { id: "research", name: "리서치 봇",      icon: "🔍", color: "#0ea5e9" },
  { id: "review",   name: "검토·감수 봇",   icon: "✅", color: "#22c55e" },
  { id: "ppt",      name: "발표자료 PPT 봇", icon: "📊", color: "#fb923c" },
];

export default function RightPanel({ onSelect, activeProject = "default" }) {
  const [view,       setView]       = useState("list");
  const [selItem,    setSelItem]    = useState(null);
  const [deptFilter, setDeptFilter] = useState("all");
  const [activity,   setActivity]   = useState({});

  // 각 봇의 실제 최근 대화 조회
  useEffect(() => {
    let cancelled = false;
    const load = () => Promise.all(BOTS.map((b) =>
      fetch(`/api/projects/${activeProject}/messages/${b.id}`)
        .then((r) => r.json())
        .then((arr) => {
          const list = Array.isArray(arr) ? arr : [];
          const last = list[list.length - 1];
          return [b.id, last ? { text: (last.content || "").replace(/\n/g, " ").slice(0, 36), time: last.timestamp, count: list.length } : null];
        })
        .catch(() => [b.id, null])
    )).then((entries) => { if (!cancelled) setActivity(Object.fromEntries(entries)); });
    load();
    const t = setInterval(load, 8000); // 8초마다 갱신
    return () => { cancelled = true; clearInterval(t); };
  }, [activeProject]);

  const selectHuman = (h)  => { setSelItem({ type: "human", ...h  }); setView("human-detail"); onSelect({ type: "human", id: h.id  }); };
  const selectAI    = (ai) => { setSelItem({ type: "ai",    ...ai }); setView("ai-detail");    onSelect({ type: "ai",   id: ai.id }); };

  return (
    <div style={{ width: 268, background: "#ffffff", borderLeft: "1px solid " + BR, display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>
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
              className="panel-item-hover"
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", cursor: "pointer", borderBottom: "1px solid " + BR + "44" }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <PixelAvatar id={h.id} size={32} color={h.color} />
                <div style={{ position: "absolute", bottom: -1, right: -1, width: 8, height: 8, borderRadius: "50%", background: h.status === "active" ? "#16a34a" : "#f59e0b", border: "1.5px solid #ffffff" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</div>
                <div style={{ fontSize: 10, color: h.color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.title}</div>
              </div>
              <span style={{ fontSize: 8, color: M, flexShrink: 0 }}>{getDept(h.dept)?.name}</span>
            </div>
          ))}

          {/* AI 봇 (실제 Dify 봇 + 최근 활동) */}
          <div style={{ padding: "7px 10px 4px", fontSize: 10, fontWeight: 700, color: M, background: B, borderBottom: "1px solid " + BR, position: "sticky", top: 0, zIndex: 2 }}>
            🤖 AI 봇 ({BOTS.length}) <span style={{ fontWeight: 400, fontSize: 9 }}>· Gemini · Dify</span>
          </div>
          {BOTS.map((b) => {
            const act = activity[b.id];
            const on = act && act.count > 0;
            return (
              <div key={b.id}
                className="panel-item-hover"
                style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 10px", borderBottom: "1px solid " + BR + "33" }}>
                <div style={{ position: "relative", flexShrink: 0, width: 30, height: 30, borderRadius: 9, background: b.color + "20", border: "1px solid " + b.color + "33", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                  {b.icon}
                  <div style={{ position: "absolute", bottom: -2, right: -2, width: 8, height: 8, borderRadius: "50%", background: on ? "#16a34a" : "#cbd5e1", border: "1.5px solid #fff" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: b.color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</div>
                  <div style={{ fontSize: 9, color: M, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {on ? `▶ ${act.text}…` : "대기중"}
                  </div>
                </div>
                {on && <span style={{ fontSize: 8, color: M, background: B, padding: "1px 5px", borderRadius: 7, flexShrink: 0 }}>{act.count}</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* HUMAN DETAIL */}
      {view === "human-detail" && selItem && (
        <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
          {/* RPG 프로필 카드 */}
          <div style={{ background: S, border: "1px solid " + selItem.color + "44", borderRadius: 10, padding: 14, marginBottom: 12, position: "relative", overflow: "hidden" }}>
            {/* 배경 장식 */}
            <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: selItem.color + "08" }} />
            <div style={{ position: "absolute", bottom: -15, left: -15, width: 50, height: 50, borderRadius: "50%", background: selItem.color + "06" }} />

            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <PixelAvatar id={selItem.id} size={52} color={selItem.color} />
                {/* 레벨 뱃지 */}
                <div style={{ position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)", background: selItem.color, color: "#fff", fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 6, whiteSpace: "nowrap" }}>
                  Lv.{(selItem.id.charCodeAt(1) % 20) + 10}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: T, marginBottom: 2 }}>{selItem.name}</div>
                <div style={{ fontSize: 11, color: selItem.color, marginBottom: 4 }}>{selItem.title}</div>
                <div style={{ fontSize: 10, color: "#16a34a", background: "#dcfce7", padding: "2px 8px", borderRadius: 8, display: "inline-block" }}>{selItem.mood}</div>
              </div>
            </div>

            {/* 능력치 바 */}
            {[
              { label: "창의력", val: ((selItem.id.charCodeAt(1) * 7) % 40) + 60 },
              { label: "실행력", val: ((selItem.id.charCodeAt(1) * 13) % 40) + 55 },
              { label: "협업력", val: ((selItem.id.charCodeAt(1) * 11) % 35) + 65 },
            ].map((stat) => (
              <div key={stat.label} style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ fontSize: 9, color: M, fontFamily: "monospace" }}>{stat.label}</span>
                  <span style={{ fontSize: 9, color: selItem.color, fontWeight: 700 }}>{stat.val}</span>
                </div>
                <div style={{ height: 4, background: BR, borderRadius: 2 }}>
                  <div style={{ height: 4, width: stat.val + "%", background: "linear-gradient(90deg," + selItem.color + "," + selItem.color + "88)", borderRadius: 2, transition: "width 0.5s" }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 10, color: M, fontWeight: 700, marginBottom: 8, fontFamily: "monospace", letterSpacing: 1 }}>◆ 담당 프로젝트</div>
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
          {/* RPG 프로필 카드 */}
          <div style={{ background: S, border: "1px solid " + selItem.color + "44", borderRadius: 10, padding: 14, marginBottom: 12, position: "relative", overflow: "hidden" }}>
            {/* 배경 장식 */}
            <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: selItem.color + "08" }} />
            <div style={{ position: "absolute", bottom: -15, left: -15, width: 50, height: 50, borderRadius: "50%", background: selItem.color + "06" }} />

            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <PixelAvatar id={selItem.id} size={52} color={selItem.color} />
                {/* 레벨 뱃지 */}
                <div style={{ position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)", background: selItem.color, color: "#fff", fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 6, whiteSpace: "nowrap" }}>
                  AI Lv.{(selItem.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 30) + 50}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: selItem.color, marginBottom: 2 }}>{selItem.name}</div>
                <div style={{ fontSize: 11, color: T, marginBottom: 2 }}>{selItem.title}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: selItem.status === "active" ? "#34d399" : "#475569" }} />
                  <span style={{ fontSize: 9, color: getDept(selItem.dept)?.color, fontFamily: "monospace" }}>{getDept(selItem.dept)?.name}팀</span>
                </div>
              </div>
            </div>

            <div style={{ fontSize: 11, color: M, lineHeight: 1.7, padding: "8px 10px", background: B, borderRadius: 6, marginBottom: 10, fontStyle: "italic" }}>"{selItem.desc}"</div>

            <div style={{ fontSize: 10, color: M, marginBottom: 6 }}>현재 작업</div>
            <div style={{ fontSize: 11, color: selItem.status === "active" ? selItem.color : M, fontWeight: selItem.status === "active" ? 600 : 400, marginBottom: 12 }}>
              {selItem.status === "active" ? "▶ " + selItem.task : "● 대기중"}
            </div>

            {/* AI 능력치 바 */}
            {[
              { label: "처리속도", val: ((selItem.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 7) % 30) + 70 },
              { label: "정확도",   val: ((selItem.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 11) % 25) + 75 },
              { label: "학습률",   val: ((selItem.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 13) % 35) + 60 },
            ].map((stat) => (
              <div key={stat.label} style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ fontSize: 9, color: M, fontFamily: "monospace" }}>{stat.label}</span>
                  <span style={{ fontSize: 9, color: selItem.color, fontWeight: 700 }}>{stat.val}</span>
                </div>
                <div style={{ height: 4, background: BR, borderRadius: 2 }}>
                  <div style={{ height: 4, width: stat.val + "%", background: "linear-gradient(90deg," + selItem.color + "," + selItem.color + "88)", borderRadius: 2, transition: "width 0.5s" }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 10, color: M, fontWeight: 700, marginBottom: 8, fontFamily: "monospace", letterSpacing: 1 }}>◆ 연관 프로젝트</div>
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
