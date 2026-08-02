import {
  aggregateMergedSkills,
  MERGED_SKILLS_QUERY,
} from './rank-skills.use-case';

describe('skill unique key rules', () => {
  function uniqueOf(name: string): string {
    return name.replace(/\s+/g, ' ').trim().toLowerCase();
  }

  it('collapses case but keeps distinct formulations', () => {
    expect(uniqueOf('React')).toBe(uniqueOf('react'));
    expect(uniqueOf('js')).not.toBe(uniqueOf('javascript'));
    expect(uniqueOf('vue')).not.toBe(uniqueOf('vue.js'));
  });
});

describe('aggregateMergedSkills', () => {
  it('sums skills across profiles but counts each vacancy once', () => {
    const seen = new Set<string>();
    const pool = new Map<string, number>();

    const fold = (
      items: { externalId: string; skills: string[] }[],
    ): number => {
      const { skills, duplicatesSkipped } = aggregateMergedSkills(items, seen);
      for (const skill of skills) {
        pool.set(skill.unique, (pool.get(skill.unique) ?? 0) + skill.counts);
        expect(skill.query).toBe(MERGED_SKILLS_QUERY);
      }
      return duplicatesSkipped;
    };

    expect(
      fold([
        { externalId: 'v1', skills: ['React', 'TypeScript'] },
        { externalId: 'v2', skills: ['React'] },
      ]),
    ).toBe(0);

    expect(
      fold([
        { externalId: 'v1', skills: ['React', 'Vue'] }, // same vacancy as first profile
        { externalId: 'v3', skills: ['React'] },
      ]),
    ).toBe(1);

    expect(pool.get('react')).toBe(3); // v1 + v2 + v3, not 4
    expect(pool.get('typescript')).toBe(1);
    expect(pool.get('vue')).toBeUndefined(); // only on duplicate v1
    expect(seen.size).toBe(3);
  });
});
