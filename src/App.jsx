import { useState } from "react";
import LeftPanel, { TABS } from "./components/LeftPanel";
import OntologyGraph from "./components/OntologyGraph";
import OfficeMap from "./components/OfficeMap";
import TasksTable from "./components/TasksTable";
import RightPanel from "./components/RightPanel";
import ProjectsView from "./components/ProjectsView";
import KanbanView from "./components/KanbanView";
import Modal from "./components/Modal";
import { COLORS } from "./data/mockData";

const { bg: B, border: BR, text: T, muted: M } = COLORS;

export default function App() {
  const [tab,   setTab]   = useState("dashboard");
  const [modal, setModal] = useState(null);

  return (
    <div style={{ display: "flex", height: "100vh", background: B, color: T, fontFamily: "system-ui,-apple-system,sans-serif", overflow: "hidden" }}>
      <LeftPanel tab={tab} setTab={setTab} />

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid " + BR, background: "#09090f", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T }}>{TABS.find((t) => t.id === tab)?.l}</span>
          <span style={{ fontSize: 10, color: M }}>{new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}</span>
        </div>

        {tab === "dashboard" && (
          <>
            <OntologyGraph onNodeClick={setModal} />
            <OfficeMap onCharClick={setModal} />
            <TasksTable onTaskClick={setModal} />
          </>
        )}
        {tab === "projects" && <ProjectsView onSelect={setModal} />}
        {tab === "kanban"   && <KanbanView   onSelect={setModal} />}
      </div>

      <RightPanel onSelect={setModal} />
      {modal && <Modal item={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
