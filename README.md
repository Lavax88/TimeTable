<h1 align="center">TimeTable</h1>

<p align="center">
  A fast, offline-first Progressive Web App (PWA) built for personal class schedule tracking, live period countdowns, and academic task management.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/tests-19%20passed-success?style=flat-square" alt="Tests">
  <img src="https://img.shields.io/badge/architecture-Vanilla%20%2B%20UMD-blue?style=flat-square" alt="Architecture">
  <img src="https://img.shields.io/badge/backend-Vercel%20Edge%20Config-black?style=flat-square" alt="Backend">
  <img src="https://img.shields.io/badge/PWA-offline--ready-purple?style=flat-square" alt="PWA">
  <img src="https://img.shields.io/badge/crafted%20with-vibe%20coding-ff69b4?style=flat-square" alt="Vibe Coding">
</p>

---

## Features

- **Live Timetable & Swipe Navigation**: Weekday tabs with smooth touch swipe gestures, real-time class progress bars, multi-period split markers for lab sessions, and auto-scroll to the ongoing card on load.
- **Break Countdown Overlay**: Circular timer ring tracking remaining break minutes with an "Up Next" preview of the upcoming class.
- **Saturday Rotation Engine**: Automatically distinguishes 1st, 3rd, and 5th working Saturdays from 2nd and 4th off Saturdays.
- **Tasks & Deadlines**: Track upcoming exams, class tests, assignments, and reminders. Tasks automatically expire at 13:30 IST on their scheduled date.
- **Personal Task Completion**: Mark deadlines as done or undone. Progress is saved locally per device (`localStorage`) without modifying shared data.
- **Holiday Mode**: Declared holidays automatically pause live class progress bars and break timers, showing a clean announcement banner.
- **Exam Mode**: Replaces the regular timetable with an exam-focused view during scheduled exams or when toggled by an admin.
- **Hallmark Dusk Theme**: Light and Dark modes with automatic system detection, manual toggle, and 5 selectable background textures (Dots, Grid, Blueprint, Mesh, Screentone).
- **Admin Dashboard (`admin.html`)**: Password-protected manager for creating single events, batch exam series, setting holidays, and managing site settings with an integrated themed popup date picker.
- **Developer Tools**: Fast time-travel controls to test schedule transitions, break timers, and mobile/desktop viewport simulation.
- **Offline PWA**: Service Worker caching for complete offline functionality and custom Add to Home Screen install prompts.

---

## Architecture

Built as a lightweight, zero-build web application:

- **Frontend**: Vanilla ES6+ JavaScript, CSS Custom Properties, and HTML5.
- **Decoupled Modules (UMD)**:
  - `ScheduleEngine`: Pure domain logic for times, breaks, Saturday working days, and holidays.
  - `SwipeNavigator`: Touch swipe gesture navigation engine.
  - `ClientStore`: Browser storage abstraction for themes, task completions, and dev overrides.
  - `ThemedDatePicker`: Viewport-clamped floating calendar popup.
  - `EventsRepository`: Hexagonal data layer supporting both Vercel Edge Config and an in-memory test adapter.
- **Backend**: Vercel Serverless Functions (`/api/*`) backed by Vercel Edge Config for distributed global storage.

### What is Needed
- A modern web browser.
- Node.js (v18+) for running tests or running a local server.
- Optional: Vercel CLI and Edge Config credentials if running the backend admin functions locally.

### What is NOT Needed
- No bundlers or compilers (no Webpack, Vite, Rollup, Parcel, or Babel).
- No frontend frameworks (no React, Vue, Angular, or Svelte overhead).
- No client-side npm dependencies.
- No heavy SQL/NoSQL database server.

---

## Getting Started

### Local Static Server
Because there is no build step, serve the directory directly:

```bash
# Python
python -m http.server 3000

# or Node
npx serve .
```

Open `http://localhost:3000/?dev=1` to run the app with developer controls enabled.

### Full-Stack (with Vercel Serverless)

```bash
npm install
npx vercel dev
```

Required environment variables for admin operations:
```env
ADMIN_PASSWORD=your_password
EDGE_CONFIG=https://edge-config.vercel.com/ecfg_xxxx?token=xxxx
EDGE_CONFIG_ID=ecfg_xxxx
VERCEL_API_TOKEN=your_vercel_token
```

---

## Testing

Run unit tests using Node's built-in test runner:

```bash
npm test
# or
node --test
```

All 19 tests run in under 400ms, verifying schedule calculations, Saturday rotations, holiday behaviors, calendar generation, and repository mutations.

---

## Vibe Coding Disclosure

This project was built and evolved through **vibe coding** with AI assistance (Google DeepMind's Antigravity / Gemini).

While features and visual polish were iterated through conversational AI pairing, the codebase is grounded in strict engineering practices: decoupled domain logic, zero unvetted dependencies, formal ADRs, and 100% passing automated test suites.

---

## License

Personal and academic use.
