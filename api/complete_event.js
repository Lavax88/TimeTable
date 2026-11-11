/**
 * api/complete_event.js
 * In accordance with Q1 decision, task completion is student-personal in localStorage.
 * This endpoint is maintained for backward compatibility without mutating global Edge Config.
 */

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.status(200).json({
    success: true,
    personal: true,
    message: 'Task completion is recorded locally per device.',
  });
};
