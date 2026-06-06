import { useState, useEffect } from "react";

// 사내 공지 배너 — 전 화면 상단(LeftPanel 옆)에 표시. 닫기는 세션 한정.
export default function NoticeBanner() {
  const [notice, setNotice] = useState(null);
  const [closed, setClosed] = useState(false);

  const load = () => {
    fetch("/api/company").then((r) => r.json()).then((c) => setNotice(c?.notice || null)).catch(() => {});
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const es = new EventSource("/api/stream");
    es.onmessage = (e) => { try { const m = JSON.parse(e.data); if (m.type === "data_update" && m.resource === "company") load(); } catch {} };
    return () => es.close();
  }, []);

  if (!notice?.on || !notice?.text || closed) return null;
  const LV = { info: ["💡", "#0ea5e9", "#e0f2fe"], warn: ["⚠️", "#d97706", "#fef3c7"], urgent: ["🚨", "#dc2626", "#fee2e2"] }[notice.level || "info"];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 14px", background: LV[2], borderBottom: "1px solid " + LV[1] + "44", flexShrink: 0 }}>
      <span style={{ fontSize: 14 }}>{LV[0]}</span>
      <span style={{ flex: 1, fontSize: 12.5, color: LV[1], fontWeight: 600, lineHeight: 1.4 }}>{notice.text}</span>
      <span onClick={() => setClosed(true)} title="닫기" style={{ fontSize: 12, color: LV[1], cursor: "pointer", padding: "0 4px", opacity: 0.7 }}>✕</span>
    </div>
  );
}
