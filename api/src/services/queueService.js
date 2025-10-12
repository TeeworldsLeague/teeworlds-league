const { Mutex } = require("../utils/mutex");
const { randomElement } = require("../utils/random");
const discordService = require("./discordService");
const resultRankedService = require("./resultRankedService");
const QueueModel = require("../models/queue");
const UserModel = require("../models/user");
const StatRankedModel = require("../models/statRanked");
const {
  join: joinUtil,
  leave: leaveUtil, ready, arePlayersReady, voteCancel, arePlayersVotedCancel,
} = require("../utils/resultRanked");
const {
  discordMessageQueue,
} = require("../utils/discordMessages");
const ResultRankedModel = require("../models/resultRanked");
const { MessageFlags } = require("discord.js");


const joinQueueButtonCallBack = async (interaction) => {
  try {
    const queueId = interaction.customId.split("_")[0];
    const queue = await QueueModel.findById(queueId);
    if (!queue) return { ok: false, message: "Queue not found" };

    const user = await UserModel.findOne({ userName: interaction.member.displayName });
    if (!user) return { ok: false, message: "User not found" };

    const resJoin = await queueService.join({ queue, user });
    if (!resJoin.ok) {
      await interaction.reply({
        content: resJoin.message || "You are already in the queue!",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    await interaction.reply({
      content: `You have been added to the queue!`,
      flags: [MessageFlags.Ephemeral],
    });

    if (!user.discordId) {
      user.discordId = interaction.member.id;

      const resCreateChannel = await discordService.createPrivateMessageChannel({ userId: user.discordId });
      if (!resCreateChannel.ok) return { ok: false, message: "Failed to create private message channel" };

      await discordService.sendPrivateMessage({
        userId: user.discordId,
        message: "Welcome ! Your discord has been successfully linked to your account. Hf !",
      });

      await user.save();
    }
  } catch (error) {
    console.error(error);
  }
};

const leaveQueueButtonCallBack = async (interaction) => {
  try {
    const queueId = interaction.customId.split("_")[0];
    const queue = await QueueModel.findById(queueId);
    if (!queue) return { ok: false, message: "Queue not found" };

    const user = await UserModel.findOne({ userName: interaction.member.displayName });
    if (!user) return { ok: false, message: "User not found" };

    const resLeave = await queueService.leave({ queue, user });
    if (!resLeave.ok) {
      await interaction.reply({
        content: resLeave.message || "You are not in the queue!",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    await interaction.reply({
      content: `You left the queue!`,
      flags: [MessageFlags.Ephemeral],
    });
  } catch (error) {
    console.error(error);
  }
};

class QueueService {
  constructor() {
    this.mutex = new Mutex();
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
    return await this.mutex.runExclusive(async () => {
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
    return await this.mutex.runExclusive(async () => {
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

    const allPlayers = [...bluePlayers, ...redPlayers];
    const allRealPlayers = await UserModel.find({ _id: { $in: allPlayers.map((player) => player.userId) } });

    const allPlayersObj = await Promise.all(
      allRealPlayers.map(async (player) => {
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

    const bluePlayerIds = new Set(bluePlayers.map((p) => p.userId.toString()));
    const bluePlayersObj = allPlayersObj.filter((p) => bluePlayerIds.has(p.userId.toString()));
    const redPlayersObj = allPlayersObj.filter((p) => !bluePlayerIds.has(p.userId.toString()));

    // Create the result ranked match
    const map = randomElement(queue.maps);
    const resCreateResultRanked = await resultRankedService.createResultRanked({
      queue,
      bluePlayersObj,
      redPlayersObj,
      map,
    });
    if (!resCreateResultRanked.ok) return resCreateResultRanked;

    const newResultRanked = resCreateResultRanked.data;

    // Remove selected players from queue
    const selectedPlayerIds = new Set(allPlayersObj.map((p) => p.userId.toString()));
    queue.players = queue.players.filter((playerQueue) => !selectedPlayerIds.has(playerQueue.userId.toString()));

    queue.numberOfGames++;
    await queue.save();

    // Update queue message
    const resUpdateMessageQueue = await discordService.updateMessage({
      channelId: queue.textChannelDisplayQueueId,
      messageId: queue.messageQueueId,
      ...(await discordMessageQueue({ queue })),
    });
    if (!resUpdateMessageQueue.ok) return { ok: false, message: "Failed to update message queue" };

    return { ok: true, data: { newResultRanked, queue } };
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

    console.log("Callbacks for queues initialized");
  }

  async onShutdown() {
    // Cleanup logic can be added here in the future
    console.log("Queue service shutting down");
  }
}

const queueService = new QueueService();

module.exports = queueService;
