import { Suspense } from 'react';
import { Footer } from '@/components/layout/Footer';
import { PoolPicksContent } from '@/components/picks/pool-picks-content';

export default function PoolPicksPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: 'oklch(13% 0.025 255)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div style={{ background: 'oklch(20% 0.03 255)', border: '1px solid oklch(26% 0.03 255)', borderRadius: 10, padding: '2rem', width: '100%', maxWidth: 400, textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '3px solid oklch(46% 0.14 155)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 0.75rem' }} />
          <p style={{ fontFamily: 'var(--font-barlow)', color: 'oklch(72% 0.015 255)', fontSize: '0.9rem' }}>Loading…</p>
        </div>
      </div>
    }>
      <PoolPicksContent />
      <Footer pageName='Pick Selection' />
    </Suspense>
  );
}
