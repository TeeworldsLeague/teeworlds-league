const { Mutex } = require("../utils/mutex");
const discordService = require("./discordService");
const QueueModel = require("../models/queue");
const ResultRankedModel = require("../models/resultRanked");
const UserModel = require("../models/user");
const StatRankedModel = require("../models/statRanked");
const {
  join: joinUtil,
  leave: leaveUtil,
} = require("../utils/resultRanked");
const {
  discordMessageQueue,
  discordMessageResultRankedNotReady,
  discordPrivateMessageNewQueue,
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

  async createGameFromQueue({ queue }) {
    const players = queue.players;
    if (players.length < queue.numberOfPlayersForGame) return { ok: false, message: "Not enough players in queue" };

    const { bluePlayers, redPlayers } = this.choosePlayers(queue);

    const blueRealPlayers = await UserModel.find({ _id: { $in: bluePlayers.map((player) => player.userId) } });
    const redRealPlayers = await UserModel.find({ _id: { $in: redPlayers.map((player) => player.userId) } });

    const bluePlayersObj = await Promise.all(
      blueRealPlayers.map(async (player) => {
        let statRanked = await StatRankedModel.findOne({ userId: player._id, modeId: queue.modeId });

        if (!statRanked) {
          statRanked = await StatRankedModel.create({
            userId: player._id,
            elo: player.elo,

            modeId: queue.modeId,
            modeName: queue.modeName,
          });
        }

        return {
          userId: player._id,
          userName: player.userName,
          avatar: player.avatar,
          eloBefore: statRanked.elo,
          discordId: player.discordId,
        };
      }),
    );
    const redPlayersObj = await Promise.all(
      redRealPlayers.map(async (player) => {
        let statRanked = await StatRankedModel.findOne({ userId: player._id, modeId: queue.modeId });

        if (!statRanked) {
          statRanked = await StatRankedModel.create({
            userId: player._id,
            elo: player.elo,

            modeId: queue.modeId,
            modeName: queue.modeName,
          });
        }

        return {
          userId: player._id,
          userName: player.userName,
          avatar: player.avatar,
          eloBefore: statRanked.elo,
          discordId: player.discordId,
        };
      }),
    );

    const newResultRankedObj = {
      queueId: queue._id,
      numberFromQueue: queue.numberOfGames,
      queueName: queue.name,

      modeId: queue.modeId,
      modeName: queue.modeName,

      bluePlayers: bluePlayersObj,
      redPlayers: redPlayersObj,

      mode: queue.mode,
      map: this.chooseMap(queue),

      guildId: queue.guildId,
      categoryQueueId: queue.categoryQueueId,
      textChannelDisplayFinalResultId: queue.textChannelDisplayResultsId,
    };

    const newResultRanked = await ResultRankedModel.create(newResultRankedObj);

    for (const player of bluePlayersObj) {
      queue.players = queue.players.filter((playerQueue) => playerQueue.userId.toString() !== player.userId.toString());
    }
    for (const player of redPlayersObj) {
      queue.players = queue.players.filter((playerQueue) => playerQueue.userId.toString() !== player.userId.toString());
    }

    queue.numberOfGames++;
    await queue.save();

    const resUpdateMessageQueue = await discordService.updateMessage({
      channelId: queue.textChannelDisplayQueueId,
      messageId: queue.messageQueueId,
      ...(await discordMessageQueue({ queue })),
    });
    if (!resUpdateMessageQueue.ok) return { ok: false, message: "Failed to update message queue" };

    const resCreateTextChannelDisplayResults = await discordService.createTextChannel({
      guildId: newResultRanked.guildId,
      name: "queue_" + newResultRanked.id.toString(),
      categoryId: newResultRanked.categoryQueueId,
    });
    newResultRanked.textChannelDisplayResultId = resCreateTextChannelDisplayResults.data.channel.id;

    const resCreateVoiceRedChannel = await discordService.createVoiceChannel({
      guildId: newResultRanked.guildId,
      name: "red_" + newResultRanked.id.toString(),
      categoryId: newResultRanked.categoryQueueId,
    });
    if (!resCreateVoiceRedChannel.ok) return { ok: false, message: "Failed to create voice channel" };
    newResultRanked.voiceRedChannelId = resCreateVoiceRedChannel.data.channel.id;

    const resCreateVoiceBlueChannel = await discordService.createVoiceChannel({
      guildId: newResultRanked.guildId,
      name: "blue_" + newResultRanked.id.toString(),
      categoryId: newResultRanked.categoryQueueId,
    });
    if (!resCreateVoiceBlueChannel.ok) return { ok: false, message: "Failed to create voice channel" };
    newResultRanked.voiceBlueChannelId = resCreateVoiceBlueChannel.data.channel.id;

    const discordMessage = await discordMessageResultRankedNotReady({ resultRanked: newResultRanked });
    const resSendMessageReady = await discordService.sendMessage({
      channelId: newResultRanked.textChannelDisplayResultId,
      ...discordMessage,
    });
    newResultRanked.messageReadyId = resSendMessageReady.data.message.id;

    for (const player of redRealPlayers) {
      if (!player.discordId) continue;
      const discordPrivateMessage = discordPrivateMessageNewQueue({ resultRanked: newResultRanked });
      await discordService.sendPrivateMessage({
        userId: player.discordId,
        ...discordPrivateMessage,
      });
    }
    for (const player of blueRealPlayers) {
      if (!player.discordId) continue;
      const discordPrivateMessage = discordPrivateMessageNewQueue({ resultRanked: newResultRanked });
      await discordService.sendPrivateMessage({
        userId: player.discordId,
        ...discordPrivateMessage,
      });
    }

    await newResultRanked.save();

    return { ok: true, data: { newResultRanked, queue } };
  }

  chooseMap(queue) {
    return queue.maps[(Math.random() * queue.maps.length) | 0];
  }

  choosePlayers(queue) {
    const numberOfPlayersPerTeam = queue.numberOfPlayersPerTeam;
    const numberOfPlayersForGame = queue.numberOfPlayersForGame;

    const playersToChoose = queue.players.sort((player) => player.joinedAt).slice(0, numberOfPlayersForGame);

    const playersShuffled = [...playersToChoose].sort(() => Math.random() - 0.5);

    const bluePlayers = playersShuffled.slice(0, numberOfPlayersPerTeam);
    const redPlayers = playersShuffled.slice(numberOfPlayersPerTeam, numberOfPlayersForGame);

    return { bluePlayers, redPlayers };
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
