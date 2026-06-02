import { useState, useEffect, useMemo } from "react";
import LeftPanel, { TABS } from "./components/LeftPanel";
import OntologyGraph from "./components/OntologyGraph";
import TasksTable from "./components/TasksTable";
import RightPanel from "./components/RightPanel";
import ProjectsView from "./components/ProjectsView";
import KanbanView from "./components/KanbanView";
import ChatView from "./components/ChatView";
import GanttView from "./components/GanttView";
import CalendarView from "./components/CalendarView";
import ArchiveView from "./components/ArchiveView";
import Modal from "./components/Modal";
import { COLORS } from "./data/mockData";

const API = "";
const { bg: B, border: BR, text: T, muted: M } = COLORS;

export default function App() {
  const [tab,           setTab]           = useState("dashboard");
  const [modal,         setModal]         = useState(null);
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
          <ChatView activeProject={activeProject} />
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
                <div style={{ height: "calc(55vh - 36px)", minHeight: 320, flexShrink: 0 }}>
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

          {tab !== "projects" && tab !== "kanban" && tab !== "gantt" && tab !== "calendar" && <RightPanel onSelect={setModal} activeProject={activeProject} />}
        </>
      )}
      {modal && <Modal item={modal} onClose={() => setModal(null)} activeProject={activeProject} projData={computedProjData} />}
    </div>
  );
}
