// --- 0. MODAL UI CONTROLS ---
const notifToggle = document.getElementById('notifToggle');
const settingsModal = document.getElementById('settingsModal');
const closeSettings = document.getElementById('closeSettings');

// Open modal
notifToggle.addEventListener('click', () => {
  settingsModal.classList.add('active');
});

// Close modal via X button
closeSettings.addEventListener('click', () => {
  settingsModal.classList.remove('active');
});

// Close modal by clicking the blurry background outside the panel
settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) {
    settingsModal.classList.remove('active');
  }
});

// --- 1. STATE MANAGEMENT (localStorage) ---
// Default settings (all turned ON initially)
const defaultSettings = {
  classStart: true,
  classEnd: true,
  breakStart: true,
  breakEnd: true,
  fridayReminder: true
};

// Load saved settings, or use defaults if it is their first time visiting
let userSettings = JSON.parse(localStorage.getItem("timetableAlertSettings")) || defaultSettings;

// Wire up the HTML checkboxes to update the settings
document.querySelectorAll('.settings-panel input[type="checkbox"]').forEach(checkbox => {
  const key = checkbox.dataset.key;

  // Set initial visual state based on saved data
  checkbox.checked = userSettings[key];

  // Listen for changes
  checkbox.addEventListener('change', (e) => {
    userSettings[key] = e.target.checked;
    localStorage.setItem("timetableAlertSettings", JSON.stringify(userSettings));

    // If they turn anything on, make sure we have OS permission
    if (e.target.checked) requestNotificationPermission();
  });
});

// --- 2. PERMISSIONS ---
function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted" && Notification.permission !== "denied") {
    Notification.requestPermission();
  }
}
// Ask once on initial load
requestNotificationPermission();

// --- 3. ALERT FUNCTION ---
function sendAlert(title, message, categoryKey) {
  // Check OS permission AND check if the user toggled this specific category ON
  if (Notification.permission === "granted" && userSettings[categoryKey] === true) {
    new Notification(title, {
      body: message,
      icon: "logo.png?v=5",
      tag: "timetable-alert-" + categoryKey // Unique tag prevents stacking duplicate categories
    });
  }
}

// --- 4. THE TIME CHECKER LOGIC ---
let lastNotifiedMinute = -1;

function checkTimeForNotifications() {
  const t = new Date();
  const curMinutes = t.getHours() * 60 + t.getMinutes();

  if (curMinutes === lastNotifiedMinute) return;
  lastNotifiedMinute = curMinutes;

  // --- FRIDAY 9:30 PM REMINDER ---
  if (t.getDay() === 5 && curMinutes === 1290) {
    const tomorrow = new Date(t);
    tomorrow.setDate(t.getDate() + 1);
    const occurrence = Math.ceil(tomorrow.getDate() / 7);

    if (occurrence === 1 || occurrence === 3) {
      sendAlert("Heads up! 📅", "Tomorrow is a working Saturday.", "fridayReminder");
    } else {
      sendAlert("Enjoy the weekend! 🎉", "No classes tomorrow.", "fridayReminder");
    }
  }

  // --- DAILY CLASS REMINDERS ---
  const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const todayName = dayNames[t.getDay()];

  const todayPanel = document.querySelector(`.day-panel[data-day="${todayName}"]`);
  if (!todayPanel) return;

  const cards = todayPanel.querySelectorAll(".card[data-start-min]");
  if (cards.length === 0) return;

  const lastCard = cards[cards.length - 1];
  const finalEndMin = Number(lastCard.dataset.endMin);

  cards.forEach(card => {
    const startMin = Number(card.dataset.startMin);
    const endMin = Number(card.dataset.endMin);

    const subjectTitleEl = card.querySelector(".subj-name");
    const subjectName = subjectTitleEl ? subjectTitleEl.textContent.trim() : "Class";

    // Trigger for start times
    if (curMinutes === startMin) {
      if (subjectName.toLowerCase().includes("break")) {
        sendAlert("Break Time! ☕", `The ${subjectName} has started.`, "breakStart");
      } else {
        sendAlert("Class Started! 📚", `${subjectName} has begun.`, "classStart");
      }
    }

    // Trigger for end times
    if (curMinutes === endMin) {
      if (endMin === finalEndMin) {
        sendAlert("Day Complete! 🎒", "Classes are over for the day.", "classEnd");
      } else if (subjectName.toLowerCase().includes("break")) {
        sendAlert("Break Over! 🔔", "The break has ended. Get to your classes!", "breakEnd");
      } else {
        sendAlert("Class Ended! ✅", `${subjectName} is over.`, "classEnd");
      }
    }
  });
}

setInterval(checkTimeForNotifications, 5000);
