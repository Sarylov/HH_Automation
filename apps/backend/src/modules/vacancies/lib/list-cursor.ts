export type CreatedAtCursor = {
  at: Date;
  id: string;
};

export function encodeCreatedAtCursor(at: Date, id: string): string {
  const payload = JSON.stringify({ t: at.toISOString(), id });
  return Buffer.from(payload, 'utf8').toString('base64url');
}

export function decodeCreatedAtCursor(cursor: string): CreatedAtCursor | null {
  try {
    const raw = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as { t?: unknown; id?: unknown };
    if (typeof raw.t !== 'string' || typeof raw.id !== 'string') {
      return null;
    }
    const at = new Date(raw.t);
    if (Number.isNaN(at.getTime()) || raw.id.length === 0) {
      return null;
    }
    return { at, id: raw.id };
  } catch {
    return null;
  }
}
