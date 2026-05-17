import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Check } from "lucide-react";
import Link from "next/link";

export default function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold tracking-tight mb-4">Simple, transparent pricing</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Start for free, scale when you need to. No hidden fees.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Hobby Plan */}
            <div className="border rounded-2xl p-8 bg-background flex flex-col hover:shadow-md transition-shadow">
              <h3 className="text-2xl font-bold mb-2">Hobby</h3>
              <p className="text-muted-foreground mb-6">For personal projects and experiments.</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-muted-foreground">/mo</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-blue-500" /><span>Up to 3 projects</span></li>
                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-blue-500" /><span>Community support</span></li>
                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-blue-500" /><span>Basic Glass Box</span></li>
              </ul>
              <Link href="/signup" className="w-full py-3 text-center rounded-md border border-border hover:bg-accent transition-colors font-medium">
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
                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-blue-500" /><span>Unlimited projects</span></li>
                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-blue-500" /><span>Priority support</span></li>
                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-blue-500" /><span>Advanced Glass Box features</span></li>
                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-blue-500" /><span>Ejection Engine access</span></li>
              </ul>
              <Link href="/signup" className="w-full py-3 text-center rounded-md bg-foreground text-background hover:opacity-90 transition-opacity font-medium">
                Subscribe to Pro
              </Link>
            </div>

            {/* Pay as you go Plan */}
            <div className="border rounded-2xl p-8 bg-background flex flex-col hover:shadow-md transition-shadow">
              <h3 className="text-2xl font-bold mb-2">Pay-as-you-go</h3>
              <p className="text-muted-foreground mb-6">For teams with dynamic workloads.</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">Custom</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-blue-500" /><span>Usage-based billing</span></li>
                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-blue-500" /><span>Volume discounts</span></li>
                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-blue-500" /><span>Dedicated account manager</span></li>
                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-blue-500" /><span>Custom SLAs</span></li>
              </ul>
              <Link href="/signup" className="w-full py-3 text-center rounded-md border border-border hover:bg-accent transition-colors font-medium">
                Contact Sales
              </Link>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
