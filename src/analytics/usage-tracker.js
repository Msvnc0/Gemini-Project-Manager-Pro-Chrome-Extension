/**
 * usage-tracker.js — Usage Analytics for Projects and Features
 *
 * Tracks which projects are accessed most frequently.
 * Provides insights for sorting and recommendations.
 */

const GPMUsageTracker = (() => {
  const ANALYTICS_KEY = 'gpm_analytics';

  async function getAnalytics() {
    const { [ANALYTICS_KEY]: analytics } = await chrome.storage.local.get(ANALYTICS_KEY);
    return (
      analytics || {
        projectAccess: {},
        featureUsage: {},
        lastSession: null,
        totalSessions: 0,
      }
    );
  }

  async function saveAnalytics(analytics) {
    await chrome.storage.local.set({ [ANALYTICS_KEY]: analytics });
  }

  async function trackFeatureUsage(featureName) {
    const analytics = await getAnalytics();

    if (!analytics.featureUsage[featureName]) {
      analytics.featureUsage[featureName] = { count: 0, lastUsed: null };
    }

    analytics.featureUsage[featureName].count++;
    analytics.featureUsage[featureName].lastUsed = Date.now();

    await saveAnalytics(analytics);
  }

  async function trackSession() {
    const analytics = await getAnalytics();
    analytics.lastSession = Date.now();
    analytics.totalSessions = (analytics.totalSessions || 0) + 1;
    await saveAnalytics(analytics);
  }

  return {
    getAnalytics,
    saveAnalytics,
    trackFeatureUsage,
    trackSession,
  };
})();
