const { get } = require('@vercel/edge-config');

const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN || '';
const EDGE_CONFIG_ID = process.env.EDGE_CONFIG_ID || '';

function isExpired(ev) {
  if (!ev || !ev.date) return false;
  // Event expires at 13:30 (1:30 PM) on that date in IST (+05:30)
  const expiry = new Date(`${ev.date}T13:30:00+05:30`).getTime();
  return Date.now() >= expiry;
}

async function writeEdgeConfig(payload) {
  if (!EDGE_CONFIG_ID || !VERCEL_API_TOKEN) return;
  try {
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
    await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${VERCEL_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error('Edge Config auto-cleanup failed:', e);
  }
}

module.exports = async (req, res) => {
  try {
    if (!process.env.EDGE_CONFIG) {
      return res.status(200).json({ EVENTS: [], HOLIDAYS: [], SETTINGS: {} });
    }
    const data = await get('events');
    const rawEvents = (data && data.EVENTS) || [];
    const HOLIDAYS = (data && data.HOLIDAYS) || [];
    const SETTINGS = (data && data.SETTINGS) || {};

    const activeEvents = rawEvents.filter(e => !isExpired(e));

    // If any events expired, prune them from Edge Config
    if (activeEvents.length !== rawEvents.length) {
      writeEdgeConfig({
        EVENTS: activeEvents,
        HOLIDAYS,
        SETTINGS,
      }).catch(() => {});
    }

    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=0, must-revalidate');
    res.status(200).json({ EVENTS: activeEvents, HOLIDAYS, SETTINGS });
  } catch (err) {
    console.error('Edge Config read failed:', err.message || err);
    res.status(200).json({ EVENTS: [], HOLIDAYS: [], SETTINGS: {} });
  }
};
