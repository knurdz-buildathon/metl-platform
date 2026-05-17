'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import { Loader2, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';

export default function SettingsPage() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [subscription, setSubscription] = useState<any>(null);
  const [subLoading, setSubLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/signin');
      return;
    }
    if (isAuthenticated) {
      apiFetch('/api/billing/subscription')
        .then((data) => setSubscription(data.subscription))
        .catch(() => setSubscription(null))
        .finally(() => setSubLoading(false));
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const planFeatures: Record<string, string[]> = {
    free: ['Up to 1 project', '512 MB memory', 'Basic Glass Box', 'Community support'],
    pro: ['Up to 5 projects', '2 GB memory', 'Advanced Glass Box', 'Ejection Engine', 'Priority support'],
    plus: ['Unlimited projects', '8 GB memory', 'All features', 'Metered billing', 'Dedicated support'],
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-16 px-4">
        <div className="container mx-auto max-w-2xl">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>

          <h1 className="text-3xl font-bold tracking-tight mb-8">Account Settings</h1>

          {/* Profile */}
          <div className="border rounded-2xl bg-card p-6 shadow-sm mb-6">
            <h2 className="text-lg font-semibold mb-4">Profile</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Name</label>
                  <p className="font-medium">{user?.name || '—'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="font-medium">{user?.email}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Subscription */}
          <div className="border rounded-2xl bg-card p-6 shadow-sm mb-6">
            <h2 className="text-lg font-semibold mb-4">Subscription</h2>
            {subLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </div>
            ) : subscription ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-foreground text-background text-xs font-semibold uppercase">
                    {subscription.plan}
                  </span>
                  {subscription.status === 'active' && !subscription.cancelAtPeriodEnd ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle className="w-3.5 h-3.5" /> Active
                    </span>
                  ) : subscription.cancelAtPeriodEnd ? (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                      <AlertCircle className="w-3.5 h-3.5" /> Cancels at period end
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-red-600">
                      <AlertCircle className="w-3.5 h-3.5" /> {subscription.status}
                    </span>
                  )}
                </div>

                <ul className="space-y-2 text-sm">
                  {(planFeatures[subscription.plan] || []).map((f) => (
                    <li key={f} className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                {subscription.plan !== 'free' && !subscription.cancelAtPeriodEnd && (
                  <button
                    onClick={async () => {
                      if (!confirm('Cancel your subscription at the end of the current period?')) return;
                      try {
                        await apiFetch('/api/billing/cancel', { method: 'POST' });
                        window.location.reload();
                      } catch (err: any) {
                        alert(err.message || 'Failed to cancel');
                      }
                    }}
                    className="text-sm text-red-500 hover:text-red-600 underline"
                  >
                    Cancel subscription
                  </button>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                You&apos;re on the <span className="font-medium text-foreground">Free</span> plan.
                <div className="mt-3">
                  <Link
                    href="/pricing"
                    className="inline-flex items-center justify-center py-2 px-4 bg-foreground text-background rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Upgrade
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Danger zone */}
          <div className="border rounded-2xl bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 text-red-500">Danger Zone</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Account deletion is not yet supported. Contact support if you need to delete your account.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
