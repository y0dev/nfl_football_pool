'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Receipt, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useAuth, AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import { Footer } from '@/components/layout/Footer';
import { BrandLogo } from '@/components/ui/brand-logo';
import { createPageUrl } from '@/lib/utils';
import type { PurchaseRecord } from '@/lib/subscription';

const bg      = 'oklch(13% 0.025 255)';
const surface = 'oklch(17% 0.028 255)';
const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const gold    = 'oklch(74% 0.16 72)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const errRed  = 'oklch(62% 0.22 25)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

function productLabel(product: string): string {
  if (product === 'standard') return 'Sunday Huddle Standard';
  if (product === 'addon_pool') return 'Additional Pool';
  return product;
}

function statusStyle(status: string) {
  const s = status.toLowerCase();
  if (s === 'completed') return { icon: CheckCircle2, color: greenHi, label: 'Completed' };
  if (s === 'failed' || s === 'canceled' || s === 'cancelled') return { icon: XCircle, color: errRed, label: status.charAt(0).toUpperCase() + status.slice(1) };
  return { icon: Clock, color: gold, label: status.charAt(0).toUpperCase() + status.slice(1) };
}

function formatAmount(cents: number | null, currency: string): string {
  if (cents == null) return '—';
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: currency.toUpperCase() });
}

function PurchasesContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [purchases, setPurchases] = useState<PurchaseRecord[] | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/admin/purchases?adminId=${user.id}`)
      .then(r => r.json())
      .then(d => { if (d.success) setPurchases(d.purchases); else setPurchases([]); })
      .catch(() => setPurchases([]));
  }, [user?.id]);

  return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <nav style={{ borderBottom: `1px solid ${border}`, background: surface }}>
        <div className="lp-inner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '3.25rem', gap: '0.75rem' }}>
          <Link href={createPageUrl('accountsettings')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: textMid }}>
            <ArrowLeft style={{ width: 14, height: 14 }} />
            <BrandLogo variant="icon" size={24} />
            <span style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', color: text, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Sunday Huddle
            </span>
          </Link>
        </div>
      </nav>

      {/* Body */}
      <div className="lp-inner" style={{ flex: 1, paddingTop: '2.5rem', paddingBottom: '3rem', maxWidth: 640 }}>
        <div style={{ marginBottom: '2rem' }}>
          <p style={{ ...bc, fontWeight: 700, fontSize: '0.63rem', letterSpacing: '0.28em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.35rem' }}>
            Account
          </p>
          <h1 style={{ ...bc, fontWeight: 900, fontSize: '2rem', color: text, textTransform: 'uppercase', letterSpacing: '0.03em', lineHeight: 1 }}>
            Purchases
          </h1>
        </div>

        {purchases === null ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: textDim, ...b, fontSize: '0.85rem' }}>Loading…</div>
        ) : purchases.length === 0 ? (
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '2.5rem 1.5rem', textAlign: 'center' }}>
            <Receipt style={{ width: 32, height: 32, color: textDim, margin: '0 auto 1rem' }} />
            <p style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              No purchases yet
            </p>
            <p style={{ ...b, fontSize: '0.85rem', color: textDim, marginBottom: '1.5rem', maxWidth: '32ch', marginLeft: 'auto', marginRight: 'auto' }}>
              Upgrade to Standard to unlock premium commissioner features.
            </p>
            <button
              onClick={() => router.push('/upgrade')}
              style={{ padding: '0.55rem 1.25rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              View Plans
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {purchases.map(purchase => {
              const status = statusStyle(purchase.status);
              const StatusIcon = status.icon;
              const purchaseYear = new Date(purchase.createdAt).getFullYear();
              return (
                <div key={purchase.id} style={{ background: card, border: `1px solid ${border}`, borderLeft: `3px solid ${purchase.product === 'standard' ? gold : green}`, borderRadius: 8, padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text }}>
                      {productLabel(purchase.product)}{purchase.quantity > 1 ? ` × ${purchase.quantity}` : ''}
                    </p>
                    {purchase.product === 'standard' && (
                      <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginTop: '0.1rem' }}>{purchaseYear} NFL Season</p>
                    )}
                    <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginTop: '0.25rem' }}>
                      Purchased: {new Date(purchase.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ ...bc, fontWeight: 900, fontSize: '1.15rem', color: text }}>
                      {formatAmount(purchase.amountCents, purchase.currency)}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
                      <StatusIcon style={{ width: 12, height: 12, color: status.color }} />
                      <span style={{ ...bc, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: status.color }}>
                        {status.label}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Footer pageName="Purchases" />
    </div>
  );
}

export default function PurchasesPage() {
  return (
    <AuthProvider>
      <AdminGuard>
        <PurchasesContent />
      </AdminGuard>
    </AuthProvider>
  );
}
