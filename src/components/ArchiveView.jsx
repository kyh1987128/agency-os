import { useState, useEffect, useRef } from "react";

const API = "";

const STATUS_COLORS = {
  todo:   "#94a3b8",
  active: "#f59e0b",
  review: "#6366f1",
  done:   "#34d399",
};

// ─── 폴더 트리 유틸 ───────────────────────────────────────────────
function buildTree(folders, parentId = null) {
  return folders
    .filter(f => (f.parentId ?? null) === parentId)
    .map(f => ({ ...f, children: buildTree(folders, f.id) }));
}

function collectDescendantIds(folders, folderId) {
  const result = [folderId];
  const children = folders.filter(f => f.parentId === folderId);
  for (const c of children) {
    result.push(...collectDescendantIds(folders, c.id));
  }
  return result;
}

function getBreadcrumb(folders, folderId) {
  const crumbs = [];
  let current = folders.find(f => f.id === folderId);
  while (current) {
    crumbs.unshift(current.name);
    current = current.parentId ? folders.find(f => f.id === current.parentId) : null;
  }
  return crumbs;
}

// ─── 폴더 트리 아이템 ────────────────────────────────────────────
function FolderItem({
  node,
  depth,
  selectedFolderId,
  expandedFolders,
  editingFolderId,
  editingName,
  onSelect,
  onToggle,
  onEditChange,
  onEditCommit,
  onDelete,
  onAddSubFolder,
  onDropProject,
}) {
  const isSelected  = selectedFolderId === node.id;
  const isExpanded  = expandedFolders.has(node.id);
  const isEditing   = editingFolderId === node.id;
  const hasChildren = node.children && node.children.length > 0;
  const inputRef    = useRef(null);
  const menuRef     = useRef(null);
  const [dragOver,  setDragOver]  = useState(false);
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [hovered,   setHovered]   = useState(false);

  useEffect(() => {
    if (isEditing && inputRef.current) inputRef.current.focus();
  }, [isEditing]);

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const menuItems = [
    { icon: "📁", label: "하위 폴더 추가", action: () => { setMenuOpen(false); onAddSubFolder(node.id); } },
    { icon: "✏️", label: "이름 변경",     action: () => { setMenuOpen(false); onEditChange(node.name); onEditCommit && (() => {}); /* trigger edit */ onSelect(node.id); setTimeout(() => { onEditChange(node.name); }, 0); onAddSubFolder("__rename__" + node.id); } },
    { icon: "🗑️", label: "삭제",          action: () => { setMenuOpen(false); onDelete(node); } },
  ];

  // 이름 변경은 별도 콜백으로 처리
  const handleRename = (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    onAddSubFolder("__rename__" + node.id);
  };
  const handleAddSub = (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    onAddSubFolder(node.id);
  };
  const handleDelete = (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    onDelete(node);
  };

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          paddingLeft: 8 + depth * 16,
          paddingRight: 4,
          height: 30,
          borderRadius: 6,
          cursor: "pointer",
          background: dragOver ? "#ede9fe" : isSelected ? "#ede9fe" : hovered ? "#f8fafc" : "transparent",
          color: isSelected || dragOver ? "#6366f1" : "#475569",
          fontSize: 12,
          userSelect: "none",
          outline: dragOver ? "2px dashed #6366f1" : "none",
          outlineOffset: -2,
          transition: "background 0.1s",
        }}
        onClick={() => onSelect(node.id)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOver(true); }}
        onDragEnter={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
        onDrop={e => {
          e.preventDefault();
          setDragOver(false);
          const projectId = e.dataTransfer.getData("projectId");
          if (projectId) onDropProject(projectId, node.id);
        }}
      >
        {/* 펼침 토글 */}
        <span
          style={{ width: 14, fontSize: 9, color: "#94a3b8", flexShrink: 0, cursor: hasChildren ? "pointer" : "default" }}
          onClick={e => { e.stopPropagation(); if (hasChildren) onToggle(node.id); }}
        >
          {hasChildren ? (isExpanded ? "▼" : "▶") : ""}
        </span>

        {/* 폴더 아이콘 */}
        <span style={{ fontSize: 13, marginRight: 5, flexShrink: 0 }}>
          {isExpanded || dragOver ? "📂" : "📁"}
        </span>

        {/* 이름 or 편집 input */}
        {isEditing ? (
          <input
            ref={inputRef}
            value={editingName}
            onChange={e => onEditChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") onEditCommit(node.id);
              if (e.key === "Escape") onEditCommit(null);
            }}
            onBlur={() => onEditCommit(node.id)}
            onClick={e => e.stopPropagation()}
            style={{
              flex: 1, fontSize: 12,
              border: "1px solid #6366f1", borderRadius: 4,
              padding: "1px 4px", outline: "none", color: "#1e293b",
            }}
          />
        ) : (
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {node.name}
          </span>
        )}

        {/* ··· 메뉴 버튼 — hover 시만 표시 */}
        {!isEditing && (hovered || menuOpen) && (
          <span
            ref={menuRef}
            style={{ position: "relative", flexShrink: 0 }}
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
          >
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 20, height: 20, borderRadius: 4, fontSize: 13,
              color: "#94a3b8", cursor: "pointer",
              background: menuOpen ? "#e2e8f0" : "transparent",
            }}>···</span>

            {/* 드롭다운 메뉴 */}
            {menuOpen && (
              <div style={{
                position: "absolute", right: 0, top: "100%", zIndex: 200,
                background: "#fff", border: "1px solid #e2e8f0",
                borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                minWidth: 140, padding: "4px 0",
              }}>
                <div
                  onClick={handleAddSub}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", fontSize: 11, cursor: "pointer", color: "#475569" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <span>📁</span> 하위 폴더 추가
                </div>
                <div
                  onClick={handleRename}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", fontSize: 11, cursor: "pointer", color: "#475569" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <span>✏️</span> 이름 변경
                </div>
                <div style={{ height: 1, background: "#f1f5f9", margin: "4px 0" }} />
                <div
                  onClick={handleDelete}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", fontSize: 11, cursor: "pointer", color: "#ef4444" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#fff5f5"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <span>🗑️</span> 삭제
                </div>
              </div>
            )}
          </span>
        )}
      </div>

      {/* 하위 폴더 */}
      {isExpanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <FolderItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedFolderId={selectedFolderId}
              expandedFolders={expandedFolders}
              editingFolderId={editingFolderId}
              editingName={editingName}
              onSelect={onSelect}
              onToggle={onToggle}
              onEditChange={onEditChange}
              onEditCommit={onEditCommit}
              onDelete={onDelete}
              onAddSubFolder={onAddSubFolder}
              onDropProject={onDropProject}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 메인 컴포넌트 ───────────────────────────────────────────────
export default function ArchiveView({ projects = [], allNodes = [], onRestored }) {
  const [folders, setFolders]               = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [editingFolderId, setEditingFolderId]   = useState(null);
  const [editingName, setEditingName]           = useState("");
  const [selectedProject, setSelectedProject]   = useState(null);
  const [expandedFolders, setExpandedFolders]   = useState(new Set());
  const [search, setSearch]                     = useState("");
  const [dragOverUnassigned, setDragOverUnassigned] = useState(false);
  // 상세 패널 탭
  const [detailTab, setDetailTab]               = useState("tasks");
  const [chatMessages, setChatMessages]         = useState([]);
  const [notes, setNotes]                       = useState([]);
  const [detailLoading, setDetailLoading]       = useState(false);

  // 폴더 로드
  const loadFolders = () => {
    fetch(`${API}/api/archive/folders`)
      .then(r => r.json())
      .then(data => setFolders(Array.isArray(data) ? data : []))
      .catch(() => {});
  };

  useEffect(() => { loadFolders(); }, []);

  // 상세 패널: 프로젝트 선택 시 데이터 로드
  useEffect(() => {
    if (!selectedProject) { setChatMessages([]); setNotes([]); return; }
    setDetailTab("tasks");
    // 채팅 메시지 로드 (general 채널)
    fetch(`${API}/api/projects/${selectedProject.id}/messages/general`)
      .then(r => r.json())
      .then(data => setChatMessages(Array.isArray(data) ? data : []))
      .catch(() => setChatMessages([]));
    // 노트 로드
    fetch(`${API}/api/projects/${selectedProject.id}/notes`)
      .then(r => r.json())
      .then(data => setNotes(Array.isArray(data) ? data : []))
      .catch(() => setNotes([]));
  }, [selectedProject]);

  // ── 폴더 CRUD ──
  // parentId: null → 루트, folder id → 하위 폴더
  const handleNewFolder = async (parentId = null) => {
    try {
      const res = await fetch(`${API}/api/archive/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "새 폴더", parentId: parentId || null }),
      });
      const created = await res.json();
      // 부모 폴더가 있으면 자동으로 펼치기
      if (parentId) {
        setExpandedFolders(prev => {
          const next = new Set(prev);
          next.add(parentId);
          return next;
        });
      }
      await loadFoldersAsync();
      setEditingFolderId(created.id);
      setEditingName("새 폴더");
    } catch (err) {
      console.error("폴더 생성 실패:", err);
    }
  };

  // loadFolders를 Promise 버전으로도 제공
  const loadFoldersAsync = () => {
    return fetch(`${API}/api/archive/folders`)
      .then(r => r.json())
      .then(data => setFolders(Array.isArray(data) ? data : []))
      .catch(() => {});
  };

  // onAddSubFolder: "__rename__<id>" 패턴이면 이름변경, 아니면 하위폴더 생성
  const handleAddSubFolder = (payload) => {
    if (typeof payload === "string" && payload.startsWith("__rename__")) {
      const folderId = payload.replace("__rename__", "");
      const folder = folders.find(f => f.id === folderId);
      if (folder) {
        setEditingFolderId(folderId);
        setEditingName(folder.name);
      }
    } else {
      handleNewFolder(payload);
    }
  };

  const handleEditCommit = async (folderId) => {
    if (!folderId) { setEditingFolderId(null); setEditingName(""); return; }
    const trimmed = editingName.trim();
    if (trimmed) {
      try {
        await fetch(`${API}/api/archive/folders/${folderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        });
        loadFolders();
      } catch (err) {
        console.error("폴더 이름 수정 실패:", err);
      }
    }
    setEditingFolderId(null);
    setEditingName("");
  };

  const handleDeleteFolder = async (node) => {
    if (!window.confirm(`"${node.name}" 폴더를 삭제하시겠습니까?`)) return;
    try {
      await fetch(`${API}/api/archive/folders/${node.id}`, { method: "DELETE" });
      loadFolders();
      if (selectedFolderId === node.id) setSelectedFolderId(null);
    } catch (err) {
      console.error("폴더 삭제 실패:", err);
    }
  };

  const handleToggleFolder = (folderId) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId); else next.add(folderId);
      return next;
    });
  };

  // ── 프로젝트 필터링 ──
  const archivedProjects = projects.filter(p => p.archived);

  const filteredProjects = archivedProjects.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (selectedFolderId === null) return true;
    if (selectedFolderId === "unassigned") return !p.archiveFolderId;
    const ids = collectDescendantIds(folders, selectedFolderId);
    return ids.includes(p.archiveFolderId);
  });

  // ── 프로젝트 복원 ──
  const handleRestore = async (pid) => {
    try {
      await fetch(`${API}/api/projects/${pid}/unarchive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });
      if (selectedProject?.id === pid) setSelectedProject(null);
      if (onRestored) onRestored();
    } catch (err) {
      console.error("복원 실패:", err);
    }
  };

  // ── 폴더 이동 ──
  const handleMoveFolder = async (pid, archiveFolderId) => {
    try {
      await fetch(`${API}/api/projects/${pid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archiveFolderId: archiveFolderId || null }),
      });
      if (onRestored) onRestored();
    } catch (err) {
      console.error("폴더 이동 실패:", err);
    }
  };

  // ── breadcrumb ──
  const breadcrumb =
    selectedFolderId === null ? ["전체"] :
    selectedFolderId === "unassigned" ? ["미분류"] :
    getBreadcrumb(folders, selectedFolderId);

  const folderTree = buildTree(folders);

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden", background: "#f8fafc", position: "relative" }}>

      {/* ──── 좌측 폴더 트리 ──── */}
      <div style={{
        width: 200,
        background: "#ffffff",
        borderRight: "1px solid #e2e8f0",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        overflow: "auto",
      }}>
        {/* 새 폴더 버튼 — 항상 루트 폴더 생성 */}
        <div style={{ padding: "10px 8px 6px" }}>
          <button
            onClick={() => handleNewFolder(null)}
            style={{
              width: "100%",
              padding: "7px 10px",
              borderRadius: 7,
              border: "1px dashed #c7d2fe",
              background: "#f5f3ff",
              color: "#6366f1",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              textAlign: "left",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#ede9fe"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#f5f3ff"; }}
            title="루트 폴더 추가"
          >
            📁 새 폴더
          </button>
        </div>

        {/* 전체 아이템 */}
        <div style={{ padding: "0 8px 4px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              height: 30,
              paddingLeft: 8,
              paddingRight: 6,
              borderRadius: 6,
              cursor: "pointer",
              background: selectedFolderId === null ? "#ede9fe" : "transparent",
              color: selectedFolderId === null ? "#6366f1" : "#475569",
              fontSize: 12,
              fontWeight: selectedFolderId === null ? 700 : 400,
            }}
            onClick={() => setSelectedFolderId(null)}
            onMouseEnter={e => { if (selectedFolderId !== null) e.currentTarget.style.background = "#f8fafc"; }}
            onMouseLeave={e => { if (selectedFolderId !== null) e.currentTarget.style.background = "transparent"; }}
          >
            <span style={{ fontSize: 13, marginRight: 5 }}>📦</span>
            전체
            <span style={{
              marginLeft: "auto",
              fontSize: 10,
              background: selectedFolderId === null ? "#c7d2fe" : "#f1f5f9",
              color: selectedFolderId === null ? "#6366f1" : "#94a3b8",
              borderRadius: 10,
              padding: "1px 6px",
            }}>
              {archivedProjects.length}
            </span>
          </div>

          {/* 미분류 아이템 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              height: 30,
              paddingLeft: 8,
              paddingRight: 6,
              borderRadius: 6,
              cursor: "pointer",
              background: dragOverUnassigned ? "#ede9fe" : selectedFolderId === "unassigned" ? "#ede9fe" : "transparent",
              color: selectedFolderId === "unassigned" || dragOverUnassigned ? "#6366f1" : "#475569",
              fontSize: 12,
              fontWeight: selectedFolderId === "unassigned" ? 700 : 400,
              outline: dragOverUnassigned ? "2px dashed #6366f1" : "none",
              outlineOffset: -2,
              transition: "background 0.1s",
            }}
            onClick={() => setSelectedFolderId("unassigned")}
            onMouseEnter={e => { if (selectedFolderId !== "unassigned" && !dragOverUnassigned) e.currentTarget.style.background = "#f8fafc"; }}
            onMouseLeave={e => { if (selectedFolderId !== "unassigned" && !dragOverUnassigned) e.currentTarget.style.background = "transparent"; }}
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverUnassigned(true); }}
            onDragEnter={e => { e.preventDefault(); setDragOverUnassigned(true); }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverUnassigned(false); }}
            onDrop={e => {
              e.preventDefault();
              setDragOverUnassigned(false);
              const projectId = e.dataTransfer.getData("projectId");
              if (projectId) handleMoveFolder(projectId, null);
            }}
          >
            <span style={{ fontSize: 13, marginRight: 5 }}>📄</span>
            미분류
            <span style={{
              marginLeft: "auto",
              fontSize: 10,
              background: selectedFolderId === "unassigned" ? "#c7d2fe" : "#f1f5f9",
              color: selectedFolderId === "unassigned" ? "#6366f1" : "#94a3b8",
              borderRadius: 10,
              padding: "1px 6px",
            }}>
              {archivedProjects.filter(p => !p.archiveFolderId).length}
            </span>
          </div>
        </div>

        {/* 폴더 구분선 */}
        {folderTree.length > 0 && (
          <div style={{ height: 1, background: "#f1f5f9", margin: "4px 10px" }} />
        )}

        {/* 폴더 트리 */}
        <div style={{ flex: 1, padding: "0 8px 8px", overflow: "auto" }}>
          <style>{`
            .folder-item:hover .folder-menu { display: inline !important; }
          `}</style>
          {folderTree.map(node => (
            <div key={node.id} className="folder-item"
              onMouseEnter={e => { const m = e.currentTarget.querySelector('.folder-menu'); if (m) m.style.display = 'inline'; }}
              onMouseLeave={e => { const m = e.currentTarget.querySelector('.folder-menu'); if (m) m.style.display = 'none'; }}
            >
              <FolderItem
                node={node}
                depth={0}
                selectedFolderId={selectedFolderId}
                expandedFolders={expandedFolders}
                editingFolderId={editingFolderId}
                editingName={editingName}
                onSelect={setSelectedFolderId}
                onToggle={handleToggleFolder}
                onEditChange={setEditingName}
                onEditCommit={handleEditCommit}
                onDelete={handleDeleteFolder}
                onAddSubFolder={handleAddSubFolder}
                onDropProject={handleMoveFolder}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ──── 우측 프로젝트 그리드 ──── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* 상단 헤더 */}
        <div style={{
          padding: "14px 20px 12px",
          background: "#fff",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexShrink: 0,
        }}>
          {/* breadcrumb */}
          <div style={{ fontSize: 12, color: "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}>
            {breadcrumb.map((crumb, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {i > 0 && <span style={{ fontSize: 10 }}>›</span>}
                <span style={{ color: i === breadcrumb.length - 1 ? "#1e293b" : "#94a3b8", fontWeight: i === breadcrumb.length - 1 ? 600 : 400 }}>
                  {crumb}
                </span>
              </span>
            ))}
          </div>

          <span style={{ fontSize: 11, color: "#cbd5e1" }}>—</span>

          {/* 검색 */}
          <input
            type="text"
            placeholder="프로젝트 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              padding: "6px 12px",
              borderRadius: 7,
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              fontSize: 11,
              color: "#1e293b",
              outline: "none",
              width: 180,
            }}
          />

          <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: "auto" }}>
            {filteredProjects.length}개 프로젝트
          </span>
        </div>

        {/* 카드 그리드 */}
        <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
          {filteredProjects.length === 0 ? (
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "80px 20px",
              color: "#94a3b8",
            }}>
              <span style={{ fontSize: 40, marginBottom: 12 }}>📦</span>
              <span style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                {archivedProjects.length === 0 ? "보관된 프로젝트가 없습니다" : "프로젝트가 없습니다"}
              </span>
              <span style={{ fontSize: 12 }}>
                {archivedProjects.length === 0
                  ? "프로젝트를 보관하면 여기에 표시됩니다"
                  : "다른 폴더를 선택하거나 검색어를 변경해보세요"}
              </span>
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 14,
            }}>
              {filteredProjects.map(project => {
                const projectNodes = allNodes.filter(n => n.projectId === project.id);
                const total = projectNodes.length;
                const done  = projectNodes.filter(n => n.status === "done").length;
                const pct   = total ? Math.round((done / total) * 100) : 0;
                const folderName = folders.find(f => f.id === project.archiveFolderId)?.name;

                return (
                  <div
                    key={project.id}
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.setData("projectId", project.id);
                      e.dataTransfer.effectAllowed = "move";
                      e.currentTarget.style.opacity = "0.5";
                    }}
                    onDragEnd={e => { e.currentTarget.style.opacity = "1"; }}
                    onClick={() => setSelectedProject(project)}
                    style={{
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: 10,
                      padding: "16px 18px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      cursor: "grab",
                      transition: "box-shadow 0.15s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(99,102,241,0.10)"}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
                  >
                    {/* 카드 헤더 */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {/* 드래그 핸들 */}
                      <span
                        style={{
                          fontSize: 14, color: "#cbd5e1", cursor: "grab", flexShrink: 0,
                          lineHeight: 1, userSelect: "none",
                        }}
                        title="드래그하여 폴더로 이동"
                      >⠿</span>
                      <div style={{
                        width: 10, height: 10,
                        borderRadius: "50%",
                        background: project.color || "#6366f1",
                        flexShrink: 0,
                      }} />
                      <span style={{
                        flex: 1, fontSize: 13, fontWeight: 700, color: "#1e293b",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>{project.name}</span>
                      {project.archivedYear && (
                        <span style={{
                          fontSize: 9, color: "#94a3b8",
                          background: "#f1f5f9",
                          padding: "2px 7px", borderRadius: 6, whiteSpace: "nowrap",
                        }}>{project.archivedYear}년</span>
                      )}
                    </div>

                    {/* 완료율 바 */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 10, color: "#64748b" }}>완료율</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#6366f1" }}>{pct}%</span>
                      </div>
                      <div style={{ height: 5, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", width: pct + "%",
                          background: "linear-gradient(90deg,#6366f1,#38bdf8)",
                          borderRadius: 3, transition: "width 0.3s",
                        }} />
                      </div>
                    </div>

                    {/* 태스크 수 */}
                    <div style={{ display: "flex", gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 10, color: "#94a3b8" }}>태스크</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>{total}개</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 10, color: "#94a3b8" }}>완료</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#34d399" }}>{done}개</span>
                      </div>
                    </div>

                    {/* 폴더명 */}
                    {folderName && (
                      <div style={{ fontSize: 10, color: "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}>
                        <span>📁</span>
                        <span>{folderName}</span>
                      </div>
                    )}

                    {/* 폴더이동 + 복원 버튼 */}
                    <div
                      style={{ display: "flex", gap: 6 }}
                      onClick={e => e.stopPropagation()}
                    >
                      <select
                        value={project.archiveFolderId || ""}
                        onChange={e => handleMoveFolder(project.id, e.target.value || null)}
                        style={{
                          flex: 1,
                          padding: "5px 6px",
                          borderRadius: 6,
                          border: "1px solid #e2e8f0",
                          background: "#f8fafc",
                          color: "#475569",
                          fontSize: 10,
                          cursor: "pointer",
                          outline: "none",
                        }}
                      >
                        <option value="">📄 미분류</option>
                        {folders.map(f => (
                          <option key={f.id} value={f.id}>📁 {f.name}</option>
                        ))}
                      </select>

                      <button
                        onClick={() => handleRestore(project.id)}
                        style={{
                          padding: "5px 10px",
                          borderRadius: 6,
                          border: "1px solid #e2e8f0",
                          background: "#f8fafc",
                          color: "#6366f1",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          transition: "background 0.12s, border-color 0.12s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#ede9fe"; e.currentTarget.style.borderColor = "#6366f1"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.borderColor = "#e2e8f0"; }}
                      >
                        ↩ 복원
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ──── 프로젝트 상세 패널 ──── */}
      {selectedProject && (() => {
        const p = selectedProject;
        const pNodes = allNodes.filter(n => n.projectId === p.id);
        const total  = pNodes.length;
        const done   = pNodes.filter(n => n.status === "done").length;
        const active = pNodes.filter(n => n.status === "active").length;
        const review = pNodes.filter(n => n.status === "review").length;
        const todo   = pNodes.filter(n => n.status === "todo").length;
        const pct    = total ? Math.round((done / total) * 100) : 0;

        return (
          <div style={{
            position: "absolute",
            top: 0, right: 0,
            width: 360,
            height: "100%",
            background: "#fff",
            borderLeft: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            boxShadow: "-4px 0 20px rgba(0,0,0,0.08)",
            zIndex: 10,
            animation: "slideIn 0.2s ease",
          }}>
            <style>{`
              @keyframes slideIn { from { transform: translateX(30px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
            `}</style>

            {/* 패널 헤더 */}
            <div style={{
              padding: "16px 18px 14px",
              borderBottom: "1px solid #f1f5f9",
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexShrink: 0,
            }}>
              <div style={{
                width: 12, height: 12,
                borderRadius: "50%",
                background: p.color || "#6366f1",
                flexShrink: 0,
              }} />
              <span style={{
                flex: 1, fontSize: 14, fontWeight: 700, color: "#1e293b",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{p.name}</span>
              <button
                onClick={() => setSelectedProject(null)}
                style={{
                  width: 24, height: 24,
                  border: "none", background: "transparent",
                  color: "#94a3b8", fontSize: 16, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: 6,
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#f1f5f9"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                ✕
              </button>
            </div>

            {/* 완료율 (크게) */}
            <div style={{ padding: "16px 18px 14px", borderBottom: "1px solid #f1f5f9", flexShrink: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "#64748b" }}>완료율</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: "#6366f1" }}>{pct}%</span>
              </div>
              <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: pct + "%",
                  background: "linear-gradient(90deg,#6366f1,#38bdf8)",
                  borderRadius: 4, transition: "width 0.3s",
                }} />
              </div>
            </div>

            {/* 통계 */}
            <div style={{
              padding: "12px 18px",
              borderBottom: "1px solid #f1f5f9",
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr 1fr",
              gap: 8,
              flexShrink: 0,
            }}>
              {[
                { label: "전체",   val: total,  color: "#475569" },
                { label: "완료",   val: done,   color: "#34d399" },
                { label: "진행중", val: active, color: "#f59e0b" },
                { label: "대기",   val: todo,   color: "#94a3b8" },
              ].map(s => (
                <div key={s.label} style={{
                  background: "#f8fafc",
                  borderRadius: 8,
                  padding: "8px 4px",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* 탭 헤더 */}
            <div style={{
              display: "flex",
              borderBottom: "1px solid #f1f5f9",
              padding: "0 18px",
              flexShrink: 0,
            }}>
              {[
                { id: "tasks", icon: "📋", label: "태스크", count: pNodes.length },
                { id: "chat",  icon: "💬", label: "채팅",   count: chatMessages.length },
                { id: "notes", icon: "📎", label: "노트",   count: notes.length },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setDetailTab(t.id)}
                  style={{
                    padding: "8px 10px",
                    border: "none",
                    background: "transparent",
                    borderBottom: detailTab === t.id ? "2px solid #6366f1" : "2px solid transparent",
                    color: detailTab === t.id ? "#6366f1" : "#94a3b8",
                    fontSize: 11,
                    fontWeight: detailTab === t.id ? 700 : 400,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    marginBottom: -1,
                    transition: "color 0.1s",
                  }}
                >
                  <span>{t.icon}</span>
                  {t.label}
                  {t.count > 0 && (
                    <span style={{
                      fontSize: 9,
                      background: detailTab === t.id ? "#ede9fe" : "#f1f5f9",
                      color: detailTab === t.id ? "#6366f1" : "#94a3b8",
                      borderRadius: 8, padding: "1px 5px", fontWeight: 700,
                    }}>{t.count}</span>
                  )}
                </button>
              ))}
            </div>

            {/* 탭 콘텐츠 */}
            <div style={{ flex: 1, overflow: "auto", padding: "10px 18px" }}>

              {/* 태스크 탭 */}
              {detailTab === "tasks" && (
                <>
                  {pNodes.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#cbd5e1", textAlign: "center", padding: "30px 0" }}>
                      태스크가 없습니다
                    </div>
                  ) : (
                    pNodes.map(node => (
                      <div key={node.id} style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 0",
                        borderBottom: "1px solid #f8fafc",
                      }}>
                        <div style={{
                          width: 7, height: 7,
                          borderRadius: "50%",
                          background: STATUS_COLORS[node.status] || "#94a3b8",
                          flexShrink: 0,
                        }} />
                        <span style={{
                          flex: 1, fontSize: 12, color: "#1e293b",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{node.title}</span>
                        {node.dueDate && (
                          <span style={{ fontSize: 10, color: "#94a3b8", whiteSpace: "nowrap" }}>
                            {node.dueDate}
                          </span>
                        )}
                        {node.assignee && (
                          <span style={{
                            fontSize: 10, color: "#fff",
                            background: "#6366f1",
                            borderRadius: "50%",
                            width: 20, height: 20,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0,
                            fontWeight: 700,
                          }}>
                            {(node.assignee || "?")[0]}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </>
              )}

              {/* 채팅 탭 */}
              {detailTab === "chat" && (
                <>
                  {chatMessages.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#cbd5e1", textAlign: "center", padding: "30px 0" }}>
                      채팅 기록이 없습니다
                    </div>
                  ) : (
                    [...chatMessages].reverse().map(msg => (
                      <div key={msg.id} style={{
                        padding: "10px 0",
                        borderBottom: "1px solid #f8fafc",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <div style={{
                            width: 22, height: 22, borderRadius: "50%",
                            background: msg.role === "assistant" ? "linear-gradient(135deg,#6366f1,#38bdf8)" : "#e2e8f0",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, color: msg.role === "assistant" ? "#fff" : "#475569",
                            fontWeight: 700, flexShrink: 0,
                          }}>
                            {msg.role === "assistant" ? (msg.agentName || "AI")[0] : "나"[0]}
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>
                            {msg.role === "assistant" ? (msg.agentName || "AI") : "나"}
                          </span>
                          <span style={{ fontSize: 9, color: "#cbd5e1", marginLeft: "auto" }}>
                            {msg.timestamp ? new Date(msg.timestamp).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                          </span>
                        </div>
                        <div style={{
                          fontSize: 11, color: "#475569", lineHeight: 1.5,
                          whiteSpace: "pre-wrap", wordBreak: "break-word",
                          paddingLeft: 28,
                        }}>
                          {msg.content}
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

              {/* 노트/첨부파일 탭 */}
              {detailTab === "notes" && (
                <>
                  {notes.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#cbd5e1", textAlign: "center", padding: "30px 0" }}>
                      노트가 없습니다
                    </div>
                  ) : (
                    notes.map(note => (
                      <div key={note.id} style={{
                        padding: "10px 0",
                        borderBottom: "1px solid #f8fafc",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                          <div style={{
                            width: 22, height: 22, borderRadius: "50%",
                            background: "#e2e8f0",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, color: "#475569", fontWeight: 700, flexShrink: 0,
                          }}>
                            {(note.author || "나")[0]}
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>{note.author || "나"}</span>
                          <span style={{ fontSize: 9, color: "#cbd5e1", marginLeft: "auto" }}>
                            {note.createdAt ? new Date(note.createdAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                          </span>
                        </div>
                        {note.content && (
                          <div style={{
                            fontSize: 11, color: "#475569", lineHeight: 1.5,
                            whiteSpace: "pre-wrap", wordBreak: "break-word",
                            paddingLeft: 28,
                          }}>
                            {note.content}
                          </div>
                        )}
                        {note.files && note.files.length > 0 && (
                          <div style={{ paddingLeft: 28, marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {note.files.map((file, fi) => {
                              const isImage = file.mime?.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(file.url || "");
                              return (
                                <a
                                  key={fi}
                                  href={`${API}${file.url}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ textDecoration: "none" }}
                                >
                                  {isImage ? (
                                    <img
                                      src={`${API}${file.url}`}
                                      alt={file.name}
                                      style={{
                                        width: 80, height: 60, objectFit: "cover",
                                        borderRadius: 6, border: "1px solid #e2e8f0",
                                        display: "block",
                                      }}
                                    />
                                  ) : (
                                    <div style={{
                                      display: "flex", alignItems: "center", gap: 4,
                                      padding: "4px 8px",
                                      background: "#f8fafc",
                                      border: "1px solid #e2e8f0",
                                      borderRadius: 6,
                                      fontSize: 10, color: "#6366f1",
                                      maxWidth: 150,
                                    }}>
                                      <span>📎</span>
                                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {file.name}
                                      </span>
                                    </div>
                                  )}
                                </a>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </>
              )}

            </div>

            {/* 하단 복원 버튼 */}
            <div style={{ padding: "14px 18px", borderTop: "1px solid #f1f5f9", flexShrink: 0 }}>
              <button
                onClick={() => handleRestore(p.id)}
                style={{
                  width: "100%",
                  padding: "10px 0",
                  borderRadius: 8,
                  border: "none",
                  background: "linear-gradient(90deg,#6366f1,#38bdf8)",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  letterSpacing: "0.02em",
                  transition: "opacity 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
                onMouseLeave={e => e.currentTarget.style.opacity = "1"}
              >
                ↩ 이 프로젝트 복원
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
