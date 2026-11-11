const test = require('node:test');
const assert = require('node:assert/strict');
const { EventsRepository, InMemoryAdapter, isExpired } = require('../api/lib/events-repository');

test('EventsRepository - Expiration logic (IST 13:30)', () => {
  const ev = { title: 'CS Test', date: '2026-11-11' };

  // Before 13:30 IST on 2026-11-11
  // 13:00 IST is 07:30 UTC
  const beforeExpiry = new Date('2026-11-11T13:00:00+05:30');
  assert.equal(isExpired(ev, beforeExpiry), false);

  // Exactly or after 13:30 IST on 2026-11-11
  const afterExpiry = new Date('2026-11-11T13:30:00+05:30');
  assert.equal(isExpired(ev, afterExpiry), true);
});

test('EventsRepository - CRUD mutations with InMemoryAdapter', async () => {
  const adapter = new InMemoryAdapter({
    EVENTS: [
      { title: 'Assignment 1', date: '2026-11-20', type: 'deadline', subject: 'Theory of Computation' }
    ],
    HOLIDAYS: [],
    SETTINGS: {}
  });
  const repo = new EventsRepository(adapter);

  // Add event
  await repo.applyMutation('add', {
    events: [{ title: 'Series 1 Exam', date: '2026-11-25', type: 'exam', subject: 'Data Structures' }]
  });
  let data = await repo.getData({ pruneExpired: false });
  assert.equal(data.EVENTS.length, 2);

  // Edit event
  await repo.applyMutation('edit', {
    targetTitle: 'Assignment 1',
    targetDate: '2026-11-20',
    updatedEvent: { title: 'Assignment 1 (Extended)', date: '2026-11-22', type: 'deadline' }
  });
  data = await repo.getData({ pruneExpired: false });
  assert.equal(data.EVENTS.find(e => e.title === 'Assignment 1 (Extended)').date, '2026-11-22');

  // Add & remove holiday
  await repo.applyMutation('add_holiday', { holidayDate: '2026-11-28' });
  data = await repo.getData({ pruneExpired: false });
  assert.deepEqual(data.HOLIDAYS, ['2026-11-28']);

  await repo.applyMutation('remove_holiday', { holidayDate: '2026-11-28' });
  data = await repo.getData({ pruneExpired: false });
  assert.deepEqual(data.HOLIDAYS, []);

  // Delete event
  await repo.applyMutation('delete', {
    targetTitle: 'Assignment 1 (Extended)',
    targetDate: '2026-11-22'
  });
  data = await repo.getData({ pruneExpired: false });
  assert.equal(data.EVENTS.length, 1);
});

test('EventsRepository - Auto-prunes expired events on getData', async () => {
  const adapter = new InMemoryAdapter({
    EVENTS: [
      { title: 'Past Event', date: '2026-11-01', type: 'general' },
      { title: 'Future Event', date: '2026-12-01', type: 'general' }
    ],
    HOLIDAYS: [],
    SETTINGS: {}
  });
  const repo = new EventsRepository(adapter);
  const now = new Date('2026-11-15T12:00:00+05:30');

  const data = await repo.getData({ pruneExpired: true, referenceTime: now });
  assert.equal(data.EVENTS.length, 1);
  assert.equal(data.EVENTS[0].title, 'Future Event');
});
