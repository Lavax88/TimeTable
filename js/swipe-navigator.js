/**
 * SwipeNavigator
 * Deep UI gesture module encapsulating touch physics, horizontal swipe tracking,
 * rubber-band resistance at edges, RAF batching, and tab indicator interpolation.
 * Exposes a clean interface with selection callbacks.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SwipeNavigator = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function createSwipeNavigator(config) {
    const {
      containerEl,
      trackEl,
      indicatorEl,
      tabsEl,
      getItemsCount,
      getCurrentIndex,
      onSelect,
    } = config;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let touchTracking = false;
    let isSwiping = false;
    let isScrolling = false;
    let panelWidth = 0;
    let startTranslateX = 0;
    let cachedHeights = [];
    let cachedTabs = [];
    let rafId = null;
    let latestTranslateX = 0;
    let latestHeight = 0;
    let latestIndicatorLeft = 0;
    let latestIndicatorWidth = 0;
    let latestActiveIdx = -1;
    let wheelCooldown = false;

    function handleTouchStart(e) {
      if (e.touches.length !== 1) return;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      trackEl.style.transition = 'none';
      containerEl.style.transition = 'none';
      if (indicatorEl) indicatorEl.style.transition = 'none';

      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
      touchTracking = true;
      isSwiping = false;
      isScrolling = false;

      panelWidth = containerEl.offsetWidth || window.innerWidth;
      const currIdx = getCurrentIndex();
      startTranslateX = -currIdx * panelWidth;

      cachedHeights = Array.from(trackEl.children).map(c => c.offsetHeight);
      if (tabsEl) {
        const allTabs = tabsEl.querySelectorAll('.tab');
        cachedTabs = Array.from(allTabs).map(t => ({ left: t.offsetLeft, width: t.offsetWidth }));
      }
      trackEl.classList.add('swiping');
    }

    function handleTouchMove(e) {
      if (!touchTracking) return;
      const touch = e.touches[0];
      const rawDx = touch.clientX - touchStartX;
      const rawDy = touch.clientY - touchStartY;

      if (!isSwiping && !isScrolling) {
        const absX = Math.abs(rawDx);
        const absY = Math.abs(rawDy);
        if (absY > absX && absY > 8) {
          isScrolling = true;
          trackEl.classList.remove('swiping');
          return;
        }
        if (absX > absY && absX > 8) {
          isSwiping = true;
        }
      }

      if (isScrolling) return;

      if (isSwiping) {
        if (e.cancelable) e.preventDefault();

        const itemsCount = getItemsCount();
        const currIdx = getCurrentIndex();
        const isAtStart = currIdx === 0 && rawDx > 0;
        const isAtEnd = currIdx === itemsCount - 1 && rawDx < 0;

        let appliedDx = rawDx;
        if (isAtStart || isAtEnd) {
          appliedDx = rawDx * 0.28; // Rubber-band edge resistance
        }

        const currentTranslateX = startTranslateX + appliedDx;
        const targetIdx = rawDx < 0
          ? Math.min(itemsCount - 1, currIdx + 1)
          : Math.max(0, currIdx - 1);

        const currentH = cachedHeights[currIdx] || 0;
        const targetH = cachedHeights[targetIdx] || 0;
        const progress = Math.min(1, Math.abs(appliedDx) / panelWidth);

        latestTranslateX = currentTranslateX;
        latestHeight = (currentH > 0 && targetH > 0)
          ? Math.round(currentH + (targetH - currentH) * progress)
          : 0;

        const curTab = cachedTabs[currIdx];
        const tgtTab = cachedTabs[targetIdx];
        if (curTab && tgtTab) {
          latestIndicatorLeft = curTab.left + (tgtTab.left - curTab.left) * progress;
          latestIndicatorWidth = curTab.width + (tgtTab.width - curTab.width) * progress;
          latestActiveIdx = progress > 0.5 ? targetIdx : currIdx;
        }

        if (!rafId) {
          rafId = requestAnimationFrame(() => {
            rafId = null;
            trackEl.style.transform = `translateX(${latestTranslateX}px)`;
            if (latestHeight > 0) {
              containerEl.style.height = latestHeight + 'px';
            }
            if (indicatorEl && latestIndicatorWidth > 0 && tabsEl) {
              indicatorEl.style.transition = 'none';
              indicatorEl.style.transform = `translateX(${latestIndicatorLeft}px)`;
              indicatorEl.style.width = `${latestIndicatorWidth}px`;
              const allTabs = tabsEl.querySelectorAll('.tab');
              allTabs.forEach((t, i) => t.classList.toggle('active', i === latestActiveIdx));
            }
          });
        }
      }
    }

    function handleTouchEnd(e) {
      if (!touchTracking) return;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (!isSwiping) {
        touchTracking = false;
        trackEl.classList.remove('swiping');
        return;
      }
      touchTracking = false;
      isSwiping = false;

      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartX;
      const dt = Math.max(1, Date.now() - touchStartTime);
      const velocity = Math.abs(dx) / dt;
      const distance = Math.abs(dx);

      const itemsCount = getItemsCount();
      const currIdx = getCurrentIndex();
      const isDistance = distance >= panelWidth * 0.38;
      const isFlick = velocity >= 0.45 && distance >= 75;

      let nextIdx = currIdx;
      if (isDistance || isFlick) {
        if (dx < 0 && currIdx < itemsCount - 1) {
          nextIdx = currIdx + 1;
        } else if (dx > 0 && currIdx > 0) {
          nextIdx = currIdx - 1;
        }
      }

      onSelect(nextIdx, true);
    }

    function handleTouchCancel() {
      if (!touchTracking) return;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      touchTracking = false;
      trackEl.classList.remove('swiping');
      if (isSwiping) {
        isSwiping = false;
        onSelect(getCurrentIndex(), true);
      }
    }

    function handleWheel(e) {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 24) {
        if (wheelCooldown) return;
        wheelCooldown = true;
        const currIdx = getCurrentIndex();
        const itemsCount = getItemsCount();
        const offset = e.deltaX > 0 ? 1 : -1;
        const nextIdx = Math.max(0, Math.min(itemsCount - 1, currIdx + offset));
        if (nextIdx !== currIdx) {
          onSelect(nextIdx, true);
        }
        setTimeout(() => { wheelCooldown = false; }, 260);
      }
    }

    function mount() {
      containerEl.addEventListener('touchstart', handleTouchStart, { passive: true });
      containerEl.addEventListener('touchmove', handleTouchMove, { passive: false });
      containerEl.addEventListener('touchend', handleTouchEnd, { passive: true });
      containerEl.addEventListener('touchcancel', handleTouchCancel, { passive: true });
      containerEl.addEventListener('wheel', handleWheel, { passive: true });
    }

    function destroy() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      containerEl.removeEventListener('touchstart', handleTouchStart);
      containerEl.removeEventListener('touchmove', handleTouchMove);
      containerEl.removeEventListener('touchend', handleTouchEnd);
      containerEl.removeEventListener('touchcancel', handleTouchCancel);
      containerEl.removeEventListener('wheel', handleWheel);
    }

    return {
      mount,
      destroy,
    };
  }

  return {
    createSwipeNavigator,
  };
});
