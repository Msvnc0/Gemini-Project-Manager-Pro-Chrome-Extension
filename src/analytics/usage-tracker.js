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

  async function trackProjectAccess(projectId) {
    const analytics = await getAnalytics();

    if (!analytics.projectAccess[projectId]) {
      analytics.projectAccess[projectId] = {
        count: 0,
        firstAccess: Date.now(),
        lastAccess: null,
      };
    }

    analytics.projectAccess[projectId].count++;
    analytics.projectAccess[projectId].lastAccess = Date.now();

    await saveAnalytics(analytics);
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

  async function getMostUsedProjects(limit = 5) {
    const analytics = await getAnalytics();
    const projects = await GPMStorage.getProjects();

    const sorted = projects
      .map((p) => ({
        ...p,
        accessCount: analytics.projectAccess[p.id]?.count || 0,
      }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit);

    return sorted;
  }

  async function getRecentlyUsedProjects(limit = 5) {
    const analytics = await getAnalytics();
    const projects = await GPMStorage.getProjects();

    const sorted = projects
      .filter((p) => analytics.projectAccess[p.id]?.lastAccess)
      .map((p) => ({
        ...p,
        lastAccess: analytics.projectAccess[p.id].lastAccess,
      }))
      .sort((a, b) => b.lastAccess - a.lastAccess)
      .slice(0, limit);

    return sorted;
  }

  async function getUsageStats() {
    const analytics = await getAnalytics();
    const projects = await GPMStorage.getProjects();

    const totalAccess = Object.values(analytics.projectAccess).reduce((sum, p) => sum + (p.count || 0), 0);

    const activeProjects = Object.keys(analytics.projectAccess).filter((id) =>
      projects.some((p) => p.id === id)
    ).length;

    return {
      totalAccess,
      activeProjects,
      totalProjects: projects.length,
      totalSessions: analytics.totalSessions || 0,
      featureUsage: analytics.featureUsage,
    };
  }

  async function clearAnalytics() {
    await saveAnalytics({
      projectAccess: {},
      featureUsage: {},
      lastSession: null,
      totalSessions: 0,
    });
  }

  return {
    getAnalytics,
    saveAnalytics,
    trackProjectAccess,
    trackFeatureUsage,
    trackSession,
    getMostUsedProjects,
    getRecentlyUsedProjects,
    getUsageStats,
    clearAnalytics,
  };
})();
