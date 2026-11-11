/**
 * EventsRepository
 * Deep module encapsulating schedule events, holidays, settings, and expiration logic.
 * Sits at the persistence seam with two adapters:
 * 1. EdgeConfigAdapter (Production)
 * 2. InMemoryAdapter (Tests and offline execution)
 */

function isExpired(ev, referenceTime = new Date()) {
  if (!ev || !ev.date) return false;
  // Event expires at 13:30 (1:30 PM) on that date in IST (+05:30)
  const expiry = new Date(`${ev.date}T13:30:00+05:30`).getTime();
  const refTime = referenceTime instanceof Date ? referenceTime.getTime() : Number(referenceTime);
  return refTime >= expiry;
}

function findEventIndex(events, { targetTitle, targetDate, targetSubject }) {
  if (targetSubject !== undefined && targetSubject !== '') {
    const idx = events.findIndex(
      e => e.title === targetTitle && e.date === targetDate && e.subject === targetSubject
    );
    if (idx !== -1) return idx;
  }
  return events.findIndex(e => e.title === targetTitle && e.date === targetDate);
}

class InMemoryAdapter {
  constructor(initialData = { EVENTS: [], HOLIDAYS: [], SETTINGS: {} }) {
    this.data = JSON.parse(JSON.stringify(initialData));
  }

  async read() {
    return JSON.parse(JSON.stringify(this.data));
  }

  async write(payload) {
    this.data = JSON.parse(JSON.stringify(payload));
    return true;
  }
}

class EdgeConfigAdapter {
  constructor(options = {}) {
    this.edgeConfigEnv = options.edgeConfigEnv || process.env.EDGE_CONFIG;
    this.edgeConfigId = options.edgeConfigId || process.env.EDGE_CONFIG_ID;
    this.vercelApiToken = options.vercelApiToken || process.env.VERCEL_API_TOKEN;
  }

  async read() {
    if (!this.edgeConfigEnv) {
      return { EVENTS: [], HOLIDAYS: [], SETTINGS: {} };
    }
    const { get } = require('@vercel/edge-config');
    const data = await get('events');
    return {
      EVENTS: (data && data.EVENTS) || [],
      HOLIDAYS: (data && data.HOLIDAYS) || [],
      SETTINGS: (data && data.SETTINGS) || {},
    };
  }

  async write(payload) {
    if (!this.edgeConfigId) throw new Error('EDGE_CONFIG_ID env var is not set');
    if (!this.vercelApiToken) throw new Error('VERCEL_API_TOKEN env var is not set');

    const url = `https://api.vercel.com/v1/edge-config/${this.edgeConfigId}/items`;
    const body = {
      items: [
        {
          operation: 'upsert',
          key: 'events',
          value: payload,
        },
      ],
    };

    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${this.vercelApiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Edge Config write failed (${res.status}): ${text}`);
    }
    return true;
  }
}

class EventsRepository {
  constructor(adapter) {
    this.adapter = adapter || new EdgeConfigAdapter();
  }

  isExpired(ev, referenceTime = new Date()) {
    return isExpired(ev, referenceTime);
  }

  /**
   * Retrieves active events, holidays, and settings.
   * Optionally prunes expired events from the underlying store.
   */
  async getData(options = { pruneExpired: true, referenceTime: new Date() }) {
    const data = await this.adapter.read();
    const rawEvents = data.EVENTS || [];
    const holidays = data.HOLIDAYS || [];
    const settings = data.SETTINGS || {};

    const activeEvents = rawEvents.filter(e => !this.isExpired(e, options.referenceTime));

    if (options.pruneExpired && activeEvents.length !== rawEvents.length) {
      this.adapter.write({
        EVENTS: activeEvents,
        HOLIDAYS: holidays,
        SETTINGS: settings,
      }).catch(err => {
        console.error('EventsRepository auto-prune failed:', err.message || err);
      });
    }

    return {
      EVENTS: activeEvents,
      HOLIDAYS: holidays,
      SETTINGS: settings,
    };
  }

  /**
   * Applies an admin command mutation and persists the updated state.
   */
  async applyMutation(action, body = {}, referenceTime = new Date()) {
    const current = await this.adapter.read();
    current.EVENTS = (current.EVENTS || []).filter(e => !this.isExpired(e, referenceTime));
    current.HOLIDAYS = current.HOLIDAYS || [];
    current.SETTINGS = current.SETTINGS || {};

    switch (action) {
      case 'add': {
        const newEvents = body.events || [];
        current.EVENTS.push(...newEvents);
        break;
      }
      case 'edit': {
        const targetTitle = body.targetTitle;
        const targetDate = body.targetDate;
        const targetSubject = body.targetSubject;
        const updated = body.updatedEvent;
        if (!updated || !updated.title || !updated.date) {
          throw new Error('Missing title or date for updated event.');
        }
        const idx = findEventIndex(current.EVENTS, { targetTitle, targetDate, targetSubject });
        if (idx === -1) {
          throw new Error('Original event not found to edit.');
        }
        const existing = current.EVENTS[idx];
        const newEv = {
          ...existing,
          title: updated.title.trim(),
          date: updated.date,
          type: updated.type || existing.type,
        };
        if (updated.subject && !['general', 'reminder'].includes(newEv.type)) {
          newEv.subject = updated.subject;
        } else {
          delete newEv.subject;
        }
        current.EVENTS[idx] = newEv;
        break;
      }
      case 'delete': {
        const targetTitle = body.targetTitle;
        const targetDate = body.targetDate;
        const targetSubject = body.targetSubject;
        const idx = findEventIndex(current.EVENTS, { targetTitle, targetDate, targetSubject });
        if (idx !== -1) {
          current.EVENTS.splice(idx, 1);
        } else {
          current.EVENTS = current.EVENTS.filter(e => !(e.title === targetTitle && e.date === targetDate));
        }
        break;
      }
      case 'delete_multiple': {
        const targets = body.targets || [];
        current.EVENTS = current.EVENTS.filter(e => {
          return !targets.some(
            t => t.title === e.title && t.date === e.date && (t.subject === undefined || t.subject === e.subject)
          );
        });
        break;
      }
      case 'delete_series': {
        const targetTitle = body.targetTitle;
        current.EVENTS = current.EVENTS.filter(e => e.title !== targetTitle);
        break;
      }
      case 'clear_all': {
        current.EVENTS = [];
        break;
      }
      case 'add_holiday': {
        const date = body.holidayDate;
        if (date && !current.HOLIDAYS.includes(date)) {
          current.HOLIDAYS.push(date);
        }
        break;
      }
      case 'remove_holiday': {
        const date = body.holidayDate;
        current.HOLIDAYS = current.HOLIDAYS.filter(d => d !== date);
        break;
      }
      case 'update_settings': {
        current.SETTINGS = { ...current.SETTINGS, ...(body.settings || {}) };
        break;
      }
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    await this.adapter.write({
      EVENTS: current.EVENTS,
      HOLIDAYS: current.HOLIDAYS,
      SETTINGS: current.SETTINGS,
    });

    return { success: true };
  }
}

module.exports = {
  EventsRepository,
  EdgeConfigAdapter,
  InMemoryAdapter,
  isExpired,
};
