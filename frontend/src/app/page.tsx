'use client';

import { useState } from 'react';
import { GlassBox } from '@/components/glass-box/GlassBox';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { ProviderMatrix } from '@/components/provider-matrix/ProviderMatrix';
import { DeploymentsList } from '@/components/deployments/DeploymentsList';
import { IncidentsPanel } from '@/components/incidents/IncidentsPanel';
import { EjectionPanel } from '@/components/ejection/EjectionPanel';
import { Boxes, MessageSquare, Settings, Rocket, AlertTriangle, Download, Menu, X } from 'lucide-react';

type Tab = 'glassbox' | 'chat' | 'deployments' | 'incidents' | 'providers' | 'eject';

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'glassbox', label: 'Glass Box', icon: Boxes },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'deployments', label: 'Deployments', icon: Rocket },
  { id: 'incidents', label: 'Incidents', icon: AlertTriangle },
  { id: 'providers', label: 'Provider Matrix', icon: Settings },
  { id: 'eject', label: 'Ejection', icon: Download },
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('glassbox');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <aside
        className={`flex flex-col border-r border-slate-800 bg-slate-900 transition-all ${
          sidebarOpen ? 'w-64' : 'w-16'
        }`}
      >
        <div className="flex items-center gap-3 p-4 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Boxes className="w-5 h-5 text-white" />
          </div>
          {sidebarOpen && <span className="text-lg font-bold">Metl</span>}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="ml-auto p-1 hover:bg-slate-800 rounded"
          >
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600/20 text-blue-400'
                    : 'hover:bg-slate-800 text-slate-400'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {sidebarOpen && <span className="text-sm font-medium">{tab.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          {sidebarOpen && (
            <div className="text-xs text-slate-500">
              <p>Open Agentic Cloud Fabric</p>
              <p>v1.0.0</p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {activeTab === 'glassbox' && <GlassBox />}
        {activeTab === 'chat' && <ChatPanel />}
        {activeTab === 'deployments' && <DeploymentsList />}
        {activeTab === 'incidents' && <IncidentsPanel />}
        {activeTab === 'providers' && <ProviderMatrix />}
        {activeTab === 'eject' && <EjectionPanel />}
      </main>
    </div>
  );
}
