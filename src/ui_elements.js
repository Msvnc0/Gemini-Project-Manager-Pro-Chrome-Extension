/**
 * ui_elements.js — Component Factory
 * Builds all UI components: modals, tree nodes, context menus, quick prompts panel.
 * All elements are created for injection into Shadow DOM.
 */

const GPMUI = (() => {
  // ── Preset Data ──
  const COLORS = [
    '#8ab4f8', '#81c995', '#fdd663', '#f28b82', '#c58af9',
    '#78d9ec', '#fcad70', '#ff8bcb', '#a8dab5', '#d7aefb',
    '#aecbfa', '#e6c9a8'
  ];

  // Project icons — clean outline style symbols
  const PROJECT_ICONS = [
    '📁', '💻', '📱', '💬', '📝', '✏️',
    '💡', '⌨️', '🎵', '🏗️', '📊', '🏛️',
    '🔬', '🎨', '✍️', '🏠', '📈', '💰',
    '🔧', '🎮', '🌐', '🎯', '🧪', '🌍',
    '👥', '🏢', '✂️', '🐾', '❤️', '🔍',
    '⚖️', '🌐', '✈️', '🌎', '🐕', '📚',
    '👤', '🔬', '🍀', '⭐', '🔖', '🔎'
  ];

  // Category presets — icon + key + default color
  const CATEGORIES = [
    { icon: '📝', key: 'categoryHomework', color: '#8ab4f8' },
    { icon: '✏️', key: 'categoryWriting', color: '#81c995' },
    { icon: '🎵', key: 'categoryMusic', color: '#c58af9' },
    { icon: '🎬', key: 'categoryMovies', color: '#f28b82' },
    { icon: '🏠', key: 'categoryHome', color: '#fdd663' },
    { icon: '💪', key: 'categoryWellness', color: '#78d9ec' },
    { icon: '🏋️', key: 'categoryFitness', color: '#fcad70' },
    { icon: '📝', key: 'categoryNotes', color: '#a8dab5' },
    { icon: '⚖️', key: 'categoryLegal', color: '#d7aefb' },
    { icon: '🌐', key: 'categoryWeb', color: '#aecbfa' },
    { icon: '✈️', key: 'categoryFlights', color: '#e6c9a8' },
    { icon: '🌎', key: 'categoryGlobal', color: '#81c995' },
    { icon: '🐕', key: 'categoryPets', color: '#fdd663' },
    { icon: '👥', key: 'categorySocial', color: '#8ab4f8' },
    { icon: '🔬', key: 'categoryScience', color: '#c58af9' },
    { icon: '🍀', key: 'categoryLuck', color: '#81c995' },
    { icon: '⭐', key: 'categoryFavorites', color: '#fdd663' },
    { icon: '🔍', key: 'categoryResearch', color: '#78d9ec' },
    { icon: '💻', key: 'categoryCoding', color: '#8ab4f8' },
    { icon: '🎨', key: 'categoryDesign', color: '#ff8bcb' },
  ];

  // ── Utility: Create element shorthand ──
  function el(tag, attrs = {}, children = []) {
    const elem = document.createElement(tag);
    for (const [key, val] of Object.entries(attrs)) {
      if (key === 'className') elem.className = val;
      else if (key === 'textContent') elem.textContent = val;
      else if (key === 'innerHTML') elem.innerHTML = val;
      else if (key.startsWith('on')) elem.addEventListener(key.slice(2).toLowerCase(), val);
      else if (key === 'style' && typeof val === 'object') Object.assign(elem.style, val);
      else elem.setAttribute(key, val);
    }
    children.forEach(child => {
      if (typeof child === 'string') elem.appendChild(document.createTextNode(child));
      else if (child) elem.appendChild(child);
    });
    return elem;
  }

  // ══════════════════════════════════════
  //  MODAL: Create / Edit Project
  // ══════════════════════════════════════
  function createProjectModal(shadowRoot, { onSave, onCancel, existing = null, isSubfolder = false }) {
    const title = existing
      ? t('rename')
      : (isSubfolder ? t('createSubfolder') : t('createProject'));

    let selectedIcon = existing?.icon || '📁';
    let selectedColor = existing?.color || COLORS[0];
    let nameValue = existing?.name || '';

    const overlay = el('div', { className: 'gpm-overlay' });

    // ── Header: Title + Close button ──
    const headerRow = el('div', {
      style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }
    }, [
      el('div', { style: { fontSize: '18px', fontWeight: '400', color: 'var(--gpm-text)' }, textContent: title }),
      el('button', {
        type: 'button',
        textContent: '✕',
        style: { background: 'none', border: 'none', color: 'var(--gpm-text-secondary)', fontSize: '18px', cursor: 'pointer', padding: '4px 8px', borderRadius: '50%' },
        onClick: () => { overlay.remove(); onCancel?.(); }
      })
    ]);

    // ── Name input with icon preview ──
    const iconPreview = el('span', {
      style: { fontSize: '20px', flexShrink: '0', width: '32px', textAlign: 'center' },
      textContent: selectedIcon
    });

    const nameInput = el('input', {
      type: 'text',
      placeholder: isSubfolder ? t('subfolder') : t('projectName'),
      style: {
        flex: '1', background: 'none', border: 'none', outline: 'none',
        color: 'var(--gpm-text)', fontSize: '15px', fontFamily: '"Google Sans", sans-serif',
        padding: '0'
      }
    });
    nameInput.value = nameValue;
    nameInput.addEventListener('input', () => { nameValue = nameInput.value; });

    const inputRow = el('div', {
      style: {
        display: 'flex', alignItems: 'center', gap: '8px',
        border: '1px solid var(--gpm-border)', borderRadius: '12px',
        padding: '10px 14px', marginBottom: '16px'
      }
    }, [iconPreview, nameInput]);

    // Focus styling
    inputRow.addEventListener('focusin', () => { inputRow.style.borderColor = 'var(--gpm-accent)'; });
    inputRow.addEventListener('focusout', () => { inputRow.style.borderColor = 'var(--gpm-border)'; });

    // ── Icon + Category layout ──
    const contentRow = el('div', {
      style: { display: 'flex', gap: '16px', marginBottom: '20px' }
    });

    // Icon grid (left side)
    const iconGrid = el('div', {
      style: {
        display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px',
        padding: '8px', border: '1px solid var(--gpm-border)', borderRadius: '12px',
        maxHeight: '220px', overflowY: 'auto', flexShrink: '0'
      }
    });

    PROJECT_ICONS.forEach(icon => {
      const btn = el('button', {
        type: 'button',
        textContent: icon,
        style: {
          width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: icon === selectedIcon ? '2px solid var(--gpm-accent)' : '1px solid var(--gpm-border)',
          borderRadius: '8px', background: icon === selectedIcon ? 'rgba(138,180,248,0.1)' : 'transparent',
          fontSize: '18px', cursor: 'pointer', transition: 'all 100ms'
        },
        onClick: () => {
          selectedIcon = icon;
          iconPreview.textContent = icon;
          iconGrid.querySelectorAll('button').forEach(b => {
            b.style.border = '1px solid var(--gpm-border)';
            b.style.background = 'transparent';
          });
          btn.style.border = '2px solid var(--gpm-accent)';
          btn.style.background = 'rgba(138,180,248,0.1)';
        }
      });
      iconGrid.appendChild(btn);
    });

    // Category chips (right side)
    const chipContainer = el('div', {
      style: { display: 'flex', flexWrap: 'wrap', gap: '6px', alignContent: 'flex-start', flex: '1' }
    });

    CATEGORIES.forEach(cat => {
      const chip = el('button', {
        type: 'button',
        style: {
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          padding: '6px 12px', border: '1px solid var(--gpm-border)', borderRadius: '20px',
          background: 'transparent', color: 'var(--gpm-text)', fontSize: '12px',
          fontFamily: '"Google Sans", sans-serif', cursor: 'pointer', transition: 'all 100ms',
          whiteSpace: 'nowrap'
        },
        onClick: () => {
          const label = t(cat.key);
          nameInput.value = label;
          nameValue = label;
          selectedIcon = cat.icon;
          selectedColor = cat.color;
          iconPreview.textContent = cat.icon;
          // Update icon grid selection
          iconGrid.querySelectorAll('button').forEach(b => {
            const isMatch = b.textContent === cat.icon;
            b.style.border = isMatch ? '2px solid var(--gpm-accent)' : '1px solid var(--gpm-border)';
            b.style.background = isMatch ? 'rgba(138,180,248,0.1)' : 'transparent';
          });
        }
      }, [
        el('span', { textContent: cat.icon, style: { fontSize: '14px' } }),
        el('span', { textContent: t(cat.key) })
      ]);

      chip.addEventListener('mouseenter', () => { chip.style.background = 'var(--gpm-bg-hover, rgba(255,255,255,0.08))'; });
      chip.addEventListener('mouseleave', () => { chip.style.background = 'transparent'; });
      chipContainer.appendChild(chip);
    });

    contentRow.append(iconGrid, chipContainer);

    // ── Create button ──
    const footer = el('div', { style: { display: 'flex', justifyContent: 'flex-end' } }, [
      el('button', {
        type: 'button',
        textContent: existing ? t('save') : t('createProject'),
        style: {
          padding: '8px 24px', border: '1px solid var(--gpm-border)', borderRadius: '20px',
          background: 'transparent', color: 'var(--gpm-text)', fontSize: '14px',
          fontFamily: '"Google Sans", sans-serif', cursor: 'pointer', transition: 'background 100ms'
        },
        onClick: () => {
          if (!nameValue.trim()) { nameInput.focus(); return; }
          overlay.remove();
          onSave({ name: nameValue.trim(), icon: selectedIcon, color: selectedColor });
        }
      })
    ]);

    const modal = el('div', { className: 'gpm-modal', style: { width: '520px', padding: '24px' } }, [
      headerRow, inputRow, contentRow, footer
    ]);

    overlay.appendChild(modal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) { overlay.remove(); onCancel?.(); }
    });

    shadowRoot.appendChild(overlay);
    setTimeout(() => nameInput.focus(), 50);
    return overlay;
  }

  // ══════════════════════════════════════
  //  CONTEXT MENU
  // ══════════════════════════════════════
  function showContextMenu(shadowRoot, { x, y, items }) {
    // Remove any existing context menu
    shadowRoot.querySelectorAll('.gpm-context-menu').forEach(m => m.remove());

    const menu = el('div', { className: 'gpm-context-menu', style: { left: x + 'px', top: y + 'px' } });

    items.forEach(item => {
      if (item.divider) {
        menu.appendChild(el('div', { className: 'gpm-context-divider' }));
        return;
      }

      if (item.submenu) {
        const wrapper = el('div', { className: 'gpm-context-submenu' });
        const trigger = el('button', {
          className: 'gpm-context-item',
          type: 'button'
        }, [
          el('span', { className: 'gpm-context-icon', textContent: item.icon || '' }),
          el('span', { textContent: item.label }),
          el('span', { textContent: '▸', style: { marginLeft: 'auto', fontSize: '10px' } })
        ]);

        const subList = el('div', { className: 'gpm-context-submenu-list', style: { display: 'none' } });
        item.submenu.forEach(sub => {
          subList.appendChild(el('button', {
            className: 'gpm-context-item',
            type: 'button',
            onClick: () => { menu.remove(); sub.action?.(); }
          }, [
            el('span', { className: 'gpm-context-icon', textContent: sub.icon || '' }),
            el('span', { textContent: sub.label })
          ]));
        });

        trigger.addEventListener('mouseenter', () => { subList.style.display = 'block'; });
        wrapper.addEventListener('mouseleave', () => { subList.style.display = 'none'; });

        wrapper.appendChild(trigger);
        wrapper.appendChild(subList);
        menu.appendChild(wrapper);
        return;
      }

      const btn = el('button', {
        className: `gpm-context-item${item.danger ? ' gpm-danger' : ''}`,
        type: 'button',
        onClick: () => { menu.remove(); item.action?.(); }
      }, [
        el('span', { className: 'gpm-context-icon', textContent: item.icon || '' }),
        el('span', { textContent: item.label })
      ]);
      menu.appendChild(btn);
    });

    // Reposition if overflowing viewport
    shadowRoot.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = (x - rect.width) + 'px';
    if (rect.bottom > window.innerHeight) menu.style.top = (y - rect.height) + 'px';

    // Close on outside click
    const closeHandler = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        shadowRoot.removeEventListener('click', closeHandler, true);
        document.removeEventListener('click', closeHandler, true);
      }
    };
    setTimeout(() => {
      shadowRoot.addEventListener('click', closeHandler, true);
      document.addEventListener('click', closeHandler, true);
    }, 10);

    return menu;
  }

  // ══════════════════════════════════════
  //  PROJECT TREE NODE (Recursive)
  // ══════════════════════════════════════
  function createTreeNode(shadowRoot, { project, allProjects, chatMap, onAction, depth = 0 }) {
    const children = allProjects.filter(p => p.parentId === project.id);
    const chatIds = project.chatIds || [];
    const totalCount = chatIds.length + children.reduce((sum, c) => sum + (c.chatIds?.length || 0), 0);

    const item = el('li', { className: 'gpm-tree-item' });
    item.dataset.projectId = project.id;

    // Row
    const row = el('div', { className: 'gpm-tree-row' });

    // Chevron (only if has children or chats)
    const hasContent = children.length > 0 || chatIds.length > 0;
    const chevron = el('span', {
      className: `gpm-tree-chevron${!project.collapsed ? ' gpm-expanded' : ''}`,
      textContent: hasContent ? '▶' : '',
      onClick: (e) => {
        e.stopPropagation();
        if (!hasContent) return;
        project.collapsed = !project.collapsed;
        onAction('toggle', project);
      }
    });

    const icon = el('span', {
      className: 'gpm-tree-icon',
      textContent: project.icon,
      style: { filter: `drop-shadow(0 0 1px ${project.color})` }
    });

    const label = el('span', {
      className: 'gpm-tree-label',
      textContent: project.name,
      style: { color: project.color }
    });

    const count = el('span', {
      className: 'gpm-tree-count',
      textContent: totalCount > 0 ? `${totalCount}` : ''
    });

    row.append(chevron, icon, label, count);

    // Drag & Drop target
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      row.classList.add('gpm-drag-over');
    });
    row.addEventListener('dragleave', () => row.classList.remove('gpm-drag-over'));
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      row.classList.remove('gpm-drag-over');
      const chatId = e.dataTransfer.getData('text/gpm-chat-id');
      if (chatId) onAction('dropChat', { projectId: project.id, chatId });
    });

    // Right-click context menu
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Build "Move to Project" submenu from all projects
      const moveSubmenu = allProjects
        .filter(p => p.id !== project.id)
        .map(p => ({
          icon: p.icon,
          label: p.name,
          action: () => onAction('moveProject', { fromId: project.id, toId: p.id })
        }));

      showContextMenu(shadowRoot, {
        x: e.clientX, y: e.clientY,
        items: [
          { icon: '💬', label: t('newChatInProject'), action: () => onAction('newChat', project) },
          { icon: '📂', label: t('createSubfolder'), action: () => onAction('createSubfolder', project) },
          { divider: true },
          { icon: '✏️', label: t('rename'), action: () => onAction('edit', project) },
          { icon: '🎨', label: t('editColor'), action: () => onAction('edit', project) },
          { icon: '🔄', label: t('changeIcon'), action: () => onAction('edit', project) },
          { divider: true },
          { icon: '🗑️', label: t('delete'), danger: true, action: () => onAction('delete', project) }
        ]
      });
    });

    // Click to expand/collapse
    row.addEventListener('click', () => {
      if (hasContent) {
        project.collapsed = !project.collapsed;
        onAction('toggle', project);
      }
    });

    item.appendChild(row);

    // Children container
    if (hasContent && !project.collapsed) {
      const childList = el('ul', { className: 'gpm-tree-children' });

      // Pinned chats first, then regular
      const sortedChatIds = [...chatIds].sort((a, b) => {
        const aPinned = chatMap[a]?.pinned ? 0 : 1;
        const bPinned = chatMap[b]?.pinned ? 0 : 1;
        return aPinned - bPinned;
      });

      sortedChatIds.forEach(chatId => {
        const mapping = chatMap[chatId];
        const chatItem = createChatItem(shadowRoot, {
          chatId, mapping, project, allProjects, onAction
        });
        childList.appendChild(chatItem);
      });

      children.forEach(child => {
        const childNode = createTreeNode(shadowRoot, {
          project: child, allProjects, chatMap, onAction, depth: depth + 1
        });
        childList.appendChild(childNode);
      });

      item.appendChild(childList);
    }

    return item;
  }

  // ══════════════════════════════════════
  //  CHAT ITEM (inside project tree)
  // ══════════════════════════════════════
  function createChatItem(shadowRoot, { chatId, mapping, project, allProjects, onAction }) {
    const alias = mapping?.alias || chatId;
    const pinned = mapping?.pinned || false;

    const item = el('div', {
      className: `gpm-chat-item${pinned ? ' gpm-pinned' : ''}`,
      draggable: 'true'
    });

    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/gpm-chat-id', chatId);
      item.classList.add('gpm-dragging');
    });
    item.addEventListener('dragend', () => item.classList.remove('gpm-dragging'));

    const dot = el('span', {
      className: 'gpm-chat-dot',
      style: { background: project.color }
    });

    const label = el('span', {
      className: 'gpm-chat-label',
      textContent: alias
    });

    item.append(dot, label);

    // Click to navigate to chat
    item.addEventListener('click', () => {
      onAction('openChat', chatId);
    });

    // Right-click context menu for chat
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const moveSubmenu = allProjects.map(p => ({
        icon: p.icon,
        label: p.name,
        action: () => onAction('moveChatToProject', { chatId, projectId: p.id })
      }));

      showContextMenu(shadowRoot, {
        x: e.clientX, y: e.clientY,
        items: [
          { icon: pinned ? '📌' : '📍', label: pinned ? t('unpinChat') : t('pinChat'), action: () => onAction('togglePin', chatId) },
          { icon: '✏️', label: t('renameChat'), action: () => onAction('renameChat', chatId) },
          { icon: '📂', label: t('moveToProject'), submenu: moveSubmenu },
          { divider: true },
          { icon: '🗑️', label: t('removeFromProject'), danger: true, action: () => onAction('unassignChat', chatId) }
        ]
      });
    });

    return item;
  }

  // ══════════════════════════════════════
  //  QUICK PROMPTS PANEL
  // ══════════════════════════════════════
  function createQuickPromptsPanel(shadowRoot, { prompts, onSelect, onAdd, onEdit, onClose, onBackup, onRestore }) {
    const panel = el('div', { className: 'gpm-quick-prompts' });

    // ── Header with title + close ──
    const header = el('div', { className: 'gpm-qp-header' }, [
      el('span', { className: 'gpm-qp-title', textContent: t('quickPrompts') }),
      el('button', {
        className: 'gpm-icon-btn',
        textContent: '✕',
        type: 'button',
        onClick: onClose
      })
    ]);
    panel.appendChild(header);

    // ── Search bar ──
    const searchInput = el('input', {
      className: 'gpm-qp-search',
      type: 'text',
      placeholder: '🔍  ' + t('searchPrompts'),
    });
    const searchWrap = el('div', { className: 'gpm-qp-search-wrap' }, [searchInput]);
    panel.appendChild(searchWrap);

    // ── Prompt list container ──
    const listContainer = el('div', { className: 'gpm-qp-list' });

    function renderPrompts(filter = '') {
      listContainer.innerHTML = '';
      const filtered = filter
        ? prompts.filter(p => p.title.toLowerCase().includes(filter) || p.content.toLowerCase().includes(filter))
        : prompts;

      if (filtered.length === 0) {
        listContainer.appendChild(el('div', { className: 'gpm-empty', textContent: filter ? t('noMatchingPrompts') : t('noPromptsYet') }));
        return;
      }

      filtered.forEach(prompt => {
        const card = el('div', {
          className: 'gpm-qp-card',
          onClick: () => onSelect(prompt)
        });

        const textCol = el('div', { className: 'gpm-qp-card-text' }, [
          el('div', { className: 'gpm-qp-card-title', textContent: prompt.title }),
          el('div', { className: 'gpm-qp-card-preview', textContent: prompt.content.slice(0, 100) + (prompt.content.length > 100 ? '...' : '') })
        ]);

        const editBtn = el('button', {
          className: 'gpm-qp-card-edit',
          type: 'button',
          innerHTML: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
          onClick: (e) => { e.stopPropagation(); onEdit(prompt); }
        });

        card.append(textCol, editBtn);
        listContainer.appendChild(card);
      });
    }

    renderPrompts();
    searchInput.addEventListener('input', () => renderPrompts(searchInput.value.trim().toLowerCase()));
    panel.appendChild(listContainer);

    // ── Footer: Backup | Restore | + ──
    const footer = el('div', { className: 'gpm-qp-footer' }, [
      el('button', {
        className: 'gpm-qp-footer-btn',
        type: 'button',
        title: t('backup'),
        innerHTML: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
        onClick: onBackup
      }),
      el('button', {
        className: 'gpm-qp-footer-btn',
        type: 'button',
        title: t('restore'),
        innerHTML: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
        onClick: onRestore
      }),
      el('button', {
        className: 'gpm-qp-fab',
        type: 'button',
        title: t('addPrompt'),
        textContent: '+',
        onClick: onAdd
      })
    ]);
    panel.appendChild(footer);

    return panel;
  }

  // ══════════════════════════════════════
  //  ADD / EDIT QUICK PROMPT MODAL
  // ══════════════════════════════════════
  function createQuickPromptModal(shadowRoot, { onSave, onCancel, existing = null }) {
    let titleVal = existing?.title || '';
    let contentVal = existing?.content || '';

    const overlay = el('div', { className: 'gpm-overlay' });

    // ── Header: Title + Close ──
    const isEdit = !!existing;
    const headerRow = el('div', {
      style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }
    }, [
      el('div', { style: { fontSize: '18px', fontWeight: '400', color: 'var(--gpm-text)' }, textContent: isEdit ? t('editPrompt') : t('newPrompt') }),
      el('button', {
        type: 'button',
        textContent: '✕',
        style: { background: 'none', border: 'none', color: 'var(--gpm-text-secondary)', fontSize: '18px', cursor: 'pointer', padding: '4px 8px', borderRadius: '50%' },
        onClick: () => { overlay.remove(); onCancel?.(); }
      })
    ]);

    // ── NAME field ──
    const nameLabel = el('label', { className: 'gpm-label', textContent: t('promptTitle') });
    const nameInput = el('input', { className: 'gpm-input', type: 'text', placeholder: t('enterPromptName') });
    nameInput.value = titleVal;
    nameInput.addEventListener('input', () => { titleVal = nameInput.value; });

    // ── PROMPT CONTENT field ──
    const contentLabel = el('label', { className: 'gpm-label', textContent: t('promptContent') });
    const contentInput = el('textarea', { className: 'gpm-textarea', placeholder: t('writePromptHere') });
    contentInput.value = contentVal;
    contentInput.style.minHeight = '120px';
    contentInput.addEventListener('input', () => {
      contentVal = contentInput.value;
      tokenDisplay.textContent = `~${Math.ceil(contentVal.length / 4)} tokens`;
    });

    // ── Token count ──
    const tokenDisplay = el('div', {
      style: { fontSize: '11px', color: 'var(--gpm-text-secondary)', textAlign: 'right', marginTop: '4px' },
      textContent: `~${Math.ceil(contentVal.length / 4)} tokens`
    });

    // ── Footer: Cancel + Save ──
    const footer = el('div', { className: 'gpm-btn-row' }, [
      el('button', {
        className: 'gpm-btn gpm-btn-ghost', textContent: t('cancel'), type: 'button',
        onClick: () => { overlay.remove(); onCancel?.(); }
      }),
      el('button', {
        className: 'gpm-btn gpm-btn-primary', textContent: t('save'), type: 'button',
        onClick: () => {
          if (!titleVal.trim() || !contentVal.trim()) { nameInput.focus(); return; }
          overlay.remove();
          onSave({ title: titleVal.trim(), content: contentVal.trim(), category: existing?.category || 'General' });
        }
      })
    ]);

    const modal = el('div', { className: 'gpm-modal', style: { width: '440px', padding: '24px' } }, [
      headerRow,
      el('div', { className: 'gpm-field' }, [nameLabel, nameInput]),
      el('div', { className: 'gpm-field' }, [contentLabel, contentInput, tokenDisplay]),
      footer
    ]);

    overlay.appendChild(modal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); onCancel?.(); } });
    shadowRoot.appendChild(overlay);
    setTimeout(() => nameInput.focus(), 50);
    return overlay;
  }

  // ══════════════════════════════════════
  //  SETTINGS MODAL
  // ══════════════════════════════════════
  function createSettingsModal(shadowRoot, { settings, onSave, onCancel, onExport, onImport, onClear }) {
    let lang = settings.lang || 'en';
    const overlay = el('div', { className: 'gpm-overlay' });

    const langSelect = el('select', { className: 'gpm-select' }, [
      el('option', { value: 'en', textContent: 'English' }),
      el('option', { value: 'tr', textContent: 'Türkçe' }),
      el('option', { value: 'de', textContent: 'Deutsch' }),
      el('option', { value: 'fr', textContent: 'Français' }),
      el('option', { value: 'es', textContent: 'Español' }),
      el('option', { value: 'it', textContent: 'Italiano' }),
      el('option', { value: 'pt', textContent: 'Português' }),
      el('option', { value: 'ru', textContent: 'Русский' }),
      el('option', { value: 'ja', textContent: '日本語' }),
      el('option', { value: 'zh', textContent: '中文' })
    ]);
    langSelect.value = lang;
    langSelect.addEventListener('change', () => { lang = langSelect.value; });

    // Hidden file input for import
    const fileInput = el('input', { type: 'file', accept: '.json', style: { display: 'none' } });
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => { onImport(ev.target.result); overlay.remove(); };
      reader.readAsText(file);
    });

    const modal = el('div', { className: 'gpm-modal' }, [
      el('div', { className: 'gpm-modal-title', textContent: t('settings') }),

      el('div', { className: 'gpm-settings-section' }, [
        el('div', { className: 'gpm-settings-section-title', textContent: t('language') }),
        el('div', { className: 'gpm-settings-row' }, [
          el('span', { textContent: t('language') }),
          langSelect
        ])
      ]),

      el('div', { className: 'gpm-settings-section' }, [
        el('div', { className: 'gpm-settings-section-title', textContent: t('data') }),
        el('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, [
          el('button', {
            className: 'gpm-btn gpm-btn-ghost', textContent: t('exportData'), type: 'button',
            style: { justifyContent: 'flex-start' },
            onClick: () => { onExport(); }
          }),
          el('button', {
            className: 'gpm-btn gpm-btn-ghost', textContent: t('importData'), type: 'button',
            style: { justifyContent: 'flex-start' },
            onClick: () => { fileInput.click(); }
          }),
          fileInput,
          el('button', {
            className: 'gpm-btn gpm-btn-danger', textContent: t('clearData'), type: 'button',
            style: { justifyContent: 'flex-start' },
            onClick: () => {
              if (confirm(t('clearConfirm'))) { onClear(); overlay.remove(); }
            }
          })
        ])
      ]),

      el('div', { className: 'gpm-btn-row' }, [
        el('button', {
          className: 'gpm-btn gpm-btn-ghost', textContent: t('cancel'), type: 'button',
          onClick: () => { overlay.remove(); onCancel?.(); }
        }),
        el('button', {
          className: 'gpm-btn gpm-btn-primary', textContent: t('save'), type: 'button',
          onClick: () => { overlay.remove(); onSave({ lang }); }
        })
      ])
    ]);

    overlay.appendChild(modal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); onCancel?.(); } });
    shadowRoot.appendChild(overlay);
    return overlay;
  }

  // ══════════════════════════════════════
  //  RENAME CHAT MODAL (simple input)
  // ══════════════════════════════════════
  function createRenameModal(shadowRoot, { currentName, onSave, onCancel }) {
    let val = currentName || '';
    const overlay = el('div', { className: 'gpm-overlay' });
    const input = el('input', { className: 'gpm-input', type: 'text', placeholder: t('chatAlias') });
    input.value = val;
    input.addEventListener('input', () => { val = input.value; });

    const modal = el('div', { className: 'gpm-modal' }, [
      el('div', { className: 'gpm-modal-title', textContent: t('renameChat') }),
      el('div', { className: 'gpm-field' }, [input]),
      el('div', { className: 'gpm-btn-row' }, [
        el('button', {
          className: 'gpm-btn gpm-btn-ghost', textContent: t('cancel'), type: 'button',
          onClick: () => { overlay.remove(); onCancel?.(); }
        }),
        el('button', {
          className: 'gpm-btn gpm-btn-primary', textContent: t('save'), type: 'button',
          onClick: () => { overlay.remove(); onSave(val.trim()); }
        })
      ])
    ]);

    overlay.appendChild(modal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); onCancel?.(); } });
    shadowRoot.appendChild(overlay);
    setTimeout(() => { input.focus(); input.select(); }, 50);
    return overlay;
  }

  return {
    createProjectModal,
    showContextMenu,
    createTreeNode,
    createChatItem,
    createQuickPromptsPanel,
    createQuickPromptModal,
    createSettingsModal,
    createRenameModal,
    COLORS,
    PROJECT_ICONS,
    CATEGORIES
  };
})();
