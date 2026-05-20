/**
 * project-tree.js — Project Tree Rendering, Rows, Context Menus, Drag & Drop
 *
 * Handles:
 *   - gpmRenderTree()          — Full tree render with DocumentFragment
 *   - gpmScheduleAliasResolve() — Debounced alias resolution
 *   - gpmCreateProjectRow()    — Recursive project row with drag-drop
 *   - gpmCreateChatRow()       — Chat row with drag-drop and reorder
 *   - gpmShowProjectContextMenu() — Project right-click menu
 *   - gpmShowChatContextMenu()    — Chat right-click menu
 *   - gpmShowCreateProjectModal() — New project modal
 *   - gpmShowSettingsModal()      — Settings modal
 *
 * Dependencies (globals from earlier scripts):
 *   - GPM_CONFIG, GPM_STATE, gpmLog, gpmWarn, gpmError, extractChatIdFromUrl (config.js)
 *   - GPM_SELECTORS (selectors.js)
 *   - GPMStorage (storage.js)
 *   - GPMUI (ui_elements.js)
 *   - t(), gpmSetLang() (i18n.js)
 *   - gpmNavigateToChat(), gpmTriggerNewChat(), gpmGetCurrentChatId() (navigation.js)
 */

// ── Debounced alias resolver (separated from render to avoid render→save→render loops) ──
function gpmScheduleAliasResolve() {
  clearTimeout(GPM_STATE.aliasResolveTimer);
  GPM_STATE.aliasResolveTimer = setTimeout(async () => {
    const chatMap = await GPMStorage.getChatMap();
    let aliasUpdated = false;
    const sidebarLinks = document.querySelectorAll('a[href^="/app/"]');
    for (const link of sidebarLinks) {
      const href = link.getAttribute('href') || '';
      const cid = extractChatIdFromUrl(href);
      if (!cid) continue;
      if (!chatMap[cid]) continue;

      const currentAlias = chatMap[cid].alias || '';
      const isAutoResolved = chatMap[cid]._autoResolved || false;
      // Update logic:
      // - If alias is empty/chatId → definitely needs a title
      // - If alias is short (< 5 chars) → likely garbage, try to find better
      // - If alias is auto-resolved → keep trying until we get a real title
      const needsUpdate = !currentAlias || currentAlias === cid || currentAlias.length < 5 || isAutoResolved;

      if (needsUpdate) {
        // Radical title extraction: Gemini's DOM structure is unknown, so we try
        // every possible source. Stop at the first non-empty, non-garbage value.
        let title = '';

        // 1. aria-label on the link itself (Gemini often sets these)
        const ariaLabel = (link.getAttribute('aria-label') || '').trim();
        if (ariaLabel && ariaLabel.length > 1 && !ariaLabel.startsWith('http')) title = ariaLabel;

        // 2. title attribute
        if (!title) {
          const tAttr = (link.getAttribute('title') || '').trim();
          if (tAttr && tAttr.length > 1) title = tAttr;
        }

        // 3. Any child element with text > 2 chars that isn't an icon/number
        if (!title) {
          const walker = document.createTreeWalker(link, NodeFilter.SHOW_TEXT, null);
          let node;
          const texts = [];
          while ((node = walker.nextNode())) {
            const txt = node.textContent?.trim();
            if (txt && txt.length > 2 && !/^\d+$/.test(txt) && !/^[\W_]+$/.test(txt)) {
              texts.push(txt);
            }
          }
          // Prefer the longest plausible text node (usually the title, not icon labels)
          if (texts.length > 0) {
            texts.sort((a, b) => b.length - a.length);
            title = texts[0];
          }
        }

        // 4. Direct textContent as absolute last resort (often polluted on new UI)
        if (!title) {
          title = (link.textContent || '').trim();
        }

        // Filter out known garbage strings
        const GARBAGE = [
          'new chat',
          'yeni sohbet',
          'nouveau chat',
          'neuer chat',
          'nuova conversazione',
          'nova conversa',
        ];
        const lowerTitle = title.toLowerCase();
        const isGarbage = GARBAGE.some((g) => lowerTitle === g || lowerTitle.startsWith(g + ' '));
        if (isGarbage) {
          title = '';
        }

        // If the CURRENT alias is garbage, clear it so the next recheck tries again
        const isCurrentGarbage = GARBAGE.some((g) => currentAlias.toLowerCase().startsWith(g));
        if (isCurrentGarbage) {
          chatMap[cid].alias = '';
          chatMap[cid]._autoResolved = true;
          aliasUpdated = true;
        }

        if (title && title !== cid && title !== currentAlias && title.length > 1 && !isGarbage) {
          chatMap[cid].alias = title;
          chatMap[cid]._autoResolved = true;
          aliasUpdated = true;
        }
      }
    }
    if (aliasUpdated) {
      await GPMStorage.saveChatMap(chatMap);
      gpmRenderTree();
    }
  }, GPM_CONFIG.SYNC_DEBOUNCE);
}

// ── Search highlight utility — safe text highlighting without innerHTML ──
function gpmHighlightText(text, query) {
  if (!query || !text) return document.createTextNode(text || '');
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);
  if (idx === -1) return document.createTextNode(text);
  const frag = document.createDocumentFragment();
  if (idx > 0) frag.appendChild(document.createTextNode(text.slice(0, idx)));
  const mark = document.createElement('mark');
  mark.className = 'gpm-highlight';
  mark.textContent = text.slice(idx, idx + query.length);
  frag.appendChild(mark);
  if (idx + query.length < text.length) frag.appendChild(document.createTextNode(text.slice(idx + query.length)));
  return frag;
}

function _gpmBuildChildMap(allProjs) {
  const map = new Map();
  for (const p of allProjs) {
    if (p.parentId) {
      const children = map.get(p.parentId) || [];
      children.push(p);
      map.set(p.parentId, children);
    }
  }
  return map;
}

function _gpmCountAllChats(proj, childMap) {
  const own = (proj.chatIds || []).length;
  const kids = childMap.get(proj.id) || [];
  return own + kids.reduce((sum, kid) => sum + _gpmCountAllChats(kid, childMap), 0);
}

// ══════════════════════════════════════
//  RENDER PROJECT TREE (Direct DOM)
// ══════════════════════════════════════

async function gpmRenderTree() {
  if (!GPM_STATE.container) return;

  const projects = await GPMStorage.getProjects();
  const chatMap = await GPMStorage.getChatMap();
  const rootProjects = GPMStorage.getRootProjects(projects);
  const _childMap = _gpmBuildChildMap(projects);

  // Schedule alias resolution separately (avoids render→save→render loop)
  gpmScheduleAliasResolve();

  // ── Build entire tree in DocumentFragment for batch DOM update ──
  const fragment = document.createDocumentFragment();

  // ── Section Header: "Projects ▾" ──
  const header = document.createElement('div');
  header.setAttribute('data-gpm', 'header');
  header.setAttribute('role', 'button');
  header.setAttribute('tabindex', '0');
  header.setAttribute('aria-expanded', 'true');
  header.setAttribute('aria-label', t('projects'));

  const chevron = document.createElement('span');
  chevron.setAttribute('data-gpm', 'header-chevron');
  chevron.className = 'gpm-open';
  chevron.textContent = '▾';
  chevron.setAttribute('aria-hidden', 'true');

  const title = document.createElement('span');
  title.setAttribute('data-gpm', 'header-title');
  title.textContent = t('projects');

  // Settings gear — only visible on header hover
  const gear = document.createElement('span');
  gear.textContent = '⚙';
  gear.setAttribute('role', 'button');
  gear.setAttribute('tabindex', '0');
  gear.setAttribute('aria-label', t('settings'));
  gear.style.cssText = 'cursor:pointer;font-size:14px;opacity:0;transition:opacity 150ms;padding:2px 4px;';
  gear.addEventListener('click', (e) => {
    e.stopPropagation();
    gpmShowSettingsModal();
  });
  gear.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      gpmShowSettingsModal();
    }
  });
  header.addEventListener('mouseenter', () => {
    gear.style.opacity = '0.6';
  });
  header.addEventListener('mouseleave', () => {
    gear.style.opacity = '0';
  });

  header.append(chevron, title, gear);
  fragment.appendChild(header);

  // ── Search input (debounced project/chat filter) ──
  const searchWrap = document.createElement('div');
  searchWrap.setAttribute('data-gpm', 'search-wrap');
  searchWrap.style.position = 'relative';
  const searchInput = document.createElement('input');
  searchInput.setAttribute('data-gpm', 'search');
  searchInput.setAttribute('type', 'text');
  searchInput.setAttribute('placeholder', '🔍  ' + t('search'));
  searchInput.setAttribute('aria-label', t('search'));
  // Preserve search query across re-renders
  searchInput.value = GPM_STATE._searchQuery || '';
  searchWrap.appendChild(searchInput);

  // Clear button (only visible when search has text)
  if (GPM_STATE._searchQuery) {
    const clearBtn = document.createElement('button');
    clearBtn.setAttribute('data-gpm', 'search-clear');
    clearBtn.type = 'button';
    clearBtn.textContent = '✕';
    clearBtn.title = t('clearSearch');
    clearBtn.setAttribute('aria-label', t('clearSearch'));
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      GPM_STATE._searchQuery = '';
      gpmRenderTree();
    });
    searchWrap.appendChild(clearBtn);
  }

  fragment.appendChild(searchWrap);

  // ── Items List ──
  const list = document.createElement('div');
  list.setAttribute('data-gpm', 'list');
  list.setAttribute('role', 'tree');
  list.setAttribute('aria-label', t('projects'));

  // Toggle collapse
  let collapsed = false;
  const toggleCollapse = () => {
    collapsed = !collapsed;
    list.classList.toggle('gpm-hidden', collapsed);
    searchWrap.classList.toggle('gpm-hidden', collapsed);
    chevron.className = collapsed ? 'gpm-closed' : 'gpm-open';
    chevron.textContent = collapsed ? '▸' : '▾';
    header.setAttribute('aria-expanded', String(!collapsed));
  };
  header.addEventListener('click', toggleCollapse);
  header.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleCollapse();
    }
  });

  // ── Search filter helper (with match source tracking + cache for performance) ──
  const searchQuery = (GPM_STATE._searchQuery || '').toLowerCase();
  const matchCache = new Map();

  function projectMatchesSearch(project, query) {
    if (!query) return { matches: true, source: null };
    const cached = matchCache.get(project.id);
    if (cached) return cached;

    // Check project name
    if (project.name.toLowerCase().includes(query)) {
      const result = { matches: true, source: 'name' };
      matchCache.set(project.id, result);
      return result;
    }
    // Check chat aliases
    const cids = project.chatIds || [];
    for (const cid of cids) {
      const alias = chatMap[cid]?.alias || '';
      if (alias.toLowerCase().includes(query) || cid.toLowerCase().includes(query)) {
        const result = { matches: true, source: 'chat' };
        matchCache.set(project.id, result);
        return result;
      }
    }
    // Check children recursively
    const kids = projects.filter((p) => p.parentId === project.id);
    for (const kid of kids) {
      if (projectMatchesSearch(kid, query).matches) {
        const result = { matches: true, source: 'child' };
        matchCache.set(project.id, result);
        return result;
      }
    }
    const result = { matches: false, source: null };
    matchCache.set(project.id, result);
    return result;
  }

  // Store matchCache for use in row creation functions
  GPM_STATE._matchCache = matchCache;

  // ── "+ New Project" row ──
  const newRow = document.createElement('div');
  newRow.setAttribute('data-gpm', 'item');
  newRow.setAttribute('data-gpm-role', 'new-project');
  newRow.setAttribute('role', 'treeitem');
  newRow.setAttribute('tabindex', '0');
  newRow.setAttribute('aria-label', t('newProject'));

  const newIcon = document.createElement('span');
  newIcon.setAttribute('data-gpm', 'item-icon');
  newIcon.textContent = '+';

  const newLabel = document.createElement('span');
  newLabel.setAttribute('data-gpm', 'item-label');
  newLabel.textContent = t('newProject');

  newRow.append(newIcon, newLabel);
  newRow.addEventListener('click', () => gpmShowCreateProjectModal());
  newRow.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      gpmShowCreateProjectModal();
    }
  });
  if (!searchQuery) list.appendChild(newRow);

  // ── Empty State (UX-002) ──
  if (rootProjects.length === 0 && !searchQuery) {
    const emptyState = document.createElement('div');
    emptyState.setAttribute('data-gpm', 'empty-state');
    emptyState.style.cssText = 'padding:16px 24px;text-align:center;opacity:0.5;font-size:13px;line-height:1.5;';
    emptyState.textContent = t('noProjects') || 'Drag chats here or click + to create a project';
    list.appendChild(emptyState);
  }

  // ── Project Rows ── (sorted by order field, filtered by search)
  const sortedRootProjects = [...rootProjects].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  let matchCount = 0;
  sortedRootProjects.forEach((project) => {
    if (searchQuery && !projectMatchesSearch(project, searchQuery).matches) return;
    matchCount++;
    const row = gpmCreateProjectRow(project, projects, chatMap, _childMap);
    list.appendChild(row);
  });

  // No results message
  if (searchQuery && matchCount === 0) {
    const noResults = document.createElement('div');
    noResults.setAttribute('data-gpm', 'empty-state');
    noResults.style.cssText = 'padding:16px 24px;text-align:center;opacity:0.5;font-size:13px;line-height:1.5;';
    noResults.textContent = t('noMatchingPrompts');
    list.appendChild(noResults);
  }

  // Search result count display
  if (searchQuery && matchCount > 0) {
    const countEl = document.createElement('div');
    countEl.setAttribute('data-gpm', 'search-count');
    countEl.textContent = matchCount + ' ' + t('searchResults');
    searchWrap.appendChild(countEl);
  }

  fragment.appendChild(list);

  // ── Debounced search handler ──
  let searchTimer = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      GPM_STATE._searchQuery = searchInput.value.trim();
      gpmRenderTree();
      // Re-focus and restore cursor after render
      setTimeout(() => {
        const newInput = GPM_STATE.container?.querySelector('[data-gpm="search"]');
        if (newInput) {
          newInput.focus();
          newInput.selectionStart = newInput.selectionEnd = newInput.value.length;
        }
      }, 10);
    }, GPM_CONFIG.SYNC_DEBOUNCE);
  });
  // Clear search on Escape
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && searchInput.value) {
      e.preventDefault();
      e.stopPropagation();
      GPM_STATE._searchQuery = '';
      searchInput.value = '';
      gpmRenderTree();
    }
  });

  // ── Divider ──
  const divider = document.createElement('div');
  divider.setAttribute('data-gpm', 'divider');
  fragment.appendChild(divider);

  // ── Single batch DOM update — replaces innerHTML = '' approach ──
  while (GPM_STATE.container.firstChild) GPM_STATE.container.removeChild(GPM_STATE.container.firstChild);
  GPM_STATE.container.appendChild(fragment);
}

// ══════════════════════════════════════
//  CREATE PROJECT ROW (recursive)
// ══════════════════════════════════════

function gpmCreateProjectRow(project, allProjects, chatMap, childMap) {
  const frag = document.createDocumentFragment();
  const children = allProjects.filter((p) => p.parentId === project.id);
  const chatIds = project.chatIds || [];
  const activeQuery = (GPM_STATE._searchQuery || '').toLowerCase();

  // ── Main row ──
  const row = document.createElement('div');
  row.setAttribute('data-gpm', 'item');
  row.setAttribute('role', 'treeitem');
  row.setAttribute('tabindex', '0');
  row.setAttribute('aria-label', project.icon + ' ' + project.name);
  row.dataset.projectId = project.id;
  row.draggable = true;

  const icon = document.createElement('span');
  icon.setAttribute('data-gpm', 'item-icon');
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = project.icon;

  const label = document.createElement('span');
  label.setAttribute('data-gpm', 'item-label');
  if (activeQuery) {
    label.appendChild(gpmHighlightText(project.name, activeQuery));
  } else {
    label.textContent = project.name;
  }

  const count = document.createElement('span');
  count.setAttribute('data-gpm', 'item-count');
  const total = _gpmCountAllChats(project, childMap);
  count.textContent = total > 0 ? total : '';

  row.append(icon, label, count);

  // Match source badge (only during search)
  if (activeQuery && GPM_STATE._matchCache) {
    const matchInfo = GPM_STATE._matchCache.get(project.id);
    if (matchInfo && matchInfo.matches && matchInfo.source && matchInfo.source !== 'name') {
      const badge = document.createElement('span');
      badge.className = 'gpm-match-badge';
      badge.setAttribute('aria-hidden', 'true');
      badge.textContent = matchInfo.source === 'chat' ? '💬' : '📂';
      badge.title = matchInfo.source === 'chat' ? t('matchInChat') : t('matchInSubfolder');
      row.appendChild(badge);
    }
  }

  // ── Project Drag (to move project into another project OR reorder) ──
  row.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/gpm-project-id', project.id);
    e.dataTransfer.setData('text/gpm-project-parentid', project.parentId || '');
    row.style.opacity = '0.5';
  });
  row.addEventListener('dragend', () => {
    row.style.opacity = '';
  });

  // Click to expand/collapse
  const hasContent = children.length > 0 || chatIds.length > 0;
  let subList = null;

  if (hasContent) {
    // Auto-expand: when search is active and this project subtree has matches, force expand
    const forceExpand = activeQuery && GPM_STATE._matchCache?.get(project.id)?.matches;
    row.setAttribute('aria-expanded', String(forceExpand || !project.collapsed));
    subList = document.createElement('div');
    subList.setAttribute('data-gpm', 'sublist');
    subList.setAttribute('role', 'group');
    if (project.collapsed && !forceExpand) subList.classList.add('gpm-hidden');

    // Child projects FIRST (subfolders above chats)
    children.forEach((child) => {
      const childRow = gpmCreateProjectRow(child, allProjects, chatMap, childMap);
      subList.appendChild(childRow);
    });

    // Then chats (pinned first)
    const sorted = [...chatIds].sort((a, b) => (chatMap[b]?.pinned ? 1 : 0) - (chatMap[a]?.pinned ? 1 : 0));
    sorted.forEach((chatId) => {
      const chatRow = gpmCreateChatRow(chatId, chatMap[chatId], project, allProjects);
      subList.appendChild(chatRow);
    });

    const toggleProject = () => {
      project.collapsed = !project.collapsed;
      GPMStorage.updateProject(project.id, { collapsed: project.collapsed });
      subList.classList.toggle('gpm-hidden');
      row.setAttribute('aria-expanded', String(!project.collapsed));
    };
    row.addEventListener('click', (e) => {
      if (e.target.closest('[data-gpm="chat"]')) return;
      toggleProject();
    });
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleProject();
      }
      if (e.key === 'ArrowRight' && project.collapsed) {
        e.preventDefault();
        toggleProject();
      }
      if (e.key === 'ArrowLeft' && !project.collapsed) {
        e.preventDefault();
        toggleProject();
      }
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
      const isDescendant = (parentId, childId, visited) => {
        if (!visited) visited = new Set();
        if (visited.has(childId)) return false;
        visited.add(childId);
        const p = allProjects.find((pr) => pr.id === childId);
        if (!p) return false;
        if (p.parentId === parentId) return true;
        if (p.parentId) return isDescendant(parentId, p.parentId, visited);
        return false;
      };

      if (isDescendant(droppedProjectId, project.id)) {
        gpmWarn('Cannot move project into its own descendant');
        return;
      }

      const projects = await GPMStorage.getProjects();
      const droppedProject = projects.find((p) => p.id === droppedProjectId);
      if (!droppedProject) return;

      if (zone === 'center') {
        // ── NEST: move droppedProject INTO project ──
        if (droppedProject.parentId) {
          const oldParent = projects.find((p) => p.id === droppedProject.parentId);
          if (oldParent) oldParent.children = oldParent.children.filter((c) => c !== droppedProjectId);
        }
        droppedProject.parentId = project.id;
        const freshTarget = projects.find((p) => p.id === project.id);
        if (!freshTarget) return;
        if (!freshTarget.children) freshTarget.children = [];
        if (!freshTarget.children.includes(droppedProjectId)) freshTarget.children.push(droppedProjectId);
        await GPMStorage.saveProjects(projects);
      } else {
        // ── REORDER: move droppedProject before/after project (same level) ──
        const sameParentId = project.parentId || null;

        // Remove from old parent
        if (droppedProject.parentId) {
          const oldParent = projects.find((p) => p.id === droppedProject.parentId);
          if (oldParent) oldParent.children = oldParent.children.filter((c) => c !== droppedProjectId);
        }
        droppedProject.parentId = sameParentId;

        // Reorder in parent's children array or root
        if (sameParentId) {
          const parent = projects.find((p) => p.id === sameParentId);
          if (parent) {
            parent.children = parent.children.filter((c) => c !== droppedProjectId);
            const targetIdx = parent.children.indexOf(project.id);
            const insertIdx = zone === 'top' ? targetIdx : targetIdx + 1;
            parent.children.splice(Math.max(0, insertIdx), 0, droppedProjectId);
          }
        } else {
          // Root level — reorder via order field
          const rootProjects = projects.filter((p) => !p.parentId);
          const targetIdx = rootProjects.findIndex((p) => p.id === project.id);
          const insertIdx = zone === 'top' ? targetIdx : targetIdx + 1;
          // Rebuild order by assigning order values
          rootProjects.splice(
            rootProjects.findIndex((p) => p.id === droppedProjectId),
            1
          );
          rootProjects.splice(Math.max(0, insertIdx), 0, droppedProject);
          rootProjects.forEach((p, i) => {
            p.order = i;
          });
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
        chatId = extractChatIdFromUrl(plain) || plain;
      }
    }

    if (!chatId) {
      const uri = e.dataTransfer.getData('text/uri-list');
      if (uri) {
        chatId = extractChatIdFromUrl(uri);
      }
    }

    if (chatId && chatId.trim() && !chatId.startsWith('http')) {
      const cleanId = chatId.trim();
      const chatTitle = e.dataTransfer.getData('text/gpm-chat-title');

      const freshProjects = await GPMStorage.getProjects();
      const freshChatMap = await GPMStorage.getChatMap();
      const duplicateInfo = GPMValidators.findDuplicateChat(cleanId, freshProjects, freshChatMap);
      if (duplicateInfo && duplicateInfo.projectId !== project.id) {
        const confirmMove = await new Promise((resolve) => {
          GPMUI.showConfirmDialog(GPM_STATE.modalRoot, {
            title: t('moveChat') || 'Move Chat',
            message: (
              t('chatAlreadyInProject') || 'This chat is already in "{project}". Move it here instead?'
            ).replace('{project}', duplicateInfo.projectName),
            confirmText: t('move') || 'Move',
            onConfirm: () => resolve(true),
            onCancel: () => resolve(false),
          });
        });
        if (!confirmMove) return;
      }

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
  const alias = mapping?.alias && mapping.alias !== chatId ? mapping.alias : t('newChat') || 'New chat';
  const pinned = mapping?.pinned || false;
  const currentChatId = gpmGetCurrentChatId();

  const row = document.createElement('div');
  row.setAttribute('data-gpm', 'chat');
  row.setAttribute('role', 'treeitem');
  row.setAttribute('tabindex', '0');
  row.setAttribute('aria-label', (pinned ? '📌 ' : '') + alias);
  if (pinned) row.classList.add('gpm-pinned');
  if (chatId === currentChatId) {
    row.classList.add('gpm-active');
    row.setAttribute('aria-current', 'page');
  }
  row.draggable = true;

  const dot = document.createElement('span');
  dot.setAttribute('data-gpm', 'chat-dot');
  dot.setAttribute('aria-hidden', 'true');
  dot.style.background = project.color;

  const label = document.createElement('span');
  label.setAttribute('data-gpm', 'chat-label');
  const chatSearchQuery = (GPM_STATE._searchQuery || '').toLowerCase();
  if (chatSearchQuery) {
    label.appendChild(gpmHighlightText(alias, chatSearchQuery));
  } else {
    label.textContent = alias;
  }

  row.append(dot, label);

  row.addEventListener('click', (e) => {
    e.stopPropagation();
    gpmNavigateToChat(chatId);
  });
  row.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      gpmNavigateToChat(chatId);
    }
  });

  row.addEventListener('dragstart', (e) => {
    e.dataTransfer.effectAllowed = 'copyMove';
    e.dataTransfer.setData('text/gpm-chat-id', chatId);
    e.dataTransfer.setData('text/plain', chatId);
    e.dataTransfer.setData('text/gpm-chat-projectid', project.id);
    row.style.opacity = '0.5';
  });
  row.addEventListener('dragend', () => {
    row.style.opacity = '';
  });

  // Chat reorder: drop on another chat row
  row.addEventListener('dragover', (e) => {
    const draggingChatId = e.dataTransfer.types.includes('text/gpm-chat-id');
    if (!draggingChatId) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = row.getBoundingClientRect();
    const zone = e.clientY - rect.top < rect.height / 2 ? 'top' : 'bottom';
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
    const proj = projects.find((p) => p.id === project.id);
    if (!proj) return;

    const ids = proj.chatIds || [];
    const fromIdx = ids.indexOf(droppedChatId);
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

async function gpmShowProjectContextMenu(x, y, project, _allProjects) {
  gpmLog('Showing project context menu for:', project.name);
  if (!GPM_STATE.modalRoot) {
    gpmError('Modal root not initialized!');
    return;
  }

  const isFavorite = typeof GPMFavoritesManager !== 'undefined' && (await GPMFavoritesManager.isFavorite(project.id));

  GPMUI.showContextMenu(GPM_STATE.modalRoot, {
    x,
    y,
    items: [
      {
        icon: '💬',
        label: t('newChatInProject'),
        action: () => {
          gpmLog('New chat in project clicked:', project.name, 'projectId:', project.id);
          GPM_STATE.pendingChatAssignment = { projectId: project.id, _ts: Date.now() };
          gpmLog('Pending assignment set:', GPM_STATE.pendingChatAssignment);
          gpmTriggerNewChat();
        },
      },
      {
        icon: '📂',
        label: t('createSubfolder'),
        action: () => {
          gpmLog('Create subfolder clicked');
          GPMUI.createProjectModal(GPM_STATE.modalRoot, {
            isSubfolder: true,
            onSave: async ({ name, icon, color }) => {
              await GPMStorage.createProject({ name, icon, color, parentId: project.id });
              gpmRenderTree();
            },
            onCancel: () => {},
          });
        },
      },
      { divider: true },
      {
        icon: isFavorite ? '⭐' : '☆',
        label: isFavorite ? t('removeFromFavorites') : t('addToFavorites'),
        action: async () => {
          if (typeof GPMFavoritesManager !== 'undefined') {
            await GPMFavoritesManager.toggleFavorite(project.id);
            gpmRenderTree();
          }
        },
      },
      { divider: true },
      {
        icon: '✏️',
        label: t('rename'),
        action: () => {
          gpmLog('Rename clicked');
          GPMUI.createProjectModal(GPM_STATE.modalRoot, {
            existing: project,
            onSave: async ({ name, icon, color }) => {
              await GPMStorage.updateProject(project.id, { name, icon, color });
              gpmRenderTree();
            },
            onCancel: () => {},
          });
        },
      },
      { divider: true },
      {
        icon: '🗑️',
        label: t('delete'),
        danger: true,
        action: () => {
          gpmLog('Delete clicked');
          if (!GPM_STATE.modalRoot) return;
          GPMUI.showConfirmDialog(GPM_STATE.modalRoot, {
            title: t('delete'),
            message: t('deleteConfirm'),
            confirmText: t('delete'),
            danger: true,
            onConfirm: async () => {
              if (typeof GPMHistory !== 'undefined') {
                const allProjs = await GPMStorage.getProjects();
                const allChatMap = await GPMStorage.getChatMap();
                function collectDescendantIds(pid) {
                  const node = allProjs.find((p) => p.id === pid);
                  if (!node) return [pid];
                  let ids = [pid];
                  for (const childId of node.children || []) {
                    ids = ids.concat(collectDescendantIds(childId));
                  }
                  return ids;
                }
                const descendantIds = new Set(collectDescendantIds(project.id));
                const capturedProjects = allProjs.filter((p) => descendantIds.has(p.id));
                const capturedChatMap = {};
                for (const cid of Object.keys(allChatMap)) {
                  if (descendantIds.has(allChatMap[cid].projectId)) {
                    capturedChatMap[cid] = allChatMap[cid];
                  }
                }

                const action = GPMHistory.createAction('delete_project', {
                  projectId: project.id,
                  projectData: project,
                  chatMapData: capturedChatMap,
                  capturedProjects: capturedProjects,
                });
                GPMHistory.push(action);
              }
              await GPMStorage.deleteProject(project.id);
              gpmRenderTree();
            },
          });
        },
      },
    ],
  });
}

function gpmShowChatContextMenu(x, y, chatId, mapping, allProjects) {
  if (!GPM_STATE.modalRoot) return;
  const isPinned = mapping?.pinned || false;

  const moveSubmenu = allProjects.map((p) => ({
    icon: p.icon,
    label: p.name,
    action: async () => {
      const oldProjectId = mapping?.projectId;

      if (typeof GPMHistory !== 'undefined' && oldProjectId) {
        const action = GPMHistory.createAction('move_chat', {
          chatId,
          fromProjectId: oldProjectId,
          toProjectId: p.id,
        });
        GPMHistory.push(action);
      }

      await GPMStorage.assignChat(chatId, p.id);
      gpmRenderTree();
    },
  }));

  const items = [
    {
      icon: isPinned ? '📌' : '📍',
      label: isPinned ? t('unpinChat') : t('pinChat'),
      action: async () => {
        await GPMStorage.togglePinChat(chatId);
        gpmRenderTree();
      },
    },
    {
      icon: '✏️',
      label: t('renameChat'),
      action: () => {
        GPMUI.createRenameModal(GPM_STATE.modalRoot, {
          currentName: mapping?.alias || chatId,
          onSave: async (n) => {
            if (typeof GPMHistory !== 'undefined') {
              const action = GPMHistory.createAction('rename_chat', {
                chatId,
                oldAlias: mapping?.alias || chatId,
                newAlias: n,
              });
              GPMHistory.push(action);
            }
            await GPMStorage.setChatAlias(chatId, n);
            gpmRenderTree();
          },
          onCancel: () => {},
        });
      },
    },
    { icon: '📂', label: t('moveToProject'), submenu: moveSubmenu },
  ];

  items.push({ divider: true });
  items.push({
    icon: '🗑️',
    label: t('removeFromProject'),
    danger: true,
    action: async () => {
      await GPMStorage.unassignChat(chatId);
      gpmRenderTree();
    },
  });

  GPMUI.showContextMenu(GPM_STATE.modalRoot, { x, y, items });
}

// ══════════════════════════════════════
//  MODALS (Create Project, Settings)
// ══════════════════════════════════════

function gpmShowCreateProjectModal() {
  if (!GPM_STATE.modalRoot) return;
  GPMUI.createProjectModal(GPM_STATE.modalRoot, {
    onSave: async ({ name, icon, color }) => {
      const project = await GPMStorage.createProject({ name, icon, color });
      if (typeof GPMHistory !== 'undefined') {
        const action = GPMHistory.createAction('create_project', {
          projectId: project.id,
          projectData: project,
        });
        GPMHistory.push(action);
      }
      if (typeof GPMUsageTracker !== 'undefined') {
        GPMUsageTracker.trackFeatureUsage('create_project');
      }
      gpmRenderTree();
    },
    onCancel: () => {},
  });
}

async function gpmShowSettingsModal() {
  if (!GPM_STATE.modalRoot) return;
  const settings = await GPMStorage.getSettings();
  const backupInfo = await GPMStorage.getBackupInfo();
  GPMUI.createSettingsModal(GPM_STATE.modalRoot, {
    settings,
    backupInfo,
    onSave: async (s) => {
      await GPMStorage.saveSettings(s);
      gpmSetLang(s.lang);
      gpmRenderTree();
    },
    onCancel: () => {},
    onExport: async () => {
      const json = await GPMStorage.exportAll();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
      a.download = `gpm-backup-${ts}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onImport: async (jsonStr) => {
      try {
        await GPMStorage.importAll(jsonStr);
        const s = await GPMStorage.getSettings();
        gpmSetLang(s.lang);
        gpmRenderTree();
        const deletedCount = await gpmCleanupAfterImport();
        if (deletedCount > 0 && GPM_STATE.modalRoot) {
          GPMUI.showAlertDialog(GPM_STATE.modalRoot, {
            title: t('importData'),
            message: t('deletedChatsCleaned').replace('{count}', deletedCount),
          });
          gpmRenderTree();
        }
      } catch (e) {
        if (GPM_STATE.modalRoot)
          GPMUI.showAlertDialog(GPM_STATE.modalRoot, { title: t('importData'), message: t('importError') });
      }
    },
    onClear: async () => {
      await GPMStorage.clearAll();
      gpmSetLang('en');
      gpmRenderTree();
    },
    onRestoreBackup: async () => {
      const ok = await GPMStorage.restoreFromBackup();
      if (ok) {
        gpmRenderTree();
        const deletedCount = await gpmCleanupAfterImport();
        if (deletedCount > 0 && GPM_STATE.modalRoot) {
          GPMUI.showAlertDialog(GPM_STATE.modalRoot, {
            title: t('restoreBackup'),
            message: t('deletedChatsCleaned').replace('{count}', deletedCount),
          });
          gpmRenderTree();
        }
      } else if (GPM_STATE.modalRoot) {
        GPMUI.showAlertDialog(GPM_STATE.modalRoot, { title: t('restoreBackup'), message: t('noBackupAvailable') });
      }
    },
  });
}
