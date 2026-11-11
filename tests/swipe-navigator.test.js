const test = require('node:test');
const assert = require('node:assert/strict');
const SwipeNavigator = require('../js/swipe-navigator');

function createMockElement() {
  const listeners = {};
  return {
    style: {},
    classList: {
      add: () => {},
      remove: () => {},
      toggle: () => {},
    },
    children: [],
    offsetWidth: 375,
    offsetHeight: 600,
    addEventListener(event, fn) {
      listeners[event] = listeners[event] || [];
      listeners[event].push(fn);
    },
    removeEventListener(event, fn) {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter(l => l !== fn);
    },
    querySelectorAll() {
      return [];
    },
    _listeners: listeners,
  };
}

test('SwipeNavigator - Lifecycle and listener binding', () => {
  const containerEl = createMockElement();
  const trackEl = createMockElement();
  let selected = -1;

  const navigator = SwipeNavigator.createSwipeNavigator({
    containerEl,
    trackEl,
    indicatorEl: null,
    tabsEl: null,
    getItemsCount: () => 5,
    getCurrentIndex: () => 0,
    onSelect: (idx) => { selected = idx; },
  });

  // Mount listeners
  navigator.mount();
  assert.ok(containerEl._listeners['touchstart'].length > 0);
  assert.ok(containerEl._listeners['touchmove'].length > 0);
  assert.ok(containerEl._listeners['touchend'].length > 0);
  assert.ok(containerEl._listeners['wheel'].length > 0);

  // Wheel event navigation
  const wheelHandler = containerEl._listeners['wheel'][0];
  wheelHandler({ deltaX: 50, deltaY: 0 }); // swipe next
  assert.equal(selected, 1);

  // Destroy unbinds all listeners
  navigator.destroy();
  assert.equal(containerEl._listeners['touchstart'].length, 0);
  assert.equal(containerEl._listeners['touchmove'].length, 0);
  assert.equal(containerEl._listeners['touchend'].length, 0);
  assert.equal(containerEl._listeners['wheel'].length, 0);
});
