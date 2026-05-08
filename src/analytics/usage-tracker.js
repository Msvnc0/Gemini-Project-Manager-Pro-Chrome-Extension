/**
 * usage-tracker.js — Usage Analytics for Projects and Features
 *
 * Tracks which projects are accessed most frequently.
 * Provides insights for sorting and recommendations.
 */

const GPMUsageTracker = (() => {
  const ANALYTICS_KEY = 'gpm_analytics';
  let _writeQueue = Promise.resolve();

  function _withQueue(fn) {
    const next = _writeQueue.then(fn).catch((e) => {
      if (typeof gpmError === 'function') gpmError('[GPM Analytics] Queue error:', e);
    });
    _writeQueue = next;
    return next;
  }

  async function getAnalytics() {
    try {
      const { [ANALYTICS_KEY]: analytics } = await chrome.storage.local.get(ANALYTICS_KEY);
      return (
        analytics || {
          projectAccess: {},
          featureUsage: {},
          lastSession: null,
          totalSessions: 0,
        }
      );
    } catch (e) {
      return {
        projectAccess: {},
        featureUsage: {},
        lastSession: null,
        totalSessions: 0,
      };
    }
  }

  async function saveAnalytics(analytics) {
    try {
      await chrome.storage.local.set({ [ANALYTICS_KEY]: analytics });
    } catch (_) {}
  }

  function trackFeatureUsage(featureName) {
    return _withQueue(async () => {
      const analytics = await getAnalytics();

      if (!analytics.featureUsage[featureName]) {
        analytics.featureUsage[featureName] = { count: 0, lastUsed: null };
      }

      analytics.featureUsage[featureName].count++;
      analytics.featureUsage[featureName].lastUsed = Date.now();

      await saveAnalytics(analytics);
    });
  }

  function trackSession() {
    return _withQueue(async () => {
      const analytics = await getAnalytics();
      analytics.lastSession = Date.now();
      analytics.totalSessions = (analytics.totalSessions || 0) + 1;
      await saveAnalytics(analytics);
    });
  }

  return {
    getAnalytics,
    saveAnalytics,
    trackFeatureUsage,
    trackSession,
  };
})();
