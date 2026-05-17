'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CheckCircle, ArrowRight, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export default function BillingSuccessPage() {
  const searchParams = useSearchParams();
  const paymentId = searchParams.get('payment_id');
  const [checking, setChecking] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);

  useEffect(() => {
    apiFetch('/api/billing/subscription')
      .then((data) => {
        setSubscription(data.subscription);
      })
      .catch(() => {
        // subscription may still be processing
      })
      .finally(() => setChecking(false));
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-20">
        <div className="w-full max-w-md text-center space-y-6">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />

          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Payment successful</h1>
            <p className="text-muted-foreground">
              {checking
                ? 'Verifying your subscription...'
                : subscription
                  ? `You're now on the ${subscription.plan} plan. Welcome to Metl.`
                  : "Thank you for your purchase. Your subscription is being activated. It may take a moment to appear in your account."}
            </p>
          </div>

          {paymentId && (
            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Payment ID</p>
              <p className="text-sm font-mono">{paymentId}</p>
            </div>
          )}

          {checking && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Checking subscription status...
            </div>
          )}

          <div className="flex flex-col gap-3 pt-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 bg-foreground text-background px-6 py-3 rounded-md font-medium hover:opacity-90 transition-opacity"
            >
              Go to Dashboard <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/settings"
              className="inline-flex items-center justify-center py-3 px-6 border border-border rounded-md hover:bg-accent transition-colors text-sm font-medium"
            >
              View Account Settings
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
