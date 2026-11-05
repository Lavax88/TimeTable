const { get } = require('@vercel/edge-config');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN || '';
const EDGE_CONFIG_ID = process.env.EDGE_CONFIG_ID || '';

function unauthorized(res, msg) {
  res.status(401).json({ error: msg || 'Unauthorized: Incorrect password.' });
}

async function readEdgeConfig() {
  if (!process.env.EDGE_CONFIG) {
    return { EVENTS: [], HOLIDAYS: [], SETTINGS: {} };
  }
  const data = await get('events');
  return {
    EVENTS: (data && data.EVENTS) || [],
    HOLIDAYS: (data && data.HOLIDAYS) || [],
    SETTINGS: (data && data.SETTINGS) || {},
  };
}

async function writeEdgeConfig(payload) {
  if (!EDGE_CONFIG_ID) throw new Error('EDGE_CONFIG_ID env var is not set');
  if (!VERCEL_API_TOKEN) throw new Error('VERCEL_API_TOKEN env var is not set');

  const url = `https://api.vercel.com/v1/edge-config/${EDGE_CONFIG_ID}/items`;
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
      Authorization: `Bearer ${VERCEL_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Edge Config write failed (${res.status}): ${text}`);
  }
}

function isExpired(ev) {
  if (!ev || !ev.date) return false;
  const expiry = new Date(`${ev.date}T13:30:00+05:30`).getTime();
  return Date.now() >= expiry;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  if (body.password !== ADMIN_PASSWORD) {
    return unauthorized(res);
  }

  const action = body.action;

  if (action === 'verify') {
    return res.status(200).json({ success: true });
  }

  try {
    const current = await readEdgeConfig();
    current.EVENTS = current.EVENTS.filter(e => !isExpired(e));

    switch (action) {
      case 'add': {
        const newEvents = body.events || [];
        current.EVENTS.push(...newEvents);
        break;
      }
      case 'edit': {
        const t = body.targetTitle;
        const d = body.targetDate;
        const s = body.targetSubject;
        const updated = body.updatedEvent;
        if (!updated || !updated.title || !updated.date) {
          return res.status(400).json({ error: 'Missing title or date for updated event.' });
        }
        let idx = -1;
        if (s !== undefined && s !== '') {
          idx = current.EVENTS.findIndex(e => e.title === t && e.date === d && e.subject === s);
        }
        if (idx === -1) {
          idx = current.EVENTS.findIndex(e => e.title === t && e.date === d);
        }
        if (idx === -1) {
          return res.status(404).json({ error: 'Original event not found to edit.' });
        }
        const existing = current.EVENTS[idx];
        const newEv = {
          ...existing,
          title: updated.title.trim(),
          date: updated.date,
          type: updated.type || existing.type
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
        const t = body.targetTitle;
        const d = body.targetDate;
        const s = body.targetSubject;
        if (s !== undefined && s !== '') {
          const idx = current.EVENTS.findIndex(e => e.title === t && e.date === d && e.subject === s);
          if (idx !== -1) {
            current.EVENTS.splice(idx, 1);
            break;
          }
        }
        current.EVENTS = current.EVENTS.filter(
          e => !(e.title === t && e.date === d)
        );
        break;
      }
      case 'delete_multiple': {
        const targets = body.targets || [];
        current.EVENTS = current.EVENTS.filter(e => {
          return !targets.some(t => t.title === e.title && t.date === e.date && (t.subject === undefined || t.subject === e.subject));
        });
        break;
      }
      case 'delete_series': {
        const t = body.targetTitle;
        current.EVENTS = current.EVENTS.filter(e => e.title !== t);
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
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    await writeEdgeConfig({
      EVENTS: current.EVENTS,
      HOLIDAYS: current.HOLIDAYS,
      SETTINGS: current.SETTINGS,
    });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Admin events error:', err.message || err);
    res.status(500).json({ error: `Failed to update events: ${err.message}` });
  }
};
