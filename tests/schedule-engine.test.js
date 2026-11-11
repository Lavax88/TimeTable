const test = require('node:test');
const assert = require('node:assert/strict');
const ScheduleEngine = require('../js/schedule-engine');

test('ScheduleEngine - Time conversions', () => {
  assert.equal(ScheduleEngine.minutesOf('08:00'), 480);
  assert.equal(ScheduleEngine.minutesOf('13:30'), 810);
  assert.equal(ScheduleEngine.minutesOf('00:00'), 0);

  assert.equal(ScheduleEngine.fmt('08:00'), '8:00 AM');
  assert.equal(ScheduleEngine.fmt('12:00'), '12:00 PM');
  assert.equal(ScheduleEngine.fmt('13:30'), '1:30 PM');

  assert.equal(ScheduleEngine.minsToLabel(15), '15 min');
  assert.equal(ScheduleEngine.minsToLabel(60), '1h');
  assert.equal(ScheduleEngine.minsToLabel(75), '1h 15m');
});

test('ScheduleEngine - withBreaks inserts break cards when gap > 5 mins', () => {
  const periods = [
    ['08:00', '08:45', 'DS', ''],
    ['09:10', '09:55', 'TOC', '']
  ];
  const result = ScheduleEngine.withBreaks(periods);
  assert.equal(result.length, 3);
  assert.deepEqual(result[1], ['08:45', '09:10', 'BREAK', '25 min']);
});

test('ScheduleEngine - withBreaks ignores gaps <= 5 mins', () => {
  const periods = [
    ['09:55', '10:00', 'P1', ''],
    ['10:05', '10:50', 'P2', '']
  ];
  const result = ScheduleEngine.withBreaks(periods);
  assert.equal(result.length, 2);
});

test('ScheduleEngine - Saturday Working Day rotation (1st, 3rd, 5th working; 2nd, 4th off)', () => {
  // November 2026:
  // Nov 1 = Sun
  // 1st Sat = Nov 7 (Occurrence 1 -> Working Day)
  // 2nd Sat = Nov 14 (Occurrence 2 -> Off)
  // 3rd Sat = Nov 21 (Occurrence 3 -> Working Day)
  // 4th Sat = Nov 28 (Occurrence 4 -> Off)
  assert.equal(ScheduleEngine.isSaturdayWorkingDay(new Date('2026-11-07')), true);
  assert.equal(ScheduleEngine.isSaturdayWorkingDay(new Date('2026-11-14')), false);
  assert.equal(ScheduleEngine.isSaturdayWorkingDay(new Date('2026-11-21')), true);
  assert.equal(ScheduleEngine.isSaturdayWorkingDay(new Date('2026-11-28')), false);

  // Month with 5 Saturdays (e.g. May 2026: May 2, 9, 16, 23, 30):
  // 5th Sat = May 30 (Occurrence 5 -> Working Day)
  assert.equal(ScheduleEngine.isSaturdayWorkingDay(new Date('2026-05-30')), true);
});

test('ScheduleEngine - getDividers calculates equal percentage markers', () => {
  assert.deepEqual(ScheduleEngine.getDividers(1), []);
  assert.deepEqual(ScheduleEngine.getDividers(2), [50]);
  assert.deepEqual(ScheduleEngine.getDividers(3), [33.33, 66.67]);
});

test('ScheduleEngine - getPeriodState tracks progress accurately', () => {
  const start = 480; // 08:00
  const end = 525;   // 08:45

  // Before period
  const before = ScheduleEngine.getPeriodState(start, end, 470, 0);
  assert.equal(before.status, 'upcoming');
  assert.equal(before.progressPercent, 0);

  // Mid period (halfway through 45 mins = 22.5 mins elapsed)
  const mid = ScheduleEngine.getPeriodState(start, end, 502, 30);
  assert.equal(mid.status, 'active');
  assert.equal(Math.round(mid.progressPercent), 50);

  // After period
  const after = ScheduleEngine.getPeriodState(start, end, 530, 0);
  assert.equal(after.status, 'passed');
  assert.equal(after.progressPercent, 100);
});

test('ScheduleEngine - holidays disable class days and generate holiday banners', () => {
  // Wed Nov 11, 2026
  const wed = new Date(2026, 10, 11, 10, 0, 0);
  assert.equal(ScheduleEngine.formatDateKey(wed), '2026-11-11');
  assert.equal(ScheduleEngine.isHolidayDate(wed, ['2026-11-11']), true);
  assert.equal(ScheduleEngine.isHolidayDate(wed, ['2026-11-12']), false);

  assert.equal(ScheduleEngine.isClassDay('Wednesday', wed, []), true);
  assert.equal(ScheduleEngine.isClassDay('Wednesday', wed, ['2026-11-11']), false);

  // Even a working 1st Saturday becomes non-class if marked as a holiday
  const firstSat = new Date(2026, 10, 7, 10, 0, 0);
  assert.equal(ScheduleEngine.isClassDay('Saturday', firstSat, []), true);
  assert.equal(ScheduleEngine.isClassDay('Saturday', firstSat, ['2026-11-07']), false);

  // Holiday banner for today vs another day in the same week
  const todayBanner = ScheduleEngine.getHolidayBannerInfo('Wednesday', wed, ['2026-11-11', '2026-11-13']);
  assert.equal(todayBanner.isHoliday, true);
  assert.equal(todayBanner.dateStr, '2026-11-11');
  assert.match(todayBanner.message, /Holiday today/i);
  assert.match(todayBanner.message, /No classes/i);

  const fridayBanner = ScheduleEngine.getHolidayBannerInfo('Friday', wed, ['2026-11-11', '2026-11-13']);
  assert.equal(fridayBanner.isHoliday, true);
  assert.equal(fridayBanner.dateStr, '2026-11-13');
  assert.match(fridayBanner.message, /Friday/i);
  assert.match(fridayBanner.message, /No classes/i);

  assert.equal(ScheduleEngine.getHolidayBannerInfo('Thursday', wed, ['2026-11-11', '2026-11-13']), null);
  assert.equal(ScheduleEngine.getHolidayBannerInfo('Exams', wed, ['2026-11-11']), null);
});
