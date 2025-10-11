const QueueModel = require("../models/queue");
const { createGameFromQueue } = require("../utils/queue");
const discordService = require("../services/discordService");
const { discordMessageQueue } = require("../utils/discordMessages");

const createGamesFromQueue = async () => {
  const queues = await QueueModel.find({});

  for (const queue of queues) {
    const resCreateGameFromQueue = await createGameFromQueue({ queue });
    if (!resCreateGameFromQueue.ok) continue;

    if (queue.guildId) {
      const discordMessage = await discordMessageQueue({ queue });
      await discordService.sendMessage({
        channelId: queue.textChannelDisplayQueueId,
        ...discordMessage,
      });
    }
  }
};

module.exports = { createGamesFromQueue };
