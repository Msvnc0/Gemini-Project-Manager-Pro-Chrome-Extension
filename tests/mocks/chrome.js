/**
 * Chrome Extension API Mocks for Vitest
 *
 * Provides mock implementations of:
 *   - chrome.storage.local (get, set, getBytesInUse)
 *   - chrome.runtime (id, getURL, sendMessage, onMessage)
 *   - chrome.tabs (query, sendMessage)
 */

// In-memory storage
let mockStorage = {};
const storageChangeListeners = new Set();

function notifyStorageChange(items, areaName = 'local') {
  const changes = {};
  for (const [key, newValue] of Object.entries(items)) {
    changes[key] = {
      oldValue: mockStorage[key],
      newValue,
    };
  }
  storageChangeListeners.forEach((listener) => listener(changes, areaName));
}

function notifyStorageRemove(keys, areaName = 'local') {
  const changes = {};
  for (const key of keys) {
    changes[key] = {
      oldValue: mockStorage[key],
      newValue: undefined,
    };
  }
  storageChangeListeners.forEach((listener) => listener(changes, areaName));
}

function notifyStorageClear(areaName = 'local') {
  const changes = {};
  for (const [key, oldValue] of Object.entries(mockStorage)) {
    changes[key] = {
      oldValue,
      newValue: undefined,
    };
  }
  storageChangeListeners.forEach((listener) => listener(changes, areaName));
}

function cloneValue(value) {
  return value !== undefined ? JSON.parse(JSON.stringify(value)) : undefined;
}

function setStorageRaw(items) {
  Object.assign(mockStorage, JSON.parse(JSON.stringify(items)));
}

function getStorageSnapshot() {
  return cloneValue(mockStorage);
}

function getStorageValue(key) {
  return cloneValue(mockStorage[key]);
}

function removeStorageKeys(keys) {
  keys.forEach((k) => delete mockStorage[k]);
}

function clearStorageRaw() {
  mockStorage = {};
}

function resetStorageChangeListeners() {
  storageChangeListeners.clear();
}

function resetRuntimeMocks() {
  chromeMock.runtime.sendMessage.mockClear();
}

function resetTabMocks() {
  chromeMock.tabs.query.mockClear();
  chromeMock.tabs.sendMessage.mockClear();
}

function resetStorageMocks() {
  chromeMock.storage.local.get.mockClear();
  chromeMock.storage.local.set.mockClear();
  chromeMock.storage.local.remove.mockClear();
  chromeMock.storage.local.clear.mockClear();
}

function resetStorageArea() {
  clearStorageRaw();
  resetStorageMocks();
}

function setStorageArea(data) {
  mockStorage = { ...data };
}

function getStorageArea() {
  return { ...mockStorage };
}

function emitSyncStorageChange(items) {
  storageChangeListeners.forEach((listener) => listener(items, 'sync'));
}

function emitLocalStorageChange(items) {
  storageChangeListeners.forEach((listener) => listener(items, 'local'));
}

function addStorageChangeListener(listener) {
  storageChangeListeners.add(listener);
}

function removeStorageChangeListener(listener) {
  storageChangeListeners.delete(listener);
}

function hasStorageChangeListener(listener) {
  return storageChangeListeners.has(listener);
}

function notifyLocalSet(items) {
  notifyStorageChange(items, 'local');
}

function notifyLocalRemove(keys) {
  notifyStorageRemove(keys, 'local');
}

function notifyLocalClear() {
  notifyStorageClear('local');
}

function localGet(keys) {
  const clone = cloneValue;
  return new Promise((resolve) => {
    if (typeof keys === 'string') {
      resolve({ [keys]: clone(getStorageValue(keys)) });
    } else if (Array.isArray(keys)) {
      const result = {};
      keys.forEach((k) => {
        if (mockStorage[k] !== undefined) result[k] = clone(getStorageValue(k));
      });
      resolve(result);
    } else if (keys === null || keys === undefined) {
      resolve(getStorageSnapshot());
    } else {
      const result = {};
      for (const [k, defaultVal] of Object.entries(keys)) {
        result[k] = mockStorage[k] !== undefined ? clone(getStorageValue(k)) : defaultVal;
      }
      resolve(result);
    }
  });
}

function localSet(items) {
  return new Promise((resolve) => {
    const clonedItems = JSON.parse(JSON.stringify(items));
    notifyLocalSet(clonedItems);
    setStorageRaw(clonedItems);
    resolve();
  });
}

function localRemove(keys) {
  return new Promise((resolve) => {
    const keysArray = Array.isArray(keys) ? keys : [keys];
    notifyLocalRemove(keysArray);
    removeStorageKeys(keysArray);
    resolve();
  });
}

function localClear() {
  return new Promise((resolve) => {
    notifyLocalClear();
    clearStorageRaw();
    resolve();
  });
}

function getBytesInUse() {
  return new Promise((resolve) => {
    const bytes = JSON.stringify(mockStorage).length;
    resolve(bytes);
  });
}

let _mockLockGranted = true;

function runtimeSendMessage(msg) {
  if (msg && msg.type === 'GPM_ACQUIRE_LOCK') return Promise.resolve({ granted: _mockLockGranted });
  if (msg && msg.type === 'GPM_RELEASE_LOCK') return Promise.resolve({ ok: true });
  if (msg && msg.type === 'GPM_STORAGE_UPDATED') return Promise.resolve({ ok: true });
  return Promise.resolve();
}

function tabsQuery() {
  return Promise.resolve([]);
}

function tabsSendMessage() {
  return Promise.resolve({ ok: true });
}

function syncGet() {
  return Promise.resolve({});
}

function syncSet() {
  return Promise.resolve();
}

function syncRemove() {
  return Promise.resolve();
}

function syncClear() {
  return Promise.resolve();
}

function syncBytesInUse() {
  return Promise.resolve(0);
}

function resetAllMocks() {
  resetStorageArea();
  resetRuntimeMocks();
  resetTabMocks();
  resetStorageChangeListeners();
  _mockLockGranted = true;
}

function installChromeMock() {
  globalThis.chrome = chromeMock;
  globalThis.browser = chromeMock;
}

function setMockStorageSnapshot(data) {
  setStorageArea(data);
}

function getMockStorageSnapshot() {
  return getStorageArea();
}

function triggerLocalChange(changes) {
  emitLocalStorageChange(changes);
}

function triggerSyncChange(changes) {
  emitSyncStorageChange(changes);
}

function runtimeGetURL(path) {
  return `chrome-extension://mock-extension-id/${path}`;
}

function hasRuntimeListener() {
  return false;
}

function installStorageOnChangedApi(target) {
  target.onChanged = {
    addListener: vi.fn(addStorageChangeListener),
    removeListener: vi.fn(removeStorageChangeListener),
    hasListener: vi.fn(hasStorageChangeListener),
  };
}

function installStorageAreaApis(target) {
  target.local = {
    get: vi.fn(localGet),
    set: vi.fn(localSet),
    remove: vi.fn(localRemove),
    clear: vi.fn(localClear),
    getBytesInUse: vi.fn(getBytesInUse),
  };
  target.sync = {
    get: vi.fn(syncGet),
    set: vi.fn(syncSet),
    remove: vi.fn(syncRemove),
    clear: vi.fn(syncClear),
    getBytesInUse: vi.fn(syncBytesInUse),
  };
}

function installRuntimeApis(target) {
  target.id = 'mock-extension-id';
  target.getURL = vi.fn(runtimeGetURL);
  target.getManifest = vi.fn(() => ({ version: '1.2.6' }));
  target.sendMessage = vi.fn(runtimeSendMessage);
  target.onMessage = {
    addListener: vi.fn(),
    removeListener: vi.fn(),
    hasListener: vi.fn(hasRuntimeListener),
  };
  target.onInstalled = {
    addListener: vi.fn(),
  };
}

function installTabsApis(target) {
  target.query = vi.fn(tabsQuery);
  target.sendMessage = vi.fn(tabsSendMessage);
}

const chromeMock = {
  storage: {},
  runtime: {},
  tabs: {},
};

installStorageAreaApis(chromeMock.storage);
installStorageOnChangedApi(chromeMock.storage);
installRuntimeApis(chromeMock.runtime);
installTabsApis(chromeMock.tabs);

installChromeMock();

export function resetMockStorage() {
  resetAllMocks();
}

export function setMockStorage(data) {
  setMockStorageSnapshot(data);
}

export function getMockStorage() {
  return getMockStorageSnapshot();
}

export function triggerStorageOnChanged(changes, areaName = 'local') {
  storageChangeListeners.forEach((listener) => listener(changes, areaName));
}

export function setMockLockGranted(granted) {
  _mockLockGranted = granted;
}

export { chromeMock };


