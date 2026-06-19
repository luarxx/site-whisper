import { describe, it, expect } from 'vitest';
import { formatBytes, formatDuration, formatUptime, cn } from '@/utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
  });

  it('deduplicates tailwind classes', () => {
    expect(cn('p-2 p-4')).toBe('p-4');
  });
});

describe('formatBytes', () => {
  it('returns 0 B for zero', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('returns 0 B for negative', () => {
    expect(formatBytes(-1)).toBe('0 B');
  });

  it('returns 0 B for NaN', () => {
    expect(formatBytes(NaN)).toBe('0 B');
  });

  it('returns 0 B for Infinity', () => {
    expect(formatBytes(Infinity)).toBe('0 B');
  });

  it('formats bytes correctly', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1048576)).toBe('1.0 MB');
    expect(formatBytes(1073741824)).toBe('1.0 GB');
  });
});

describe('formatDuration', () => {
  it('returns 00:00 for zero', () => {
    expect(formatDuration(0)).toBe('00:00');
  });

  it('formats seconds correctly', () => {
    expect(formatDuration(65)).toBe('01:05');
    expect(formatDuration(3661)).toBe('61:01');
  });

  it('returns 00:00 for negative', () => {
    expect(formatDuration(-10)).toBe('00:00');
  });

  it('returns 00:00 for NaN', () => {
    expect(formatDuration(NaN)).toBe('00:00');
  });
});

describe('formatUptime', () => {
  it('returns — for negative', () => {
    expect(formatUptime(-1)).toBe('—');
  });

  it('returns — for NaN', () => {
    expect(formatUptime(NaN)).toBe('—');
  });

  it('formats seconds', () => {
    expect(formatUptime(30)).toBe('30s');
  });

  it('formats minutes and seconds', () => {
    expect(formatUptime(90)).toBe('1m 30s');
  });

  it('formats hours, minutes, seconds', () => {
    expect(formatUptime(3661)).toBe('1h 1m 1s');
  });

  it('formats days', () => {
    expect(formatUptime(90000)).toBe('1d 1h 0s');
  });
});
