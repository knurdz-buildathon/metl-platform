import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Check, ArrowRight, Zap } from "lucide-react";
import Link from "next/link";
import { DodoCheckoutButton } from "@/components/billing/DodoCheckoutButton";

export default function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold tracking-tight mb-4">Simple, transparent pricing</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Start for free, scale when you need to. Pay for what you use.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free Plan */}
            <div className="border rounded-2xl p-8 bg-background flex flex-col hover:shadow-md transition-shadow">
              <h3 className="text-2xl font-bold mb-2">Free</h3>
              <p className="text-muted-foreground mb-6">For personal projects and experiments.</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-muted-foreground">/mo</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-blue-500 shrink-0" />
                  <span>Up to 1 project</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-blue-500 shrink-0" />
                  <span>512 MB memory limit</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-blue-500 shrink-0" />
                  <span>Community support</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-blue-500 shrink-0" />
                  <span>Basic Glass Box</span>
                </li>
              </ul>
              <Link
                href="/signup"
                className="w-full py-3 text-center rounded-md border border-border hover:bg-accent transition-colors font-medium"
              >
                Start for free
              </Link>
            </div>

            {/* Pro Plan */}
            <div className="border-2 border-foreground rounded-2xl p-8 bg-background flex flex-col relative hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-foreground text-background px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                Most Popular
              </div>
              <h3 className="text-2xl font-bold mb-2">Pro</h3>
              <p className="text-muted-foreground mb-6">For professional developers and small teams.</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">$20</span>
                <span className="text-muted-foreground">/mo</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-blue-500 shrink-0" />
                  <span>Up to 5 projects</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-blue-500 shrink-0" />
                  <span>2 GB memory limit</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-blue-500 shrink-0" />
                  <span>Priority support</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-blue-500 shrink-0" />
                  <span>Advanced Glass Box</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-blue-500 shrink-0" />
                  <span>Ejection Engine access</span>
                </li>
              </ul>
              <DodoCheckoutButton plan="pro" buttonText="Subscribe to Pro" variant="primary" />
            </div>

            {/* Plus Plan — Metered */}
            <div className="border rounded-2xl p-8 bg-background flex flex-col hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-2xl font-bold">Plus</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 text-[10px] font-semibold uppercase tracking-wider border border-blue-500/20">
                  <Zap className="w-3 h-3" />
                  Metered
                </span>
              </div>
              <p className="text-muted-foreground mb-6">For teams with dynamic workloads. Pay for what you use.</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">Pay-as-you-go</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-blue-500 shrink-0" />
                  <span>Unlimited projects</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-blue-500 shrink-0" />
                  <span>8 GB memory limit</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-blue-500 shrink-0" />
                  <span>Dedicated support</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-blue-500 shrink-0" />
                  <span>All features unlocked</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-blue-500 shrink-0" />
                  <span>Volume billing via Dodo</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-blue-500 shrink-0" />
                  <span>Custom SLAs</span>
                </li>
              </ul>
              <DodoCheckoutButton plan="plus" buttonText="Get Started with Plus" variant="secondary" />
            </div>
          </div>

          {/* Metered billing explainer */}
          <div className="max-w-2xl mx-auto mt-16 border rounded-2xl p-8 bg-muted/30">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">How metered billing works</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  The Plus plan uses Dodo Payments&apos; event-based metered billing. You pay only for what you consume
                  — deployment minutes, requests, or compute hours. Dodo tracks usage in real-time and bills you at
                  the end of each cycle. No upfront commitments, no surprise fees.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
