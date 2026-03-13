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

const chromeMock = {
  storage: {
    local: {
      get: vi.fn((keys) => {
        // Deep-clone values to match real chrome.storage behavior (structured clone)
        const clone = (v) => (v !== undefined ? JSON.parse(JSON.stringify(v)) : undefined);
        return new Promise((resolve) => {
          if (typeof keys === 'string') {
            resolve({ [keys]: clone(mockStorage[keys]) });
          } else if (Array.isArray(keys)) {
            const result = {};
            keys.forEach((k) => {
              if (mockStorage[k] !== undefined) result[k] = clone(mockStorage[k]);
            });
            resolve(result);
          } else if (keys === null || keys === undefined) {
            resolve(clone(mockStorage));
          } else {
            // Object with defaults
            const result = {};
            for (const [k, defaultVal] of Object.entries(keys)) {
              result[k] = mockStorage[k] !== undefined ? clone(mockStorage[k]) : defaultVal;
            }
            resolve(result);
          }
        });
      }),
      set: vi.fn((items) => {
        return new Promise((resolve) => {
          // Deep-clone on write to prevent external mutation of stored data
          Object.assign(mockStorage, JSON.parse(JSON.stringify(items)));
          resolve();
        });
      }),
      remove: vi.fn((keys) => {
        return new Promise((resolve) => {
          const keysArray = Array.isArray(keys) ? keys : [keys];
          keysArray.forEach((k) => delete mockStorage[k]);
          resolve();
        });
      }),
      clear: vi.fn(() => {
        return new Promise((resolve) => {
          mockStorage = {};
          resolve();
        });
      }),
      getBytesInUse: vi.fn(() => {
        return new Promise((resolve) => {
          const bytes = JSON.stringify(mockStorage).length;
          resolve(bytes);
        });
      }),
    },
  },
  runtime: {
    id: 'mock-extension-id',
    getURL: vi.fn((path) => `chrome-extension://mock-extension-id/${path}`),
    sendMessage: vi.fn(() => Promise.resolve()),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn(() => false),
    },
    onInstalled: {
      addListener: vi.fn(),
    },
  },
  tabs: {
    query: vi.fn(() => Promise.resolve([])),
    sendMessage: vi.fn(() => Promise.resolve()),
  },
};

// Install global chrome mock
globalThis.chrome = chromeMock;

// Export helpers for tests
export function resetMockStorage() {
  mockStorage = {};
  // Reset all mock call counts
  chromeMock.storage.local.get.mockClear();
  chromeMock.storage.local.set.mockClear();
  chromeMock.storage.local.remove.mockClear();
  chromeMock.storage.local.clear.mockClear();
}

export function setMockStorage(data) {
  mockStorage = { ...data };
}

export function getMockStorage() {
  return { ...mockStorage };
}
