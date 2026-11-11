/**
 * ThemedDatePicker
 * Reusable Hallmark Dusk themed calendar popup for date inputs.
 * Works with dynamically cloned rows and inline edit fields via event delegation.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ThemedDatePicker = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  function formatLocalDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function buildCalendarMonth(year, month, todayStr, selectedStr, minStr) {
    const firstDay = new Date(year, month, 1);
    let startOffset = firstDay.getDay() - 1;
    if (startOffset === -1) startOffset = 6; // Monday-first grid

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];

    for (let i = 0; i < startOffset; i++) {
      cells.push({ empty: true });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const disabled = Boolean(minStr && dateStr < minStr);
      cells.push({
        empty: false,
        day: d,
        dateStr,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedStr,
        disabled,
      });
    }

    return {
      title: `${MONTH_NAMES[month]} ${year}`,
      cells,
    };
  }

  let popupEl = null;
  let titleEl = null;
  let gridEl = null;
  let activeInput = null;
  let viewYear = new Date().getFullYear();
  let viewMonth = new Date().getMonth();
  let initialized = false;

  function ensurePopup() {
    if (popupEl) return;

    popupEl = document.createElement('div');
    popupEl.className = 'dev-popup dev-calendar-popup themed-cal-floating';
    popupEl.id = 'themedCalendarPopup';
    popupEl.style.display = 'none';
    popupEl.setAttribute('role', 'dialog');
    popupEl.setAttribute('aria-label', 'Calendar');

    popupEl.innerHTML = `
      <div class="dev-popup-header">
        <button type="button" class="dev-popup-nav-btn" data-cal-action="prev" aria-label="Previous month">
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span class="dev-popup-title" data-cal-title></span>
        <button type="button" class="dev-popup-nav-btn" data-cal-action="next" aria-label="Next month">
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
      <div class="dev-cal-weekdays">
        <span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span><span>Su</span>
      </div>
      <div class="dev-cal-grid" data-cal-grid></div>
      <div class="dev-popup-footer">
        <button type="button" class="dev-popup-action-btn" data-cal-action="today">Today</button>
        <button type="button" class="dev-popup-action-btn secondary" data-cal-action="close">Close</button>
      </div>
    `;

    document.body.appendChild(popupEl);
    titleEl = popupEl.querySelector('[data-cal-title]');
    gridEl = popupEl.querySelector('[data-cal-grid]');

    popupEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const actionBtn = e.target.closest('[data-cal-action]');
      if (actionBtn) {
        const action = actionBtn.dataset.calAction;
        if (action === 'prev') {
          viewMonth--;
          if (viewMonth < 0) {
            viewMonth = 11;
            viewYear--;
          }
          render();
        } else if (action === 'next') {
          viewMonth++;
          if (viewMonth > 11) {
            viewMonth = 0;
            viewYear++;
          }
          render();
        } else if (action === 'today') {
          if (activeInput) {
            const todayStr = formatLocalDate(new Date());
            const minStr = activeInput.getAttribute('min');
            if (!minStr || todayStr >= minStr) {
              selectDate(todayStr);
            }
          }
        } else if (action === 'close') {
          close();
        }
        return;
      }

      const dayBtn = e.target.closest('.dev-cal-day[data-date]');
      if (dayBtn && !dayBtn.disabled && activeInput) {
        selectDate(dayBtn.dataset.date);
      }
    });
  }

  function selectDate(dateStr) {
    if (!activeInput) return;
    activeInput.value = dateStr;
    activeInput.dispatchEvent(new Event('change', { bubbles: true }));
    close();
  }

  function render() {
    if (!popupEl || !activeInput) return;
    const todayStr = formatLocalDate(new Date());
    const selectedStr = activeInput.value || '';
    const minStr = activeInput.getAttribute('min') || '';

    const model = buildCalendarMonth(viewYear, viewMonth, todayStr, selectedStr, minStr);
    titleEl.textContent = model.title;
    gridEl.innerHTML = '';

    model.cells.forEach((cell) => {
      if (cell.empty) {
        const empty = document.createElement('div');
        empty.className = 'dev-cal-day empty';
        gridEl.appendChild(empty);
        return;
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dev-cal-day';
      btn.textContent = String(cell.day);
      btn.dataset.date = cell.dateStr;
      if (cell.isToday) btn.classList.add('today');
      if (cell.isSelected) btn.classList.add('selected');
      if (cell.disabled) {
        btn.classList.add('disabled');
        btn.disabled = true;
      }
      gridEl.appendChild(btn);
    });
  }

  function positionPopup() {
    if (!popupEl || !activeInput) return;
    const anchor = activeInput.closest('.themed-date-wrapper') || activeInput;
    const rect = anchor.getBoundingClientRect();

    popupEl.style.display = 'block';
    const popupRect = popupEl.getBoundingClientRect();
    const margin = 12;

    let left = rect.left;
    if (left + popupRect.width > window.innerWidth - margin) {
      left = window.innerWidth - popupRect.width - margin;
    }
    if (left < margin) left = margin;

    let top = rect.bottom + 6;
    if (top + popupRect.height > window.innerHeight - margin && rect.top - popupRect.height - 6 >= margin) {
      top = rect.top - popupRect.height - 6;
    }

    popupEl.style.left = `${Math.round(left)}px`;
    popupEl.style.top = `${Math.round(top)}px`;
  }

  function openForInput(inputEl) {
    ensurePopup();
    if (activeInput === inputEl && popupEl.style.display === 'block') {
      close();
      return;
    }

    activeInput = inputEl;
    const parts = (inputEl.value || '').split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && parts[1] >= 1 && parts[1] <= 12) {
      viewYear = parts[0];
      viewMonth = parts[1] - 1;
    } else {
      const now = new Date();
      viewYear = now.getFullYear();
      viewMonth = now.getMonth();
    }

    render();
    positionPopup();
  }

  function close() {
    if (popupEl) popupEl.style.display = 'none';
    activeInput = null;
  }

  function initDelegation() {
    if (initialized) return;
    initialized = true;

    document.addEventListener('click', (e) => {
      const triggerInput = e.target.closest('input.themed-date-input');
      if (triggerInput) {
        e.stopPropagation();
        openForInput(triggerInput);
        return;
      }
      const triggerBtn = e.target.closest('.themed-date-btn');
      if (triggerBtn) {
        e.stopPropagation();
        const wrapper = triggerBtn.closest('.themed-date-wrapper');
        const input = wrapper && wrapper.querySelector('input.themed-date-input');
        if (input) openForInput(input);
        return;
      }
      if (popupEl && popupEl.style.display === 'block' && !popupEl.contains(e.target)) {
        close();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && popupEl && popupEl.style.display === 'block') {
        close();
      }
    });

    window.addEventListener('resize', () => {
      if (popupEl && popupEl.style.display === 'block' && activeInput) {
        positionPopup();
      }
    });
  }

  function enhance(inputEl) {
    if (!inputEl || inputEl.dataset.themedEnhanced === 'true') return;
    initDelegation();

    inputEl.dataset.themedEnhanced = 'true';
    inputEl.type = 'text';
    inputEl.readOnly = true;
    inputEl.autocomplete = 'off';
    if (!inputEl.placeholder) inputEl.placeholder = 'YYYY-MM-DD';
    inputEl.classList.add('themed-date-input');

    const wrapper = document.createElement('div');
    wrapper.className = 'themed-date-wrapper';
    if (inputEl.style.flex) {
      wrapper.style.flex = inputEl.style.flex;
      inputEl.style.flex = '';
    }
    if (inputEl.classList.contains('event-date')) wrapper.classList.add('themed-date-event');
    if (inputEl.classList.contains('series-date')) wrapper.classList.add('themed-date-series');

    inputEl.parentNode.insertBefore(wrapper, inputEl);
    wrapper.appendChild(inputEl);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dev-picker-btn themed-date-btn';
    btn.setAttribute('aria-label', 'Select date');
    btn.innerHTML = `<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
    wrapper.appendChild(btn);
  }

  function enhanceAll(rootEl = document) {
    rootEl.querySelectorAll('input[type="date"]').forEach(enhance);
  }

  return {
    formatLocalDate,
    buildCalendarMonth,
    enhance,
    enhanceAll,
    close,
  };
});
