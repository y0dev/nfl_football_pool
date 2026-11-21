// Branch-protection probe (throwaway PR, never merged): a deliberate Deno
// type error so only the "Edge Functions (Deno check)" job fails.
export const probe: number = 'not a number'
