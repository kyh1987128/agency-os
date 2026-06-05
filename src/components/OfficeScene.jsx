import { useEffect, useRef, useState } from "react";
import Phaser from "phaser";

// ════════════════════════════════════════════════════════════════════════════
// 2.5D 오피스 — Phaser 게임엔진 + 무료 자체 그래픽
//   · 키보드(WASD/방향키) + 마우스 클릭 이동 + 걷기 애니메이션
//   · 자리 앞에서 스페이스/E → 앉기, 움직이면 일어남
//   · 구역(책상/회의실/휴게실/입구) → 상태 자동 (작업중/회의중/식사중/퇴근)
//   · 수동 상태 버튼: 외근·집중·자리비움
//   · 다른 직원 위치·상태 실시간 동기화(SSE/PATCH 디바운스)
//   · AI봇 캐릭터 자동 배회
// ════════════════════════════════════════════════════════════════════════════

const API = "";
// 8가지 상태 — 자리에 맞춰 자동/수동
export const STATUSES = [
  { k: "working",  l: "작업중",  icon: "💻", color: "#22c55e", auto: true },
  { k: "meeting",  l: "회의중",  icon: "🗣",  color: "#0ea5e9", auto: true },
  { k: "eating",   l: "식사중",  icon: "🍽",  color: "#f59e0b", auto: true },
  { k: "break",    l: "휴식",    icon: "☕", color: "#a78bfa", auto: true },
  { k: "afk",      l: "자리비움", icon: "🚶", color: "#94a3b8" },
  { k: "out",      l: "외근",    icon: "🚗", color: "#fb923c" },
  { k: "focus",    l: "집중",    icon: "🎯", color: "#ef4444" },
  { k: "offwork",  l: "퇴근",    icon: "🏠", color: "#64748b", auto: true },
];
const STATUS_MAP = Object.fromEntries(STATUSES.map((s) => [s.k, s]));

// 오피스 룸: 책상 6개, 회의실(테이블+의자4), 휴게실(소파2+테이블), 입구(퇴근존)
// 좌표는 800x520 canvas 기준
const DESKS = [
  { id: "d1", x: 130, y: 130, ownerIdx: 0 },
  { id: "d2", x: 250, y: 130, ownerIdx: 1 },
  { id: "d3", x: 370, y: 130, ownerIdx: 2 },
  { id: "d4", x: 130, y: 240, ownerIdx: 3 },
  { id: "d5", x: 250, y: 240, ownerIdx: 4 },
  { id: "d6", x: 370, y: 240, ownerIdx: 5 },
];
const MEETING_SEATS = [
  { id: "m1", x: 580, y: 110 }, { id: "m2", x: 660, y: 110 },
  { id: "m3", x: 580, y: 190 }, { id: "m4", x: 660, y: 190 },
];
const LOUNGE_SEATS = [
  { id: "l1", x: 580, y: 360, eat: true }, { id: "l2", x: 660, y: 360, eat: true },
  { id: "l3", x: 620, y: 440, eat: false },
];
const EXIT_ZONE = { x: 60, y: 460, w: 90, h: 50 };

// 구역 라벨 (배경 표시용)
const ZONES = [
  { name: "🪑 업무존",   x: 80,  y: 80,  w: 360, h: 220, color: 0xffffff },
  { name: "🗣 회의실",   x: 530, y: 80,  w: 200, h: 160, color: 0xfef3c7 },
  { name: "🍽 휴게실",   x: 530, y: 320, w: 200, h: 160, color: 0xfce7f3 },
  { name: "🏠 입구·퇴근", x: 40,  y: 440, w: 130, h: 70,  color: 0xe2e8f0 },
];

// 좌석 클래스 → 상태 매핑
function seatToStatus(seat) {
  if (!seat) return null;
  if (seat.kind === "desk") return "working";
  if (seat.kind === "meeting") return "meeting";
  if (seat.kind === "lounge") return seat.eat ? "eating" : "break";
  return null;
}

// AI 봇 (메인 화면의 BOTS와 동일 컨셉, 캐릭터 배회용)
const BOTS = [
  { id: "ai_director", name: "기획 디렉터", icon: "🎯", color: 0x6366f1 },
  { id: "ai_saup",     name: "사업계획서",  icon: "📑", color: 0xf59e0b },
  { id: "ai_research", name: "리서치",      icon: "🔍", color: 0x0ea5e9 },
  { id: "ai_meeting",  name: "회의록",      icon: "🗒",  color: 0xa78bfa },
];

export default function OfficeScene({ me, humans, departments }) {
  const wrapRef = useRef(null);
  const gameRef = useRef(null);
  const sceneRef = useRef(null);
  const meRef = useRef(me);
  const humansRef = useRef(humans);
  const [hudStatus, setHudStatus] = useState(me?.status === "blocked" ? "afk" : (me?.presence || "working"));
  const [tooltip, setTooltip] = useState(null);
  useEffect(() => { meRef.current = me; }, [me]);
  useEffect(() => { humansRef.current = humans; if (sceneRef.current) sceneRef.current.events.emit("humans-updated", humans); }, [humans]);

  // 내 상태 PATCH (디바운스)
  const patchTimer = useRef(null);
  const patchMe = (patch) => {
    if (!meRef.current) return;
    if (patchTimer.current) clearTimeout(patchTimer.current);
    patchTimer.current = setTimeout(() => {
      fetch(`${API}/api/humans/${meRef.current.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }).catch(() => {});
    }, 350);
  };
  // 상태 외부 노출 (Phaser → React)
  const setStatus = (k) => { setHudStatus(k); patchMe({ presence: k }); };

  useEffect(() => {
    if (!wrapRef.current || gameRef.current) return;
    const Scene = class extends Phaser.Scene {
      constructor() { super("office"); }
      create() {
        const W = 800, H = 520;
        const sc = this;
        sceneRef.current = sc;

        // 바닥 + 구역
        sc.add.rectangle(0, 0, W, H, 0xf8fafc).setOrigin(0);
        // 격자 무늬(아이소메트릭 느낌 살리기)
        const g = sc.add.graphics(); g.lineStyle(1, 0xe2e8f0, 0.6);
        for (let i = 0; i <= W; i += 30) { g.lineBetween(i, 0, i, H); }
        for (let j = 0; j <= H; j += 30) { g.lineBetween(0, j, W, j); }

        ZONES.forEach((z) => {
          sc.add.rectangle(z.x, z.y, z.w, z.h, z.color, 0.7).setOrigin(0).setStrokeStyle(2, 0xcbd5e1, 0.8);
          sc.add.text(z.x + 8, z.y + 6, z.name, { fontSize: "12px", color: "#64748b", fontStyle: "bold" });
        });

        // 책상 (사다리꼴 모양)
        sc.seats = [];
        DESKS.forEach((d, i) => {
          const owner = humansRef.current[d.ownerIdx];
          const desk = sc.add.rectangle(d.x, d.y, 60, 36, 0x8b5cf6, 0.25).setStrokeStyle(2, 0x8b5cf6, 0.6);
          sc.add.rectangle(d.x, d.y + 28, 16, 24, 0x6366f1, 0.5).setStrokeStyle(2, 0x4338ca, 0.5); // 의자
          sc.add.text(d.x, d.y - 24, "💻", { fontSize: "14px" }).setOrigin(0.5);
          if (owner) sc.add.text(d.x, d.y + 50, owner.name, { fontSize: "10px", color: "#94a3b8" }).setOrigin(0.5);
          sc.seats.push({ id: d.id, x: d.x, y: d.y + 28, kind: "desk", ownerId: owner?.id });
        });

        // 회의 테이블
        sc.add.rectangle(620, 150, 130, 70, 0xfbbf24, 0.35).setStrokeStyle(2, 0xd97706, 0.5);
        MEETING_SEATS.forEach((m) => {
          sc.add.rectangle(m.x, m.y, 18, 18, 0xfbbf24, 0.5).setStrokeStyle(2, 0xb45309, 0.6);
          sc.seats.push({ id: m.id, x: m.x, y: m.y, kind: "meeting" });
        });

        // 휴게실 소파 + 다이닝
        LOUNGE_SEATS.forEach((l) => {
          if (l.eat) {
            sc.add.rectangle(620, 360, 130, 24, 0xf472b6, 0.25).setStrokeStyle(1, 0xdb2777, 0.5);
            sc.add.text(l.x, l.y - 20, "🍽", { fontSize: "13px" }).setOrigin(0.5);
            sc.add.rectangle(l.x, l.y, 22, 22, 0xf472b6, 0.5).setStrokeStyle(2, 0xdb2777, 0.6);
          } else {
            sc.add.rectangle(l.x, l.y, 90, 30, 0xa78bfa, 0.35).setStrokeStyle(2, 0x7c3aed, 0.6);
            sc.add.text(l.x, l.y - 24, "☕", { fontSize: "13px" }).setOrigin(0.5);
          }
          sc.seats.push({ id: l.id, x: l.x, y: l.y, kind: "lounge", eat: l.eat });
        });

        // 입구 (퇴근)
        sc.add.rectangle(EXIT_ZONE.x, EXIT_ZONE.y, EXIT_ZONE.w, EXIT_ZONE.h, 0x64748b, 0.2).setOrigin(0).setStrokeStyle(2, 0x475569, 0.5);

        // 캐릭터 그리기 함수
        const drawChar = (px, py, color, emoji, label, isMe) => {
          const c = sc.add.container(px, py);
          // 그림자
          c.add(sc.add.ellipse(0, 16, 26, 8, 0x000000, 0.18));
          // 몸통 (둥근)
          const body = sc.add.circle(0, 0, 13, color, 1).setStrokeStyle(2, 0x1e293b, isMe ? 0.9 : 0.4);
          c.add(body);
          // 이모지(얼굴)
          c.add(sc.add.text(0, 0, emoji, { fontSize: "13px" }).setOrigin(0.5));
          // 이름표
          if (label) {
            const tag = sc.add.text(0, -24, label, { fontSize: "10px", color: "#1e293b", backgroundColor: isMe ? "#6366f1" : "#ffffffcc", padding: { x: 4, y: 1 } }).setOrigin(0.5);
            if (isMe) tag.setColor("#ffffff");
            c.add(tag);
          }
          // 상태 뱃지(우상단)
          const badge = sc.add.text(12, -12, "💻", { fontSize: "11px", backgroundColor: "#ffffffdd", padding: { x: 2, y: 0 } }).setOrigin(0.5);
          c.add(badge);
          c.body = body; c.badge = badge;
          c.idleT = Math.random() * 1000;
          return c;
        };

        // 직원 캐릭터 (자기 책상에서 시작)
        sc.charByHuman = new Map();
        const ensureChars = () => {
          const humansList = humansRef.current || [];
          humansList.forEach((h, i) => {
            if (sc.charByHuman.has(h.id)) return;
            const seat = sc.seats.find((s) => s.kind === "desk" && s.ownerId === h.id) || sc.seats[i % sc.seats.length];
            const isMe = h.id === meRef.current?.id;
            const color = parseInt((h.color || "#6366f1").replace("#", ""), 16);
            const c = drawChar(seat ? seat.x : 200, seat ? seat.y : 200, color, h.avatar || "👤", h.name, isMe);
            c.targetX = c.x; c.targetY = c.y;
            c.seatId = seat?.id;
            c.presence = h.presence || "working";
            c.isMe = isMe;
            c.humanId = h.id;
            sc.charByHuman.set(h.id, c);
            if (isMe) sc.meChar = c;
          });
          // 사라진 사람 제거
          for (const [hid, c] of sc.charByHuman) {
            if (!humansList.find((h) => h.id === hid)) { c.destroy(); sc.charByHuman.delete(hid); }
          }
        };
        ensureChars();
        sc.events.on("humans-updated", () => ensureChars());

        // AI봇 캐릭터 (자동 배회)
        sc.bots = BOTS.map((b) => {
          const c = drawChar(540 + Math.random() * 200, 420 + Math.random() * 60, b.color, b.icon, b.name, false);
          c.targetX = c.x; c.targetY = c.y;
          c.botMode = "wander";
          c.botName = b.name;
          c.presence = "working";
          return c;
        });

        // 키보드
        sc.cursors = sc.input.keyboard.createCursorKeys();
        sc.wasd = sc.input.keyboard.addKeys("W,A,S,D,SPACE,E");

        // 마우스 클릭 이동 + 캐릭터 클릭 툴팁
        sc.input.on("pointerdown", (p) => {
          if (!sc.meChar) return;
          // 의자 위 클릭 → 그 의자로
          const nearSeat = sc.seats.find((s) => Phaser.Math.Distance.Between(p.x, p.y, s.x, s.y) < 22);
          if (nearSeat && (!nearSeat.ownerId || nearSeat.ownerId === meRef.current?.id || nearSeat.kind !== "desk")) {
            sc.meChar.targetX = nearSeat.x; sc.meChar.targetY = nearSeat.y;
            sc.meChar.pendingSeat = nearSeat;
          } else {
            sc.meChar.targetX = Phaser.Math.Clamp(p.x, 30, 770);
            sc.meChar.targetY = Phaser.Math.Clamp(p.y, 30, 490);
            sc.meChar.pendingSeat = null;
            sc.meChar.seatId = null;
          }
        });
      }

      update(_, delta) {
        const sc = this;
        const meC = sc.meChar;

        // 키보드 이동 (속도 px/s)
        if (meC) {
          const speed = 0.16 * delta;
          let dx = 0, dy = 0;
          if (sc.cursors.left.isDown || sc.wasd.A.isDown) dx -= 1;
          if (sc.cursors.right.isDown || sc.wasd.D.isDown) dx += 1;
          if (sc.cursors.up.isDown || sc.wasd.W.isDown) dy -= 1;
          if (sc.cursors.down.isDown || sc.wasd.S.isDown) dy += 1;
          if (dx !== 0 || dy !== 0) {
            const n = Math.hypot(dx, dy) || 1;
            meC.x = Phaser.Math.Clamp(meC.x + (dx / n) * speed, 30, 770);
            meC.y = Phaser.Math.Clamp(meC.y + (dy / n) * speed, 30, 490);
            meC.targetX = meC.x; meC.targetY = meC.y;
            meC.pendingSeat = null;
            if (meC.seatId) { meC.seatId = null; this._maybeUpdatePresence(meC, null); }
            this._bobWalk(meC, delta);
          }
          // 마우스 이동
          const dx2 = meC.targetX - meC.x, dy2 = meC.targetY - meC.y;
          const d2 = Math.hypot(dx2, dy2);
          if (d2 > 1) {
            const v = Math.min(0.16 * delta, d2);
            meC.x += (dx2 / d2) * v; meC.y += (dy2 / d2) * v;
            this._bobWalk(meC, delta);
            if (d2 < 3 && meC.pendingSeat) { meC.seatId = meC.pendingSeat.id; this._maybeUpdatePresence(meC, meC.pendingSeat); meC.pendingSeat = null; }
          } else {
            this._idle(meC, delta);
          }
          // 스페이스/E = 가까운 자리에 앉기
          if (Phaser.Input.Keyboard.JustDown(sc.wasd.SPACE) || Phaser.Input.Keyboard.JustDown(sc.wasd.E)) {
            const near = sc.seats.filter((s) => Phaser.Math.Distance.Between(meC.x, meC.y, s.x, s.y) < 35 && (!s.ownerId || s.ownerId === meRef.current?.id || s.kind !== "desk"))
              .sort((a, b) => Phaser.Math.Distance.Between(meC.x, meC.y, a.x, a.y) - Phaser.Math.Distance.Between(meC.x, meC.y, b.x, b.y))[0];
            if (near) { meC.targetX = near.x; meC.targetY = near.y; meC.pendingSeat = near; }
          }
          // 입구 ZONE 도달 → 퇴근
          if (meC.x > EXIT_ZONE.x && meC.x < EXIT_ZONE.x + EXIT_ZONE.w && meC.y > EXIT_ZONE.y && meC.y < EXIT_ZONE.y + EXIT_ZONE.h) {
            this._maybeUpdatePresence(meC, { kind: "exit" });
          }
        }

        // 다른 직원: 자기 자리(랜덤 idle 흔들림)
        sc.charByHuman.forEach((c) => { if (!c.isMe) this._idle(c, delta); });

        // AI봇 배회
        sc.bots.forEach((c) => {
          const d2 = Math.hypot(c.targetX - c.x, c.targetY - c.y);
          if (d2 < 2) {
            // 새 목적지(휴게실/회의실/책상 사이)
            const area = Phaser.Math.RND.pick(ZONES);
            c.targetX = area.x + 20 + Math.random() * (area.w - 40);
            c.targetY = area.y + 20 + Math.random() * (area.h - 40);
            c.idleT = (c.idleT || 0) + 2000 + Math.random() * 4000;
          } else {
            const v = Math.min(0.06 * delta, d2);
            c.x += (c.targetX - c.x) / d2 * v; c.y += (c.targetY - c.y) / d2 * v;
            this._bobWalk(c, delta);
          }
        });
      }

      _bobWalk(c, dt) {
        c.idleT = (c.idleT || 0) + dt;
        c.body.y = Math.sin(c.idleT / 60) * 1.5;
      }
      _idle(c, dt) {
        c.idleT = (c.idleT || 0) + dt;
        c.body.y = Math.sin(c.idleT / 400) * 0.8;
      }
      _maybeUpdatePresence(c, seat) {
        let next = null;
        if (seat && seat.kind === "exit") next = "offwork";
        else if (seat) next = seatToStatus(seat);
        else next = c.lastNonSeatStatus || "afk";
        if (next && next !== c.presence) {
          c.presence = next;
          if (c.badge) c.badge.setText((STATUS_MAP[next] || {}).icon || "");
          // React HUD 동기화
          setHudStatus(next);
          patchMe({ presence: next, pos: { x: Math.round(c.x), y: Math.round(c.y), seatId: seat?.id } });
        }
      }
    };

    const config = {
      type: Phaser.AUTO,
      width: 800, height: 520,
      parent: wrapRef.current,
      backgroundColor: "#f1f5f9",
      transparent: false,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: Scene,
    };
    gameRef.current = new Phaser.Game(config);

    return () => { gameRef.current?.destroy(true); gameRef.current = null; sceneRef.current = null; };
    // eslint-disable-next-line
  }, []);

  // 다른 직원 캐릭터 위치/상태 SSE 반영 (humans prop 변경 시)
  useEffect(() => {
    if (!sceneRef.current) return;
    const sc = sceneRef.current;
    humans.forEach((h) => {
      const c = sc.charByHuman?.get(h.id);
      if (!c || c.isMe) return;
      if (h.pos?.x != null) { c.targetX = h.pos.x; c.targetY = h.pos.y; }
      if (h.presence && h.presence !== c.presence) {
        c.presence = h.presence;
        if (c.badge) c.badge.setText((STATUS_MAP[h.presence] || {}).icon || "");
      }
    });
  }, [humans]);

  const cur = STATUS_MAP[hudStatus] || STATUSES[0];

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "#ffffffcc", borderBottom: "1px solid #e2e8f0", flexShrink: 0, backdropFilter: "blur(6px)" }}>
        <span style={{ fontSize: 13.5, fontWeight: 800, color: "#1e293b" }}>🏢 2.5D 오피스</span>
        <span style={{ fontSize: 10.5, color: "#94a3b8" }}>방향키/WASD 또는 클릭으로 이동 · 자리 앞에서 Space/E로 앉기</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10.5, color: "#94a3b8" }}>내 상태</span>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: cur.color, background: cur.color + "1c", padding: "3px 10px", borderRadius: 12 }}>{cur.icon} {cur.l}</span>
        </div>
      </div>
      {/* 게임 캔버스 */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 10 }}>
        <div ref={wrapRef} style={{ width: "100%", maxWidth: 880, aspectRatio: "800 / 520", boxShadow: "0 10px 40px #0f172a22", borderRadius: 12, overflow: "hidden", border: "1px solid #cbd5e1" }} />
      </div>
      {/* 하단 수동 상태 버튼 */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 6, padding: "8px 16px 12px", background: "#ffffffcc", borderTop: "1px solid #e2e8f0", flexShrink: 0 }}>
        {STATUSES.filter((s) => !s.auto || s.k === "offwork").map((s) => {
          const on = hudStatus === s.k;
          return (
            <button key={s.k} onClick={() => setStatus(s.k)} style={{ border: "1px solid " + (on ? s.color : "#e2e8f0"), background: on ? s.color + "20" : "#fff", color: on ? s.color : "#475569", padding: "5px 12px", fontSize: 11.5, fontWeight: 700, borderRadius: 14, cursor: "pointer" }}>{s.icon} {s.l}</button>
          );
        })}
      </div>
      {tooltip && <div style={{ position: "absolute", left: tooltip.x, top: tooltip.y, background: "#0f172a", color: "#fff", fontSize: 11, padding: "5px 8px", borderRadius: 6, pointerEvents: "none" }}>{tooltip.text}</div>}
    </div>
  );
}
