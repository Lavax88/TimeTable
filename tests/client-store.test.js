const test = require('node:test');
const assert = require('node:assert/strict');
const ClientStore = require('../js/client-store');

test('ClientStore - Theme management with fallback', () => {
  assert.equal(ClientStore.getTheme('dark'), 'dark');
  ClientStore.setTheme('light');
  assert.equal(ClientStore.getTheme('dark'), 'light');
});

test('ClientStore - Task completion toggle and query', () => {
  const taskKey = 'Assignment 1|2026-11-20';
  assert.equal(ClientStore.isEventCompleted(taskKey), false);

  // Toggle on
  const completed = ClientStore.toggleEventCompleted(taskKey);
  assert.equal(completed, true);
  assert.equal(ClientStore.isEventCompleted(taskKey), true);
  assert.deepEqual(ClientStore.getCompletedEvents(), [taskKey]);

  // Toggle off (undo)
  const undone = ClientStore.toggleEventCompleted(taskKey);
  assert.equal(undone, false);
  assert.equal(ClientStore.isEventCompleted(taskKey), false);
  assert.deepEqual(ClientStore.getCompletedEvents(), []);
});

test('ClientStore - Install metadata persistence', () => {
  const meta = { dismissCount: 2, lastDismissed: 1700000000000 };
  ClientStore.setInstallMeta(meta);
  assert.deepEqual(ClientStore.getInstallMeta(), meta);
});

test('ClientStore - Dev date simulation', () => {
  assert.equal(ClientStore.getDevTestDate(), null);
  const iso = '2026-11-15T09:00:00';
  ClientStore.setDevTestDate(iso);
  const virtual = ClientStore.getDevTestDate();
  assert.ok(virtual instanceof Date);
  assert.equal(virtual.getFullYear(), 2026);
  assert.equal(virtual.getMonth(), 10); // November = index 10

  ClientStore.clearDevTestDate();
  assert.equal(ClientStore.getDevTestDate(), null);
});
