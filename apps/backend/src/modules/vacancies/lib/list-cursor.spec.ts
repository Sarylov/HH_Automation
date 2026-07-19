import {
  decodeCreatedAtCursor,
  encodeCreatedAtCursor,
} from './list-cursor';

describe('list-cursor', () => {
  it('round-trips createdAt + id', () => {
    const at = new Date('2026-07-19T12:00:00.000Z');
    const id = '11111111-1111-1111-1111-111111111111';
    const encoded = encodeCreatedAtCursor(at, id);
    expect(decodeCreatedAtCursor(encoded)).toEqual({ at, id });
  });

  it('returns null for garbage', () => {
    expect(decodeCreatedAtCursor('not-valid')).toBeNull();
  });
});
