import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ArrowRight, Boxes, Rocket, AlertTriangle } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-24 md:py-32 flex flex-col items-center justify-center text-center px-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent text-accent-foreground text-sm font-medium mb-8">
            <span className="flex h-2 w-2 rounded-full bg-blue-500"></span>
            Metl v1.0 is now available
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tighter max-w-4xl mb-6">
            Open Agentic Cloud Fabric
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10">
            Build, deploy, and scale applications with zero vendor lock-in. 
            A single platform that transparently orchestrates your infrastructure across any cloud.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <Link 
              href="/signup" 
              className="inline-flex items-center justify-center gap-2 bg-foreground text-background px-8 py-3 rounded-md font-medium hover:opacity-90 transition-opacity"
            >
              Start Deploying <ArrowRight className="w-4 h-4" />
            </Link>
            <Link 
              href="/docs" 
              className="inline-flex items-center justify-center gap-2 bg-background text-foreground border border-border px-8 py-3 rounded-md font-medium hover:bg-accent transition-colors"
            >
              Read Documentation
            </Link>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 bg-muted/50 border-y px-4">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight mb-4">Everything you need to scale</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Metl provides a unified interface for your entire cloud infrastructure, with built-in agentic intelligence to optimize costs and performance.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-background border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-lg flex items-center justify-center mb-6">
                  <Boxes className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">Glass Box Architecture</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Real-time view of your deployed infrastructure. Visualize components, dependencies, and data flows automatically.
                </p>
              </div>
              
              <div className="bg-background border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-green-500/10 text-green-500 rounded-lg flex items-center justify-center mb-6">
                  <Rocket className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">Intelligent Deployments</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Deploy to any cloud provider seamlessly. Our agents automatically handle provisioning, networking, and scaling.
                </p>
              </div>
              
              <div className="bg-background border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-lg flex items-center justify-center mb-6">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">Ejection Engine</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Migrate between cloud providers with a single click. Metl generates Terraform and handles state migration instantly.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 px-4 text-center">
          <div className="container mx-auto max-w-4xl">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">Ready to break free?</h2>
            <p className="text-xl text-muted-foreground mb-8">
              Join thousands of developers building resilient, multi-cloud architectures.
            </p>
            <Link 
              href="/signup" 
              className="inline-flex items-center justify-center bg-foreground text-background px-8 py-3 rounded-md font-medium hover:opacity-90 transition-opacity"
            >
              Get Started for Free
            </Link>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
}
