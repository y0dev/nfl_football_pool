'use client';

import { useSyncExternalStore } from 'react';
import { getAddonPoolPrice, getStandardPrice, type PriceInfo } from './pricing';

const MINUTE = 60_000;

function subscribe(onChange: () => void) {
  const timer = setInterval(onChange, MINUTE);
  return () => clearInterval(timer);
}
const currentMinute = () => Math.floor(Date.now() / MINUTE);
const noMinuteOnServer = () => null;

/**
 * Current Standard / add-on prices on the viewer's clock, re-checked every
 * minute so a sale starts or ends without a reload. Null during server
 * rendering: a page prerendered at build time would otherwise show (and
 * hydrate against) whichever sale was running at build time. Checkout
 * re-prices on the server, so the viewer's clock never decides the charge.
 */
export function useSalePrices(): { standard: PriceInfo | null; addon: PriceInfo | null } {
  const minute = useSyncExternalStore(subscribe, currentMinute, noMinuteOnServer);
  if (minute === null) return { standard: null, addon: null };
  const now = new Date(minute * MINUTE);
  return { standard: getStandardPrice(now), addon: getAddonPoolPrice(now) };
}
