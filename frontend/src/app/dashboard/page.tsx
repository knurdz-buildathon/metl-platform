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
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={`flex flex-col border-r border-border bg-card transition-all ${
          sidebarOpen ? 'w-64' : 'w-16'
        }`}
      >
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center">
            <Boxes className="w-5 h-5 text-background" />
          </div>
          {sidebarOpen && <span className="text-lg font-bold tracking-tight">Metl</span>}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="ml-auto p-1 hover:bg-accent text-muted-foreground hover:text-foreground rounded transition-colors"
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
                    ? 'bg-accent text-foreground font-medium'
                    : 'hover:bg-accent/50 text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {sidebarOpen && <span className="text-sm">{tab.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          {sidebarOpen && (
            <div className="text-xs text-muted-foreground">
              <p>Open Agentic Cloud Fabric</p>
              <p>v1.0.0</p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-muted/20 relative">
        {/* Simple dashboard header for top-right actions like theme toggle could go here, but omitted to match current layout structure exactly */}
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
