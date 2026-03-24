/**
 * favorites-manager.js — Favorites/Star System for Projects
 *
 * Allows marking projects as favorites for quick access.
 * Favorites appear at the top of the sidebar.
 */

const GPMFavoritesManager = (() => {
  const FAVORITES_KEY = 'gpm_favorites';

  async function getFavorites() {
    const { [FAVORITES_KEY]: favorites } = await chrome.storage.local.get(FAVORITES_KEY);
    return favorites || [];
  }

  async function saveFavorites(favorites) {
    await chrome.storage.local.set({ [FAVORITES_KEY]: favorites });
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

  async function addFavorite(projectId) {
    const favorites = await getFavorites();
    if (!favorites.includes(projectId)) {
      favorites.push(projectId);
      await saveFavorites(favorites);
    }
  }

  async function removeFavorite(projectId) {
    const favorites = await getFavorites();
    const filtered = favorites.filter((id) => id !== projectId);
    await saveFavorites(filtered);
  }

  async function getFavoriteProjects() {
    const favorites = await getFavorites();
    const projects = await GPMStorage.getProjects();
    return projects.filter((p) => favorites.includes(p.id));
  }

  return {
    getFavorites,
    saveFavorites,
    toggleFavorite,
    isFavorite,
    addFavorite,
    removeFavorite,
    getFavoriteProjects,
  };
})();
