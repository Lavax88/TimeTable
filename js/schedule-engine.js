/**
 * ScheduleEngine
 * Deep in-process module for KTU timetable schedule calculations,
 * time conversions, Saturday rotation rules, break insertions, and progress states.
 * Free of DOM, timers, and storage dependencies.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ScheduleEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function minutesOf(hhmm) {
    if (!hhmm || typeof hhmm !== 'string') return 0;
    const [h, m] = hhmm.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  function fmt(hhmm) {
    if (!hhmm) return '';
    const [h, m] = hhmm.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
  }

  function minsToLabel(mins) {
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }

  function withBreaks(periods) {
    if (!periods || !Array.isArray(periods)) return [];
    const out = [];
    for (let i = 0; i < periods.length; i++) {
      out.push(periods[i]);
      if (i < periods.length - 1) {
        const gap = minutesOf(periods[i + 1][0]) - minutesOf(periods[i][1]);
        if (gap > 5) {
          out.push([periods[i][1], periods[i + 1][0], 'BREAK', minsToLabel(gap)]);
        }
      }
    }
    return out;
  }

  function isSaturdayWorkingDay(date) {
    const d = date instanceof Date ? date : new Date(date);
    const occurrence = Math.ceil(d.getDate() / 7);
    return occurrence === 1 || occurrence === 3 || occurrence === 5;
  }
  const isSaturdayClassWeek = isSaturdayWorkingDay;

  function thisWeeksSaturday(date) {
    const d = date instanceof Date ? new Date(date) : new Date();
    const daysSinceMonday = (d.getDay() + 6) % 7;
    const offsetToSaturday = 5 - daysSinceMonday;
    const sat = new Date(d);
    sat.setDate(d.getDate() + offsetToSaturday);
    return sat;
  }

  function getSaturdayBannerInfo(currentDate) {
    const satDate = thisWeeksSaturday(currentDate);
    const satOccurrence = Math.ceil(satDate.getDate() / 7);
    const hasClass = isSaturdayWorkingDay(satDate);

    if (!hasClass) {
      return {
        hasClass: false,
        occurrence: satOccurrence,
        className: 'caution-banner',
        message: 'No classes this Saturday. Classes only run on the 1st, 3rd & 5th Saturdays of the month.',
      };
    } else if (satOccurrence === 5) {
      return {
        hasClass: true,
        occurrence: satOccurrence,
        className: 'caution-banner success',
        message: 'Saturday Working Day is scheduled this week — there is class during the 5th Saturday.',
      };
    }
    return {
      hasClass: true,
      occurrence: satOccurrence,
      className: 'caution-banner success',
      message: 'Saturday Working Day is scheduled this week.',
    };
  }

  function formatDateKey(date) {
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function isHolidayDate(date, holidays = []) {
    if (!Array.isArray(holidays) || holidays.length === 0) return false;
    const key = formatDateKey(date);
    return Boolean(key && holidays.includes(key));
  }

  function getDateForWeekDay(dayName, referenceDate) {
    const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const idx = weekDays.indexOf(dayName);
    if (idx === -1) return null;
    const { monday } = getWeekRange(referenceDate);
    const target = new Date(monday);
    target.setDate(monday.getDate() + idx);
    return target;
  }

  function getHolidayBannerInfo(dayName, referenceDate, holidays = []) {
    const targetDate = getDateForWeekDay(dayName, referenceDate);
    if (!targetDate || !isHolidayDate(targetDate, holidays)) return null;

    const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
    const dateStr = formatDateKey(targetDate);
    const isToday = dateStr === formatDateKey(ref);

    return {
      isHoliday: true,
      dateStr,
      className: 'caution-banner holiday-banner',
      message: isToday
        ? 'Holiday today — No classes scheduled.'
        : `Holiday on ${dayName} — No classes scheduled.`,
    };
  }

  function isClassDay(dayName, currentDate, holidays = []) {
    const d = currentDate instanceof Date ? currentDate : new Date(currentDate);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDayName = dayNames[d.getDay()];

    if (dayName !== currentDayName) return false;
    if (isHolidayDate(d, holidays)) return false;
    if (dayName === 'Saturday') return isSaturdayClassWeek(d);
    if (dayName === 'Sunday') return false;
    return true;
  }

  function getDividers(dividerCount) {
    const count = dividerCount || 1;
    const dividers = [];
    for (let i = 0; i < count - 1; i++) {
      const pos = ((i + 1) / count) * 100;
      dividers.push(Math.round(pos * 100) / 100);
    }
    return dividers;
  }

  function getWeekRange(date) {
    const now = date instanceof Date ? new Date(date) : new Date();
    const nowDay = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((nowDay + 6) % 7));
    monday.setHours(0, 0, 0, 0);

    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);

    return { monday, nextMonday };
  }

  function getPeriodState(startMin, endMin, currentMinutes, currentSeconds = 0) {
    if (currentMinutes < startMin) {
      return {
        status: 'upcoming',
        progressPercent: 0,
        remainingMinutes: startMin - currentMinutes,
      };
    }
    if (currentMinutes >= endMin) {
      return {
        status: 'passed',
        progressPercent: 100,
        remainingMinutes: 0,
      };
    }

    const totalSeconds = (endMin - startMin) * 60;
    const elapsedSeconds = (currentMinutes - startMin) * 60 + currentSeconds;
    const progressPercent = Math.min(100, Math.max(0, (elapsedSeconds / totalSeconds) * 100));
    const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
    const remMin = Math.ceil(remainingSeconds / 60);

    return {
      status: 'active',
      progressPercent,
      remainingMinutes: remMin,
      remainingSeconds,
    };
  }

  return {
    minutesOf,
    fmt,
    format12HourTime: fmt,
    minsToLabel,
    withBreaks,
    formatDateKey,
    isHolidayDate,
    getDateForWeekDay,
    getHolidayBannerInfo,
    isSaturdayWorkingDay,
    isSaturdayClassWeek,
    thisWeeksSaturday,
    getSaturdayBannerInfo,
    isClassDay,
    getDividers,
    getWeekRange,
    getPeriodState,
  };
});
