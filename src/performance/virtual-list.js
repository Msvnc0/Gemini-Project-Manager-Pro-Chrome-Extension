/**
 * virtual-list.js — Virtualized List for Large Datasets
 *
 * Renders only visible items for performance with 100+ items.
 * Uses windowing technique to minimize DOM nodes.
 */

class GPMVirtualList {
  constructor(container, options = {}) {
    this.container = container;
    this.itemHeight = options.itemHeight || 36;
    this.buffer = options.buffer || 5;
    this.items = [];
    this.renderItem = options.renderItem || ((item) => document.createTextNode(item));
    this.scrollTop = 0;
    this.viewportHeight = 0;
    this.startIndex = 0;
    this.endIndex = 0;

    this.init();
  }

  init() {
    this.container.style.overflowY = 'auto';
    this.container.style.position = 'relative';

    this.scrollListener = () => this.onScroll();
    this.container.addEventListener('scroll', this.scrollListener);

    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.container);
  }

  setItems(items) {
    this.items = items;
    this.updateTotalHeight();
    this.render();
  }

  updateTotalHeight() {
    const totalHeight = this.items.length * this.itemHeight;

    if (!this.spacer) {
      this.spacer = document.createElement('div');
      this.spacer.style.position = 'absolute';
      this.spacer.style.top = '0';
      this.spacer.style.left = '0';
      this.spacer.style.right = '0';
      this.container.appendChild(this.spacer);
    }

    this.spacer.style.height = `${totalHeight}px`;
  }

  onScroll() {
    this.scrollTop = this.container.scrollTop;
    this.render();
  }

  onResize() {
    this.viewportHeight = this.container.clientHeight;
    this.render();
  }

  calculateVisibleRange() {
    this.viewportHeight = this.container.clientHeight;

    const start = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.buffer);
    const visibleCount = Math.ceil(this.viewportHeight / this.itemHeight) + this.buffer * 2;
    const end = Math.min(this.items.length, start + visibleCount);

    return { start, end };
  }

  render() {
    const { start, end } = this.calculateVisibleRange();

    if (start === this.startIndex && end === this.endIndex) return;

    this.startIndex = start;
    this.endIndex = end;

    const fragment = document.createDocumentFragment();

    for (let i = start; i < end; i++) {
      const item = this.items[i];
      if (!item) continue;

      const el = this.renderItem(item, i);
      if (el) {
        el.style.position = 'absolute';
        el.style.top = `${i * this.itemHeight}px`;
        el.style.left = '0';
        el.style.right = '0';
        el.style.height = `${this.itemHeight}px`;
        fragment.appendChild(el);
      }
    }

    const existingItems = this.container.querySelectorAll('[data-virtual-item]');
    existingItems.forEach((el) => el.remove());

    const wrapper = document.createElement('div');
    wrapper.dataset.virtualItem = 'true';
    wrapper.style.position = 'absolute';
    wrapper.style.top = '0';
    wrapper.style.left = '0';
    wrapper.style.right = '0';
    wrapper.appendChild(fragment);

    this.container.appendChild(wrapper);
  }

  scrollToIndex(index) {
    const top = index * this.itemHeight;
    this.container.scrollTop = top;
  }

  destroy() {
    this.container.removeEventListener('scroll', this.scrollListener);
    this.resizeObserver.disconnect();
  }

  getItemAt(index) {
    return this.items[index];
  }

  getTotalItems() {
    return this.items.length;
  }
}

function createVirtualList(container, options) {
  return new GPMVirtualList(container, options);
}
