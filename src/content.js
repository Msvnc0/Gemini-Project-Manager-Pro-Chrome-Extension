/**
 * content.js — Main Engine (Direct DOM Injection)
 *
 * Strategy: Inject directly into Gemini's sidebar DOM to look native.
 * We use a scoped <style> with [data-gpm] attribute selectors to avoid
 * polluting Gemini's styles. Modals use a Shadow DOM overlay for isolation.
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │  SELECTOR CONFIG — Update these when Gemini changes its UI  │
 * └─────────────────────────────────────────────────────────────┘
 */

const GPM_SELECTORS = {
  sidebar: 'conversations-list, [class*="sidenav"], [class*="overflow-container"], nav[aria-label], nav, [role="navigation"]',

  // Individual chat items in the sidebar — Gemini uses /app/<id> format
  chatItem: 'a[href^="/app/"]',

  // The "New Chat" button
  newChatButton: 'a[href="/app"][aria-label*="New chat"], a[href="/app"][aria-label*="Yeni sohbet"], a[href="/app"]:not([href*="/app/"])',

  // The text input / prompt area
  inputArea: '[contenteditable="true"], textarea[aria-label], .ql-editor, [role="textbox"]',
  inputContainer: 'form, [class*="input-area"], [class*="prompt"]',

  // Dark mode
  darkModeIndicator: 'html[dark], html[data-theme="dark"], body.dark-theme, html.dark-theme'
};

// ── State ──
let gpmContainer = null;       // The injected <div data-gpm="root"> in sidebar
let gpmModalHost = null;       // Shadow DOM host for modals/overlays only
let gpmModalRoot = null;       // Shadow root for modals
let gpmInitialized = false;
let gpmPendingChatAssignment = null;
let gpmStyleInjected = false;

// ── Extension context check ──
function gpmIsContextValid() {
  try {
    return !!chrome.runtime?.id;
  } catch (e) {
    return false;
  }
}

// ══════════════════════════════════════
//  INITIALIZATION
// ══════════════════════════════════════

async function gpmInit() {
  if (gpmInitialized) return;

  const settings = await GPMStorage.getSettings();
  gpmSetLang(settings.lang || 'en');

  const sidebar = await gpmWaitForElement(GPM_SELECTORS.sidebar, 15000);
  if (!sidebar) {
    console.warn('[GPM] Sidebar not found. Retrying...');
    gpmObserveForSidebar();
    return;
  }

  console.log('[GPM] Sidebar found:', sidebar.tagName, sidebar.className?.slice(0, 60));

  // Wait for chat content to load inside the sidebar before injecting.
  // Gemini lazy-loads sidebar sections — we need "Chats" or chat links to exist first.
  await gpmWaitForSidebarContent(sidebar, 10000);

  gpmInitialized = true;
  console.log('[GPM] Sidebar content ready. Injecting.');

  gpmInjectStyles();
  gpmInjectProjectSection(sidebar);
  gpmCreateModalHost();
  gpmInjectQuickPromptTrigger();
  gpmObserveQuickPromptButton(); // Continuously monitor button
  gpmObserveSPANavigation();
  gpmObserveNewChats();
}

/**
 * Wait until the sidebar has meaningful content (chat links or "Chats" text).
 */
function gpmWaitForSidebarContent(sidebar, timeout = 10000) {
  return new Promise((resolve) => {
    // Check immediately
    if (gpmSidebarHasContent(sidebar)) return resolve(true);

    const observer = new MutationObserver(() => {
      if (gpmSidebarHasContent(sidebar)) {
        observer.disconnect();
        resolve(true);
      }
    });
    observer.observe(sidebar, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); resolve(false); }, timeout);
  });
}

function gpmSidebarHasContent(sidebar) {
  // Check for chat links — Gemini uses /app/<id> format
  if (sidebar.querySelector('a[href^="/app/"]')) return true;
  // Legacy formats
  if (sidebar.querySelector('a[href*="/chat/"], a[href*="/c/"]')) return true;
  // Check for "Chats" text
  if (sidebar.textContent?.includes('Chats') || sidebar.textContent?.includes('Sohbetler')) return true;
  // Check for Gems section (sidebar loaded even if no chats exist)
  if (sidebar.querySelector('.gems-list-container')) return true;
  if (sidebar.querySelector('.chat-history')) return true;
  if (sidebar.textContent?.includes('Gems') || sidebar.textContent?.includes("Gem'ler")) return true;
  // Check for "My stuff" / "Öğelerim" section
  if (sidebar.querySelector('.side-nav-entry-container')) return true;
  return false;
}

function gpmWaitForElement(selector, timeout = 10000) {
  return new Promise((resolve) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);
    const observer = new MutationObserver((_, obs) => {
      const found = document.querySelector(selector);
      if (found) { obs.disconnect(); resolve(found); }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
  });
}

function gpmObserveForSidebar() {
  const observer = new MutationObserver(() => {
    if (document.querySelector(GPM_SELECTORS.sidebar) && !gpmInitialized) {
      observer.disconnect();
      gpmInit();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// ══════════════════════════════════════
//  INJECT SCOPED STYLES (into <head>)
// ══════════════════════════════════════

function gpmInjectStyles() {
  if (gpmStyleInjected) return;
  gpmStyleInjected = true;

  const style = document.createElement('style');
  style.id = 'gpm-injected-styles';
  style.textContent = `
    /* ── GPM Section Container ── */
    [data-gpm="root"] {
      padding: 0 0 4px 0;
      width: 100%;
      font-family: "Google Sans", "Helvetica Neue", sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    /* ── Section Header (like "Gems" / "Chats") ── */
    [data-gpm="header"] {
      display: flex;
      align-items: center;
      padding: 10px 16px 4px;
      cursor: pointer;
      user-select: none;
    }

    [data-gpm="header-chevron"] {
      font-size: 10px;
      margin-right: 4px;
      transition: transform 150ms ease;
      color: var(--gm-colorsurface-variant, #9aa0a6);
    }

    [data-gpm="header-chevron"].gpm-open {
      transform: rotate(0deg);
    }

    [data-gpm="header-chevron"].gpm-closed {
      transform: rotate(-90deg);
    }

    [data-gpm="header-title"] {
      font-size: 14px;
      font-weight: 400;
      letter-spacing: .025em;
      color: inherit;
      flex: 1;
    }

    /* ── Items List ── */
    [data-gpm="list"] {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    [data-gpm="list"].gpm-hidden {
      display: none;
    }

    /* ── New Project Row ── */
    [data-gpm="item"] {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 16px 8px 24px;
      cursor: pointer;
      border-radius: 0 24px 24px 0;
      margin-right: 8px;
      transition: background 150ms ease;
      text-decoration: none;
      color: inherit;
      font-size: 14px;
      font-weight: 400;
      letter-spacing: .025em;
      line-height: 20px;
      position: relative;
    }

    [data-gpm="item"]:hover {
      background: var(--gm-colorsurface-container-high, rgba(255,255,255,0.08));
    }

    [data-gpm="item-icon"] {
      font-size: 18px;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    [data-gpm="item-label"] {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 14px;
      font-weight: 400;
      letter-spacing: .025em;
    }

    [data-gpm="item-count"] {
      font-size: 12px;
      opacity: 0.5;
    }

    /* ── New Project button ── */
    [data-gpm="new-project"] [data-gpm="item-icon"] {
      color: var(--gm-colorsurface-variant, #9aa0a6);
    }

    /* ── Subfolder indent ── */
    [data-gpm="sublist"] {
      list-style: none;
      margin: 0;
      padding: 0 0 0 16px;
    }

    [data-gpm="sublist"].gpm-hidden {
      display: none;
    }

    /* ── Chat items inside project ── */
    [data-gpm="chat"] {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 16px 6px 40px;
      cursor: pointer;
      border-radius: 0 24px 24px 0;
      margin-right: 8px;
      transition: background 150ms ease;
      font-size: 13px;
      color: inherit;
      opacity: 0.8;
    }

    [data-gpm="chat"]:hover {
      background: var(--gm-colorsurface-container-high, rgba(255,255,255,0.08));
      opacity: 1;
    }

    [data-gpm="chat"].gpm-active {
      background: rgba(138, 180, 248, 0.16);
      opacity: 1;
    }

    [data-gpm="chat-dot"] {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    [data-gpm="chat-label"] {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    [data-gpm="chat"].gpm-pinned::before {
      content: '📌';
      font-size: 10px;
    }

    /* ── Drag over ── */
    [data-gpm="item"].gpm-drag-over {
      outline: 2px solid #8ab4f8;
      outline-offset: -2px;
      background: rgba(138, 180, 248, 0.1);
    }

    /* ── Divider ── */
    [data-gpm="divider"] {
      height: 1px;
      background: var(--gm-colorsurface-container-high, rgba(255,255,255,0.08));
      margin: 4px 16px;
    }
    
    /* ── Native chat drag handle ── */
    [data-gpm-enhanced] {
      display: flex !important;
      align-items: center !important;
    }
  `;
  document.head.appendChild(style);
}

// ══════════════════════════════════════
//  CREATE MODAL HOST (Shadow DOM — only for modals/overlays)
// ══════════════════════════════════════

function gpmCreateModalHost() {
  if (gpmModalHost) return;
  gpmModalHost = document.createElement('div');
  gpmModalHost.id = 'gpm-modal-host';
  gpmModalHost.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:99999;pointer-events:none;';
  gpmModalRoot = gpmModalHost.attachShadow({ mode: 'open' });

  // Load styles for modals
  try {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('src/styles.css');
    gpmModalRoot.appendChild(link);
  } catch (e) {
    // Fallback: inject styles inline if extension context is invalidated
    console.warn('[GPM] Could not load styles.css via runtime URL, using inline fallback');
  }

  document.body.appendChild(gpmModalHost);
}

// ══════════════════════════════════════
//  FIND INSERTION POINT IN SIDEBAR
// ══════════════════════════════════════

/**
 * Find where to insert the Projects section.
 *
 * APPROACH: Scan ALL text nodes in the sidebar for "Chats" / "Sohbetler".
 * When found, walk up to the nearest block-level element and insert before it.
 * This is the most reliable method because:
 *   - It doesn't depend on DOM depth or structure
 *   - "Chats" is always visible as a section header in the sidebar
 *   - Works regardless of how deeply nested the text is
 */
function gpmFindInsertionPoint(sidebar) {
  // Strategy 1: Find chat-history container and insert before it (after Gems)
  const chatHistory = sidebar.querySelector('.chat-history');
  if (chatHistory && chatHistory.parentElement) {
    console.log('[GPM] Found .chat-history, inserting before it (after Gems)');
    return { parent: chatHistory.parentElement, before: chatHistory };
  }

  // Strategy 2: Find gems-list-container and insert after it
  const gemsList = sidebar.querySelector('.gems-list-container');
  if (gemsList && gemsList.nextElementSibling) {
    console.log('[GPM] Found .gems-list-container, inserting after it');
    return { parent: gemsList.parentElement, before: gemsList.nextElementSibling };
  }

  // Strategy 3: Find "Chats" / "Sohbetler" text node and insert before its section
  const targetTexts = ['chats', 'sohbetler', 'recent', 'recents'];
  const walker = document.createTreeWalker(sidebar, NodeFilter.SHOW_TEXT, null);
  let textNode;
  
  while ((textNode = walker.nextNode())) {
    const txt = textNode.textContent?.trim().toLowerCase();
    if (targetTexts.includes(txt)) {
      let el = textNode.parentElement;
      console.log('[GPM] Found "Chats" text in:', el.tagName, el.className?.slice(0, 60));
      
      let insertTarget = el;
      let depth = 0;
      while (el && el !== sidebar && depth < 20) {
        const parent = el.parentElement;
        if (!parent || parent === sidebar) { insertTarget = el; break; }
        if (parent.children.length >= 2) {
          const siblingTexts = Array.from(parent.children).map(c => c.textContent?.trim().slice(0, 20));
          if (new Set(siblingTexts).size >= 2) { insertTarget = el; break; }
        }
        el = parent;
        insertTarget = el;
        depth++;
      }
      
      const resolvedParent = insertTarget.parentElement || sidebar;
      if (insertTarget.parentElement === resolvedParent) {
        return { parent: resolvedParent, before: insertTarget };
      }
      return { parent: sidebar, before: null };
    }
  }

  // Strategy 4: Find "Gems" / "Gem'ler" text and insert after its section container
  const gemTexts = ['gems', "gem'ler"];
  const walker2 = document.createTreeWalker(sidebar, NodeFilter.SHOW_TEXT, null);
  while ((textNode = walker2.nextNode())) {
    const txt = textNode.textContent?.trim().toLowerCase();
    if (gemTexts.includes(txt)) {
      let el = textNode.parentElement;
      // Walk up to find the section-level container (gems-list-container or similar)
      for (let i = 0; i < 10; i++) {
        if (!el || !el.parentElement) break;
        if (el.parentElement.children.length >= 3) {
          // Found the multi-sibling parent, insert after this element
          const next = el.nextElementSibling;
          console.log('[GPM] Found Gems section, inserting after it');
          return { parent: el.parentElement, before: next || null };
        }
        el = el.parentElement;
      }
    }
  }

  // Strategy 5: Use first chat link
  const firstChat = sidebar.querySelector('a[href^="/app/"]');
  if (firstChat) {
    let el = firstChat;
    while (el.parentElement && el.parentElement !== sidebar) el = el.parentElement;
    console.log('[GPM] Fallback: inserting before chat container');
    return { parent: el.parentElement || sidebar, before: el };
  }

  // Strategy 6: Append before last child
  if (sidebar.lastElementChild) {
    console.log('[GPM] Last resort: inserting before last child of sidebar');
    return { parent: sidebar, before: sidebar.lastElementChild };
  }

  return { parent: sidebar, before: null };
}

// ══════════════════════════════════════
//  INJECT PROJECT SECTION
// ══════════════════════════════════════

function gpmInjectProjectSection(sidebar) {
  // Remove old container if re-injecting
  if (gpmContainer) gpmContainer.remove();

  gpmContainer = document.createElement('div');
  gpmContainer.setAttribute('data-gpm', 'root');
  gpmContainer.id = 'gpm-project-section';

  const { parent, before } = gpmFindInsertionPoint(sidebar);
  
  // Debug: log where we're inserting
  console.log('[GPM] Inserting into:', parent.tagName, parent.className?.slice(0, 50));
  console.log('[GPM] Before element:', before?.tagName, before?.className?.slice(0, 50), before?.textContent?.slice(0, 30));
  
  try {
    // Verify before is actually a child of parent before attempting insertBefore
    if (before && before.parentElement !== parent) {
      console.warn('[GPM] before element is not a child of parent, using appendChild');
      parent.appendChild(gpmContainer);
    } else {
      parent.insertBefore(gpmContainer, before);
    }
  } catch (e) {
    console.warn('[GPM] insertBefore failed, using appendChild fallback:', e.message);
    try { parent.appendChild(gpmContainer); } catch (_) {}
  }

  gpmRenderTree();
}

// ══════════════════════════════════════
//  RENDER PROJECT TREE (Direct DOM)
// ══════════════════════════════════════

async function gpmRenderTree() {
  if (!gpmContainer) return;
  gpmContainer.innerHTML = '';

  const projects = await GPMStorage.getProjects();
  const chatMap = await GPMStorage.getChatMap();
  const rootProjects = GPMStorage.getRootProjects(projects);

  // ── Auto-resolve chat aliases from sidebar links ──
  let aliasUpdated = false;
  const sidebarLinks = document.querySelectorAll('a[href^="/app/"]');
  const activeChatIds = new Set();
  for (const link of sidebarLinks) {
    const href = link.getAttribute('href') || '';
    const m = href.match(/^\/app\/([a-zA-Z0-9_-]+)/);
    if (!m) continue;
    const cid = m[1];
    activeChatIds.add(cid);
    if (chatMap[cid] && !chatMap[cid].alias) {
      const title = (link.textContent || '').trim();
      if (title && title !== cid) {
        chatMap[cid].alias = title;
        aliasUpdated = true;
      }
    }
  }
  
  // ── Auto-cleanup: remove chats that no longer exist in Gemini sidebar ──
  if (activeChatIds.size > 0) {
    let cleanupNeeded = false;
    for (const [cid, mapping] of Object.entries(chatMap)) {
      if (!activeChatIds.has(cid)) {
        // Chat was deleted from Gemini — remove from our data
        console.log('[GPM] Auto-removing deleted chat:', cid, mapping.alias);
        const proj = projects.find(p => p.id === mapping.projectId);
        if (proj) {
          proj.chatIds = (proj.chatIds || []).filter(id => id !== cid);
        }
        delete chatMap[cid];
        cleanupNeeded = true;
      }
    }
    if (cleanupNeeded) {
      await GPMStorage.saveProjects(projects);
      await GPMStorage.saveChatMap(chatMap);
      aliasUpdated = false; // already saved
    }
  }
  
  if (aliasUpdated) {
    await GPMStorage.saveChatMap(chatMap);
  }

  // ── Section Header: "Projects ▾" ──
  const header = document.createElement('div');
  header.setAttribute('data-gpm', 'header');

  const chevron = document.createElement('span');
  chevron.setAttribute('data-gpm', 'header-chevron');
  chevron.className = 'gpm-open';
  chevron.textContent = '▾';

  const title = document.createElement('span');
  title.setAttribute('data-gpm', 'header-title');
  title.textContent = t('projects');

  // Settings gear — only visible on header hover
  const gear = document.createElement('span');
  gear.textContent = '⚙';
  gear.style.cssText = 'cursor:pointer;font-size:14px;opacity:0;transition:opacity 150ms;padding:2px 4px;';
  gear.addEventListener('click', (e) => { e.stopPropagation(); gpmShowSettingsModal(); });
  header.addEventListener('mouseenter', () => { gear.style.opacity = '0.6'; });
  header.addEventListener('mouseleave', () => { gear.style.opacity = '0'; });

  header.append(chevron, title, gear);
  gpmContainer.appendChild(header);

  // ── Items List ──
  const list = document.createElement('div');
  list.setAttribute('data-gpm', 'list');

  // Toggle collapse
  let collapsed = false;
  header.addEventListener('click', () => {
    collapsed = !collapsed;
    list.classList.toggle('gpm-hidden', collapsed);
    chevron.className = collapsed ? 'gpm-closed' : 'gpm-open';
    chevron.textContent = collapsed ? '▸' : '▾';
  });

  // ── "+ New Project" row ──
  const newRow = document.createElement('div');
  newRow.setAttribute('data-gpm', 'item');
  newRow.setAttribute('data-gpm-role', 'new-project');

  const newIcon = document.createElement('span');
  newIcon.setAttribute('data-gpm', 'item-icon');
  newIcon.textContent = '+';

  const newLabel = document.createElement('span');
  newLabel.setAttribute('data-gpm', 'item-label');
  newLabel.textContent = t('newProject');

  newRow.append(newIcon, newLabel);
  newRow.addEventListener('click', () => gpmShowCreateProjectModal());
  list.appendChild(newRow);

  // ── Project Rows ── (sorted by order field)
  const sortedRootProjects = [...rootProjects].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  sortedRootProjects.forEach(project => {
    const row = gpmCreateProjectRow(project, projects, chatMap);
    list.appendChild(row);
  });

  gpmContainer.appendChild(list);

  // ── Divider ──
  const divider = document.createElement('div');
  divider.setAttribute('data-gpm', 'divider');
  gpmContainer.appendChild(divider);
}

// ══════════════════════════════════════
//  CREATE PROJECT ROW (recursive)
// ══════════════════════════════════════

function gpmCreateProjectRow(project, allProjects, chatMap) {
  const frag = document.createDocumentFragment();
  const children = allProjects.filter(p => p.parentId === project.id);
  const chatIds = project.chatIds || [];

  // ── Main row ──
  const row = document.createElement('div');
  row.setAttribute('data-gpm', 'item');
  row.dataset.projectId = project.id;
  row.draggable = true;

  const icon = document.createElement('span');
  icon.setAttribute('data-gpm', 'item-icon');
  icon.textContent = project.icon;

  const label = document.createElement('span');
  label.setAttribute('data-gpm', 'item-label');
  label.textContent = project.name;

  const count = document.createElement('span');
  count.setAttribute('data-gpm', 'item-count');
  const total = chatIds.length + children.reduce((s, c) => s + (c.chatIds?.length || 0), 0);
  count.textContent = total > 0 ? total : '';

  row.append(icon, label, count);

  // ── Project Drag (to move project into another project OR reorder) ──
  row.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/gpm-project-id', project.id);
    e.dataTransfer.setData('text/gpm-project-parentid', project.parentId || '');
    row.style.opacity = '0.5';
  });
  row.addEventListener('dragend', () => { row.style.opacity = ''; });

  // Click to expand/collapse
  const hasContent = children.length > 0 || chatIds.length > 0;
  let subList = null;

  if (hasContent) {
    subList = document.createElement('div');
    subList.setAttribute('data-gpm', 'sublist');
    if (project.collapsed) subList.classList.add('gpm-hidden');

    // Child projects FIRST (subfolders above chats)
    children.forEach(child => {
      const childRow = gpmCreateProjectRow(child, allProjects, chatMap);
      subList.appendChild(childRow);
    });

    // Then chats (pinned first)
    const sorted = [...chatIds].sort((a, b) => (chatMap[b]?.pinned ? 1 : 0) - (chatMap[a]?.pinned ? 1 : 0));
    sorted.forEach(chatId => {
      const chatRow = gpmCreateChatRow(chatId, chatMap[chatId], project, allProjects);
      subList.appendChild(chatRow);
    });

    row.addEventListener('click', (e) => {
      if (e.target.closest('[data-gpm="chat"]')) return;
      project.collapsed = !project.collapsed;
      GPMStorage.updateProject(project.id, { collapsed: project.collapsed });
      subList.classList.toggle('gpm-hidden');
    });
  }

  // Drag & Drop target (accept chats, projects for nesting OR reordering)
  row.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    // Show top/bottom indicator for reordering vs center for nesting
    const rect = row.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const zone = relY < rect.height * 0.25 ? 'top' : relY > rect.height * 0.75 ? 'bottom' : 'center';
    row.dataset.dropZone = zone;
    row.classList.remove('gpm-drag-over', 'gpm-drag-top', 'gpm-drag-bottom');
    if (zone === 'center') row.classList.add('gpm-drag-over');
    else if (zone === 'top') row.classList.add('gpm-drag-top');
    else row.classList.add('gpm-drag-bottom');
  });
  
  row.addEventListener('dragleave', () => {
    row.classList.remove('gpm-drag-over', 'gpm-drag-top', 'gpm-drag-bottom');
    delete row.dataset.dropZone;
  });
  
  row.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const zone = row.dataset.dropZone || 'center';
    row.classList.remove('gpm-drag-over', 'gpm-drag-top', 'gpm-drag-bottom');
    delete row.dataset.dropZone;
    
    // Check if a PROJECT is being dropped
    const droppedProjectId = e.dataTransfer.getData('text/gpm-project-id');
    if (droppedProjectId && droppedProjectId !== project.id) {
      const isDescendant = (parentId, childId) => {
        const p = allProjects.find(pr => pr.id === childId);
        if (!p) return false;
        if (p.parentId === parentId) return true;
        if (p.parentId) return isDescendant(parentId, p.parentId);
        return false;
      };
      
      if (isDescendant(droppedProjectId, project.id)) {
        console.warn('[GPM] Cannot move project into its own descendant');
        return;
      }

      const projects = await GPMStorage.getProjects();
      const droppedProject = projects.find(p => p.id === droppedProjectId);
      if (!droppedProject) return;

      if (zone === 'center') {
        // ── NEST: move droppedProject INTO project ──
        if (droppedProject.parentId) {
          const oldParent = projects.find(p => p.id === droppedProject.parentId);
          if (oldParent) oldParent.children = oldParent.children.filter(c => c !== droppedProjectId);
        }
        droppedProject.parentId = project.id;
        if (!project.children) project.children = [];
        if (!project.children.includes(droppedProjectId)) project.children.push(droppedProjectId);
        await GPMStorage.saveProjects(projects);
      } else {
        // ── REORDER: move droppedProject before/after project (same level) ──
        const sameParentId = project.parentId || null;
        
        // Remove from old parent
        if (droppedProject.parentId) {
          const oldParent = projects.find(p => p.id === droppedProject.parentId);
          if (oldParent) oldParent.children = oldParent.children.filter(c => c !== droppedProjectId);
        }
        droppedProject.parentId = sameParentId;

        // Reorder in parent's children array or root
        if (sameParentId) {
          const parent = projects.find(p => p.id === sameParentId);
          if (parent) {
            parent.children = parent.children.filter(c => c !== droppedProjectId);
            const targetIdx = parent.children.indexOf(project.id);
            const insertIdx = zone === 'top' ? targetIdx : targetIdx + 1;
            parent.children.splice(Math.max(0, insertIdx), 0, droppedProjectId);
          }
        } else {
          // Root level — reorder via order field
          const rootProjects = projects.filter(p => !p.parentId);
          const targetIdx = rootProjects.findIndex(p => p.id === project.id);
          const insertIdx = zone === 'top' ? targetIdx : targetIdx + 1;
          // Rebuild order by assigning order values
          rootProjects.splice(rootProjects.findIndex(p => p.id === droppedProjectId), 1);
          rootProjects.splice(Math.max(0, insertIdx), 0, droppedProject);
          rootProjects.forEach((p, i) => { p.order = i; });
        }
        await GPMStorage.saveProjects(projects);
      }
      gpmRenderTree();
      return;
    }
    
    // ── CHAT drop ──
    let chatId = e.dataTransfer.getData('text/gpm-chat-id');
    
    if (!chatId) {
      const plain = e.dataTransfer.getData('text/plain');
      if (plain) {
        const appMatch = plain.match(/\/app\/([a-zA-Z0-9_-]+)/);
        if (appMatch) { chatId = appMatch[1]; }
        else {
          const legacyMatch = plain.match(/\/(?:chat|c)\/([a-zA-Z0-9_-]+)/);
          chatId = legacyMatch ? legacyMatch[1] : plain;
        }
      }
    }
    
    if (!chatId) {
      const uri = e.dataTransfer.getData('text/uri-list');
      if (uri) {
        const appMatch = uri.match(/\/app\/([a-zA-Z0-9_-]+)/);
        if (appMatch) chatId = appMatch[1];
        else {
          const legacyMatch = uri.match(/\/(?:chat|c)\/([a-zA-Z0-9_-]+)/);
          if (legacyMatch) chatId = legacyMatch[1];
        }
      }
    }
    
    if (chatId && chatId.trim() && !chatId.startsWith('http')) {
      const cleanId = chatId.trim();
      const chatTitle = e.dataTransfer.getData('text/gpm-chat-title');
      await GPMStorage.assignChat(cleanId, project.id);
      if (chatTitle) {
        const cm = await GPMStorage.getChatMap();
        if (!cm[cleanId]?.alias) await GPMStorage.setChatAlias(cleanId, chatTitle);
      }
      gpmRenderTree();
    }
  });

  // Right-click context menu
  row.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    gpmShowProjectContextMenu(e.clientX, e.clientY, project, allProjects);
  });

  frag.appendChild(row);
  if (subList) frag.appendChild(subList);
  return frag;
}

// ══════════════════════════════════════
//  CREATE CHAT ROW
// ══════════════════════════════════════

function gpmCreateChatRow(chatId, mapping, project, allProjects) {
  const alias = mapping?.alias || chatId;
  const pinned = mapping?.pinned || false;
  const currentChatId = gpmGetCurrentChatId();

  const row = document.createElement('div');
  row.setAttribute('data-gpm', 'chat');
  if (pinned) row.classList.add('gpm-pinned');
  if (chatId === currentChatId) row.classList.add('gpm-active');
  row.draggable = true;

  const dot = document.createElement('span');
  dot.setAttribute('data-gpm', 'chat-dot');
  dot.style.background = project.color;

  const label = document.createElement('span');
  label.setAttribute('data-gpm', 'chat-label');
  label.textContent = alias;

  row.append(dot, label);

  row.addEventListener('click', (e) => {
    e.stopPropagation();
    gpmNavigateToChat(chatId);
  });

  row.addEventListener('dragstart', (e) => {
    e.dataTransfer.effectAllowed = 'copyMove';
    e.dataTransfer.setData('text/gpm-chat-id', chatId);
    e.dataTransfer.setData('text/plain', chatId);
    e.dataTransfer.setData('text/gpm-chat-projectid', project.id);
    row.style.opacity = '0.5';
  });
  row.addEventListener('dragend', () => { row.style.opacity = ''; });

  // Chat reorder: drop on another chat row
  row.addEventListener('dragover', (e) => {
    const draggingChatId = e.dataTransfer.types.includes('text/gpm-chat-id');
    if (!draggingChatId) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = row.getBoundingClientRect();
    const zone = (e.clientY - rect.top) < rect.height / 2 ? 'top' : 'bottom';
    row.dataset.dropZone = zone;
    row.classList.remove('gpm-drag-top', 'gpm-drag-bottom');
    row.classList.add(zone === 'top' ? 'gpm-drag-top' : 'gpm-drag-bottom');
  });

  row.addEventListener('dragleave', () => {
    row.classList.remove('gpm-drag-top', 'gpm-drag-bottom');
    delete row.dataset.dropZone;
  });

  row.addEventListener('drop', async (e) => {
    const droppedChatId = e.dataTransfer.getData('text/gpm-chat-id');
    if (!droppedChatId || droppedChatId === chatId) return;
    e.preventDefault();
    e.stopPropagation();
    const zone = row.dataset.dropZone || 'bottom';
    row.classList.remove('gpm-drag-top', 'gpm-drag-bottom');
    delete row.dataset.dropZone;

    // Reorder chatIds within the same project
    const projects = await GPMStorage.getProjects();
    const proj = projects.find(p => p.id === project.id);
    if (!proj) return;

    const ids = proj.chatIds || [];
    const fromIdx = ids.indexOf(droppedChatId);
    const toIdx = ids.indexOf(chatId);
    if (fromIdx === -1) {
      // Chat from another project — assign first
      await GPMStorage.assignChat(droppedChatId, project.id);
      gpmRenderTree();
      return;
    }

    // Reorder within same project
    ids.splice(fromIdx, 1);
    const newIdx = ids.indexOf(chatId);
    ids.splice(zone === 'top' ? newIdx : newIdx + 1, 0, droppedChatId);
    proj.chatIds = ids;
    await GPMStorage.saveProjects(projects);
    gpmRenderTree();
  });

  row.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    gpmShowChatContextMenu(e.clientX, e.clientY, chatId, mapping, allProjects);
  });

  return row;
}

// ══════════════════════════════════════
//  CONTEXT MENUS (using Shadow DOM modal host)
// ══════════════════════════════════════

function gpmShowProjectContextMenu(x, y, project, allProjects) {
  console.log('[GPM] Showing project context menu for:', project.name);
  if (!gpmModalRoot) {
    console.error('[GPM] Modal root not initialized!');
    return;
  }
  
  GPMUI.showContextMenu(gpmModalRoot, {
    x, y,
    items: [
      { icon: '💬', label: t('newChatInProject'), action: () => {
        console.log('[GPM] New chat in project clicked:', project.name, 'projectId:', project.id);
        gpmPendingChatAssignment = { projectId: project.id, _ts: Date.now() };
        console.log('[GPM] Pending assignment set:', gpmPendingChatAssignment);
        gpmTriggerNewChat();
      }},
      { icon: '📂', label: t('createSubfolder'), action: () => {
        console.log('[GPM] Create subfolder clicked');
        GPMUI.createProjectModal(gpmModalRoot, {
          isSubfolder: true,
          onSave: async ({ name, icon, color }) => { await GPMStorage.createProject({ name, icon, color, parentId: project.id }); gpmRenderTree(); },
          onCancel: () => {}
        });
      }},
      { divider: true },
      { icon: '✏️', label: t('rename'), action: () => {
        console.log('[GPM] Rename clicked');
        GPMUI.createProjectModal(gpmModalRoot, {
          existing: project,
          onSave: async ({ name, icon, color }) => { await GPMStorage.updateProject(project.id, { name, icon, color }); gpmRenderTree(); },
          onCancel: () => {}
        });
      }},
      { divider: true },
      { icon: '🗑️', label: t('delete'), danger: true, action: async () => {
        console.log('[GPM] Delete clicked');
        if (confirm(t('deleteConfirm'))) { await GPMStorage.deleteProject(project.id); gpmRenderTree(); }
      }}
    ]
  });
}

function gpmShowChatContextMenu(x, y, chatId, mapping, allProjects) {
  if (!gpmModalRoot) return;
  const isPinned = mapping?.pinned || false;

  const moveSubmenu = allProjects.map(p => ({
    icon: p.icon, label: p.name,
    action: async () => { await GPMStorage.assignChat(chatId, p.id); gpmRenderTree(); }
  }));

  GPMUI.showContextMenu(gpmModalRoot, {
    x, y,
    items: [
      { icon: isPinned ? '📌' : '📍', label: isPinned ? t('unpinChat') : t('pinChat'),
        action: async () => { await GPMStorage.togglePinChat(chatId); gpmRenderTree(); } },
      { icon: '✏️', label: t('renameChat'), action: () => {
        GPMUI.createRenameModal(gpmModalRoot, {
          currentName: mapping?.alias || chatId,
          onSave: async (n) => { await GPMStorage.setChatAlias(chatId, n); gpmRenderTree(); },
          onCancel: () => {}
        });
      }},
      { icon: '📂', label: t('moveToProject'), submenu: moveSubmenu },
      { divider: true },
      { icon: '🗑️', label: t('removeFromProject'), danger: true,
        action: async () => { await GPMStorage.unassignChat(chatId); gpmRenderTree(); } }
    ]
  });
}

// ══════════════════════════════════════
//  GEMINI INTERACTION HELPERS
// ══════════════════════════════════════

function gpmTriggerNewChat() {
  console.log('[GPM] Triggering new chat...');
  
  const currentPath = window.location.pathname;
  const isOnHome = currentPath === '/app' || currentPath === '/app/' || currentPath === '/';
  
  if (isOnHome) {
    // Already on home page — just focus the input area so user can start typing
    // The pending assignment will fire when URL changes to /app/<id> after sending
    console.log('[GPM] Already on home, focusing input. Pending assignment will trigger on URL change.');
    const input = document.querySelector(GPM_SELECTORS.inputArea);
    if (input) input.focus();
    return;
  }
  
  // Not on home — need to navigate there
  // Try clicking the "New chat" link first (SPA navigation)
  const candidates = document.querySelectorAll('a[href="/app"]');
  let clicked = false;
  
  for (const el of candidates) {
    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
    const text = (el.textContent || '').trim().toLowerCase();
    if (text.includes('new chat') || text.includes('yeni sohbet') ||
        ariaLabel.includes('new chat') || ariaLabel.includes('yeni sohbet')) {
      console.log('[GPM] Clicking "New chat" link');
      el.click();
      clicked = true;
      break;
    }
  }
  
  if (!clicked && candidates.length > 0) {
    candidates[0].click();
    clicked = true;
  }
  
  if (!clicked) {
    console.log('[GPM] Fallback: navigating to /app');
    window.location.href = 'https://gemini.google.com/app';
  }
}

function gpmNavigateToChat(chatId) {
  // Try clicking the sidebar link first
  const links = document.querySelectorAll(GPM_SELECTORS.chatItem);
  for (const link of links) {
    const href = link.getAttribute('href') || '';
    if (href.includes(chatId)) { link.click(); return; }
  }
  // Fallback: direct navigation using /app/<id> format
  window.location.href = `https://gemini.google.com/app/${chatId}`;
}

function gpmGetCurrentChatId() {
  // Gemini uses /app/<id> format for chats
  // /app alone = home page (no chat), /app/<id> = specific chat
  const path = window.location.pathname;
  
  // New format: /app/<chatId>
  const appMatch = path.match(/^\/app\/([a-zA-Z0-9_-]+)/);
  if (appMatch) return appMatch[1];
  
  // Legacy formats
  const legacyMatch = path.match(/\/(?:chat|c)\/([a-zA-Z0-9_-]+)/);
  if (legacyMatch) return legacyMatch[1];
  
  return null;
}

// ══════════════════════════════════════
//  SPA NAVIGATION OBSERVER
// ══════════════════════════════════════

function gpmObserveSPANavigation() {
  let lastUrl = location.href;
  const check = () => {
    if (location.href !== lastUrl) { lastUrl = location.href; gpmOnNavigate(); }
  };
  new MutationObserver(check).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('popstate', check);
  const origPush = history.pushState;
  const origReplace = history.replaceState;
  history.pushState = function (...a) { origPush.apply(this, a); check(); };
  history.replaceState = function (...a) { origReplace.apply(this, a); check(); };
}

function gpmOnNavigate() {
  setTimeout(() => {
    if (!gpmIsContextValid()) return;
    if (!document.querySelector('#gpm-project-section')) {
      const sidebar = document.querySelector(GPM_SELECTORS.sidebar);
      if (sidebar) gpmInjectProjectSection(sidebar);
    }
    gpmInjectQuickPromptTrigger();
  }, 600);
}

// ══════════════════════════════════════
//  NEW CHAT OBSERVER
// ══════════════════════════════════════

function gpmObserveNewChats() {
  let lastChatId = gpmGetCurrentChatId();
  let lastUrl = location.href;
  
  // Watch for URL changes — when a new chat is created, URL changes to /chat/xxx
  // This happens AFTER the user sends their first message
  setInterval(() => {
    const currentUrl = location.href;
    const id = gpmGetCurrentChatId();
    
    // Detect URL change
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      console.log('[GPM] URL changed to:', currentUrl, 'chatId:', id);
    }
    
    if (id && id !== lastChatId) {
      console.log('[GPM] Chat ID changed:', lastChatId, '->', id);
      lastChatId = id;
      
      if (gpmPendingChatAssignment) {
        const { projectId } = gpmPendingChatAssignment;
        gpmPendingChatAssignment = null;
        console.log('[GPM] Auto-assigning chat', id, 'to project:', projectId);
        GPMStorage.assignChat(id, projectId).then(() => {
          console.log('[GPM] Chat assigned successfully');
          gpmRenderTree();
        });
      } else {
        // Re-render to update active chat highlight
        gpmRenderTree();
      }
    }
    
    // Also detect when we navigate AWAY from a chat (to home/app page)
    // This means "new chat" was triggered
    if (!id && lastChatId) {
      lastChatId = null;
      console.log('[GPM] Navigated to home page (new chat pending:', !!gpmPendingChatAssignment, ')');
    }
  }, 500);
  
  // Timeout for pending assignment (120 seconds — user needs time to type)
  setInterval(() => {
    if (gpmPendingChatAssignment && gpmPendingChatAssignment._ts) {
      if (Date.now() - gpmPendingChatAssignment._ts > 120000) {
        console.warn('[GPM] Pending assignment timed out');
        gpmPendingChatAssignment = null;
      }
    }
  }, 5000);

  // Enhance native chat items for drag & drop + detect deleted chats
  const sidebar = document.querySelector(GPM_SELECTORS.sidebar);
  if (sidebar) {
    let enhanceTimeout = null;
    let lastChatCount = document.querySelectorAll('a[href^="/app/"]').length;
    
    new MutationObserver(() => {
      clearTimeout(enhanceTimeout);
      enhanceTimeout = setTimeout(() => {
        gpmEnhanceNativeChatItems();
        
        // Check if chat count decreased (a chat was deleted)
        const currentCount = document.querySelectorAll('a[href^="/app/"]').length;
        if (currentCount < lastChatCount) {
          console.log('[GPM] Chat count decreased:', lastChatCount, '->', currentCount, '— syncing');
          gpmRenderTree();
        }
        lastChatCount = currentCount;
      }, 500);
    }).observe(sidebar, { childList: true, subtree: true });
    gpmEnhanceNativeChatItems();
  }
}

function gpmEnhanceNativeChatItems() {
  // Gemini uses /app/<id> format — find all chat links (exclude /app itself which is "New chat")
  const chatItems = document.querySelectorAll('a[href^="/app/"]');
  
  chatItems.forEach(item => {
    if (item.dataset.gpmEnhanced) return;
    // Skip items inside our own GPM container
    if (item.closest('[data-gpm]')) return;
    
    item.dataset.gpmEnhanced = 'true';

    const href = item.getAttribute('href') || '';
    // Extract chat ID from /app/<chatId>
    const m = href.match(/^\/app\/([a-zA-Z0-9_-]+)/);
    if (!m) return;
    const chatId = m[1];

    // Make the whole <a> draggable
    item.draggable = true;
    
    // Get the chat title from the link text
    const chatTitle = (item.textContent || '').trim();
    
    item.addEventListener('dragstart', (e) => {
      e.stopPropagation();
      console.log('[GPM] Drag started for chat:', chatId, 'title:', chatTitle);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/gpm-chat-id', chatId);
      e.dataTransfer.setData('text/gpm-chat-title', chatTitle);
      e.dataTransfer.setData('text/plain', chatId);
      item.style.opacity = '0.5';
    });
    
    item.addEventListener('dragend', () => {
      item.style.opacity = '';
    });

    // Custom right-click context menu
    item.addEventListener('contextmenu', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (!gpmModalRoot) return;
      
      const projects = await GPMStorage.getProjects();
      const chatMap = await GPMStorage.getChatMap();
      gpmShowChatContextMenu(e.clientX, e.clientY, chatId, chatMap[chatId], projects);
    });
  });
}

// ══════════════════════════════════════
//  QUICK PROMPTS
// ══════════════════════════════════════

function gpmInjectQuickPromptTrigger() {
  if (document.querySelector('#gpm-qp-trigger')) return;

  const btn = document.createElement('button');
  btn.id = 'gpm-qp-trigger';
  btn.textContent = '⚡';
  btn.title = t('quickPrompts');
  btn.type = 'button';
  btn.style.cssText = 'background:none;border:none;font-size:18px;cursor:pointer;padding:4px 8px;border-radius:50%;color:inherit;opacity:0.6;transition:opacity 150ms;display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;flex-shrink:0;vertical-align:middle;';
  btn.addEventListener('mouseenter', () => { btn.style.opacity = '1'; });
  btn.addEventListener('mouseleave', () => { btn.style.opacity = '0.6'; });
  btn.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); gpmToggleQuickPrompts(); });

  // The toolbar row is DIV.leading-actions-wrapper containing:
  //   [0] uploader-button-container (+)
  //   [1] TOOLBOX-DRAWER (Tools)
  // We insert ⚡ as [2] right after TOOLBOX-DRAWER
  const leadingActions = document.querySelector('.leading-actions-wrapper');
  if (leadingActions) {
    const toolbox = leadingActions.querySelector('toolbox-drawer');
    if (toolbox) {
      try {
        leadingActions.insertBefore(btn, toolbox.nextSibling);
        console.log('[GPM] ⚡ button placed in leading-actions-wrapper after TOOLBOX-DRAWER');
        return;
      } catch (e) {
        console.warn('[GPM] Insert into leading-actions failed:', e.message);
      }
    } else {
      // No toolbox-drawer, just append to the row
      leadingActions.appendChild(btn);
      console.log('[GPM] ⚡ button appended to leading-actions-wrapper');
      return;
    }
  }

  // Fallback: find by class pattern
  const toolsContainer = document.querySelector('.toolbox-drawer-button-container');
  if (toolsContainer) {
    let row = toolsContainer.parentElement;
    // Walk up until we find a container with multiple children or leading-actions
    for (let i = 0; i < 3; i++) {
      if (!row) break;
      if (row.children.length > 1 || row.classList.contains('leading-actions-wrapper')) break;
      row = row.parentElement;
    }
    if (row) {
      try {
        row.appendChild(btn);
        console.log('[GPM] ⚡ button placed via toolbox walk-up');
        return;
      } catch (e) { /* continue to last resort */ }
    }
  }

  // Last resort: append near input area
  const inputArea = document.querySelector(GPM_SELECTORS.inputArea);
  if (!inputArea) return;
  const container = inputArea.closest(GPM_SELECTORS.inputContainer) || inputArea.parentElement;
  if (container) {
    container.appendChild(btn);
    console.log('[GPM] ⚡ button placed as last resort near input');
  }
}

// Continuously monitor and re-inject Quick Prompt button if missing
function gpmObserveQuickPromptButton() {
  let checkInterval = setInterval(() => {
    if (!gpmIsContextValid()) { clearInterval(checkInterval); return; }
    const btn = document.querySelector('#gpm-qp-trigger');
    const leadingActions = document.querySelector('.leading-actions-wrapper');
    
    // If button exists and is still in DOM, we're good
    if (btn && btn.parentElement) return;
    
    // If leading-actions exists but button is missing, re-inject
    if (leadingActions) {
      gpmInjectQuickPromptTrigger();
    }
  }, 1000); // Check every second
  
  // Also observe DOM changes in the toolbar area
  const observer = new MutationObserver(() => {
    const btn = document.querySelector('#gpm-qp-trigger');
    const leadingActions = document.querySelector('.leading-actions-wrapper');
    if (leadingActions && !btn) {
      setTimeout(gpmInjectQuickPromptTrigger, 100);
    }
  });
  
  // Start observing when body is ready
  const startObserving = () => {
    const body = document.body;
    if (body) {
      observer.observe(body, { childList: true, subtree: true });
    }
  };
  
  if (document.body) {
    startObserving();
  } else {
    document.addEventListener('DOMContentLoaded', startObserving);
  }
}

let gpmQPOpen = false;

async function gpmToggleQuickPrompts() {
  if (!gpmModalRoot) return;
  const existing = gpmModalRoot.querySelector('.gpm-quick-prompts');
  if (existing) { existing.remove(); gpmQPOpen = false; return; }

  gpmQPOpen = true;
  const prompts = await GPMStorage.getQuickPrompts();
  const panel = GPMUI.createQuickPromptsPanel(gpmModalRoot, {
    prompts,
    onSelect: (p) => {
      gpmInsertPromptText(p.content);
      gpmModalRoot.querySelector('.gpm-quick-prompts')?.remove();
      gpmQPOpen = false;
    },
    onAdd: () => {
      GPMUI.createQuickPromptModal(gpmModalRoot, {
        onSave: async (data) => {
          await GPMStorage.saveQuickPrompt(data);
          gpmModalRoot.querySelector('.gpm-quick-prompts')?.remove();
          gpmToggleQuickPrompts();
        },
        onCancel: () => {}
      });
    },
    onEdit: (prompt) => {
      GPMUI.createQuickPromptModal(gpmModalRoot, {
        existing: prompt,
        onSave: async (data) => {
          await GPMStorage.updateQuickPrompt(prompt.id, data);
          gpmModalRoot.querySelector('.gpm-quick-prompts')?.remove();
          gpmToggleQuickPrompts();
        },
        onCancel: () => {}
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
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
          try {
            const imported = JSON.parse(ev.target.result);
            if (Array.isArray(imported)) {
              // Merge: add imported prompts
              for (const p of imported) {
                if (p.title && p.content) {
                  await GPMStorage.saveQuickPrompt({ title: p.title, content: p.content, category: p.category || 'General' });
                }
              }
              gpmModalRoot.querySelector('.gpm-quick-prompts')?.remove();
              gpmToggleQuickPrompts();
            }
          } catch (err) {
            console.error('[GPM] Failed to restore prompts:', err);
          }
        };
        reader.readAsText(file);
        fileInput.remove();
      });
      document.body.appendChild(fileInput);
      fileInput.click();
    },
    onClose: () => { gpmModalRoot.querySelector('.gpm-quick-prompts')?.remove(); gpmQPOpen = false; }
  });
  gpmModalRoot.appendChild(panel);
}

function gpmInsertPromptText(text) {
  const input = document.querySelector(GPM_SELECTORS.inputArea);
  if (!input) return;
  if (input.tagName === 'TEXTAREA') {
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    input.focus();
    input.textContent = text;
    input.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
  }
  input.focus();
}

// ══════════════════════════════════════
//  MODALS
// ══════════════════════════════════════

function gpmShowCreateProjectModal() {
  if (!gpmModalRoot) return;
  GPMUI.createProjectModal(gpmModalRoot, {
    onSave: async ({ name, icon, color }) => {
      await GPMStorage.createProject({ name, icon, color });
      gpmRenderTree();
    },
    onCancel: () => {}
  });
}

async function gpmShowSettingsModal() {
  if (!gpmModalRoot) return;
  const settings = await GPMStorage.getSettings();
  GPMUI.createSettingsModal(gpmModalRoot, {
    settings,
    onSave: async (s) => { await GPMStorage.saveSettings(s); gpmSetLang(s.lang); gpmRenderTree(); },
    onCancel: () => {},
    onExport: async () => {
      const json = await GPMStorage.exportAll();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `gpm-backup-${Date.now()}.json`; a.click();
      URL.revokeObjectURL(url);
    },
    onImport: async (jsonStr) => {
      try { await GPMStorage.importAll(jsonStr); const s = await GPMStorage.getSettings(); gpmSetLang(s.lang); gpmRenderTree(); }
      catch (e) { alert(t('importError')); }
    },
    onClear: async () => { await GPMStorage.clearAll(); gpmSetLang('en'); gpmRenderTree(); }
  });
}

// ══════════════════════════════════════
//  CROSS-TAB SYNC & BOOT
// ══════════════════════════════════════

try {
  chrome.runtime.onMessage.addListener((msg) => {
    if (!gpmIsContextValid()) return;
    if (msg.type === 'GPM_SYNC') gpmRenderTree();
  });
} catch (e) {
  console.warn('[GPM] Could not register message listener:', e.message);
}

(function boot() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', gpmInit);
  } else {
    gpmInit();
  }
})();
