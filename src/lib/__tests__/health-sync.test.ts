import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/client', () => ({ supabase: {} }));
vi.mock('@capgo/capacitor-health', () => ({ Health: {} }));

const { stepKcal, STEP_BASELINE } = await import('../health-sync');

describe('stepKcal', () => {
  it('only counts steps above the baseline', () => {
    expect(stepKcal(STEP_BASELINE - 500, 75)).toBe(0);
    expect(stepKcal(STEP_BASELINE + 5000, 75)).toBe(200);
  });

  it('scales with body weight', () => {
    expect(stepKcal(16000, 100)).toBeGreaterThan(stepKcal(16000, 60));
  });
});
