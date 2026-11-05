const lockScreen = document.getElementById('lockScreen');
const eventBuilder = document.getElementById('eventBuilder');
const pwdInput = document.getElementById('password');
const seriesRows = document.getElementById('seriesRows');
const addSeriesRowBtn = document.getElementById('addSeriesRow');
const eventRowsContainer = document.getElementById('eventRows');
const addEventRowBtn = document.getElementById('addEventRow');

document.getElementById('unlockBtn').addEventListener('click', async () => {
  const pwd = pwdInput.value.trim();
  if (!pwd) { alert("Please enter a password."); return; }

  const unlockBtn = document.getElementById('unlockBtn');
  unlockBtn.textContent = "Verifying...";
  unlockBtn.disabled = true;

  try {
    const res = await fetch('/api/admin/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd, action: 'verify' })
    });
    const result = await res.json();

    if (res.ok) {
      lockScreen.style.display = 'none';
      eventBuilder.style.display = 'flex';
      document.getElementById('holidaysSection').style.display = 'block';
      document.getElementById('examToggleSection').style.display = 'block';
    } else {
      alert(result.error || "Incorrect password.");
      unlockBtn.textContent = "Unlock Dashboard";
      unlockBtn.disabled = false;
    }
  } catch {
    alert("Network error. Check your connection.");
    unlockBtn.textContent = "Unlock Dashboard";
    unlockBtn.disabled = false;
  }
});

function populateSubjectSelect(sel, placeholder) {
  sel.innerHTML = `<option value="" disabled selected>${placeholder}</option>`;
  sel.innerHTML += `<option value="">(No subject)</option>`;
  for (const [key, details] of Object.entries(window._subjects || {})) {
    if(key !== "ACT" && key !== "LABCOMBO") {
      const opt = document.createElement('option');
      opt.value = details.name;
      opt.textContent = details.name;
      sel.appendChild(opt);
    }
  }
  sel.innerHTML += `<option value="General">General / Other</option>`;
}

async function loadData() {
  try {
    const [dataRes, eventsRes] = await Promise.all([
      fetch('/api/data'),
      fetch('/api/events?t=' + Date.now())
    ]);
    const data = await dataRes.json();
    let eventsData = { EVENTS: [], HOLIDAYS: [], SETTINGS: {} };
    if (eventsRes.ok) {
      eventsData = await eventsRes.json();
    }
    window._subjects = data.SUBJECTS;
    window._holidays = eventsData.HOLIDAYS || [];
    window._settings = eventsData.SETTINGS || {};

    populateSubjectSelect(document.querySelector('.event-subject'), 'Select a Subject');
    document.querySelectorAll('.series-subject').forEach(sel => populateSubjectSelect(sel, 'Select Subject'));

    renderEventsList(eventsData.EVENTS || []);
    renderHolidaysList();
    initExamModeToggle();
  } catch (err) {
    console.error("Failed to load data", err);
  }
}

function setMinDates() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const min = `${yyyy}-${mm}-${dd}`;
  document.querySelectorAll('.event-date').forEach(el => el.setAttribute('min', min));
  document.getElementById('holidayDate').setAttribute('min', min);
  document.querySelectorAll('.series-date').forEach(el => el.setAttribute('min', min));
}

loadData();
setMinDates();

function updateRowFields(row) {
  const type = row.querySelector('.event-type').value;
  const subjectSel = row.querySelector('.event-subject');
  const titleInp = row.querySelector('.event-title');
  const noSubjNeeded = ['general', 'reminder'].includes(type);
  subjectSel.style.display = noSubjNeeded ? 'none' : '';
  if (noSubjNeeded) {
    subjectSel.value = '';
    titleInp.value = row.querySelector('.event-type').options[row.querySelector('.event-type').selectedIndex].text;
  } else if (subjectSel.value && subjectSel.value !== 'General') {
    titleInp.value = subjectSel.value;
  }
}

document.addEventListener('change', function(e) {
  if (e.target.matches('.event-type')) {
    updateRowFields(e.target.closest('.event-row'));
  }
  if (e.target.matches('.event-subject')) {
    const row = e.target.closest('.event-row');
    const titleInp = row.querySelector('.event-title');
    const type = row.querySelector('.event-type').value;
    if (e.target.value && e.target.value !== 'General' && !['general','reminder'].includes(type)) {
      titleInp.value = e.target.value;
    }
  }
});

function addEventRow() {
  const rows = eventRowsContainer.querySelectorAll('.event-row');
  const template = rows[0].cloneNode(true);
  template.querySelector('.event-subject').value = '';
  template.querySelector('.event-title').value = '';
  template.querySelector('.event-date').value = '';
  const rmBtn = template.querySelector('.event-remove-btn');
  rmBtn.style.display = 'flex';
  rmBtn.addEventListener('click', () => {
    if (eventRowsContainer.querySelectorAll('.event-row').length > 1) {
      template.remove();
    }
  });
  populateSubjectSelect(template.querySelector('.event-subject'), 'Select a Subject');
  updateRowFields(template);
  const today = new Date();
  const yyyy = today.getFullYear(), mm = String(today.getMonth()+1).padStart(2,'0'), dd = String(today.getDate()).padStart(2,'0');
  template.querySelector('.event-date').setAttribute('min', `${yyyy}-${mm}-${dd}`);
  eventRowsContainer.appendChild(template);
}

addEventRowBtn.addEventListener('click', addEventRow);

eventRowsContainer.addEventListener('click', function(e) {
  if (e.target.matches('.event-remove-btn')) {
    if (eventRowsContainer.querySelectorAll('.event-row').length > 1) {
      e.target.closest('.event-row').remove();
    }
  }
});

addSeriesRowBtn.addEventListener('click', () => {
  const rows = seriesRows.querySelectorAll('.series-row');
  const template = rows[0].cloneNode(true);
  template.querySelector('.series-subject').value = '';
  template.querySelector('.series-date').value = '';
  const rmBtn = template.querySelector('.series-remove-btn');
  rmBtn.style.display = 'flex';
  rmBtn.addEventListener('click', () => {
    if (seriesRows.querySelectorAll('.series-row').length > 1) {
      template.remove();
    }
  });
  populateSubjectSelect(template.querySelector('.series-subject'), 'Subject');
  seriesRows.appendChild(template);
});

seriesRows.addEventListener('click', function(e) {
  if (e.target.matches('.series-remove-btn')) {
    if (seriesRows.querySelectorAll('.series-row').length > 1) {
      e.target.closest('.series-row').remove();
    }
  }
});

const typeLabels = {
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

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isEventExpired(ev) {
  if (!ev || !ev.date) return false;
  const parts = ev.date.split('-').map(Number);
  const expiry = new Date(parts[0], parts[1] - 1, parts[2], 13, 30, 0, 0).getTime();
  return Date.now() >= expiry;
}

function renderEventsList(events) {
  const listEl = document.getElementById('eventsList');
  const activeEvents = (events || []).filter(e => !isEventExpired(e));
  window._cachedEvents = activeEvents;

  const clearAllBtn = document.getElementById('clearAllBtn');
  const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');

  if (activeEvents.length === 0) {
    listEl.innerHTML = `<p class="admin-muted-text">No upcoming events found.</p>`;
    if (deleteSelectedBtn) deleteSelectedBtn.style.display = 'none';
    if (clearAllBtn) clearAllBtn.style.display = 'none';
    return;
  }

  if (clearAllBtn) clearAllBtn.style.display = 'inline-block';
  listEl.innerHTML = '';

  const examTitleCount = {};
  activeEvents.forEach(ev => {
    if (ev.type === 'exam' && ev.title) {
      examTitleCount[ev.title] = (examTitleCount[ev.title] || 0) + 1;
    }
  });

  activeEvents.forEach((ev, idx) => {
    const item = document.createElement('div');
    item.className = 'event-item';
    item.dataset.index = idx;

    const displayTitle = ev.title || ev.subject || 'Untitled';
    const typeLabel = typeShortLabels[ev.type] || (ev.type || '').toUpperCase();
    const safeTitle = (ev.title || '').replace(/'/g, "\\'");
    const safeSubject = (ev.subject || '').replace(/'/g, "\\'");
    const isSeries = ev.type === 'exam' && examTitleCount[ev.title] > 1;

    const subtitleParts = [ev.date, typeLabel];
    if (ev.subject && ev.subject !== ev.title) {
      subtitleParts.push(ev.subject);
    }

    item.innerHTML = `
      <div class="event-info-group">
        <input type="checkbox" class="event-checkbox" data-index="${idx}" aria-label="Select event ${escapeHtml(displayTitle)}">
        <div class="event-meta">
          <span class="event-title-text">${escapeHtml(displayTitle)}</span>
          <span class="event-subtitle-text">${escapeHtml(subtitleParts.join(' · '))}</span>
        </div>
      </div>
      <div class="event-actions-group">
        <button type="button" class="del-btn edit-btn" onclick="startEditEvent(${idx})">Edit</button>
        <button type="button" class="del-btn admin-del-danger" onclick="deleteEvent('${safeTitle}', '${ev.date}', '${safeSubject}')">Delete</button>
        ${isSeries ? `<button type="button" class="del-btn admin-btn-series" onclick="deleteSeries('${safeTitle}')">Delete All</button>` : ''}
      </div>
    `;
    item.querySelector('.event-checkbox').addEventListener('change', updateDeleteSelectedBtn);
    listEl.appendChild(item);
  });

  updateDeleteSelectedBtn();
}

function updateDeleteSelectedBtn() {
  const checked = document.querySelectorAll('.event-checkbox:checked').length;
  document.getElementById('deleteSelectedBtn').style.display = checked > 0 ? 'inline-block' : 'none';
}

window.startEditEvent = function(idx) {
  if (!pwdInput.value) {
    alert("Please enter the Admin Password at the top first to edit events.");
    pwdInput.focus();
    return;
  }

  const ev = window._cachedEvents[idx];
  if (!ev) return;

  const item = document.querySelector(`.event-item[data-index="${idx}"]`);
  if (!item) return;

  item.classList.add('editing');

  let subjectOptions = '<option value="">(No subject)</option>';
  for (const [key, details] of Object.entries(window._subjects || {})) {
    if (key !== "ACT" && key !== "LABCOMBO") {
      const selected = ev.subject === details.name ? 'selected' : '';
      subjectOptions += `<option value="${escapeHtml(details.name)}" ${selected}>${escapeHtml(details.name)}</option>`;
    }
  }
  subjectOptions += `<option value="General" ${ev.subject === 'General' ? 'selected' : ''}>General / Other</option>`;

  const isNoSubj = ['general', 'reminder'].includes(ev.type);

  item.innerHTML = `
    <div class="event-edit-card">
      <div class="event-edit-header">
        <span class="event-edit-title">Editing: <strong>${escapeHtml(ev.title || 'Event')}</strong></span>
      </div>
      <div class="event-edit-fields">
        <div class="event-edit-col">
          <label class="event-edit-label">Event Name / Title</label>
          <input type="text" class="input-field edit-title-input" value="${escapeHtml(ev.title || '')}" required>
        </div>
        <div class="event-edit-row">
          <div class="event-edit-col">
            <label class="event-edit-label">Date</label>
            <input type="date" class="input-field edit-date-input" value="${ev.date}" required>
          </div>
          <div class="event-edit-col">
            <label class="event-edit-label">Type</label>
            <select class="input-field edit-type-select">
              <option value="exam" ${ev.type === 'exam' ? 'selected' : ''}>Exam</option>
              <option value="test" ${ev.type === 'test' ? 'selected' : ''}>Test</option>
              <option value="deadline" ${ev.type === 'deadline' ? 'selected' : ''}>Deadline</option>
              <option value="general" ${ev.type === 'general' ? 'selected' : ''}>General</option>
              <option value="reminder" ${ev.type === 'reminder' ? 'selected' : ''}>Reminder</option>
            </select>
          </div>
          <div class="event-edit-col edit-subject-col" style="${isNoSubj ? 'display:none;' : ''}">
            <label class="event-edit-label">Subject</label>
            <select class="input-field edit-subject-select">
              ${subjectOptions}
            </select>
          </div>
        </div>
      </div>
      <div class="event-edit-actions">
        <button type="button" class="admin-btn admin-btn-toc" onclick="saveEditEvent(${idx})">Save Changes</button>
        <button type="button" class="del-btn" onclick="cancelEditEvent(${idx})">Cancel</button>
      </div>
    </div>
  `;

  const typeSel = item.querySelector('.edit-type-select');
  const subjCol = item.querySelector('.edit-subject-col');
  typeSel.addEventListener('change', () => {
    const hide = ['general', 'reminder'].includes(typeSel.value);
    subjCol.style.display = hide ? 'none' : '';
  });
};

window.cancelEditEvent = function(idx) {
  renderEventsList(window._cachedEvents);
};

window.saveEditEvent = function(idx) {
  if (!pwdInput.value) {
    alert("Please enter the Admin Password at the top first.");
    pwdInput.focus();
    return;
  }

  const ev = window._cachedEvents[idx];
  if (!ev) return;

  const item = document.querySelector(`.event-item[data-index="${idx}"]`);
  if (!item) return;

  const titleInp = item.querySelector('.edit-title-input');
  const dateInp = item.querySelector('.edit-date-input');
  const typeSel = item.querySelector('.edit-type-select');
  const subjSel = item.querySelector('.edit-subject-select');

  const newTitle = titleInp ? titleInp.value.trim() : '';
  const newDate = dateInp ? dateInp.value : '';
  const newType = typeSel ? typeSel.value : 'exam';
  const newSubj = subjSel && !['general', 'reminder'].includes(newType) ? subjSel.value : '';

  if (!newTitle) {
    alert("Please enter an event name/title.");
    if (titleInp) titleInp.focus();
    return;
  }
  if (!newDate) {
    alert("Please select a date.");
    if (dateInp) dateInp.focus();
    return;
  }

  const updatedEvent = {
    title: newTitle,
    date: newDate,
    type: newType,
  };
  if (newSubj) {
    updatedEvent.subject = newSubj;
  }

  sendToAPI({
    password: pwdInput.value,
    action: 'edit',
    targetTitle: ev.title,
    targetDate: ev.date,
    targetSubject: ev.subject,
    updatedEvent: updatedEvent
  });
};

function renderHolidaysList() {
  const listEl = document.getElementById('holidaysList');
  const holidays = window._holidays || [];
  if (holidays.length === 0) {
    listEl.innerHTML = `<p class="admin-muted-text">No holidays set.</p>`;
    return;
  }
  listEl.innerHTML = '';
  holidays.sort();
  holidays.forEach(date => {
    const item = document.createElement('div');
    item.className = 'event-item';
    item.innerHTML = `
      <div class="event-meta">
        <span class="event-title-text">${escapeHtml(date)}</span>
        <span class="event-subtitle-text">No notifications</span>
      </div>
      <button type="button" class="del-btn admin-del-danger" onclick="removeHoliday('${date}')">Remove</button>
    `;
    listEl.appendChild(item);
  });
}

async function sendToAPI(payload) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = "Updating events...";
  statusEl.style.color = "var(--ink-soft)";

  try {
    const res = await fetch('/api/admin/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (res.ok) {
      statusEl.textContent = "Success! Events updated.";
      statusEl.style.color = "var(--oop)";
      if(payload.action === 'add' || payload.action === 'clear_all') {
        document.getElementById('eventRows').querySelectorAll('.event-row').forEach((r, i) => {
          if (i > 0) r.remove();
        });
        const first = document.querySelector('.event-row');
        if (first) {
          const firstType = first.querySelector('.event-type');
          first.querySelector('.event-subject').value = '';
          first.querySelector('.event-title').value = firstType.options[firstType.selectedIndex].text;
          first.querySelector('.event-date').value = '';
          updateRowFields(first);
        }
      }
      loadData();
    } else {
      statusEl.textContent = result.error || "Authentication failed.";
      statusEl.style.color = "var(--ds)";
    }
  } catch (err) {
    statusEl.textContent = "Network error. Check your connection.";
    statusEl.style.color = "var(--ds)";
  }
}

document.getElementById('submitEventsBtn').addEventListener('click', (e) => {
  e.preventDefault();

  const events = [];

  eventRowsContainer.querySelectorAll('.event-row').forEach(row => {
    const type = row.querySelector('.event-type').value;
    const subject = row.querySelector('.event-subject').value;
    const title = row.querySelector('.event-title').value.trim();
    const date = row.querySelector('.event-date').value;
    if (title && date) {
      const ev = { title: title, date: date, type: type };
      if (subject && !['general', 'reminder'].includes(type)) {
        ev.subject = subject;
      }
      events.push(ev);
    }
  });

  const globalName = document.getElementById('seriesGlobalName').value.trim();
  seriesRows.querySelectorAll('.series-row').forEach(row => {
    const subject = row.querySelector('.series-subject').value;
    const date = row.querySelector('.series-date').value;
    if (subject && date) {
      const title = globalName || subject;
      events.push({ title: title, date: date, type: 'exam', subject: subject });
    }
  });

  if (events.length === 0) {
    alert("Please fill in at least one event.");
    return;
  }

  sendToAPI({ password: pwdInput.value, action: 'add', events: events });
});

window.deleteEvent = function(title, date, subject) {
  if (!pwdInput.value) {
    alert("Please enter the Admin Password at the top to unlock deletion.");
    pwdInput.focus();
    return;
  }
  if (confirm(`Are you sure you want to delete '${title}'?`)) {
    const payload = { password: pwdInput.value, action: 'delete', targetTitle: title, targetDate: date };
    if (subject) payload.targetSubject = subject;
    sendToAPI(payload);
  }
};

window.deleteSeries = function(title) {
  if (!pwdInput.value) {
    alert("Please enter the Admin Password at the top to unlock deletion.");
    pwdInput.focus();
    return;
  }
  if (confirm(`Delete ALL events in the series '${title}'? This cannot be undone.`)) {
    sendToAPI({ password: pwdInput.value, action: 'delete_series', targetTitle: title });
  }
};

document.getElementById('deleteSelectedBtn').addEventListener('click', () => {
  if (!pwdInput.value) { alert("Please enter the Admin Password at the top first."); pwdInput.focus(); return; }
  const checked = document.querySelectorAll('.event-checkbox:checked');
  if (checked.length === 0) return;
  if (confirm(`Delete ${checked.length} selected event(s)?`)) {
    const targets = [];
    checked.forEach(cb => {
      const idx = parseInt(cb.dataset.index);
      const ev = window._cachedEvents[idx];
      if (ev) targets.push({ title: ev.title, date: ev.date, subject: ev.subject });
    });
    if (targets.length > 0) {
      sendToAPI({ password: pwdInput.value, action: 'delete_multiple', targets: targets });
    }
  }
});

document.getElementById('clearAllBtn').addEventListener('click', () => {
  if (!pwdInput.value) { alert("Please enter the Admin Password at the top first."); return; }
  if (confirm("Delete ALL upcoming events? This cannot be undone.")) {
    sendToAPI({ password: pwdInput.value, action: 'clear_all' });
  }
});

document.getElementById('addHolidayBtn').addEventListener('click', () => {
  const date = document.getElementById('holidayDate').value;
  if (!date) { alert("Please select a date."); return; }
  if (!pwdInput.value) { alert("Please enter the Admin Password at the top first."); return; }
  sendToAPI({ password: pwdInput.value, action: 'add_holiday', holidayDate: date });
});

window.removeHoliday = function(date) {
  if (!pwdInput.value) { alert("Please enter the Admin Password at the top first."); return; }
  if (confirm(`Remove holiday on ${date}?`)) {
    sendToAPI({ password: pwdInput.value, action: 'remove_holiday', holidayDate: date });
  }
};

/* ---------- Exam Mode Toggle ---------- */
function initExamModeToggle() {
  const toggle = document.getElementById('examModeToggle');
  const status = document.getElementById('examModeStatus');
  if (!toggle) return;

  if (window._settings) {
    toggle.checked = window._settings.forceExamMode || false;
    status.textContent = window._settings.forceExamMode
      ? 'Exam mode is currently forced for all users.'
      : 'Auto-detection is active (exams within 1 day trigger mode).';
  }

  toggle.addEventListener('change', () => {
    if (!pwdInput.value) {
      alert("Please enter the Admin Password at the top first.");
      toggle.checked = !toggle.checked;
      return;
    }
    sendToAPI({
      password: pwdInput.value,
      action: 'update_settings',
      settings: { forceExamMode: toggle.checked }
    });
  });
}

initExamModeToggle();