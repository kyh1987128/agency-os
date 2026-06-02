import { useState, useEffect } from "react";

const API = "";

export const TEMPLATES = {
  work_report: {
    label: "📋 업무 보고",
    fields: [
      { key: "progress",  label: "진행상황",   type: "textarea", placeholder: "현재 진행 상황을 입력하세요" },
      { key: "completed", label: "완료 내용",   type: "textarea", placeholder: "완료한 작업 목록" },
      { key: "issues",    label: "이슈/문제",   type: "textarea", placeholder: "발생한 이슈나 문제점" },
      { key: "next",      label: "다음 액션",   type: "textarea", placeholder: "다음 단계 계획" },
    ],
  },
  meeting: {
    label: "🗓️ 회의록",
    fields: [
      { key: "date",       label: "일시",       type: "text",     placeholder: "2026-05-26 14:00" },
      { key: "attendees",  label: "참석자",     type: "text",     placeholder: "홍길동, 김철수, ..." },
      { key: "agenda",     label: "안건",       type: "textarea", placeholder: "회의 안건" },
      { key: "decisions",  label: "결정사항",   type: "textarea", placeholder: "결정된 내용" },
      { key: "actions",    label: "후속 액션",  type: "textarea", placeholder: "담당자/기한 포함" },
    ],
  },
  issue: {
    label: "🚨 이슈 리포트",
    fields: [
      { key: "type",        label: "이슈 유형",  type: "select",   options: ["기술", "일정", "품질", "커뮤니케이션", "기타"] },
      { key: "description", label: "발생 경위",  type: "textarea", placeholder: "이슈가 발생한 상황 설명" },
      { key: "impact",      label: "영향 범위",  type: "textarea", placeholder: "어떤 영향이 있는지" },
      { key: "solution",    label: "해결 방안",  type: "textarea", placeholder: "제안하는 해결책" },
      { key: "status",      label: "처리 상태",  type: "select",   options: ["미처리", "처리중", "해결됨", "보류"] },
    ],
  },
  feedback: {
    label: "💬 피드백",
    fields: [
      { key: "content",  label: "피드백 내용", type: "textarea", placeholder: "피드백 내용을 작성하세요" },
      { key: "priority", label: "우선순위",    type: "select",   options: ["긴급", "높음", "보통", "낮음"] },
      { key: "action",   label: "조치 여부",   type: "select",   options: ["미조치", "검토중", "조치완료"] },
    ],
  },
  progress: {
    label: "📊 진행 보고",
    fields: [
      { key: "period",     label: "보고 기간",   type: "text",     placeholder: "2026-05-20 ~ 2026-05-26" },
      { key: "completed",  label: "완료 항목",   type: "textarea", placeholder: "이번 기간에 완료한 것들" },
      { key: "inProgress", label: "진행중 항목", type: "textarea", placeholder: "현재 진행중인 것들" },
      { key: "delayed",    label: "지연 항목",   type: "textarea", placeholder: "지연되고 있는 것들" },
      { key: "next",       label: "다음 계획",   type: "textarea", placeholder: "다음 기간 계획" },
    ],
  },
  memo: {
    label: "📝 자유 메모",
    fields: [
      { key: "content", label: "내용", type: "textarea", placeholder: "자유롭게 메모하세요" },
    ],
  },
};

const FILTER_TABS = [
  { id: "all",         label: "전체" },
  { id: "work_report", label: "업무보고" },
  { id: "meeting",     label: "회의록" },
  { id: "issue",       label: "이슈" },
  { id: "feedback",    label: "피드백" },
  { id: "progress",    label: "진행보고" },
  { id: "memo",        label: "자유메모" },
];

export default function RecordPanel({ entityType, entityId, pid }) {
  // mode: "list" | "picking" | "form"
  const [mode,         setMode]         = useState("list");
  const [records,      setRecords]      = useState([]);
  const [filterTab,    setFilterTab]    = useState("all");
  const [selTemplate,  setSelTemplate]  = useState(null);
  const [formFields,   setFormFields]   = useState({});
  const [formTitle,    setFormTitle]    = useState("");
  const [editId,       setEditId]       = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [confirmDelId, setConfirmDelId] = useState(null);

  const apiBase = entityType === "proj"
    ? `${API}/api/data/projects/${entityId}/records`
    : `${API}/api/projects/${pid}/kanban/cards/${entityId}/records`;

  useEffect(() => {
    fetch(apiBase)
      .then(r => r.json())
      .then(d => setRecords(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [apiBase]);

  const openCreate = (key) => {
    setEditId(null);
    setSelTemplate(key);
    setFormFields({});
    setFormTitle("");
    setMode("form");
  };

  const openEdit = (rec) => {
    setEditId(rec.id);
    setSelTemplate(rec.template);
    setFormFields({ ...rec.fields });
    setFormTitle(rec.title || "");
    setMode("form");
  };

  const closeForm = () => {
    setMode("list");
    setSelTemplate(null);
    setEditId(null);
    setFormFields({});
    setFormTitle("");
  };

  const save = async () => {
    if (!selTemplate) return;
    setSaving(true);
    try {
      if (editId) {
        const r = await fetch(`${apiBase}/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formTitle.trim() || TEMPLATES[selTemplate].label,
            fields: formFields,
          }),
        });
        if (r.ok) {
          const updated = await r.json();
          setRecords(prev => prev.map(rec => rec.id === editId ? updated : rec));
          closeForm();
        }
      } else {
        const r = await fetch(apiBase, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            template: selTemplate,
            title: formTitle.trim() || TEMPLATES[selTemplate].label,
            fields: formFields,
            author: "나",
          }),
        });
        if (r.ok) {
          const rec = await r.json();
          setRecords(prev => [rec, ...prev]);
          closeForm();
        }
      }
    } catch {}
    setSaving(false);
  };

  const deleteRecord = async (rid) => {
    if (confirmDelId !== rid) { setConfirmDelId(rid); return; }
    await fetch(`${apiBase}/${rid}`, { method: "DELETE" });
    setRecords(prev => prev.filter(r => r.id !== rid));
    setConfirmDelId(null);
  };

  const IS = { width: "100%", boxSizing: "border-box", border: "1px solid #e2e8f0", borderRadius: 7, padding: "7px 10px", fontSize: 12, outline: "none", fontFamily: "inherit", color: "#1e293b", background: "#fff" };
  const LS = { fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 };

  /* ── FORM mode ── */
  if (mode === "form" && selTemplate) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto", padding: "14px 16px", minHeight: 0 }}>
        <div style={{ background: "#f8fafc", border: "1.5px solid #c4b5fd", borderRadius: 10, padding: "14px 16px", maxWidth: 560 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#6366f1" }}>
              {editId ? `✏️ 수정 — ${TEMPLATES[selTemplate].label}` : TEMPLATES[selTemplate].label}
            </span>
            <button onClick={closeForm} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={LS}>제목</div>
            <input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="기록 제목 (선택)" style={IS} />
          </div>

          {TEMPLATES[selTemplate].fields.map(f => (
            <div key={f.key} style={{ marginBottom: 10 }}>
              <div style={LS}>{f.label}</div>
              {f.type === "textarea" ? (
                <textarea
                  value={formFields[f.key] || ""}
                  onChange={e => setFormFields(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  rows={3}
                  style={{ ...IS, resize: "vertical" }}
                />
              ) : f.type === "select" ? (
                <select value={formFields[f.key] || ""} onChange={e => setFormFields(p => ({ ...p, [f.key]: e.target.value }))} style={IS}>
                  <option value="">선택</option>
                  {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  value={formFields[f.key] || ""}
                  onChange={e => setFormFields(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  style={IS}
                />
              )}
            </div>
          ))}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button onClick={closeForm} style={{ padding: "6px 16px", borderRadius: 7, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 11, cursor: "pointer" }}>취소</button>
            <button onClick={save} disabled={saving} style={{ padding: "6px 16px", borderRadius: 7, border: "none", background: saving ? "#e2e8f0" : "#6366f1", color: saving ? "#94a3b8" : "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              {saving ? "저장중..." : "저장"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── PICKING mode ── */
  if (mode === "picking") {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto", padding: "14px 16px", minHeight: 0 }}>
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px", maxWidth: 560 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>어떤 기록을 남기시겠어요?</span>
            <button onClick={() => setMode("list")} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Object.entries(TEMPLATES).map(([key, tpl]) => (
              <button
                key={key}
                onClick={() => openCreate(key)}
                style={{ padding: "10px 16px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 12, cursor: "pointer", fontFamily: "inherit", transition: "all .15s" }}
                onMouseEnter={e => Object.assign(e.currentTarget.style, { background: "#ede9fe", borderColor: "#c4b5fd", color: "#6366f1" })}
                onMouseLeave={e => Object.assign(e.currentTarget.style, { background: "#fff", borderColor: "#e2e8f0", color: "#475569" })}
              >
                {tpl.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── LIST mode ── */
  const filtered = filterTab === "all" ? records : records.filter(r => r.template === filterTab);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>

      {/* 상단 바: 필터 탭 + 새 기록 버튼 */}
      <div style={{ padding: "8px 12px", borderBottom: "1px solid #e2e8f0", background: "#fff", flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ display: "flex", gap: 2, flex: 1, overflowX: "auto" }}>
          {FILTER_TABS.map(ft => {
            const count = ft.id === "all" ? records.length : records.filter(r => r.template === ft.id).length;
            return (
              <button key={ft.id} onClick={() => setFilterTab(ft.id)} style={{
                padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                fontSize: 10, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0,
                background: filterTab === ft.id ? "#ede9fe" : "transparent",
                color: filterTab === ft.id ? "#6366f1" : "#94a3b8",
              }}>
                {ft.label}{count > 0 ? ` (${count})` : ""}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setMode("picking")}
          style={{ padding: "5px 14px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}
        >
          <span>+</span> 새 기록
        </button>
      </div>

      {/* 카드 그리드 */}
      <div style={{ flex: 1, overflow: "auto", padding: "12px 14px" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "32px 0", textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
            📭 기록이 없습니다.<br />
            <span style={{ fontSize: 11 }}>새 기록 버튼을 눌러 첫 기록을 남겨보세요.</span>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10, alignItems: "start" }}>
            {filtered.map(rec => {
              const tpl        = TEMPLATES[rec.template];
              const previewVal = Object.values(rec.fields || {}).find(v => v?.trim());
              const preview    = previewVal ? (previewVal.length > 100 ? previewVal.slice(0, 100) + "…" : previewVal) : null;
              const isConfirmDel = confirmDelId === rec.id;

              return (
                <div key={rec.id} style={{
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 7,
                }}>
                  {/* 상단: 뱃지 + 날짜 */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 10, color: "#6366f1", background: "#ede9fe", padding: "2px 8px", borderRadius: 7, fontWeight: 600 }}>
                      {tpl?.label || rec.template}
                    </span>
                    <span style={{ fontSize: 9, color: "#94a3b8" }}>
                      {new Date(rec.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                      {" "}
                      {new Date(rec.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  {/* 제목 */}
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", lineHeight: 1.3 }}>
                    {rec.title || tpl?.label || rec.template}
                  </div>

                  {/* 내용 미리보기 */}
                  {preview && (
                    <div style={{
                      fontSize: 11, color: "#64748b", lineHeight: 1.6,
                      overflow: "hidden", display: "-webkit-box",
                      WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
                    }}>
                      {preview}
                    </div>
                  )}

                  {/* 하단: 작성자 + 액션 */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 7, borderTop: "1px solid #f1f5f9", marginTop: "auto" }}>
                    <span style={{ fontSize: 9, color: "#94a3b8" }}>{rec.author}</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        onClick={() => openEdit(rec)}
                        style={{ padding: "3px 9px", borderRadius: 5, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", fontSize: 9, cursor: "pointer" }}
                      >수정</button>
                      {isConfirmDel ? (
                        <>
                          <button onClick={() => deleteRecord(rec.id)} style={{ padding: "3px 9px", borderRadius: 5, border: "none", background: "#dc2626", color: "#fff", fontSize: 9, fontWeight: 700, cursor: "pointer" }}>확인</button>
                          <button onClick={() => setConfirmDelId(null)} style={{ padding: "3px 9px", borderRadius: 5, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 9, cursor: "pointer" }}>취소</button>
                        </>
                      ) : (
                        <button onClick={() => deleteRecord(rec.id)} style={{ padding: "3px 9px", borderRadius: 5, border: "1px solid #fecaca", background: "#fff5f5", color: "#dc2626", fontSize: 9, cursor: "pointer" }}>삭제</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
