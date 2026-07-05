import { notFound } from 'next/navigation';
import { isPricingVisible } from '@/lib/billing';
import PricingContent from './pricing-content';

// Pricing stays hidden (404) until billing goes live — controlled by
// NEXT_PUBLIC_ENABLE_PRICING (defaults to visible in dev, hidden in prod).
export default function PricingPage() {
  if (!isPricingVisible()) notFound();
  return <PricingContent />;
}
