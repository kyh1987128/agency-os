import { useState, useMemo, useCallback, useRef, useLayoutEffect, useEffect } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { ko } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import NodeComments from "./NodeComments";

const API = "";

const locales = { ko };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const STATUS_COLOR = { todo:"#94a3b8", active:"#f59e0b", review:"#6366f1", done:"#34d399" };
const DAYS_KO = ["일","월","화","수","목","금","토"];

/* 파스텔 톤(방안 ④): 상태색을 흰색과 섞은 연한 배경 + 같은 계열 진한 글자.
 * 배경이 항상 밝으므로 어떤 상태색이든 가독성이 보장되고, 색 정체성도 유지된다. */
function pastel(hex) {
  const h = (hex || "#94a3b8").replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const toHex = (c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0");
  const mix   = (c, ratio) => c * ratio + 255 * (1 - ratio);   // 흰색과 섞기
  const dark  = (c, f) => c * f;                                // 같은 색 어둡게
  const build = (fn) => `#${toHex(fn(r))}${toHex(fn(g))}${toHex(fn(b))}`;
  return {
    bg:     build((c) => mix(c, 0.16)),   // 16% 색 + 84% 흰색 → 연한 파스텔 배경
    title:  build((c) => dark(c, 0.42)),  // 제목: 같은 색 가장 진하게
    sub:    build((c) => dark(c, 0.55)),  // 부제목: 살짝 옅게
    border: `${hex}55`,                   // 같은 색 옅은 테두리로 카드 경계 정의
  };
}

/*
 * 이벤트 변환 규칙:
 *  1) startDate ≠ dueDate  → allDay span (여러 날짜 기간)
 *  2) startTime 있음        → 타임그리드 이벤트 (실제 시간 데이터)
 *  3) startTime 없음        → allDay 마감일 마커 (09:00 fallback 제거)
 */
function nodesToEvents(nodes, projData, departments, humans) {
  return nodes
    .filter(n => n.dueDate)
    .map(node => {
      const proj   = projData.find(p => p.id === node.projectId);
      const color  = STATUS_COLOR[node.status] || "#94a3b8";
      const assigneeHumans = (node.assignees||[]).map(id => humans.find(h=>h.id===id)).filter(Boolean);
      const resource = { node, proj, color, assigneeHumans, departments };

      // ① 여러 날 기간 → allDay span
      if (node.startDate && node.startDate !== node.dueDate) {
        const start = new Date(node.startDate + "T00:00:00");
        const end   = new Date(node.dueDate   + "T00:00:00");
        end.setDate(end.getDate() + 1);
        return { id: node.id, title: node.title, start, end, allDay: true, resource };
      }

      // ② startTime 있음 → 타임그리드
      if (node.startTime) {
        const dateStr = node.dueDate;
        const [sh, sm] = node.startTime.split(":").map(Number);
        const start = new Date(dateStr); start.setHours(sh, sm, 0, 0);
        let end;
        if (node.endTime) {
          const [eh, em] = node.endTime.split(":").map(Number);
          end = new Date(dateStr); end.setHours(eh, em, 0, 0);
        } else {
          end = new Date(start.getTime() + 3600000);
        }
        if (start.getTime() >= end.getTime()) end = new Date(start.getTime() + 3600000);
        return { id: node.id, title: node.title, start, end, allDay: false, resource };
      }

      // ③ startTime 없음 → allDay 마감일 마커 (타임그리드에 넣지 않음)
      const start = new Date(node.dueDate + "T00:00:00");
      const end   = new Date(node.dueDate + "T00:00:00");
      end.setDate(end.getDate() + 1);
      return { id: node.id, title: node.title, start, end, allDay: true, resource };
    });
}

/* 전자결재(승인된 휴가·출장 등)를 캘린더 이벤트로 — 자동 반영 */
const LEAVE_TYPES = { vacation:{icon:"🏖",label:"휴가",color:"#0ea5e9"}, trip:{icon:"✈️",label:"출장",color:"#8b5cf6"}, remote:{icon:"🏠",label:"재택",color:"#14b8a6"}, leave_long:{icon:"🗓",label:"휴직",color:"#64748b"}, leave_early:{icon:"🚪",label:"조퇴·외출",color:"#f59e0b"} };
function bizDays(from, to) { const a=new Date(from+"T00:00:00"), b=new Date((to||from)+"T00:00:00"); if(isNaN(a)||isNaN(b)||b<a) return 1; let n=0; const c=new Date(a); while(c<=b && n<366){ const w=c.getDay(); if(w!==0&&w!==6)n++; c.setDate(c.getDate()+1);} return n||1; }
function vacationDays(d){ const k=d.fields?.kind||""; if(k.includes("반차")) return 0.5; if(["병가","경조","공가","무급휴가"].includes(k)) return 0; const from=d.fields?.from, to=d.fields?.to||from; if(!from) return 0; return bizDays(from,to); }
function approvalsToEvents(approvals, humans){
  return (approvals||[]).filter(d=>d.status==="approved" && LEAVE_TYPES[d.type] && (d.fields?.from||d.fields?.date)).map(d=>{
    const lt=LEAVE_TYPES[d.type]; const fromStr=d.fields.from||d.fields.date; const toStr=d.fields.to||fromStr;
    const start=new Date(fromStr+"T00:00:00"); if(isNaN(start)) return null;
    const end=new Date((toStr||fromStr)+"T00:00:00"); end.setDate(end.getDate()+1);
    const h=humans.find(x=>x.id===d.drafterId); const who=d.drafterName||h?.name||"";
    const kind=d.fields.kind?` ${d.fields.kind}`:"";
    return { id:"ap_"+d.id, title:`${lt.icon} ${who} ${lt.label}${kind}`, start, end, allDay:true, resource:{ isApproval:true, color:lt.color, proj:null, assigneeHumans:h?[h]:[], departments:[], approval:d } };
  }).filter(Boolean);
}

/* 이벤트 카드 */
function EventCard({ event, view }) {
  const { color, proj, assigneeHumans, departments } = event.resource;

  // 월뷰: 한 줄 컴팩트(제목만) — 하루에 여러 개 누적돼도 글자 안 찌그러짐
  if (view === "month") {
    const p = pastel(color);
    return (
      <div className="cal-month-card" style={{ background:p.bg, border:`1px solid ${p.border}`, borderRadius:4, padding:"0 7px", height:"100%", display:"flex", alignItems:"center", overflow:"hidden" }}>
        <span style={{ fontSize:11, fontWeight:700, color:p.title, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", lineHeight:1.4, letterSpacing:"-0.01em" }}>{event.title}</span>
      </div>
    );
  }

  // allDay (종일/기간/마감일 마커) — 행 높이에 맞춰 제목+상세 표시, 좁아지면 자동 축소(overflow:hidden)
  if (event.allDay) {
    const p = pastel(color);
    const sub = [proj?.title, assigneeHumans.map(h => h.name).join(", ")].filter(Boolean).join(" · ");
    return (
      <div className="cal-allday-card" style={{ background:p.bg, border:`1px solid ${p.border}`, borderRadius:4, padding:"3px 9px", height:"100%", overflow:"hidden", display:"flex", flexDirection:"column", justifyContent:"center", gap:2 }}>
        <div className="cal-ev-title" style={{ fontSize:13, fontWeight:800, color:p.title, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", lineHeight:1.3, letterSpacing:"-0.01em" }}>{event.title}</div>
        {sub && <div className="cal-ev-sub" style={{ fontSize:11, fontWeight:600, color:p.sub, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", lineHeight:1.25 }}>{sub}</div>}
      </div>
    );
  }

  // 타임그리드 이벤트 — 시간+상세 정보 표시 (방안 ④ 파스텔 톤)
  const p = pastel(color);
  return (
    <div style={{ background:p.bg, border:`1px solid ${p.border}`, borderRadius:4, padding:"3px 7px", height:"100%", overflow:"hidden", display:"flex", flexDirection:"column", gap:1 }}>
      <div style={{ fontSize:12, fontWeight:800, color:p.title, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{event.title}</div>
      {proj && <div style={{ fontSize:10, fontWeight:600, color:p.sub, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{proj.title}</div>}
      {assigneeHumans.length > 0 && (
        <div style={{ fontSize:10, fontWeight:600, color:p.sub, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
          {assigneeHumans.map(h => {
            const dept = departments?.find(d => d.id === h.deptId);
            return dept ? `${h.name}(${dept.name})` : h.name;
          }).join(" · ")}
        </div>
      )}
    </div>
  );
}

/* ── 날짜 헤더 컴포넌트 (주뷰 칩 스타일) ── */
function DayColumnHeader({ date }) {
  const isToday   = new Date().toDateString() === date.toDateString();
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // 일=0, 토=6
  const day = DAYS_KO[dayOfWeek];
  const d   = date.getDate();
  const dayColor = isToday ? "#3b82f6" : isWeekend ? "#ef4444" : "#94a3b8";
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"6px 0 5px", gap:2 }}>
      <div style={{
        width:26, height:26, borderRadius:"50%",
        background: isToday ? "#3b82f6" : "transparent",
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:12, fontWeight:700,
        color: isToday ? "#fff" : isWeekend ? "#ef4444" : "#334155",
      }}>{d}</div>
      <span style={{ fontSize:10, color: dayColor, fontWeight:600, lineHeight:1 }}>{day}</span>
    </div>
  );
}

/* ── 월뷰 날짜 헤더 (요일) ── */
function MonthWeekday({ label }) {
  return (
    <div style={{ textAlign:"center", padding:"6px 0", fontSize:10, fontWeight:700, color:"#94a3b8" }}>
      {label}
    </div>
  );
}

/* ── 월뷰 날짜 셀 ── */
function MonthDateHeader({ date, label, isOffRange }) {
  const isToday   = new Date().toDateString() === date.toDateString();
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const textColor = isToday ? "#fff"
    : isOffRange  ? "#cbd5e1"
    : isWeekend   ? "#ef4444"
    : "#334155";
  return (
    <div style={{ textAlign:"right", padding:"2px 6px" }}>
      <span style={{
        display:"inline-flex", alignItems:"center", justifyContent:"center",
        width:22, height:22, borderRadius:"50%",
        background: isToday ? "#3b82f6" : "transparent",
        fontSize:11, fontWeight: isToday ? 800 : 400,
        color: textColor,
      }}>{label}</span>
    </div>
  );
}

/* ── 이벤트 편집/상세 모달 ── */
function EventModal({ event, onClose, onSave, onDelete, projData, humans, departments=[] }) {
  const node = event.resource.node;
  const [startDate, setStartDate] = useState(node.startDate || node.dueDate || "");
  const [endDate,   setEndDate]   = useState(node.dueDate || "");
  const [startTime, setStartTime] = useState(node.startTime || "");
  const [endTime,   setEndTime]   = useState(node.endTime   || "");
  const [desc,      setDesc]      = useState(node.desc      || "");
  const [assignees, setAssignees] = useState(node.assignees || []);
  const [saving,          setSaving]         = useState(false);
  const [confirmDel,      setConfirmDel]     = useState(false);
  const [assigneeDropOpen,setAssigneeDropOpen] = useState(false);

  const S = { width:"100%", border:"1px solid #e2e8f0", borderRadius:7, padding:"7px 10px", fontSize:12, color:"#1e293b", outline:"none", background:"#fff", boxSizing:"border-box" };
  const L = { fontSize:10, fontWeight:700, color:"#94a3b8", marginBottom:4, textTransform:"uppercase" };

  const toggleAssignee = (id) => {
    setAssignees(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(node.id, node.projectId, { startDate:startDate||null, dueDate:endDate||null, startTime:startTime||null, endTime:endTime||null, desc, assignees });
    setSaving(false);
    onClose();
  };

  const handleDelete = async () => {
    if (!confirmDel) { setConfirmDel(true); return; }
    await onDelete(node.id, node.projectId);
    onClose();
  };

  const statusColor = STATUS_COLOR[node.status] || "#94a3b8";
  const statusLabel = { todo:"대기중", active:"진행중", review:"검토중", done:"완료" }[node.status] || "";
  const proj = projData.find(p => p.id === node.projectId);

  return (
    <div style={{ position:"fixed", inset:0, background:"#00000055", zIndex:400, display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"5vh 16px 40px", overflowY:"auto" }}
      onClick={e => { if (e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:"#fff", borderRadius:12, width:760, maxWidth:"94vw", boxShadow:"0 8px 32px rgba(0,0,0,0.18)", flexShrink:0 }}>
        {/* 헤더 */}
        <div style={{ padding:"12px 16px", borderBottom:"1px solid #e2e8f0", display:"flex", alignItems:"center", gap:10, position:"sticky", top:0, background:"#fff", zIndex:1, borderRadius:"12px 12px 0 0" }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:statusColor, flexShrink:0 }} />
          <span style={{ flex:1, fontSize:13, fontWeight:700, color:"#1e293b" }}>{node.title}</span>
          <span style={{ fontSize:10, color:statusColor, background:statusColor+"18", padding:"2px 8px", borderRadius:8, fontWeight:600 }}>{statusLabel}</span>
          <button onClick={onClose} style={{ background:"transparent", border:"1px solid #e2e8f0", color:"#94a3b8", cursor:"pointer", borderRadius:6, padding:"2px 10px", fontSize:11 }}>✕</button>
        </div>

        <div style={{ padding:"14px 16px", display:"flex", flexWrap:"wrap", gap:16, alignItems:"stretch" }}>
          <div style={{ flex:"1 1 320px", minWidth:0, display:"flex", flexDirection:"column", gap:12 }}>
          {proj && (
            <div style={{ fontSize:11, color:"#6366f1", background:"#ede9fe", padding:"4px 10px", borderRadius:8, display:"inline-flex", alignSelf:"flex-start" }}>
              📋 {proj.title}
            </div>
          )}

          {/* 날짜/시간 */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div><div style={L}>시작일</div><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} style={S} /></div>
            <div><div style={L}>마감일</div><input type="date" value={endDate}   onChange={e=>setEndDate(e.target.value)}   style={S} /></div>
            <div><div style={L}>시작 시간</div><input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} style={S} /></div>
            <div><div style={L}>종료 시간</div><input type="time" value={endTime}   onChange={e=>setEndTime(e.target.value)}   style={S} /></div>
          </div>

          {/* 메모 */}
          <div>
            <div style={L}>메모</div>
            <textarea
              value={desc}
              onChange={e=>setDesc(e.target.value)}
              placeholder="메모를 입력하세요..."
              rows={3}
              style={{ ...S, resize:"vertical", lineHeight:1.6 }}
            />
          </div>

          {/* 담당자 */}
          <div>
            <div style={L}>담당자</div>
            <div style={{ position: "relative" }}>
              {/* 선택 표시 버튼 */}
              <div
                onClick={() => setAssigneeDropOpen(v => !v)}
                style={{
                  border: "1px solid #e2e8f0", borderRadius: 7, padding: "7px 10px",
                  cursor: "pointer", fontSize: 11, color: assignees.length ? "#1e293b" : "#94a3b8",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "#fff",
                }}
              >
                <span>
                  {assignees.length === 0
                    ? "담당자 선택..."
                    : humans.filter(h => assignees.includes(h.id)).map(h => h.name).join(", ")}
                </span>
                <span style={{ fontSize: 9, color: "#94a3b8" }}>{assigneeDropOpen ? "▲" : "▼"}</span>
              </div>
              {/* 드롭다운 목록 */}
              {assigneeDropOpen && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
                  background: "#fff", border: "1px solid #e2e8f0", borderRadius: 7,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.12)", maxHeight: 180, overflowY: "auto",
                  marginTop: 2,
                }}>
                  {humans.map(h => {
                    const sel = assignees.includes(h.id);
                    const dept = departments.find(d => d.id === h.deptId);
                    return (
                      <div
                        key={h.id}
                        onClick={() => toggleAssignee(h.id)}
                        style={{
                          display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                          cursor: "pointer", background: sel ? "#ede9fe" : "#fff",
                          borderBottom: "1px solid #f1f5f9",
                        }}
                      >
                        <input type="checkbox" checked={sel} readOnly style={{ pointerEvents: "none", width: 14, height: 14 }} />
                        <span style={{ fontSize: 14 }}>{h.avatar || "👤"}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: sel ? 700 : 400, color: sel ? "#6366f1" : "#1e293b" }}>{h.name}</div>
                          {dept && (
                            <span style={{ fontSize: 9, color: dept.color || "#94a3b8", background: (dept.color || "#94a3b8") + "18", padding: "1px 5px", borderRadius: 3, fontWeight: 600 }}>
                              {dept.name}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          </div>{/* 좌측 컬럼 끝 */}

          {/* 우측: 댓글 */}
          <div style={{ flex:"1 1 280px", minWidth:0, borderLeft:"1px solid #f1f5f9", paddingLeft:16, display:"flex", flexDirection:"column" }}>
            <div style={L}>댓글</div>
            <NodeComments pid={node.projectId} nodeId={node.id} />
          </div>
        </div>

        {/* 하단 버튼 */}
        <div style={{ display:"flex", gap:8, padding:"10px 16px", borderTop:"1px solid #e2e8f0", alignItems:"center" }}>
          <button
            onClick={handleDelete}
            style={{ padding:"6px 12px", borderRadius:7, border:`1px solid ${confirmDel?"#ef4444":"#fca5a5"}`, background:confirmDel?"#ef4444":"#fff5f5", color:confirmDel?"#fff":"#ef4444", fontSize:11, cursor:"pointer", fontWeight:600 }}
          >
            {confirmDel ? "정말 삭제" : "🗑️ 삭제"}
          </button>
          {confirmDel && (
            <button onClick={() => setConfirmDel(false)} style={{ padding:"6px 10px", borderRadius:7, border:"1px solid #e2e8f0", background:"#f8fafc", color:"#64748b", fontSize:11, cursor:"pointer" }}>
              취소
            </button>
          )}
          <div style={{ flex:1 }} />
          <button onClick={onClose} style={{ padding:"6px 14px", borderRadius:7, border:"1px solid #e2e8f0", background:"#f8fafc", color:"#64748b", fontSize:11, cursor:"pointer" }}>취소</button>
          <button onClick={handleSave} disabled={saving} style={{ padding:"6px 14px", borderRadius:7, border:"none", background:saving?"#e2e8f0":"#6366f1", color:saving?"#94a3b8":"#fff", fontSize:11, fontWeight:700, cursor:"pointer" }}>
            {saving ? "저장중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── 새 일정 생성 모달 ── */
function NewEventModal({ slot, onClose, onCreated, projData, humans, departments=[], defaultAssignees=[], defaultProjectId="" }) {
  const [title,     setTitle]     = useState("");
  const [projectId, setProjectId] = useState(defaultProjectId || projData[0]?.id || "");
  const [startDate, setStartDate] = useState(slot ? format(slot.start, "yyyy-MM-dd") : "");
  const [dueDate,   setDueDate]   = useState(slot ? format(slot.start, "yyyy-MM-dd") : "");
  // 타임그리드 클릭(00:00 아님)일 때만 시간 pre-fill, allDay/월뷰 클릭이면 빈값
  const [startTime, setStartTime] = useState(() => {
    if (!slot?.start) return "";
    const h = slot.start.getHours(), m = slot.start.getMinutes();
    if (h === 0 && m === 0) return ""; // allDay 영역 또는 월뷰 클릭
    return format(slot.start, "HH:mm");
  });
  const [endTime,   setEndTime]   = useState("");
  const [assignees,        setAssignees]        = useState(defaultAssignees);
  const [desc,             setDesc]             = useState("");
  const [saving,           setSaving]           = useState(false);
  const [assigneeDropOpen, setAssigneeDropOpen] = useState(false);

  const S = { width:"100%", border:"1px solid #e2e8f0", borderRadius:7, padding:"7px 10px", fontSize:12, color:"#1e293b", outline:"none", background:"#fff", boxSizing:"border-box" };
  const L = { fontSize:10, fontWeight:700, color:"#94a3b8", marginBottom:4, textTransform:"uppercase" };

  const toggleAssignee = (id) => setAssignees(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);

  const handleCreate = async () => {
    if (!title.trim() || !projectId) return;
    setSaving(true);
    try {
      await fetch(`${API}/api/data/projects/${projectId}/nodes`, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ title:title.trim(), startDate:startDate||null, dueDate, startTime:startTime||null, endTime:endTime||null, desc, assignees, status:"todo" }),
      });
      onCreated?.();
    } catch(e) { console.error(e); }
    setSaving(false);
    onClose();
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"#00000055", zIndex:400, display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"5vh 16px 40px", overflowY:"auto" }}
      onClick={e => { if(e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:"#fff", borderRadius:12, width:420, maxWidth:"94vw", boxShadow:"0 8px 32px rgba(0,0,0,0.18)", flexShrink:0 }}>
        <div style={{ padding:"12px 16px", borderBottom:"1px solid #e2e8f0", display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ flex:1, fontSize:13, fontWeight:700, color:"#1e293b" }}>📅 새 업무 추가</span>
          <button onClick={onClose} style={{ background:"transparent", border:"1px solid #e2e8f0", color:"#94a3b8", cursor:"pointer", borderRadius:6, padding:"2px 10px", fontSize:11 }}>✕</button>
        </div>
        <div style={{ padding:"14px 16px", display:"flex", flexDirection:"column", gap:12 }}>
          <div>
            <div style={L}>제목 *</div>
            <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="업무 제목 입력..." style={S} autoFocus
              onKeyDown={e => { if(e.key==="Enter") handleCreate(); }} />
          </div>
          <div>
            <div style={L}>프로젝트 *</div>
            <select value={projectId} onChange={e=>setProjectId(e.target.value)} style={S}>
              {projData.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div><div style={L}>시작일</div><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} style={S} /></div>
            <div><div style={L}>마감일 *</div><input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} style={S} /></div>
            <div><div style={L}>시작 시간</div><input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} style={S} /></div>
            <div><div style={L}>종료 시간</div><input type="time" value={endTime}   onChange={e=>setEndTime(e.target.value)}   style={S} /></div>
          </div>
          <div>
            <div style={L}>메모</div>
            <textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="메모 (선택)" rows={2} style={{ ...S, resize:"vertical" }} />
          </div>
          <div>
            <div style={L}>담당자</div>
            <div style={{ position: "relative" }}>
              {/* 선택 표시 버튼 */}
              <div
                onClick={() => setAssigneeDropOpen(v => !v)}
                style={{
                  border: "1px solid #e2e8f0", borderRadius: 7, padding: "7px 10px",
                  cursor: "pointer", fontSize: 11, color: assignees.length ? "#1e293b" : "#94a3b8",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "#fff",
                }}
              >
                <span>
                  {assignees.length === 0
                    ? "담당자 선택..."
                    : humans.filter(h => assignees.includes(h.id)).map(h => h.name).join(", ")}
                </span>
                <span style={{ fontSize: 9, color: "#94a3b8" }}>{assigneeDropOpen ? "▲" : "▼"}</span>
              </div>
              {/* 드롭다운 목록 */}
              {assigneeDropOpen && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
                  background: "#fff", border: "1px solid #e2e8f0", borderRadius: 7,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.12)", maxHeight: 180, overflowY: "auto",
                  marginTop: 2,
                }}>
                  {humans.map(h => {
                    const sel = assignees.includes(h.id);
                    const dept = departments.find(d => d.id === h.deptId);
                    return (
                      <div
                        key={h.id}
                        onClick={() => toggleAssignee(h.id)}
                        style={{
                          display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                          cursor: "pointer", background: sel ? "#ede9fe" : "#fff",
                          borderBottom: "1px solid #f1f5f9",
                        }}
                      >
                        <input type="checkbox" checked={sel} readOnly style={{ pointerEvents: "none", width: 14, height: 14 }} />
                        <span style={{ fontSize: 14 }}>{h.avatar || "👤"}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: sel ? 700 : 400, color: sel ? "#6366f1" : "#1e293b" }}>{h.name}</div>
                          {dept && (
                            <span style={{ fontSize: 9, color: dept.color || "#94a3b8", background: (dept.color || "#94a3b8") + "18", padding: "1px 5px", borderRadius: 3, fontWeight: 600 }}>
                              {dept.name}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, padding:"10px 16px", borderTop:"1px solid #e2e8f0", justifyContent:"flex-end" }}>
          <button onClick={onClose} style={{ padding:"6px 14px", borderRadius:7, border:"1px solid #e2e8f0", background:"#f8fafc", color:"#64748b", fontSize:11, cursor:"pointer" }}>취소</button>
          <button onClick={handleCreate} disabled={saving||!title.trim()||!projectId} style={{ padding:"6px 14px", borderRadius:7, border:"none", background:(!title.trim()||!projectId)?"#e2e8f0":"#6366f1", color:(!title.trim()||!projectId)?"#94a3b8":"#fff", fontSize:11, fontWeight:700, cursor:"pointer" }}>
            {saving ? "추가중..." : "추가"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── 왼쪽 사이드패널 ── */
const GROUP_MODES = [
  { id:"all",      label:"전체 일정",  icon:"📅" },
  { id:"project",  label:"프로젝트별", icon:"📋" },
  { id:"dept",     label:"부서별",     icon:"🏢" },
  { id:"assignee", label:"담당자별",   icon:"👤" },
];
const VIEW_MODES = [
  { id:"month", label:"월" },
  { id:"week",  label:"주" },
  { id:"day",   label:"일" },
];

function CalendarSidebar({ view, setView, groupMode, setGroupMode, selectedId, setSelectedId, projData, departments, humans }) {
  const sBtn = (active) => ({
    width:"100%", display:"flex", alignItems:"center", gap:8,
    padding:"8px 10px", borderRadius:7, border:"none", cursor:"pointer",
    background: active ? "#ede9fe" : "transparent",
    color: active ? "#6366f1" : "#64748b",
    fontSize:11, fontWeight: active ? 700 : 400,
    textAlign:"left",
  });

  const groupItems = useMemo(() => {
    if (groupMode==="project")  return projData.map(p    => ({ id:p.id,   label:p.title, color:"#6366f1" }));
    if (groupMode==="dept")     return departments.map(d => ({ id:d.id,   label:d.name,  color:d.color }));
    if (groupMode==="assignee") return humans.map(h      => ({ id:h.id,   label:h.name,  color:h.color }));
    return [];
  }, [groupMode, projData, departments, humans]);

  return (
    <div style={{ width:168, flexShrink:0, background:"#fff", borderRight:"1px solid #e2e8f0", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      {/* 뷰 전환 */}
      <div style={{ padding:"10px 10px 8px" }}>
        <div style={{ display:"flex", background:"#f1f5f9", borderRadius:7, padding:2, gap:2 }}>
          {VIEW_MODES.map(v => (
            <button key={v.id} onClick={() => setView(v.id)} style={{
              flex:1, padding:"5px 0", borderRadius:5, border:"none", fontSize:11, fontWeight:600, cursor:"pointer",
              background: view===v.id ? "#fff" : "transparent",
              color: view===v.id ? "#6366f1" : "#64748b",
              boxShadow: view===v.id ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}>{v.label}</button>
          ))}
        </div>
      </div>

      <div style={{ height:1, background:"#f1f5f9", margin:"0 10px" }} />

      {/* 그룹 기준 */}
      <div style={{ padding:"8px 10px", flex:1, overflow:"auto" }}>
        <div style={{ fontSize:9, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", marginBottom:6, paddingLeft:2 }}>그룹 기준</div>
        {GROUP_MODES.map(g => (
          <div key={g.id}>
            <button onClick={() => { setGroupMode(g.id); setSelectedId(null); }} style={sBtn(groupMode===g.id && !selectedId)}>
              <span style={{ fontSize:13 }}>{g.icon}</span>
              <span>{g.label}</span>
            </button>
            {groupMode===g.id && groupItems.length > 0 && (
              <div style={{ marginLeft:8, marginBottom:4 }}>
                {groupItems.map(item => (
                  <button key={item.id} onClick={() => setSelectedId(selectedId===item.id ? null : item.id)}
                    style={{ ...sBtn(selectedId===item.id), paddingLeft:14, fontSize:10, borderLeft:`2px solid ${selectedId===item.id?item.color:"#e2e8f0"}`, borderRadius:"0 6px 6px 0", marginBottom:1 }}>
                    <div style={{ width:6, height:6, borderRadius:"50%", background:item.color, flexShrink:0 }} />
                    <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color:selectedId===item.id?item.color:"#64748b" }}>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 빈 툴바 ── */
const EmptyToolbar = () => null;

/* ──────────────────────────────── 메인 ── */
export default function CalendarView({ allNodes=[], projData=[], departments=[], humans=[], onNodesChange }) {
  const [currentDate,    setCurrentDate]    = useState(new Date());
  const [view,           setView]           = useState("week");
  const [groupMode,      setGroupMode]      = useState("all");
  const [selectedId,     setSelectedId]     = useState(null);
  const [selectedEvent,  setSelectedEvent]  = useState(null);
  const [newSlot,        setNewSlot]        = useState(null);
  const [showNoDate,     setShowNoDate]     = useState(false);
  const calWrapRef = useRef(null);
  const [approvals,  setApprovals]  = useState([]);
  const [showLeave,  setShowLeave]  = useState(false);
  useEffect(() => {
    const load = () => fetch("/api/approvals").then((r) => r.json()).then((d) => setApprovals(Array.isArray(d) ? d : [])).catch(() => {});
    load();
    const es = new EventSource("/api/stream");
    es.onmessage = (e) => { try { const m = JSON.parse(e.data); if (m.type === "data_update" && m.resource === "approvals") load(); } catch {} };
    return () => es.close();
  }, []);
  const approvalEvents = useMemo(() => approvalsToEvents(approvals, humans), [approvals, humans]);
  const leaveStatus = useMemo(() => {
    const ALLOT = 15;
    return humans.map((h) => {
      const used = approvals.filter((d) => d.type === "vacation" && d.status === "approved" && d.drafterId === h.id).reduce((s, d) => s + vacationDays(d), 0);
      return { id: h.id, name: h.name, avatar: h.avatar, used, remain: Math.max(0, ALLOT - used), allot: ALLOT };
    });
  }, [approvals, humans]);

  /* 그룹 필터(프로젝트/부서/담당자) 통과 여부 — dueDate 조건과 분리 */
  const passesGroup = useCallback((n) => {
    if (groupMode==="project"  && selectedId) return n.projectId === selectedId;
    if (groupMode==="dept"     && selectedId) { const p=projData.find(p=>p.id===n.projectId); return p?.dept===selectedId; }
    if (groupMode==="assignee" && selectedId) return (n.assignees||[]).includes(selectedId);
    return true;
  }, [groupMode, selectedId, projData]);

  /* 필터링 (dueDate 있는 것만 캘린더에 표시) */
  const filteredNodes = useMemo(
    () => allNodes.filter(n => n.dueDate && passesGroup(n)),
    [allNodes, passesGroup]
  );

  /* 마감일 미정 nodes (방식 A+D) — 캘린더에서 누락되지 않도록 별도 백로그로 노출 */
  const noDateNodes = useMemo(
    () => allNodes.filter(n => !n.dueDate && passesGroup(n)),
    [allNodes, passesGroup]
  );

  /* 새 업무 추가 시 현재 필터 기반 기본값 */
  const defaultAssignees = useMemo(() => {
    if (groupMode === "assignee" && selectedId) return [selectedId];
    return [];
  }, [groupMode, selectedId]);

  const defaultProjectId = useMemo(() => {
    if (groupMode === "project" && selectedId) return selectedId;
    return "";
  }, [groupMode, selectedId]);

  const events = useMemo(() => [...nodesToEvents(filteredNodes, projData, departments, humans), ...approvalEvents], [filteredNodes, projData, departments, humans, approvalEvents]);

  /* ── allDay 행 높이 강제 패치 ──
   * react-big-calendar가 .rbc-allday-cell에 height: Xpx를 inline style로 박음
   * CSS !important로는 inline style을 이길 수 없으므로 JS로 직접 제거 후 재설정
   * useLayoutEffect: 브라우저 페인트 전에 실행 → 깜박임 없음
   * MutationObserver: 라이브러리가 다시 덮어쓸 때마다 재적용
   */
  useLayoutEffect(() => {
    const wrapper = calWrapRef.current;
    if (!wrapper) return;

    const setStyle = (el, prop, val) => { if (el.style[prop] !== val) el.style[prop] = val; };

    const fixAllDayHeight = () => {
      const cell = wrapper.querySelector(".rbc-allday-cell");
      if (!cell) return;
      const rc = cell.querySelector(".rbc-row-content");
      if (!rc) return;
      // react-big-calendar는 같은 밴드 안에 "이벤트가 든 줄" 외에 빈 filler 줄(.rbc-row)을
      // 추가로 렌더링한다(특히 기간 스팬 이벤트). flex로 균등 분배하면 빈 줄까지 공간을 가져가
      // 단일 이벤트가 부당하게 얇아진다. → 빈 줄은 접고(0), 이벤트가 든 줄만 계산/분배한다.
      const allRows = [...rc.querySelectorAll(":scope > .rbc-row")];
      let realLines = 0;
      allRows.forEach(r => {
        if (r.querySelector(".rbc-event")) {
          realLines++;
          setStyle(r, "flex", "1 1 0");
          setStyle(r, "minHeight", "0");
          setStyle(r, "maxHeight", "");
          setStyle(r, "height", "");
          setStyle(r, "display", "");
        } else {
          // 빈 줄: 공간을 차지하지 않도록 완전히 접는다
          setStyle(r, "display", "none");
        }
      });
      realLines = Math.max(1, realLines);
      // 밴드 높이 결정 — allDay 밴드는 7일이 높이를 공유하므로 "단일=짧게/겹침=길게"를
      // 열별로 줄 수 없다. 대신:
      //  - 겹침이 없으면 밴드를 한 줄 높이(COMFORT)로 유지 → 단일 이벤트 아래 빈 공간 없음
      //  - 같은 날 여러 이벤트가 겹치면 그 밴드 안에서 flex로 균등 축소(반응형으로 얇아짐)
      //  - 너무 얇아지면(<MINREAD) 그때만 밴드를 늘리고 세로 스크롤
      const COMFORT = 50, MINREAD = 24, CAP = 240;
      let target = COMFORT;
      if (realLines > 1 && COMFORT / realLines < MINREAD) {
        target = Math.min(realLines * MINREAD, CAP);
      }
      const px = target + "px";
      setStyle(cell, "height", px);
      setStyle(cell, "minHeight", px);
      setStyle(cell, "maxHeight", px);
      // 한 줄 실제 높이가 좁으면(겹쳐서 축소된 상태) 부제목을 숨기고 제목만 → 가독성 유지
      const rowH = target / realLines;
      cell.classList.toggle("cal-allday-dense", rowH < 34);
    };

    fixAllDayHeight();

    // 라이브러리가 style을 다시 쓸 때마다 재적용 (debounce로 무한루프 방지)
    let timer = null;
    const obs = new MutationObserver(() => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        fixAllDayHeight();
      }, 0);
    });
    obs.observe(wrapper, { attributes: true, childList: true, subtree: true, attributeFilter: ["style"] });
    return () => { obs.disconnect(); if (timer) clearTimeout(timer); };
  }, [events, view, currentDate]);

  const handleSelectEvent = useCallback((event) => { if (event.resource?.isApproval) return; setSelectedEvent(event); }, []);

  /* 마감일 미정 노드 클릭 → 동일한 편집 모달을 today 기본값으로 열어 날짜 지정 유도 */
  const openNoDateNode = useCallback((node) => {
    const today = format(new Date(), "yyyy-MM-dd");
    const proj  = projData.find(p => p.id === node.projectId);
    setSelectedEvent({
      id: node.id,
      title: node.title,
      resource: {
        node: { ...node, startDate: node.startDate || today, dueDate: node.dueDate || today },
        proj,
        color: STATUS_COLOR[node.status] || "#94a3b8",
        assigneeHumans: (node.assignees||[]).map(id => humans.find(h=>h.id===id)).filter(Boolean),
        departments,
      },
    });
  }, [projData, humans, departments]);

  const handleSelectSlot = useCallback((slot) => {
    setNewSlot(slot);
  }, []);

  const handleSave = async (nodeId, projectId, updates) => {
    try {
      await fetch(`${API}/api/data/projects/${projectId}/nodes/${nodeId}`, {
        method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify(updates),
      });
      onNodesChange?.();
    } catch(e) { console.error(e); }
  };

  const handleDelete = async (nodeId, projectId) => {
    try {
      await fetch(`${API}/api/data/projects/${projectId}/nodes/${nodeId}`, { method:"DELETE" });
      onNodesChange?.();
    } catch(e) { console.error(e); }
  };

  /* 커스텀 내비게이션 */
  const handlePrev = () => {
    const d = new Date(currentDate);
    if (view==="month") d.setMonth(d.getMonth()-1);
    else if (view==="week") d.setDate(d.getDate()-7);
    else d.setDate(d.getDate()-1);
    setCurrentDate(d);
  };
  const handleNext = () => {
    const d = new Date(currentDate);
    if (view==="month") d.setMonth(d.getMonth()+1);
    else if (view==="week") d.setDate(d.getDate()+7);
    else d.setDate(d.getDate()+1);
    setCurrentDate(d);
  };

  /* 헤더 타이틀 */
  const headerTitle = useMemo(() => {
    if (view==="month") return format(currentDate, "yyyy년 M월", { locale:ko });
    if (view==="day")   return `${format(currentDate, "yyyy년 M월 d일")}(${DAYS_KO[currentDate.getDay()]})`;
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start); end.setDate(end.getDate()+6);
    return `${format(start,"M월 d일",{locale:ko})} – ${format(end,"M월 d일",{locale:ko})}`;
  }, [view, currentDate]);

  return (
    <>
      {selectedEvent && (
        <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)}
          onSave={handleSave} onDelete={handleDelete}
          projData={projData} humans={humans} departments={departments} />
      )}
      {newSlot && (
        <NewEventModal slot={newSlot} onClose={() => setNewSlot(null)}
          onCreated={() => { onNodesChange?.(); }}
          projData={projData} humans={humans} departments={departments}
          defaultAssignees={defaultAssignees} defaultProjectId={defaultProjectId} />
      )}

      <div style={{ display:"flex", height:"100%", overflow:"hidden" }}>
        <CalendarSidebar
          view={view} setView={setView}
          groupMode={groupMode} setGroupMode={setGroupMode}
          selectedId={selectedId} setSelectedId={setSelectedId}
          projData={projData} departments={departments} humans={humans}
        />

        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:"#fff" }}>
          {/* 내비게이션 바 */}
          <div style={{ display:"flex", alignItems:"center", padding:"8px 16px", borderBottom:"1px solid #e2e8f0", flexShrink:0 }}>
            {/* 왼쪽: 오늘 버튼 */}
            <div style={{ flex:1 }}>
              <button onClick={() => setCurrentDate(new Date())} style={{ padding:"5px 12px", borderRadius:6, border:"1px solid #e2e8f0", background:"#f8fafc", color:"#1e293b", fontSize:11, cursor:"pointer", fontWeight:600 }}>오늘</button>
            </div>
            {/* 중앙: ◀ 제목 ▶ */}
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <button onClick={handlePrev} style={{ padding:"4px 10px", borderRadius:6, border:"1px solid #e2e8f0", background:"#f8fafc", cursor:"pointer", fontSize:13 }}>◀</button>
              <span style={{ fontSize:14, fontWeight:700, color:"#1e293b", minWidth:160, textAlign:"center" }}>{headerTitle}</span>
              <button onClick={handleNext} style={{ padding:"4px 10px", borderRadius:6, border:"1px solid #e2e8f0", background:"#f8fafc", cursor:"pointer", fontSize:13 }}>▶</button>
            </div>
            {/* 오른쪽: 업무 수 */}
            <div style={{ flex:1, display:"flex", justifyContent:"flex-end" }}>
              <span style={{ fontSize:10, color:"#94a3b8" }}>{events.length}개 업무</span>
            </div>
          </div>

          {/* 마감일 미정 백로그 (방식 A+D) — 캘린더에서 누락된 노드를 숨기지 않고 노출 */}
          {noDateNodes.length > 0 && (
            <div style={{ flexShrink:0, borderBottom:"1px solid #fde68a", background:"#fffbeb" }}>
              <div
                onClick={() => setShowNoDate(v => !v)}
                style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 16px", cursor:"pointer", userSelect:"none" }}
              >
                <span style={{ fontSize:12 }}>📋</span>
                <span style={{ fontSize:11, fontWeight:700, color:"#b45309" }}>마감일 미정 {noDateNodes.length}건</span>
                <span style={{ fontSize:10, color:"#d97706" }}>· 캘린더에 표시되지 않음 (클릭하여 날짜 지정)</span>
                <span style={{ marginLeft:"auto", fontSize:10, color:"#d97706" }}>{showNoDate ? "▲ 접기" : "▼ 펼치기"}</span>
              </div>
              {showNoDate && (
                <div style={{ display:"flex", flexWrap:"wrap", gap:6, padding:"0 16px 10px" }}>
                  {noDateNodes.map(node => {
                    const proj = projData.find(p => p.id === node.projectId);
                    const sc = STATUS_COLOR[node.status] || "#94a3b8";
                    const assignees = (node.assignees||[]).map(id => humans.find(h=>h.id===id)).filter(Boolean);
                    return (
                      <button
                        key={node.id}
                        onClick={() => openNoDateNode(node)}
                        title="클릭하여 시작일/마감일 지정"
                        style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 10px", borderRadius:7, border:"1px solid #fcd34d", background:"#fff", cursor:"pointer", maxWidth:240 }}
                      >
                        <span style={{ width:6, height:6, borderRadius:"50%", background:sc, flexShrink:0 }} />
                        <span style={{ fontSize:11, fontWeight:600, color:"#1e293b", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{node.title}</span>
                        {proj && (
                          <span style={{ fontSize:8, color:"#6366f1", background:"#ede9fe", padding:"1px 5px", borderRadius:3, fontWeight:600, flexShrink:0 }}>{proj.title}</span>
                        )}
                        {assignees.slice(0,3).map(h => (
                          <span key={h.id} title={h.name} style={{ fontSize:11, lineHeight:1, flexShrink:0 }}>{h.avatar || "👤"}</span>
                        ))}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 연차 현황 (승인된 휴가 자동 집계) */}
          {leaveStatus.length > 0 && (
            <div style={{ flexShrink:0, borderBottom:"1px solid #e9d5ff", background:"#faf5ff" }}>
              <div onClick={() => setShowLeave(v => !v)} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 16px", cursor:"pointer", userSelect:"none" }}>
                <span style={{ fontSize:12 }}>📊</span>
                <span style={{ fontSize:11, fontWeight:700, color:"#7c3aed" }}>연차 현황</span>
                <span style={{ fontSize:10, color:"#a855f7" }}>· 승인된 휴가 자동 집계 (연 15일 기준)</span>
                <span style={{ marginLeft:"auto", fontSize:10, color:"#a855f7" }}>{showLeave ? "▲ 접기" : "▼ 펼치기"}</span>
              </div>
              {showLeave && (
                <div style={{ display:"flex", flexWrap:"wrap", gap:8, padding:"0 16px 10px" }}>
                  {leaveStatus.map(s => (
                    <div key={s.id} style={{ display:"flex", alignItems:"center", gap:7, padding:"5px 10px", borderRadius:8, border:"1px solid #e9d5ff", background:"#fff", minWidth:148 }}>
                      <span style={{ fontSize:13 }}>{s.avatar || "👤"}</span>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:11, fontWeight:700, color:"#1e293b", whiteSpace:"nowrap" }}>{s.name}</div>
                        <div style={{ fontSize:9.5, color:"#7c3aed" }}>사용 {s.used} · 잔여 <b>{s.remain}</b>/{s.allot}일</div>
                      </div>
                      <div style={{ marginLeft:"auto", width:34, height:5, background:"#f3e8ff", borderRadius:3, overflow:"hidden", flexShrink:0 }}><div style={{ height:"100%", width:Math.min(100,(s.used/s.allot)*100)+"%", background:"linear-gradient(90deg,#a855f7,#7c3aed)" }} /></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 캘린더 */}
          <div ref={calWrapRef} style={{ flex:1, overflow:"hidden", padding:"0 4px 4px" }}>
            <style>{`
              .rbc-calendar { font-family: system-ui,-apple-system,sans-serif; height:100%; }

              /* 날짜 헤더 행 */
              .rbc-header { padding:0 !important; display:flex !important; align-items:stretch !important; font-size:11px; font-weight:700; color:#64748b; background:#f8fafc; border-bottom:1px solid #e2e8f0; }
              .rbc-header .rbc-button-link { display:flex !important; width:100% !important; align-items:center !important; justify-content:center !important; }

              /* 타임그리드 슬롯 — startTime 있는 업무만 들어오므로 적당한 높이 */
              .rbc-timeslot-group { min-height:60px !important; }

              /* allDay 행 — JS가 줄 수에 맞춰 셀 height 지정 → 내부에서 flex로 균등 분배.
                 줄이 적으면 넉넉한 높이, 겹쳐서 많아지면 자동으로 얇아진다(반응형). */
              .rbc-allday-cell { background:#fff; overflow-y:auto !important; }
              .rbc-time-header-cell { overflow:visible !important; }
              .rbc-allday-cell .rbc-row-content { display:flex !important; flex-direction:column; gap:2px; height:100%; min-height:0 !important; }
              .rbc-allday-cell .rbc-row-content > .rbc-row { flex:1 1 0; min-height:0; }
              /* 겹쳐서 행이 좁아지면 부제목 숨기고 제목만 → 글자 욱여넣기 방지 */
              .rbc-allday-cell.cal-allday-dense .cal-ev-sub { display:none; }
              .rbc-allday-cell.cal-allday-dense .cal-ev-title { font-size:11.5px; }
              .rbc-allday-cell .rbc-row-segment { height:100%; }
              .rbc-allday-cell .rbc-event,
              .rbc-allday-cell .rbc-event-content { height:100% !important; }

              .rbc-time-header { overflow:visible; }
              .rbc-time-header-content { overflow:visible; }
              .rbc-time-header-row { position:relative; z-index:2; background:#f8fafc; }
              .rbc-time-header-row .rbc-header { background:#f8fafc; }
              .rbc-row { overflow:visible !important; }
              .rbc-today { background:#eff6ff !important; }
              .rbc-today .rbc-button-link { color:#3b82f6 !important; }
              .rbc-off-range-bg { background:#fafafa; }
              .rbc-event { padding:0 !important; border-radius:3px !important; border:none !important; }
              .rbc-event.rbc-selected { outline:2px solid #6366f1 !important; outline-offset:1px; }
              .rbc-time-slot { font-size:10px; }
              .rbc-time-gutter .rbc-label { font-size:10px; color:#94a3b8; padding-right:8px; }
              .rbc-day-slot .rbc-event { border:none !important; }
              .rbc-show-more { font-size:10px; color:#6366f1; font-weight:600; cursor:pointer; padding:1px 4px; }

              /* 월뷰 */
              .rbc-month-view .rbc-header { height:36px !important; text-align:center; }
              .rbc-month-row { overflow:hidden; min-height:90px; }
              .rbc-row-content { min-height:70px; }
              .rbc-event-content { font-size:10px !important; font-weight:700 !important; line-height:1.3 !important; height:100%; }
              .rbc-date-cell { font-size:11px; padding:2px 4px; }

              /* 월뷰 이벤트 줄을 셀 높이에 맞춰 분배: 적으면 넉넉(최대 46px), 겹치면 자동 축소(최소 18px) */
              .rbc-month-view .rbc-row-content-scroll-container { display:flex !important; flex-direction:column; gap:2px; overflow-y:auto; }
              .rbc-month-view .rbc-row-content-scroll-container > .rbc-row { flex:1 1 0; min-height:18px; max-height:46px; }
              .rbc-month-view .rbc-row-content-scroll-container .rbc-row-segment { height:100%; }
              .rbc-month-view .rbc-row-content-scroll-container .rbc-event { height:100% !important; }

              /* 토/일 배경 (월뷰 — 일=첫번째 열, 토=마지막 열) */
              .rbc-month-view .rbc-day-bg:first-child { background:#fff5f5; }
              .rbc-month-view .rbc-day-bg:last-child  { background:#fff5f5; }
              /* 주/일뷰 토/일 헤더 색상은 DayColumnHeader 컴포넌트에서 처리 */
              .rbc-day-slot.rbc-time-column:first-child { background:#fff5f5; }
              .rbc-day-slot.rbc-time-column:last-child  { background:#fff5f5; }

              .rbc-time-header-gutter { background:#f8fafc; }
              .rbc-slot-selection { background:#ede9fe44 !important; border:1px solid #6366f1 !important; }
            `}</style>
            <Calendar
              localizer={localizer}
              events={events}
              view={view}
              onView={setView}
              date={currentDate}
              onNavigate={setCurrentDate}
              onSelectEvent={handleSelectEvent}
              onSelectSlot={handleSelectSlot}
              selectable={true}
              eventPropGetter={() => ({ style:{ background:"transparent", border:"none", padding:0 } })}
              components={{
                toolbar: EmptyToolbar,
                event:   (props) => <EventCard {...props} view={view} />,
                header:  DayColumnHeader,
                month: {
                  dateHeader: MonthDateHeader,
                },
              }}
              formats={{
                dayFormat:       (date) => `${date.getMonth()+1}/${date.getDate()}(${DAYS_KO[date.getDay()]})`,
                dayHeaderFormat: (date) => `${date.getFullYear()}년 ${date.getMonth()+1}월 ${date.getDate()}일(${DAYS_KO[date.getDay()]})`,
                weekdayFormat:   (date) => DAYS_KO[date.getDay()],
                monthHeaderFormat: (date) => `${date.getFullYear()}년 ${date.getMonth()+1}월`,
                agendaDateFormat: (date) => `${date.getMonth()+1}/${date.getDate()}(${DAYS_KO[date.getDay()]})`,
              }}
              culture="ko"
              style={{ height:"100%" }}
              showAllEvents
              scrollToTime={new Date(1970, 1, 1, 8, 0, 0)}
              popup
              messages={{
                allDay:"종일", previous:"◀", next:"▶", today:"오늘", month:"월", week:"주", day:"일",
                agenda:"일정", date:"날짜", time:"시간", event:"업무", noEventsInRange:"이 기간에 업무가 없습니다.",
                showMore: total => `+${total}개`,
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
