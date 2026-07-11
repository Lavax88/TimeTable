const lockScreen = document.getElementById('lockScreen');
const eventBuilder = document.getElementById('eventBuilder');
const subjectSelect = document.getElementById('subject');
const typeSelect = document.getElementById('type');
const titleInput = document.getElementById('title');
const pwdInput = document.getElementById('password');

// 1. Password Gate Logic
document.getElementById('unlockBtn').addEventListener('click', () => {
  if (pwdInput.value.trim() !== "") {
    lockScreen.style.display = 'none';
    eventBuilder.style.display = 'flex';
  } else {
    alert("Please enter a password.");
  }
});

// 2. Fetch Subjects and Populate Dropdown
async function loadData() {
  try {
    const res = await fetch('./data.json?v=' + new Date().getTime());
    const data = await res.json();

    // Populate Subjects
    subjectSelect.innerHTML = `<option value="" disabled selected>Select a Subject</option>`;
    for (const [key, details] of Object.entries(data.SUBJECTS)) {
      if(key !== "ACT" && key !== "LABCOMBO") {
        const opt = document.createElement('option');
        opt.value = details.name;
        opt.textContent = details.name;
        subjectSelect.appendChild(opt);
      }
    }
    subjectSelect.innerHTML += `<option value="General">General / Other</option>`;

    // Populate Existing Events
    renderEventsList(data.EVENTS || []);
  } catch (err) {
    console.error("Failed to load data.json", err);
  }
}
loadData();

// 3. Smart Title Auto-fill
function updateTitle() {
  const subj = subjectSelect.value;
  const type = typeSelect.options[typeSelect.selectedIndex].text;
  if (subj && subj !== "General") {
    titleInput.value = `${subj} ${type}`;
  } else {
    titleInput.value = `General ${type}`;
  }
}
subjectSelect.addEventListener('change', updateTitle);
typeSelect.addEventListener('change', updateTitle);

// 4. Render Events List
function renderEventsList(events) {
  const listEl = document.getElementById('eventsList');
  if (events.length === 0) {
    listEl.innerHTML = `<p style="color: var(--ink-soft); font-size: 14px;">No upcoming events found.</p>`;
    return;
  }
  listEl.innerHTML = '';
  events.forEach(ev => {
    const item = document.createElement('div');
    item.className = 'event-item';
    item.innerHTML = `
      <div>
        <span style="font-weight: 700; font-size: 14px; display: block;">${ev.title}</span>
        <span style="font-size: 12px; color: var(--ink-soft); text-transform: capitalize;">${ev.date} · ${ev.type}</span>
      </div>
      <button class="del-btn" onclick="deleteEvent('${ev.title}', '${ev.date}')">Delete</button>
    `;
    listEl.appendChild(item);
  });
}

// 5. API Fetcher
async function sendToAPI(payload) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = "Connecting to repository...";
  statusEl.style.color = "var(--ink-soft)";

  try {
    const res = await fetch('/api/manage_events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (res.ok) {
      statusEl.textContent = "✅ Success! Devices will sync shortly.";
      statusEl.style.color = "var(--oop)";
      if(payload.action === 'add') {
        document.getElementById('adminForm').reset();
        titleInput.value = "";
      }
      loadData(); // Refresh the visual list directly from JSON
    } else {
      statusEl.textContent = "❌ " + (result.error || "Authentication failed.");
      statusEl.style.color = "var(--ds)";
    }
  } catch (err) {
    statusEl.textContent = "❌ Network error. Check your connection.";
    statusEl.style.color = "var(--ds)";
  }
}

// 6. Form Submit
document.getElementById('adminForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const payload = {
    password: pwdInput.value,
    action: 'add',
    events: [{
      title: titleInput.value,
      date: document.getElementById('date').value,
      type: typeSelect.value
    }]
  };
  sendToAPI(payload);
});

// 7. Delete Logic
window.deleteEvent = function(title, date) {
  if (!pwdInput.value) {
    alert("Please enter the Admin Password at the top to unlock deletion.");
    return;
  }
  if (confirm(`Are you sure you want to delete '${title}'?`)) {
    sendToAPI({ password: pwdInput.value, action: 'delete', targetTitle: title, targetDate: date });
  }
}
