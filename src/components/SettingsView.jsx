import { useState, useEffect } from "react";

// ════════════════════════════════════════════════════════════════════════════
// 설정 — 내 프로필 / 구성원 명부 / (관리자) 직원 관리
//   "나" = 로그인한 사용자(localStorage authUser). 관리자만 직원 관리 노출.
// ════════════════════════════════════════════════════════════════════════════

const API = "";
const AVATARS = ["👤", "👩‍💼", "👨‍💻", "🎬", "🎨", "⚡", "📋", "🧑‍🎨", "🧑‍💻", "🧑‍🔧", "👩‍🎤", "🦸", "🐱", "🐶", "🦊", "🐻", "🦁", "🐯", "🐰", "🐵", "🚀", "⭐", "🔥", "💡"];
const inp = { width: "100%", boxSizing: "border-box", border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 11px", fontSize: 13, outline: "none", color: "#1e293b" };
const lab = { fontSize: 11.5, fontWeight: 700, color: "#475569", marginBottom: 4, display: "block" };
const btn = (c) => ({ border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", background: c, color: "#fff" });
const gbtn = { border: "1px solid #e2e8f0", background: "#fff", color: "#475569", borderRadius: 7, padding: "5px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer" };
const h2 = { fontSize: 17, fontWeight: 800, color: "#1e293b", marginBottom: 4 };
const sub = { fontSize: 12, color: "#94a3b8", marginBottom: 20 };

const getMe = () => { try { return JSON.parse(localStorage.getItem("authUser") || "null"); } catch { return null; } };
const deptName = (deps, id) => (deps.find((d) => d.id === id) || {}).name || "";

export default function SettingsView({ departments = [], onHumansChange }) {
  const me = getMe();
  const isAdmin = me?.role === "admin";
  const [sec, setSec] = useState("profile");
  const [humans, setHumans] = useState([]);
  const reload = () => fetch(`${API}/api/humans`).then((r) => r.json()).then((d) => { setHumans(Array.isArray(d) ? d : []); onHumansChange?.(); }).catch(() => {});
  useEffect(() => { reload(); }, []);

  const SECTIONS = [["profile", "⚙️", "내 프로필"], ["members", "👥", "구성원 명부"], ...(isAdmin ? [["admin", "🛡️", "직원 관리"]] : [])];

  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0, background: "#f1f5f9" }}>
      <div style={{ width: 196, flexShrink: 0, background: "#fff", borderRight: "1px solid #e2e8f0", padding: "12px 10px" }}>
        {SECTIONS.map(([k, e, l]) => (
          <div key={k} onClick={() => setSec(k)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8, cursor: "pointer", marginBottom: 3, fontSize: 13, fontWeight: sec === k ? 700 : 500, color: sec === k ? "#4338ca" : "#475569", background: sec === k ? "#eef2ff" : "transparent" }}>
            <span>{e}</span>{l}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "24px 30px 60px", background: "#fff" }}>
        {!me ? <div style={{ color: "#94a3b8" }}>로그인이 필요합니다.</div>
          : sec === "profile" ? <ProfileSection me={me} departments={departments} onSaved={reload} />
            : sec === "members" ? <MembersSection humans={humans} departments={departments} />
              : sec === "admin" && isAdmin ? <AdminSection humans={humans} me={me} departments={departments} reload={reload} />
                : null}
      </div>
    </div>
  );
}

// ── 내 프로필 ────────────────────────────────────────────────────────────────
function ProfileSection({ me, departments, onSaved }) {
  const [f, setF] = useState({ name: me.name || "", avatar: me.avatar || "👤", title: me.title || "", deptId: me.deptId || "", phone: me.phone || "", bio: me.bio || "", mood: me.mood || "" });
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
      setMsg("저장되었습니다 ✓"); onSaved?.();
      setTimeout(() => setMsg(""), 2500);
    } catch { setMsg("서버에 연결할 수 없습니다"); }
  };
  return (
    <div style={{ maxWidth: 580 }}>
      <div style={h2}>⚙️ 내 프로필</div>
      <div style={sub}>내 정보를 직접 수정합니다. 저장하면 게시판·전자결재의 ‘나’에도 반영됩니다.</div>

      {/* 아바타 */}
      <label style={lab}>아바타</label>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, flexShrink: 0 }}>{f.avatar}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {AVATARS.map((a) => <span key={a} onClick={() => set("avatar", a)} style={{ fontSize: 20, padding: 3, borderRadius: 7, cursor: "pointer", background: f.avatar === a ? "#e0e7ff" : "transparent" }}>{a}</span>)}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div><label style={lab}>이름</label><input value={f.name} onChange={(e) => set("name", e.target.value)} style={inp} /></div>
        <div><label style={lab}>직책</label><input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="예: 영상 PD" style={inp} /></div>
        <div><label style={lab}>부서</label>
          <select value={f.deptId} onChange={(e) => set("deptId", e.target.value)} style={inp}>
            <option value="">미지정</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div><label style={lab}>연락처</label><input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="010-0000-0000" style={inp} /></div>
        <div><label style={lab}>이메일 <span style={{ color: "#cbd5e1", fontWeight: 400 }}>(로그인 ID · 변경 불가)</span></label><input value={me.email || ""} disabled style={{ ...inp, background: "#f8fafc", color: "#94a3b8" }} /></div>
        <div><label style={lab}>상태 / 무드</label><input value={f.mood} onChange={(e) => set("mood", e.target.value)} placeholder="예: 집중모드 🎯" style={inp} /></div>
      </div>
      <div style={{ marginBottom: 18 }}><label style={lab}>한 줄 소개</label><textarea value={f.bio} onChange={(e) => set("bio", e.target.value)} placeholder="간단한 소개" style={{ ...inp, minHeight: 56, resize: "vertical" }} /></div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={save} style={btn("#6366f1")}>저장</button>
        {msg && <span style={{ fontSize: 12.5, fontWeight: 600, color: msg.includes("✓") ? "#16a34a" : "#dc2626" }}>{msg}</span>}
      </div>
    </div>
  );
}

// ── 구성원 명부 ──────────────────────────────────────────────────────────────
function MembersSection({ humans, departments }) {
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const list = humans.filter((h) => (!q || (`${h.name} ${h.title} ${h.email}`).toLowerCase().includes(q.toLowerCase())) && (!dept || h.deptId === dept));
  return (
    <div>
      <div style={h2}>👥 구성원 명부 <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>· {humans.length}명</span></div>
      <div style={sub}>전체 구성원의 직책·연락처를 한눈에 봅니다.</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 이름·직책·이메일" style={{ ...inp, width: 220 }} />
        <select value={dept} onChange={(e) => setDept(e.target.value)} style={{ ...inp, width: 150 }}>
          <option value="">전체 부서</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12 }}>
        {list.map((h) => (
          <div key={h.id} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 16px", background: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: (h.color || "#6366f1") + "1c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21, flexShrink: 0 }}>{h.avatar || "👤"}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{h.name}
                  {h.role === "admin" && <span style={{ fontSize: 8.5, background: "#ede9fe", color: "#6366f1", padding: "1px 5px", borderRadius: 7, fontWeight: 700, marginLeft: 6 }}>관리자</span>}
                  {h.status === "blocked" && <span style={{ fontSize: 8.5, background: "#fee2e2", color: "#dc2626", padding: "1px 5px", borderRadius: 7, fontWeight: 700, marginLeft: 6 }}>차단</span>}
                </div>
                <div style={{ fontSize: 11.5, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.title || "—"}{deptName(departments, h.deptId) ? ` · ${deptName(departments, h.deptId)}` : ""}</div>
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: "#475569", lineHeight: 1.7 }}>
              {h.email && <div>📧 {h.email}</div>}
              {h.phone && <div>📞 {h.phone}</div>}
              {h.bio && <div style={{ color: "#94a3b8", marginTop: 3 }}>{h.bio}</div>}
            </div>
          </div>
        ))}
        {list.length === 0 && <div style={{ color: "#cbd5e1", fontSize: 13, padding: 30 }}>결과 없음</div>}
      </div>
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
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div style={h2}>🛡️ 직원 관리</div>
        <button onClick={() => { setAdding((v) => !v); setMsg(""); }} style={{ ...btn("#16a34a"), padding: "6px 12px", fontSize: 12, marginLeft: "auto" }}>{adding ? "취소" : "+ 직원 추가"}</button>
      </div>
      <div style={sub}>직원 추가, 권한(관리자/일반), 차단/해제, 삭제. 추가된 직원은 첫 로그인 때 본인이 비밀번호를 정합니다.</div>

      {adding && (
        <div style={{ border: "1px solid #c7d2fe", background: "#eef2ff", borderRadius: 12, padding: 16, marginBottom: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div><label style={lab}>이름</label><input value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} style={inp} /></div>
            <div><label style={lab}>이메일(로그인 ID)</label><input value={nf.email} onChange={(e) => setNf({ ...nf, email: e.target.value })} style={inp} /></div>
            <div><label style={lab}>직책</label><input value={nf.title} onChange={(e) => setNf({ ...nf, title: e.target.value })} style={inp} /></div>
            <div><label style={lab}>부서</label><select value={nf.deptId} onChange={(e) => setNf({ ...nf, deptId: e.target.value })} style={inp}><option value="">미지정</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
            <div><label style={lab}>권한</label><select value={nf.role} onChange={(e) => setNf({ ...nf, role: e.target.value })} style={inp}><option value="member">일반</option><option value="admin">관리자</option></select></div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={add} style={btn("#6366f1")}>추가</button>
            {msg && <span style={{ fontSize: 12, color: "#dc2626" }}>{msg}</span>}
          </div>
        </div>
      )}

      <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontSize: 11, color: "#94a3b8", fontWeight: 600, padding: "8px 14px" }}>
          <span style={{ flex: 1 }}>직원</span><span style={{ width: 90, textAlign: "center" }}>권한</span><span style={{ width: 80, textAlign: "center" }}>상태</span><span style={{ width: 150, textAlign: "center" }}>관리</span>
        </div>
        {humans.map((h) => {
          const self = h.id === me.id;
          return (
            <div key={h.id} style={{ display: "flex", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid #f1f5f9", fontSize: 12.5 }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                <span style={{ fontSize: 18 }}>{h.avatar || "👤"}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: "#1e293b" }}>{h.name}{self && <span style={{ fontSize: 10, color: "#6366f1", marginLeft: 5 }}>(나)</span>}</div>
                  <div style={{ fontSize: 10.5, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.email || "이메일 없음"}</div>
                </div>
              </div>
              <span style={{ width: 90, textAlign: "center" }}>
                <button onClick={() => !self && patch(h.id, { role: h.role === "admin" ? "member" : "admin" })} disabled={self} title={self ? "본인 권한은 변경 불가" : "클릭하여 변경"}
                  style={{ ...gbtn, cursor: self ? "default" : "pointer", color: h.role === "admin" ? "#6366f1" : "#64748b", background: h.role === "admin" ? "#eef2ff" : "#fff", opacity: self ? 0.6 : 1 }}>{h.role === "admin" ? "관리자" : "일반"}</button>
              </span>
              <span style={{ width: 80, textAlign: "center" }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: h.status === "blocked" ? "#dc2626" : "#16a34a" }}>{h.status === "blocked" ? "차단됨" : "정상"}</span>
              </span>
              <span style={{ width: 150, textAlign: "center", display: "flex", gap: 5, justifyContent: "center" }}>
                {!self && <button onClick={() => patch(h.id, { status: h.status === "blocked" ? "active" : "blocked" })} style={{ ...gbtn, color: h.status === "blocked" ? "#16a34a" : "#d97706" }}>{h.status === "blocked" ? "해제" : "차단"}</button>}
                {!self && (confirmDel === h.id
                  ? <button onClick={() => del(h.id)} style={{ ...gbtn, color: "#fff", background: "#dc2626", border: "none" }}>삭제확인</button>
                  : <button onClick={() => setConfirmDel(h.id)} style={{ ...gbtn, color: "#dc2626" }}>삭제</button>)}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 10, lineHeight: 1.6 }}>· 차단된 직원은 로그인할 수 없습니다(해제하면 다시 가능). · 본인 계정은 권한 변경·차단·삭제할 수 없습니다.</div>
    </div>
  );
}
