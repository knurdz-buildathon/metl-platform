'use client';

import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';

export default function BillingFailurePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-20">
        <div className="w-full max-w-md text-center space-y-6">
          <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto" />

          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Payment failed</h1>
            <p className="text-muted-foreground">
              We couldn&apos;t process your payment. This may be due to insufficient funds, an expired card, or a
              temporary issue with your bank.
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-4">
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 bg-foreground text-background px-6 py-3 rounded-md font-medium hover:opacity-90 transition-opacity"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 py-3 px-6 border border-border rounded-md hover:bg-accent transition-colors text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
