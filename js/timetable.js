/* ---------- Theme ---------- */
const root = document.documentElement;
const themeToggle = document.getElementById("themeToggle");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
let currentTheme = ClientStore.getTheme(prefersDark ? "dark" : "light");
applyTheme(currentTheme);

themeToggle.addEventListener("click", () => {
  currentTheme = currentTheme === "dark" ? "light" : "dark";
  applyTheme(currentTheme);
});

function applyTheme(theme){
  root.setAttribute("data-theme", theme);
  if (themeToggle) {
    themeToggle.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
  }
  ClientStore.setTheme(theme);
  const isDark = theme === "dark";
  const color = isDark ? "#17181f" : "#f5f4f1";

  const metaIds = ["themeColorMeta", "themeColorLight", "themeColorDark"];
  metaIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.setAttribute("content", color);
  });
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => {
    m.setAttribute("content", color);
  });

  const appleMeta = document.getElementById("appleStatusBarMeta") || document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (appleMeta) {
    appleMeta.setAttribute("content", isDark ? "black-translucent" : "default");
  }
}

/* ---------- Globals ---------- */
let _ACCENT = null;
let _SUBJECTS = null;
let _SCHEDULE = null;
let _events = [];
let _holidays = [];
let _settings = {};
let _lastCheckedDate = new Date().toDateString();
let _lastBadgeMinute = -1;

/* ---------- Dev date override (DEV-ONLY, hostname-gated) ---------- */
const IS_DEV =
  window.location.hostname === 'time-table-git-dev-cseb.vercel.app' ||
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.includes('dev') ||
  window.location.search.includes('dev=1') ||
  window.location.protocol === 'file:';

/* Apply background pattern and dev viewport simulation mode */
const ALL_PATTERNS = ['dots', 'grid', 'blueprint', 'mesh', 'screentone', 'none'];
const RANDOM_PATTERNS = ['dots', 'grid', 'blueprint', 'mesh', 'screentone'];

let currentPattern = ClientStore.getPattern(IS_DEV, RANDOM_PATTERNS);

document.documentElement.classList.remove(...ALL_PATTERNS.map(p => 'pattern-' + p));
document.documentElement.classList.add('pattern-' + currentPattern);
if (document.body) {
  document.body.classList.remove(...ALL_PATTERNS.map(p => 'pattern-' + p));
  document.body.classList.add('pattern-' + currentPattern);
}

if (IS_DEV) {
  try {
    const storedViewport = ClientStore.getDevViewport();
    if (storedViewport === 'mobile') {
      document.body.classList.add('dev-mobile-ui');
    } else if (storedViewport === 'desktop') {
      document.body.classList.add('dev-desktop-ui');
    }
  } catch (_) {}
}

function getDevNow() {
  if (!IS_DEV) return new Date();
  return ClientStore.getDevTestDate() || new Date();
}

/* ---------- Event helpers ---------- */
const typeCardLabels = {
  exam: 'Upcoming Exam',
  test: 'Upcoming Class Test',
  deadline: 'Pending Assignment',
  general: 'General Event',
  reminder: 'Reminder'
};
const typeShortLabels = {
  exam: 'SERIES',
  test: 'TEST',
  deadline: 'DEADLINE',
  general: 'EVENT',
  reminder: 'REMINDER'
};

function eventKey(ev) { return ev.title + '|' + ev.date; }
function isEventCompleted(ev) {
  return ClientStore.isEventCompleted(eventKey(ev));
}
function toggleEventComplete(ev) {
  ClientStore.toggleEventCompleted(eventKey(ev));
  renderEvents();
}

function subjectAccent(subjectName) {
  if (!subjectName || !_SUBJECTS) return null;
  for (const details of Object.values(_SUBJECTS)) {
    if (details.name === subjectName) {
      return _ACCENT[details.accentKey] || null;
    }
  }
  return null;
}

function createEventCard(ev) {
  const card = document.createElement("div");
  card.className = "card now";

  const subAccent = subjectAccent(ev.subject);
  const accent = subAccent || (_ACCENT && _ACCENT.ACT) || ['#27272A', '#F4F4F5'];
  card.style.setProperty("--card-accent", accent[0]);

  card.dataset.eventDate = ev.date;
  card.dataset.eventType = ev.type;

  // Resolve and store subject key so the progress bar can pinpoint the lecture start time
  if (ev.subject && _SUBJECTS) {
    for (const [k, details] of Object.entries(_SUBJECTS)) {
      if (details.name === ev.subject) {
        card.dataset.eventSubjectKey = k;
        break;
      }
    }
  }

  const d = new Date(ev.date);
  const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  const tagLabel = typeCardLabels[ev.type] || 'Event';
  const completedLabels = { exam: 'Completed Exam', test: 'Completed Class Test', deadline: 'Completed Assignment', general: 'Completed Event', reminder: 'Completed Reminder' };
  const canComplete = ev.type === 'deadline' || ev.type === 'reminder';
  const completed = canComplete && isEventCompleted(ev);
  const displayTag = completed ? (completedLabels[ev.type] || tagLabel) : tagLabel;
  const shortLabel = typeShortLabels[ev.type] || ev.type.toUpperCase();

    let subjLabel = '';
  if (ev.subject && _SUBJECTS) {
    for (const d of Object.values(_SUBJECTS)) {
      if (d.name === ev.subject) { subjLabel = d.chipLabel; break; }
    }
  }
  const displayTitle = (ev.type === 'exam' && ev.subject) ? ev.subject : ev.title;
  let mainHeading = displayTitle;
  if (subjLabel && !displayTitle.includes('(' + subjLabel + ')') && displayTitle !== subjLabel) {
    mainHeading += ' (' + subjLabel + ')';
  }

  const completeBtnHtml = canComplete
    ? (completed
        ? ` <button class="complete-btn" aria-label="Undo completion"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:3px;"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>Undo</button>`
        : ` <button class="complete-btn" aria-label="Mark as completed"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:3px;"><polyline points="20 6 9 17 4 12"/></svg>Done</button>`)
    : '';

  card.innerHTML = `
    <div class="card-main">
      <div class="card-time" style="flex-basis: 90px;">
        <span class="p-num" style="font-size:15px; color:var(--ink);">${dateStr}</span>
        <span class="p-time" style="font-size: 11px; margin-top:6px; color:var(--ink-soft);">${shortLabel}</span>
      </div>
      <div class="card-body">
        <div class="card-info">
          <span class="now-tag" style="background:${accent[0]}">${displayTag}</span>${completeBtnHtml}<br>
          <p class="subj-name" style="margin-top:4px;">${mainHeading}</p>
          <div class="progress-wrap">
            <div class="progress-track"><div class="progress-fill"></div></div>
            <span class="progress-remaining" style="font-variant-numeric: tabular-nums; min-width: 90px;"></span>
          </div>
        </div>
      </div>
    </div>
  `;
  if (canComplete) {
    var btn = card.querySelector('.complete-btn');
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleEventComplete(ev);
    });
  }
  return card;
}


function isEventExpired(ev) {
  if (!ev || !ev.date) return false;
  const parts = ev.date.split('-').map(Number);
  const expiry = new Date(parts[0], parts[1] - 1, parts[2], 13, 30, 0, 0).getTime();
  const now = getDevNow().getTime();
  return now >= expiry;
}

function injectCalendarBadges() {
  document.querySelectorAll('.event-calendar-badge').forEach(el => el.remove());

  const now = getDevNow();
  const nowDay = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  _lastBadgeMinute = nowMinutes;
  const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const nowDayName = dayNames[nowDay];

  const { monday, nextMonday } = ScheduleEngine.getWeekRange(now);

  if (!_events || !_events.length) return;

  _events.filter(ev => !isEventExpired(ev)).forEach(ev => {
    if (!ev.subject) return;
    const parts = ev.date.split('-').map(Number);
    const evDate = new Date(parts[0], parts[1] - 1, parts[2]);
    if (evDate < monday || evDate >= nextMonday) return;

    let subjectKey = null;
    for (const [key, details] of Object.entries(_SUBJECTS)) {
      if (details.name === ev.subject) {
        subjectKey = key;
        break;
      }
    }
    if (!subjectKey) return;

    const evDayName = dayNames[evDate.getDay()];
    const panel = document.querySelector('.day-panel[data-day="' + evDayName + '"]');
    if (!panel) return;

    const cards = panel.querySelectorAll('.card[data-subject-key="' + subjectKey + '"]');
    if (!cards.length) return;

    const shortLabel = typeShortLabels[ev.type] || ev.type.toUpperCase();

    cards.forEach(card => {
      if (evDayName === nowDayName) {
        const endMin = Number(card.dataset.endMin);
        if (endMin && nowMinutes >= endMin) return;
      }
      const badge = document.createElement('div');
      badge.className = 'event-calendar-badge';
      badge.textContent = shortLabel + ': ' + ev.title;
      card.querySelector('.subj-sub').after(badge);
    });
  });
}

/* ---------- Events Fetching & Rendering ---------- */
async function loadEvents() {
  try {
    const res = await fetch('/api/events');
    const data = await res.json();
    _events = data.EVENTS || [];
    _holidays = data.HOLIDAYS || [];
    _settings = data.SETTINGS || {};
  } catch (e) {
    console.error('Failed to load events:', e);
    _events = [];
    _holidays = [];
    _settings = {};
  }
  renderEvents();
  checkExamMode();
}

function getFilteredEvents() {
  const upcoming = _events
    .filter(ev => !isEventExpired(ev))
    .sort((a,b) => new Date(a.date) - new Date(b.date));
  return {
    exams: upcoming.filter(e => e.type === 'exam'),
    deadlines: upcoming.filter(e => e.type !== 'exam'),
  };
}

function renderEvents() {
  const { exams, deadlines } = getFilteredEvents();

  // Render upcoming tasks section
  const container = document.getElementById('upcomingTasks');
  if (container) {
    container.innerHTML = '';
    if (deadlines.length > 0) {
      container.innerHTML = `<p class="legend-title" style="margin: 0 0 10px 4px;">Urgent Tasks</p>`;
      deadlines.forEach(ev => container.appendChild(createEventCard(ev)));
      const tt = document.createElement('p');
      tt.className = 'legend-title';
      tt.style.cssText = 'margin: 20px 0 10px 4px;';
      tt.textContent = 'Timetable';
      container.appendChild(tt);
    }
  }

  // Render exams tab
  const examsPanel = document.querySelector('.day-panel[data-day="Exams"]');
  if (examsPanel) {
    examsPanel.innerHTML = '';
    if (exams.length === 0) {
      examsPanel.innerHTML = `<div class="free-note">No upcoming exams scheduled. You're safe (for now).</div>`;
    } else {
      exams.forEach(ev => examsPanel.appendChild(createEventCard(ev)));
    }
  }
}

/* ---------- Data Fetching & Initialization ---------- */
async function initTimetableApp() {
  try {
    let data = null;
    try {
      const response = await fetch('/data.json?t=' + Date.now());
      data = await response.json();
      ClientStore.setCachedTimetableData(data);
    } catch (e) {
      data = ClientStore.getCachedTimetableData();
    }

    _ACCENT = data.ACCENT;
    _SUBJECTS = data.SUBJECTS;
    _SCHEDULE = data.SCHEDULE;
    const SCHEDULE = data.SCHEDULE;

    const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday", "Exams"];

    const {
      fmt,
      minutesOf,
      minsToLabel,
      withBreaks,
      isSaturdayClassWeek,
      thisWeeksSaturday,
      getSaturdayBannerInfo,
      getDividers,
    } = ScheduleEngine;

    const now = getDevNow();
    const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const nowDayName = dayNames[now.getDay()];
    const nowMinutes = now.getHours()*60 + now.getMinutes();

    function isClassDayToday(day) {
      return ScheduleEngine.isClassDay(day, now);
    }

    const tabsEl = document.getElementById("tabs");
    const panelsEl = document.getElementById("panels");
    panelsEl.innerHTML = "";
    const panelsTrack = document.createElement("div");
    panelsTrack.className = "panels-track";
    panelsEl.appendChild(panelsTrack);

    const indicator = document.createElement("div");
    indicator.className = "tab-indicator";
    indicator.style.transition = "none";
    tabsEl.appendChild(indicator);

    DAYS.forEach((day) => {
      const isToday = day === nowDayName;
      const isClassDay = isClassDayToday(day);
      const isExamsTab = day === "Exams";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tab" + (isToday && !isExamsTab ? " today" : "");
      btn.dataset.day = day;
      btn.setAttribute("aria-label", day);

      const tabLabel = isExamsTab ? "Exams" : day.slice(0, 3);
      btn.innerHTML = `${tabLabel}<span class="dot" aria-hidden="true"></span>`;

      let touchTriggered = false;
      btn.addEventListener("touchstart", (e) => {
        touchTriggered = true;
        e.preventDefault();
        selectDay(day);
      }, { passive: false });

      btn.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "touch") return;
        if (e.button !== 0) return;
        selectDay(day);
      });

      btn.addEventListener("click", () => {
        if (touchTriggered) {
          touchTriggered = false;
          return;
        }
        selectDay(day);
      });
      tabsEl.appendChild(btn);

      const panel = document.createElement("div");
      panel.className = "day-panel";
      panel.dataset.day = day;

      if (isExamsTab) {
        panel.innerHTML = `<div class="free-note">No upcoming exams scheduled.</div>`;
        panelsTrack.appendChild(panel);
        return;
      }

      if (day === "Saturday") {
        const banner = document.createElement("div");
        const bannerInfo = getSaturdayBannerInfo(now);
        banner.className = bannerInfo.className;
        banner.textContent = bannerInfo.message;
        panel.appendChild(banner);
      }

      const rawPeriods = SCHEDULE[day];
      if(!rawPeriods || rawPeriods.length === 0){
        panel.insertAdjacentHTML('beforeend', `<div class="free-note">No classes scheduled.</div>`);
        panelsTrack.appendChild(panel);
        return;
      }

      const periods = withBreaks(rawPeriods);
      let periodCount = 0;

      periods.forEach((p) => {
        const [start, end, key, note, subCount] = p;

        if(key === "BREAK"){
          const isBreakNow = isClassDay && nowMinutes >= minutesOf(start) && nowMinutes < minutesOf(end);
          const card = document.createElement("div");
          card.className = "card break" + (isBreakNow ? " now" : "");
          card.dataset.startMin = minutesOf(start);
          card.dataset.endMin = minutesOf(end);
          card.innerHTML = `
            <div class="card-main">
              <div class="card-time">
                <span class="p-time">${fmt(start)}<br>${fmt(end)}</span>
              </div>
              <div class="card-body">
                <div class="card-info">
                  ${isBreakNow ? `<span class="now-tag break-now-tag">Ongoing break</span><br>` : ""}
                  <p class="subj-name">Break</p>
                  <p class="subj-sub">${note} free</p>
                  ${isBreakNow ? `<div class="progress-wrap"><div class="progress-track"><div class="progress-fill"></div></div><span class="progress-remaining"></span></div>` : ""}
                </div>
              </div>
            </div>
          `;
          panel.appendChild(card);
          return;
        }

        periodCount++;
        const subjData = _SUBJECTS[key];
        const subj = { name: subjData.name };
        const accent = _ACCENT[subjData.accentKey];
        const subLine = subjData.subLine;
        const chipLabel = subjData.chipLabel;
        const extraNote = note || "";

        const isNow = isClassDay && nowMinutes >= minutesOf(start) && nowMinutes < minutesOf(end);
        const dividerCount = key === "LABCOMBO" ? (subCount || 1) : 1;
        const dividersHtml = getDividers(dividerCount).map(pos => {
          return `<div class="progress-divider" data-pos="${pos}" style="left:${pos}%"></div>`;
        }).join("");

        const card = document.createElement("div");
        card.className = "card" + (isNow ? " now" : "");
        card.style.setProperty("--card-accent", accent[0]);
        card.dataset.startMin = minutesOf(start);
        card.dataset.endMin = minutesOf(end);
        card.dataset.subjectKey = key;
        card.dataset.dividerCount = dividerCount;

        card.innerHTML = `
          <div class="card-main">
            <div class="card-time">
              <span class="p-time">${fmt(start)}<br>${fmt(end)}</span>
            </div>
            <div class="card-body">
              <div class="card-info">
                ${isNow ? `<span class="now-tag">Ongoing lecture</span><br>` : ""}
                <p class="subj-name">${subj.name}${extraNote ? ` <span style="font-weight:500;color:var(--ink-soft);font-size:13px;">(${extraNote})</span>` : ""}</p>
                <p class="subj-sub">${subLine}</p>
                ${isNow ? `<div class="progress-wrap"><div class="progress-track">${dividersHtml}<div class="progress-fill"></div></div><span class="progress-remaining"></span></div>` : ""}
              </div>
              <div class="fac-chip" style="background:${accent[1]}; color:${accent[0]};">${chipLabel}</div>
            </div>
          </div>
        `;
        panel.appendChild(card);
      });

      panelsTrack.appendChild(panel);
    });

    let currentDay = null;
    let animTimer = null;
    let breakTimetableVisible = false; // user-override: show timetable during a break
    const h1El = document.querySelector("h1");
    const originalH1 = h1El ? h1El.textContent : "Weekly Class Timetable";

    function updateContainerHeight(animate = false, durationMs = 240){
      const idx = DAYS.indexOf(currentDay);
      if(idx === -1) return;
      const activePanel = panelsTrack.children[idx];
      if(!activePanel) return;
      const h = activePanel.offsetHeight;
      if(h > 0){
        if(animate){
          panelsEl.style.transition = `height ${durationMs}ms cubic-bezier(0.25, 1, 0.5, 1)`;
        } else {
          panelsEl.style.transition = "none";
        }
        panelsEl.style.height = h + "px";
      }
    }

    function selectDay(day, animate = true){
      if(!day) return;
      const targetIdx = DAYS.indexOf(day);
      if(targetIdx === -1) return;

      currentDay = day;

      if(day === "Exams"){
        const { exams } = getFilteredEvents();
        const label = exams.length > 0 ? exams[0].title : "Exam Timetable";
        h1El.textContent = label;
      } else {
        h1El.textContent = originalH1;
      }
      const tasksEl = document.getElementById('upcomingTasks');
      if(tasksEl) tasksEl.style.display = day === 'Exams' ? 'none' : '';

      // Update tab active classes
      const allTabs = tabsEl.querySelectorAll(".tab");
      allTabs.forEach((t, i) => t.classList.toggle("active", i === targetIdx));

      // Update panel active classes
      Array.from(panelsTrack.children).forEach((p, i) => {
        p.classList.toggle("active", i === targetIdx);
      });

      const durationMs = animate ? 240 : 0;
      const easing = "cubic-bezier(0.25, 1, 0.5, 1)";

      if(animTimer){
        clearTimeout(animTimer);
        animTimer = null;
      }

      if(animate){
        panelsTrack.classList.add("swiping");
        panelsTrack.style.transition = `transform ${durationMs}ms ${easing}`;
        indicator.style.transition = `transform ${durationMs}ms var(--ease-out), width ${durationMs}ms var(--ease-out)`;
        updateContainerHeight(true, durationMs);
      } else {
        panelsTrack.style.transition = "none";
        indicator.style.transition = "none";
        updateContainerHeight(false);
      }

      panelsTrack.style.transform = `translateX(-${targetIdx * 100}%)`;
      moveIndicator();

      if(animate){
        animTimer = setTimeout(() => {
          panelsTrack.style.transition = "none";
          panelsEl.style.transition = "none";
          indicator.style.transition = "";
          updateContainerHeight(false);
          panelsTrack.classList.remove("swiping");
          animTimer = null;
        }, durationMs + 20);
      }
    }

    function moveIndicator(){
      const activeTab = tabsEl.querySelector(".tab.active");
      if(!activeTab) return;
      indicator.style.transform = "translateX(" + activeTab.offsetLeft + "px)";
      indicator.style.width = activeTab.offsetWidth + "px";
    }

    window.addEventListener("resize", () => {
      moveIndicator();
      updateContainerHeight(false);
    });

    /* ---------- Swipe / live interactive touch drag to change day ---------- */
    function goToDay(offset){
      const idx = DAYS.indexOf(currentDay);
      const nextIdx = Math.max(0, Math.min(DAYS.length - 1, idx + offset));
      if(nextIdx !== idx){
        selectDay(DAYS[nextIdx], true);
      }
    }

    const swipeNav = SwipeNavigator.createSwipeNavigator({
      containerEl: panelsEl,
      trackEl: panelsTrack,
      indicatorEl: indicator,
      tabsEl: tabsEl,
      getItemsCount: () => DAYS.length,
      getCurrentIndex: () => DAYS.indexOf(currentDay),
      onSelect: (targetIdx, animate) => {
        selectDay(DAYS[targetIdx], animate);
      },
    });
    swipeNav.mount();

    /* ---------- Legend ---------- */
    const legendEl = document.getElementById("legend");
    data.LEGEND.forEach(([key,name,sub]) => {
      const accent = _ACCENT[key];
      const item = document.createElement("div");
      item.className = "legend-item";
      item.innerHTML = `<span class="legend-swatch" style="background:${accent[0]}"></span>
        <div class="legend-text"><b>${name}</b><span>${sub}</span></div>`;
      legendEl.appendChild(item);
    });

    selectDay(DAYS.includes(nowDayName) ? nowDayName : "Monday", false);
    requestAnimationFrame(() => {
      indicator.style.transition = "";
      moveIndicator();
      updateContainerHeight(false);
    });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        moveIndicator();
        updateContainerHeight(false);
      });
    }

    setTimeout(() => {
      const nowCard = document.querySelector(".day-panel.active .card.now");
      if(nowCard){
        const rect = nowCard.getBoundingClientRect();
        const inView = rect.top >= 0 && rect.bottom <= window.innerHeight;
        if(!inView){
          nowCard.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }, 500);

    /* ---------- LIVE PROGRESS TRACKERS ---------- */
    function updateProgressBars(){
      const t = getDevNow();
      const curMinutes = t.getHours() * 60 + t.getMinutes() + t.getSeconds() / 60;

      const classCards = document.querySelectorAll(".card.now[data-start-min]");
      classCards.forEach(card => {
        const startMin = Number(card.dataset.startMin);
        const endMin = Number(card.dataset.endMin);
        const state = ScheduleEngine.getPeriodState(startMin, endMin, t.getHours() * 60 + t.getMinutes(), t.getSeconds());
        const pct = state.progressPercent;

        const fill = card.querySelector(".progress-fill");
        const remainingEl = card.querySelector(".progress-remaining");
        if(fill) fill.style.width = pct + "%";

        card.querySelectorAll(".progress-divider").forEach(d => {
          const dividerPos = parseFloat(d.dataset.pos);
          d.classList.toggle("passed", pct >= dividerPos);
        });

        if(remainingEl){
          const minsLeft = state.remainingMinutes;
          remainingEl.textContent = minsLeft <= 0 ? "Wrapping up" : `${minsToLabel(minsLeft)} left`;
        }
      });

      const eventCards = document.querySelectorAll(".card.now[data-event-date]");
      eventCards.forEach(card => {
        const evDate = new Date(card.dataset.eventDate);
        const subjectKey = card.dataset.eventSubjectKey || '';

        if (card.dataset.eventType === 'exam') {
          evDate.setHours(9, 0, 0, 0);
        } else if (subjectKey && _SCHEDULE) {
          // Find the start time of this subject's class on the event's weekday
          const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
          const evDayName = dayNames[evDate.getDay()];
          const dayPeriods = _SCHEDULE[evDayName] || [];
          let lectureStartMins = null;
          for (const p of dayPeriods) {
            if (p[2] === subjectKey) {
              const [h, m] = p[0].split(':').map(Number);
              lectureStartMins = h * 60 + m;
              break;
            }
          }
          if (lectureStartMins !== null) {
            evDate.setHours(Math.floor(lectureStartMins / 60), lectureStartMins % 60, 0, 0);
          } else {
            evDate.setHours(23, 59, 59, 0); // subject not scheduled that day: fall back
          }
        } else {
          evDate.setHours(23, 59, 59, 0);
        }

        const diffMs = evDate - t;
        const fill = card.querySelector(".progress-fill");
        const remainingEl = card.querySelector(".progress-remaining");

        if(diffMs <= 0) {
          if(remainingEl) remainingEl.textContent = "It's Time!";
          if(fill) fill.style.width = "100%";
        } else {
          const d = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          const h = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
          const m = Math.floor((diffMs / 1000 / 60) % 60);
          const s = Math.floor((diffMs / 1000) % 60);

          if(remainingEl) {
            if(d > 0) remainingEl.textContent = `${d}d ${h}h left`;
            else if (h > 0) remainingEl.textContent = `${h}h ${m}m left`;
            else remainingEl.textContent = `${m}m ${s}s left!`;
          }

          const totalMs = 14 * 24 * 60 * 60 * 1000;
          const pct = Math.max(0, 100 - ((diffMs / totalMs) * 100));
          if(fill) fill.style.width = Math.min(100, pct) + "%";
        }
      });
      const curIntMinute = t.getHours() * 60 + t.getMinutes();
      if (curIntMinute !== _lastBadgeMinute) {
        injectCalendarBadges();
      }

      /* ---------- Break timer overlay (detects gaps between classes) ---------- */
      const overlay = document.getElementById('breakOverlay');
      const breakTimeEl = document.getElementById('breakOverlayTime');
      const breakCircleFill = document.querySelector('#breakOverlay .break-circle-fill');
      const breakNextEl = document.getElementById('breakOverlayNext');
      const panels = document.getElementById('panels');
      const inExamMode = document.body.classList.contains('exam-mode');
      let breakActive = false;

      if (!inExamMode && _SCHEDULE) {
        const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const nowDayName = dayNames[t.getDay()];
        const rawPeriods = _SCHEDULE[nowDayName];
        if (rawPeriods && rawPeriods.length > 0) {
          const isSaturday = nowDayName === 'Saturday';
          const hasClass = isSaturday ? isSaturdayClassWeek(t) : true;
          if (hasClass) {
            for (let i = 0; i < rawPeriods.length - 1; i++) {
              const currentEnd = minutesOf(rawPeriods[i][1]);
              const nextStart = minutesOf(rawPeriods[i + 1][0]);
              const gap = nextStart - currentEnd;
              if (gap > 0 && curMinutes >= currentEnd && curMinutes < nextStart) {
                breakActive = true;
                const gapMins = nextStart - currentEnd;
                const elapsedMins = curMinutes - currentEnd;
                const pct = Math.min(100, Math.max(0, (elapsedMins / gapMins) * 100));
                if(breakCircleFill){
                  const circumference = 100;
                  breakCircleFill.style.strokeDashoffset = circumference - (pct / 100) * circumference;
                }
                const totalSecs = Math.max(0, Math.round((nextStart - curMinutes) * 60));
                const m = Math.floor(totalSecs / 60);
                const s = totalSecs % 60;
                breakTimeEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                const nextKey = rawPeriods[i + 1][2];
                const nextSubj = _SUBJECTS && _SUBJECTS[nextKey] ? _SUBJECTS[nextKey].name : nextKey;
                breakNextEl.textContent = nextSubj;
                break;
              }
            }
          }
        }
      }

      // Show/hide overlay
      if (overlay) overlay.style.display = (breakActive && !inExamMode) ? '' : 'none';

      // Only hide/show the active (today's) panel; leave other day panels untouched
      if (!inExamMode) {
        const todayPanel = panelsEl.querySelector('.day-panel.active');
        if (todayPanel) {
          if (breakActive && !breakTimetableVisible) {
            todayPanel.style.opacity = '0';
            todayPanel.style.pointerEvents = 'none';
          } else {
            todayPanel.style.opacity = '';
            todayPanel.style.pointerEvents = '';
          }
        }
        // When break ends, reset the user override
        if (!breakActive) breakTimetableVisible = false;
      }

      // Keep button label in sync
      const viewBtn = document.getElementById('breakViewTimetableBtn');
      if (viewBtn) {
        viewBtn.textContent = breakTimetableVisible ? 'Hide Timetable' : 'View Timetable';
      }
    }

    updateProgressBars();

    /* ---------- "View Timetable" button wired up after updateProgressBars is defined ---------- */
    const breakViewBtn = document.getElementById('breakViewTimetableBtn');
    if (breakViewBtn) {
      breakViewBtn.addEventListener('click', () => {
        breakTimetableVisible = !breakTimetableVisible;
        updateProgressBars();
      });
    }

    setInterval(updateProgressBars, 1000);
    setInterval(checkForDateChange, 30000);
    injectCalendarBadges();


    /* ---------- Load events after timetable is ready ---------- */
    await loadEvents();

    injectCalendarBadges();

    if (IS_DEV) setupDevDatePicker();
  } catch (error) {
    console.error("Failed to load timetable data:", error);
    document.getElementById("panels").innerHTML = `<div class="free-note">Error loading schedule. Please check your connection.<br><span style="font-size:12px;color:var(--ds);">${error.message || error}</span></div>`;
  }
}

/* ---------- Dev controls (DEV-ONLY) ---------- */
function setupDevDatePicker() {
  const panel = document.getElementById('devPanel');
  if (!panel) return;
  panel.style.display = '';

  /* Viewport UI mode toggle */
  const viewportBtns = panel.querySelectorAll('#devViewportGroup .dev-toggle-btn');
  let currentViewport = ClientStore.getDevViewport() || 'auto';

  function setViewport(mode) {
    document.body.classList.remove('dev-mobile-ui', 'dev-desktop-ui');
    if (mode === 'mobile') {
      document.body.classList.add('dev-mobile-ui');
    } else if (mode === 'desktop') {
      document.body.classList.add('dev-desktop-ui');
    }
    viewportBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.viewport === mode);
    });
    window.dispatchEvent(new Event('resize'));
  }

  setViewport(currentViewport);

  viewportBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.viewport;
      ClientStore.setDevViewport(mode === 'auto' ? '' : mode);
      setViewport(mode);
    });
  });

  /* Background Pattern toggle (Dev-only switcher) */
  const patternBtns = panel.querySelectorAll('#devPatternGroup .dev-toggle-btn');
  function setPattern(pattern) {
    const patternClasses = ALL_PATTERNS.map(p => 'pattern-' + p);
    document.body.classList.remove(...patternClasses);
    document.documentElement.classList.remove(...patternClasses);
    document.body.classList.add('pattern-' + pattern);
    document.documentElement.classList.add('pattern-' + pattern);
    patternBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.pattern === pattern);
    });
  }

  setPattern(currentPattern);

  patternBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const pattern = btn.dataset.pattern;
      ClientStore.setDevPattern(pattern);
      currentPattern = pattern;
      setPattern(pattern);
    });
  });

  /* Date & time override */
  const dateInput = document.getElementById('devDateInput');
  const timeInput = document.getElementById('devTimeInput');
  const dateBtn = document.getElementById('devDateBtn');
  const timeBtn = document.getElementById('devTimeBtn');
  const resetBtn = document.getElementById('devDateReset');
  const label = document.getElementById('devDateLabel');

  const calPopup = document.getElementById('devCalendarPopup');
  const calTitle = document.getElementById('devCalTitle');
  const calGrid = document.getElementById('devCalGrid');
  const calPrev = document.getElementById('devCalPrev');
  const calNext = document.getElementById('devCalNext');
  const calTodayBtn = document.getElementById('devCalTodayBtn');
  const calCloseBtn = document.getElementById('devCalCloseBtn');

  const timePopup = document.getElementById('devTimePopup');
  const timeHourSelect = document.getElementById('devTimeHourSelect');
  const timeMinSelect = document.getElementById('devTimeMinSelect');
  const timeApplyBtn = document.getElementById('devTimeApplyBtn');
  const timeNowBtn = document.getElementById('devTimeNowBtn');
  const timeCloseBtn = document.getElementById('devTimeCloseBtn');
  const timePresetBtns = document.querySelectorAll('.dev-time-preset-btn');

  function formatLocalDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function formatLocalTime(d) {
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${min}`;
  }

  const stored = sessionStorage.getItem('timetableTestDate');
  if (stored) {
    const d = new Date(stored);
    dateInput.value = formatLocalDate(d);
    timeInput.value = formatLocalTime(d);
    const diff = Date.now() - Number(sessionStorage.getItem('timetableTestAt'));
    const totalSec = Math.floor(diff / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    label.textContent = 'Virtual time: ' + d.toLocaleString() + ' (running ' + (h ? h + 'h ' : '') + (m ? m + 'm ' : '') + s + 's ago)';
  } else {
    const now = new Date();
    dateInput.value = formatLocalDate(now);
    timeInput.value = formatLocalTime(now);
    label.textContent = 'Live mode. Set date/time below to test future schedule.';
  }

  /* --- Calendar Popover Logic --- */
  let calViewYear = new Date().getFullYear();
  let calViewMonth = new Date().getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  function renderCalendar(year, month) {
    if (!calTitle || !calGrid) return;
    calTitle.textContent = `${monthNames[month]} ${year}`;
    calGrid.innerHTML = '';

    const firstDay = new Date(year, month, 1);
    let startDay = firstDay.getDay() - 1;
    if (startDay === -1) startDay = 6;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = formatLocalDate(new Date());
    const selectedStr = dateInput.value;

    for (let i = 0; i < startDay; i++) {
      const empty = document.createElement('div');
      empty.className = 'dev-cal-day empty';
      calGrid.appendChild(empty);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dayBtn = document.createElement('button');
      dayBtn.type = 'button';
      dayBtn.className = 'dev-cal-day';
      dayBtn.textContent = String(d);

      const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (dStr === todayStr) dayBtn.classList.add('today');
      if (dStr === selectedStr) dayBtn.classList.add('selected');

      dayBtn.addEventListener('click', () => {
        dateInput.value = dStr;
        if (calPopup) calPopup.style.display = 'none';
        setDevDateTime();
      });

      calGrid.appendChild(dayBtn);
    }
  }

  function toggleCalendar(e) {
    if (e) e.stopPropagation();
    if (!calPopup) return;
    if (timePopup) timePopup.style.display = 'none';

    if (calPopup.style.display === 'none') {
      const curParts = (dateInput.value || '').split('-').map(Number);
      if (curParts.length === 3 && !isNaN(curParts[0])) {
        calViewYear = curParts[0];
        calViewMonth = curParts[1] - 1;
      } else {
        const now = new Date();
        calViewYear = now.getFullYear();
        calViewMonth = now.getMonth();
      }
      renderCalendar(calViewYear, calViewMonth);
      calPopup.style.display = 'block';
    } else {
      calPopup.style.display = 'none';
    }
  }

  if (dateInput) dateInput.addEventListener('click', toggleCalendar);
  if (dateBtn) dateBtn.addEventListener('click', toggleCalendar);

  if (calPrev) {
    calPrev.addEventListener('click', (e) => {
      e.stopPropagation();
      calViewMonth--;
      if (calViewMonth < 0) {
        calViewMonth = 11;
        calViewYear--;
      }
      renderCalendar(calViewYear, calViewMonth);
    });
  }

  if (calNext) {
    calNext.addEventListener('click', (e) => {
      e.stopPropagation();
      calViewMonth++;
      if (calViewMonth > 11) {
        calViewMonth = 0;
        calViewYear++;
      }
      renderCalendar(calViewYear, calViewMonth);
    });
  }

  if (calTodayBtn) {
    calTodayBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dateInput.value = formatLocalDate(new Date());
      if (calPopup) calPopup.style.display = 'none';
      setDevDateTime();
    });
  }

  if (calCloseBtn) {
    calCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (calPopup) calPopup.style.display = 'none';
    });
  }

  /* --- Time Picker Popover Logic --- */
  if (timeHourSelect && timeMinSelect) {
    timeHourSelect.innerHTML = '';
    for (let h = 0; h < 24; h++) {
      const opt = document.createElement('option');
      const val = String(h).padStart(2, '0');
      opt.value = val;
      opt.textContent = val;
      timeHourSelect.appendChild(opt);
    }

    timeMinSelect.innerHTML = '';
    for (let m = 0; m < 60; m += 5) {
      const opt = document.createElement('option');
      const val = String(m).padStart(2, '0');
      opt.value = val;
      opt.textContent = val;
      timeMinSelect.appendChild(opt);
    }
  }

  function syncTimeSelects() {
    const parts = (timeInput.value || '09:00').split(':');
    if (timeHourSelect && parts[0]) timeHourSelect.value = parts[0];
    if (timeMinSelect && parts[1]) {
      const minNum = Math.round(Number(parts[1]) / 5) * 5;
      const roundedVal = String(minNum >= 60 ? 55 : minNum).padStart(2, '0');
      timeMinSelect.value = roundedVal;
    }
  }

  function toggleTimePicker(e) {
    if (e) e.stopPropagation();
    if (!timePopup) return;
    if (calPopup) calPopup.style.display = 'none';

    if (timePopup.style.display === 'none') {
      syncTimeSelects();
      timePopup.style.display = 'block';
    } else {
      timePopup.style.display = 'none';
    }
  }

  if (timeInput) timeInput.addEventListener('click', toggleTimePicker);
  if (timeBtn) timeBtn.addEventListener('click', toggleTimePicker);

  timePresetBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const presetTime = btn.dataset.time;
      if (presetTime) {
        timeInput.value = presetTime;
        if (timePopup) timePopup.style.display = 'none';
        setDevDateTime();
      }
    });
  });

  if (timeApplyBtn) {
    timeApplyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (timeHourSelect && timeMinSelect) {
        timeInput.value = `${timeHourSelect.value}:${timeMinSelect.value}`;
        if (timePopup) timePopup.style.display = 'none';
        setDevDateTime();
      }
    });
  }

  if (timeNowBtn) {
    timeNowBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      timeInput.value = formatLocalTime(new Date());
      if (timePopup) timePopup.style.display = 'none';
      setDevDateTime();
    });
  }

  if (timeCloseBtn) {
    timeCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (timePopup) timePopup.style.display = 'none';
    });
  }

  /* Dismiss popovers on outside click or Escape key */
  document.addEventListener('click', (e) => {
    const dateWrap = document.getElementById('devDatePickerWrapper');
    const timeWrap = document.getElementById('devTimePickerWrapper');
    if (calPopup && dateWrap && !dateWrap.contains(e.target)) {
      calPopup.style.display = 'none';
    }
    if (timePopup && timeWrap && !timeWrap.contains(e.target)) {
      timePopup.style.display = 'none';
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (calPopup) calPopup.style.display = 'none';
      if (timePopup) timePopup.style.display = 'none';
    }
  });

  /* Reset button */
  resetBtn.addEventListener('click', () => {
    ClientStore.clearDevTestDate();
    location.reload();
  });

  function setDevDateTime() {
    if (!dateInput.value || !timeInput.value) return;
    const iso = dateInput.value + 'T' + timeInput.value + ':00';
    ClientStore.setDevTestDate(iso);
    location.reload();
  }
}


/* ---------- Exam Mode ---------- */
function checkExamMode() {
  const manualForce = _settings && _settings.forceExamMode === true;
  let autoActive = false;
  let examInfo = null;

  const activeExams = (_events || []).filter(e => e.type === 'exam' && !isEventExpired(e));

  if (!manualForce) {
    const now = getDevNow();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    for (const ev of activeExams) {
      const parts = ev.date.split('-').map(Number);
      const evDate = new Date(parts[0], parts[1] - 1, parts[2]);
      evDate.setHours(0, 0, 0, 0);
      if (evDate >= today && evDate <= tomorrow) {
        autoActive = true;
        examInfo = ev;
        break;
      }
    }
  }

  const active = manualForce || autoActive;
  document.body.classList.toggle('exam-mode', active);

  const banner = document.getElementById('examModeBanner');
  const content = document.getElementById('examModeContent');
  if (!banner || !content) return;

  if (active) {
    const reason = manualForce
      ? 'Exam mode manually enabled by admin.'
      : (examInfo
        ? `${examInfo.title}${examInfo.subject ? ' (' + examInfo.subject + ')' : ''} is scheduled ${new Date(examInfo.date).toDateString() === getDevNow().toDateString() ? 'today' : 'tomorrow'}. Showing exam timetable.`
        : 'Exam mode active.');
    banner.textContent = `Exam mode · ${reason}`;

    const examEvents = activeExams.sort((a,b) => new Date(a.date) - new Date(b.date));
    content.innerHTML = '';
    if (examEvents.length === 0) {
      content.innerHTML = `<div class="free-note">No upcoming exams scheduled.</div>`;
    } else {
      examEvents.forEach(ev => content.appendChild(createEventCard(ev)));
    }
  }
}

/* ---------- Midnight crossover ---------- */
function checkForDateChange() {
  const today = getDevNow().toDateString();
  if (today !== _lastCheckedDate) {
    _lastCheckedDate = today;
    _lastBadgeMinute = -1;
    renderEvents();
    checkExamMode();
  }
}

/* ---------- Auto-refresh events ---------- */
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) { updateProgressBars(); checkForDateChange(); }
});

window.checkForDateChange = checkForDateChange;

/* --- Tap title 7 times with 1.5s delay to open admin --- */
let titleClicks = 0;
let clickTimer = null;
document.getElementById('mainTitle').addEventListener('click', () => {
  titleClicks++;
  clearTimeout(clickTimer);
  clickTimer = setTimeout(() => { titleClicks = 0; }, 1500);
  if (titleClicks >= 7) {
    titleClicks = 0;
    window.location.href = 'admin.html';
  }
});

initTimetableApp();

