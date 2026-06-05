import { useState } from "react";

// ════════════════════════════════════════════════════════════════════════════
// 내부 로그인 게이트 — App을 감싸 로그인 전에는 앱을 막음 (App.jsx 미수정)
//   · 이메일 + 개별 비밀번호 (비번은 서버에서 scrypt 해시로만 저장)
//   · 첫 로그인 시 비밀번호 설정, 로그인 후 비번 변경/로그아웃
// ════════════════════════════════════════════════════════════════════════════

const card = { background: "#fff", borderRadius: 16, boxShadow: "0 18px 50px #0f172a26", padding: "32px 30px", width: 330, boxSizing: "border-box" };
const inp = { width: "100%", boxSizing: "border-box", border: "1px solid #e2e8f0", borderRadius: 10, padding: "11px 13px", fontSize: 14, outline: "none", marginBottom: 10, color: "#1e293b" };
const pbtn = { flex: 1, border: "none", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer", background: "#6366f1", color: "#fff" };

export default function AuthGate({ children }) {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem("authUser") || "null"); } catch { return null; } });
  const setIdentity = (u) => {
    localStorage.setItem("authUser", JSON.stringify(u));
    try { localStorage.setItem("boardMe", JSON.stringify(u)); localStorage.setItem("approvalMe", u.id); } catch {}
    setUser(u);
  };
  if (!user) return <LoginScreen onLogin={setIdentity} />;
  return <LoggedIn user={user} onUser={(u) => setIdentity(u)} onLogout={() => { localStorage.removeItem("authUser"); setUser(null); }}>{children}</LoggedIn>;
}

function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState("login"); // login | setup
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [setupId, setSetupId] = useState(null);
  const [setupName, setSetupName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const login = async () => {
    setErr(""); setBusy(true);
    try {
      const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: pw }) });
      const j = await r.json();
      if (j.needSetup) { setSetupId(j.userId); setSetupName(j.name || ""); setPw(""); setMode("setup"); setBusy(false); return; }
      if (!r.ok) { setErr(j.error || "로그인 실패"); setBusy(false); return; }
      onLogin(j.user);
    } catch { setErr("서버에 연결할 수 없습니다"); setBusy(false); }
  };
  const setup = async () => {
    setErr("");
    if (pw.length < 4) return setErr("비밀번호는 4자 이상이어야 합니다");
    if (pw !== pw2) return setErr("비밀번호가 서로 다릅니다");
    setBusy(true);
    try {
      const r = await fetch(`/api/users/${setupId}/password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ next: pw }) });
      const j = await r.json();
      if (!r.ok) { setErr(j.error || "설정 실패"); setBusy(false); return; }
      onLogin(j.user);
    } catch { setErr("서버에 연결할 수 없습니다"); setBusy(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#eef2ff,#e0f2fe)", fontFamily: "system-ui,-apple-system,sans-serif", zIndex: 10000 }}>
      <div style={card}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ width: 48, height: 48, margin: "0 auto 10px", background: "linear-gradient(135deg,#6366f1,#38bdf8)", borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 25 }}>🏢</div>
          <div style={{ fontSize: 19, fontWeight: 800, color: "#1e293b" }}>Agency OS</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>{mode === "setup" ? `${setupName}님, 비밀번호를 설정하세요` : "사내 로그인"}</div>
        </div>
        {mode === "login" ? (
          <>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일" autoFocus style={inp} onKeyDown={(e) => e.key === "Enter" && login()} />
            <input value={pw} onChange={(e) => setPw(e.target.value)} type="password" placeholder="비밀번호" style={inp} onKeyDown={(e) => e.key === "Enter" && login()} />
            {err && <div style={{ color: "#dc2626", fontSize: 12, marginBottom: 10 }}>{err}</div>}
            <div style={{ display: "flex" }}><button onClick={login} disabled={busy} style={pbtn}>{busy ? "확인 중…" : "로그인"}</button></div>
            <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginTop: 13, lineHeight: 1.5 }}>처음이신가요? 이메일만 입력하고 로그인을 누르면<br />비밀번호를 설정할 수 있어요.</div>
          </>
        ) : (
          <>
            <input value={pw} onChange={(e) => setPw(e.target.value)} type="password" placeholder="새 비밀번호 (4자 이상)" autoFocus style={inp} />
            <input value={pw2} onChange={(e) => setPw2(e.target.value)} type="password" placeholder="새 비밀번호 확인" style={inp} onKeyDown={(e) => e.key === "Enter" && setup()} />
            {err && <div style={{ color: "#dc2626", fontSize: 12, marginBottom: 10 }}>{err}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={setup} disabled={busy} style={pbtn}>{busy ? "설정 중…" : "설정하고 시작"}</button>
              <button onClick={() => { setMode("login"); setErr(""); setPw(""); setPw2(""); }} style={{ ...pbtn, flex: "0 0 auto", background: "#f1f5f9", color: "#475569" }}>뒤로</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function LoggedIn({ user, onUser, onLogout, children }) {
  const [menu, setMenu] = useState(false);
  const [chPw, setChPw] = useState(false);
  return (
    <>
      {children}
      {/* 좌측 하단 사용자 pill (사이드바 푸터 위) */}
      <div style={{ position: "fixed", left: 10, bottom: 10, zIndex: 9998 }}>
        {menu && (
          <div style={{ position: "absolute", left: 0, bottom: "112%", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, boxShadow: "0 8px 24px #0f172a22", overflow: "hidden", minWidth: 150 }}>
            <div onClick={() => { setChPw(true); setMenu(false); }} style={{ padding: "10px 14px", fontSize: 12.5, cursor: "pointer", color: "#334155" }}>🔑 비밀번호 변경</div>
            <div onClick={onLogout} style={{ padding: "10px 14px", fontSize: 12.5, cursor: "pointer", color: "#dc2626", borderTop: "1px solid #f1f5f9" }}>🚪 로그아웃</div>
          </div>
        )}
        <div onClick={() => setMenu((m) => !m)} title="계정" style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 20, padding: "5px 11px 5px 7px", cursor: "pointer", boxShadow: "0 2px 10px #0f172a1f", fontSize: 12, maxWidth: 152 }}>
          <span style={{ fontSize: 16 }}>{user.avatar || "👤"}</span>
          <span style={{ fontWeight: 700, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</span>
          {user.role === "admin" && <span style={{ fontSize: 8.5, background: "#ede9fe", color: "#6366f1", padding: "1px 5px", borderRadius: 7, fontWeight: 700, flexShrink: 0 }}>관리자</span>}
          <span style={{ color: "#cbd5e1", flexShrink: 0 }}>▾</span>
        </div>
      </div>
      {chPw && <ChangePw user={user} onUser={onUser} onClose={() => setChPw(false)} />}
    </>
  );
}

function ChangePw({ user, onUser, onClose }) {
  const [cur, setCur] = useState(""); const [nw, setNw] = useState(""); const [nw2, setNw2] = useState("");
  const [err, setErr] = useState(""); const [ok, setOk] = useState(false);
  const save = async () => {
    setErr("");
    if (nw.length < 4) return setErr("새 비밀번호는 4자 이상이어야 합니다");
    if (nw !== nw2) return setErr("새 비밀번호가 서로 다릅니다");
    try {
      const r = await fetch(`/api/users/${user.id}/password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current: cur, next: nw }) });
      const j = await r.json();
      if (!r.ok) return setErr(j.error || "변경 실패");
      setOk(true); onUser(j.user); setTimeout(onClose, 900);
    } catch { setErr("서버에 연결할 수 없습니다"); }
  };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "#0f172a66", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10001 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: 320 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#1e293b", marginBottom: 14 }}>🔑 비밀번호 변경</div>
        <input value={cur} onChange={(e) => setCur(e.target.value)} type="password" placeholder="현재 비밀번호" style={inp} />
        <input value={nw} onChange={(e) => setNw(e.target.value)} type="password" placeholder="새 비밀번호 (4자 이상)" style={inp} />
        <input value={nw2} onChange={(e) => setNw2(e.target.value)} type="password" placeholder="새 비밀번호 확인" style={inp} onKeyDown={(e) => e.key === "Enter" && save()} />
        {err && <div style={{ color: "#dc2626", fontSize: 12, marginBottom: 10 }}>{err}</div>}
        {ok && <div style={{ color: "#16a34a", fontSize: 12, marginBottom: 10 }}>변경되었습니다 ✓</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={save} style={pbtn}>변경</button>
          <button onClick={onClose} style={{ ...pbtn, background: "#f1f5f9", color: "#475569" }}>취소</button>
        </div>
      </div>
    </div>
  );
}
