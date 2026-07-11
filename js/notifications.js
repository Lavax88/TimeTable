const notifToggle = document.getElementById('notifToggle');
const settingsModal = document.getElementById('settingsModal');
const closeSettings = document.getElementById('closeSettings');

notifToggle.addEventListener('click', () => {
  settingsModal.classList.add('active');
});

closeSettings.addEventListener('click', () => {
  settingsModal.classList.remove('active');
});

settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) {
    settingsModal.classList.remove('active');
  }
});

const defaultSettings = {
  classStart: true,
  classEnd: true,
  breakStart: true,
  breakEnd: true,
  fridayReminder: true
};

let userSettings = JSON.parse(localStorage.getItem("timetableAlertSettings")) || defaultSettings;

document.querySelectorAll('.settings-panel input[type="checkbox"]').forEach(checkbox => {
  const key = checkbox.dataset.key;
  checkbox.checked = userSettings[key];
  checkbox.addEventListener('change', (e) => {
    userSettings[key] = e.target.checked;
    localStorage.setItem("timetableAlertSettings", JSON.stringify(userSettings));
    if (e.target.checked) requestNotificationPermission();
  });
});

function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted" && Notification.permission !== "denied") {
    Notification.requestPermission();
  }
}
requestNotificationPermission();

function sendAlert(title, message, categoryKey) {
  if (Notification.permission === "granted" && userSettings[categoryKey] === true) {
    new Notification(title, {
      body: message,
      icon: "logo.png?v=5",
      tag: "timetable-alert-" + categoryKey
    });
  }
}

function isTodayHoliday() {
  if (!window._holidays || !window._holidays.length) return false;
  const t = new Date();
  const yyyy = t.getFullYear();
  const mm = String(t.getMonth() + 1).padStart(2, '0');
  const dd = String(t.getDate()).padStart(2, '0');
  const today = `${yyyy}-${mm}-${dd}`;
  return window._holidays.includes(today);
}

let lastNotifiedMinute = -1;

function checkTimeForNotifications() {
  const t = new Date();
  const curMinutes = t.getHours() * 60 + t.getMinutes();

  if (curMinutes === lastNotifiedMinute) return;
  lastNotifiedMinute = curMinutes;

  const todayHoliday = isTodayHoliday();

  // --- FRIDAY 9:30 PM REMINDER — always fires even on holidays ---
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

  // --- Skip all other notifications on holidays ---
  if (todayHoliday) return;

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

    if (curMinutes === startMin) {
      if (subjectName.toLowerCase().includes("break")) {
        sendAlert("Break Time! ☕", `The ${subjectName} has started.`, "breakStart");
      } else {
        sendAlert("Class Started! 📚", `${subjectName} has begun.`, "classStart");
      }
    }

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
