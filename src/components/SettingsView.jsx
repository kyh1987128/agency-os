import { useState, useEffect } from "react";
import OfficeScene from "./OfficeScene";

// ════════════════════════════════════════════════════════════════════════════
// 설정 및 오피스 — 좌(설정·정보) + 우(2.5D 오피스 Phaser)
//   좌: 내 프로필 / 구성원·조직도 / 회사정보 / 바로가기 / 직원관리(관리자)
//   우: Phaser 게임 오피스 — 캐릭터 조작·앉기·상태 자동/수동
// ════════════════════════════════════════════════════════════════════════════

const API = "";
const AVATARS = ["👤", "👩‍💼", "👨‍💻", "🎬", "🎨", "⚡", "📋", "🧑‍🎨", "🧑‍💻", "🧑‍🔧", "👩‍🎤", "🦸", "🐱", "🐶", "🦊", "🐻", "🦁", "🐯", "🐰", "🐵", "🚀", "⭐", "🔥", "💡"];
const inp = { width: "100%", boxSizing: "border-box", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, outline: "none", color: "#1e293b" };
const lab = { fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 4, display: "block" };
const btn = (c) => ({ border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", background: c, color: "#fff" });
const gbtn = { border: "1px solid #e2e8f0", background: "#fff", color: "#475569", borderRadius: 7, padding: "4px 9px", fontSize: 11, fontWeight: 600, cursor: "pointer" };
const h2 = { fontSize: 15, fontWeight: 800, color: "#1e293b", marginBottom: 4 };
const sub = { fontSize: 11.5, color: "#94a3b8", marginBottom: 14 };

const getMe = () => { try { return JSON.parse(localStorage.getItem("authUser") || "null"); } catch { return null; } };
const deptName = (deps, id) => (deps.find((d) => d.id === id) || {}).name || "";

export default function SettingsView({ departments = [], onHumansChange }) {
  const me = getMe();
  const isAdmin = me?.role === "admin";
  const [sec, setSec] = useState("profile");
  const [humans, setHumans] = useState([]);
  const [company, setCompany] = useState({ name: "", links: [] });
  const reload = () => { fetch(`${API}/api/humans`).then((r) => r.json()).then((d) => { setHumans(Array.isArray(d) ? d : []); onHumansChange?.(); }).catch(() => {}); fetch(`${API}/api/company`).then((r) => r.json()).then((d) => setCompany(d || { name: "", links: [] })).catch(() => {}); };
  useEffect(() => { reload(); }, []);
  // SSE: humans 또는 회사 정보 바뀌면 자동 갱신
  useEffect(() => {
    const es = new EventSource(`${API}/api/stream`);
    es.onmessage = (e) => { try { const m = JSON.parse(e.data); if (m.type === "data_update" && (m.resource === "humans" || m.resource === "company")) reload(); } catch {} };
    return () => es.close();
  }, []);

  const SECTIONS = [
    ["profile", "⚙️", "내 프로필"],
    ["members", "👥", "구성원 · 조직도"],
    ["company", "🏢", "회사 정보"],
    ["links", "🔗", "바로가기"],
    ...(isAdmin ? [["admin", "🛡️", "직원 관리"]] : []),
  ];

  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0, background: "#f1f5f9" }}>
      {/* 좌측 : 설정·정보 */}
      <div style={{ width: 460, flexShrink: 0, display: "flex", minHeight: 0, background: "#fff", borderRight: "1px solid #e2e8f0" }}>
        <div style={{ width: 156, flexShrink: 0, borderRight: "1px solid #e2e8f0", padding: "10px 8px", background: "#fafbfd" }}>
          {SECTIONS.map(([k, e, l]) => (
            <div key={k} onClick={() => setSec(k)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 11px", borderRadius: 8, cursor: "pointer", marginBottom: 3, fontSize: 12.5, fontWeight: sec === k ? 800 : 500, color: sec === k ? "#4338ca" : "#475569", background: sec === k ? "#eef2ff" : "transparent" }}>
              <span>{e}</span>{l}
            </div>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "18px 20px 50px" }}>
          {!me ? <div style={{ color: "#94a3b8" }}>로그인이 필요합니다.</div>
            : sec === "profile" ? <ProfileSection me={me} departments={departments} onSaved={reload} />
              : sec === "members" ? <MembersSection humans={humans} departments={departments} />
                : sec === "company" ? <CompanySection company={company} isAdmin={isAdmin} onSaved={reload} />
                  : sec === "links" ? <LinksSection company={company} isAdmin={isAdmin} onSaved={reload} />
                    : sec === "admin" && isAdmin ? <AdminSection humans={humans} me={me} departments={departments} reload={reload} />
                      : null}
        </div>
      </div>

      {/* 우측 : 2.5D 오피스 */}
      <div style={{ flex: 1, minWidth: 0, position: "relative", background: "linear-gradient(180deg,#e0f2fe,#f1f5f9)", overflow: "hidden" }}>
        <OfficeScene me={me} humans={humans} departments={departments} />
      </div>
    </div>
  );
}

// ── 내 프로필 (무드 텍스트칸 삭제 — 상태는 오피스에서 자동/원클릭) ─────────────
function ProfileSection({ me, departments, onSaved }) {
  const [f, setF] = useState({ name: me.name || "", avatar: me.avatar || "👤", title: me.title || "", deptId: me.deptId || "", phone: me.phone || "", bio: me.bio || "" });
  const [msg, setMsg] = useState("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = async () => {
    setMsg("");
    if (!f.name.trim()) return setMsg("이름을 입력하세요");
    try {
      const r = await fetch(`${API}/api/humans/${me.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const j = await r.json();
      if (!r.ok) return setMsg(j.error || "저장 실패");
      localStorage.setItem("authUser", JSON.stringify({ ...me, ...f }));
      setMsg("저장됨 ✓"); onSaved?.();
      setTimeout(() => setMsg(""), 2000);
    } catch { setMsg("서버 연결 실패"); }
  };
  return (
    <div>
      <div style={h2}>⚙️ 내 프로필</div>
      <div style={sub}>저장하면 게시판·전자결재·오피스 캐릭터에 반영됩니다.</div>

      <label style={lab}>아바타</label>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>{f.avatar}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, flex: 1 }}>
          {AVATARS.map((a) => <span key={a} onClick={() => set("avatar", a)} style={{ fontSize: 18, padding: 2, borderRadius: 6, cursor: "pointer", background: f.avatar === a ? "#e0e7ff" : "transparent" }}>{a}</span>)}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div><label style={lab}>이름</label><input value={f.name} onChange={(e) => set("name", e.target.value)} style={inp} /></div>
        <div><label style={lab}>직책</label><input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="예: PD" style={inp} /></div>
        <div><label style={lab}>부서</label>
          <select value={f.deptId} onChange={(e) => set("deptId", e.target.value)} style={inp}>
            <option value="">미지정</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div><label style={lab}>연락처</label><input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="010-…" style={inp} /></div>
      </div>
      <div style={{ marginBottom: 10 }}><label style={lab}>이메일 <span style={{ color: "#cbd5e1", fontWeight: 400 }}>(변경 불가)</span></label><input value={me.email || ""} disabled style={{ ...inp, background: "#f8fafc", color: "#94a3b8" }} /></div>
      <div style={{ marginBottom: 14 }}><label style={lab}>한 줄 소개</label><textarea value={f.bio} onChange={(e) => set("bio", e.target.value)} placeholder="간단한 소개" style={{ ...inp, minHeight: 50, resize: "vertical" }} /></div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={save} style={btn("#6366f1")}>저장</button>
        {msg && <span style={{ fontSize: 11.5, fontWeight: 600, color: msg.includes("✓") ? "#16a34a" : "#dc2626" }}>{msg}</span>}
      </div>
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 14, padding: "9px 11px", background: "#f8fafc", borderRadius: 8, border: "1px solid #f1f5f9" }}>
        💡 상태(작업중·식사중 등)는 오른쪽 오피스에서 캐릭터를 자리로 옮기면 자동으로 바뀝니다.
      </div>
    </div>
  );
}

// ── 구성원 + 조직도 ──────────────────────────────────────────────────────────
function MembersSection({ humans, departments }) {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState("dir"); // dir | org
  const list = humans.filter((h) => !q || (`${h.name} ${h.title} ${h.email}`).toLowerCase().includes(q.toLowerCase()));
  const byDept = departments.map((d) => ({ ...d, members: humans.filter((h) => h.deptId === d.id) }));
  const noDept = humans.filter((h) => !h.deptId);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <div style={h2}>👥 구성원 <span style={{ fontSize: 11.5, color: "#94a3b8", fontWeight: 500 }}>· {humans.length}명</span></div>
        <div style={{ marginLeft: "auto", display: "flex", border: "1px solid #e2e8f0", borderRadius: 7, overflow: "hidden" }}>
          {[["dir", "명부"], ["org", "조직도"]].map(([m, l]) => <button key={m} onClick={() => setMode(m)} style={{ border: "none", background: mode === m ? "#6366f1" : "#fff", color: mode === m ? "#fff" : "#64748b", padding: "5px 11px", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>{l}</button>)}
        </div>
      </div>
      <div style={sub}>구성원의 직책·연락처를 확인합니다.</div>
      {mode === "dir" ? (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 이름·직책·이메일" style={{ ...inp, marginBottom: 12 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {list.map((h) => (
              <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: (h.color || "#6366f1") + "1c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{h.avatar || "👤"}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#1e293b" }}>{h.name}
                    {h.role === "admin" && <span style={{ fontSize: 8.5, background: "#ede9fe", color: "#6366f1", padding: "1px 5px", borderRadius: 6, fontWeight: 700, marginLeft: 5 }}>관리자</span>}
                    {h.status === "blocked" && <span style={{ fontSize: 8.5, background: "#fee2e2", color: "#dc2626", padding: "1px 5px", borderRadius: 6, fontWeight: 700, marginLeft: 5 }}>차단</span>}
                  </div>
                  <div style={{ fontSize: 10.5, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.title || "—"}{deptName(departments, h.deptId) ? ` · ${deptName(departments, h.deptId)}` : ""}{h.phone ? ` · ${h.phone}` : ""}</div>
                  {h.email && <div style={{ fontSize: 10, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📧 {h.email}</div>}
                </div>
              </div>
            ))}
            {list.length === 0 && <div style={{ color: "#cbd5e1", fontSize: 12.5, padding: 20, textAlign: "center" }}>결과 없음</div>}
          </div>
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {byDept.filter((d) => d.members.length > 0).map((d) => (
            <div key={d.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
              <div style={{ padding: "8px 12px", background: (d.color || "#6366f1") + "12", borderBottom: "1px solid #f1f5f9", fontSize: 12, fontWeight: 800, color: d.color || "#475569" }}>
                {d.name} <span style={{ fontSize: 10.5, color: "#94a3b8", fontWeight: 500 }}>· {d.members.length}명</span>
              </div>
              {d.members.map((h) => (
                <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", borderTop: "1px solid #f8fafc", fontSize: 12 }}>
                  <span style={{ fontSize: 16 }}>{h.avatar || "👤"}</span>
                  <span style={{ fontWeight: 700, color: "#1e293b" }}>{h.name}</span>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>{h.title}</span>
                </div>
              ))}
            </div>
          ))}
          {noDept.length > 0 && (
            <div style={{ border: "1px dashed #e2e8f0", borderRadius: 10, padding: "8px 12px", background: "#fafbfd" }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "#94a3b8", marginBottom: 5 }}>미지정 · {noDept.length}명</div>
              {noDept.map((h) => <div key={h.id} style={{ fontSize: 12, color: "#475569", padding: "2px 0" }}>{h.avatar} {h.name}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 회사 정보 (관리자 편집) ────────────────────────────────────────────────────
function CompanySection({ company, isAdmin, onSaved }) {
  const [f, setF] = useState(company);
  const [msg, setMsg] = useState("");
  useEffect(() => setF(company), [company.name]);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = async () => {
    if (!isAdmin) return;
    setMsg("");
    try {
      const r = await fetch(`${API}/api/company`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      if (!r.ok) return setMsg("저장 실패");
      setMsg("저장됨 ✓"); onSaved?.();
      setTimeout(() => setMsg(""), 2000);
    } catch { setMsg("서버 연결 실패"); }
  };
  const ro = !isAdmin;
  return (
    <div>
      <div style={h2}>🏢 회사 정보 {ro && <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>· 보기 전용(관리자만 편집)</span>}</div>
      <div style={sub}>회사명·주소·대표·로고. 전자결재 문서 머리글에 자동 반영됩니다.</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div><label style={lab}>회사명</label><input value={f.name || ""} onChange={(e) => set("name", e.target.value)} disabled={ro} style={{ ...inp, background: ro ? "#f8fafc" : "#fff" }} /></div>
        <div><label style={lab}>대표</label><input value={f.ceo || ""} onChange={(e) => set("ceo", e.target.value)} disabled={ro} style={{ ...inp, background: ro ? "#f8fafc" : "#fff" }} /></div>
        <div style={{ gridColumn: "1 / -1" }}><label style={lab}>주소</label><input value={f.address || ""} onChange={(e) => set("address", e.target.value)} disabled={ro} placeholder="예: 경남 창원시…" style={{ ...inp, background: ro ? "#f8fafc" : "#fff" }} /></div>
        <div><label style={lab}>사업자번호</label><input value={f.bizno || ""} onChange={(e) => set("bizno", e.target.value)} disabled={ro} placeholder="000-00-00000" style={{ ...inp, background: ro ? "#f8fafc" : "#fff" }} /></div>
        <div><label style={lab}>대표 연락처</label><input value={f.phone || ""} onChange={(e) => set("phone", e.target.value)} disabled={ro} style={{ ...inp, background: ro ? "#f8fafc" : "#fff" }} /></div>
        <div><label style={lab}>대표 이메일</label><input value={f.email || ""} onChange={(e) => set("email", e.target.value)} disabled={ro} style={{ ...inp, background: ro ? "#f8fafc" : "#fff" }} /></div>
        <div><label style={lab}>로고 URL/이모지</label><input value={f.logo || ""} onChange={(e) => set("logo", e.target.value)} disabled={ro} placeholder="🏢 또는 이미지 URL" style={{ ...inp, background: ro ? "#f8fafc" : "#fff" }} /></div>
      </div>
      <div style={{ marginBottom: 14 }}><label style={lab}>회사 소개</label><textarea value={f.intro || ""} onChange={(e) => set("intro", e.target.value)} disabled={ro} style={{ ...inp, minHeight: 60, resize: "vertical", background: ro ? "#f8fafc" : "#fff" }} /></div>
      {!ro && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={save} style={btn("#6366f1")}>저장</button>
          {msg && <span style={{ fontSize: 11.5, fontWeight: 600, color: msg.includes("✓") ? "#16a34a" : "#dc2626" }}>{msg}</span>}
        </div>
      )}
    </div>
  );
}

// ── 바로가기 (회사 공용 링크) ─────────────────────────────────────────────────
function LinksSection({ company, isAdmin, onSaved }) {
  const [links, setLinks] = useState(company.links || []);
  const [nf, setNf] = useState({ label: "", url: "", icon: "🔗" });
  useEffect(() => setLinks(company.links || []), [company.links]);
  const save = async (list) => {
    setLinks(list);
    if (!isAdmin) return;
    await fetch(`${API}/api/company`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ links: list }) }).catch(() => {});
    onSaved?.();
  };
  const add = () => { if (!nf.label.trim() || !nf.url.trim()) return; save([...links, { ...nf, id: Date.now().toString(36) }]); setNf({ label: "", url: "", icon: "🔗" }); };
  const del = (id) => save(links.filter((l) => l.id !== id));
  return (
    <div>
      <div style={h2}>🔗 바로가기 <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>· {links.length}</span></div>
      <div style={sub}>홈페이지·드라이브·자주 쓰는 사이트{isAdmin ? " (관리자 등록)" : " (관리자만 수정 가능)"}</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 9, marginBottom: 18 }}>
        {links.map((l) => (
          <div key={l.id} style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, padding: "10px 11px", border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff", cursor: "pointer" }}
            onClick={() => window.open(l.url, "_blank")}>
            <span style={{ fontSize: 18 }}>{l.icon || "🔗"}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.label}</div>
              <div style={{ fontSize: 10, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.url}</div>
            </div>
            {isAdmin && <span onClick={(e) => { e.stopPropagation(); del(l.id); }} style={{ position: "absolute", top: 3, right: 5, fontSize: 11, color: "#cbd5e1", cursor: "pointer" }}>✕</span>}
          </div>
        ))}
        {links.length === 0 && <div style={{ color: "#cbd5e1", fontSize: 12, padding: 14, gridColumn: "1 / -1" }}>등록된 링크가 없습니다.</div>}
      </div>

      {isAdmin && (
        <div style={{ border: "1px dashed #c7d2fe", borderRadius: 10, padding: 12, background: "#f8faff" }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "#4338ca", marginBottom: 7 }}>＋ 바로가기 추가</div>
          <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 1fr auto", gap: 7, alignItems: "center" }}>
            <input value={nf.icon} onChange={(e) => setNf({ ...nf, icon: e.target.value })} placeholder="🔗" style={{ ...inp, textAlign: "center" }} />
            <input value={nf.label} onChange={(e) => setNf({ ...nf, label: e.target.value })} placeholder="이름" style={inp} />
            <input value={nf.url} onChange={(e) => setNf({ ...nf, url: e.target.value })} placeholder="https://…" style={inp} />
            <button onClick={add} style={btn("#6366f1")}>추가</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 직원 관리 (관리자) ────────────────────────────────────────────────────────
function AdminSection({ humans, me, departments, reload }) {
  const [adding, setAdding] = useState(false);
  const [nf, setNf] = useState({ name: "", email: "", title: "", deptId: "", role: "member" });
  const [msg, setMsg] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  const patch = async (id, body) => { await fetch(`${API}/api/humans/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {}); reload(); };
  const del = async (id) => { await fetch(`${API}/api/humans/${id}`, { method: "DELETE" }).catch(() => {}); setConfirmDel(null); reload(); };
  const add = async () => {
    setMsg("");
    if (!nf.name.trim() || !nf.email.trim()) return setMsg("이름·이메일을 입력하세요");
    const r = await fetch(`${API}/api/humans`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nf) });
    const j = await r.json();
    if (!r.ok) return setMsg(j.error || "추가 실패");
    setNf({ name: "", email: "", title: "", deptId: "", role: "member" }); setAdding(false); reload();
  };
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={h2}>🛡️ 직원 관리</div>
        <button onClick={() => { setAdding((v) => !v); setMsg(""); }} style={{ ...btn("#16a34a"), padding: "5px 11px", fontSize: 11.5, marginLeft: "auto" }}>{adding ? "취소" : "+ 직원 추가"}</button>
      </div>
      <div style={sub}>추가·권한·차단/해제·삭제. 첫 로그인 때 본인이 비번을 정합니다.</div>

      {adding && (
        <div style={{ border: "1px solid #c7d2fe", background: "#eef2ff", borderRadius: 10, padding: 11, marginBottom: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 7 }}>
            <input value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} placeholder="이름" style={inp} />
            <input value={nf.email} onChange={(e) => setNf({ ...nf, email: e.target.value })} placeholder="이메일" style={inp} />
            <input value={nf.title} onChange={(e) => setNf({ ...nf, title: e.target.value })} placeholder="직책" style={inp} />
            <select value={nf.deptId} onChange={(e) => setNf({ ...nf, deptId: e.target.value })} style={inp}><option value="">미지정</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
            <select value={nf.role} onChange={(e) => setNf({ ...nf, role: e.target.value })} style={inp}><option value="member">일반</option><option value="admin">관리자</option></select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={add} style={btn("#6366f1")}>추가</button>
            {msg && <span style={{ fontSize: 11, color: "#dc2626" }}>{msg}</span>}
          </div>
        </div>
      )}

      <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
        {humans.map((h) => {
          const self = h.id === me.id;
          return (
            <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid #f1f5f9", fontSize: 11.5 }}>
              <span style={{ fontSize: 16 }}>{h.avatar || "👤"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: "#1e293b" }}>{h.name}{self && <span style={{ fontSize: 10, color: "#6366f1", marginLeft: 4 }}>(나)</span>}</div>
                <div style={{ fontSize: 10, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.email || "—"}</div>
              </div>
              <button onClick={() => !self && patch(h.id, { role: h.role === "admin" ? "member" : "admin" })} disabled={self} title={self ? "본인 권한은 변경 불가" : "클릭하여 변경"}
                style={{ ...gbtn, cursor: self ? "default" : "pointer", color: h.role === "admin" ? "#6366f1" : "#64748b", background: h.role === "admin" ? "#eef2ff" : "#fff", opacity: self ? 0.6 : 1, width: 60, textAlign: "center" }}>{h.role === "admin" ? "관리자" : "일반"}</button>
              <span style={{ fontSize: 10, fontWeight: 700, color: h.status === "blocked" ? "#dc2626" : "#16a34a", width: 40, textAlign: "center" }}>{h.status === "blocked" ? "차단" : "정상"}</span>
              {!self && <button onClick={() => patch(h.id, { status: h.status === "blocked" ? "active" : "blocked" })} style={{ ...gbtn, color: h.status === "blocked" ? "#16a34a" : "#d97706" }}>{h.status === "blocked" ? "해제" : "차단"}</button>}
              {!self && (confirmDel === h.id
                ? <button onClick={() => del(h.id)} style={{ ...gbtn, color: "#fff", background: "#dc2626", border: "none" }}>삭제확인</button>
                : <button onClick={() => setConfirmDel(h.id)} style={{ ...gbtn, color: "#dc2626" }}>삭제</button>)}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 8, lineHeight: 1.5 }}>· 차단된 직원은 로그인 불가 · 본인 계정은 권한 변경·차단·삭제 불가</div>
    </div>
  );
}
