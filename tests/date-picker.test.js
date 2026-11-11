const test = require('node:test');
const assert = require('node:assert/strict');
const ThemedDatePicker = require('../js/date-picker.js');

test('formatLocalDate formats local Date as YYYY-MM-DD', () => {
  const d = new Date(2026, 0, 5); // Jan 5, 2026
  assert.equal(ThemedDatePicker.formatLocalDate(d), '2026-01-05');

  const d2 = new Date(2024, 11, 31); // Dec 31, 2024
  assert.equal(ThemedDatePicker.formatLocalDate(d2), '2024-12-31');
});

test('buildCalendarMonth aligns Monday-first grid and marks today and selected', () => {
  // November 2026 starts on Sunday -> Monday-first offset is 6 empty cells, 30 days
  const model = ThemedDatePicker.buildCalendarMonth(2026, 10, '2026-11-11', '2026-11-20', '');
  assert.equal(model.title, 'November 2026');
  assert.equal(model.cells.slice(0, 6).every((c) => c.empty), true);
  assert.equal(model.cells.length, 36);

  const nov1 = model.cells[6];
  assert.equal(nov1.empty, false);
  assert.equal(nov1.day, 1);
  assert.equal(nov1.dateStr, '2026-11-01');

  const nov11 = model.cells.find((c) => !c.empty && c.day === 11);
  assert.equal(nov11.isToday, true);
  assert.equal(nov11.isSelected, false);

  const nov20 = model.cells.find((c) => !c.empty && c.day === 20);
  assert.equal(nov20.isSelected, true);
  assert.equal(nov20.isToday, false);
});

test('buildCalendarMonth disables dates strictly earlier than minStr', () => {
  const model = ThemedDatePicker.buildCalendarMonth(2026, 10, '2026-11-11', '', '2026-11-11');
  const nov10 = model.cells.find((c) => !c.empty && c.day === 10);
  const nov11 = model.cells.find((c) => !c.empty && c.day === 11);
  const nov12 = model.cells.find((c) => !c.empty && c.day === 12);

  assert.equal(nov10.disabled, true);
  assert.equal(nov11.disabled, false);
  assert.equal(nov12.disabled, false);
});

test('buildCalendarMonth handles leap year February', () => {
  const leap = ThemedDatePicker.buildCalendarMonth(2024, 1, '2024-02-29', '', '');
  const nonLeap = ThemedDatePicker.buildCalendarMonth(2026, 1, '2026-02-28', '', '');

  const leapDays = leap.cells.filter((c) => !c.empty);
  const nonLeapDays = nonLeap.cells.filter((c) => !c.empty);

  assert.equal(leapDays.length, 29);
  assert.equal(leapDays[leapDays.length - 1].dateStr, '2024-02-29');
  assert.equal(nonLeapDays.length, 28);
  assert.equal(nonLeapDays[nonLeapDays.length - 1].dateStr, '2026-02-28');
});
