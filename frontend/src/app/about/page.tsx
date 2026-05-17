import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import Image from "next/image";

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 md:py-32 px-4 border-b">
          <div className="container mx-auto max-w-4xl text-center">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Our Mission
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed">
              We are building the open agentic cloud fabric to give developers total control over their infrastructure, with zero vendor lock-in.
            </p>
          </div>
        </section>

        {/* Story Section */}
        <section className="py-20 px-4">
          <div className="container mx-auto max-w-3xl">
            <div className="prose prose-lg dark:prose-invert max-w-none">
              <h2 className="text-3xl font-bold tracking-tight mb-6">The Story of Metl</h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                For years, developers have been forced to choose between the simplicity of PaaS providers and the control of raw cloud primitives. The modern cloud ecosystem has become increasingly fragmented and complex, leading to widespread vendor lock-in and soaring infrastructure costs.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Metl was born out of frustration with this status quo. We believe that your infrastructure should be as portable as your code. Our platform leverages advanced AI agents to abstract away the complexity of cloud provisioning, networking, and scaling.
              </p>
              
              <div className="my-12 p-8 bg-muted rounded-2xl border border-border text-center">
                <Image src="/logo.png" alt="Metl" width={64} height={64} className="mx-auto mb-6 rounded-lg shadow-sm" />
                <h3 className="text-2xl font-bold mb-4">Zero Vendor Lock-in</h3>
                <p className="text-muted-foreground">
                  Our unique Ejection Engine ensures that you can always export your infrastructure state as standard Terraform code and deploy it directly to your AWS, GCP, or Azure accounts.
                </p>
              </div>

              <h2 className="text-3xl font-bold tracking-tight mb-6">Open Agentic Architecture</h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Instead of rigid, hardcoded infrastructure pipelines, Metl relies on a swarm of specialized, autonomous agents. From our Deployment Engine to the SRE Agent, each component intelligently adapts to your application's needs in real-time, optimizing for performance, cost, and reliability.
              </p>
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
}
