import { useState, useEffect } from "react";
import OfficeScene from "./OfficeScene";

// ════════════════════════════════════════════════════════════════════════════
// 설정 및 오피스 — 좌(설정·정보) + 우(2.5D 오피스)
//   섹션: 내 프로필 / 알림·테마 / 부재중·대리결재 / 구성원·조직도 / 회사정보 /
//         바로가기 / 부서관리(관리자) / 직원관리(관리자) / 사내공지(관리자) /
//         가입코드(관리자) / 공휴일(관리자) / 외부 협력사(관리자)
//   권한: 회사정보·바로가기 = 보기는 일반도 가능, 수정은 관리자만
//         부서·직원관리·공지·가입코드·공휴일·협력사 = 관리자 탭 자체 노출
// ════════════════════════════════════════════════════════════════════════════

const API = "";
const AVATARS = ["👤", "👩‍💼", "👨‍💻", "🎬", "🎨", "⚡", "📋", "🧑‍🎨", "🧑‍💻", "🧑‍🔧", "👩‍🎤", "🦸", "🐱", "🐶", "🦊", "🐻", "🦁", "🐯", "🐰", "🐵", "🚀", "⭐", "🔥", "💡"];
const inp = { width: "100%", boxSizing: "border-box", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, outline: "none", color: "#1e293b" };
const lab = { fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 4, display: "block" };
const btn = (c) => ({ border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", background: c, color: "#fff" });
const gbtn = { border: "1px solid #e2e8f0", background: "#fff", color: "#475569", borderRadius: 7, padding: "4px 9px", fontSize: 11, fontWeight: 600, cursor: "pointer" };
const h2 = { fontSize: 15, fontWeight: 800, color: "#1e293b", marginBottom: 4 };
const sub = { fontSize: 11.5, color: "#94a3b8", marginBottom: 14 };
const card = { border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, marginBottom: 12, background: "#fff" };

const getMe = () => { try { return JSON.parse(localStorage.getItem("authUser") || "null"); } catch { return null; } };
const deptName = (deps, id) => (deps.find((d) => d.id === id) || {}).name || "";

export default function SettingsView({ departments = [], onHumansChange }) {
  const me = getMe();
  const isAdmin = me?.role === "admin";
  const [sec, setSec] = useState("profile");
  const [humans, setHumans] = useState([]);
  const [company, setCompany] = useState({ name: "", links: [], sns: {}, notice: { on: false } });
  const [partners, setPartners] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [deps, setDeps] = useState(departments);

  const reload = () => {
    fetch(`${API}/api/humans`).then((r) => r.json()).then((d) => { setHumans(Array.isArray(d) ? d : []); onHumansChange?.(); }).catch(() => {});
    fetch(`${API}/api/company`).then((r) => r.json()).then((d) => setCompany(d || { name: "", links: [], sns: {}, notice: { on: false } })).catch(() => {});
    fetch(`${API}/api/partners`).then((r) => r.json()).then((d) => setPartners(Array.isArray(d) ? d : [])).catch(() => {});
    fetch(`${API}/api/holidays`).then((r) => r.json()).then((d) => setHolidays(Array.isArray(d) ? d : [])).catch(() => {});
    fetch(`${API}/api/departments`).then((r) => r.json()).then((d) => setDeps(Array.isArray(d) ? d : [])).catch(() => {});
  };
  useEffect(() => { reload(); }, []);
  useEffect(() => { setDeps(departments); }, [departments]);

  // SSE 자동 갱신
  useEffect(() => {
    const es = new EventSource(`${API}/api/stream`);
    es.onmessage = (e) => {
      try {
        const m = JSON.parse(e.data);
        if (m.type !== "data_update") return;
        if (["humans", "company", "partners", "holidays", "departments"].includes(m.resource)) reload();
      } catch {}
    };
    return () => es.close();
  }, []);

  // 섹션 정의 (개인/공통/관리)
  const SEC_PERSONAL = [
    ["profile",  "⚙️", "내 프로필"],
    ["prefs",    "🔔", "알림·테마"],
    ["away",     "🏖", "부재중·대리결재"],
  ];
  const SEC_COMMON = [
    ["members",  "👥", "구성원·조직도"],
    ["company",  "🏢", "회사 정보"],
    ["links",    "🔗", "바로가기"],
  ];
  const SEC_ADMIN = !isAdmin ? [] : [
    ["dept",     "🏗", "부서 관리"],
    ["admin",    "🛡️", "직원 관리"],
    ["notice",   "📢", "사내 공지"],
    ["code",     "🎯", "가입코드"],
    ["holidays", "🇰🇷", "공휴일"],
    ["partners", "🤝", "외부 협력사"],
  ];

  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0, background: "#f1f5f9" }}>
      {/* 좌측 : 설정·정보 */}
      <div style={{ width: 580, flexShrink: 0, display: "flex", minHeight: 0, background: "#fff", borderRight: "1px solid #e2e8f0" }}>
        <div style={{ width: 170, flexShrink: 0, borderRight: "1px solid #e2e8f0", padding: "10px 8px 20px", background: "#fafbfd", overflowY: "auto" }}>
          <SecGroup title="개인" sections={SEC_PERSONAL} sec={sec} setSec={setSec} />
          <SecGroup title="공통" sections={SEC_COMMON} sec={sec} setSec={setSec} />
          {SEC_ADMIN.length > 0 && <SecGroup title="관리자" sections={SEC_ADMIN} sec={sec} setSec={setSec} />}
        </div>
        <div style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "18px 22px 60px" }}>
          {!me ? <div style={{ color: "#94a3b8" }}>로그인이 필요합니다.</div>
            : sec === "profile"  ? <ProfileSection me={me} departments={deps} onSaved={reload} />
            : sec === "prefs"    ? <PrefsSection me={me} onSaved={reload} />
            : sec === "away"     ? <AwaySection me={me} humans={humans} onSaved={reload} />
            : sec === "members"  ? <MembersSection humans={humans} departments={deps} />
            : sec === "company"  ? <CompanySection company={company} isAdmin={isAdmin} onSaved={reload} />
            : sec === "links"    ? <LinksSection company={company} isAdmin={isAdmin} onSaved={reload} />
            : sec === "dept"     ? <DeptSection deps={deps} humans={humans} reload={reload} />
            : sec === "admin"    ? <AdminSection humans={humans} me={me} departments={deps} reload={reload} />
            : sec === "notice"   ? <NoticeSection company={company} onSaved={reload} />
            : sec === "code"     ? <CodeSection onSaved={reload} />
            : sec === "holidays" ? <HolidaysSection holidays={holidays} reload={reload} />
            : sec === "partners" ? <PartnersSection partners={partners} reload={reload} />
            : null}
        </div>
      </div>

      {/* 우측 : 2.5D 오피스 */}
      <div style={{ flex: 1, minWidth: 0, position: "relative", background: "linear-gradient(180deg,#e0f2fe,#f1f5f9)", overflow: "hidden" }}>
        <OfficeScene me={me} humans={humans} departments={deps} />
      </div>
    </div>
  );
}

function SecGroup({ title, sections, sec, setSec }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 9.5, fontWeight: 800, color: "#94a3b8", letterSpacing: 0.6, padding: "6px 11px 4px" }}>{title.toUpperCase()}</div>
      {sections.map(([k, e, l]) => (
        <div key={k} onClick={() => setSec(k)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 11px", borderRadius: 8, cursor: "pointer", marginBottom: 2, fontSize: 12.5, fontWeight: sec === k ? 800 : 500, color: sec === k ? "#4338ca" : "#475569", background: sec === k ? "#eef2ff" : "transparent" }}>
          <span>{e}</span>{l}
        </div>
      ))}
    </div>
  );
}

// ── 내 프로필 ─────────────────────────────────────────────────────────────────
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
    </div>
  );
}

// ── 알림·테마 ──────────────────────────────────────────────────────────────
function PrefsSection({ me, onSaved }) {
  const [prefs, setPrefs] = useState(me.notifPrefs || { mention: true, comment: true, approval: true, notice: true, daily: true });
  const [theme, setTheme] = useState(me.theme || "light");
  const [msg, setMsg] = useState("");
  const save = async () => {
    setMsg("");
    try {
      await fetch(`${API}/api/humans/${me.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notifPrefs: prefs, theme }) });
      localStorage.setItem("authUser", JSON.stringify({ ...me, notifPrefs: prefs, theme }));
      // 다크모드 즉시 적용
      document.documentElement.dataset.theme = theme;
      setMsg("저장됨 ✓"); onSaved?.();
      setTimeout(() => setMsg(""), 2000);
    } catch { setMsg("실패"); }
  };
  const ITEMS = [["mention", "🔔 멘션(@나)"], ["comment", "💬 내 글에 댓글"], ["approval", "🖋 결재 차례"], ["notice", "📢 공지"], ["daily", "✅ 일과 리마인더"]];
  return (
    <div>
      <div style={h2}>🔔 알림 · 테마</div>
      <div style={sub}>받을 알림과 화면 테마를 설정합니다.</div>
      <div style={card}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: "#1e293b", marginBottom: 9 }}>받을 알림</div>
        {ITEMS.map(([k, l]) => (
          <label key={k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 12.5, color: "#475569", cursor: "pointer" }}>
            <input type="checkbox" checked={!!prefs[k]} onChange={(e) => setPrefs({ ...prefs, [k]: e.target.checked })} />{l}
          </label>
        ))}
      </div>
      <div style={card}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: "#1e293b", marginBottom: 9 }}>화면 테마</div>
        <div style={{ display: "flex", gap: 8 }}>
          {[["light", "☀️ 라이트"], ["dark", "🌙 다크 (베타)"]].map(([k, l]) => (
            <button key={k} onClick={() => setTheme(k)} style={{ flex: 1, border: "1px solid " + (theme === k ? "#6366f1" : "#e2e8f0"), background: theme === k ? "#eef2ff" : "#fff", color: theme === k ? "#4338ca" : "#475569", padding: "9px 12px", fontSize: 12.5, fontWeight: 700, borderRadius: 8, cursor: "pointer" }}>{l}</button>
          ))}
        </div>
        <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 7 }}>※ 다크 베타: 일부 화면만 어둡게 적용됩니다.</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={save} style={btn("#6366f1")}>저장</button>
        {msg && <span style={{ fontSize: 11.5, fontWeight: 600, color: msg.includes("✓") ? "#16a34a" : "#dc2626" }}>{msg}</span>}
      </div>
    </div>
  );
}

// ── 부재중·대리결재 ────────────────────────────────────────────────────────────
function AwaySection({ me, humans, onSaved }) {
  const [f, setF] = useState({ away: me.away || false, awayFrom: me.awayFrom || "", awayTo: me.awayTo || "", awayReason: me.awayReason || "", delegateId: me.delegateId || "" });
  const [msg, setMsg] = useState("");
  const others = humans.filter((h) => h.id !== me.id && h.status !== "blocked");
  const save = async () => {
    setMsg("");
    try {
      await fetch(`${API}/api/humans/${me.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      localStorage.setItem("authUser", JSON.stringify({ ...me, ...f }));
      setMsg("저장됨 ✓"); onSaved?.(); setTimeout(() => setMsg(""), 2000);
    } catch { setMsg("실패"); }
  };
  return (
    <div>
      <div style={h2}>🏖 부재중 · 대리결재</div>
      <div style={sub}>휴가·외근 시 자동 응답 + 결재 대리인 지정. 부재 기간에 들어온 결재는 대리인이 처리합니다.</div>
      <div style={card}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
          <input type="checkbox" checked={f.away} onChange={(e) => setF({ ...f, away: e.target.checked })} />
          🏖 부재중으로 설정
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div><label style={lab}>시작일</label><input type="date" value={f.awayFrom} onChange={(e) => setF({ ...f, awayFrom: e.target.value })} style={inp} /></div>
          <div><label style={lab}>복귀일</label><input type="date" value={f.awayTo} onChange={(e) => setF({ ...f, awayTo: e.target.value })} style={inp} /></div>
        </div>
        <div style={{ marginBottom: 10 }}><label style={lab}>대리결재자</label>
          <select value={f.delegateId} onChange={(e) => setF({ ...f, delegateId: e.target.value })} style={inp}>
            <option value="">지정 안 함</option>
            {others.map((h) => <option key={h.id} value={h.id}>{h.avatar} {h.name}{h.title ? ` · ${h.title}` : ""}</option>)}
          </select>
        </div>
        <div><label style={lab}>부재 사유 (자동응답에 포함)</label><textarea value={f.awayReason} onChange={(e) => setF({ ...f, awayReason: e.target.value })} placeholder="예: 6/10~6/14 휴가입니다. 긴급 시 010-…" style={{ ...inp, minHeight: 60, resize: "vertical" }} /></div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={save} style={btn("#6366f1")}>저장</button>
        {msg && <span style={{ fontSize: 11.5, fontWeight: 600, color: msg.includes("✓") ? "#16a34a" : "#dc2626" }}>{msg}</span>}
      </div>
    </div>
  );
}

// ── 구성원 + 조직도 ──────────────────────────────────────────────────────────
function MembersSection({ humans, departments }) {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState("dir");
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 9 }}>
            {list.map((h) => (
              <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: (h.color || "#6366f1") + "1c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{h.avatar || "👤"}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}
                    {h.role === "admin" && <span style={{ fontSize: 8.5, background: "#ede9fe", color: "#6366f1", padding: "1px 5px", borderRadius: 6, fontWeight: 700, marginLeft: 5 }}>관리자</span>}
                    {h.away && <span style={{ fontSize: 8.5, background: "#fef3c7", color: "#d97706", padding: "1px 5px", borderRadius: 6, fontWeight: 700, marginLeft: 5 }}>부재</span>}
                  </div>
                  <div style={{ fontSize: 10.5, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.title || "—"}{deptName(departments, h.deptId) ? ` · ${deptName(departments, h.deptId)}` : ""}</div>
                  {h.phone && <div style={{ fontSize: 10, color: "#94a3b8" }}>📞 {h.phone}</div>}
                  {h.email && <div style={{ fontSize: 10, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📧 {h.email}</div>}
                </div>
              </div>
            ))}
            {list.length === 0 && <div style={{ color: "#cbd5e1", fontSize: 12.5, padding: 20, textAlign: "center" }}>결과 없음</div>}
          </div>
        </>
      ) : (
        <OrgChart byDept={byDept} noDept={noDept} />
      )}
    </div>
  );
}

// 조직도 그림 (회사 → 부서 → 직원)
function OrgChart({ byDept, noDept }) {
  return (
    <div style={{ background: "#fafbfd", border: "1px solid #e2e8f0", borderRadius: 12, padding: "20px 14px", overflowX: "auto" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
        <div style={{ background: "#6366f1", color: "#fff", padding: "10px 22px", borderRadius: 10, fontSize: 14, fontWeight: 800 }}>🏢 회사</div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
        {byDept.map((d) => (
          <div key={d.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 160 }}>
            <div style={{ width: 2, height: 14, background: "#cbd5e1" }} />
            <div style={{ background: "#fff", border: "2px solid " + (d.color || "#6366f1"), color: d.color || "#475569", padding: "7px 14px", borderRadius: 10, fontSize: 12.5, fontWeight: 800 }}>
              {d.name} <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 500 }}>· {d.members.length}</span>
            </div>
            <div style={{ width: 2, height: 10, background: d.members.length ? "#cbd5e1" : "transparent" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 130 }}>
              {d.members.map((m) => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #e2e8f0", padding: "5px 9px", borderRadius: 8, fontSize: 11.5 }}>
                  <span>{m.avatar}</span>
                  <span style={{ fontWeight: 700, color: "#1e293b" }}>{m.name}</span>
                  <span style={{ color: "#94a3b8", fontSize: 10 }}>{m.title}</span>
                </div>
              ))}
              {!d.members.length && <div style={{ fontSize: 10.5, color: "#cbd5e1", textAlign: "center" }}>—</div>}
            </div>
          </div>
        ))}
      </div>
      {noDept.length > 0 && (
        <div style={{ marginTop: 16, padding: "10px 12px", border: "1px dashed #cbd5e1", borderRadius: 10, background: "#fff" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 5 }}>미지정 · {noDept.length}명</div>
          {noDept.map((h) => <div key={h.id} style={{ fontSize: 12, color: "#475569", padding: "2px 0" }}>{h.avatar} {h.name}</div>)}
        </div>
      )}
    </div>
  );
}

// ── 회사 정보 (대폭 확장) ─────────────────────────────────────────────────────
function CompanySection({ company, isAdmin, onSaved }) {
  const [f, setF] = useState(company);
  const [msg, setMsg] = useState("");
  useEffect(() => setF({ ...company, sns: company.sns || {} }), [company.name]);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const setS = (k, v) => setF((p) => ({ ...p, sns: { ...(p.sns || {}), [k]: v } }));
  const save = async () => {
    if (!isAdmin) return;
    setMsg("");
    try {
      const r = await fetch(`${API}/api/company`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      if (!r.ok) return setMsg("저장 실패");
      setMsg("저장됨 ✓"); onSaved?.(); setTimeout(() => setMsg(""), 2000);
    } catch { setMsg("실패"); }
  };
  const ro = !isAdmin;
  const I = (p) => ({ ...inp, background: ro ? "#f8fafc" : "#fff", ...(p || {}) });
  return (
    <div>
      <div style={h2}>🏢 회사 정보 {ro && <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>· 보기 전용</span>}</div>
      <div style={sub}>기본 정보·SNS·금융·규정 등. 전자결재 문서 머리글에 자동 반영됩니다.</div>

      {/* 기본 */}
      <div style={card}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#4338ca", marginBottom: 9 }}>📌 기본</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><label style={lab}>회사명</label><input value={f.name || ""} onChange={(e) => set("name", e.target.value)} disabled={ro} style={I()} /></div>
          <div><label style={lab}>대표</label><input value={f.ceo || ""} onChange={(e) => set("ceo", e.target.value)} disabled={ro} style={I()} /></div>
          <div><label style={lab}>설립일</label><input type="date" value={f.founded || ""} onChange={(e) => set("founded", e.target.value)} disabled={ro} style={I()} /></div>
          <div><label style={lab}>업종 / 사업분야</label><input value={f.industry || ""} onChange={(e) => set("industry", e.target.value)} disabled={ro} placeholder="콘텐츠 제작·마케팅" style={I()} /></div>
          <div style={{ gridColumn: "1 / -1" }}><label style={lab}>주소</label><input value={f.address || ""} onChange={(e) => set("address", e.target.value)} disabled={ro} style={I()} /></div>
          <div><label style={lab}>사업자번호</label><input value={f.bizno || ""} onChange={(e) => set("bizno", e.target.value)} disabled={ro} placeholder="000-00-00000" style={I()} /></div>
          <div><label style={lab}>대표 연락처</label><input value={f.phone || ""} onChange={(e) => set("phone", e.target.value)} disabled={ro} style={I()} /></div>
          <div><label style={lab}>대표 이메일</label><input value={f.email || ""} onChange={(e) => set("email", e.target.value)} disabled={ro} style={I()} /></div>
          <div><label style={lab}>회사 홈페이지</label><input value={f.homepage || ""} onChange={(e) => set("homepage", e.target.value)} disabled={ro} placeholder="https://…" style={I()} /></div>
        </div>
      </div>

      {/* 브랜드 */}
      <div style={card}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#4338ca", marginBottom: 9 }}>🎨 브랜드</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><label style={lab}>로고 (이모지/URL)</label><input value={f.logo || ""} onChange={(e) => set("logo", e.target.value)} disabled={ro} placeholder="🏢 또는 https://…/logo.png" style={I()} /></div>
          <div><label style={lab}>직인 이미지 (URL/data)</label><input value={f.seal || ""} onChange={(e) => set("seal", e.target.value)} disabled={ro} placeholder="전자결재 (인) 자리에 표시" style={I()} /></div>
          <div style={{ gridColumn: "1 / -1" }}><label style={lab}>슬로건</label><input value={f.slogan || ""} onChange={(e) => set("slogan", e.target.value)} disabled={ro} placeholder="콘텐츠로 잇다" style={I()} /></div>
          <div style={{ gridColumn: "1 / -1" }}><label style={lab}>회사 비전 / 미션</label><textarea value={f.vision || ""} onChange={(e) => set("vision", e.target.value)} disabled={ro} style={{ ...I(), minHeight: 60, resize: "vertical" }} /></div>
          <div style={{ gridColumn: "1 / -1" }}><label style={lab}>회사 소개</label><textarea value={f.intro || ""} onChange={(e) => set("intro", e.target.value)} disabled={ro} style={{ ...I(), minHeight: 60, resize: "vertical" }} /></div>
        </div>
      </div>

      {/* SNS */}
      <div style={card}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#4338ca", marginBottom: 9 }}>📱 SNS · 채널</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><label style={lab}>📸 인스타그램</label><input value={f.sns?.instagram || ""} onChange={(e) => setS("instagram", e.target.value)} disabled={ro} style={I()} /></div>
          <div><label style={lab}>🎬 유튜브</label><input value={f.sns?.youtube || ""} onChange={(e) => setS("youtube", e.target.value)} disabled={ro} style={I()} /></div>
          <div><label style={lab}>📘 페이스북</label><input value={f.sns?.facebook || ""} onChange={(e) => setS("facebook", e.target.value)} disabled={ro} style={I()} /></div>
          <div><label style={lab}>📝 블로그</label><input value={f.sns?.blog || ""} onChange={(e) => setS("blog", e.target.value)} disabled={ro} style={I()} /></div>
          <div><label style={lab}>🐦 X (트위터)</label><input value={f.sns?.x || ""} onChange={(e) => setS("x", e.target.value)} disabled={ro} style={I()} /></div>
        </div>
      </div>

      {/* 금융 */}
      <div style={card}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#4338ca", marginBottom: 9 }}>💰 금융 (입금 받을 때)</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div><label style={lab}>은행</label><input value={f.accountBank || ""} onChange={(e) => set("accountBank", e.target.value)} disabled={ro} placeholder="국민" style={I()} /></div>
          <div><label style={lab}>계좌번호</label><input value={f.account || ""} onChange={(e) => set("account", e.target.value)} disabled={ro} placeholder="000-00-00000" style={I()} /></div>
          <div><label style={lab}>예금주</label><input value={f.accountHolder || ""} onChange={(e) => set("accountHolder", e.target.value)} disabled={ro} placeholder="(주)콘텐츠잇다" style={I()} /></div>
        </div>
      </div>

      {/* 영업 */}
      <div style={card}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#4338ca", marginBottom: 9 }}>🕘 영업 시간</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><label style={lab}>영업 시간</label><input value={f.hours || ""} onChange={(e) => set("hours", e.target.value)} disabled={ro} style={I()} /></div>
          <div><label style={lab}>정기 휴무</label><input value={f.holiday || ""} onChange={(e) => set("holiday", e.target.value)} disabled={ro} style={I()} /></div>
        </div>
      </div>

      {!ro && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={save} style={btn("#6366f1")}>저장</button>
          {msg && <span style={{ fontSize: 11.5, fontWeight: 600, color: msg.includes("✓") ? "#16a34a" : "#dc2626" }}>{msg}</span>}
        </div>
      )}
    </div>
  );
}

// ── 바로가기 (카테고리 묶음 + 그리드) ─────────────────────────────────────────
const LINK_CATS = [["work", "💼 업무", "#6366f1"], ["external", "🌐 외부", "#0ea5e9"], ["resource", "📁 자료", "#16a34a"], ["other", "🔖 기타", "#94a3b8"]];
function LinksSection({ company, isAdmin, onSaved }) {
  const [links, setLinks] = useState(company.links || []);
  const [nf, setNf] = useState({ label: "", url: "", icon: "🔗", cat: "work" });
  useEffect(() => setLinks(company.links || []), [company.links]);
  const save = async (list) => {
    setLinks(list);
    if (!isAdmin) return;
    await fetch(`${API}/api/company`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ links: list }) }).catch(() => {});
    onSaved?.();
  };
  const add = () => { if (!nf.label.trim() || !nf.url.trim()) return; save([...links, { ...nf, id: Date.now().toString(36) }]); setNf({ label: "", url: "", icon: "🔗", cat: "work" }); };
  const del = (id) => save(links.filter((l) => l.id !== id));
  const grouped = LINK_CATS.map(([k, l, c]) => ({ k, l, c, items: links.filter((x) => (x.cat || "other") === k) }));
  return (
    <div>
      <div style={h2}>🔗 바로가기 <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>· {links.length}</span></div>
      <div style={sub}>회사 공용 링크 모음 (카테고리별). {isAdmin ? "관리자 등록·삭제" : "관리자만 수정 가능"}</div>
      {grouped.map(({ k, l, c, items }) => (
        <div key={k} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: c, marginBottom: 7 }}>{l} <span style={{ color: "#cbd5e1", fontWeight: 500 }}>· {items.length}</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(170px,1fr))", gap: 8 }}>
            {items.map((x) => (
              <div key={x.id} style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, padding: "10px 11px", border: "1px solid " + c + "33", borderRadius: 10, background: c + "08", cursor: "pointer" }} onClick={() => window.open(x.url, "_blank")}>
                <span style={{ fontSize: 18 }}>{x.icon || "🔗"}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.label}</div>
                  <div style={{ fontSize: 10, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.url}</div>
                </div>
                {isAdmin && <span onClick={(e) => { e.stopPropagation(); del(x.id); }} style={{ position: "absolute", top: 3, right: 5, fontSize: 11, color: "#cbd5e1", cursor: "pointer" }}>✕</span>}
              </div>
            ))}
            {items.length === 0 && <div style={{ color: "#cbd5e1", fontSize: 11, padding: 8 }}>없음</div>}
          </div>
        </div>
      ))}
      {isAdmin && (
        <div style={{ border: "1px dashed #c7d2fe", borderRadius: 10, padding: 12, background: "#f8faff" }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "#4338ca", marginBottom: 7 }}>＋ 바로가기 추가</div>
          <div style={{ display: "grid", gridTemplateColumns: "55px 1fr 1fr 100px auto", gap: 7, alignItems: "center" }}>
            <input value={nf.icon} onChange={(e) => setNf({ ...nf, icon: e.target.value })} placeholder="🔗" style={{ ...inp, textAlign: "center" }} />
            <input value={nf.label} onChange={(e) => setNf({ ...nf, label: e.target.value })} placeholder="이름" style={inp} />
            <input value={nf.url} onChange={(e) => setNf({ ...nf, url: e.target.value })} placeholder="https://…" style={inp} />
            <select value={nf.cat} onChange={(e) => setNf({ ...nf, cat: e.target.value })} style={inp}>
              {LINK_CATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <button onClick={add} style={btn("#6366f1")}>추가</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 부서 관리 (관리자) ────────────────────────────────────────────────────────
const DEPT_COLORS = ["#f59e0b", "#38bdf8", "#f472b6", "#34d399", "#fb923c", "#a78bfa", "#ef4444", "#0ea5e9", "#16a34a"];
function DeptSection({ deps, humans, reload }) {
  const [nf, setNf] = useState({ name: "", color: DEPT_COLORS[0] });
  const [edit, setEdit] = useState(null);
  const add = async () => {
    if (!nf.name.trim()) return;
    await fetch(`${API}/api/departments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: nf.name.toLowerCase().replace(/\s+/g, "_"), name: nf.name.trim(), color: nf.color }) }).catch(() => {});
    setNf({ name: "", color: DEPT_COLORS[0] }); reload();
  };
  const patch = async (id, body) => { await fetch(`${API}/api/departments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {}); reload(); };
  const del = async (id) => { if (!confirm("이 부서를 삭제할까요? (소속 직원은 미지정으로)")) return; await fetch(`${API}/api/departments/${id}`, { method: "DELETE" }).catch(() => {}); reload(); };
  return (
    <div>
      <div style={h2}>🏗 부서 관리</div>
      <div style={sub}>부서 추가/이름·색 수정/삭제. 부서 색은 조직도·캘린더 등에 반영됩니다.</div>

      <div style={card}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#1e293b", marginBottom: 7 }}>＋ 부서 추가</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} placeholder="부서명" style={inp} />
          <select value={nf.color} onChange={(e) => setNf({ ...nf, color: e.target.value })} style={{ ...inp, width: 80, color: nf.color, fontWeight: 800 }}>
            {DEPT_COLORS.map((c) => <option key={c} value={c} style={{ color: c }}>■</option>)}
          </select>
          <button onClick={add} style={btn("#6366f1")}>추가</button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {deps.map((d) => {
          const count = humans.filter((h) => h.deptId === d.id).length;
          const editing = edit?.id === d.id;
          return (
            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 9, background: "#fff" }}>
              <span style={{ width: 16, height: 16, borderRadius: 5, background: d.color || "#94a3b8" }} />
              {editing
                ? <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} style={{ ...inp, flex: 1 }} />
                : <span style={{ flex: 1, fontWeight: 700, color: "#1e293b" }}>{d.name}</span>}
              <span style={{ fontSize: 10.5, color: "#94a3b8" }}>{count}명</span>
              {editing
                ? <>
                    <select value={edit.color} onChange={(e) => setEdit({ ...edit, color: e.target.value })} style={{ ...inp, width: 60, color: edit.color, fontWeight: 800 }}>{DEPT_COLORS.map((c) => <option key={c} value={c} style={{ color: c }}>■</option>)}</select>
                    <button onClick={() => { patch(d.id, edit); setEdit(null); }} style={{ ...gbtn, color: "#16a34a" }}>저장</button>
                    <button onClick={() => setEdit(null)} style={gbtn}>취소</button>
                  </>
                : <>
                    <button onClick={() => setEdit({ id: d.id, name: d.name, color: d.color || DEPT_COLORS[0] })} style={gbtn}>수정</button>
                    <button onClick={() => del(d.id)} style={{ ...gbtn, color: "#dc2626" }}>삭제</button>
                  </>}
            </div>
          );
        })}
        {deps.length === 0 && <div style={{ color: "#cbd5e1", fontSize: 12.5, padding: 16, textAlign: "center" }}>부서가 없습니다.</div>}
      </div>
    </div>
  );
}

// ── 직원 관리 (관리자) — 카드형 그리드 ────────────────────────────────────────
function AdminSection({ humans, me, departments, reload }) {
  const [adding, setAdding] = useState(false);
  const [nf, setNf] = useState({ name: "", email: "", title: "", deptId: "", role: "member" });
  const [msg, setMsg] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  const [resetInfo, setResetInfo] = useState(null);
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
  const resetPw = async (h) => {
    if (!confirm(`${h.name}님의 비밀번호를 초기화하시겠습니까?\n임시 비번이 발급되고, 본인이 다음 로그인 때 바꿔야 합니다.`)) return;
    try {
      const r = await fetch(`${API}/api/users/${h.id}/password/reset`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) return alert(j.error || "실패");
      setResetInfo({ name: h.name, email: h.email, password: j.tempPassword });
    } catch { alert("실패"); }
  };
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={h2}>🛡️ 직원 관리 <span style={{ fontSize: 11.5, color: "#94a3b8", fontWeight: 500 }}>· {humans.length}명</span></div>
        <button onClick={() => { setAdding((v) => !v); setMsg(""); }} style={{ ...btn("#16a34a"), padding: "5px 11px", fontSize: 11.5, marginLeft: "auto" }}>{adding ? "취소" : "+ 직원 추가"}</button>
      </div>
      <div style={sub}>추가·권한·차단/해제·삭제·비번 재설정. 첫 로그인 때 본인이 비번을 정합니다.</div>

      {adding && (
        <div style={{ ...card, background: "#eef2ff", borderColor: "#c7d2fe" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <input value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} placeholder="이름" style={inp} />
            <input value={nf.email} onChange={(e) => setNf({ ...nf, email: e.target.value })} placeholder="이메일" style={inp} />
            <input value={nf.title} onChange={(e) => setNf({ ...nf, title: e.target.value })} placeholder="직책" style={inp} />
            <select value={nf.deptId} onChange={(e) => setNf({ ...nf, deptId: e.target.value })} style={inp}><option value="">미지정</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
            <select value={nf.role} onChange={(e) => setNf({ ...nf, role: e.target.value })} style={{ ...inp, gridColumn: "1 / -1" }}><option value="member">일반</option><option value="admin">관리자</option></select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={add} style={btn("#6366f1")}>추가</button>
            {msg && <span style={{ fontSize: 11, color: "#dc2626" }}>{msg}</span>}
          </div>
        </div>
      )}

      {resetInfo && (
        <div style={{ ...card, background: "#fef3c7", borderColor: "#fbbf24" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#92400e", marginBottom: 6 }}>🔑 임시 비밀번호 발급됨</div>
          <div style={{ fontSize: 12.5, color: "#78350f", marginBottom: 4 }}>{resetInfo.name} ({resetInfo.email})</div>
          <div style={{ background: "#fff", border: "1px solid #fbbf24", borderRadius: 7, padding: "8px 12px", fontFamily: "monospace", fontSize: 16, fontWeight: 800, color: "#dc2626", letterSpacing: 2, marginBottom: 8 }}>{resetInfo.password}</div>
          <div style={{ fontSize: 10.5, color: "#92400e", marginBottom: 8 }}>이 비번을 본인에게 안전한 방법으로 전달하세요. 본인이 첫 로그인 후 바꿔야 합니다.</div>
          <button onClick={() => setResetInfo(null)} style={gbtn}>닫기</button>
        </div>
      )}

      {/* 카드형 그리드 — 이름 안 찌그러짐 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 10 }}>
        {humans.map((h) => {
          const self = h.id === me.id;
          return (
            <div key={h.id} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: (h.color || "#6366f1") + "1c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21, flexShrink: 0 }}>{h.avatar || "👤"}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: "#1e293b" }}>{h.name}{self && <span style={{ fontSize: 10, color: "#6366f1", marginLeft: 5 }}>(나)</span>}</div>
                  <div style={{ fontSize: 10.5, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.email || "이메일 없음"}</div>
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
                <button onClick={() => !self && patch(h.id, { role: h.role === "admin" ? "member" : "admin" })} disabled={self} title={self ? "본인 권한은 변경 불가" : "클릭하여 변경"}
                  style={{ ...gbtn, cursor: self ? "default" : "pointer", color: h.role === "admin" ? "#6366f1" : "#64748b", background: h.role === "admin" ? "#eef2ff" : "#fff", opacity: self ? 0.55 : 1 }}>{h.role === "admin" ? "👑 관리자" : "일반"}</button>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: h.status === "blocked" ? "#dc2626" : "#16a34a", padding: "4px 8px", background: h.status === "blocked" ? "#fee2e2" : "#dcfce7", borderRadius: 7 }}>{h.status === "blocked" ? "🚫 차단됨" : "🟢 정상"}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {!self && <button onClick={() => patch(h.id, { status: h.status === "blocked" ? "active" : "blocked" })} style={{ ...gbtn, color: h.status === "blocked" ? "#16a34a" : "#d97706" }}>{h.status === "blocked" ? "해제" : "차단"}</button>}
                <button onClick={() => resetPw(h)} style={{ ...gbtn, color: "#0ea5e9" }}>🔑 비번재설정</button>
                {!self && (confirmDel === h.id
                  ? <button onClick={() => del(h.id)} style={{ ...gbtn, color: "#fff", background: "#dc2626", border: "none" }}>삭제확인</button>
                  : <button onClick={() => setConfirmDel(h.id)} style={{ ...gbtn, color: "#dc2626" }}>삭제</button>)}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 10, lineHeight: 1.5 }}>· 차단된 직원은 로그인 불가 · 본인 계정은 권한 변경·차단·삭제 불가</div>
    </div>
  );
}

// ── 사내 공지 배너 (관리자) ───────────────────────────────────────────────────
function NoticeSection({ company, onSaved }) {
  const [n, setN] = useState(company.notice || { text: "", level: "info", on: false });
  const [msg, setMsg] = useState("");
  useEffect(() => setN(company.notice || { text: "", level: "info", on: false }), [company.notice?.text]);
  const save = async () => {
    setMsg("");
    await fetch(`${API}/api/company`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notice: n }) }).catch(() => {});
    setMsg("저장됨 ✓"); onSaved?.(); setTimeout(() => setMsg(""), 2000);
  };
  const LV = [["info", "💡 정보", "#0ea5e9"], ["warn", "⚠️ 주의", "#d97706"], ["urgent", "🚨 긴급", "#dc2626"]];
  const cur = LV.find((l) => l[0] === n.level) || LV[0];
  return (
    <div>
      <div style={h2}>📢 사내 공지 배너</div>
      <div style={sub}>모든 화면 상단에 표시되는 한 줄 공지. 점검·이벤트·중요 알림용.</div>
      <div style={card}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, marginBottom: 11 }}>
          <input type="checkbox" checked={!!n.on} onChange={(e) => setN({ ...n, on: e.target.checked })} />
          배너 켜기
        </label>
        <label style={lab}>레벨</label>
        <div style={{ display: "flex", gap: 7, marginBottom: 10 }}>
          {LV.map(([k, l, c]) => <button key={k} onClick={() => setN({ ...n, level: k })} style={{ flex: 1, border: "1px solid " + (n.level === k ? c : "#e2e8f0"), background: n.level === k ? c + "1a" : "#fff", color: n.level === k ? c : "#475569", padding: "7px 10px", fontSize: 12, fontWeight: 700, borderRadius: 8, cursor: "pointer" }}>{l}</button>)}
        </div>
        <label style={lab}>내용</label>
        <textarea value={n.text} onChange={(e) => setN({ ...n, text: e.target.value })} placeholder="예: 6/20(금) 14:00 시스템 점검 예정입니다." style={{ ...inp, minHeight: 60, resize: "vertical" }} />
        <div style={{ marginTop: 10, padding: "8px 12px", background: cur[2] + "12", border: "1px solid " + cur[2] + "55", borderRadius: 8, fontSize: 12, color: cur[2], fontWeight: 600 }}>
          <b>미리보기:</b> {cur[1]} {n.text || "(내용 없음)"}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={save} style={btn("#6366f1")}>저장</button>
        {msg && <span style={{ fontSize: 11.5, fontWeight: 600, color: "#16a34a" }}>{msg}</span>}
      </div>
    </div>
  );
}

// ── 가입 코드 (관리자) ────────────────────────────────────────────────────────
function CodeSection({ onSaved }) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => { fetch(`${API}/api/company/code`).then((r) => r.json()).then((d) => setCur(d.code || "")); }, []);
  const save = async () => {
    setMsg("");
    if (!next.trim()) return setMsg("새 코드를 입력하세요");
    const r = await fetch(`${API}/api/company/code`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: next.trim() }) });
    if (!r.ok) return setMsg("실패");
    setCur(next.trim()); setNext(""); setMsg("변경됨 ✓"); onSaved?.(); setTimeout(() => setMsg(""), 2000);
  };
  return (
    <div>
      <div style={h2}>🎯 회사 가입 코드</div>
      <div style={sub}>회원가입 시 직원만 알고 있어야 하는 코드. 누설되면 즉시 바꾸세요.</div>
      <div style={card}>
        <label style={lab}>현재 코드</label>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 8, fontFamily: "monospace", fontSize: 16, fontWeight: 800, color: "#92400e", letterSpacing: 2, marginBottom: 14 }}>
          {cur || "(미설정)"}
        </div>
        <label style={lab}>새 코드</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={next} onChange={(e) => setNext(e.target.value)} placeholder="예: cidhub2027" style={inp} />
          <button onClick={save} style={btn("#6366f1")}>변경</button>
        </div>
        {msg && <div style={{ fontSize: 11.5, fontWeight: 600, color: msg.includes("✓") ? "#16a34a" : "#dc2626", marginTop: 8 }}>{msg}</div>}
      </div>
      <div style={{ fontSize: 10.5, color: "#94a3b8", lineHeight: 1.6 }}>· 직원에게 메신저나 사내 게시판으로 공유 · 외부 노출 시 즉시 변경</div>
    </div>
  );
}

// ── 공휴일 (관리자) ────────────────────────────────────────────────────────────
function HolidaysSection({ holidays, reload }) {
  const [nf, setNf] = useState({ date: "", name: "", recurring: false });
  const add = async () => {
    if (!nf.date || !nf.name.trim()) return;
    await fetch(`${API}/api/holidays`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nf) }).catch(() => {});
    setNf({ date: "", name: "", recurring: false }); reload();
  };
  const del = async (id) => { await fetch(`${API}/api/holidays/${id}`, { method: "DELETE" }).catch(() => {}); reload(); };
  const seed = async () => {
    if (!confirm("한국 법정 공휴일(매년 반복)을 일괄 추가할까요?")) return;
    const KR = [
      ["01-01", "신정"], ["03-01", "삼일절"], ["05-05", "어린이날"], ["06-06", "현충일"],
      ["08-15", "광복절"], ["10-03", "개천절"], ["10-09", "한글날"], ["12-25", "성탄절"],
    ];
    for (const [d, n] of KR) await fetch(`${API}/api/holidays`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: d, name: n, recurring: true }) }).catch(() => {});
    reload();
  };
  const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div>
      <div style={h2}>🇰🇷 공휴일 · 회사 휴일</div>
      <div style={sub}>캘린더·연차 계산에 자동 반영됩니다. (반복=매년 같은 날)</div>
      <div style={card}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#1e293b", marginBottom: 7 }}>＋ 휴일 추가</div>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 8, alignItems: "center" }}>
          <input type="date" value={nf.date} onChange={(e) => setNf({ ...nf, date: e.target.value })} style={inp} />
          <input value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} placeholder="휴일 이름" style={inp} />
          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#475569" }}>
            <input type="checkbox" checked={nf.recurring} onChange={(e) => setNf({ ...nf, recurring: e.target.checked })} />매년 반복
          </label>
          <button onClick={add} style={btn("#6366f1")}>추가</button>
        </div>
        <button onClick={seed} style={{ ...gbtn, marginTop: 8, color: "#4338ca" }}>🇰🇷 한국 공휴일 일괄 추가</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {sorted.map((h) => (
          <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12.5, background: "#fff" }}>
            <span style={{ fontSize: 16 }}>{h.recurring ? "🔁" : "📅"}</span>
            <span style={{ fontWeight: 700, color: "#1e293b", width: 90 }}>{h.date}</span>
            <span style={{ flex: 1, color: "#475569" }}>{h.name}</span>
            <button onClick={() => del(h.id)} style={{ ...gbtn, color: "#dc2626" }}>삭제</button>
          </div>
        ))}
        {sorted.length === 0 && <div style={{ color: "#cbd5e1", fontSize: 12.5, padding: 16, textAlign: "center" }}>등록된 휴일이 없습니다.</div>}
      </div>
    </div>
  );
}

// ── 외부 협력사 (관리자) ──────────────────────────────────────────────────────
const PARTNER_KINDS = ["외주(촬영)", "외주(편집)", "외주(디자인)", "외주(개발)", "프리랜서", "납품처", "고객사", "기타"];
function PartnersSection({ partners, reload }) {
  const [adding, setAdding] = useState(false);
  const [nf, setNf] = useState({ name: "", kind: "외주(촬영)", contact: "", phone: "", email: "", note: "" });
  const [confirmDel, setConfirmDel] = useState(null);
  const add = async () => {
    if (!nf.name.trim()) return;
    await fetch(`${API}/api/partners`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nf) }).catch(() => {});
    setNf({ name: "", kind: "외주(촬영)", contact: "", phone: "", email: "", note: "" }); setAdding(false); reload();
  };
  const del = async (id) => { await fetch(`${API}/api/partners/${id}`, { method: "DELETE" }).catch(() => {}); setConfirmDel(null); reload(); };
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={h2}>🤝 외부 협력사 <span style={{ fontSize: 11.5, color: "#94a3b8", fontWeight: 500 }}>· {partners.length}곳</span></div>
        <button onClick={() => setAdding((v) => !v)} style={{ ...btn("#16a34a"), padding: "5px 11px", fontSize: 11.5, marginLeft: "auto" }}>{adding ? "취소" : "+ 협력사 추가"}</button>
      </div>
      <div style={sub}>프리랜서·외주사·고객사 등 외부 관계자 명부. 프로젝트 배정·연락처 빠른 조회.</div>

      {adding && (
        <div style={{ ...card, background: "#eef2ff", borderColor: "#c7d2fe" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <input value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} placeholder="상호/이름" style={inp} />
            <select value={nf.kind} onChange={(e) => setNf({ ...nf, kind: e.target.value })} style={inp}>{PARTNER_KINDS.map((k) => <option key={k}>{k}</option>)}</select>
            <input value={nf.contact} onChange={(e) => setNf({ ...nf, contact: e.target.value })} placeholder="담당자명" style={inp} />
            <input value={nf.phone} onChange={(e) => setNf({ ...nf, phone: e.target.value })} placeholder="연락처" style={inp} />
            <input value={nf.email} onChange={(e) => setNf({ ...nf, email: e.target.value })} placeholder="이메일" style={{ ...inp, gridColumn: "1 / -1" }} />
            <textarea value={nf.note} onChange={(e) => setNf({ ...nf, note: e.target.value })} placeholder="메모 (단가·특이사항 등)" style={{ ...inp, gridColumn: "1 / -1", minHeight: 50, resize: "vertical" }} />
          </div>
          <button onClick={add} style={btn("#6366f1")}>추가</button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 10 }}>
        {partners.map((p) => (
          <div key={p.id} style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#1e293b", flex: 1 }}>{p.name}</span>
              <span style={{ fontSize: 9.5, background: "#eef2ff", color: "#4338ca", padding: "1px 6px", borderRadius: 6, fontWeight: 700 }}>{p.kind}</span>
            </div>
            <div style={{ fontSize: 11.5, color: "#475569", lineHeight: 1.7 }}>
              {p.contact && <div>👤 {p.contact}</div>}
              {p.phone && <div>📞 {p.phone}</div>}
              {p.email && <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📧 {p.email}</div>}
              {p.note && <div style={{ color: "#94a3b8", marginTop: 4, whiteSpace: "pre-wrap" }}>{p.note}</div>}
            </div>
            <div style={{ display: "flex", gap: 5, marginTop: 8, justifyContent: "flex-end" }}>
              {confirmDel === p.id
                ? <button onClick={() => del(p.id)} style={{ ...gbtn, color: "#fff", background: "#dc2626", border: "none" }}>삭제확인</button>
                : <button onClick={() => setConfirmDel(p.id)} style={{ ...gbtn, color: "#dc2626" }}>삭제</button>}
            </div>
          </div>
        ))}
        {partners.length === 0 && <div style={{ color: "#cbd5e1", fontSize: 12.5, padding: 20, textAlign: "center", gridColumn: "1 / -1" }}>등록된 협력사가 없습니다.</div>}
      </div>
    </div>
  );
}
