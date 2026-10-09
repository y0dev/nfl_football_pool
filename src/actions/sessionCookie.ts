'use server';

import { cookies } from 'next/headers';

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete('sh-session');
}
