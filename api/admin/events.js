const { EventsRepository } = require('../lib/events-repository');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const repository = new EventsRepository();

function unauthorized(res, msg) {
  res.status(401).json({ error: msg || 'Unauthorized: Incorrect password.' });
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
    const result = await repository.applyMutation(action, body);
    res.status(200).json(result);
  } catch (err) {
    console.error('Admin events error:', err.message || err);
    const statusCode = err.message.includes('not found') ? 404 : (err.message.includes('Missing') ? 400 : 500);
    res.status(statusCode).json({ error: `Failed to update events: ${err.message}` });
  }
};
