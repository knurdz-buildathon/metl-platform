'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import {
  BookOpen,
  Layers,
  Boxes,
  Zap,
  Download,
  Thermometer,
  ShieldCheck,
  Cpu,
  HelpCircle,
  Smartphone,
  ChevronRight,
  Code,
  Server,
  MessageSquare,
  Activity,
  Rocket,
  Leaf,
} from 'lucide-react';

interface DocSection {
  id: string;
  title: string;
  icon: React.ElementType;
}

const sections: DocSection[] = [
  { id: 'introduction', title: 'Introduction', icon: BookOpen },
  { id: 'architecture', title: 'System Architecture', icon: Layers },
  { id: 'glass-box', title: 'Glass Box Architecture', icon: Boxes },
  { id: 'pluggable-matrix', title: 'Pluggable Provider Matrix', icon: Zap },
  { id: 'ejection-engine', title: 'Ejection Engine', icon: Download },
  { id: 'elastic-tiers', title: 'Hyper-Elastic Tiers', icon: Thermometer },
  { id: 'identity-broker', title: 'Identity Broker Proxy', icon: ShieldCheck },
  { id: 'agentic-ops', title: 'Agentic Operations', icon: Cpu },
  { id: 'faq', title: 'FAQ', icon: HelpCircle },
];

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-sm">{children}</code>
  );
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('introduction');
  const mainRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    const options = {
      root: null,
      rootMargin: '-120px 0px -60% 0px',
      threshold: 0,
    };

    observerRef.current = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
          break;
        }
      }
    }, options);

    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) observerRef.current.observe(el);
    }

    return () => observerRef.current?.disconnect();
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <div className="flex-1 flex flex-col md:flex-row container mx-auto max-w-6xl px-4 py-8 gap-8">
        {/* Mobile nav */}
        <div className="md:hidden">
          <select
            value={activeSection}
            onChange={(e) => scrollTo(e.target.value)}
            className="w-full px-3 py-2.5 border rounded-lg bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>

        {/* Sidebar */}
        <aside className="hidden md:block w-72 shrink-0 sticky top-24 h-fit pr-4">
          <nav className="space-y-1">
            {sections.map((s) => {
              const isActive = activeSection === s.id;
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  onClick={() => scrollTo(s.id)}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
                    isActive
                      ? 'bg-accent text-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {s.title}
                </button>
              );
            })}
          </nav>

          <div className="mt-8 p-4 rounded-xl border bg-muted/30">
            <div className="flex items-center gap-2 mb-2">
              <Smartphone className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Coming Soon</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              A native mobile companion app for metl.run is in development. Manage deployments, view the Glass Box twin, and receive SRE alerts from anywhere.
            </p>
          </div>
        </aside>

        {/* Main content */}
        <main ref={mainRef} className="flex-1 max-w-3xl space-y-20 pb-20">

          {/* ===================== SECTION 1: INTRODUCTION ===================== */}
          <section id="introduction" className="scroll-mt-28">
            <h2 className="text-3xl font-bold tracking-tight mb-4 scroll-mt-28">Introduction</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Metl is an <strong className="text-foreground">Open Agentic Cloud Fabric</strong>. It treats every infrastructure layer — compute runtimes, object stores, database clusters, mail routes, telemetry, and authentication — as an abstract, pluggable primitive that you fully control.
            </p>

            <div className="grid sm:grid-cols-2 gap-6 my-8">
              <div className="bg-background border rounded-xl p-6 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center mb-4">
                  <Zap className="w-5 h-5" />
                </div>
                <h4 className="font-semibold mb-2">Zero Vendor Lock-In</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  No serverless cages. Toggle between local open-source containers and your own cloud credentials at any time without rewriting application code.
                </p>
              </div>
              <div className="bg-background border rounded-xl p-6 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 text-green-500 flex items-center justify-center mb-4">
                  <Boxes className="w-5 h-5" />
                </div>
                <h4 className="font-semibold mb-2">Glass Box Transparency</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Visualize your entire architecture, service dependencies, and live traffic as a real-time React Flow topology map.
                </p>
              </div>
              <div className="bg-background border rounded-xl p-6 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4">
                  <Download className="w-5 h-5" />
                </div>
                <h4 className="font-semibold mb-2">One-Click Ejection</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Export clean source code, raw SQL DDL migrations, and a standalone docker-compose.yml to run anywhere.
                </p>
              </div>
              <div className="bg-background border rounded-xl p-6 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center mb-4">
                  <Cpu className="w-5 h-5" />
                </div>
                <h4 className="font-semibold mb-2">Agent-Native Runtime</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  A swarm of autonomous agents handles deployments, security, monitoring, and self-healing without manual intervention.
                </p>
              </div>
            </div>

            <p className="text-muted-foreground leading-relaxed mb-4">
              Traditional AI application builders (e.g. Lovable, Bolt.new, v0) wrap generated code inside proprietary serverless cages with hidden backend configurations. If you need to scale, migrate to another provider, or ensure enterprise compliance, you hit an invisible wall. Metl removes that wall entirely.
            </p>
          </section>

          {/* ===================== SECTION 2: SYSTEM ARCHITECTURE ===================== */}
          <section id="architecture" className="scroll-mt-28">
            <h2 className="text-3xl font-bold tracking-tight mb-4 scroll-mt-28">System Architecture</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Metl's runtime is built on a three-layer orchestration pipeline. Every user prompt or deployment request flows through a Task Engine, an Agent Dispatch layer, and finally a Target Platform Scheduler that provisions either local K3s namespaces or external cloud endpoints.
            </p>

            <h3 className="text-xl font-semibold tracking-tight mt-8 mb-3">Layer 1 — Task Engine & Agent Dispatch</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              The <strong className="text-foreground">Main Control Plane</strong> (FastAPI Gateway / Task Graph Engine) parses natural language requests and dispatches them to three specialized agents:
            </p>
            <ul className="space-y-3 mb-6 list-none">
              <li className="flex items-start gap-3">
                <Code className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-foreground">Coding Agent (Vibe Coder)</span>
                  <p className="text-sm text-muted-foreground">Writes software using abstraction wrappers (e.g. <InlineCode>@metl/storage</InlineCode>) so code never hardcodes vendor SDKs.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-foreground">Security & Optimization Hunter</span>
                  <p className="text-sm text-muted-foreground">Scans the codebase, sets up restricted secret vaults, validates API endpoints, and flags token leakage risks before packaging pipelines start.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Server className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-foreground">Resource Allocator</span>
                  <p className="text-sm text-muted-foreground">Translates feature requests into explicit configuration structures and forwards them to the abstraction manager.</p>
                </div>
              </li>
            </ul>

            <h3 className="text-xl font-semibold tracking-tight mt-8 mb-3">Layer 2 — Dynamic Injection & Resource Matrix</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              The <strong className="text-foreground">Architecture Orchestration Agent</strong> intercepts resource directives, evaluates provider states (Local vs. BYOK), translates requirements into declarative Kubernetes manifests, and mounts environmental runtime variables as ConfigMaps and Secrets.
            </p>

            <h3 className="text-xl font-semibold tracking-tight mt-8 mb-3">Layer 3 — Target Platform Scheduling</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              The orchestrator dispatches to one of two target paths:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-6">
              <li><strong className="text-foreground">Metal Infrastructure Grid</strong> — High-density local K3s pods: Supabase Stack, MinIO, Listmonk, Keycloak, SigNoz.</li>
              <li><strong className="text-foreground">External Cloud Plugins</strong> — BYOK integrations for AWS S3, Azure Blobs, Resend, Vercel, Clerk, Sentry, and more.</li>
            </ul>
          </section>

          {/* ===================== SECTION 3: GLASS BOX ===================== */}
          <section id="glass-box" className="scroll-mt-28">
            <h2 className="text-3xl font-bold tracking-tight mb-4 scroll-mt-28">Glass Box Architecture</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Every design tree, routing label, infrastructure boundary, and microservice layer maps to a <strong className="text-foreground">Glass Box model</strong>. Metl provides full system visibility through a real-time React Flow visualization that renders system processes dynamically as they happen.
            </p>

            <div className="my-6 p-6 bg-muted/30 border rounded-xl">
              <h4 className="font-semibold mb-4">Visual Twin Event Map</h4>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                  <code className="font-mono text-muted-foreground">PROVISION_DB_STACK</code>
                  <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Control node pulses blue lines to the data block; loader spinner renders on success.</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                  <code className="font-mono text-muted-foreground">INJECT_SECURE_VAULT</code>
                  <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Target node flashes red alert indicator upon secret discovery or validation error.</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-white border shrink-0" />
                  <code className="font-mono text-muted-foreground">RECONCILE_POD_STATE</code>
                  <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Routing trail pulses white; a fresh container pod box emerges on an alternative host.</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  <code className="font-mono text-muted-foreground">SUSPEND_POD_ALLOCATION</code>
                  <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Runner alpha drops to 30%, shifting to a desaturated "Standby" color state.</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                  <code className="font-mono text-muted-foreground">COLD_TIER_ACTIVATE</code>
                  <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">A new dedicated VM node appears in purple, auto-joining the cluster runtime.</span>
                </div>
              </div>
            </div>

            <p className="text-muted-foreground leading-relaxed mb-4">
              Because the platform relies on standardized files — OCI containers, declarative Helm definitions, and decoupled environment scripts — rather than proprietary runtimes, lock-in is mechanically non-existent. The Glass Box is not just a dashboard; it is proof of the platform's architectural transparency.
            </p>
          </section>

          {/* ===================== SECTION 4: PLUGGABLE MATRIX ===================== */}
          <section id="pluggable-matrix" className="scroll-mt-28">
            <h2 className="text-3xl font-bold tracking-tight mb-4 scroll-mt-28">Pluggable Provider Matrix</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Metl abstracts every infrastructure dependency into a uniform operational template. For each service layer, you choose between a <strong className="text-foreground">Local Engine</strong> running natively inside a secure K3s namespace, or a <strong className="text-foreground">Bring Your Own Keys (BYOK)</strong> integration wired to an external enterprise endpoint.
            </p>

            <div className="overflow-x-auto my-8 border rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Service</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Metal Native</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">BYOK External</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="px-4 py-3 font-medium text-foreground">Database</td>
                    <td className="px-4 py-3 text-muted-foreground">Single-tenant Supabase / PostgreSQL StatefulSet with PVC</td>
                    <td className="px-4 py-3 text-muted-foreground">Supabase project keys, AWS RDS, CockroachDB</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-foreground">File Storage</td>
                    <td className="px-4 py-3 text-muted-foreground">MinIO S3-compatible container with bucket explorer</td>
                    <td className="px-4 py-3 text-muted-foreground">AWS S3, Azure Blob Storage</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-foreground">Mail</td>
                    <td className="px-4 py-3 text-muted-foreground">Listmonk / localized SMTP relay</td>
                    <td className="px-4 py-3 text-muted-foreground">Resend, SendGrid, Postmark</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-foreground">Hosting</td>
                    <td className="px-4 py-3 text-muted-foreground">Nixpacks + K3s + Traefik + Let's Encrypt SSL</td>
                    <td className="px-4 py-3 text-muted-foreground">Vercel, Netlify, Cloudflare Pages</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-foreground">Frontend Dev</td>
                    <td className="px-4 py-3 text-muted-foreground">Cursor SDK / In-house LLM multi-file editing</td>
                    <td className="px-4 py-3 text-muted-foreground">v0 API Generation Engine</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-foreground">Monitoring</td>
                    <td className="px-4 py-3 text-muted-foreground">OpenTelemetry + SigNoz Canvas Twin</td>
                    <td className="px-4 py-3 text-muted-foreground">Sentry DSN, Datadog, New Relic</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-foreground">Auth</td>
                    <td className="px-4 py-3 text-muted-foreground">Keycloak / Supabase Auth with local JWT</td>
                    <td className="px-4 py-3 text-muted-foreground">Clerk, Auth0, Firebase Auth</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-muted-foreground leading-relaxed mb-4">
              The Architecture Orchestration Agent programatically generates Kubernetes ConfigMaps and base64-encoded Secrets. Application code reads generic environment variables such as <InlineCode>STORAGE_ENDPOINT</InlineCode> and <InlineCode>DATABASE_URL</InlineCode>, so switching from local MinIO to AWS S3 requires zero code changes — only a configuration toggle.
            </p>
          </section>

          {/* ===================== SECTION 5: EJECTION ENGINE ===================== */}
          <section id="ejection-engine" className="scroll-mt-28">
            <h2 className="text-3xl font-bold tracking-tight mb-4 scroll-mt-28">Ejection Engine</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              The <strong className="text-foreground">Independent Ejection Engine</strong> is Metl's definitive proof of zero lock-in. Click a single button to trigger a full system extraction pipeline that exports everything you need to run independently.
            </p>

            <div className="grid sm:grid-cols-3 gap-4 my-8">
              <div className="bg-background border rounded-xl p-6 text-center hover:shadow-md transition-shadow">
                <Code className="w-8 h-8 text-blue-500 mx-auto mb-4" />
                <h4 className="font-semibold mb-2">Source Code</h4>
                <p className="text-sm text-muted-foreground">Fully decoupled full-stack application code, structured as standard OCI container builds compatible with any Docker or Nixpacks workflow.</p>
              </div>
              <div className="bg-background border rounded-xl p-6 text-center hover:shadow-md transition-shadow">
                <Server className="w-8 h-8 text-green-500 mx-auto mb-4" />
                <h4 className="font-semibold mb-2">Data Migrations</h4>
                <p className="text-sm text-muted-foreground">Comprehensive raw SQL DDL migration files capturing the complete active data model state.</p>
              </div>
              <div className="bg-background border rounded-xl p-6 text-center hover:shadow-md transition-shadow">
                <Download className="w-8 h-8 text-amber-500 mx-auto mb-4" />
                <h4 className="font-semibold mb-2">Infrastructure</h4>
                <p className="text-sm text-muted-foreground">A standalone docker-compose.yml with all equivalent open-source services pre-wired.</p>
              </div>
            </div>

            <p className="text-muted-foreground leading-relaxed mb-4">
              The exported package is mathematically non-destructive. It uses standard OCI runtime specifications and raw SQL migrations, guaranteeing complete portability across any Docker-compliant or Kubernetes cloud-native environment globally. Paste it onto any Linux VPS, run <InlineCode>docker compose up -d</InlineCode>, and your entire ecosystem comes online with zero code adjustments.
            </p>
          </section>

          {/* ===================== SECTION 6: HYPER-ELASTIC TIERS ===================== */}
          <section id="elastic-tiers" className="scroll-mt-28">
            <h2 className="text-3xl font-bold tracking-tight mb-4 scroll-mt-28">Hyper-Elastic Tiers</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Metl OS manages compute resources through a dual-tiered framework that combines a high-density <strong className="text-foreground">Warm Pool</strong> with an on-demand <strong className="text-foreground">Cold Scaling Tier</strong> for optimal resource utilization and sub-10-second delivery.
            </p>

            <h3 className="text-xl font-semibold tracking-tight mt-8 mb-3">Warm Pool Tier</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Pre-provisioned Azure VMs (Standard_D2s_v5 or larger) run lightweight K3s clusters that stay online permanently. Applications are built via Nixpacks into OCI containers and isolated through Kubernetes Namespaces, cgroups v2 bandwidth limits, and disk mount quotas. Standard deployments initialize in under 10 seconds.
            </p>

            <h3 className="text-xl font-semibold tracking-tight mt-8 mb-3">Cold Scaling Tier</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Triggered automatically when telemetry metrics cross 70% RAM/CPU, or when compliance policies require physical hardware boundaries. The orchestration agent calls the Azure Resource Manager (ARM) API to allocate a new dedicated VM. A cryptographically signed cloud-init script provisions runtimes, attaches certificates, and joins the cluster seamlessly — ready for workloads in 2 to 3 minutes with no human intervention.
            </p>

            <div className="overflow-x-auto my-6 border rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Vector</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Warm Pool</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Cold Tier</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="px-4 py-3 font-medium text-foreground">Init Speed</td>
                    <td className="px-4 py-3 text-muted-foreground">&lt; 10 seconds</td>
                    <td className="px-4 py-3 text-muted-foreground">~2–3 minutes</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-foreground">Isolation</td>
                    <td className="px-4 py-3 text-muted-foreground">K8s Namespace / cgroups v2</td>
                    <td className="px-4 py-3 text-muted-foreground">Dedicated Azure VM</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-foreground">Trigger</td>
                    <td className="px-4 py-3 text-muted-foreground">Instant namespace creation</td>
                    <td className="px-4 py-3 text-muted-foreground">70% threshold or compliance rule</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-foreground">Cost Model</td>
                    <td className="px-4 py-3 text-muted-foreground">Fractions of a cent per pod</td>
                    <td className="px-4 py-3 text-muted-foreground">Standard cloud hourly rate</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ===================== SECTION 7: IDENTITY BROKER ===================== */}
          <section id="identity-broker" className="scroll-mt-28">
            <h2 className="text-3xl font-bold tracking-tight mb-4 scroll-mt-28">Identity Broker Proxy</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Dynamic tenant subdomains (e.g. <InlineCode>*.metl.run</InlineCode>) create a strict OAuth constraint: identity providers like Google explicitly block wildcard redirect URIs from developer projects. Metl solves this without requiring every user to configure their own OAuth app.
            </p>

            <h3 className="text-xl font-semibold tracking-tight mt-8 mb-3">How It Works</h3>
            <ol className="list-decimal list-inside space-y-3 text-muted-foreground mb-6">
              <li><strong className="text-foreground">Ingress Interception</strong> — The browser redirects from a tenant subdomain (<InlineCode>app-alpha.metl.run</InlineCode>) to the central auth gateway (<InlineCode>auth.metl.run</InlineCode>).</li>
              <li><strong className="text-foreground">State Packing</strong> — The broker packages the tenant tracking ID and an encrypted cryptographic nonce into a base64 state parameter, forwarding it to the identity provider under the master platform credentials.</li>
              <li><strong className="text-foreground">Identity Verification</strong> — The user completes standard authentication with the upstream provider (Google, GitHub, etc.).</li>
              <li><strong className="text-foreground">Cryptographic Minting</strong> — The broker processes the callback, extracts the profile, and mints a short-lived JWT signed with the platform's master private key.</li>
              <li><strong className="text-foreground">Domain Redirection</strong> — The browser is redirected back to the tenant app with the secure token payload in the query string.</li>
              <li><strong className="text-foreground">Session Hydration</strong> — The tenant app validates the JWT signature, then hydrates the session into its local Supabase Auth / Postgres table instances.</li>
            </ol>

            <p className="text-muted-foreground leading-relaxed mb-4">
              All tokens are isolated per tenant namespace. No sensitive credentials are stored in plain text on the application file system or in shared database rows.
            </p>
          </section>

          {/* ===================== SECTION 8: AGENTIC OPERATIONS ===================== */}
          <section id="agentic-ops" className="scroll-mt-28">
            <h2 className="text-3xl font-bold tracking-tight mb-4 scroll-mt-28">Agentic Operations</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Metl embeds the <strong className="text-foreground">Cursor SDK</strong> and standard <strong className="text-foreground">Model Context Protocol (MCP)</strong> server engines directly into the runtime fabric. Rather than generating untrusted strings, the system spins up dedicated containerized workspace instances to execute verified code modifications autonomously.
            </p>

            <h3 className="text-xl font-semibold tracking-tight mt-8 mb-3">Autonomous Repair Loop</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              When the SRE Monitoring Agent detects a runtime crash, it does not simply alert an engineer. It:
            </p>
            <ol className="list-decimal list-inside space-y-3 text-muted-foreground mb-6">
              <li>Gathers stack traces and diagnostic logs from the affected container.</li>
              <li>Spins up an isolated Cursor SDK workspace mapped to the tenant's source repository volume.</li>
              <li>Runs a multi-file model context loop to identify and patch the root cause.</li>
              <li>Launches a local preview build and validates the fix visually via Playwright browser automation.</li>
              <li>Captures console errors and iterates until all assertions pass cleanly.</li>
              <li>Deploys the verified hotfix as a zero-downtime commit back to the production path.</li>
            </ol>

            <h3 className="text-xl font-semibold tracking-tight mt-8 mb-3">Real-Time Visual Feedback</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Throughout the repair loop, file diffs and Playwright screenshot payloads stream back to the Glass Box Visual Twin dashboard in real-time. You can watch the agent repair your application live on the topology canvas.
            </p>

            <div className="grid sm:grid-cols-2 gap-4 my-6">
              <div className="bg-background border rounded-xl p-6 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center mb-4">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <h4 className="font-semibold mb-2">Cursor SDK Integration</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">Multi-file system code modification with elite model context indexing and browser automation.</p>
              </div>
              <div className="bg-background border rounded-xl p-6 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 text-green-500 flex items-center justify-center mb-4">
                  <Activity className="w-5 h-5" />
                </div>
                <h4 className="font-semibold mb-2">SRE Self-Healing</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">Continuous AI-driven monitoring that intercepts crashes and pushes verified fixes automatically.</p>
              </div>
              <div className="bg-background border rounded-xl p-6 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4">
                  <Rocket className="w-5 h-5" />
                </div>
                <h4 className="font-semibold mb-2">Zero-Downtime Deploy</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">Verified commits are rolled out through the Deployment Engine without interrupting live traffic.</p>
              </div>
              <div className="bg-background border rounded-xl p-6 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4">
                  <Leaf className="w-5 h-5" />
                </div>
                <h4 className="font-semibold mb-2">Eco-Mode Lifecycle</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">Scale-to-zero routines and wake-on-demand loops for idle apps; passive cost tracking for external deployments.</p>
              </div>
            </div>
          </section>

          {/* ===================== SECTION 9: FAQ ===================== */}
          <section id="faq" className="scroll-mt-28">
            <h2 className="text-3xl font-bold tracking-tight mb-4 scroll-mt-28">Frequently Asked Questions</h2>

            <div className="space-y-6">
              <div>
                <h4 className="font-semibold text-foreground mb-2">If users can eject and host anywhere, what is Metl's retention model?</h4>
                <p className="text-muted-foreground leading-relaxed text-sm">
                  Retention is driven by superior developer experience, not restrictive platform constraints. While users have full freedom to extract their application code and host it independently, they choose to stay on Metl because the multi-agent orchestration fabric handles zero-downtime rolling deployments, automated security scanning, compliance checks, and self-healing loops that intercept runtime crashes and push verified hotfixes to production — eliminating the operational toil of managing raw infrastructure.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-2">How does Metl securely manage third-party cloud API keys?</h4>
                <p className="text-muted-foreground leading-relaxed text-sm">
                  The moment a user provides an integration key (e.g. AWS or Resend token), the payload travels through an encrypted channel to a secure platform credentials vault. The Architecture Orchestration Agent then structures standard Kubernetes <InlineCode>v1/Secret</InlineCode> primitives inside the tenant's isolated namespace. These secrets are injected dynamically into container runtime memory at the OS level, meaning tokens are fully isolated and inaccessible to other tenants in the cluster pool. Plain-text token storage is never used.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-2">What happens to data integrity when switching database providers mid-lifecycle?</h4>
                <p className="text-muted-foreground leading-relaxed text-sm">
                  When a database provider shifts from local hosting to an external endpoint, the control plane initiates an automated migration synchronization. The edge proxy routing table is paused temporarily while active sockets are held open to prevent drop-offs. The Resource Allocator extracts the structural layout state from the local database, compiles an explicit SQL migration definition, and runs it against the new external data store. Once validation passes, connection variables are updated in memory and traffic resumes with zero loss of data integrity.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-2">Does Metl support custom domains and SSL?</h4>
                <p className="text-muted-foreground leading-relaxed text-sm">
                  Yes. The Hosting & Deployment Engine uses Traefik as the edge reverse proxy with automatic Let's Encrypt SSL certificate provisioning. For external BYOK hosting targets (Vercel, Netlify, Cloudflare Pages), SSL is managed natively by those platforms. Traefik handles subdomain wildcard routing automatically for all tenant applications deployed on the Metal Infrastructure Grid.
                </p>
              </div>
            </div>
          </section>

        </main>
      </div>

      <Footer />
    </div>
  );
}
