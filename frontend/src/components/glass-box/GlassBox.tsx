'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  Panel,
  NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';

// ---------- Types ----------
interface VisualTwinEvent {
  eventType: string;
  tenantId?: string;
  phase?: string;
  timestamp: string;
  deploymentId?: string;
  slug?: string;
  resourceType?: string;
  nodeId?: string;
  error?: string;
}

interface TopologyData {
  nodes: Array<{
    id: string;
    type: string;
    label: string;
    status: string;
    metadata?: Record<string, unknown>;
  }>;
  edges: Array<{ id: string; source: string; target: string; label?: string }>;
}

// ---------- Custom Node Components ----------
function ControlPlaneNode({ data }: NodeProps) {
  return (
    <div className="px-4 py-2 rounded-lg border-2 border-blue-500 bg-blue-900/80 text-white text-xs font-semibold shadow-lg shadow-blue-900/30">
      {data.label}
      {data.status === 'active' && <div className="mt-1 h-1 bg-blue-400 rounded-full animate-pulse" />}
    </div>
  );
}

function ResourceNode({ data }: NodeProps) {
  const isError = data.status === 'error' || data.eventType === 'INJECT_SECURE_VAULT';
  return (
    <div
      className={`px-3 py-2 rounded-lg border text-white text-xs transition-all duration-500 ${
        data.flash === 'red'
          ? 'border-red-500 bg-red-900 shadow-red-500/50 shadow-lg'
          : data.flash === 'blue'
          ? 'border-blue-400 bg-blue-800 shadow-blue-400/40 shadow-lg'
          : 'border-emerald-500 bg-emerald-900/80'
      } ${data.alpha === 'low' ? 'opacity-30 grayscale' : ''}`}
    >
      {data.label}
      {data.metadata?.type && (
        <span className="block text-[10px] text-emerald-300 mt-0.5">{String(data.metadata.type)}</span>
      )}
    </div>
  );
}

function K8sCoreNode({ data }: NodeProps) {
  return (
    <div className="px-3 py-2 rounded-lg border border-purple-500 bg-purple-900/80 text-white text-xs font-medium">
      {data.label}
      {data.pods && <span className="block text-[10px] text-purple-300 mt-0.5">{data.pods} pod{data.pods !== 1 ? 's' : ''}</span>}
    </div>
  );
}

function TargetRunnerNode({ data }: NodeProps) {
  return (
    <div
      className={`px-3 py-2 rounded-lg border text-white text-xs transition-all duration-500 ${
        data.status === 'scaled_zero'
          ? 'border-slate-600 bg-slate-800/40 opacity-40 grayscale'
          : data.status === 'running'
          ? 'border-cyan-400 bg-cyan-900/80'
          : 'border-amber-500 bg-amber-900/80'
      }`}
      style={data.flash ? { animation: 'flashWhite 0.6s ease-in-out' } : undefined}
    >
      {data.label}
      {data.slug && <span className="block text-[10px] text-slate-300 mt-0.5">{data.slug}</span>}
    </div>
  );
}

const nodeTypes = {
  controlPlane: ControlPlaneNode,
  resource: ResourceNode,
  k8sCore: K8sCoreNode,
  targetRunner: TargetRunnerNode,
};

// ---------- Animated Edge Styles ----------
const PULSE_EDGE_STYLE: React.CSSProperties = {
  strokeWidth: 2,
  transition: 'stroke 0.3s ease',
};

// ---------- GlassBox Component ----------
export function GlassBox() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'open' | 'closed'>('connecting');
  const [recentEvent, setRecentEvent] = useState<string>('');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);
  const tenantId = 'default-tenant';

  const loadPositions = useCallback((): Record<string, { x: number; y: number }> => {
    try {
      const raw = localStorage.getItem('glassbox-positions');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, []);

  const savePositions = useCallback(
    (currentNodes: Node[]) => {
      const map: Record<string, { x: number; y: number }> = {};
      for (const n of currentNodes) if (n.position) map[n.id] = { x: n.position.x, y: n.position.y };
      localStorage.setItem('glassbox-positions', JSON.stringify(map));
    },
    []
  );

  const buildStaticNodes = useCallback(
    (saved: Record<string, { x: number; y: number }>): Node[] => {
      const base: Node[] = [
        { id: 'cp', type: 'controlPlane', position: saved['cp'] || { x: 400, y: 20 }, data: { label: 'Control Plane', status: 'active' } },
        { id: 'ra', type: 'resource', position: saved['ra'] || { x: 120, y: 140 }, data: { label: 'Resource Allocator', metadata: { type: 'DB + Storage' } } },
        { id: 'oa', type: 'resource', position: saved['oa'] || { x: 400, y: 140 }, data: { label: 'Orchestration Agent', metadata: { type: 'K8s Operator' } } },
        { id: 'dea', type: 'resource', position: saved['dea'] || { x: 680, y: 140 }, data: { label: 'Deployment Engine', metadata: { type: 'Build + Deploy' } } },
        { id: 'k3s', type: 'k8sCore', position: saved['k3s'] || { x: 400, y: 280 }, data: { label: 'K3s Control Core', pods: 0 } },
        { id: 'pod1', type: 'targetRunner', position: saved['pod1'] || { x: 200, y: 420 }, data: { label: 'Target Runner 1', status: 'running' } },
        { id: 'pod2', type: 'targetRunner', position: saved['pod2'] || { x: 480, y: 420 }, data: { label: 'Target Runner 2', status: 'running' } },
      ];
      return base;
    },
    []
  );

  const buildEdges = useCallback((): Edge[] => {
    const base: Edge[] = [
      { id: 'e-cp-ra', source: 'cp', target: 'ra', label: 'provision', style: PULSE_EDGE_STYLE, animated: true, type: 'smoothstep' },
      { id: 'e-cp-oa', source: 'cp', target: 'oa', label: 'orchestrate', style: PULSE_EDGE_STYLE, animated: true, type: 'smoothstep' },
      { id: 'e-cp-dea', source: 'cp', target: 'dea', label: 'deploy', style: PULSE_EDGE_STYLE, animated: true, type: 'smoothstep' },
      { id: 'e-oa-k3s', source: 'oa', target: 'k3s', label: 'apply manifest', style: PULSE_EDGE_STYLE, animated: true, type: 'smoothstep' },
      { id: 'e-dea-k3s', source: 'dea', target: 'k3s', label: 'push image', style: PULSE_EDGE_STYLE, animated: true, type: 'smoothstep' },
      { id: 'e-k3s-pod1', source: 'k3s', target: 'pod1', label: 'schedule', style: PULSE_EDGE_STYLE, animated: true, type: 'smoothstep' },
      { id: 'e-k3s-pod2', source: 'k3s', target: 'pod2', label: 'schedule', style: PULSE_EDGE_STYLE, animated: true, type: 'smoothstep' },
    ];
    return base;
  }, []);

  // WebSocket connection with fallback polling
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${typeof window !== 'undefined' ? window.location.host : ''}/ws/visual-twin`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      setWsStatus('connecting');

      ws.onopen = () => {
        setWsStatus('open');
        ws.send(JSON.stringify({ type: 'subscribe', tenantId }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'event') {
            handleVisualTwinEvent(msg.data);
            setRecentEvent(`${msg.data.eventType} — ${new Date(msg.data.timestamp || Date.now()).toLocaleTimeString()}`);
          }
        } catch {
          // ignore malformed
        }
      };

      ws.onclose = () => {
        setWsStatus('closed');
        wsRef.current = null;
        // Auto-reconnect after 3s
        if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
        reconnectTimer.current = window.setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      setWsStatus('closed');
    }
  }, [tenantId]);

  // Handle incoming visual twin events with state-machine mapping
  const handleVisualTwinEvent = useCallback(
    (evt: VisualTwinEvent) => {
      setNodes((prev) => {
        const next = prev.map((n) => ({ ...n, data: { ...n.data } }));

        switch (evt.eventType) {
          case 'PROVISION_DB_STACK': {
            const ra = next.find((n) => n.id === 'ra');
            if (ra) {
              ra.data.flash = 'blue';
              ra.data.pulse = true;
            }
            // Pulse edges from CP -> RA
            setEdges((prevE) =>
              prevE.map((e) => (e.source === 'cp' && e.target === 'ra' ? { ...e, animated: true, style: { ...PULSE_EDGE_STYLE, stroke: '#3b82f6' } } : e))
            );
            // Clear flash after 1.5s
            setTimeout(() => setNodes((p) => p.map((n) => (n.id === 'ra' ? { ...n, data: { ...n.data, flash: undefined } } : n))), 1500);
            break;
          }
          case 'INJECT_SECURE_VAULT': {
            const oa = next.find((n) => n.id === 'oa');
            if (oa) {
              oa.data.flash = 'red';
              oa.data.pulse = true;
            }
            setEdges((prevE) =>
              prevE.map((e) => (e.source === 'oa' && e.target === 'k3s' ? { ...e, animated: true, style: { ...PULSE_EDGE_STYLE, stroke: '#ef4444' } } : e))
            );
            setTimeout(() => setNodes((p) => p.map((n) => (n.id === 'oa' ? { ...n, data: { ...n.data, flash: undefined } } : n))), 1500);
            break;
          }
          case 'RECONCILE_POD_STATE': {
            // Find a pod to apply white pulse on, or create ghost
            const targetPod = next.find((n) => n.id.startsWith('pod') && n.type === 'targetRunner');
            if (targetPod) {
              targetPod.data.flash = true;
            }
            // Add a temporary "ghost" node to simulate pod respawn
            const ghostId = `ghost-${Date.now()}`;
            next.push({
              id: ghostId,
              type: 'targetRunner',
              position: { x: 340 + Math.random() * 100, y: 420 },
              data: { label: `New Pod`, status: 'pending', ghost: true },
            });
            setEdges((prevE) => [
              ...prevE,
              { id: `e-ghost-${Date.now()}`, source: 'k3s', target: ghostId, animated: true, style: { stroke: '#ffffff', strokeWidth: 2 }, type: 'smoothstep' },
            ]);
            setTimeout(() => {
              setNodes((p) => p.filter((n) => n.id !== ghostId));
              setEdges((p) => p.filter((e) => e.target !== ghostId));
            }, 2500);
            break;
          }
          case 'SUSPEND_POD_ALLOCATION': {
            const pod = next.find((n) => n.data.slug === evt.slug && n.type === 'targetRunner');
            if (pod) {
              pod.data.alpha = 'low';
              pod.data.status = 'scaled_zero';
            }
            break;
          }
          case 'COLD_TIER_ACTIVATE': {
            // Add a visual "cold node" to represent the new VM tier
            const coldNodeId = `cold-${Date.now()}`;
            next.push({
              id: coldNodeId,
              type: 'targetRunner',
              position: { x: 700, y: 420 },
              data: { label: 'Cold Tier VM', status: 'cold', slug: evt.slug },
            });
            setEdges((prevE) => [
              ...prevE,
              { id: `e-${coldNodeId}`, source: 'k3s', target: coldNodeId, animated: true, style: { stroke: '#a855f7', strokeWidth: 2 }, type: 'smoothstep' },
            ]);
            break;
          }
        }
        return next;
      });
    },
    [setNodes, setEdges]
  );

  // Fallback polling via REST when WS is down
  const fetchTopology = useCallback(async () => {
    try {
      const res = await fetch(`/api/topology/${tenantId}`);
      const data = await res.json();

      const saved = loadPositions();
      const flowNodes: Node[] = buildStaticNodes(saved);
      const flowEdges: Edge[] = buildEdges();

      // Append dynamic topology nodes
      let offset = flowNodes.length;
      for (const pod of data.nodes || []) {
        const podId = `pod-${pod.id}`;
        const existing = flowNodes.find((n) => n.id === podId);
        if (!existing) {
          flowNodes.push({
            id: podId,
            type: 'targetRunner',
            position: saved[podId] || { x: (offset % 3) * 250 + 100, y: 520 + Math.floor(offset / 3) * 120 },
            data: {
              label: pod.label,
              status: pod.status,
              metadata: pod.metadata,
              alpha: pod.status === 'scaled_zero' ? 'low' : undefined,
            },
          });
          flowEdges.push({
            id: `e-k3s-${podId}`,
            source: 'k3s',
            target: podId,
            animated: true,
            style: PULSE_EDGE_STYLE,
            type: 'smoothstep',
          });
          offset++;
        }
      }

      setNodes(flowNodes);
      setEdges(flowEdges);
    } catch (err) {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, [tenantId, buildStaticNodes, buildEdges, loadPositions, setNodes, setEdges]);

  useEffect(() => {
    fetchTopology();
    connectWebSocket();

    // Fallback poll if WS closed
    const pollInterval = setInterval(() => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        fetchTopology();
      }
    }, 5000);

    return () => {
      clearInterval(pollInterval);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [fetchTopology, connectWebSocket]);

  useEffect(() => {
    // Save positions whenever nodes move
    savePositions(nodes);
  }, [nodes, savePositions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="h-full relative">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Glass Box Architecture</h2>
          <p className="text-sm text-slate-400">Real-time view of your deployed infrastructure</p>
        </div>
        <div className="flex items-center gap-3">
          {recentEvent && (
            <span className="text-xs text-slate-400 bg-slate-900 px-2 py-1 rounded">Last event: {recentEvent}</span>
          )}
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${wsStatus === 'open' ? 'bg-green-500' : wsStatus === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-xs text-slate-400 uppercase tracking-wider">
              {wsStatus === 'open' ? 'Live' : wsStatus === 'connecting' ? 'Connecting' : 'Polling'}
            </span>
          </div>
        </div>
      </div>
      <div className="h-[calc(100%-80px)]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background color="#334155" gap={16} />
          <Controls />
          <MiniMap
            nodeColor={(n) => {
              if (n.type === 'controlPlane') return '#3b82f6';
              if (n.type === 'k8sCore') return '#a855f7';
              if (n.type === 'resource') return '#10b981';
              return '#06b6d4';
            }}
            maskColor="rgba(15, 23, 42, 0.7)"
          />
          <Panel position="bottom-left" className="text-[10px] text-slate-500 bg-slate-900/80 px-2 py-1 rounded">
            Monitoring: /api/visual-twin/state/{tenantId}
          </Panel>
        </ReactFlow>
      </div>

      <style>{`
        @keyframes flashWhite {
          0% { box-shadow: 0 0 0 0 rgba(255,255,255,0.7); }
          70% { box-shadow: 0 0 0 10px rgba(255,255,255,0); }
          100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); }
        }
      `}</style>
    </div>
  );
}
