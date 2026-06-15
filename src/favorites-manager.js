/**
 * favorites-manager.js — Favorites/Star System for Projects
 *
 * Allows marking projects as favorites for quick access.
 * Favorites appear at the top of the sidebar.
 */

const GPMFavoritesManager = (() => {
  const FAVORITES_KEY = 'gpm_favorites';

  async function getFavorites() {
    try {
      const result = await browser.storage.local.get(FAVORITES_KEY);
      return result[FAVORITES_KEY] || [];
    } catch (e) {
      return [];
    }
  }

  async function saveFavorites(favorites) {
    try {
      await browser.storage.local.set({ [FAVORITES_KEY]: favorites });
    } catch (e) {
      if (typeof gpmError === 'function') gpmError('[GPM Favorites] Save failed:', e);
    }
  }

  async function toggleFavorite(projectId) {
    const favorites = await getFavorites();
    const idx = favorites.indexOf(projectId);

    if (idx > -1) {
      favorites.splice(idx, 1);
    } else {
      favorites.push(projectId);
    }

    await saveFavorites(favorites);
    return idx === -1;
  }

  async function isFavorite(projectId) {
    const favorites = await getFavorites();
    return favorites.includes(projectId);
  }

  return {
    toggleFavorite,
    isFavorite,
  };
})();
