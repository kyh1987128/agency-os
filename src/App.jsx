import { useState, useEffect, useMemo, useRef } from "react";
import LeftPanel, { TABS } from "./components/LeftPanel";
import OntologyGraph from "./components/OntologyGraph";
import TasksTable from "./components/TasksTable";
import RightPanel from "./components/RightPanel";
import ProjectsView from "./components/ProjectsView";
import KanbanView from "./components/KanbanView";
import ChatView from "./components/ChatView";
import KnowledgeCenter from "./components/KnowledgeCenter";
import ApprovalView from "./components/ApprovalView";
import BoardView from "./components/BoardView";
import GanttView from "./components/GanttView";
import CalendarView from "./components/CalendarView";
import ArchiveView from "./components/ArchiveView";
import Modal from "./components/Modal";
import { COLORS } from "./data/mockData";

const API = "";
const { bg: B, border: BR, text: T, muted: M } = COLORS;

const KC_SECTIONS = {
  knowledge:  { section: "wiki",       title: "📖 사내위키",   sub: "찾아 읽는 지식" },
  manual:     { section: "manual",     title: "📒 업무매뉴얼", sub: "업무 절차·양식 설명" },
  onboarding: { section: "onboarding", title: "🎓 온보딩",     sub: "신입 학습 · 진도 체크" },
  daily:      { section: "daily",      title: "✅ 일과·체크",  sub: "출근·보고 등 반복 체크" },
};

export default function App() {
  const [tab,           setTab]           = useState(() => {
    if (typeof window === "undefined") return "dashboard";
    const h = window.location.hash.replace("#", "");
    return TABS.some((t) => t.id === h) ? h : "dashboard";
  });
  const histFirst = useRef(true);
  const [modal,         setModal]         = useState(null);
  const [kcTarget,      setKcTarget]      = useState(null); // 지식 섹션 교차 점프 {tab,docId}
  const [chatHandoff,   setChatHandoff]   = useState(null); // 퀘스트→채팅 인계 {botId,message,label,nonce}
  const [activeProject, setActiveProject] = useState(null);
  const [projects,      setProjects]      = useState([]);
  const [projData,      setProjData]      = useState([]);
  const [allNodes,      setAllNodes]      = useState([]);
  const [departments,   setDepartments]   = useState([]);
  const [humans,        setHumans]        = useState([]);

  const loadProjects = () => {
    fetch(`${API}/api/projects`)
      .then(r => r.json())
      .then(data => setProjects(Array.isArray(data) ? data : []))
      .catch(() => {});
  };

  const loadProjData = () => {
    fetch(`${API}/api/data/projects`)
      .then(r => r.json())
      .then(data => setProjData(Array.isArray(data) ? data : []))
      .catch(() => {});
  };

  const loadAllNodes = () => {
    fetch(`${API}/api/data/nodes/all-flat`)
      .then(r => r.json())
      .then(data => setAllNodes(Array.isArray(data) ? data : []))
      .catch(() => {});
  };

  useEffect(() => {
    loadProjects();
    loadProjData();
    loadAllNodes();
    fetch(`${API}/api/departments`).then(r => r.json()).then(d => setDepartments(Array.isArray(d) ? d : [])).catch(() => {});
    fetch(`${API}/api/humans`).then(r => r.json()).then(d => setHumans(Array.isArray(d) ? d : [])).catch(() => {});
    window.addEventListener("projects-changed", loadProjects);
    return () => window.removeEventListener("projects-changed", loadProjects);
  }, []);

  useEffect(() => {
    if (projects.length > 0 && !activeProject) {
      setActiveProject(projects[0].id);
    }
  }, [projects]);

  const computedProjData = useMemo(() => {
    return projData
      .filter(proj => {
        const p = projects.find(pr => pr.id === proj.id);
        return !p?.archived; // archived 프로젝트 제외
      })
      .map(proj => {
        const nodes = allNodes.filter(n => n.projectId === proj.id);
        const progress = nodes.length > 0
          ? Math.round(nodes.reduce((sum, n) => sum + (n.progress || 0), 0) / nodes.length)
          : 0;
        return { ...proj, progress };
      });
  }, [projData, allNodes, projects]);

  useEffect(() => {
    const es = new EventSource(`${API}/api/stream`);
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "data_update") {
          if (msg.resource === "projects") loadProjData();
          if (msg.resource === "nodes") loadAllNodes();
        }
      } catch {}
    };
    return () => es.close();
  }, []);

  // 탭 ↔ 브라우저 히스토리 동기화 (뒤로가기가 앱 밖으로 나가지 않고 이전 탭으로 이동)
  useEffect(() => {
    const cur = window.location.hash.replace("#", "");
    if (cur !== tab) {
      if (histFirst.current) window.history.replaceState({ tab }, "", "#" + tab);
      else window.history.pushState({ tab }, "", "#" + tab);
    }
    histFirst.current = false;
  }, [tab]);
  useEffect(() => {
    const onPop = () => { const h = window.location.hash.replace("#", ""); setTab(TABS.some((t) => t.id === h) ? h : "dashboard"); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return (
    <div style={{ display: "flex", height: "100vh", background: B, color: T, fontFamily: "system-ui,-apple-system,sans-serif", overflow: "hidden" }}>
      <LeftPanel
        tab={tab}
        setTab={setTab}
        projects={projects}
        allNodes={allNodes}
        projData={projData}
      />

      {tab === "chat" ? (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <ChatView activeProject={activeProject} handoff={chatHandoff} />
        </div>
      ) : KC_SECTIONS[tab] ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid " + BR, background: "#ffffff", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: T }}>{KC_SECTIONS[tab].title} <span style={{ fontSize: 10, color: M, fontWeight: 400 }}>· {KC_SECTIONS[tab].sub}</span></span>
            <span style={{ fontSize: 10, color: M }}>{new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}</span>
          </div>
          <KnowledgeCenter
            key={tab}
            section={KC_SECTIONS[tab].section}
            humans={humans}
            activeProject={activeProject}
            targetDocId={kcTarget?.tab === tab ? kcTarget.docId : null}
            onNavigate={(toTab, docId) => { setKcTarget({ tab: toTab, docId }); setTab(toTab); }}
            onSendToBot={({ botId, message, label }) => { setChatHandoff({ botId, message, label, nonce: Date.now() }); setTab("chat"); }}
          />
        </div>
      ) : tab === "approval" ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid " + BR, background: "#ffffff", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: T }}>🖋 전자결재 <span style={{ fontSize: 10, color: M, fontWeight: 400 }}>· 기안·결재선·문서함</span></span>
            <span style={{ fontSize: 10, color: M }}>{new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}</span>
          </div>
          <ApprovalView humans={humans} />
        </div>
      ) : tab === "board" ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid " + BR, background: "#ffffff", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: T }}>📋 게시판 <span style={{ fontSize: 10, color: M, fontWeight: 400 }}>· 사내 소통</span></span>
            <span style={{ fontSize: 10, color: M }}>{new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}</span>
          </div>
          <BoardView humans={humans} activeProject={activeProject} />
        </div>
      ) : tab === "archive" ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid " + BR, background: "#ffffff", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: T }}>보관함</span>
            <span style={{ fontSize: 10, color: M }}>{new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}</span>
          </div>
          <ArchiveView
            projects={projects}
            allNodes={allNodes}
            onRestored={() => { loadProjects(); loadProjData(); loadAllNodes(); }}
          />
        </div>
      ) : (
        <>
          <div style={{ flex: 1, overflow: (tab === "kanban" || tab === "projects" || tab === "gantt" || tab === "calendar") ? "hidden" : "auto", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid " + BR, background: "#ffffff", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: T }}>{TABS.find((t) => t.id === tab)?.l ?? "프로젝트"}</span>
                {projects.length > 0 && !["gantt", "calendar", "chat"].includes(tab) && (
                  <span style={{ fontSize: 10, background: "#ede9fe", color: "#6366f1", padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>
                    {projects.find(p => p.id === activeProject)?.name || ""}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 10, color: M }}>{new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}</span>
            </div>

            {tab === "dashboard" && (
              <>
                <div style={{ height: "calc(60vh - 60px)", minHeight: 340, flexShrink: 0 }}>
                  <OntologyGraph onNodeClick={setModal} projData={computedProjData} departments={departments} humans={humans} />
                </div>
                <TasksTable onTaskClick={setModal} projData={computedProjData} allNodes={allNodes} departments={departments} humans={humans} />
              </>
            )}
            {tab === "projects" && (
              <ProjectsView
                onSelect={setModal}
                projects={projects}
                activeProject={activeProject}
                setActiveProject={setActiveProject}
                projData={computedProjData}
                onProjDataChange={loadProjData}
                departments={departments}
                humans={humans}
                allNodes={allNodes}
              />
            )}
            {tab === "kanban" && (
              <KanbanView
                activeProject={activeProject}
                projData={computedProjData}
                allNodes={allNodes}
                onNodesChange={loadAllNodes}
                onSelect={setModal}
                departments={departments}
                humans={humans}
              />
            )}
            {tab === "gantt" && (
              <GanttView
                allNodes={allNodes}
                projData={computedProjData}
                departments={departments}
                humans={humans}
                onNodesChange={loadAllNodes}
              />
            )}
            {tab === "calendar" && (
              <CalendarView
                allNodes={allNodes}
                projData={computedProjData}
                departments={departments}
                humans={humans}
                onNodesChange={loadAllNodes}
              />
            )}
          </div>

          {tab !== "projects" && tab !== "kanban" && tab !== "gantt" && tab !== "calendar" && <RightPanel onSelect={setModal} activeProject={activeProject} onGoBoard={() => setTab("board")} />}
        </>
      )}
      {modal && <Modal item={modal} onClose={() => setModal(null)} activeProject={activeProject} projData={computedProjData} />}
    </div>
  );
}
