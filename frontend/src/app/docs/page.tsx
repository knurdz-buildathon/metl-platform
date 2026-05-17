import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import Link from "next/link";
import { Book, Code, Terminal, Zap } from "lucide-react";

export default function DocsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Sidebar Nav */}
        <aside className="w-full md:w-64 border-r bg-muted/30 p-6 hidden md:block">
          <h3 className="font-bold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Getting Started</h3>
          <ul className="space-y-2 mb-8">
            <li><Link href="#" className="text-sm font-medium text-blue-500">Introduction</Link></li>
            <li><Link href="#" className="text-sm text-muted-foreground hover:text-foreground">Quickstart Guide</Link></li>
            <li><Link href="#" className="text-sm text-muted-foreground hover:text-foreground">Core Concepts</Link></li>
          </ul>
          
          <h3 className="font-bold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Features</h3>
          <ul className="space-y-2 mb-8">
            <li><Link href="#" className="text-sm text-muted-foreground hover:text-foreground">Glass Box View</Link></li>
            <li><Link href="#" className="text-sm text-muted-foreground hover:text-foreground">Deployment Engine</Link></li>
            <li><Link href="#" className="text-sm text-muted-foreground hover:text-foreground">Ejection Engine</Link></li>
            <li><Link href="#" className="text-sm text-muted-foreground hover:text-foreground">SRE Agent</Link></li>
          </ul>
          
          <h3 className="font-bold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Reference</h3>
          <ul className="space-y-2">
            <li><Link href="#" className="text-sm text-muted-foreground hover:text-foreground">CLI Commands</Link></li>
            <li><Link href="#" className="text-sm text-muted-foreground hover:text-foreground">API Reference</Link></li>
            <li><Link href="#" className="text-sm text-muted-foreground hover:text-foreground">Configuration</Link></li>
          </ul>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 md:p-12">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-bold tracking-tight mb-4">Introduction to Metl</h1>
            <p className="text-xl text-muted-foreground mb-8">
              Learn how to build, deploy, and scale your applications on the Open Agentic Cloud Fabric.
            </p>

            <div className="grid sm:grid-cols-2 gap-6 mb-12">
              <Link href="#" className="group block border rounded-xl p-6 hover:border-foreground transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <Terminal className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <h3 className="font-bold">Quickstart</h3>
                </div>
                <p className="text-sm text-muted-foreground">Get your first application running on Metl in under 5 minutes.</p>
              </Link>
              
              <Link href="#" className="group block border rounded-xl p-6 hover:border-foreground transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <Book className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <h3 className="font-bold">Core Concepts</h3>
                </div>
                <p className="text-sm text-muted-foreground">Understand the architecture and philosophy behind Metl.</p>
              </Link>
              
              <Link href="#" className="group block border rounded-xl p-6 hover:border-foreground transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <Zap className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <h3 className="font-bold">Deployments</h3>
                </div>
                <p className="text-sm text-muted-foreground">Learn how the Deployment Engine works across cloud providers.</p>
              </Link>
              
              <Link href="#" className="group block border rounded-xl p-6 hover:border-foreground transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <Code className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <h3 className="font-bold">API Reference</h3>
                </div>
                <p className="text-sm text-muted-foreground">Detailed documentation for the Metl REST API.</p>
              </Link>
            </div>

            <h2 className="text-2xl font-bold tracking-tight mb-4 mt-12 pb-2 border-b">What is Metl?</h2>
            <div className="prose prose-slate dark:prose-invert max-w-none">
              <p>
                Metl is an <strong>Open Agentic Cloud Fabric</strong>. It provides a unified orchestration layer over your cloud infrastructure, allowing you to deploy and scale applications without worrying about provider-specific primitives.
              </p>
              <p>
                Unlike traditional Platform-as-a-Service (PaaS) offerings, Metl is designed from the ground up to prevent vendor lock-in. The <strong>Ejection Engine</strong> allows you to automatically translate your Metl infrastructure into raw Terraform configurations for AWS, GCP, or Azure at any time.
              </p>
              <h3>Key Components</h3>
              <ul>
                <li><strong>Glass Box Dashboard</strong>: Visualize your entire architecture, service dependencies, and live traffic in real-time.</li>
                <li><strong>Deployment Engine</strong>: Intelligent multi-cloud deployments driven by autonomous AI agents.</li>
                <li><strong>SRE Agent</strong>: Continuous, AI-driven monitoring that automatically resolves common infrastructure incidents.</li>
              </ul>
            </div>
          </div>
        </main>
      </div>
      
      <Footer />
    </div>
  );
}
