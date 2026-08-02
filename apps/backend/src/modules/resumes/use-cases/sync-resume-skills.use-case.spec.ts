import type { SkillsRankingSkill } from '@prisma/client';
import {
  isSkillBlacklisted,
  mergeSkillsByUnique,
  normalizeBlacklist,
  pickTargetSkills,
} from './sync-resume-skills.use-case';

describe('skill blacklist helpers', () => {
  it('normalizes and dedupes tokens', () => {
    expect(normalizeBlacklist([' Angular ', 'angular', 'Vue'])).toEqual([
      'angular',
      'vue',
    ]);
  });

  it('defaults are angular and c++ when omitted', () => {
    // Mirrors DEFAULT_BLACKLIST used when request omits blacklist
    const bl = normalizeBlacklist(['angular', 'c++']);
    expect(isSkillBlacklisted('c++', bl)).toBe(true);
    expect(isSkillBlacklisted('C++', bl)).toBe(true);
    expect(isSkillBlacklisted('typescript', bl)).toBe(false);
  });

  it('picks topN after skipping blacklisted', () => {
    const ranked = [
      { unique: 'typescript', name: 'TypeScript', counts: 10 },
      { unique: 'angular', name: 'Angular', counts: 9 },
      { unique: 'react', name: 'React', counts: 8 },
      { unique: 'angularjs', name: 'AngularJS', counts: 7 },
      { unique: 'vue', name: 'Vue', counts: 6 },
    ].map((s) => ({
      id: s.unique,
      runId: 'r',
      query: 'merged',
      ...s,
    }));

    const { desired, skipped } = pickTargetSkills(
      ranked,
      3,
      normalizeBlacklist(['angular']),
    );

    expect(desired.map((s) => s.unique)).toEqual([
      'typescript',
      'react',
      'vue',
    ]);
    expect(skipped.map((s) => s.unique)).toEqual(['angular', 'angularjs']);
  });

  it('merges legacy per-profile rows by unique summing counts', () => {
    const rows = [
      {
        id: '1',
        runId: 'r',
        query: 'frontend remote',
        name: 'React',
        unique: 'react',
        counts: 12,
      },
      {
        id: '2',
        runId: 'r',
        query: 'frontend спб',
        name: 'React',
        unique: 'react',
        counts: 10,
      },
      {
        id: '3',
        runId: 'r',
        query: 'frontend remote',
        name: 'Vue',
        unique: 'vue',
        counts: 5,
      },
    ] as SkillsRankingSkill[];

    const merged = mergeSkillsByUnique(rows);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ unique: 'react', counts: 22 });
    expect(merged[1]).toMatchObject({ unique: 'vue', counts: 5 });
  });
});
