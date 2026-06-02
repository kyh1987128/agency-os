import { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import {
  ReactFlow, Background, Controls, MiniMap,
  Handle, Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const API = "";

// ── 레이아웃 상수 (좌→우 horizontal) ─────────────────────────
const PROJ_X    = 40;
const PROJ_W    = 230;
const PROJ_H    = 110;
const PROJ_GAP  = 32;   // 프로젝트 블록 간 수직 간격

const NODE_W    = 250;
const NODE_H    = 92;
const NODE_GAP  = 14;   // 형제 노드 간 수직 gap
const COL_GAP   = 110;  // 깊이별 수평 간격
const NODE_COL0 = PROJ_X + PROJ_W + COL_GAP;  // depth=0 X좌표

const depthToX = (d) => NODE_COL0 + d * (NODE_W + COL_GAP);

// ── 색상 ─────────────────────────────────────────────────────
const S_COLOR  = { done:"#16a34a", active:"#f59e0b", review:"#8b5cf6", todo:"#94a3b8" };
const S_LABEL  = { done:"완료", active:"진행중", review:"검토중", todo:"대기중" };
const PS_COLOR = { active:"#f59e0b", planning:"#6366f1", review:"#8b5cf6", done:"#16a34a" };
const PS_LABEL = { active:"진행중", planning:"기획중", review:"검토중", done:"완료" };

// ── 공통 인풋 스타일 ──────────────────────────────────────────
const IS = {
  boxSizing:"border-box", border:"1px solid #e2e8f0", borderRadius:6,
  padding:"5px 8px", fontSize:11, outline:"none",
  background:"#fff", color:"#1e293b", fontFamily:"inherit", width:"100%",
};

// ── 파일 크기 포맷 ────────────────────────────────────────────
const fmtSize = (b) =>
  b < 1024 ? `${b}B` : b < 1024*1024 ? `${(b/1024).toFixed(1)}KB` : `${(b/1024/1024).toFixed(1)}MB`;

// ── 노드 실제 높이 계산 (desc 있으면 추가 높이) ──────────────
function getNodeH(node) {
  // 패딩(20) + row1(20) + row2(28 chip) + desc있으면(+44)
  return node?.desc ? NODE_H + 44 : NODE_H;
}

// ── 재귀 서브트리 높이 계산 ───────────────────────────────────
function getSubH(node, expandedIds) {
  const base = getNodeH(node) + NODE_GAP;
  if (!expandedIds.has(node.id) || !node.children?.length) return base;
  return node.children.reduce((s, c) => s + getSubH(c, expandedIds), 0);
}

// ── 트리에서 노드 찾기 ────────────────────────────────────────
function findNodeInTree(nodes, nid) {
  for (const n of nodes) {
    if (n.id === nid) return n;
    const f = findNodeInTree(n.children || [], nid);
    if (f) return f;
  }
  return null;
}

// ── localNodes 업데이트 헬퍼 ─────────────────────────────────
function updateInTree(nodes, nid, updater) {
  return nodes.map(n => {
    if (n.id === nid) return updater(n);
    return { ...n, children: updateInTree(n.children || [], nid, updater) };
  });
}
function removeFromTree(nodes, nid) {
  return nodes
    .filter(n => n.id !== nid)
    .map(n => ({ ...n, children: removeFromTree(n.children || [], nid) }));
}

// ── 커스텀 프로젝트 노드 ─────────────────────────────────────
const ProjectNode = memo(function ProjectNode({ data }) {
  const { proj, dept, pct, psc, isExpanded, onToggle, onArchive } = data;
  const dc = dept?.color || "#6366f1";
  return (
    <div
      onClick={onToggle}
      style={{
        width: PROJ_W, minHeight: PROJ_H,
        background: "#fff", border: `2px solid ${dc}`,
        borderRadius: 14, padding: "11px 14px",
        boxShadow: isExpanded ? `0 4px 20px ${dc}30` : "0 1px 4px #00000012",
        cursor: "pointer", display: "flex", flexDirection: "column", gap: 6,
        transition: "box-shadow .15s",
        pointerEvents: "all",
        position: "relative",
      }}
    >
      <div style={{ display:"flex", alignItems:"center", gap:5 }}>
        {dept && <div style={{ width:8, height:8, borderRadius:"50%", background:dc, flexShrink:0 }} />}
        <span style={{ fontSize:9, color:dc, fontWeight:700, flex:1 }}>{dept?.name}</span>
        <span style={{ fontSize:9, color:psc, background:psc+"18", padding:"1px 6px", borderRadius:5, fontWeight:600 }}>
          {PS_LABEL[proj.status] || proj.status}
        </span>
      </div>
      <div style={{ fontSize:13, fontWeight:800, color:"#1e293b", lineHeight:1.3 }}>
        {isExpanded ? "▾ " : "▸ "}{proj.title}
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
        <div style={{ flex:1, height:4, background:"#e2e8f0", borderRadius:2 }}>
          <div style={{ width:`${pct}%`, height:4, background:dc, borderRadius:2 }} />
        </div>
        <span style={{ fontSize:9, fontWeight:700, color:dc }}>{pct}%</span>
      </div>
      {proj.due && <div style={{ fontSize:9, color:"#94a3b8" }}>마감 {proj.due}</div>}
      <Handle type="source" position={Position.Right} style={{ background:"transparent", border:"none", width:0, height:0 }} />
    </div>
  );
});

// ── 커스텀 태스크 노드 ────────────────────────────────────────
const TaskNode = memo(function TaskNode({ data }) {
  const {
    node, humansList = [], isExpanded, isSelected,
    confirmingDelete, onToggle, onAdd, onSelect, onDeleteAsk, onDeleteConfirm, onDeleteCancel,
  } = data;
  const sc = S_COLOR[node.status] || "#94a3b8";
  const hasChildren = node.children?.length > 0;
  // assignees 배열 지원 (이전 assignee 단일값 호환)
  const assigneeIds = Array.isArray(node.assignees) ? node.assignees : (node.assignee ? [node.assignee] : []);
  const assigneeHumans = assigneeIds.map(id => humansList.find(h => h.id === id)).filter(Boolean);
  const dueStr = node.dueDate ? node.dueDate.slice(5) : null;
  const attCount     = node.attachments?.length || 0;
  const commentCount = node.comments?.length || 0;

  return (
    <div
      onClick={() => { onToggle(node.id); onSelect(node.id); }}
      style={{
        width: NODE_W, minHeight: NODE_H,
        background: "#fff",
        border: isSelected ? `2px solid #6366f1` : `1.5px solid ${isExpanded ? sc : "#e2e8f0"}`,
        borderLeft: `5px solid ${sc}`,
        borderRadius: 10, padding: "10px 12px",
        boxShadow: isSelected
          ? "0 0 0 3px #6366f120, 0 2px 12px #0000001a"
          : isExpanded ? `0 2px 12px ${sc}25` : "0 1px 3px #0000000b",
        display: "flex", flexDirection: "column", gap: 5,
        transition: "all .15s",
        cursor: "pointer",
        position: "relative",
        pointerEvents: "all",
      }}
    >
      <Handle type="target" position={Position.Left}  style={{ background:"transparent", border:"none", width:0, height:0 }} />
      <Handle type="source" position={Position.Right} style={{ background:"transparent", border:"none", width:0, height:0 }} />

      {/* Row 1: 펼침 인디케이터 + 제목 + 추가 + 삭제 */}
      <div style={{ display:"flex", alignItems:"center", gap:3 }}>
        {/* 펼침 인디케이터 (버튼 아님) */}
        <span style={{
          width:14, height:14, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:7, color: hasChildren ? sc : "transparent",
        }}>
          {isExpanded ? "▼" : "▶"}
        </span>

        <span style={{ fontSize:13, fontWeight:700, color:"#1e293b", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {node.title}
        </span>

        {/* + 추가 */}
        <button
          onClick={e => { e.stopPropagation(); onAdd(node.id); }}
          style={{
            width:17, height:17, borderRadius:"50%", flexShrink:0,
            border:"1px solid #c4b5fd", background:"#fff",
            color:"#6366f1", fontSize:12, cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center", padding:0, fontWeight:700,
          }}
          title="자식 노드 추가"
        >+</button>

        {/* 삭제 */}
        {confirmingDelete ? (
          <div style={{ display:"flex", gap:2, flexShrink:0 }}>
            <button onClick={e => { e.stopPropagation(); onDeleteConfirm(node.id); }}
              style={{ fontSize:8, padding:"1px 5px", borderRadius:3, border:"none", background:"#dc2626", color:"#fff", cursor:"pointer" }}>
              삭제
            </button>
            <button onClick={e => { e.stopPropagation(); onDeleteCancel(); }}
              style={{ fontSize:8, padding:"1px 5px", borderRadius:3, border:"1px solid #e2e8f0", background:"#fff", color:"#64748b", cursor:"pointer" }}>
              취소
            </button>
          </div>
        ) : (
          <button
            onClick={e => { e.stopPropagation(); onDeleteAsk(node.id); }}
            style={{
              width:16, height:16, borderRadius:3, flexShrink:0,
              border:"1px solid #fecaca", background:"#fff5f5",
              color:"#dc2626", fontSize:9, cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center", padding:0,
            }}
            title="삭제"
          >🗑</button>
        )}
      </div>

      {/* Row 2: 담당자 + 상태 + 마감 + 첨부수 칩 형태 */}
      <div style={{ display:"flex", alignItems:"center", gap:3, paddingLeft:19, flexWrap:"wrap", overflowX:"hidden" }}>
        {assigneeHumans.slice(0, 2).map(h => (
          <span key={h.id} title={h.name} style={{
            fontSize:10, color:h.color||"#6366f1",
            background:(h.color||"#6366f1")+"18",
            border:`1px solid ${(h.color||"#6366f1")}33`,
            padding:"1px 6px", borderRadius:10, fontWeight:600,
            whiteSpace:"nowrap", flexShrink:0,
          }}>
            {h.name}
          </span>
        ))}
        {assigneeHumans.length > 2 && (
          <span style={{ fontSize:9, color:"#6366f1", background:"#ede9fe", borderRadius:10, padding:"2px 5px", flexShrink:0, fontWeight:700 }}>
            +{assigneeHumans.length - 2}
          </span>
        )}
        {node.status && (
          <span style={{ fontSize:10, color:sc, background:sc+"18", border:`1px solid ${sc}33`, padding:"2px 7px", borderRadius:20, fontWeight:600 }}>
            {S_LABEL[node.status]}
          </span>
        )}
        {dueStr && (
          <span style={{ display:"inline-flex", alignItems:"center", gap:2, background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:20, padding:"2px 7px", flexShrink:0 }}>
            <span style={{ fontSize:9 }}>📅</span>
            <span style={{ fontSize:10, color:"#3b82f6", fontWeight:500 }}>{dueStr}</span>
          </span>
        )}
        {attCount > 0 && (
          <span style={{ display:"inline-flex", alignItems:"center", gap:2, background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:20, padding:"2px 6px" }}>
            <span style={{ fontSize:9 }}>📎</span>
            <span style={{ fontSize:10, color:"#64748b" }}>{attCount}</span>
          </span>
        )}
        {commentCount > 0 && (
          <span style={{ display:"inline-flex", alignItems:"center", gap:2, background:"#ede9fe", border:"1px solid #c4b5fd", borderRadius:20, padding:"2px 6px" }}>
            <span style={{ fontSize:9 }}>💬</span>
            <span style={{ fontSize:10, color:"#6366f1", fontWeight:600 }}>{commentCount}</span>
          </span>
        )}
      </div>

      {/* Row 3: 메모 — 연노랑 블록 */}
      {node.desc && (
        <div style={{ fontSize:10, color:"#78350f", background:"#fffbeb", border:"1px solid #fef08a", borderRadius:6, padding:"4px 8px", marginLeft:19, lineHeight:1.5, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>
          {node.desc}
        </div>
      )}
    </div>
  );
});

const nodeTypes = { projectNode: ProjectNode, taskNode: TaskNode };

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export default function MindMapView({ projData = [], onProjDataChange, departments = [], humans = [] }) {
  const [localData,       setLocalData]       = useState(projData);
  const [localNodes,      setLocalNodes]      = useState({});
  const [loadedProjs,     setLoadedProjs]     = useState(new Set());
  const [expandedProjIds, setExpandedProjIds] = useState(() => new Set());
  const [expandedNodeIds, setExpandedNodeIds] = useState(() => new Set());
  const [selectedNodeId,  setSelectedNodeId]  = useState(null);
  const [confirmDelete,   setConfirmDelete]   = useState(null);
  const [addingTo,        setAddingTo]        = useState(null);
  const [newNode,         setNewNode]         = useState({ title:"", assignees:[], status:"todo", dueDate:"", desc:"", progress:0 });
  const [savingNode,      setSavingNode]      = useState(false);

  // 상세 패널
  const [detailDraft,   setDetailDraft]   = useState({});
  const detailDraftRef = useRef({});
  const [savingDetail,  setSavingDetail]  = useState(false);
  const [editingDetail, setEditingDetail] = useState(false);
  const [addingAtt,     setAddingAtt]     = useState(false);
  const [newAtt,        setNewAtt]        = useState({ type:"link", name:"", url:"", size:"", desc:"", file:null });
  const [uploadingAtt,  setUploadingAtt]  = useState(false);
  const [confirmAttDel, setConfirmAttDel] = useState(null);
  const [confirmCommentDel, setConfirmCommentDel] = useState(null);

  // 코멘트
  const [newCommentText,   setNewCommentText]   = useState("");
  const [commentAuthor,    setCommentAuthor]    = useState(() => localStorage.getItem("mmv_author") || "");
  const [submittingComment,setSubmittingComment]= useState(false);

  // 사이드바 accordion
  const [sidebarExpanded, setSidebarExpanded] = useState(() => new Set());

  // 캔버스 표시 여부 (기본: 전체 표시)
  const [visibleProjIds, setVisibleProjIds] = useState(() => new Set(projData.map(p => p.id)));

  useEffect(() => { setLocalData(projData); }, [projData]);

  // 새 프로젝트 추가 시 자동으로 visible에 포함
  useEffect(() => {
    setVisibleProjIds(prev => {
      const next = new Set(prev);
      projData.forEach(p => { if (!next.has(p.id)) next.add(p.id); });
      return next;
    });
  }, [projData]);

  // ※ 자동 펼침 없음 — 사용자가 직접 펼침

  // 노드 lazy load
  useEffect(() => {
    for (const projId of expandedProjIds) {
      if (loadedProjs.has(projId)) continue;
      setLoadedProjs(prev => new Set([...prev, projId]));
      fetch(`${API}/api/data/projects/${projId}/nodes`)
        .then(r => r.json())
        .then(nodes => setLocalNodes(prev => ({ ...prev, [projId]: nodes })))
        .catch(() => setLocalNodes(prev => ({ ...prev, [projId]: [] })));
    }
  }, [expandedProjIds, loadedProjs]);

  // selectedNode 변경 시 detailDraft 초기화 + 편집모드 리셋
  useEffect(() => {
    setEditingDetail(false);
    setConfirmCommentDel(null);
    if (!selectedNodeId) { setDetailDraft({}); return; }
    const node = getNodeAnywhere(selectedNodeId);
    if (node) setDetailDraft({
      title: node.title,
      assignees: Array.isArray(node.assignees) ? node.assignees : (node.assignee ? [node.assignee] : []),
      status: node.status || "todo",
      startDate: node.startDate || "",
      dueDate: node.dueDate || "",
      desc: node.desc || "",
      progress: node.progress || 0,
    });
  }, [selectedNodeId, localNodes]);

  useEffect(() => { detailDraftRef.current = detailDraft; }, [detailDraft]);

  // ── 헬퍼 ────────────────────────────────────────────────────
  const getNodeAnywhere = useCallback((nid) => {
    for (const nodes of Object.values(localNodes)) {
      const f = findNodeInTree(nodes, nid);
      if (f) return f;
    }
    return null;
  }, [localNodes]);

  const getProjIdForNode = useCallback((nid) => {
    for (const [pid, nodes] of Object.entries(localNodes)) {
      if (findNodeInTree(nodes, nid)) return pid;
    }
    return null;
  }, [localNodes]);

  const mutateLocalNodes = useCallback((projId, updater) => {
    setLocalNodes(prev => ({ ...prev, [projId]: updater(prev[projId] || []) }));
  }, []);

  // ── 토글 ─────────────────────────────────────────────────────
  const toggleProj = useCallback((projId) => {
    setExpandedProjIds(prev => {
      const next = new Set(prev);
      if (next.has(projId)) {
        next.delete(projId);
        setExpandedNodeIds(prev2 => {
          const n2 = new Set(prev2);
          const clearAll = (nodes) => nodes.forEach(n => { n2.delete(n.id); clearAll(n.children || []); });
          clearAll(localNodes[projId] || []);
          return n2;
        });
      } else {
        next.add(projId);
      }
      return next;
    });
  }, [localNodes]);

  const toggleNode = useCallback((nodeId) => {
    setExpandedNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId);
      return next;
    });
  }, []);

  // ── 노드 추가 ────────────────────────────────────────────────
  const submitNewNode = useCallback(async () => {
    if (!newNode.title.trim() || !addingTo) return;
    setSavingNode(true);
    try {
      let projId, url;
      if (typeof addingTo === "string" && addingTo.startsWith("root:")) {
        projId = addingTo.slice(5);
        url = `${API}/api/data/projects/${projId}/nodes`;
      } else {
        projId = getProjIdForNode(addingTo);
        url = `${API}/api/data/projects/${projId}/nodes/${addingTo}/children`;
      }
      if (!projId) return;
      const r = await fetch(url, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(newNode) });
      if (r.ok) {
        const created = await r.json();
        if (typeof addingTo === "string" && addingTo.startsWith("root:")) {
          mutateLocalNodes(projId, nodes => [...nodes, created]);
        } else {
          mutateLocalNodes(projId, nodes => updateInTree(nodes, addingTo, n => ({ ...n, children:[...(n.children||[]),created] })));
          setExpandedNodeIds(prev => new Set([...prev, addingTo]));
        }
        setNewNode({ title:"", assignees:[], status:"todo", dueDate:"", desc:"", progress:0 });
        setAddingTo(null);
      }
    } catch {}
    setSavingNode(false);
  }, [newNode, addingTo, getProjIdForNode, mutateLocalNodes]);

  // ── 노드 삭제 ────────────────────────────────────────────────
  const deleteNode = useCallback(async (nodeId) => {
    const projId = getProjIdForNode(nodeId);
    if (!projId) return;
    const r = await fetch(`${API}/api/data/projects/${projId}/nodes/${nodeId}`, { method:"DELETE" });
    if (r.ok) {
      mutateLocalNodes(projId, nodes => removeFromTree(nodes, nodeId));
      setConfirmDelete(null);
      if (selectedNodeId === nodeId) setSelectedNodeId(null);
    }
  }, [getProjIdForNode, mutateLocalNodes, selectedNodeId]);

  // ── 상세 저장 ────────────────────────────────────────────────
  const saveDetail = useCallback(async () => {
    if (!selectedNodeId) return;
    const projId = getProjIdForNode(selectedNodeId);
    if (!projId) return;
    const draft = detailDraftRef.current;
    setSavingDetail(true);
    try {
      const r = await fetch(`${API}/api/data/projects/${projId}/nodes/${selectedNodeId}`, {
        method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify(draft),
      });
      if (r.ok) {
        mutateLocalNodes(projId, nodes => updateInTree(nodes, selectedNodeId, n => ({ ...n, ...draft })));
        setEditingDetail(false);
      }
    } catch(e) { console.error('saveDetail error:', e); }
    setSavingDetail(false);
  }, [selectedNodeId, getProjIdForNode, mutateLocalNodes]);

  // ── 첨부 추가 ────────────────────────────────────────────────
  const submitAtt = useCallback(async () => {
    if (!selectedNodeId) return;
    const { type, name, url, desc, file } = newAtt;
    if (type === "image" && !file) return;
    if (type === "link" && !url.trim()) return;
    const projId = getProjIdForNode(selectedNodeId);
    if (!projId) return;

    let attData = { type, name, url, size:"", desc };

    // 이미지: /api/upload로 업로드
    if (type === "image" && file) {
      setUploadingAtt(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const uploadRes = await fetch(`${API}/api/upload`, { method:"POST", body:fd });
        if (!uploadRes.ok) { setUploadingAtt(false); return; }
        const uploaded = await uploadRes.json();
        attData = {
          type: "image",
          name: uploaded.name,
          url: `${API}${uploaded.url}`,
          size: fmtSize(uploaded.size),
          desc,
        };
      } catch { setUploadingAtt(false); return; }
      setUploadingAtt(false);
    }

    const r = await fetch(`${API}/api/data/projects/${projId}/nodes/${selectedNodeId}/attachments`, {
      method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(attData),
    });
    if (r.ok) {
      const created = await r.json();
      mutateLocalNodes(projId, nodes => updateInTree(nodes, selectedNodeId, n => ({ ...n, attachments:[...(n.attachments||[]),created] })));
      setNewAtt({ type:"link", name:"", url:"", size:"", desc:"", file:null });
      setAddingAtt(false);
    }
  }, [selectedNodeId, newAtt, getProjIdForNode, mutateLocalNodes]);

  // ── 첨부 삭제 ────────────────────────────────────────────────
  const deleteAtt = useCallback(async (attId) => {
    if (!selectedNodeId) return;
    const projId = getProjIdForNode(selectedNodeId);
    if (!projId) return;
    const r = await fetch(`${API}/api/data/projects/${projId}/nodes/${selectedNodeId}/attachments/${attId}`, { method:"DELETE" });
    if (r.ok) {
      mutateLocalNodes(projId, nodes => updateInTree(nodes, selectedNodeId, n => ({ ...n, attachments:(n.attachments||[]).filter(a=>a.id!==attId) })));
      setConfirmAttDel(null);
    }
  }, [selectedNodeId, getProjIdForNode, mutateLocalNodes]);

  // ── 코멘트 등록 ──────────────────────────────────────────────
  const submitComment = useCallback(async () => {
    if (!selectedNodeId || !newCommentText.trim()) return;
    const projId = getProjIdForNode(selectedNodeId);
    if (!projId) return;
    setSubmittingComment(true);
    try {
      localStorage.setItem("mmv_author", commentAuthor);
      const r = await fetch(`${API}/api/data/projects/${projId}/nodes/${selectedNodeId}/comments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newCommentText.trim(), author: commentAuthor.trim() || "익명" }),
      });
      if (r.ok) {
        const created = await r.json();
        mutateLocalNodes(projId, nodes => updateInTree(nodes, selectedNodeId, n => ({
          ...n, comments: [...(n.comments||[]), created],
        })));
        setNewCommentText("");
      }
    } catch(e) { console.error(e); }
    setSubmittingComment(false);
  }, [selectedNodeId, newCommentText, commentAuthor, getProjIdForNode, mutateLocalNodes]);

  // ── 코멘트 삭제 ──────────────────────────────────────────────
  const deleteComment = useCallback(async (commentId) => {
    if (!selectedNodeId) return;
    const projId = getProjIdForNode(selectedNodeId);
    if (!projId) return;
    const r = await fetch(`${API}/api/data/projects/${projId}/nodes/${selectedNodeId}/comments/${commentId}`, {
      method: "DELETE",
    });
    if (r.ok) {
      mutateLocalNodes(projId, nodes => updateInTree(nodes, selectedNodeId, n => ({
        ...n, comments: (n.comments||[]).filter(c => c.id !== commentId),
      })));
    }
  }, [selectedNodeId, getProjIdForNode, mutateLocalNodes]);

  // ── Stable callbacks ──
  const handleNodeAdd    = useCallback((nid) => setAddingTo(nid), []);
  const handleNodeSelect = useCallback((nid) => setSelectedNodeId(prev => prev === nid ? null : nid), []);
  const handleDeleteAsk  = useCallback((nid) => setConfirmDelete(nid), []);
  const handleDeleteCancel = useCallback(() => setConfirmDelete(null), []);

  // ── React Flow 노드/엣지 계산 (좌→우) ───────────────────────
  const { rfNodes, rfEdges } = useMemo(() => {
    const rfNodes = [];
    const rfEdges = [];
    let curY = 40;

    for (const proj of localData.filter(p => visibleProjIds.has(p.id))) {
      const dept = departments.find(d => d.id === proj.dept);
      const isExp = expandedProjIds.has(proj.id);
      const nodes = localNodes[proj.id] || [];
      // 진행률: 다른 뷰(간트/캘린더)와 동일하게 노드 평균(computedProjData.progress) 사용
      const pct = proj.progress || 0;
      const psc = PS_COLOR[proj.status] || "#94a3b8";

      const totalH = isExp && nodes.length
        ? nodes.reduce((s, n) => s + getSubH(n, expandedNodeIds), 0)
        : 0;
      const blockH = isExp && nodes.length
        ? Math.max(PROJ_H + 20, totalH + 40)
        : PROJ_H;

      const projCenterY = curY + blockH / 2;
      const projY = Math.max(curY + 10, projCenterY - PROJ_H / 2);

      rfNodes.push({
        id: `proj-${proj.id}`,
        type: "projectNode",
        position: { x: PROJ_X, y: projY },
        data: { proj, dept, pct, psc, isExpanded: isExp, onToggle: () => toggleProj(proj.id), onArchive: onProjDataChange },
        draggable: false, selectable: false,
      });

      if (isExp && nodes.length) {
        const taskAreaStartY = curY + (blockH - totalH) / 2;

        const layoutNode = (node, depth, startY, parentId) => {
          const subH = getSubH(node, expandedNodeIds);
          const centerY = startY + subH / 2;
          const nodeY = Math.max(0, centerY - getNodeH(node) / 2);
          const x = depthToX(depth);

          rfNodes.push({
            id: node.id, type: "taskNode",
            position: { x, y: nodeY },
            data: {
              node,
              humansList: humans,
              isExpanded: expandedNodeIds.has(node.id),
              isSelected: selectedNodeId === node.id,
              confirmingDelete: confirmDelete === node.id,
              onToggle: toggleNode,
              onAdd: handleNodeAdd,
              onSelect: handleNodeSelect,
              onDeleteAsk: handleDeleteAsk,
              onDeleteConfirm: deleteNode,
              onDeleteCancel: handleDeleteCancel,
            },
            draggable: false, selectable: false,
          });

          const sourceId = parentId || `proj-${proj.id}`;
          const sc = S_COLOR[node.status] || "#94a3b8";
          rfEdges.push({
            id: `e-${sourceId}-${node.id}`,
            source: sourceId, target: node.id,
            type: "default",
            style: { stroke: sc+"80", strokeWidth: 1.5 },
            animated: false,
          });

          if (expandedNodeIds.has(node.id) && node.children?.length) {
            let childY = startY;
            for (const child of node.children) {
              layoutNode(child, depth + 1, childY, node.id);
              childY += getSubH(child, expandedNodeIds);
            }
          }
        };

        let nodeY = taskAreaStartY;
        for (const node of nodes) {
          layoutNode(node, 0, nodeY, null);
          nodeY += getSubH(node, expandedNodeIds);
        }
      }

      curY += blockH + PROJ_GAP;
    }

    return { rfNodes, rfEdges };
  }, [localData, localNodes, expandedProjIds, expandedNodeIds, selectedNodeId, confirmDelete, visibleProjIds,
      toggleProj, toggleNode, deleteNode, handleNodeAdd, handleNodeSelect, handleDeleteAsk, handleDeleteCancel,
      departments, humans]);

  const selectedNode    = selectedNodeId ? getNodeAnywhere(selectedNodeId) : null;
  const selectedProjId  = selectedNodeId ? getProjIdForNode(selectedNodeId) : null;

  // ── 사이드바 트리 렌더 ───────────────────────────────────────
  const renderSidebarNode = (node, depth = 0) => {
    const hasChildren = node.children?.length > 0;
    const isExp = sidebarExpanded.has(node.id);
    const sc = S_COLOR[node.status] || "#94a3b8";
    const isSelected = selectedNodeId === node.id;
    return (
      <div key={node.id}>
        <div
          onClick={() => setSelectedNodeId(prev => prev === node.id ? null : node.id)}
          style={{ display:"flex", alignItems:"center", gap:3, padding:`3px 6px 3px ${8+depth*12}px`, borderRadius:5, cursor:"pointer", marginBottom:1, background:isSelected?"#ede9fe":"transparent", transition:"background .1s" }}
        >
          {hasChildren ? (
            <span onClick={e => { e.stopPropagation(); setSidebarExpanded(prev => { const n=new Set(prev); n.has(node.id)?n.delete(node.id):n.add(node.id); return n; }); }}
              style={{ fontSize:8, color:"#94a3b8", width:10, flexShrink:0, cursor:"pointer" }}>
              {isExp?"▼":"▶"}
            </span>
          ) : <span style={{ width:10, flexShrink:0 }} />}
          <div style={{ width:6, height:6, borderRadius:"50%", background:sc, flexShrink:0 }} />
          <span style={{ fontSize:10, color:isSelected?"#6366f1":"#334155", fontWeight:isSelected?700:400, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {node.title}
          </span>
        </div>
        {isExp && hasChildren && node.children.map(child => renderSidebarNode(child, depth+1))}
      </div>
    );
  };

  return (
    <div style={{ display:"flex", flex:1, overflow:"hidden", minHeight:0 }}>

      {/* ── 왼쪽 사이드바 ── */}
      <div style={{ width:220, flexShrink:0, borderRight:"1px solid #e2e8f0", background:"#fff", display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ padding:"10px 12px 8px", fontSize:10, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.05em", borderBottom:"1px solid #f1f5f9", flexShrink:0 }}>
          프로젝트
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"6px 8px" }}>
          {localData.map(proj => {
            const dept = departments.find(d => d.id === proj.dept);
            const dc = dept?.color || "#6366f1";
            const psc = PS_COLOR[proj.status] || "#94a3b8";
            // 진행률: 다른 뷰와 동일하게 노드 평균(computedProjData.progress) 사용
            const pct = proj.progress || 0;
            const isExp = sidebarExpanded.has(proj.id);
            const projNodes = localNodes[proj.id] || [];
            return (
              <div key={proj.id} style={{ marginBottom:4 }}>
                <div
                  style={{ borderRadius:8, border:`1.5px solid ${isExp?dc+"60":"#e2e8f0"}`, background:isExp?dc+"08":"#fafafa", transition:"all .15s", overflow:"hidden" }}
                  className="proj-sidebar-item"
                >
                  <div
                    onClick={() => { setSidebarExpanded(prev => { const n=new Set(prev); n.has(proj.id)?n.delete(proj.id):n.add(proj.id); return n; }); toggleProj(proj.id); }}
                    style={{ padding:"9px 10px", cursor:"pointer" }}
                  >
                    <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:5 }}>
                      <input
                        type="checkbox"
                        checked={visibleProjIds.has(proj.id)}
                        onChange={e => {
                          e.stopPropagation();
                          setVisibleProjIds(prev => {
                            const next = new Set(prev);
                            if (next.has(proj.id)) next.delete(proj.id);
                            else next.add(proj.id);
                            return next;
                          });
                        }}
                        onClick={e => e.stopPropagation()}
                        style={{ width:13, height:13, cursor:"pointer", accentColor:dc, flexShrink:0, marginRight:1 }}
                      />
                      <div style={{ width:7, height:7, borderRadius:"50%", background:dc, flexShrink:0 }} />
                      <span style={{ fontSize:11, fontWeight:700, color: visibleProjIds.has(proj.id) ? "#1e293b" : "#94a3b8", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {isExp?"▾ ":"▸ "}{proj.title}
                      </span>
                    </div>
                    <div style={{ display:"flex", gap:5, alignItems:"center" }}>
                      <span style={{ fontSize:9, color:psc, background:psc+"18", padding:"1px 5px", borderRadius:4, fontWeight:600 }}>
                        {PS_LABEL[proj.status]||proj.status}
                      </span>
                      <div style={{ flex:1, height:3, background:"#e2e8f0", borderRadius:2 }}>
                        <div style={{ width:`${pct}%`, height:3, background:dc, borderRadius:2 }} />
                      </div>
                      <span style={{ fontSize:9, color:dc, fontWeight:700 }}>{pct}%</span>
                    </div>
                  </div>
                  {/* 보관함 버튼 - 항상 표시 */}
                  <div style={{ padding:"0 10px 8px", display:"flex", justifyContent:"flex-end" }}>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        await fetch(`${API}/api/projects/${proj.id}/archive`, { method:"PATCH" });
                        window.dispatchEvent(new CustomEvent("projects-changed"));
                        onProjDataChange?.();
                      }}
                      style={{ background:"none", border:"1px solid #e2e8f0", borderRadius:5, padding:"2px 8px", fontSize:9, cursor:"pointer", color:"#64748b", display:"flex", alignItems:"center", gap:3 }}
                    >
                      📦 보관
                    </button>
                  </div>
                </div>
                {isExp && (
                  <div style={{ marginTop:2, paddingLeft:4 }}>
                    {projNodes.length===0 && (
                      <div style={{ fontSize:10, color:"#94a3b8", padding:"4px 8px" }}>
                        {loadedProjs.has(proj.id)?"노드 없음":"로딩 중..."}
                      </div>
                    )}
                    {projNodes.map(n => renderSidebarNode(n, 0))}
                    {addingTo===`root:${proj.id}` ? (
                      <div style={{ padding:"4px 6px" }}>
                        <input value={newNode.title} onChange={e=>setNewNode(p=>({...p,title:e.target.value}))} placeholder="노드 이름 *"
                          style={{ ...IS, marginBottom:3 }}
                          onKeyDown={e=>{ if(e.key==="Enter") submitNewNode(); if(e.key==="Escape") setAddingTo(null); }} autoFocus />
                        <textarea value={newNode.desc} onChange={e=>setNewNode(p=>({...p,desc:e.target.value}))} placeholder="설명 (선택)" rows={2}
                          style={{ ...IS, resize:"none", marginBottom:3 }} />
                        <div style={{ display:"flex", gap:3 }}>
                          <button onClick={submitNewNode} disabled={savingNode||!newNode.title.trim()}
                            style={{ flex:1, padding:"3px 0", borderRadius:4, border:"none", background:"#6366f1", color:"#fff", fontSize:9, fontWeight:700, cursor:"pointer" }}>
                            {savingNode?"...":"추가"}
                          </button>
                          <button onClick={()=>setAddingTo(null)}
                            style={{ padding:"3px 8px", borderRadius:4, border:"1px solid #e2e8f0", background:"#fff", color:"#64748b", fontSize:9, cursor:"pointer" }}>
                            취소
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={()=>setAddingTo(`root:${proj.id}`)}
                        style={{ width:"100%", marginTop:2, padding:"4px 0", borderRadius:5, border:"1px dashed #c4b5fd", background:"#faf5ff", color:"#7c3aed", fontSize:9, cursor:"pointer", fontWeight:600 }}>
                        + 루트 노드 추가
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── React Flow 캔버스 ── */}
      <div style={{ flex:1, position:"relative" }}>
        <ReactFlow
          nodes={rfNodes} edges={rfEdges} nodeTypes={nodeTypes}
          defaultViewport={{ x:40, y:40, zoom:0.85 }}
          minZoom={0.2} maxZoom={2}
          defaultEdgeOptions={{ type:"default" }}
          proOptions={{ hideAttribution:true }}
          style={{ background:"#f8fafc" }}
        >
          <Background color="#e2e8f0" gap={20} size={1} />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={n => n.type==="projectNode" ? n.data?.dept?.color||"#6366f1" : S_COLOR[n.data?.node?.status]||"#94a3b8"}
            style={{ background:"#fff", border:"1px solid #e2e8f0" }}
          />
        </ReactFlow>

        {/* 자식 노드 추가 폼 */}
        {addingTo && typeof addingTo==="string" && !addingTo.startsWith("root:") && (
          <div style={{ position:"absolute", top:16, right:16, zIndex:10, background:"#f0f0ff", border:"1.5px solid #c4b5fd", borderRadius:10, padding:"12px 14px", width:220, boxShadow:"0 4px 20px #6366f130" }}>
            <div style={{ fontSize:10, fontWeight:700, color:"#6366f1", marginBottom:8 }}>자식 노드 추가</div>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              <input value={newNode.title} onChange={e=>setNewNode(p=>({...p,title:e.target.value}))} placeholder="제목 *"
                style={IS} onKeyDown={e=>{ if(e.key==="Enter") submitNewNode(); if(e.key==="Escape") setAddingTo(null); }} autoFocus />
              <div style={{ border:"1px solid #e2e8f0", borderRadius:6, padding:"4px 6px", maxHeight:110, overflowY:"auto" }}>
                <div style={{ fontSize:9, color:"#94a3b8", marginBottom:3 }}>담당자 (복수 선택)</div>
                {humans.map(h => {
                  const checked = (newNode.assignees||[]).includes(h.id);
                  return (
                    <label key={h.id} style={{ display:"flex", alignItems:"center", gap:5, cursor:"pointer", marginBottom:2, padding:"2px 3px", borderRadius:4, background:checked?h.color+"15":"transparent" }}>
                      <input type="checkbox" checked={checked}
                        onChange={() => setNewNode(p => ({
                          ...p,
                          assignees: checked
                            ? (p.assignees||[]).filter(x=>x!==h.id)
                            : [...(p.assignees||[]), h.id]
                        }))}
                        style={{ accentColor:h.color, width:11, height:11 }} />
                      <span style={{ fontSize:11 }}>{h.avatar}</span>
                      <span style={{ fontSize:10, color:"#334155" }}>{h.name}</span>
                    </label>
                  );
                })}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:4 }}>
                <select value={newNode.status} onChange={e=>setNewNode(p=>({...p,status:e.target.value}))} style={IS}>
                  {Object.entries(S_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
                <input type="date" value={newNode.dueDate} onChange={e=>setNewNode(p=>({...p,dueDate:e.target.value}))} style={IS} />
              </div>
              <textarea value={newNode.desc} onChange={e=>setNewNode(p=>({...p,desc:e.target.value}))} placeholder="설명 (선택)" rows={2}
                style={{ ...IS, resize:"none" }} />
              <div style={{ display:"flex", gap:4, justifyContent:"flex-end" }}>
                <button onClick={()=>setAddingTo(null)} style={{ padding:"4px 10px", borderRadius:5, border:"1px solid #e2e8f0", background:"#fff", color:"#64748b", fontSize:10, cursor:"pointer" }}>취소</button>
                <button onClick={submitNewNode} disabled={savingNode||!newNode.title.trim()}
                  style={{ padding:"4px 12px", borderRadius:5, border:"none", background:newNode.title.trim()?"#6366f1":"#e2e8f0", color:newNode.title.trim()?"#fff":"#94a3b8", fontSize:10, fontWeight:700, cursor:"pointer" }}>
                  {savingNode?"...":"저장"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 오른쪽 상세 패널 ── */}
      {selectedNode && (
        <div style={{ width:290, flexShrink:0, borderLeft:"1px solid #e2e8f0", background:"#fff", display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* 헤더 */}
          <div style={{ display:"flex", alignItems:"center", padding:"10px 12px", borderBottom:"1px solid #e2e8f0", flexShrink:0, gap:6 }}>
            <span style={{ fontSize:11, fontWeight:700, color:"#1e293b", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {selectedNode.title}
            </span>
            {confirmDelete===selectedNodeId ? (
              <div style={{ display:"flex", gap:3, flexShrink:0 }}>
                <button onClick={()=>deleteNode(selectedNodeId)}
                  style={{ fontSize:9, padding:"2px 7px", borderRadius:4, border:"none", background:"#dc2626", color:"#fff", cursor:"pointer", fontWeight:700 }}>삭제 확인</button>
                <button onClick={()=>setConfirmDelete(null)}
                  style={{ fontSize:9, padding:"2px 7px", borderRadius:4, border:"1px solid #e2e8f0", background:"#fff", color:"#64748b", cursor:"pointer" }}>취소</button>
              </div>
            ) : (
              <button onClick={()=>setConfirmDelete(selectedNodeId)}
                style={{ width:22, height:22, borderRadius:4, border:"1px solid #fecaca", background:"#fff5f5", color:"#dc2626", fontSize:11, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0, flexShrink:0 }}>🗑</button>
            )}
            <button onClick={()=>setSelectedNodeId(null)}
              style={{ width:20, height:20, borderRadius:4, border:"1px solid #e2e8f0", background:"#f8fafc", color:"#64748b", fontSize:11, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0, flexShrink:0 }}>×</button>
          </div>

          {/* ① 편집 폼 + 첨부파일 (스크롤, 최대 높이 제한) */}
          <div style={{ overflowY:"auto", padding:"10px 12px", borderBottom:"1px solid #e2e8f0", maxHeight:"58%", flexShrink:0 }}>
            <div style={{ display:"flex", flexDirection:"column", gap:7 }}>

              {/* 읽기 전용 모드 */}
              {!editingDetail ? (
                <>
                  {(() => {
                    const assigneeIds2 = Array.isArray(selectedNode.assignees) ? selectedNode.assignees : (selectedNode.assignee ? [selectedNode.assignee] : []);
                    const assigneeHumans2 = assigneeIds2.map(id => humans.find(h => h.id === id)).filter(Boolean);
                    const sc2 = S_COLOR[selectedNode.status] || "#94a3b8";
                    return (
                      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                        <div>
                          <div style={{ fontSize:9, fontWeight:600, color:"#94a3b8", marginBottom:3 }}>제목</div>
                          <div style={{ fontSize:13, fontWeight:700, color:"#1e293b" }}>{selectedNode.title}</div>
                        </div>
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:5 }}>
                          <div>
                            <div style={{ fontSize:9, fontWeight:600, color:"#94a3b8", marginBottom:3 }}>담당자</div>
                            <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                              {assigneeHumans2.length === 0 ? (
                                <span style={{ color:"#94a3b8", fontSize:11 }}>없음</span>
                              ) : assigneeHumans2.map(h => (
                                <span key={h.id} style={{ display:"inline-flex", alignItems:"center", gap:3, background:"#f1f5f9", border:"1px solid #e2e8f0", borderRadius:20, padding:"2px 7px" }}>
                                  <span style={{ fontSize:12 }}>{h.avatar}</span>
                                  <span style={{ fontSize:10, color:"#334155", fontWeight:600 }}>{h.name}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize:9, fontWeight:600, color:"#94a3b8", marginBottom:3 }}>상태</div>
                            <span style={{ fontSize:10, color:sc2, background:sc2+"18", padding:"2px 7px", borderRadius:4, fontWeight:600 }}>
                              {S_LABEL[selectedNode.status] || selectedNode.status}
                            </span>
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize:9, fontWeight:600, color:"#94a3b8", marginBottom:3 }}>마감일</div>
                          <div style={{ fontSize:11, color:"#1e293b" }}>{selectedNode.dueDate || <span style={{ color:"#94a3b8" }}>-</span>}</div>
                        </div>
                        <div>
                          <div style={{ fontSize:9, fontWeight:600, color:"#94a3b8", marginBottom:3 }}>진행도</div>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <div style={{ flex:1, height:4, background:"#e2e8f0", borderRadius:2 }}>
                              <div style={{ width:`${selectedNode.progress||0}%`, height:4, background:"#6366f1", borderRadius:2 }} />
                            </div>
                            <span style={{ fontSize:10, color:"#6366f1", fontWeight:700 }}>{selectedNode.progress||0}%</span>
                          </div>
                        </div>
                        {selectedNode.desc && (
                          <div>
                            <div style={{ fontSize:9, fontWeight:600, color:"#94a3b8", marginBottom:3 }}>설명</div>
                            <div style={{ fontSize:11, color:"#78350f", background:"#fffbeb", border:"1px solid #fef08a", borderRadius:6, padding:"7px 9px", lineHeight:1.6 }}>
                              {selectedNode.desc}
                            </div>
                          </div>
                        )}
                        <button onClick={() => setEditingDetail(true)}
                          style={{ padding:"5px 0", borderRadius:5, border:"1px solid #6366f1", background:"#fff", color:"#6366f1", fontSize:10, fontWeight:700, cursor:"pointer" }}>
                          ✏️ 수정
                        </button>
                      </div>
                    );
                  })()}
                </>
              ) : (
                /* 편집 모드 */
                <>
                  <div>
                    <label style={{ fontSize:9, fontWeight:600, color:"#64748b", display:"block", marginBottom:2 }}>제목</label>
                    <input value={detailDraft.title||""} onChange={e=>setDetailDraft(p=>({...p,title:e.target.value}))} style={IS} />
                  </div>
                  <div>
                    <label style={{ fontSize:9, fontWeight:600, color:"#64748b", display:"block", marginBottom:4 }}>담당자 (복수 선택)</label>
                    <div style={{ display:"flex", flexDirection:"column", gap:3, maxHeight:140, overflowY:"auto", border:"1px solid #e2e8f0", borderRadius:6, padding:"4px 6px" }}>
                      {humans.map(h => {
                        const checked = (detailDraft.assignees||[]).includes(h.id);
                        return (
                          <label key={h.id} style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", padding:"3px 4px", borderRadius:5, background:checked?h.color+"15":"transparent" }}>
                            <input type="checkbox" checked={checked}
                              onChange={() => setDetailDraft(p => ({
                                ...p,
                                assignees: checked
                                  ? (p.assignees||[]).filter(x=>x!==h.id)
                                  : [...(p.assignees||[]), h.id]
                              }))}
                              style={{ accentColor:h.color, width:12, height:12 }} />
                            <span style={{ fontSize:12 }}>{h.avatar}</span>
                            <span style={{ fontSize:10, fontWeight:600, color:"#1e293b" }}>{h.name}</span>
                            <span style={{ fontSize:9, color:"#94a3b8" }}>{h.title}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize:9, fontWeight:600, color:"#64748b", display:"block", marginBottom:2 }}>상태</label>
                    <select value={detailDraft.status||"todo"} onChange={e=>setDetailDraft(p=>({...p,status:e.target.value}))} style={IS}>
                      {Object.entries(S_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:9, fontWeight:600, color:"#64748b", display:"block", marginBottom:2 }}>시작일</label>
                    <input type="date" value={detailDraft.startDate||""} onChange={e=>setDetailDraft(p=>({...p,startDate:e.target.value||null}))} style={IS} />
                  </div>
                  <div>
                    <label style={{ fontSize:9, fontWeight:600, color:"#64748b", display:"block", marginBottom:2 }}>마감일</label>
                    <input type="date" value={detailDraft.dueDate||""} onChange={e=>setDetailDraft(p=>({...p,dueDate:e.target.value}))} style={IS} />
                  </div>
                  <div>
                    <label style={{ fontSize:9, fontWeight:600, color:"#64748b", display:"block", marginBottom:2 }}>진행도 ({detailDraft.progress||0}%)</label>
                    <input type="range" min={0} max={100} value={detailDraft.progress||0}
                      onChange={e=>setDetailDraft(p=>({...p,progress:Number(e.target.value)}))}
                      style={{ width:"100%", accentColor:"#6366f1" }} />
                  </div>
                  <div>
                    <label style={{ fontSize:9, fontWeight:600, color:"#64748b", display:"block", marginBottom:2 }}>설명</label>
                    <textarea value={detailDraft.desc||""} onChange={e=>setDetailDraft(p=>({...p,desc:e.target.value}))} rows={2}
                      style={{ ...IS, resize:"none" }} />
                  </div>
                  <div style={{ display:"flex", gap:4 }}>
                    <button onClick={() => setEditingDetail(false)}
                      style={{ flex:1, padding:"5px 0", borderRadius:5, border:"1px solid #e2e8f0", background:"#fff", color:"#64748b", fontSize:10, fontWeight:700, cursor:"pointer" }}>
                      취소
                    </button>
                    <button onClick={saveDetail} disabled={savingDetail}
                      style={{ flex:2, padding:"5px 0", borderRadius:5, border:"none", background:"#6366f1", color:"#fff", fontSize:10, fontWeight:700, cursor:"pointer" }}>
                      {savingDetail ? "저장 중..." : "저장"}
                    </button>
                  </div>
                </>
              )}

              {/* 첨부파일 */}
              <div style={{ borderTop:"1px solid #f1f5f9", paddingTop:8 }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
                  <span style={{ fontSize:9, fontWeight:700, color:"#64748b" }}>📎 첨부파일</span>
                  <button onClick={()=>setAddingAtt(p=>!p)}
                    style={{ fontSize:9, padding:"2px 7px", borderRadius:4, border:"1px solid #c4b5fd", background:"#faf5ff", color:"#7c3aed", cursor:"pointer", fontWeight:600 }}>
                    {addingAtt?"닫기":"+ 추가"}
                  </button>
                </div>

                {(selectedNode.attachments||[]).map(att => {
                  const isImg = att.type==="image" || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(att.name||att.url||"");
                  const hasUrl = !!att.url;
                  const isConfirming = confirmAttDel===att.id;
                  return (
                    <div key={att.id} style={{ borderRadius:6, background:"#f8fafc", border:"1px solid #e2e8f0", marginBottom:4, overflow:"hidden" }}>
                      {isImg && hasUrl && (
                        <a href={att.url} target="_blank" rel="noreferrer">
                          <img src={att.url} alt={att.name||"이미지"} style={{ width:"100%", maxHeight:120, objectFit:"cover", display:"block" }} />
                        </a>
                      )}
                      <div style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 7px" }}>
                        <span style={{ fontSize:13, flexShrink:0 }}>{isImg ? "🖼️" : "🔗"}</span>
                        <div style={{ flex:1, overflow:"hidden" }}>
                          {hasUrl ? (
                            <a href={att.url} target="_blank" rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              style={{ fontSize:10, color:"#6366f1", textDecoration:"none", display:"block", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              {att.desc || att.name || att.url}
                            </a>
                          ) : (
                            <span style={{ fontSize:10, color:"#334155", display:"block", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{att.name||att.desc}</span>
                          )}
                          {att.size && <span style={{ fontSize:9, color:"#94a3b8" }}>{att.size}</span>}
                        </div>
                        {isConfirming ? (
                          <div style={{ display:"flex", gap:2 }}>
                            <button onClick={()=>deleteAtt(att.id)} style={{ fontSize:8, padding:"1px 4px", borderRadius:3, border:"none", background:"#dc2626", color:"#fff", cursor:"pointer" }}>삭제</button>
                            <button onClick={()=>setConfirmAttDel(null)} style={{ fontSize:8, padding:"1px 4px", borderRadius:3, border:"1px solid #e2e8f0", background:"#fff", color:"#64748b", cursor:"pointer" }}>취소</button>
                          </div>
                        ) : (
                          <button onClick={()=>setConfirmAttDel(att.id)} style={{ width:14, height:14, borderRadius:2, border:"1px solid #fecaca", background:"#fff5f5", color:"#dc2626", fontSize:9, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0, flexShrink:0 }}>×</button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {addingAtt && (
                  <div style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, padding:"9px" }}>
                    <div style={{ display:"flex", gap:3, marginBottom:7 }}>
                      {[["image","🖼️이미지"],["link","🔗링크"]].map(([t,l])=>(
                        <button key={t} onClick={()=>setNewAtt(p=>({...p,type:t,name:"",url:"",size:"",file:null}))}
                          style={{ flex:1, padding:"3px 0", borderRadius:5, border:`1px solid ${newAtt.type===t?"#6366f1":"#e2e8f0"}`, background:newAtt.type===t?"#ede9fe":"#fff", color:newAtt.type===t?"#6366f1":"#64748b", fontSize:9, fontWeight:600, cursor:"pointer" }}>
                          {l}
                        </button>
                      ))}
                    </div>
                    {newAtt.type==="image" && (
                      <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                        <input type="file" accept="image/*"
                          onChange={e => {
                            const f = e.target.files?.[0]||null;
                            setNewAtt(p => ({ ...p, file:f, name:f?.name||"", type:"image" }));
                          }}
                          style={{ ...IS, padding:"3px 6px" }} />
                        {newAtt.file && (
                          <img src={URL.createObjectURL(newAtt.file)} alt="미리보기"
                            style={{ width:"100%", maxHeight:100, objectFit:"cover", borderRadius:4, border:"1px solid #e2e8f0" }} />
                        )}
                        <input value={newAtt.desc} onChange={e=>setNewAtt(p=>({...p,desc:e.target.value}))} placeholder="설명 (선택)" style={IS} />
                      </div>
                    )}
                    {newAtt.type==="link" && (
                      <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                        <input value={newAtt.url} onChange={e=>setNewAtt(p=>({...p,url:e.target.value}))} placeholder="URL *" style={IS} />
                        <input value={newAtt.desc} onChange={e=>setNewAtt(p=>({...p,desc:e.target.value}))} placeholder="설명 텍스트 (선택)" style={IS} />
                      </div>
                    )}
                    <button onClick={submitAtt} disabled={uploadingAtt || (newAtt.type==="image"&&!newAtt.file) || (newAtt.type==="link"&&!newAtt.url.trim())}
                      style={{ width:"100%", marginTop:6, padding:"4px 0", borderRadius:5, border:"none", background:"#6366f1", color:"#fff", fontSize:10, fontWeight:700, cursor:"pointer" }}>
                      {uploadingAtt ? "업로드 중..." : "첨부 추가"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ② 코멘트 스레드 (나머지 공간 전부 차지) */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0 }}>
            {/* 코멘트 헤더 */}
            <div style={{ padding:"7px 12px", borderBottom:"1px solid #f1f5f9", flexShrink:0, display:"flex", alignItems:"center", gap:5 }}>
              <span style={{ fontSize:10, fontWeight:700, color:"#64748b" }}>💬 코멘트</span>
              {(selectedNode.comments||[]).length > 0 && (
                <span style={{ fontSize:9, background:"#ede9fe", color:"#6366f1", padding:"1px 6px", borderRadius:8, fontWeight:600 }}>
                  {selectedNode.comments.length}
                </span>
              )}
            </div>

            {/* 메시지 목록 (스크롤) */}
            <div style={{ flex:1, overflowY:"auto", padding:"8px 10px", display:"flex", flexDirection:"column", gap:8 }}>
              {(selectedNode.comments||[]).length === 0 && (
                <div style={{ textAlign:"center", color:"#94a3b8", fontSize:10, padding:"24px 0" }}>
                  첫 코멘트를 남겨보세요
                </div>
              )}
              {(selectedNode.comments||[]).map(c => {
                const dt = new Date(c.createdAt);
                const timeStr = `${dt.getMonth()+1}/${dt.getDate()} ${String(dt.getHours()).padStart(2,"0")}:${String(dt.getMinutes()).padStart(2,"0")}`;
                const commentHuman = humans.find(h => h.name === c.author);
                const initial = c.author?.[0]?.toUpperCase() || "?";
                return (
                  <div key={c.id} style={{ display:"flex", gap:7, alignItems:"flex-start" }}>
                    <div style={{ width:26, height:26, borderRadius:"50%", background: commentHuman ? commentHuman.color+"30" : "#6366f1", border: commentHuman ? `1.5px solid ${commentHuman.color}` : "none", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      {commentHuman
                        ? <span style={{ fontSize:14 }}>{commentHuman.avatar}</span>
                        : <span style={{ fontSize:10, color:"#fff", fontWeight:700 }}>{initial}</span>
                      }
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"baseline", gap:5, marginBottom:3 }}>
                        <span style={{ fontSize:10, fontWeight:700, color:"#1e293b" }}>{c.author}</span>
                        <span style={{ fontSize:9, color:"#94a3b8" }}>{timeStr}</span>
                      </div>
                      <div style={{ fontSize:10, color:"#334155", lineHeight:1.55, background:"#f1f5f9", padding:"6px 9px", borderRadius:"0 8px 8px 8px", whiteSpace:"pre-wrap", wordBreak:"break-word" }}>
                        {c.text}
                      </div>
                    </div>
                    {confirmCommentDel === c.id ? (
                      <div style={{ display:"flex", flexDirection:"row", gap:4, flexShrink:0 }}>
                        <button onClick={() => { deleteComment(c.id); setConfirmCommentDel(null); }}
                          style={{ fontSize:10, padding:"3px 8px", borderRadius:4, border:"none", background:"#dc2626", color:"#fff", cursor:"pointer", fontWeight:600, whiteSpace:"nowrap" }}>삭제</button>
                        <button onClick={() => setConfirmCommentDel(null)}
                          style={{ fontSize:10, padding:"3px 8px", borderRadius:4, border:"1px solid #e2e8f0", background:"#fff", color:"#64748b", cursor:"pointer", whiteSpace:"nowrap" }}>취소</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmCommentDel(c.id)}
                        style={{ width:18, height:18, marginTop:2, borderRadius:3, border:"1px solid #e2e8f0", background:"#f8fafc", color:"#94a3b8", fontSize:12, cursor:"pointer", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}
                        title="삭제">×</button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 입력 영역 (고정) */}
            <div style={{ flexShrink:0, padding:"8px 10px", borderTop:"1px solid #e2e8f0", background:"#fff" }}>
              <select
                value={commentAuthor}
                onChange={e => {
                  setCommentAuthor(e.target.value);
                  localStorage.setItem("mmv_author", e.target.value);
                }}
                style={{ ...IS, fontSize:10, marginBottom:5 }}
              >
                <option value="">작성자 선택 (익명)</option>
                {humans.map(h => (
                  <option key={h.id} value={h.name}>{h.avatar} {h.name}</option>
                ))}
              </select>
              <div style={{ display:"flex", gap:5, alignItems:"flex-end" }}>
                <textarea
                  value={newCommentText}
                  onChange={e => setNewCommentText(e.target.value)}
                  placeholder="코멘트 입력..."
                  rows={2}
                  style={{ ...IS, flex:1, resize:"none", fontSize:10 }}
                  onKeyDown={e => { if (e.key==="Enter" && e.ctrlKey) submitComment(); }}
                />
                <button onClick={submitComment} disabled={submittingComment || !newCommentText.trim()}
                  style={{
                    width:34, height:34, borderRadius:8, border:"none", flexShrink:0,
                    background: newCommentText.trim() ? "#6366f1" : "#e2e8f0",
                    color: newCommentText.trim() ? "#fff" : "#94a3b8",
                    fontSize:16, cursor:"pointer",
                    display:"flex", alignItems:"center", justifyContent:"center",
                  }}>
                  {submittingComment ? "…" : "↑"}
                </button>
              </div>
              <div style={{ fontSize:8, color:"#94a3b8", marginTop:3 }}>Ctrl+Enter로 등록</div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
