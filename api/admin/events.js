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
  const d = new Date(ev.date);
  d.setHours(13, 30, 0, 0);
  return d.getTime() <= Date.now();
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
      case 'delete': {
        const t = body.targetTitle;
        const d = body.targetDate;
        current.EVENTS = current.EVENTS.filter(
          e => !(e.title === t && e.date === d)
        );
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
