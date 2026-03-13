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

  // ── SVG Icon Factory (safe alternative to innerHTML) ──
  const SVG_ICONS = {
    edit: { viewBox: '0 0 24 24', paths: ['M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7', 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'] },
    trash: { viewBox: '0 0 24 24', paths: ['M3 6h18', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2', 'M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6'], lines: [{ x1: 10, y1: 11, x2: 10, y2: 17 }, { x1: 14, y1: 11, x2: 14, y2: 17 }] },
    download: { viewBox: '0 0 24 24', paths: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'], polylines: ['7 10 12 15 17 10'], lines: [{ x1: 12, y1: 15, x2: 12, y2: 3 }] },
    upload: { viewBox: '0 0 24 24', paths: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'], polylines: ['17 8 12 3 7 8'], lines: [{ x1: 12, y1: 3, x2: 12, y2: 15 }] }
  };

  function createSVGIcon(name, size = 16) {
    const icon = SVG_ICONS[name];
    if (!icon) return document.createTextNode('');
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('viewBox', icon.viewBox);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    (icon.paths || []).forEach(d => {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
      svg.appendChild(path);
    });
    (icon.polylines || []).forEach(pts => {
      const poly = document.createElementNS(NS, 'polyline');
      poly.setAttribute('points', pts);
      svg.appendChild(poly);
    });
    (icon.lines || []).forEach(l => {
      const line = document.createElementNS(NS, 'line');
      line.setAttribute('x1', String(l.x1));
      line.setAttribute('y1', String(l.y1));
      line.setAttribute('x2', String(l.x2));
      line.setAttribute('y2', String(l.y2));
      svg.appendChild(line);
    });
    return svg;
  }

  // ── Utility: Focus trap for modals (accessibility) ──
  function trapFocus(overlayEl) {
    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    overlayEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        // Find and click the close button or cancel
        const closeBtn = overlayEl.querySelector('.gpm-close-btn') || overlayEl.querySelector('.gpm-btn-ghost');
        if (closeBtn) closeBtn.click();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = Array.from(overlayEl.querySelectorAll(focusableSelector)).filter(el => !el.disabled && el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first || overlayEl.shadowRoot?.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last || overlayEl.shadowRoot?.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  // ── Utility: Create element shorthand ──
  function el(tag, attrs = {}, children = []) {
    const elem = document.createElement(tag);
    for (const [key, val] of Object.entries(attrs)) {
      if (key === 'className') elem.className = val;
      else if (key === 'textContent') elem.textContent = val;
      // innerHTML intentionally removed for XSS safety — use createSVGIcon() instead
      else if (key === 'innerHTML') { /* BLOCKED: use children with createSVGIcon() */ }
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
      className: 'gpm-modal-header'
    }, [
      el('div', { className: 'gpm-modal-title', textContent: title }),
      el('button', {
        type: 'button',
        textContent: '✕',
        className: 'gpm-close-btn',
        onClick: () => { overlay.remove(); onCancel?.(); }
      })
    ]);

    // ── Name input with icon preview ──
    const iconPreview = el('span', {
      className: 'gpm-icon-preview',
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
      className: 'gpm-chip-container'
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
          // Update color grid selection
          updateColorSelection(cat.color);
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

    // ── Color palette ──
    const colorLabel = el('div', { className: 'gpm-label', textContent: t('selectColor'), style: { marginBottom: '8px' } });
    const colorGrid = el('div', { className: 'gpm-color-grid' });

    function updateColorSelection(color) {
      selectedColor = color;
      colorGrid.querySelectorAll('.gpm-color-swatch').forEach(sw => {
        sw.classList.toggle('gpm-selected', sw.dataset.color === color);
      });
    }

    COLORS.forEach(color => {
      const swatch = el('div', {
        className: `gpm-color-swatch${color === selectedColor ? ' gpm-selected' : ''}`,
        style: { background: color },
        'data-color': color,
        onClick: () => updateColorSelection(color)
      });
      colorGrid.appendChild(swatch);
    });

    const colorSection = el('div', { style: { marginBottom: '20px' } }, [colorLabel, colorGrid]);

    // ── Create button ──
    const footer = el('div', { className: 'gpm-flex-end' }, [
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
      headerRow, inputRow, contentRow, colorSection, footer
    ]);

    overlay.appendChild(modal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) { overlay.remove(); onCancel?.(); }
    });

    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', title);
    trapFocus(overlay);
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

    const menu = el('div', { className: 'gpm-context-menu', role: 'menu', style: { left: x + 'px', top: y + 'px' } });

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

        const subList = el('div', { className: 'gpm-context-submenu-list gpm-hidden-input' });
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

    // Reposition if overflowing viewport — use viewport coordinates directly
    // (Shadow DOM host has width:0/height:0 so getBoundingClientRect may be unreliable)
    shadowRoot.appendChild(menu);
    // Force layout so we can measure the menu dimensions
    const menuWidth = menu.offsetWidth || 180;
    const menuHeight = menu.offsetHeight || 200;
    let finalX = x;
    let finalY = y;
    if (finalX + menuWidth > window.innerWidth) finalX = Math.max(0, x - menuWidth);
    if (finalY + menuHeight > window.innerHeight) finalY = Math.max(0, y - menuHeight);
    menu.style.left = finalX + 'px';
    menu.style.top = finalY + 'px';

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
  //  QUICK PROMPTS PANEL
  // ══════════════════════════════════════
  function createQuickPromptsPanel(shadowRoot, { prompts, onSelect, onAdd, onEdit, onDelete, onClose, onBackup, onRestore }) {
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
      while (listContainer.firstChild) listContainer.removeChild(listContainer.firstChild);
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
          title: t('editPrompt'),
          onClick: (e) => { e.stopPropagation(); onEdit(prompt); }
        }, [createSVGIcon('edit', 14)]);

        const deleteBtn = el('button', {
          className: 'gpm-qp-card-delete',
          type: 'button',
          title: t('delete'),
          onClick: (e) => { e.stopPropagation(); onDelete(prompt); }
        }, [createSVGIcon('trash', 14)]);

        card.append(textCol, editBtn, deleteBtn);
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
        onClick: onBackup
      }, [createSVGIcon('download', 16)]),
      el('button', {
        className: 'gpm-qp-footer-btn',
        type: 'button',
        title: t('restore'),
        onClick: onRestore
      }, [createSVGIcon('upload', 16)]),
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
      className: 'gpm-modal-header'
    }, [
      el('div', { className: 'gpm-modal-title', textContent: isEdit ? t('editPrompt') : t('newPrompt') }),
      el('button', {
        type: 'button',
        textContent: '✕',
        className: 'gpm-close-btn',
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
      className: 'gpm-token-display',
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
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', isEdit ? t('editPrompt') : t('newPrompt'));
    trapFocus(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); onCancel?.(); } });
    shadowRoot.appendChild(overlay);
    setTimeout(() => nameInput.focus(), 50);
    return overlay;
  }

  // ══════════════════════════════════════
  //  SETTINGS MODAL
  // ══════════════════════════════════════
  function createSettingsModal(shadowRoot, { settings, backupInfo, onSave, onCancel, onExport, onImport, onClear, onRestoreBackup }) {
    let lang = settings.lang || 'en';
    const overlay = el('div', { className: 'gpm-overlay' });

    const langSelect = el('select', { className: 'gpm-select' },
      getLanguageOptions().map(opt =>
        el('option', { value: opt.code, textContent: opt.displayName })
      )
    );
    langSelect.value = lang;
    langSelect.addEventListener('change', () => { lang = langSelect.value; });

    // Hidden file input for import
    const fileInput = el('input', { type: 'file', accept: '.json', className: 'gpm-hidden-input' });
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => { onImport(ev.target.result); overlay.remove(); };
      reader.readAsText(file);
    });

    // Build backup info text
    let backupLabel = t('noBackupAvailable');
    if (backupInfo) {
      const date = new Date(backupInfo.timestamp);
      const timeStr = date.toLocaleString();
      backupLabel = `${t('restoreBackup')} (${timeStr} — ${backupInfo.projectCount} ${t('projects').toLowerCase()}, ${backupInfo.chatCount} chats)`;
    }

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
            className: 'gpm-btn gpm-btn-ghost', textContent: backupLabel, type: 'button',
            style: { justifyContent: 'flex-start', opacity: backupInfo ? '1' : '0.5' },
            onClick: () => {
              if (!backupInfo) {
                showAlertDialog(shadowRoot, { title: t('restoreBackup'), message: t('noBackupAvailable') });
                return;
              }
              showConfirmDialog(shadowRoot, {
                title: t('restoreBackup'),
                message: t('restoreConfirm'),
                confirmText: t('restoreBackup'),
                onConfirm: () => { onRestoreBackup?.(); overlay.remove(); }
              });
            }
          }),
          el('button', {
            className: 'gpm-btn gpm-btn-danger', textContent: t('clearData'), type: 'button',
            style: { justifyContent: 'flex-start' },
            onClick: () => {
              showConfirmDialog(shadowRoot, {
                title: t('clearData'),
                message: t('clearConfirm'),
                confirmText: t('clearData'),
                danger: true,
                onConfirm: () => { onClear(); overlay.remove(); }
              });
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
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', t('settings'));
    trapFocus(overlay);
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
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', t('renameChat'));
    trapFocus(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); onCancel?.(); } });
    shadowRoot.appendChild(overlay);
    setTimeout(() => { input.focus(); input.select(); }, 50);
    return overlay;
  }

  // ══════════════════════════════════════
  //  CONFIRM / ALERT DIALOGS (safe replacement for native confirm/alert)
  // ══════════════════════════════════════

  function showConfirmDialog(shadowRoot, { title, message, confirmText, cancelText, onConfirm, onCancel, danger = false }) {
    const overlay = el('div', { className: 'gpm-overlay' });

    const headerRow = el('div', {
      className: 'gpm-modal-header-sm'
    }, [
      el('div', { className: 'gpm-modal-title', textContent: title || t('confirm') }),
      el('button', {
        type: 'button',
        textContent: '✕',
        className: 'gpm-close-btn',
        onClick: () => { overlay.remove(); onCancel?.(); }
      })
    ]);

    const messageEl = el('div', {
      className: 'gpm-modal-message',
      textContent: message
    });

    const footer = el('div', { className: 'gpm-btn-row' }, [
      el('button', {
        className: 'gpm-btn gpm-btn-ghost', textContent: cancelText || t('cancel'), type: 'button',
        onClick: () => { overlay.remove(); onCancel?.(); }
      }),
      el('button', {
        className: danger ? 'gpm-btn gpm-btn-danger' : 'gpm-btn gpm-btn-primary',
        textContent: confirmText || t('confirm'), type: 'button',
        onClick: () => { overlay.remove(); onConfirm?.(); }
      })
    ]);

    const modal = el('div', { className: 'gpm-modal', style: { width: '380px', padding: '24px' } }, [
      headerRow, messageEl, footer
    ]);

    overlay.appendChild(modal);
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', title || t('confirm'));
    trapFocus(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); onCancel?.(); } });
    shadowRoot.appendChild(overlay);
    return overlay;
  }

  function showAlertDialog(shadowRoot, { title, message, buttonText, onClose }) {
    const overlay = el('div', { className: 'gpm-overlay' });

    const headerRow = el('div', {
      className: 'gpm-modal-header-sm'
    }, [
      el('div', { className: 'gpm-modal-title', textContent: title || t('info') }),
      el('button', {
        type: 'button',
        textContent: '✕',
        className: 'gpm-close-btn',
        onClick: () => { overlay.remove(); onClose?.(); }
      })
    ]);

    const messageEl = el('div', {
      className: 'gpm-modal-message',
      textContent: message
    });

    const footer = el('div', { className: 'gpm-flex-end' }, [
      el('button', {
        className: 'gpm-btn gpm-btn-primary', textContent: buttonText || 'OK', type: 'button',
        onClick: () => { overlay.remove(); onClose?.(); }
      })
    ]);

    const modal = el('div', { className: 'gpm-modal', style: { width: '380px', padding: '24px' } }, [
      headerRow, messageEl, footer
    ]);

    overlay.appendChild(modal);
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', title || t('info'));
    trapFocus(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); onClose?.(); } });
    shadowRoot.appendChild(overlay);
    return overlay;
  }

  return {
    createProjectModal,
    showContextMenu,
    createQuickPromptsPanel,
    createQuickPromptModal,
    createSettingsModal,
    createRenameModal,
    showConfirmDialog,
    showAlertDialog,
    createSVGIcon,
    COLORS,
    PROJECT_ICONS,
    CATEGORIES
  };
})();
