import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetMockStorage } from '../mocks/chrome.js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const code = readFileSync(resolve('src/analytics/usage-tracker.js'), 'utf-8');
const patched = code.replace(/^const GPMUsageTracker\s*=/m, 'globalThis.GPMUsageTracker =');
new Function(patched)();

const mockGPMStorage = {
  getProjects: vi.fn(),
  getChatMap: vi.fn(),
};

beforeEach(() => {
  resetMockStorage();
  globalThis.GPMStorage = mockGPMStorage;
  mockGPMStorage.getProjects.mockResolvedValue([]);
  mockGPMStorage.getChatMap.mockResolvedValue({});
});

describe('GPMUsageTracker', () => {
  it('returns default analytics when none saved', async () => {
    const analytics = await globalThis.GPMUsageTracker.getAnalytics();
    expect(analytics).toBeDefined();
    expect(analytics.projectAccess).toBeDefined();
    expect(analytics.featureUsage).toBeDefined();
  });

  it('saves and retrieves analytics', async () => {
    const data = { projectAccess: { p1: 5 }, featureUsage: {}, totalSessions: 3 };
    await globalThis.GPMUsageTracker.saveAnalytics(data);
    const analytics = await globalThis.GPMUsageTracker.getAnalytics();
    expect(analytics.projectAccess.p1).toBe(5);
    expect(analytics.totalSessions).toBe(3);
  });

  it('tracks feature usage', async () => {
    await globalThis.GPMUsageTracker.trackFeatureUsage('sidebar');
    const analytics = await globalThis.GPMUsageTracker.getAnalytics();
    expect(analytics.featureUsage.sidebar).toBeDefined();
    expect(analytics.featureUsage.sidebar.count).toBe(1);
  });

  it('increments feature usage on repeated calls', async () => {
    await globalThis.GPMUsageTracker.trackFeatureUsage('sidebar');
    await globalThis.GPMUsageTracker.trackFeatureUsage('sidebar');
    const analytics = await globalThis.GPMUsageTracker.getAnalytics();
    expect(analytics.featureUsage.sidebar.count).toBe(2);
  });

  it('tracks sessions', async () => {
    await globalThis.GPMUsageTracker.trackSession();
    const analytics = await globalThis.GPMUsageTracker.getAnalytics();
    expect(analytics.totalSessions).toBe(1);
    expect(analytics.lastSession).toBeDefined();
  });

  it('increments session count across calls', async () => {
    await globalThis.GPMUsageTracker.trackSession();
    await globalThis.GPMUsageTracker.trackSession();
    const analytics = await globalThis.GPMUsageTracker.getAnalytics();
    expect(analytics.totalSessions).toBe(2);
  });
});
