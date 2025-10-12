const { Mutex } = require("../utils/mutex");
const discordService = require("./discordService");
const QueueModel = require("../models/queue");
const ResultRankedModel = require("../models/resultRanked");
const {
  join: joinUtil,
  leave: leaveUtil,
} = require("../utils/resultRanked");
const { discordMessageQueue } = require("../utils/discordMessages");
const {
  joinQueueButtonCallBack,
  leaveQueueButtonCallBack,
  readyButtonCallBack,
  cancelResultRankedButtonCallBack,
  voteRedResultRankedButtonCallBack,
  voteBlueResultRankedButtonCallBack,
} = require("../utils/discordMessages");

class QueueService {
  constructor() {
    this.queueMutex = new Mutex();
  }

  async createNewQueue({ queue }) {
    const resCreateCategoryQueue = await discordService.createCategory({ guildId: queue.guildId, name: queue.name });
    if (!resCreateCategoryQueue.ok) return resCreateCategoryQueue;

    const resCreateTextChannelDisplayQueue = await discordService.createTextChannel({
      guildId: queue.guildId,
      name: queue.name + " - Queue",
      categoryId: resCreateCategoryQueue.data.category.id,
    });
    if (!resCreateTextChannelDisplayQueue.ok) return resCreateTextChannelDisplayQueue;

    const resCreateTextChannelDisplayResults = await discordService.createTextChannel({
      guildId: queue.guildId,
      name: queue.name + " - Results",
      categoryId: resCreateCategoryQueue.data.category.id,
    });
    if (!resCreateTextChannelDisplayResults.ok) return resCreateTextChannelDisplayResults;

    queue.categoryQueueId = resCreateCategoryQueue.data.category.id;
    queue.textChannelDisplayQueueId = resCreateTextChannelDisplayQueue.data.channel.id;
    queue.textChannelDisplayResultsId = resCreateTextChannelDisplayResults.data.channel.id;

    const discordMessage = await discordMessageQueue({ queue });
    const resSendMessage = await discordService.sendMessage({
      channelId: queue.textChannelDisplayQueueId,
      ...discordMessage,
    });

    queue.messageQueueId = resSendMessage.data.message.id;

    await queue.save();

    return { ok: true };
  }

  async updateQueue({ queue }) {
    if (!queue.guildId) return { ok: true };

    const resUpdateCategoryQueue = await discordService.updateCategory({ categoryId: queue.categoryQueueId, name: queue.name });
    if (!resUpdateCategoryQueue.ok) return resUpdateCategoryQueue;
    const resUpdateTextChannelDisplayQueue = await discordService.updateChannel({
      channelId: queue.textChannelDisplayQueueId,
      name: queue.name + " - Queue",
    });
    if (!resUpdateTextChannelDisplayQueue.ok) return resUpdateTextChannelDisplayQueue;
    const resUpdateTextChannelDisplayResults = await discordService.updateChannel({
      channelId: queue.textChannelDisplayResultsId,
      name: queue.name + " - Results",
    });
    if (!resUpdateTextChannelDisplayResults.ok) return resUpdateTextChannelDisplayResults;

    const discordMessage = await discordMessageQueue({ queue });
    await discordService.updateMessage({
      channelId: queue.textChannelDisplayQueueId,
      messageId: queue.messageQueueId,
      ...discordMessage,
    });

    return { ok: true };
  }

  async deleteQueue({ queue }) {
    if (!queue.guildId) return { ok: true };

    const resDeleteTextChannelDisplayQueue = await discordService.deleteChannel({ channelId: queue.textChannelDisplayQueueId });
    if (!resDeleteTextChannelDisplayQueue.ok) return resDeleteTextChannelDisplayQueue;
    queue.textChannelDisplayQueueId = null;

    const resDeleteTextChannelDisplayResults = await discordService.deleteChannel({ channelId: queue.textChannelDisplayResultsId });
    if (!resDeleteTextChannelDisplayResults.ok) return resDeleteTextChannelDisplayResults;
    queue.textChannelDisplayResultsId = null;

    const resDeleteCategoryQueue = await discordService.deleteCategory({ categoryId: queue.categoryQueueId });
    if (!resDeleteCategoryQueue.ok) return resDeleteCategoryQueue;
    queue.categoryQueueId = null;

    discordService.unregisterButtonCallback(queue.joinButtonId);
    discordService.unregisterButtonCallback(queue.leaveButtonId);

    queue.joinButtonId = null;
    queue.leaveButtonId = null;
    queue.messageQueueId = null;

    await queue.save();

    return { ok: true };
  }

  async join({ queue, user }) {
    return await this.queueMutex.runExclusive(async () => {
      const resJoin = await joinUtil({ queue, user });
      if (!resJoin.ok) return resJoin;

      if (queue.guildId) {
        const discordMessage = await discordMessageQueue({ queue });
        await discordService.updateMessage({
          channelId: queue.textChannelDisplayQueueId,
          messageId: queue.messageQueueId,
          ...discordMessage,
        });
      }

      return resJoin;
    });
  }

  async leave({ queue, user }) {
    return await this.queueMutex.runExclusive(async () => {
      const resLeave = await leaveUtil({ queue, user });
      if (!resLeave.ok) return resLeave;

      if (queue.guildId) {
        const discordMessage = await discordMessageQueue({ queue });
        await discordService.updateMessage({
          channelId: queue.textChannelDisplayQueueId,
          messageId: queue.messageQueueId,
          ...discordMessage,
        });
      }

      return resLeave;
    });
  }

  async onStartup() {
    const queues = await QueueModel.find({});
    for (const queue of queues) {
      if (queue.joinButtonId) discordService.registerButtonCallback(queue.joinButtonId, joinQueueButtonCallBack);
      if (queue.leaveButtonId) discordService.registerButtonCallback(queue.leaveButtonId, leaveQueueButtonCallBack);
    }

    const resultRankeds = await ResultRankedModel.find({ freezed: false });
    for (const resultRanked of resultRankeds) {
      if (resultRanked.readyButtonId) discordService.registerButtonCallback(resultRanked.readyButtonId, readyButtonCallBack);
      if (resultRanked.voteCancelButtonId) discordService.registerButtonCallback(resultRanked.voteCancelButtonId, cancelResultRankedButtonCallBack);
      if (resultRanked.voteRedButtonId) discordService.registerButtonCallback(resultRanked.voteRedButtonId, voteRedResultRankedButtonCallBack);
      if (resultRanked.voteBlueButtonId) discordService.registerButtonCallback(resultRanked.voteBlueButtonId, voteBlueResultRankedButtonCallBack);
    }

    console.log("Callbacks for queues initialized");
  }

  async onShutdown() {
    // Cleanup logic can be added here in the future
    console.log("Queue service shutting down");
  }
}

const queueService = new QueueService();

module.exports = queueService;
