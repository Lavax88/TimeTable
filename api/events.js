const { get } = require('@vercel/edge-config');

module.exports = async (req, res) => {
  try {
    const data = await get('events');
    const EVENTS = (data && data.EVENTS) || [];
    const HOLIDAYS = (data && data.HOLIDAYS) || [];
    res.status(200).json({ EVENTS, HOLIDAYS });
  } catch (err) {
    console.error('Edge Config read failed:', err.message || err);
    res.status(200).json({ EVENTS: [], HOLIDAYS: [] });
  }
};
