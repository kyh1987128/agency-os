import { useState, useEffect, Fragment } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { DOC_TYPES, DOC_GROUPS, typeOf, COMPANY } from "../data/approvalTemplates";

// ════════════════════════════════════════════════════════════════════════════
// 전자결재 — 3패널(문서함 | 양식·문서목록 | 작성·상세) + 실제 문서 미리보기
//   작성: 좌 입력폼 + 우 실시간 ApprovalDocument 미리보기
//   상세: ApprovalDocument(미리보기와 동일 렌더) + 결재선 도장 + 승인/반려
//   1차: localStorage 영속(approvalDocs). 서버 영속은 추후.
// ════════════════════════════════════════════════════════════════════════════

const LS_DOCS = "approvalDocs";
const LS_ME = "approvalMe";

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
const fmtD = (s) => s ? new Date(s).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }) : "";

export default function ApprovalView({ humans = [] }) {
  const [docs, setDocs] = useState(loadDocs);
  const [me, setMe] = useState(() => localStorage.getItem(LS_ME) || "");
  const [box, setBox] = useState("inbox");
  const [selId, setSelId] = useState(null);
  const [view, setView] = useState("browse");        // browse | compose | help
  const [composeType, setComposeType] = useState(DOC_TYPES[0].key);

  useEffect(() => { saveDocs(docs); }, [docs]);
  useEffect(() => { if (!me && humans.length) setMe(humans[0].id); }, [humans]);
  useEffect(() => { if (me) localStorage.setItem(LS_ME, me); }, [me]);
  const meName = (humans.find((h) => h.id === me) || {}).name || "나";
  const meDept = (humans.find((h) => h.id === me) || {}).dept || "";

  // 문서함 분류
  const myInbox = docs.filter((d) => d.status === "pending" && d.approvers[d.curStep]?.id === me);
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
  const act = (doc, decision, comment) => {
    const approvers = doc.approvers.map((a, i) => i === doc.curStep ? { ...a, status: decision, comment: comment || "", actedAt: new Date().toISOString() } : a);
    let status = doc.status, curStep = doc.curStep;
    if (decision === "rejected") status = "rejected";
    else { if (doc.curStep >= approvers.length - 1) status = "approved"; else curStep = doc.curStep + 1; }
    upsert({ ...doc, approvers, status, curStep });
  };
  const recall = (doc) => upsert({ ...doc, status: "draft", curStep: 0, approvers: doc.approvers.map((a) => ({ ...a, status: "pending", comment: "", actedAt: null })) });

  const openBox = (k) => { setBox(k); setSelId(null); setView("browse"); };
  const startCompose = () => { setView("compose"); setSelId(null); };

  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0, background: "#eef1f5" }}>
      {/* ── L: 문서함 ── */}
      <div className="no-print" style={{ width: 186, flexShrink: 0, background: "#fff", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ padding: "12px 12px 10px", borderBottom: "1px solid #e2e8f0" }}>
          <button onClick={startCompose} style={{ ...btn("#6366f1"), width: "100%" }}>+ 기안 작성</button>
          <div style={{ marginTop: 10, fontSize: 9.5, color: "#94a3b8", fontWeight: 700 }}>현재 사용자</div>
          <select value={me} onChange={(e) => { setMe(e.target.value); setSelId(null); }} style={{ ...inp, padding: "6px 8px", fontSize: 12, marginTop: 3 }}>
            {humans.map((h) => <option key={h.id} value={h.id}>{h.avatar ? h.avatar + " " : ""}{h.name}{h.dept ? ` · ${h.dept}` : ""}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px" }}>
          {BOXES.map(([k, l, n, c]) => {
            const on = box === k && view === "browse";
            return (
              <div key={k} onClick={() => openBox(k)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 8, cursor: "pointer", marginBottom: 2, background: on ? "#eef2ff" : "transparent" }}>
                <span style={{ fontSize: 12.5, fontWeight: on ? 700 : 500, color: on ? "#4338ca" : "#475569", flex: 1 }}>{l}</span>
                {n > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: c, borderRadius: 10, padding: "1px 7px", minWidth: 14, textAlign: "center" }}>{n}</span>}
              </div>
            );
          })}
          <div onClick={() => { setView("help"); setSelId(null); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 8, cursor: "pointer", marginTop: 8, borderTop: "1px solid #f1f5f9", background: view === "help" ? "#eef2ff" : "transparent" }}>
            <span style={{ fontSize: 12.5, fontWeight: view === "help" ? 700 : 500, color: view === "help" ? "#4338ca" : "#64748b", flex: 1 }}>📖 사용법·양식 안내</span>
          </div>
        </div>
      </div>

      {/* ── M: 양식 갤러리(작성) / 문서 목록(열람) ── */}
      {view !== "help" && (
        <div className="no-print" style={{ width: 258, flexShrink: 0, background: "#fbfcfe", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", minHeight: 0 }}>
          {view === "compose"
            ? <TemplateGallery sel={composeType} onPick={setComposeType} />
            : <DocListPanel title={BOXES.find((b) => b[0] === box)[1]} docs={boxDocs} selId={selId} onOpen={setSelId} />}
        </div>
      )}

      {/* ── R: 작성 / 상세 / 사용법 ── */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {view === "help" ? (
          <HelpView onClose={() => setView("browse")} onCompose={startCompose} />
        ) : view === "compose" ? (
          <ComposePane key={composeType} typeKey={composeType} humans={humans} me={me} meName={meName} meDept={meDept}
            onCancel={() => setView("browse")}
            onSubmit={(doc) => { upsert(doc); setView("browse"); setBox(doc.status === "draft" ? "draft" : "sent"); setSelId(doc.id); }} />
        ) : sel ? (
          <DetailPane doc={sel} me={me} humans={humans} onBack={() => setSelId(null)} onAct={act} onRecall={recall}
            onDelete={(id) => { setDocs((p) => p.filter((d) => d.id !== id)); setSelId(null); }} />
        ) : (
          <EmptyR onCompose={startCompose} />
        )}
      </div>
    </div>
  );
}

// ── M: 양식 갤러리 (작성) ────────────────────────────────────────────────────────
function TemplateGallery({ sel, onPick }) {
  return (
    <>
      <div style={{ padding: "11px 14px", borderBottom: "1px solid #e2e8f0", fontSize: 12, fontWeight: 800, color: "#1e293b" }}>📁 양식 선택 <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 500 }}>· {DOC_TYPES.length}종</span></div>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px 20px" }}>
        {DOC_GROUPS.map((g) => (
          <div key={g} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", letterSpacing: 0.6, padding: "5px 8px 3px" }}>{g}</div>
            {DOC_TYPES.filter((dt) => dt.group === g).map((dt) => {
              const on = sel === dt.key;
              return (
                <div key={dt.key} onClick={() => onPick(dt.key)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 9px", borderRadius: 8, cursor: "pointer", marginBottom: 1, background: on ? dt.color + "16" : "transparent", border: "1px solid " + (on ? dt.color + "55" : "transparent") }}>
                  <span style={{ fontSize: 15, flexShrink: 0 }}>{dt.icon}</span>
                  <span style={{ fontSize: 12.5, fontWeight: on ? 800 : 600, color: on ? dt.color : "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dt.label}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}

// ── M: 문서 목록 (열람) ──────────────────────────────────────────────────────────
function DocListPanel({ title, docs, selId, onOpen }) {
  return (
    <>
      <div style={{ padding: "11px 14px", borderBottom: "1px solid #e2e8f0", fontSize: 12, fontWeight: 800, color: "#1e293b" }}>{title} <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 500 }}>· {docs.length}</span></div>
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 6px 20px" }}>
        {docs.length === 0 && <div style={{ color: "#cbd5e1", fontSize: 12, padding: "40px 10px", textAlign: "center" }}>문서가 없습니다.</div>}
        {docs.map((d) => { const t = typeOf(d.type); const st = STATUS[d.status]; const cur = d.approvers[d.curStep]; const on = selId === d.id;
          return (
            <div key={d.id} onClick={() => onOpen(d.id)} style={{ display: "flex", gap: 9, padding: "9px 10px", borderRadius: 9, cursor: "pointer", marginBottom: 2, background: on ? "#eef2ff" : "transparent", border: "1px solid " + (on ? "#c7d2fe" : "transparent") }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{t.icon}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.drafterName} · {new Date(d.createdAt).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })}
                  {d.status === "pending" && cur && <span style={{ color: "#d97706" }}> · {cur.name} 차례</span>}</div>
              </div>
              <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 700, color: st.color, background: st.bg, padding: "2px 7px", borderRadius: 8, height: "fit-content" }}>{st.label}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function EmptyR({ onCompose }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#94a3b8", gap: 10, background: "#eef1f5" }}>
      <div style={{ fontSize: 38 }}>🖋</div>
      <div style={{ fontSize: 13 }}>왼쪽에서 문서를 선택하거나</div>
      <button onClick={onCompose} style={btn("#6366f1")}>+ 기안 작성</button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 공유: 실제 문서 렌더 (작성 미리보기 = 열람 상세 동일)
// ════════════════════════════════════════════════════════════════════════════
const mdComps = {
  h3: (p) => <h3 style={{ textAlign: "center", fontSize: 17, fontWeight: 800, letterSpacing: 4, margin: "4px 0 16px", color: "#0f172a" }} {...p} />,
  p: (p) => <p style={{ fontSize: 13, lineHeight: 1.85, color: "#1f2937", margin: "9px 0" }} {...p} />,
  strong: (p) => <strong style={{ fontWeight: 700, color: "#0f172a" }} {...p} />,
  ul: (p) => <ul style={{ fontSize: 13, lineHeight: 1.9, color: "#1f2937", paddingLeft: 20, margin: "8px 0" }} {...p} />,
  li: (p) => <li style={{ margin: "2px 0" }} {...p} />,
  blockquote: (p) => <blockquote style={{ borderLeft: "3px solid #cbd5e1", margin: "12px 0", padding: "4px 14px", color: "#64748b", fontSize: 12, background: "#f8fafc" }} {...p} />,
  table: (p) => <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, margin: "10px 0" }} {...p} />,
  th: (p) => <th style={{ border: "1px solid #e2e8f0", background: "#f8fafc", padding: "7px 10px", textAlign: "left", color: "#475569" }} {...p} />,
  td: (p) => <td style={{ border: "1px solid #e2e8f0", padding: "7px 10px", color: "#1f2937" }} {...p} />,
};

function ApprovalDocument({ doc, humans }) {
  const t = typeOf(doc.type);
  const v = doc.fields || {};
  const dept = (humans.find((h) => h.id === doc.drafterId) || {}).dept || "";
  const bodyMd = t.body ? t.body(v) : "";
  const signers = t.signers ? t.signers(v) : null;
  const showFields = t.docKind === "form" && (t.fields || []).length > 0;
  const docNo = "CID-" + new Date(doc.createdAt || Date.now()).getFullYear() + "-" + String(doc.id || "").toUpperCase().slice(0, 6);
  return (
    <div className="approval-doc" style={{ background: "#fff", width: "100%", maxWidth: 760, margin: "0 auto", padding: "34px 40px 44px", boxShadow: "0 2px 16px #0000000f", border: "1px solid #e8ecf2" }}>
      {/* 머리글 */}
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: 2 }}>{COMPANY}</div>
        <h1 style={{ fontSize: 23, fontWeight: 800, color: "#0f172a", margin: "6px 0 0", letterSpacing: 1 }}>{doc.title || t.label}</h1>
      </div>

      {/* 기안정보 + 결재란 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 11.5 }}>
          <tbody>
            {[["문서번호", docNo], ["기 안 자", `${doc.drafterName}${dept ? ` (${dept})` : ""}`], ["기 안 일", fmtD(doc.createdAt)], ["시 행 일", fmtD(doc.createdAt)]].map(([k, val]) => (
              <tr key={k}>
                <td style={{ border: "1px solid #e2e8f0", background: "#f8fafc", padding: "5px 11px", color: "#64748b", fontWeight: 600, whiteSpace: "nowrap" }}>{k}</td>
                <td style={{ border: "1px solid #e2e8f0", padding: "5px 13px", color: "#1f2937", whiteSpace: "nowrap" }}>{val}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* 결재란 */}
        <div style={{ display: "flex", gap: 0, border: "1px solid #cbd5e1", borderRadius: 2 }}>
          <StampCell label="기안" name={doc.drafterName} state="approved" sub={fmtD(doc.createdAt)} />
          {(doc.approvers || []).map((a, i) => (
            <StampCell key={i} label={a.role || `결재${i + 1}`} name={a.name}
              state={a.status === "pending" ? (doc.status === "pending" && i === doc.curStep ? "current" : "wait") : a.status}
              sub={a.actedAt ? fmtD(a.actedAt) : ""} border />
          ))}
        </div>
      </div>

      {/* 항목 요약표 (form) */}
      {showFields && (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, marginBottom: 16 }}>
          <tbody>
            {t.fields.map((f) => (
              <tr key={f.k}>
                <td style={{ border: "1px solid #e2e8f0", background: "#fafbfd", padding: "8px 13px", fontWeight: 600, color: "#64748b", width: 150, verticalAlign: "top" }}>{f.label}</td>
                <td style={{ border: "1px solid #e2e8f0", padding: "8px 13px", color: "#1f2937", whiteSpace: "pre-wrap" }}>{v[f.k] || <span style={{ color: "#cbd5e1" }}>—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 본문 (조항/증명문/서신/요청) */}
      {bodyMd && <div style={{ marginTop: showFields ? 8 : 0 }}><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={mdComps}>{bodyMd}</ReactMarkdown></div>}

      {/* 참조 */}
      {(doc.ccIds || []).length > 0 && (
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 16 }}>👁 참조: {doc.ccIds.map((id) => (humans.find((h) => h.id === id) || {}).name || id).join(", ")}</div>
      )}

      {/* 서명란 */}
      {signers && signers.length > 0 && (
        <div style={{ marginTop: 30, paddingTop: 18, borderTop: "1px dashed #cbd5e1" }}>
          <div style={{ textAlign: "center", fontSize: 12.5, color: "#475569", marginBottom: 16 }}>{fmtD(doc.createdAt) || "    년    월    일"}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-end", maxWidth: 420, marginLeft: "auto" }}>
            {signers.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                <span style={{ color: "#64748b", fontWeight: 600, minWidth: 92, textAlign: "right" }}>{s.role}</span>
                <span style={{ color: "#0f172a", fontWeight: 700, minWidth: 90 }}>{s.name}</span>
                <span style={{ width: 34, height: 34, borderRadius: "50%", border: "1.5px solid " + (s.seal ? "#dc2626" : "#cbd5e1"), color: s.seal ? "#dc2626" : "#cbd5e1", fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{s.seal ? "인" : "(인)"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StampCell({ label, name, state, sub, border }) {
  const c = state === "approved" ? { t: "#16a34a", mark: "승인" }
    : state === "rejected" ? { t: "#dc2626", mark: "반려" }
    : state === "current" ? { t: "#4338ca", mark: "대기" }
    : { t: "#cbd5e1", mark: "대기" };
  return (
    <div style={{ width: 64, borderLeft: border ? "1px solid #e2e8f0" : "none", textAlign: "center" }}>
      <div style={{ fontSize: 8.5, color: "#94a3b8", fontWeight: 700, padding: "3px 0", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>{label}</div>
      <div style={{ height: 42, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#1e293b" }}>{name}</div>
        <div style={{ fontSize: 8, fontWeight: 800, color: c.t }}>{c.mark}</div>
        {sub && <div style={{ fontSize: 7.5, color: "#cbd5e1" }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── R: 상세 + 결재 처리 ──────────────────────────────────────────────────────────
function DetailPane({ doc, me, humans, onBack, onAct, onRecall, onDelete }) {
  const t = typeOf(doc.type); const st = STATUS[doc.status];
  const [comment, setComment] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const isMyTurn = doc.status === "pending" && doc.approvers[doc.curStep]?.id === me;
  const isDrafter = doc.drafterId === me;
  return (
    <div style={{ flex: 1, overflowY: "auto", minHeight: 0, background: "#eef1f5" }}>
      <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 18px", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, background: "#fff", zIndex: 1, flexWrap: "wrap" }}>
        <button onClick={onBack} style={gbtn}>← 목록</button>
        <span style={{ fontSize: 14, fontWeight: 800, color: "#1e293b" }}>{t.icon} {doc.title}</span>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: st.color, background: st.bg, padding: "3px 9px", borderRadius: 8 }}>{st.label}{doc.status === "pending" ? ` ${doc.curStep + 1}/${doc.approvers.length}` : ""}</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button onClick={() => window.print()} style={gbtn}>🖨 인쇄</button>
          {isDrafter && doc.status === "pending" && <button onClick={() => onRecall(doc)} style={gbtn}>↩ 회수</button>}
          {isDrafter && (doc.status === "draft" || doc.status === "rejected") && (confirmDel
            ? <button onClick={() => onDelete(doc.id)} style={{ ...gbtn, color: "#fff", background: "#dc2626", border: "none" }}>삭제확인</button>
            : <button onClick={() => setConfirmDel(true)} style={{ ...gbtn, color: "#dc2626" }}>🗑</button>)}
        </span>
      </div>

      <div style={{ padding: "22px 24px 60px" }}>
        <ApprovalDocument doc={doc} humans={humans} />

        {/* 결재 의견 이력 */}
        {doc.approvers.some((a) => a.comment) && (
          <div className="no-print" style={{ maxWidth: 760, margin: "16px auto 0" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>💬 결재 의견</div>
            {doc.approvers.filter((a) => a.comment).map((a, i) => (
              <div key={i} style={{ fontSize: 12.5, color: "#334155", padding: "6px 0", borderBottom: "1px solid #f1f5f9" }}><b>{a.name}</b> <span style={{ color: a.status === "rejected" ? "#dc2626" : "#16a34a" }}>({STATUS[a.status]?.label})</span> — {a.comment}</div>
            ))}
          </div>
        )}

        {/* 내 결재 차례 */}
        {isMyTurn && (
          <div className="no-print" style={{ maxWidth: 760, margin: "16px auto 0", border: "1px solid #c7d2fe", background: "#eef2ff", borderRadius: 12, padding: 16 }}>
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

// ── R: 작성 (입력 + 실시간 미리보기) ──────────────────────────────────────────────
function ComposePane({ typeKey, humans, me, meName, meDept, onCancel, onSubmit }) {
  const t = typeOf(typeKey);
  const [title, setTitle] = useState("");
  const [fields, setFields] = useState({});
  const [approvers, setApprovers] = useState([]);
  const [ccIds, setCcIds] = useState([]);
  const others = humans.filter((h) => h.id !== me);
  const setF = (k, val) => setFields((p) => ({ ...p, [k]: val }));
  const addApprover = (id) => { const h = humans.find((x) => x.id === id); if (h && !approvers.some((a) => a.id === id)) setApprovers((p) => [...p, { id, name: h.name, role: "" }]); };
  const moveAppr = (i, dir) => setApprovers((p) => { const n = [...p]; const j = i + dir; if (j < 0 || j >= n.length) return p; [n[i], n[j]] = [n[j], n[i]]; return n; });

  const build = (mode) => ({
    id: "ap" + Date.now().toString(36), type: typeKey, title: title.trim() || t.label,
    fields, drafterId: me, drafterName: meName, drafterDept: meDept,
    approvers: approvers.map((a, i) => ({ ...a, role: a.role || `결재 ${i + 1}`, status: "pending", comment: "", actedAt: null })),
    ccIds, status: mode === "submit" ? "pending" : "draft", curStep: 0, createdAt: new Date().toISOString(),
  });
  const canSubmit = approvers.length > 0;
  const previewDoc = { type: typeKey, title: title.trim() || t.label, fields, drafterId: me, drafterName: meName, approvers: approvers.map((a, i) => ({ ...a, role: a.role || `결재 ${i + 1}`, status: "pending" })), ccIds, createdAt: new Date().toISOString(), status: "draft" };

  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
      {/* 입력 */}
      <div className="no-print" style={{ width: "46%", minWidth: 340, display: "flex", flexDirection: "column", minHeight: 0, background: "#fff", borderRight: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 18px", borderBottom: "1px solid #e2e8f0" }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: "#1e293b" }}>{t.icon} {t.label}</span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 7 }}>
            <button onClick={() => onSubmit(build("draft"))} style={gbtn}>임시저장</button>
            <button onClick={() => canSubmit && onSubmit(build("submit"))} disabled={!canSubmit} style={{ ...btn(canSubmit ? "#6366f1" : "#cbd5e1"), cursor: canSubmit ? "pointer" : "not-allowed" }}>상신</button>
            <button onClick={onCancel} style={gbtn}>취소</button>
          </span>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 40px" }}>
          {/* 양식 안내 */}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: t.color + "0d", border: "1px solid " + t.color + "30", borderRadius: 9, padding: "9px 12px", marginBottom: 14 }}>
            <span style={{ fontSize: 15 }}>{t.icon}</span>
            <div><div style={{ fontSize: 11.5, color: "#475569", lineHeight: 1.5 }}>{t.guide}</div>{t.line && <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 3 }}>📐 추천 결재선: <b>{t.line}</b></div>}</div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>제목</div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`비우면 "${t.label}"`} style={{ ...inp, marginBottom: 16, fontSize: 14, fontWeight: 600 }} />

          <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, marginBottom: 16 }}>
            {t.fields.map((f) => (
              <div key={f.k} style={{ marginBottom: 11 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "#475569", marginBottom: 4 }}>{f.label}</div>
                {f.type === "select" ? (
                  <select value={fields[f.k] || ""} onChange={(e) => setF(f.k, e.target.value)} style={inp}>
                    <option value="">선택</option>{f.opts.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : f.type === "area" ? (
                  <textarea value={fields[f.k] || ""} onChange={(e) => setF(f.k, e.target.value)} style={{ ...inp, minHeight: 64, resize: "vertical" }} />
                ) : (
                  <input type={f.type === "date" ? "date" : "text"} value={fields[f.k] || ""} onChange={(e) => setF(f.k, e.target.value)} style={inp} />
                )}
              </div>
            ))}
          </div>

          {/* 결재선 */}
          <div style={{ fontSize: 12, fontWeight: 800, color: "#1e293b", marginBottom: 8 }}>결재선 <span style={{ fontSize: 10.5, color: "#94a3b8", fontWeight: 500 }}>· 위→아래 순서</span></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
            {approvers.map((a, i) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 7, border: "1px solid #e2e8f0", borderRadius: 9, padding: "6px 9px" }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "#6366f1", background: "#eef2ff", borderRadius: 6, padding: "2px 6px" }}>{i + 1}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#1e293b", flex: 1 }}>{a.name}</span>
                <input value={a.role} onChange={(e) => setApprovers((p) => p.map((x, j) => j === i ? { ...x, role: e.target.value } : x))} placeholder="직책" style={{ ...inp, width: 92, padding: "4px 7px", fontSize: 11 }} />
                <button onClick={() => moveAppr(i, -1)} style={{ ...gbtn, padding: "2px 6px" }}>▲</button>
                <button onClick={() => moveAppr(i, 1)} style={{ ...gbtn, padding: "2px 6px" }}>▼</button>
                <button onClick={() => setApprovers((p) => p.filter((_, j) => j !== i))} style={{ ...gbtn, padding: "2px 6px", color: "#dc2626" }}>✕</button>
              </div>
            ))}
            {approvers.length === 0 && <div style={{ fontSize: 11.5, color: "#cbd5e1", padding: "4px 2px" }}>결재자를 1명 이상 추가하세요.</div>}
          </div>
          <select value="" onChange={(e) => e.target.value && addApprover(e.target.value)} style={{ ...inp, marginBottom: 16 }}>
            <option value="">+ 결재자 추가</option>
            {others.map((h) => <option key={h.id} value={h.id}>{h.name}{h.dept ? ` · ${h.dept}` : ""}</option>)}
          </select>

          {/* 참조 */}
          <div style={{ fontSize: 12, fontWeight: 800, color: "#1e293b", marginBottom: 8 }}>참조 <span style={{ fontSize: 10.5, color: "#94a3b8", fontWeight: 500 }}>· 열람만</span></div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {others.map((h) => { const on = ccIds.includes(h.id);
              return <button key={h.id} onClick={() => setCcIds((p) => on ? p.filter((x) => x !== h.id) : [...p, h.id])} style={{ padding: "5px 10px", borderRadius: 14, fontSize: 11.5, cursor: "pointer", fontWeight: 600, border: "1px solid " + (on ? "#0ea5e9" : "#e2e8f0"), background: on ? "#e0f2fe" : "#fff", color: on ? "#0369a1" : "#64748b" }}>{on ? "✓ " : ""}{h.name}</button>;
            })}
          </div>
        </div>
      </div>

      {/* 미리보기 */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0, background: "#eef1f5" }}>
        <div className="no-print" style={{ padding: "8px 16px", borderBottom: "1px solid #e2e8f0", background: "#fff", fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>📄 실시간 미리보기 <span style={{ fontWeight: 400, color: "#cbd5e1" }}>· 입력하는 즉시 반영</span></div>
        <div style={{ flex: 1, overflowY: "auto", padding: "22px 20px 60px" }}>
          <ApprovalDocument doc={previewDoc} humans={humans} />
        </div>
      </div>
    </div>
  );
}

// ── 사용법 · 양식 안내 ───────────────────────────────────────────────────────────
function HelpView({ onClose, onCompose }) {
  const STEPS = [
    { n: 1, t: "기안 작성", d: "‘+ 기안 작성’ → 양식 선택 → 내용 입력. 입력하는 즉시 우측에 실제 문서로 미리보기됩니다." },
    { n: 2, t: "결재선 지정", d: "위에서 아래 순서로 결재자를 추가합니다(예: 팀장 → 대표). ▲▼로 순서 조정, 직책 입력 가능." },
    { n: 3, t: "참조 지정", d: "결재권은 없지만 내용을 공유할 사람을 선택합니다(선택)." },
    { n: 4, t: "상신", d: "‘상신’을 누르면 첫 결재자에게 넘어갑니다. 미완성이면 ‘임시저장’." },
    { n: 5, t: "승인 / 반려", d: "각 결재자가 차례로 승인/반려. 반려 시 종료되고 기안자가 회수·수정 후 재상신." },
    { n: 6, t: "완료 · 인쇄", d: "마지막까지 승인되면 ‘승인’ 완료. 🖨 인쇄로 문서만 출력/PDF 저장 가능." },
  ];
  const BOXHELP = [
    ["📥 결재할 문서", "내가 지금 승인/반려해야 할 차례인 문서"],
    ["📤 상신함", "내가 올린 문서 (진행 상황 추적)"],
    ["👁 참조 문서", "참조로 지정돼 열람만 하는 문서"],
    ["✅ 결재 완료", "내가 이미 처리(승인·반려)한 문서"],
    ["📝 임시저장", "아직 상신하지 않은 작성 중 문서"],
  ];
  const sec = { fontSize: 13.5, fontWeight: 800, color: "#1e293b", margin: "22px 0 10px" };
  return (
    <div style={{ flex: 1, overflowY: "auto", background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 22px", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: "#1e293b" }}>📖 전자결재 사용법 · 양식 안내</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={onCompose} style={btn("#6366f1")}>+ 기안 작성</button>
          <button onClick={onClose} style={gbtn}>닫기</button>
        </span>
      </div>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "8px 26px 60px" }}>
        <div style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.7, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 15px", marginTop: 16 }}>
          전자결재는 휴가·지출·구매·계약 등 <b>승인이 필요한 모든 업무</b>를 문서로 올리고, 정해진 <b>결재선(팀장→대표 등)</b>을 따라 차례로 승인받는 곳입니다. 작성하면 우측에 <b>실제 결재 문서</b>로 미리보기되고, 계약서·증명서 등은 조항·서명란까지 완성된 문서로 출력됩니다.
        </div>
        <div style={sec}>① 진행 흐름</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {STEPS.map((s) => (
            <div key={s.n} style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
              <div style={{ flexShrink: 0, width: 24, height: 24, borderRadius: "50%", background: "#6366f1", color: "#fff", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{s.n}</div>
              <div><b style={{ fontSize: 13, color: "#1e293b" }}>{s.t}</b><div style={{ fontSize: 12, color: "#64748b", marginTop: 2, lineHeight: 1.6 }}>{s.d}</div></div>
            </div>
          ))}
        </div>
        <div style={sec}>② 문서함 구분</div>
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
          {BOXHELP.map(([l, dd], i) => (
            <div key={l} style={{ display: "flex", gap: 12, padding: "9px 14px", borderTop: i ? "1px solid #f1f5f9" : "none", fontSize: 12.5 }}>
              <span style={{ width: 120, flexShrink: 0, fontWeight: 700, color: "#475569" }}>{l}</span>
              <span style={{ color: "#64748b" }}>{dd}</span>
            </div>
          ))}
        </div>
        <div style={sec}>③ 양식(템플릿) {DOC_TYPES.length}종</div>
        {DOC_GROUPS.map((g) => (
          <div key={g} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: "#6366f1", marginBottom: 6, paddingBottom: 4, borderBottom: "1px solid #eef2ff" }}>{g}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {DOC_TYPES.filter((dt) => dt.group === g).map((dt) => (
                <div key={dt.key} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 16, flexShrink: 0, width: 22, textAlign: "center" }}>{dt.icon}</span>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "#1e293b" }}>{dt.label}</span>
                    {dt.docKind === "contract" && <span style={{ fontSize: 9.5, color: "#8b5cf6", background: "#f5f3ff", padding: "1px 6px", borderRadius: 6, marginLeft: 6 }}>계약서</span>}
                    {dt.docKind === "cert" && <span style={{ fontSize: 9.5, color: "#f59e0b", background: "#fffbeb", padding: "1px 6px", borderRadius: 6, marginLeft: 6 }}>증명서</span>}
                    {dt.line && <span style={{ fontSize: 10.5, color: "#94a3b8", marginLeft: 7 }}>📐 {dt.line}</span>}
                    <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 1, lineHeight: 1.5 }}>{dt.guide}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div style={sec}>④ 알아두면 좋은 점</div>
        <ul style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.9, paddingLeft: 18, margin: 0 }}>
          <li>좌측 상단 <b>‘현재 사용자’</b>를 바꾸면 그 사람 입장에서 결재함이 보입니다(여러 명 테스트용).</li>
          <li>상신 후라도 아직 아무도 결재 전이면 기안자가 <b>↩ 회수</b>해서 수정할 수 있어요.</li>
          <li>반려·임시저장 문서는 기안자가 <b>🗑 삭제</b> 가능합니다(진행 중·완료 문서는 보존).</li>
          <li>금액이 큰 지출·구매·계약은 <b>재무·대표</b>를 결재선에 포함하세요(추천 결재선 참고).</li>
          <li><b>계약서·증명서</b>는 갑·을·조항·서명란까지 완성된 문서로 나오며 🖨 인쇄로 출력·PDF 저장됩니다.</li>
        </ul>
      </div>
    </div>
  );
}
