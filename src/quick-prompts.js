/**
 * quick-prompts.js — Quick Prompts Panel, Trigger Button, Text Insertion
 *
 * Handles:
 *   - gpmInjectQuickPromptTrigger() — Inject ⚡ button into toolbar
 *   - gpmObserveQuickPromptButton() — Monitor and re-inject button if removed
 *   - gpmToggleQuickPrompts()       — Open/close quick prompts panel
 *   - gpmInsertPromptText()         — Insert prompt text into input area
 *
 * Dependencies (globals from earlier scripts):
 *   - GPM_CONFIG, GPM_STATE, gpmLog, gpmWarn, gpmError, gpmIsContextValid (config.js)
 *   - GPM_SELECTORS (selectors.js)
 *   - GPMStorage (storage.js)
 *   - GPMUI (ui_elements.js)
 *   - t() (i18n.js)
 */

// ══════════════════════════════════════
//  QUICK PROMPT TRIGGER BUTTON
// ══════════════════════════════════════

/**
 * Create the ⚡ Quick Prompt button element.
 * Separated from injection logic for reuse across strategies.
 * @returns {HTMLButtonElement}
 */
function _gpmCreateQPButton() {
  const btn = document.createElement('button');
  btn.id = 'gpm-qp-trigger';
  btn.textContent = '⚡';
  btn.title = t('quickPrompts');
  btn.type = 'button';
  btn.style.cssText =
    'background:none;border:none;font-size:18px;cursor:pointer;padding:4px 8px;border-radius:50%;color:inherit;opacity:0.6;transition:opacity 150ms;display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;flex-shrink:0;vertical-align:middle;';
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    gpmToggleQuickPrompts();
  });
  return btn;
}

/**
 * Find the toolbar container using structural heuristics.
 * Does NOT depend on CSS class names — uses DOM structure relationships.
 *
 * Strategy order:
 *   1. Known CSS class (fastest when available)
 *   2. Custom element name (toolbox-drawer)
 *   3. Structural search: input area → walk up → find button group container
 *
 * @returns {{ container: Element, insertRef: Element|null, method: string }|null}
 */
function _gpmFindToolbarSlot() {
  // Strategy 1: Known CSS class (may break on Gemini updates)
  const leadingActions = document.querySelector(GPM_SELECTORS.leadingActions);
  if (leadingActions) {
    const toolbox = leadingActions.querySelector(GPM_SELECTORS.toolboxDrawer);
    if (toolbox) {
      return { container: leadingActions, insertRef: toolbox.nextSibling, method: 'leading-actions + toolbox' };
    }
    return { container: leadingActions, insertRef: null, method: 'leading-actions append' };
  }

  // Strategy 2: Find toolbox-drawer custom element anywhere and walk up
  const toolboxEl = document.querySelector(GPM_SELECTORS.toolboxDrawer);
  if (toolboxEl) {
    let row = toolboxEl.parentElement;
    for (let i = 0; i < 3; i++) {
      if (!row) break;
      if (row.children.length > 1) {
        return { container: row, insertRef: toolboxEl.nextSibling, method: 'toolbox walk-up' };
      }
      row = row.parentElement;
    }
    if (row) {
      return { container: row, insertRef: null, method: 'toolbox deep walk-up' };
    }
  }

  // Strategy 2b: Content-based discovery — find "Tools" button text and insert right next to it
  // This is the most resilient approach since "Tools" is always visible in the toolbar
  const toolsButton = _gpmFindToolsButton();
  if (toolsButton) {
    // Walk up to find a reasonable toolbar row container (not a tiny wrapper)
    // The "Tools" label may be deeply nested: span > span > button > div > toolbar-row
    let toolsContainer = toolsButton;
    // If we found a bare span/div (not a button), walk up to find the clickable or toolbar row
    for (let i = 0; i < 5 && toolsContainer; i++) {
      const parent = toolsContainer.parentElement;
      if (!parent || parent === document.body) break;
      // A good container has multiple children (toolbar items) and is a flex/grid row
      if (parent.children.length >= 2) {
        gpmLog(
          'Strategy 2b: found toolbar row:',
          parent.tagName,
          parent.className?.slice(0, 80),
          'children:',
          parent.children.length
        );
        return {
          container: parent,
          insertRef: toolsContainer.nextSibling,
          method: 'content-search (next to Tools button)',
        };
      }
      toolsContainer = parent;
    }
    // Fallback: just use direct parent
    const toolsParent = toolsButton.parentElement;
    if (toolsParent) {
      gpmLog('Strategy 2b fallback: using direct parent:', toolsParent.tagName, toolsParent.className?.slice(0, 80));
      return {
        container: toolsParent,
        insertRef: toolsButton.nextSibling,
        method: 'content-search (Tools direct parent)',
      };
    }
  }

  // Strategy 3: Structural search from input area upward
  // Find the prompt input, then walk up to find a sibling container with buttons
  const inputArea = document.querySelector(GPM_SELECTORS.inputArea);
  if (inputArea) {
    // Walk up from input to find the form or prompt container
    const formOrContainer = inputArea.closest('form') || inputArea.closest(GPM_SELECTORS.inputContainer);
    if (formOrContainer) {
      // Look for a child container that holds action buttons (has multiple button-like children)
      const candidates = formOrContainer.querySelectorAll('div, span');
      for (const candidate of candidates) {
        const buttonCount = candidate.querySelectorAll('button, [role="button"]').length;
        if (buttonCount >= 2 && candidate.children.length >= 2 && candidate.children.length <= 10) {
          // Found a button group — this is likely the toolbar
          return { container: candidate, insertRef: null, method: 'structural-search (button group)' };
        }
      }
    }

    // Strategy 3b: Walk up from input to find a sibling toolbar container
    // Gemini may place the toolbar as a sibling of the input's ancestor, not inside the same form
    let ancestor = inputArea.parentElement;
    for (let depth = 0; depth < 6 && ancestor && ancestor !== document.body; depth++) {
      for (const sibling of ancestor.parentElement?.children || []) {
        if (sibling === ancestor) continue;
        const siblingBtns = sibling.querySelectorAll('button, [role="button"]');
        if (siblingBtns.length >= 2 && sibling.children.length >= 2 && sibling.children.length <= 12) {
          return { container: sibling, insertRef: null, method: 'structural-search (sibling toolbar)' };
        }
      }
      ancestor = ancestor.parentElement;
    }
  }

  // ── Diagnostic: log what was found for each strategy to help debug ──
  gpmLog(
    '_gpmFindToolbarSlot: all strategies failed.',
    'leadingActions:',
    !!leadingActions,
    'toolboxEl:',
    !!toolboxEl,
    'toolsButton:',
    !!toolsButton,
    'inputArea:',
    !!inputArea
  );

  // No toolbar found — do NOT return a low-confidence fallback
  // (form container, input parent, etc.) because placing the button there
  // usually results in it being hidden. The caller will use the floating fallback.
  return null;
}

/**
 * Known translations of the "Tools" button label in Gemini's toolbar.
 * Used for content-based toolbar discovery across all supported UI languages.
 * Gemini renders this label in the user's Google account language.
 */
const _GPM_TOOLS_LABELS = [
  // English
  'Tools',
  // Turkish
  'Araçlar',
  // German
  'Werkzeuge',
  // French
  'Outils',
  // Spanish
  'Herramientas',
  // Italian
  'Strumenti',
  // Portuguese
  'Ferramentas',
  // Russian
  'Инструменты',
  // Japanese
  'ツール',
  // Chinese (Simplified)
  '工具',
  // Korean
  '도구',
  // Hindi
  'टूल',
  // Arabic
  'الأدوات',
  'أدوات',
  // Vietnamese
  'Công cụ',
  // Indonesian
  'Alat',
  // Thai
  'เครื่องมือ',
  // Bengali
  'টুলস',
  'সরঞ্জাম',
];

/**
 * Find a button/element containing "Tools" text in the Gemini toolbar.
 * Uses the visible "Tools" label (in any supported language) as a reliable content-based anchor.
 * @returns {Element|null}
 */
function _gpmFindToolsButton() {
  // Check buttons and role="button" elements for "Tools" text in any language
  const candidates = document.querySelectorAll('button, [role="button"]');
  for (const el of candidates) {
    const text = el.textContent?.trim();
    if (text && _GPM_TOOLS_LABELS.some((label) => text === label || text.startsWith(label))) {
      return el;
    }
  }
  // Also check elements near the input area for "Tools" label
  const inputArea = document.querySelector(GPM_SELECTORS.inputArea);
  if (inputArea) {
    const container =
      inputArea.closest('form') || inputArea.closest('[role="region"]') || inputArea.parentElement?.parentElement;
    if (container) {
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
      let textNode;
      while ((textNode = walker.nextNode())) {
        const text = textNode.textContent?.trim();
        if (text && _GPM_TOOLS_LABELS.includes(text)) {
          const el = textNode.parentElement;
          const clickable = el?.closest('button, [role="button"]');
          if (clickable) return clickable;
          if (el && el.children.length <= 2) return el;
        }
      }
    }
  }
  return null;
}

/**
 * Check if a DOM node or its descendants contain a "Tools" label.
 * Used by the MutationObserver to detect when the toolbar area appears in the DOM.
 * @param {Element} node
 * @returns {boolean}
 */
function _gpmNodeContainsToolsLabel(node) {
  if (!node || !node.textContent) return false;
  const text = node.textContent.trim();
  return _GPM_TOOLS_LABELS.some((label) => text.includes(label));
}

/**
 * Inject the ⚡ Quick Prompt button as a floating fixed-position button.
 * Used as ultimate fallback when no toolbar container can be found.
 */
function _gpmInjectFloatingQPButton() {
  const existing = document.querySelector('#gpm-qp-trigger');
  if (existing) {
    // Already floating — nothing to do (prevents flicker from repeated re-creation)
    if (existing.dataset.gpmFloating === 'true') {
      return;
    }
    // Otherwise remove the old one (e.g., toolbar placement failed)
    existing.remove();
  }

  const btn = _gpmCreateQPButton();
  btn.dataset.gpmFloating = 'true';
  btn.style.position = 'fixed';
  btn.style.bottom = '100px';
  btn.style.right = '28px';
  btn.style.zIndex = '2147483646';
  btn.style.width = '48px';
  btn.style.height = '48px';
  btn.style.borderRadius = '50%';
  btn.style.background = '#4285f4';
  btn.style.border = '2px solid rgba(255,255,255,0.25)';
  btn.style.fontSize = '22px';
  btn.style.cursor = 'pointer';
  btn.style.display = 'flex';
  btn.style.alignItems = 'center';
  btn.style.justifyContent = 'center';
  btn.style.color = '#fff';
  btn.style.opacity = '0.92';
  btn.style.transition = 'opacity 150ms, transform 150ms';
  btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
  btn.style.pointerEvents = 'auto';
  btn.style.flexShrink = '0';
  btn.addEventListener('mouseenter', () => {
    btn.style.opacity = '1';
    btn.style.transform = 'scale(1.12)';
    btn.style.boxShadow = '0 6px 16px rgba(0,0,0,0.5)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.opacity = '0.92';
    btn.style.transform = 'scale(1)';
    btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
  });

  document.body.appendChild(btn);
  gpmLog('⚡ button injected as floating fallback');
}

function _gpmFindToolbarSlotFast() {
  const lastMethod = GPM_STATE._qpLastToolbarMethod;
  if (!lastMethod) return null;

  const inputArea = document.querySelector(GPM_SELECTORS.inputArea);
  const inputRect = inputArea?.getBoundingClientRect();

  // Fast-path: re-find the same container using the last successful strategy
  // This avoids running all slow strategies every time.
  if (lastMethod.startsWith('leading-actions')) {
    const leadingActions = document.querySelector(GPM_SELECTORS.leadingActions);
    if (leadingActions) {
      if (inputRect) {
        const actionsRect = leadingActions.getBoundingClientRect();
        if (Math.abs(inputRect.top - actionsRect.top) >= 200) {
          GPM_STATE._qpLastToolbarMethod = null;
          return null;
        }
      }
      const toolbox = leadingActions.querySelector(GPM_SELECTORS.toolboxDrawer);
      if (toolbox && toolbox.parentElement === leadingActions) {
        return { container: leadingActions, insertRef: toolbox.nextSibling, method: lastMethod };
      }
      return { container: leadingActions, insertRef: null, method: lastMethod };
    }
  }

  if (lastMethod.startsWith('toolbox')) {
    const toolboxEl = document.querySelector(GPM_SELECTORS.toolboxDrawer);
    if (toolboxEl && toolboxEl.parentElement) {
      // Ensure insertRef is still a child of container
      const container = toolboxEl.parentElement;
      if (toolboxEl.parentElement === container) {
        return { container: container, insertRef: toolboxEl.nextSibling, method: lastMethod };
      }
      return { container: container, insertRef: null, method: lastMethod };
    }
  }

  if (lastMethod.startsWith('content-search')) {
    const toolsButton = _gpmFindToolsButton();
    if (toolsButton && toolsButton.parentElement) {
      const container = toolsButton.parentElement;
      if (toolsButton.parentElement === container) {
        return { container: container, insertRef: toolsButton.nextSibling, method: lastMethod };
      }
      return { container: container, insertRef: null, method: lastMethod };
    }
  }

  // Cache miss — clear it so next full search can set a new one
  GPM_STATE._qpLastToolbarMethod = null;
  return null;
}

/**
 * Inject the ⚡ Quick Prompt trigger button into the Gemini toolbar.
 * Uses a multi-strategy approach to find the right injection point.
 * Falls back to a floating button if no toolbar can be found.
 *
 * After injection, verifies the button is actually visible.
 * If the button was placed into a hidden/clipped container, removes it
 * and falls back to the floating button.
 */
function gpmInjectQuickPromptTrigger() {
  const existingBtn = document.querySelector('#gpm-qp-trigger');

  // If button exists and is connected, check whether it's in a real toolbar container.
  // We used to just check `gpmFloating !== 'true'`, but on the new Gemini layout the button
  // may be in body or a generic wrapper instead of the actual toolbar.
  if (existingBtn && existingBtn.isConnected) {
    const isInToolbar =
      existingBtn.dataset.gpmFloating !== 'true' &&
      existingBtn.parentElement &&
      existingBtn.parentElement !== document.body &&
      existingBtn.parentElement.children.length >= 2;
    if (isInToolbar) {
      return;
    }
  }

  // Try fast-path first (cached last-successful placement strategy)
  let slot = _gpmFindToolbarSlotFast();
  // Only if fast-path missed, run the full (slower) structural search
  if (!slot) {
    slot = _gpmFindToolbarSlot();
  }
  gpmLog('_gpmFindToolbarSlot result:', slot ? slot.method : 'null (no toolbar found)');

  if (slot) {
    // Remove existing button (floating or misplaced) so we can place it correctly
    if (existingBtn) {
      gpmLog('Relocating existing button into toolbar via', slot.method);
      existingBtn.remove();
    }

    const btn = _gpmCreateQPButton();
    try {
      if (slot.insertRef && slot.insertRef.parentElement === slot.container) {
        slot.container.insertBefore(btn, slot.insertRef);
      } else if (slot.insertRef) {
        // insertRef is stale (no longer child of container) — append instead
        gpmLog('insertRef stale for', slot.method, '— using appendChild');
        slot.container.appendChild(btn);
      } else {
        slot.container.appendChild(btn);
      }
      gpmLog(
        '⚡ button placed via:',
        slot.method,
        '| container:',
        slot.container.tagName,
        slot.container.className?.slice(0, 80)
      );
      // Remember the successful placement strategy for fast re-injection next time
      GPM_STATE._qpLastToolbarMethod = slot.method;

      // ── Post-injection visibility check ──
      // Wait a short delay to let Gemini finish DOM/layout before checking.
      // requestAnimationFrame fires too early and can falsely detect zero-size rects.
      setTimeout(() => {
        _gpmVerifyButtonVisibility();
      }, 500);
      return;
    } catch (e) {
      gpmError('⚡ button injection FAILED via', slot.method, ':', e.message);
    }
  }

  // If floating button already exists, don't create another one
  if (existingBtn) return;

  // Ultimate fallback: floating button
  gpmLog('Using floating fallback button');
  _gpmInjectFloatingQPButton();
}

/**
 * Verify the injected QP button is actually visible on screen.
 * If it's hidden (zero-size rect, clipped, display:none, etc.),
 * remove it and inject a floating fallback.
 */
function _gpmVerifyButtonVisibility() {
  const btn = document.querySelector('#gpm-qp-trigger');
  if (!btn || !btn.isConnected) return;

  // Already floating — skip check
  if (btn.dataset.gpmFloating === 'true') return;

  const rect = btn.getBoundingClientRect();
  const isVisible =
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth;

  // Also check computed visibility
  const style = window.getComputedStyle(btn);
  const isStyleVisible = style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) > 0;

  // Check if any ancestor hides the button via overflow clipping
  let isClipped = false;
  let parent = btn.parentElement;
  while (parent && parent !== document.body) {
    const ps = window.getComputedStyle(parent);
    if (ps.overflow === 'hidden' || ps.overflowX === 'hidden' || ps.overflowY === 'hidden') {
      const parentRect = parent.getBoundingClientRect();
      if (
        rect.right < parentRect.left ||
        rect.left > parentRect.right ||
        rect.bottom < parentRect.top ||
        rect.top > parentRect.bottom
      ) {
        isClipped = true;
        break;
      }
    }
    parent = parent.parentElement;
  }

  if (!isVisible || !isStyleVisible || isClipped) {
    gpmWarn(
      '⚡ button not visible after injection (visible:',
      isVisible,
      'styleVisible:',
      isStyleVisible,
      'clipped:',
      isClipped,
      ') — switching to floating'
    );
    btn.remove();
    _gpmInjectFloatingQPButton();
  }
}

// ══════════════════════════════════════
//  QUICK PROMPT BUTTON MONITOR
// ══════════════════════════════════════

/**
 * Continuously monitor and re-inject Quick Prompt button if it disappears.
 * Does NOT depend on specific CSS class names for detection —
 * simply checks if #gpm-qp-trigger exists in the DOM.
 *
 * Uses GPM_STATE to track interval/observer so they can be cleaned up
 * on re-initialization — prevents duplicate monitors from leaking.
 */
function gpmObserveQuickPromptButton() {
  // ── Prevent duplicate monitors on re-init ──
  if (GPM_STATE._qpCheckInterval) {
    clearInterval(GPM_STATE._qpCheckInterval);
    GPM_STATE._qpCheckInterval = null;
  }
  if (GPM_STATE._qpMutationObserver) {
    GPM_STATE._qpMutationObserver.disconnect();
    GPM_STATE._qpMutationObserver = null;
  }

  GPM_STATE._qpCheckInterval = setInterval(() => {
    if (!gpmIsContextValid()) {
      clearInterval(GPM_STATE._qpCheckInterval);
      GPM_STATE._qpCheckInterval = null;
      return;
    }
    const btn = document.querySelector('#gpm-qp-trigger');

    // If button exists, is connected, and is NOT floating — it's properly in the toolbar
    if (btn && btn.isConnected && btn.dataset.gpmFloating !== 'true') return;

    // Button is missing OR is floating (fallback) — try to (re-)inject into toolbar
    // Use a small timeout to let Gemini finish its DOM updates
    setTimeout(gpmInjectQuickPromptTrigger, 100);
  }, GPM_CONFIG.QP_BUTTON_CHECK);

  // Also observe DOM changes to detect when toolbar is (re-)created
  GPM_STATE._qpMutationObserver = new MutationObserver((mutations) => {
    const btn = document.querySelector('#gpm-qp-trigger');
    // If button exists, is connected, and is NOT floating — it's in the toolbar, nothing to do
    if (btn && btn.isConnected && btn.dataset.gpmFloating !== 'true') return;

    // Check if any mutation added nodes that look like a toolbar or input area
    const toolbarAppeared = mutations.some((m) => {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        // Check if added node IS or CONTAINS a toolbar element
        try {
          if (
            node.querySelector &&
            (node.querySelector(GPM_SELECTORS.leadingActions) ||
              node.querySelector(GPM_SELECTORS.toolboxDrawer) ||
              node.matches?.(GPM_SELECTORS.leadingActions) ||
              node.querySelector(GPM_SELECTORS.inputArea) ||
              // Content-based detection: look for "Tools" button text in added nodes
              _gpmNodeContainsToolsLabel(node))
          )
            return true;
        } catch (_) {
          // Selector may be invalid in some edge cases — skip gracefully
        }
      }
      return false;
    });

    if (toolbarAppeared) {
      setTimeout(gpmInjectQuickPromptTrigger, 150);
    }
  });

  // Start observing when body is ready
  const startObserving = () => {
    if (document.body) {
      GPM_STATE._qpMutationObserver.observe(document.body, { childList: true, subtree: true });
    }
  };

  if (document.body) {
    startObserving();
  } else {
    document.addEventListener('DOMContentLoaded', startObserving);
  }
}

// ══════════════════════════════════════
//  QUICK PROMPTS PANEL TOGGLE
// ══════════════════════════════════════

async function gpmToggleQuickPrompts() {
  if (!GPM_STATE.modalRoot) return;
  const existing = GPM_STATE.modalRoot.querySelector('.gpm-quick-prompts');
  if (existing) {
    existing.remove();
    GPM_STATE.qpOpen = false;
    return;
  }

  GPM_STATE.qpOpen = true;
  const prompts = await GPMStorage.getQuickPrompts();
  const panel = GPMUI.createQuickPromptsPanel(GPM_STATE.modalRoot, {
    prompts,
    onSelect: (p) => {
      gpmInsertPromptText(p.content);
      GPM_STATE.modalRoot.querySelector('.gpm-quick-prompts')?.remove();
      GPM_STATE.qpOpen = false;
    },
    onAdd: () => {
      GPMUI.createQuickPromptModal(GPM_STATE.modalRoot, {
        onSave: async (data) => {
          await GPMStorage.saveQuickPrompt(data);
          GPM_STATE.modalRoot.querySelector('.gpm-quick-prompts')?.remove();
          gpmToggleQuickPrompts();
        },
        onCancel: () => {},
      });
    },
    onEdit: (prompt) => {
      GPMUI.createQuickPromptModal(GPM_STATE.modalRoot, {
        existing: prompt,
        onSave: async (data) => {
          await GPMStorage.updateQuickPrompt(prompt.id, data);
          GPM_STATE.modalRoot.querySelector('.gpm-quick-prompts')?.remove();
          gpmToggleQuickPrompts();
        },
        onCancel: () => {},
      });
    },
    onDelete: (prompt) => {
      GPMUI.showConfirmDialog(GPM_STATE.modalRoot, {
        title: t('delete'),
        message: t('deletePromptConfirm'),
        confirmText: t('delete'),
        danger: true,
        onConfirm: async () => {
          await GPMStorage.deleteQuickPrompt(prompt.id);
          GPM_STATE.modalRoot.querySelector('.gpm-quick-prompts')?.remove();
          gpmToggleQuickPrompts();
        },
      });
    },
    onBackup: async () => {
      const allPrompts = await GPMStorage.getQuickPrompts();
      const json = JSON.stringify(allPrompts, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gpm-prompts-backup-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onRestore: () => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.json';
      fileInput.style.display = 'none';
      let cleaned = false;
      const cleanup = function () {
        if (cleaned) return;
        cleaned = true;
        fileInput.remove();
      };
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
          try {
            const imported = JSON.parse(ev.target.result);
            if (Array.isArray(imported)) {
              // Merge: add imported prompts with validation
              let importedCount = 0;
              for (const p of imported) {
                if (
                  p &&
                  typeof p === 'object' &&
                  typeof p.title === 'string' &&
                  typeof p.content === 'string' &&
                  p.title.trim() &&
                  p.content.trim()
                ) {
                  const safeTitle = p.title.replace(/[<>]/g, '').trim();
                  const safeContent = p.content.replace(/[<>]/g, '').trim();
                  const safeCategory =
                    (typeof p.category === 'string' ? p.category.replace(/[<>]/g, '').trim() : 'General') || 'General';
                  await GPMStorage.saveQuickPrompt({ title: safeTitle, content: safeContent, category: safeCategory });
                  importedCount++;
                }
              }
              gpmLog('Imported', importedCount, 'prompts (skipped', imported.length - importedCount, 'invalid)');
              cleanup();
              GPM_STATE.modalRoot.querySelector('.gpm-quick-prompts')?.remove();
              gpmToggleQuickPrompts();
            }
          } catch (err) {
            gpmError('Failed to restore prompts:', err);
            cleanup();
            if (GPM_STATE.modalRoot)
              GPMUI.showAlertDialog(GPM_STATE.modalRoot, { title: t('restore'), message: t('importError') });
          }
        };
        reader.readAsText(file);
        cleanup();
      });
      const cancelTimeout = setTimeout(cleanup, 60000);
      fileInput.addEventListener('cancel', function () {
        clearTimeout(cancelTimeout);
        cleanup();
      });
      document.body.appendChild(fileInput);
      fileInput.click();
    },
    onClose: () => {
      GPM_STATE.modalRoot.querySelector('.gpm-quick-prompts')?.remove();
      GPM_STATE.qpOpen = false;
    },
  });
  GPM_STATE.modalRoot.appendChild(panel);
}

// ══════════════════════════════════════
//  INSERT PROMPT TEXT INTO INPUT (Multi-Strategy)
// ══════════════════════════════════════

/**
 * Insert prompt text into Gemini's input area.
 * Uses multiple strategies to ensure compatibility with Gemini's reactive framework.
 *
 * Strategy order:
 *   1. execCommand('insertText') — works with most contenteditable (deprecated but functional)
 *   2. InputEvent simulation — standard DOM event approach
 *   3. Clipboard paste simulation — ClipboardEvent for stubborn frameworks
 *   4. Direct textContent + multi-event — brute force fallback
 *
 * @param {string} text — The prompt text to insert
 */
function gpmInsertPromptText(text) {
  const input = gpmQuerySelector('inputArea') || document.querySelector(GPM_SELECTORS.inputArea);
  if (!input) {
    gpmWarn('Cannot insert prompt text: input area not found');
    return;
  }

  input.focus();

  // ── TEXTAREA path (simpler) ──
  if (input.tagName === 'TEXTAREA') {
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    gpmLog('Prompt inserted via textarea.value');
    return;
  }

  // ── CONTENTEDITABLE path (requires multiple strategies) ──

  // Clear existing content first
  const selection = window.getSelection();
  if (selection && input.textContent) {
    selection.selectAllChildren(input);
  }

  // Strategy 1: execCommand (deprecated but widely supported and framework-aware)
  try {
    const success = document.execCommand('insertText', false, text);
    if (success && input.textContent.includes(text.slice(0, 20))) {
      gpmLog('Prompt inserted via execCommand("insertText")');
      return;
    }
  } catch (e) {
    gpmLog('execCommand strategy failed:', e.message);
  }

  // Strategy 2: InputEvent with insertText type
  try {
    input.textContent = '';
    input.focus();

    // Create a proper InputEvent that mimics real typing
    const inputEvent = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: text,
    });
    input.dispatchEvent(inputEvent);

    // If beforeinput didn't populate, set content manually
    if (!input.textContent || input.textContent.length < 5) {
      input.textContent = text;
    }

    input.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        data: text,
        inputType: 'insertText',
      })
    );

    if (input.textContent.includes(text.slice(0, 20))) {
      gpmLog('Prompt inserted via InputEvent simulation');
      return;
    }
  } catch (e) {
    gpmLog('InputEvent strategy failed:', e.message);
  }

  // Strategy 3: Clipboard paste simulation
  try {
    input.focus();
    input.textContent = '';

    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', text);
    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: clipboardData,
    });
    input.dispatchEvent(pasteEvent);

    // If paste event didn't populate content, set it manually
    if (!input.textContent || input.textContent.length < 5) {
      input.textContent = text;
      input.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertFromPaste' }));
    }

    if (input.textContent.includes(text.slice(0, 20))) {
      gpmLog('Prompt inserted via clipboard paste simulation');
      return;
    }
  } catch (e) {
    gpmLog('Clipboard strategy failed:', e.message);
  }

  // Strategy 4: Brute force — set textContent + fire all related events
  input.textContent = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  // Use requestAnimationFrame to ensure framework picks up the change
  requestAnimationFrame(() => {
    input.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
  });
  gpmLog('Prompt inserted via brute force textContent');

  input.focus();
}
