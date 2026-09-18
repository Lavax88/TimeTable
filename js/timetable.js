/* ---------- Theme ---------- */
const root = document.documentElement;
const themeToggle = document.getElementById("themeToggle");
const savedTheme = localStorage.getItem("timetableTheme");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
let currentTheme = savedTheme ? savedTheme : (prefersDark ? "dark" : "light");
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
  localStorage.setItem("timetableTheme", theme);
  const meta = document.getElementById("themeColorMeta");
  if (meta) {
    meta.setAttribute("content", theme === "dark" ? "#121214" : "#FAF8F5");
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

let currentPattern = 'dots';
try {
  if (IS_DEV) {
    currentPattern = sessionStorage.getItem('timetableDevPattern') || 'dots';
  } else {
    let randomPattern = sessionStorage.getItem('timetableMainPattern');
    if (!randomPattern || !RANDOM_PATTERNS.includes(randomPattern)) {
      randomPattern = RANDOM_PATTERNS[Math.floor(Math.random() * RANDOM_PATTERNS.length)];
      sessionStorage.setItem('timetableMainPattern', randomPattern);
    }
    currentPattern = randomPattern;
  }
} catch (_) {}

document.documentElement.classList.remove(...ALL_PATTERNS.map(p => 'pattern-' + p));
document.documentElement.classList.add('pattern-' + currentPattern);
if (document.body) {
  document.body.classList.remove(...ALL_PATTERNS.map(p => 'pattern-' + p));
  document.body.classList.add('pattern-' + currentPattern);
}

if (IS_DEV) {
  try {
    const storedViewport = sessionStorage.getItem('timetableDevViewport');
    if (storedViewport === 'mobile') {
      document.body.classList.add('dev-mobile-ui');
    } else if (storedViewport === 'desktop') {
      document.body.classList.add('dev-desktop-ui');
    }
  } catch (_) {}
}

function getDevNow() {
  if (!IS_DEV) return new Date();
  const stored = sessionStorage.getItem('timetableTestDate');
  const storedAt = sessionStorage.getItem('timetableTestAt');
  if (!stored || !storedAt) return new Date();
  return new Date(new Date(stored).getTime() + (Date.now() - Number(storedAt)));
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
  try { return JSON.parse(localStorage.getItem('timetableCompleted') || '[]').indexOf(eventKey(ev)) >= 0; }
  catch(e) { return false; }
}
function toggleEventComplete(ev) {
  var key = eventKey(ev);
  var arr = JSON.parse(localStorage.getItem('timetableCompleted') || '[]');
  var idx = arr.indexOf(key);
  var completing = idx < 0; // true = marking as done, false = undoing

  if (completing) {
    arr.push(key);
    // Fire-and-forget: delete this event from the server (no password needed)
    fetch('/api/complete_event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: ev.title, date: ev.date })
    }).catch(() => {}); // silently ignore network errors
  } else {
    arr.splice(idx, 1);
  }

  localStorage.setItem('timetableCompleted', JSON.stringify(arr));
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
  const accent = subAccent || (_ACCENT && _ACCENT.MAT) || ['#6366f1', '#eef2ff'];
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
  const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const nowDayName = dayNames[nowDay];

  const monday = new Date(now);
  monday.setDate(now.getDate() - ((nowDay + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);

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
      const response = await fetch('/api/data?t=' + Date.now());
      data = await response.json();
      try {
        sessionStorage.setItem('timetableData', JSON.stringify(data));
        sessionStorage.setItem('timetableDataAt', String(Date.now()));
      } catch (e) {}
    } catch (e) {
      const cached = sessionStorage.getItem('timetableData');
      if (cached) data = JSON.parse(cached);
    }

    _ACCENT = data.ACCENT;
    _SUBJECTS = data.SUBJECTS;
    _SCHEDULE = data.SCHEDULE;
    const SCHEDULE = data.SCHEDULE;

    const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday", "Exams"];

    function fmt(hhmm){
      const [h,m] = hhmm.split(":").map(Number);
      const period = h>=12 ? "PM":"AM";
      let h12 = h%12; if(h12===0) h12=12;
      return `${h12}:${m.toString().padStart(2,"0")} ${period}`;
    }
    function minutesOf(hhmm){ const [h,m]=hhmm.split(":").map(Number); return h*60+m; }
    function minsToLabel(mins){
      if(mins < 60) return `${mins} min`;
      const h = Math.floor(mins/60), m = mins%60;
      return m ? `${h}h ${m}m` : `${h}h`;
    }

    function withBreaks(periods){
      const out = [];
      for(let i=0; i<periods.length; i++){
        out.push(periods[i]);
        if(i < periods.length - 1){
          const gap = minutesOf(periods[i+1][0]) - minutesOf(periods[i][1]);
          if(gap > 5){
            out.push([periods[i][1], periods[i+1][0], "BREAK", minsToLabel(gap)]);
          }
        }
      }
      return out;
    }

    const now = getDevNow();
    const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const nowDayName = dayNames[now.getDay()];
    const nowMinutes = now.getHours()*60 + now.getMinutes();

    function isSaturdayClassWeek(date){
      const occurrence = Math.ceil(date.getDate() / 7);
      return occurrence === 1 || occurrence === 3;
    }
    function isClassDayToday(day){
      if(day !== nowDayName) return false;
      if(day === "Saturday") return isSaturdayClassWeek(now);
      return true;
    }
    function thisWeeksSaturday(date){
      const daysSinceMonday = (date.getDay() + 6) % 7;
      const offsetToSaturday = 5 - daysSinceMonday;
      const sat = new Date(date);
      sat.setDate(date.getDate() + offsetToSaturday);
      return sat;
    }

    const thisWeekHasNoSaturdayClass = !isSaturdayClassWeek(thisWeeksSaturday(now));

    const tabsEl = document.getElementById("tabs");
    const panelsEl = document.getElementById("panels");

    const indicator = document.createElement("div");
    indicator.className = "tab-indicator";
    indicator.style.transition = "none";
    tabsEl.appendChild(indicator);

    DAYS.forEach((day) => {
      const isToday = day === nowDayName;
      const isClassDay = isClassDayToday(day);
      const isExamsTab = day === "Exams";

      const btn = document.createElement("button");
      btn.className = "tab" + (isToday && !isExamsTab ? " today" : "");
      btn.dataset.day = day;

      const tabLabel = isExamsTab ? "Exams" : day.slice(0,3);
      btn.innerHTML = `${tabLabel}<span class="dot"></span>`;
      btn.onclick = () => selectDay(day);
      tabsEl.appendChild(btn);

      const panel = document.createElement("div");
      panel.className = "day-panel";
      panel.dataset.day = day;

      if (isExamsTab) {
        panel.innerHTML = `<div class="free-note">No upcoming exams scheduled.</div>`;
        panelsEl.appendChild(panel);
        return;
      }

      if(day === "Saturday"){
        const banner = document.createElement("div");
        if(thisWeekHasNoSaturdayClass){
          banner.className = "caution-banner";
          banner.textContent = "No classes this Saturday. Classes only run on the 1st & 3rd Saturdays of the month.";
        } else {
          banner.className = "caution-banner success";
          banner.textContent = "Saturday class is scheduled this week.";
        }
        panel.appendChild(banner);
      }

      const rawPeriods = SCHEDULE[day];
      if(!rawPeriods || rawPeriods.length === 0){
        panel.insertAdjacentHTML('beforeend', `<div class="free-note">No classes scheduled.</div>`);
        panelsEl.appendChild(panel);
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
        const dividersHtml = Array.from({ length: dividerCount - 1 }, (_, i) => {
          const pos = ((i + 1) / dividerCount) * 100;
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

      panelsEl.appendChild(panel);
    });

    let currentDay = null;
    let isAnimating = false;
    let breakTimetableVisible = false; // user-override: show timetable during a break
    const h1El = document.querySelector("h1");
    const originalH1 = h1El ? h1El.textContent : "Weekly Class Timetable";

    function selectDay(day){
      if(isAnimating) return;
      if (day === "Exams") {
        const { exams } = getFilteredEvents();
        const label = exams.length > 0 ? exams[0].title : "Exam Timetable";
        h1El.textContent = label;
      } else {
        h1El.textContent = originalH1;
      }
      const tasksEl = document.getElementById('upcomingTasks');
      if (tasksEl) tasksEl.style.display = day === 'Exams' ? 'none' : '';
      document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.day === day));
      moveIndicator();
      if(day === currentDay) return;

      const newPanel = panelsEl.querySelector(`.day-panel[data-day="${day}"]`);
      if(!newPanel) return;
      if(!currentDay){
        currentDay = day;
        newPanel.classList.add("active");
        return;
      }

      const oldDay = currentDay;
      const oldPanel = panelsEl.querySelector(`.day-panel[data-day="${oldDay}"]`);
      currentDay = day;

      const n = DAYS.length;
      const oldIndex = DAYS.indexOf(oldDay);
      const newIndex = DAYS.indexOf(day);
      const forwardDist = (newIndex - oldIndex + n) % n;
      const backwardDist = (oldIndex - newIndex + n) % n;
      const forward = forwardDist <= backwardDist;

      isAnimating = true;
      const startHeight = panelsEl.offsetHeight;
      panelsEl.style.height = startHeight + "px";
      panelsEl.classList.add("sliding");

      oldPanel.classList.add("sliding-panel");
      newPanel.classList.add("active", "sliding-panel");
      newPanel.style.transition = "none";
      newPanel.style.transform = forward ? "translateX(100%)" : "translateX(-100%)";

      void newPanel.offsetWidth;
      const endHeight = newPanel.scrollHeight;

      requestAnimationFrame(() => {
        newPanel.style.transition = "";
        newPanel.style.transform = "translateX(0)";
        oldPanel.style.transform = forward ? "translateX(-100%)" : "translateX(100%)";
        panelsEl.style.height = endHeight + "px";
      });

      setTimeout(() => {
        oldPanel.classList.remove("active", "sliding-panel");
        oldPanel.style.transform = "";
        newPanel.classList.remove("sliding-panel");
        newPanel.style.transform = "";
        panelsEl.classList.remove("sliding");
        panelsEl.style.height = "";
        isAnimating = false;
      }, 440);
    }

    function moveIndicator(){
      const activeTab = tabsEl.querySelector(".tab.active");
      if(!activeTab) return;
      indicator.style.left = activeTab.offsetLeft + "px";
      indicator.style.width = activeTab.offsetWidth + "px";
    }

    window.addEventListener("resize", moveIndicator);

    /* ---------- Swipe / horizontal scroll to change day ---------- */
    function goToDay(offset){
      if(isAnimating) return;
      const idx = DAYS.indexOf(currentDay);
      const nextIdx = (idx + offset + DAYS.length) % DAYS.length;
      selectDay(DAYS[nextIdx]);
    }

    let touchStartX = 0, touchStartY = 0, touchTracking = false;
    panelsEl.addEventListener("touchstart", (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchTracking = true;
    }, { passive: true });

    panelsEl.addEventListener("touchend", (e) => {
      if(!touchTracking) return;
      touchTracking = false;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      const SWIPE_THRESHOLD = 55;
      if(Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.2){
        goToDay(dx < 0 ? 1 : -1);
      }
    }, { passive: true });

    let wheelCooldown = false;
    panelsEl.addEventListener("wheel", (e) => {
      if(Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 24){
        if(wheelCooldown) return;
        wheelCooldown = true;
        goToDay(e.deltaX > 0 ? 1 : -1);
        setTimeout(() => { wheelCooldown = false; }, 550);
      }
    }, { passive: true });

    /* ---------- Legend ---------- */
    const legendEl = document.getElementById("legend");
    data.LEGEND.forEach(([key,name,sub]) => {
      const accent = _ACCENT[key];
      const item = document.createElement("div");
      item.className = "legend-item";
      item.innerHTML = `<span class="legend-swatch" style="background:${accent[0]}"></span>
        <div><b>${name}</b><span>${sub}</span></div>`;
      legendEl.appendChild(item);
    });

    selectDay(DAYS.includes(nowDayName) ? nowDayName : "Monday");
    requestAnimationFrame(() => { indicator.style.transition = ""; });

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
        const total = endMin - startMin;
        const elapsed = curMinutes - startMin;
        const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));

        const fill = card.querySelector(".progress-fill");
        const remainingEl = card.querySelector(".progress-remaining");
        if(fill) fill.style.width = pct + "%";

        card.querySelectorAll(".progress-divider").forEach(d => {
          const dividerPos = parseFloat(d.dataset.pos);
          d.classList.toggle("passed", pct >= dividerPos);
        });

        if(remainingEl){
          const minsLeft = Math.max(0, Math.ceil(endMin - curMinutes));
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
      injectCalendarBadges();

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
          const hasClass = isSaturday ? (Math.ceil(t.getDate() / 7) === 1 || Math.ceil(t.getDate() / 7) === 3) : true;
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
            todayPanel.style.display = 'none';
          } else {
            todayPanel.style.display = '';
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
  let currentViewport = 'auto';
  try {
    currentViewport = sessionStorage.getItem('timetableDevViewport') || 'auto';
  } catch (_) {}

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
      try {
        if (mode === 'auto') {
          sessionStorage.removeItem('timetableDevViewport');
        } else {
          sessionStorage.setItem('timetableDevViewport', mode);
        }
      } catch (_) {}
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
      try {
        sessionStorage.setItem('timetableDevPattern', pattern);
      } catch (_) {}
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
    sessionStorage.removeItem('timetableTestDate');
    sessionStorage.removeItem('timetableTestAt');
    location.reload();
  });

  function setDevDateTime() {
    if (!dateInput.value || !timeInput.value) return;
    const iso = dateInput.value + 'T' + timeInput.value + ':00';
    sessionStorage.setItem('timetableTestDate', iso);
    sessionStorage.setItem('timetableTestAt', String(Date.now()));
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

