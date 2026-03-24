const GPM_TAG_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

const GPMTagUI = (() => {
  function createTagChip(tag, options = {}) {
    const { removable = false, onRemove, onClick } = options;
    const chip = document.createElement('span');
    chip.className = 'gpm-tag-chip';
    chip.dataset.tagId = tag.id;
    chip.style.setProperty('--tag-color', tag.color);
    chip.textContent = tag.name;
    if (onClick) {
      chip.style.cursor = 'pointer';
      chip.addEventListener('click', () => onClick(tag));
    }
    if (removable && onRemove) {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'gpm-tag-chip-remove';
      removeBtn.textContent = '×';
      removeBtn.type = 'button';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onRemove(tag);
      });
      chip.appendChild(removeBtn);
    }
    return chip;
  }

  function createTagSelector(options = {}) {
    const { selectedTags = [], onChange, chatId, maxTags = 5 } = options;
    const container = document.createElement('div');
    container.className = 'gpm-tag-selector';
    const trigger = document.createElement('button');
    trigger.className = 'gpm-tag-selector-trigger';
    trigger.type = 'button';
    trigger.innerHTML = `<span class="gpm-tag-icon">🏷️</span>`;
    trigger.title = t('tags');
    const dropdown = document.createElement('div');
    dropdown.className = 'gpm-tag-selector-dropdown gpm-hidden';
    trigger.addEventListener('click', async (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('gpm-hidden');
    });
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) dropdown.classList.add('gpm-hidden');
    });
    container.appendChild(trigger);
    container.appendChild(dropdown);
    return container;
  }

  function showCreateTagModal(onSave) {
    if (!GPM_STATE?.modalRoot) return;
  }

  function createStarButton(chatId, isStarred, onToggle) {
    const btn = document.createElement('button');
    btn.className = 'gpm-star-btn' + (isStarred ? ' gpm-starred' : '');
    btn.type = 'button';
    btn.dataset.chatId = chatId;
    btn.textContent = isStarred ? '★' : '☆';
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const newStarred = await GPMStorage.toggleStarChat(chatId);
      btn.textContent = newStarred ? '★' : '☆';
      btn.classList.toggle('gpm-starred', newStarred);
      if (onToggle) onToggle(newStarred);
    });
    return btn;
  }

  async function createTagFilterBar(onFilterChange) {
    const container = document.createElement('div');
    container.className = 'gpm-tag-filter-bar';
    const tags = await GPMStorage.getTags();
    const tagList = Object.values(tags).sort((a, b) => a.name.localeCompare(b.name));
    if (tagList.length === 0) {
      container.style.display = 'none';
      return container;
    }
    const selectedFilters = new Set();
    for (const tag of tagList) {
      const chip = createTagChip(tag, {
        onClick: () => {
          if (selectedFilters.has(tag.id)) {
            selectedFilters.delete(tag.id);
            chip.classList.remove('gpm-tag-chip-active');
          } else {
            selectedFilters.add(tag.id);
            chip.classList.add('gpm-tag-chip-active');
          }
          if (onFilterChange) onFilterChange(Array.from(selectedFilters));
        },
      });
      chip.style.cursor = 'pointer';
      container.appendChild(chip);
    }
    return container;
  }

  return { createTagChip, createTagSelector, showCreateTagModal, createStarButton, createTagFilterBar, GPM_TAG_COLORS };
})();
