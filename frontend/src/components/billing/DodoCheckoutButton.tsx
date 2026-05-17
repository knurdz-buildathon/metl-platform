'use client';

import { useState, useEffect } from 'react';

interface DodoCheckoutButtonProps {
  plan: 'pro' | 'plus';
  buttonText: string;
  variant?: 'primary' | 'secondary';
}

export function DodoCheckoutButton({ plan, buttonText, variant = 'primary' }: DodoCheckoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);

  useEffect(() => {
    // Load DodoPayments SDK dynamically since it's only needed on billing pages
    if ((window as any).__dodoPaymentsLoaded) {
      setSdkReady(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.dodopayments.com/checkout/v1/dodopayments.js';
    script.async = true;
    script.onload = () => {
      const DodoPayments = (window as any).DodoPayments;
      if (DodoPayments) {
        DodoPayments.Initialize({
          mode: process.env.NEXT_PUBLIC_DODO_ENVIRONMENT === 'live_mode' ? 'live' : 'test',
          displayType: 'overlay',
          onEvent: (event: any) => {
            switch (event.event_type) {
              case 'checkout.opened':
              case 'checkout.closed':
                setIsLoading(false);
                break;
              case 'checkout.error':
                setIsLoading(false);
                setError(event.data?.message || 'Checkout error');
                break;
              case 'checkout.redirect':
                setIsLoading(false);
                break;
            }
          },
        });
        (window as any).__dodoPaymentsLoaded = true;
        setSdkReady(true);
      }
    };
    script.onerror = () => {
      setError('Failed to load payment SDK');
    };
    document.body.appendChild(script);

    return () => {
      // Don't remove script on unmount — other components might need it
    };
  }, []);

  const handleCheckout = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('metl_access_token') : null;
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ plan }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Failed to create checkout session');
      }

      const DodoPayments = (window as any).DodoPayments;
      if (DodoPayments && data.checkoutUrl) {
        DodoPayments.Checkout.open({
          checkoutUrl: data.checkoutUrl,
          options: { showTimer: true, showSecurityBadge: true },
        });
      } else {
        // Fallback: direct redirect
        window.location.href = data.checkoutUrl;
      }
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || 'Checkout failed');
    }
  };

  const baseClasses =
    variant === 'primary'
      ? 'w-full py-3 text-center rounded-md bg-foreground text-background hover:opacity-90 transition-opacity font-medium'
      : 'w-full py-3 text-center rounded-md border border-border hover:bg-accent transition-colors font-medium';

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={handleCheckout}
        disabled={isLoading || !sdkReady}
        className={baseClasses + (isLoading || !sdkReady ? ' opacity-70 cursor-not-allowed' : '')}
      >
        {isLoading ? (
          <span className="inline-flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Processing...
          </span>
        ) : (
          buttonText
        )}
      </button>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-3 text-xs text-red-600 text-center">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline hover:no-underline">Dismiss</button>
        </div>
      )}
    </div>
  );
}
