import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import '../mocks/chrome.js';

const mockGpmRenderTree = vi.fn();
const mockGpmLog = vi.fn();
const mockGpmError = vi.fn();

const mockGPMStorage = {
  getProjects: vi.fn(),
  saveProjects: vi.fn(),
  getChatMap: vi.fn(),
  saveChatMap: vi.fn(),
  assignChat: vi.fn(),
  setChatAlias: vi.fn(),
  createTag: vi.fn(),
  createProject: vi.fn(),
  deleteProject: vi.fn(),
  updateProject: vi.fn(),
};

beforeEach(() => {
  globalThis.GPMStorage = mockGPMStorage;
  globalThis.gpmRenderTree = mockGpmRenderTree;
  globalThis.gpmLog = mockGpmLog;
  globalThis.gpmError = mockGpmError;
  mockGPMStorage.getProjects.mockResolvedValue([]);
  mockGPMStorage.getChatMap.mockResolvedValue({});
  mockGPMStorage.assignChat.mockResolvedValue(undefined);
  mockGPMStorage.saveProjects.mockResolvedValue(undefined);
  mockGPMStorage.saveChatMap.mockResolvedValue(undefined);
  vi.clearAllMocks();
});

const undoRedoCode = readFileSync(resolve('src/history/undo-redo.js'), 'utf-8');
const patchedUndoRedo = undoRedoCode.replace(/^const GPMHistory\s*=/m, 'globalThis.GPMHistory =');
new Function(patchedUndoRedo)();
const GPMHistory = globalThis.GPMHistory;

describe('GPMHistory createAction', () => {
  it('creates move_chat action and pushes to stack', () => {
    const action = GPMHistory.createAction('move_chat', {
      chatId: 'c1',
      fromProjectId: 'p1',
      toProjectId: 'p2',
    });
    expect(action).not.toBeNull();
    expect(action.type).toBe('move_chat');
    GPMHistory.push(action);
  });

  it('creates bulk_move action', () => {
    const action = GPMHistory.createAction('bulk_move', {
      chatIds: ['c1', 'c2'],
      fromProjectIds: { c1: 'p1', c2: 'p1' },
      toProjectId: 'p2',
    });
    expect(action).not.toBeNull();
    expect(action.type).toBe('bulk_move');
    expect(action.chatIds).toEqual(['c1', 'c2']);
  });

  it('returns null for unknown type', () => {
    const action = GPMHistory.createAction('unknown_type', {});
    expect(action).toBeNull();
  });
});

describe('GPMHistory undo/redo', () => {
  it('undoes and redoes a move_chat action', async () => {
    const action = GPMHistory.createAction('move_chat', {
      chatId: 'c1',
      fromProjectId: 'p1',
      toProjectId: 'p2',
    });
    GPMHistory.push(action);

    const undoResult = await GPMHistory.undo();
    expect(undoResult).toBe(true);
    expect(mockGPMStorage.assignChat).toHaveBeenCalledWith('c1', 'p1');

    const redoResult = await GPMHistory.redo();
    expect(redoResult).toBe(true);
    expect(mockGPMStorage.assignChat).toHaveBeenCalledWith('c1', 'p2');
  });
});
