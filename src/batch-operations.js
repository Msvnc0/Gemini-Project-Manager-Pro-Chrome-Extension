/**
 * batch-operations.js — Batch Operations for Multiple Items
 *
 * Allows selecting and operating on multiple chats/projects at once.
 * Operations: Move, Delete, Tag, Export
 */

const GPMBatchOperations = (() => {
  const selectedItems = new Set();
  let selectionMode = false;

  function toggleItem(itemId) {
    if (selectedItems.has(itemId)) {
      selectedItems.delete(itemId);
    } else {
      selectedItems.add(itemId);
    }
    updateSelectionUI();
  }

  function selectAll(itemIds) {
    itemIds.forEach((id) => selectedItems.add(id));
    updateSelectionUI();
  }

  function deselectAll() {
    selectedItems.clear();
    updateSelectionUI();
  }

  function getSelected() {
    return Array.from(selectedItems);
  }

  function hasSelection() {
    return selectedItems.size > 0;
  }

  function getSelectionCount() {
    return selectedItems.size;
  }

  function enterSelectionMode() {
    selectionMode = true;
    document.body.classList.add('gpm-selection-mode');
  }

  function exitSelectionMode() {
    selectionMode = false;
    selectedItems.clear();
    document.body.classList.remove('gpm-selection-mode');
    updateSelectionUI();
  }

  function isSelectionMode() {
    return selectionMode;
  }

  async function moveToFolder(targetProjectId) {
    const chatIds = getSelected();
    if (chatIds.length === 0) return;

    for (const chatId of chatIds) {
      await GPMStorage.assignChat(chatId, targetProjectId);
    }

    deselectAll();
    gpmRenderTree();
  }

  async function deleteSelected() {
    const chatIds = getSelected();
    if (chatIds.length === 0) return;

    for (const chatId of chatIds) {
      await GPMStorage.unassignChat(chatId);
    }

    deselectAll();
    gpmRenderTree();
  }

  function updateSelectionUI() {
    const count = getSelectionCount();
    const event = new CustomEvent('gpm-selection-changed', {
      detail: { count, items: getSelected() },
    });
    document.dispatchEvent(event);
  }

  return {
    toggleItem,
    selectAll,
    deselectAll,
    getSelected,
    hasSelection,
    getSelectionCount,
    enterSelectionMode,
    exitSelectionMode,
    isSelectionMode,
    moveToFolder,
    deleteSelected,
  };
})();
