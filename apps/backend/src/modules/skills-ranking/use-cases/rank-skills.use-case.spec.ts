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
