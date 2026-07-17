/**
 * Human-like delay helpers (foundation stub).
 * Prefer condition waits over fixed sleeps for flow control.
 */
export async function humanDelay(minMs: number, maxMs: number): Promise<void> {
  const span = Math.max(0, maxMs - minMs);
  const ms = minMs + Math.floor(Math.random() * (span + 1));
  await new Promise((resolve) => setTimeout(resolve, ms));
}
