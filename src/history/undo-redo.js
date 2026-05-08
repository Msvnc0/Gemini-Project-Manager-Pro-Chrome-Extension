/**
 * undo-redo.js — Undo/Redo System for Data Operations
 *
 * Maintains a history of operations that can be undone/redone.
 * Supports: move, delete, create, rename, assign operations.
 */

const GPMHistory = (() => {
  const MAX_HISTORY = 50;
  const undoStack = [];
  const redoStack = [];

  function push(action) {
    undoStack.push(action);

    if (undoStack.length > MAX_HISTORY) {
      undoStack.shift();
    }

    redoStack.length = 0;

    gpmLog('[GPM History] Action pushed:', action.type, 'Undo stack:', undoStack.length);
  }

  async function undo() {
    const action = undoStack.pop();
    if (!action) return false;

    try {
      await action.undo();

      redoStack.push(action);

      gpmLog('[GPM History] Undone:', action.type);
      return true;
    } catch (e) {
      gpmError('[GPM History] Undo failed:', e);
      undoStack.push(action);
      return false;
    }
  }

  async function redo() {
    const action = redoStack.pop();
    if (!action) return false;

    try {
      await action.redo();

      undoStack.push(action);

      gpmLog('[GPM History] Redone:', action.type);
      return true;
    } catch (e) {
      gpmError('[GPM History] Redo failed:', e);
      redoStack.push(action);
      return false;
    }
  }

  function canUndo() {
    return undoStack.length > 0;
  }

  function canRedo() {
    return redoStack.length > 0;
  }

  function createAction(type, data) {
    switch (type) {
      case 'move_chat':
        return {
          type,
          chatId: data.chatId,
          fromProjectId: data.fromProjectId,
          toProjectId: data.toProjectId,
          undo: async () => {
            await GPMStorage.assignChat(data.chatId, data.fromProjectId);
            gpmRenderTree();
          },
          redo: async () => {
            await GPMStorage.assignChat(data.chatId, data.toProjectId);
            gpmRenderTree();
          },
        };

      case 'delete_project':
        return {
          type,
          projectData: data.projectData,
          chatMapData: data.chatMapData,
          capturedProjects: data.capturedProjects || [data.projectData],
          undo: async () => {
            const projects = await GPMStorage.getProjects();

            for (const p of data.capturedProjects || [data.projectData]) {
              if (!projects.find((existing) => existing.id === p.id)) {
                projects.push(p);
              }
            }

            if (data.projectData.parentId) {
              const parent = projects.find((p) => p.id === data.projectData.parentId);
              if (parent && !parent.children.includes(data.projectData.id)) {
                parent.children.push(data.projectData.id);
              }
            }

            await GPMStorage.saveProjects(projects);

            const chatMap = await GPMStorage.getChatMap();
            Object.assign(chatMap, data.chatMapData);
            await GPMStorage.saveChatMap(chatMap);

            gpmRenderTree();
          },
          redo: async () => {
            await GPMStorage.deleteProject(data.projectData.id);
            gpmRenderTree();
          },
        };

      case 'create_project':
        return {
          type,
          projectId: data.projectId,
          projectData: data.projectData,
          undo: async () => {
            await GPMStorage.deleteProject(data.projectId);
            gpmRenderTree();
          },
          redo: async () => {
            const projects = await GPMStorage.getProjects();
            projects.push(data.projectData);
            if (data.projectData.parentId) {
              const parent = projects.find((p) => p.id === data.projectData.parentId);
              if (parent && !parent.children.includes(data.projectData.id)) {
                parent.children.push(data.projectData.id);
              }
            }
            await GPMStorage.saveProjects(projects);
            gpmRenderTree();
          },
        };

      case 'rename_project':
        return {
          type,
          projectId: data.projectId,
          oldName: data.oldName,
          newName: data.newName,
          undo: async () => {
            await GPMStorage.updateProject(data.projectId, { name: data.oldName });
            gpmRenderTree();
          },
          redo: async () => {
            await GPMStorage.updateProject(data.projectId, { name: data.newName });
            gpmRenderTree();
          },
        };

      case 'rename_chat':
        return {
          type,
          chatId: data.chatId,
          oldAlias: data.oldAlias,
          newAlias: data.newAlias,
          undo: async () => {
            await GPMStorage.setChatAlias(data.chatId, data.oldAlias);
            gpmRenderTree();
          },
          redo: async () => {
            await GPMStorage.setChatAlias(data.chatId, data.newAlias);
            gpmRenderTree();
          },
        };

      case 'bulk_move':
        return {
          type,
          chatIds: data.chatIds,
          fromProjectIds: data.fromProjectIds,
          toProjectId: data.toProjectId,
          undo: async () => {
            for (const chatId of data.chatIds) {
              await GPMStorage.assignChat(chatId, data.fromProjectIds[chatId]);
            }
            gpmRenderTree();
          },
          redo: async () => {
            for (const chatId of data.chatIds) {
              await GPMStorage.assignChat(chatId, data.toProjectId);
            }
            gpmRenderTree();
          },
        };

      default:
        return null;
    }
  }

  return {
    push,
    undo,
    redo,
    canUndo,
    canRedo,
    createAction,
  };
})();
