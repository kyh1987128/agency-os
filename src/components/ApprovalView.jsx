import { useState, useEffect, Fragment } from "react";

// ════════════════════════════════════════════════════════════════════════════
// 전자결재 — 기안 → 결재선(다단계) → 승인/반려 + 참조 + 문서함 + 템플릿
// (1차: 클라이언트 영속화 localStorage. 서버 영속화는 추후 이관)
// ════════════════════════════════════════════════════════════════════════════

const LS_DOCS = "approvalDocs";
const LS_ME = "approvalMe";

// 기안 종류(템플릿) — 분류 / 필드 / 본문 양식
const DOC_TYPES = [
  { key: "vacation", label: "휴가 신청서", icon: "🏖", color: "#0ea5e9", group: "근태",
    fields: [{ k: "kind", label: "휴가 종류", type: "select", opts: ["연차", "반차(오전)", "반차(오후)", "병가", "경조"] }, { k: "from", label: "시작일", type: "date" }, { k: "to", label: "종료일", type: "date" }, { k: "reason", label: "사유", type: "text" }, { k: "handover", label: "업무 인수인계", type: "area" }] },
  { key: "leave_early", label: "조퇴·외출 신청", icon: "🚪", color: "#0ea5e9", group: "근태",
    fields: [{ k: "kind", label: "구분", type: "select", opts: ["조퇴", "외출", "지각"] }, { k: "date", label: "일자", type: "date" }, { k: "time", label: "시간", type: "text" }, { k: "reason", label: "사유", type: "text" }] },
  { key: "trip", label: "출장 신청서", icon: "✈️", color: "#0ea5e9", group: "근태",
    fields: [{ k: "place", label: "출장지", type: "text" }, { k: "from", label: "시작일", type: "date" }, { k: "to", label: "종료일", type: "date" }, { k: "purpose", label: "목적", type: "area" }, { k: "cost", label: "예상 경비", type: "text" }] },
  { key: "overtime", label: "시간외근무 신청", icon: "🌙", color: "#0ea5e9", group: "근태",
    fields: [{ k: "date", label: "일자", type: "date" }, { k: "time", label: "예상 시간", type: "text" }, { k: "reason", label: "사유", type: "area" }] },
  { key: "expense", label: "지출결의서", icon: "💳", color: "#16a34a", group: "재무",
    fields: [{ k: "item", label: "항목", type: "text" }, { k: "amount", label: "금액(원)", type: "text" }, { k: "date", label: "지출일", type: "date" }, { k: "method", label: "결제수단", type: "select", opts: ["법인카드", "개인카드(환급)", "계좌이체", "현금"] }, { k: "detail", label: "내역", type: "area" }] },
  { key: "purchase", label: "구매 품의서", icon: "🛒", color: "#16a34a", group: "재무",
    fields: [{ k: "item", label: "품목", type: "text" }, { k: "qty", label: "수량", type: "text" }, { k: "amount", label: "예상 금액(원)", type: "text" }, { k: "vendor", label: "구매처", type: "text" }, { k: "reason", label: "필요 사유", type: "area" }] },
  { key: "event_money", label: "경조사비 신청", icon: "🎗", color: "#16a34a", group: "재무",
    fields: [{ k: "kind", label: "경조 구분", type: "select", opts: ["결혼", "출산", "조사", "기타"] }, { k: "target", label: "대상", type: "text" }, { k: "date", label: "일자", type: "date" }, { k: "amount", label: "금액(원)", type: "text" }] },
  { key: "coop", label: "업무협조전", icon: "🤝", color: "#6366f1", group: "일반",
    fields: [{ k: "to", label: "협조 대상(부서/담당)", type: "text" }, { k: "due", label: "희망 기한", type: "date" }, { k: "content", label: "협조 요청 내용", type: "area" }] },
  { key: "report_doc", label: "사유서·경위서", icon: "📝", color: "#6366f1", group: "일반",
    fields: [{ k: "kind", label: "구분", type: "select", opts: ["사유서", "경위서", "시말서"] }, { k: "subject", label: "제목", type: "text" }, { k: "content", label: "내용", type: "area" }] },
  { key: "general", label: "일반 기안", icon: "🗂", color: "#6366f1", group: "일반",
    fields: [{ k: "content", label: "기안 내용", type: "area" }] },
];
const typeOf = (k) => DOC_TYPES.find((t) => t.key === k) || DOC_TYPES[DOC_TYPES.length - 1];

const STATUS = {
  draft:    { label: "임시저장", color: "#94a3b8", bg: "#f1f5f9" },
  pending:  { label: "진행중",   color: "#d97706", bg: "#fef3c7" },
  approved: { label: "승인",     color: "#16a34a", bg: "#dcfce7" },
  rejected: { label: "반려",     color: "#dc2626", bg: "#fee2e2" },
};

const loadDocs = () => { try { return JSON.parse(localStorage.getItem(LS_DOCS) || "[]"); } catch { return []; } };
const saveDocs = (d) => localStorage.setItem(LS_DOCS, JSON.stringify(d));

const btn = (c) => ({ border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", background: c, color: "#fff" });
const gbtn = { border: "1px solid #e2e8f0", background: "#fff", color: "#475569", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" };
const inp = { width: "100%", boxSizing: "border-box", border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 11px", fontSize: 13, outline: "none", color: "#1e293b" };

export default function ApprovalView({ humans = [] }) {
  const [docs, setDocs] = useState(loadDocs);
  const [me, setMe] = useState(() => localStorage.getItem(LS_ME) || "");
  const [box, setBox] = useState("inbox"); // inbox | sent | cc | done | draft
  const [selId, setSelId] = useState(null);
  const [composing, setComposing] = useState(false);

  useEffect(() => { saveDocs(docs); }, [docs]);
  useEffect(() => { if (!me && humans.length) { setMe(humans[0].id); } }, [humans]);
  useEffect(() => { if (me) localStorage.setItem(LS_ME, me); }, [me]);
  const meName = (humans.find((h) => h.id === me) || {}).name || "나";

  // 문서함 분류
  const myInbox = docs.filter((d) => d.status === "pending" && d.approvers[d.curStep]?.id === me); // 내가 결재할 차례
  const mySent = docs.filter((d) => d.drafterId === me && d.status !== "draft");
  const myCc = docs.filter((d) => (d.ccIds || []).includes(me) && d.status !== "draft");
  const myDone = docs.filter((d) => d.approvers.some((a) => a.id === me && a.status !== "pending"));
  const myDraft = docs.filter((d) => d.drafterId === me && d.status === "draft");
  const BOXES = [
    ["inbox", "📥 결재할 문서", myInbox.length, "#d97706"],
    ["sent", "📤 상신함", mySent.length, "#6366f1"],
    ["cc", "👁 참조 문서", myCc.length, "#0ea5e9"],
    ["done", "✅ 결재 완료", myDone.length, "#16a34a"],
    ["draft", "📝 임시저장", myDraft.length, "#94a3b8"],
  ];
  const boxDocs = { inbox: myInbox, sent: mySent, cc: myCc, done: myDone, draft: myDraft }[box] || [];
  const sel = docs.find((d) => d.id === selId) || null;

  const upsert = (doc) => setDocs((p) => { const i = p.findIndex((d) => d.id === doc.id); return i < 0 ? [doc, ...p] : p.map((d) => (d.id === doc.id ? doc : d)); });

  // 결재 처리
  const act = (doc, decision, comment) => {
    const approvers = doc.approvers.map((a, i) => i === doc.curStep ? { ...a, status: decision, comment: comment || "", actedAt: new Date().toISOString() } : a);
    let status = doc.status, curStep = doc.curStep;
    if (decision === "rejected") status = "rejected";
    else { if (doc.curStep >= approvers.length - 1) status = "approved"; else curStep = doc.curStep + 1; }
    upsert({ ...doc, approvers, status, curStep });
  };
  const recall = (doc) => upsert({ ...doc, status: "draft", curStep: 0, approvers: doc.approvers.map((a) => ({ ...a, status: "pending", comment: "", actedAt: null })) });

  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0, background: "#f1f5f9" }}>
      {/* 좌측: 문서함 */}
      <div style={{ width: 210, flexShrink: 0, background: "#fff", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0" }}>
          <button onClick={() => { setComposing(true); setSelId(null); }} style={{ ...btn("#6366f1"), width: "100%" }}>+ 기안 작성</button>
          <div style={{ marginTop: 10, fontSize: 10, color: "#94a3b8", fontWeight: 700 }}>현재 사용자</div>
          <select value={me} onChange={(e) => { setMe(e.target.value); setSelId(null); }} style={{ ...inp, padding: "6px 8px", fontSize: 12, marginTop: 3 }}>
            {humans.map((h) => <option key={h.id} value={h.id}>{h.avatar ? h.avatar + " " : ""}{h.name}{h.dept ? ` · ${h.dept}` : ""}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px" }}>
          {BOXES.map(([k, l, n, c]) => (
            <div key={k} onClick={() => { setBox(k); setSelId(null); setComposing(false); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 8, cursor: "pointer", marginBottom: 2, background: box === k && !composing ? "#eef2ff" : "transparent" }}>
              <span style={{ fontSize: 12.5, fontWeight: box === k ? 700 : 500, color: box === k && !composing ? "#4338ca" : "#475569", flex: 1 }}>{l}</span>
              {n > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: c, borderRadius: 10, padding: "1px 7px", minWidth: 14, textAlign: "center" }}>{n}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* 우측: 작성 / 상세 / 목록 */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {composing ? (
          <Compose humans={humans} me={me} meName={meName} onCancel={() => setComposing(false)}
            onSubmit={(doc) => { upsert(doc); setComposing(false); setBox(doc.status === "draft" ? "draft" : "sent"); setSelId(doc.id); }} />
        ) : sel ? (
          <Detail doc={sel} me={me} humans={humans} onBack={() => setSelId(null)} onAct={act} onRecall={recall}
            onDelete={(id) => { setDocs((p) => p.filter((d) => d.id !== id)); setSelId(null); }} />
        ) : (
          <DocList title={BOXES.find((b) => b[0] === box)[1]} docs={boxDocs} humans={humans} me={me} box={box} onOpen={setSelId} />
        )}
      </div>
    </div>
  );
}

// ── 목록 ──────────────────────────────────────────────────────────────────────
function DocList({ title, docs, humans, me, box, onOpen }) {
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px 22px 30px" }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: "#1e293b", marginBottom: 12 }}>{title} <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>· {docs.length}건</span></div>
      {docs.length === 0 && <div style={{ color: "#cbd5e1", fontSize: 13, padding: 40, textAlign: "center" }}>문서가 없습니다.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 820 }}>
        {docs.map((d) => { const t = typeOf(d.type); const st = STATUS[d.status]; const cur = d.approvers[d.curStep];
          return (
            <div key={d.id} onClick={() => onOpen(d.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "1px solid #e2e8f0", borderRadius: 10, cursor: "pointer", background: "#fff" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.color + "66"; e.currentTarget.style.background = t.color + "08"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.background = "#fff"; }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{t.icon}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{t.label} · 기안 {d.drafterName} · {new Date(d.createdAt).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })}
                  {d.status === "pending" && cur && <span style={{ color: "#d97706" }}> · 현재 결재: {cur.name}</span>}</div>
              </div>
              <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 700, color: st.color, background: st.bg, padding: "3px 9px", borderRadius: 8 }}>{st.label}{d.status === "pending" ? ` ${d.curStep + 1}/${d.approvers.length}` : ""}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 상세 + 결재 처리 ────────────────────────────────────────────────────────────
function Detail({ doc, me, humans, onBack, onAct, onRecall, onDelete }) {
  const t = typeOf(doc.type); const st = STATUS[doc.status];
  const [comment, setComment] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const isMyTurn = doc.status === "pending" && doc.approvers[doc.curStep]?.id === me;
  const isDrafter = doc.drafterId === me;
  return (
    <div style={{ flex: 1, overflowY: "auto", background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 22px", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, background: "#fff", zIndex: 1, flexWrap: "wrap" }}>
        <button onClick={onBack} style={gbtn}>← 목록</button>
        <span style={{ fontSize: 19 }}>{t.icon}</span>
        <span style={{ fontSize: 16, fontWeight: 800, color: "#1e293b" }}>{doc.title}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: st.color, background: st.bg, padding: "3px 10px", borderRadius: 8 }}>{st.label}</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {isDrafter && doc.status === "pending" && <button onClick={() => onRecall(doc)} style={gbtn}>↩ 회수</button>}
          {isDrafter && (doc.status === "draft" || doc.status === "rejected") && (confirmDel
            ? <button onClick={() => onDelete(doc.id)} style={{ ...gbtn, color: "#fff", background: "#dc2626", border: "none" }}>삭제확인</button>
            : <button onClick={() => setConfirmDel(true)} style={{ ...gbtn, color: "#dc2626" }}>🗑</button>)}
        </span>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "20px 26px 50px" }}>
        {/* 결재선 진행 */}
        <div style={{ display: "flex", alignItems: "stretch", gap: 0, flexWrap: "wrap", marginBottom: 22 }}>
          <Stamp label="기안" name={doc.drafterName} state="approved" sub={new Date(doc.createdAt).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })} />
          {doc.approvers.map((a, i) => (
            <Fragment key={i}>
              <Arrow on={a.status === "approved"} />
              <Stamp label={a.role || `결재 ${i + 1}`} name={a.name}
                state={a.status === "pending" ? (doc.status === "pending" && i === doc.curStep ? "current" : "wait") : a.status}
                sub={a.actedAt ? new Date(a.actedAt).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" }) : ""} />
            </Fragment>
          ))}
        </div>
        {(doc.ccIds || []).length > 0 && (
          <div style={{ fontSize: 11.5, color: "#64748b", marginBottom: 18 }}>👁 참조: {doc.ccIds.map((id) => (humans.find((h) => h.id === id) || {}).name || id).join(", ")}</div>
        )}

        {/* 본문 필드 */}
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", marginBottom: 18 }}>
          <div style={{ background: "#f8fafc", padding: "10px 16px", fontSize: 12, fontWeight: 700, color: "#475569", borderBottom: "1px solid #e2e8f0" }}>{t.label}</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              {t.fields.map((f) => (
                <tr key={f.k}>
                  <td style={{ background: "#fafbfd", borderBottom: "1px solid #f1f5f9", borderRight: "1px solid #f1f5f9", padding: "9px 14px", fontWeight: 600, color: "#64748b", width: 140, verticalAlign: "top" }}>{f.label}</td>
                  <td style={{ borderBottom: "1px solid #f1f5f9", padding: "9px 14px", color: "#1e293b", whiteSpace: "pre-wrap" }}>{doc.fields[f.k] || <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 결재 의견 이력 */}
        {doc.approvers.some((a) => a.comment) && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>💬 결재 의견</div>
            {doc.approvers.filter((a) => a.comment).map((a, i) => (
              <div key={i} style={{ fontSize: 12.5, color: "#334155", padding: "6px 0", borderBottom: "1px solid #f8fafc" }}><b>{a.name}</b> <span style={{ color: a.status === "rejected" ? "#dc2626" : "#16a34a" }}>({STATUS[a.status]?.label})</span> — {a.comment}</div>
            ))}
          </div>
        )}

        {/* 내가 결재할 차례 → 승인/반려 */}
        {isMyTurn && (
          <div style={{ border: "1px solid #c7d2fe", background: "#eef2ff", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#4338ca", marginBottom: 8 }}>⚖️ 내 결재 차례입니다</div>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="결재 의견 (선택, 반려 시 사유 권장)" style={{ ...inp, minHeight: 60, resize: "vertical", marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => onAct(doc, "approved", comment)} style={btn("#16a34a")}>✓ 승인</button>
              <button onClick={() => onAct(doc, "rejected", comment)} style={btn("#dc2626")}>✕ 반려</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stamp({ label, name, state, sub }) {
  const c = state === "approved" ? { b: "#16a34a", bg: "#f0fdf4", t: "#16a34a", mark: "승인" }
    : state === "rejected" ? { b: "#dc2626", bg: "#fef2f2", t: "#dc2626", mark: "반려" }
    : state === "current" ? { b: "#6366f1", bg: "#eef2ff", t: "#4338ca", mark: "결재 대기" }
    : { b: "#e2e8f0", bg: "#fff", t: "#94a3b8", mark: "대기" };
  return (
    <div style={{ width: 110, border: `1.5px solid ${c.b}`, background: c.bg, borderRadius: 10, padding: "8px 6px", textAlign: "center" }}>
      <div style={{ fontSize: 9.5, color: "#94a3b8", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: "#1e293b", margin: "2px 0" }}>{name}</div>
      <div style={{ fontSize: 9.5, fontWeight: 800, color: c.t }}>{c.mark}</div>
      {sub && <div style={{ fontSize: 8.5, color: "#cbd5e1", marginTop: 1 }}>{sub}</div>}
    </div>
  );
}
function Arrow({ on }) {
  return <div style={{ alignSelf: "center", color: on ? "#16a34a" : "#cbd5e1", fontSize: 16, padding: "0 4px" }}>▶</div>;
}

// ── 기안 작성 ───────────────────────────────────────────────────────────────────
function Compose({ humans, me, meName, onCancel, onSubmit }) {
  const [typeKey, setTypeKey] = useState(DOC_TYPES[0].key);
  const t = typeOf(typeKey);
  const [title, setTitle] = useState("");
  const [fields, setFields] = useState({});
  const [approvers, setApprovers] = useState([]); // [{id,name,role}]
  const [ccIds, setCcIds] = useState([]);
  const others = humans.filter((h) => h.id !== me);
  const setF = (k, v) => setFields((p) => ({ ...p, [k]: v }));
  const addApprover = (id) => { const h = humans.find((x) => x.id === id); if (h && !approvers.some((a) => a.id === id)) setApprovers((p) => [...p, { id, name: h.name, role: "" }]); };
  const moveAppr = (i, dir) => setApprovers((p) => { const n = [...p]; const j = i + dir; if (j < 0 || j >= n.length) return p; [n[i], n[j]] = [n[j], n[i]]; return n; });

  const build = (status) => {
    const t2 = typeOf(typeKey);
    return {
      id: "ap" + Date.now().toString(36), type: typeKey, title: title.trim() || t2.label,
      fields, drafterId: me, drafterName: meName,
      approvers: approvers.map((a, i) => ({ ...a, role: a.role || `결재 ${i + 1}`, status: "pending", comment: "", actedAt: null })),
      ccIds, status: status === "submit" ? "pending" : "draft", curStep: 0,
      createdAt: new Date().toISOString(),
    };
  };
  const canSubmit = approvers.length > 0;

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 22px", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: "#1e293b" }}>🖋 새 기안</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={() => onSubmit(build("draft"))} style={gbtn}>임시저장</button>
          <button onClick={() => canSubmit && onSubmit(build("submit"))} disabled={!canSubmit} style={{ ...btn(canSubmit ? "#6366f1" : "#cbd5e1"), cursor: canSubmit ? "pointer" : "not-allowed" }}>상신</button>
          <button onClick={onCancel} style={gbtn}>취소</button>
        </span>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 26px 50px" }}>
        {/* 종류 */}
        <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 6 }}>기안 종류</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {DOC_TYPES.map((dt) => (
            <button key={dt.key} onClick={() => { setTypeKey(dt.key); setFields({}); }} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 16, fontSize: 12, cursor: "pointer", fontWeight: 600, border: "1px solid " + (typeKey === dt.key ? dt.color : "#e2e8f0"), background: typeKey === dt.key ? dt.color + "15" : "#fff", color: typeKey === dt.key ? dt.color : "#64748b" }}>{dt.icon} {dt.label}</button>
          ))}
        </div>

        {/* 제목 */}
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`제목 (비우면 "${t.label}")`} style={{ ...inp, marginBottom: 16, fontSize: 14, fontWeight: 600 }} />

        {/* 필드 (템플릿) */}
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, marginBottom: 18 }}>
          {t.fields.map((f) => (
            <div key={f.k} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "#475569", marginBottom: 4 }}>{f.label}</div>
              {f.type === "select" ? (
                <select value={fields[f.k] || ""} onChange={(e) => setF(f.k, e.target.value)} style={inp}>
                  <option value="">선택</option>{f.opts.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === "area" ? (
                <textarea value={fields[f.k] || ""} onChange={(e) => setF(f.k, e.target.value)} style={{ ...inp, minHeight: 70, resize: "vertical" }} />
              ) : (
                <input type={f.type === "date" ? "date" : "text"} value={fields[f.k] || ""} onChange={(e) => setF(f.k, e.target.value)} style={inp} />
              )}
            </div>
          ))}
        </div>

        {/* 결재선 */}
        <div style={{ fontSize: 12, fontWeight: 800, color: "#1e293b", marginBottom: 8 }}>결재선 <span style={{ fontSize: 10.5, color: "#94a3b8", fontWeight: 500 }}>· 위에서 아래 순서로 결재</span></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
          {approvers.map((a, i) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #e2e8f0", borderRadius: 9, padding: "7px 10px" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", background: "#eef2ff", borderRadius: 6, padding: "2px 7px" }}>{i + 1}단계</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", flex: 1 }}>{a.name}</span>
              <input value={a.role} onChange={(e) => setApprovers((p) => p.map((x, j) => j === i ? { ...x, role: e.target.value } : x))} placeholder="직책(예: 팀장)" style={{ ...inp, width: 120, padding: "5px 8px", fontSize: 11.5 }} />
              <button onClick={() => moveAppr(i, -1)} style={{ ...gbtn, padding: "3px 7px" }}>▲</button>
              <button onClick={() => moveAppr(i, 1)} style={{ ...gbtn, padding: "3px 7px" }}>▼</button>
              <button onClick={() => setApprovers((p) => p.filter((_, j) => j !== i))} style={{ ...gbtn, padding: "3px 7px", color: "#dc2626" }}>✕</button>
            </div>
          ))}
          {approvers.length === 0 && <div style={{ fontSize: 11.5, color: "#cbd5e1", padding: "6px 2px" }}>결재자를 1명 이상 추가하세요.</div>}
        </div>
        <select value="" onChange={(e) => e.target.value && addApprover(e.target.value)} style={{ ...inp, marginBottom: 18 }}>
          <option value="">+ 결재자 추가</option>
          {others.map((h) => <option key={h.id} value={h.id}>{h.name}{h.dept ? ` · ${h.dept}` : ""}</option>)}
        </select>

        {/* 참조 */}
        <div style={{ fontSize: 12, fontWeight: 800, color: "#1e293b", marginBottom: 8 }}>참조 <span style={{ fontSize: 10.5, color: "#94a3b8", fontWeight: 500 }}>· 열람만 (결재권 없음)</span></div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {others.map((h) => { const on = ccIds.includes(h.id);
            return <button key={h.id} onClick={() => setCcIds((p) => on ? p.filter((x) => x !== h.id) : [...p, h.id])} style={{ padding: "5px 11px", borderRadius: 14, fontSize: 12, cursor: "pointer", fontWeight: 600, border: "1px solid " + (on ? "#0ea5e9" : "#e2e8f0"), background: on ? "#e0f2fe" : "#fff", color: on ? "#0369a1" : "#64748b" }}>{on ? "✓ " : ""}{h.name}</button>;
          })}
        </div>
      </div>
    </div>
  );
}
