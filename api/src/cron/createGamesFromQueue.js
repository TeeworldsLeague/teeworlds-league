const QueueModel = require("../models/queue");
const queueService = require("../services/queueService");

const createGamesFromQueue = async () => {
  const queues = await QueueModel.find({});

  for (const queue of queues) {
    const resCreateGameFromQueue = await queueService.createGameFromQueue({ queue });
    if (!resCreateGameFromQueue.ok) continue;
  }
};

module.exports = { createGamesFromQueue };
