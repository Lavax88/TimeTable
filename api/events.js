const { EventsRepository } = require('./lib/events-repository');

const repository = new EventsRepository();

module.exports = async (req, res) => {
  try {
    const data = await repository.getData();
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=0, must-revalidate');
    res.status(200).json(data);
  } catch (err) {
    console.error('Edge Config read failed:', err.message || err);
    res.status(200).json({ EVENTS: [], HOLIDAYS: [], SETTINGS: {} });
  }
};
