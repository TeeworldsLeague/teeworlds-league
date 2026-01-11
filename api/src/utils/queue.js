const UserModel = require("../models/user");
const ResultRankedModel = require("../models/resultRanked");
const StatRankedModel = require("../models/statRanked");
const discordService = require("../services/discordService");
const QueueModel = require("../models/queue");
const { discordMessageResultRankedNotReady, discordPrivateMessageNewQueue, discordMessageQueue } = require("./discordMessages");
const { runExclusiveWithId } = require("./mutex");
const { PermissionFlagsBits } = require("discord.js");

const createTeamVoiceChannelPermissions = ({ teamDiscordIds, guild }) => {
  const everyoneRole = guild.roles.everyone;

  return [
    {
      id: everyoneRole.id,
      deny: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel],
    },
    ...teamDiscordIds.map((userId) => ({
      id: userId,
      allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel],
    })),
  ];
};

const createGameFromQueueWithoutLock = async ({ queue }) => {
  const players = queue.players;
  if (players.length < queue.numberOfPlayersForGame) return { ok: false, message: "Not enough players in queue" };

  const { bluePlayers, redPlayers } = choosePlayers(queue);

  const allPlayers = [...bluePlayers, ...redPlayers];
  const allRealPlayers = await UserModel.find({ _id: { $in: allPlayers.map((player) => player.userId) } });

  // Remove these users from all other queues
  const playerIds = allPlayers.map((player) => player.userId);
  const playerIdSet = new Set(playerIds.map((id) => id.toString()));
  const otherQueues = await QueueModel.find({
    _id: { $ne: queue._id },
    "players.userId": { $in: playerIds },
  });
  otherQueues.forEach(async (otherQueue) => {
    const initialLength = otherQueue.players.length;
    otherQueue.players = otherQueue.players.filter((player) => !playerIdSet.has(player.userId.toString()));

    // Only update if players were actually removed
    if (otherQueue.players.length >= initialLength) {
      return;
    }
    await otherQueue.save();

    // Update Discord message for this queue
    if (otherQueue.guildId) {
      const discordMessage = await discordMessageQueue({ queue: otherQueue });
      await discordService.updateMessage({
        channelId: otherQueue.textChannelDisplayQueueId,
        messageId: otherQueue.messageQueueId,
        ...discordMessage,
      });
    }
  });

  const allPlayersObj = await Promise.all(
    allRealPlayers.map(async (player) => {
      let statRanked = await StatRankedModel.findOne({ userId: player._id, modeId: queue.modeId });

      if (!statRanked) {
        statRanked = await StatRankedModel.create({
          userId: player._id,
          elo: player.elo,

          discordId: player.discordId,

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

  const selectedMap = chooseMap(queue);
  const newResultRankedObj = {
    queueId: queue._id,
    numberFromQueue: queue.numberOfGames,
    queueName: queue.name,

    modeId: queue.modeId,
    modeName: queue.modeName,

    bluePlayers: bluePlayersObj,
    redPlayers: redPlayersObj,

    mode: queue.mode,
    eloMode: queue.eloMode,

    mapId: selectedMap._id,
    mapName: selectedMap.name,

    guildId: queue.guildId,
    categoryQueueId: queue.categoryQueueId,
    textChannelDisplayFinalResultId: queue.textChannelDisplayResultsId,
  };

  const newResultRanked = await ResultRankedModel.create(newResultRankedObj);

  const selectedPlayerIds = new Set(allPlayersObj.map((p) => p.userId.toString()));
  queue.players = queue.players.filter((playerQueue) => !selectedPlayerIds.has(playerQueue.userId.toString()));

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

  const redTeamDiscordIds = redPlayersObj.map((p) => p.discordId).filter((id) => id);
  const blueTeamDiscordIds = bluePlayersObj.map((p) => p.discordId).filter((id) => id);

  const resGetGuild = await discordService.getGuild({ guildId: newResultRanked.guildId });
  if (!resGetGuild.ok) return { ok: false, message: "Failed to get guild" };
  const guild = resGetGuild.data.guild;

  const redChannelPermissions = createTeamVoiceChannelPermissions({
    teamDiscordIds: redTeamDiscordIds,
    guild,
  });

  const blueChannelPermissions = createTeamVoiceChannelPermissions({
    teamDiscordIds: blueTeamDiscordIds,
    guild,
  });

  const resCreateVoiceRedChannel = await discordService.createVoiceChannel({
    guildId: newResultRanked.guildId,
    name: newResultRanked.id.toString(),
    categoryId: newResultRanked.categoryQueueId,
    permissionOverwrites: redChannelPermissions,
  });
  if (!resCreateVoiceRedChannel.ok) return { ok: false, message: "Failed to create voice channel" };
  newResultRanked.voiceRedChannelId = resCreateVoiceRedChannel.data.channel.id;

  const resCreateVoiceBlueChannel = await discordService.createVoiceChannel({
    guildId: newResultRanked.guildId,
    name: newResultRanked.id.toString(),
    categoryId: newResultRanked.categoryQueueId,
    permissionOverwrites: blueChannelPermissions,
  });
  if (!resCreateVoiceBlueChannel.ok) return { ok: false, message: "Failed to create voice channel" };
  newResultRanked.voiceBlueChannelId = resCreateVoiceBlueChannel.data.channel.id;

  const discordMessage = await discordMessageResultRankedNotReady({ resultRanked: newResultRanked });
  const resSendMessageReady = await discordService.sendMessage({
    channelId: newResultRanked.textChannelDisplayResultId,
    ...discordMessage,
  });
  newResultRanked.messageReadyId = resSendMessageReady.data.message.id;

  for (const player of allRealPlayers) {
    if (!player.discordId) continue;

    const isRedPlayer = redPlayersObj.some((p) => p.userId.toString() === player._id.toString());
    const isBluePlayer = bluePlayersObj.some((p) => p.userId.toString() === player._id.toString());

    let voiceChannelInfo = null;
    if (isRedPlayer && newResultRanked.voiceRedChannelId) {
      voiceChannelInfo = {
        channelId: newResultRanked.voiceRedChannelId,
        guildId: newResultRanked.guildId,
        teamName: "Red",
      };
    } else if (isBluePlayer && newResultRanked.voiceBlueChannelId) {
      voiceChannelInfo = {
        channelId: newResultRanked.voiceBlueChannelId,
        guildId: newResultRanked.guildId,
        teamName: "Blue",
      };
    }

    const discordPrivateMessage = discordPrivateMessageNewQueue({
      resultRanked: newResultRanked,
      voiceChannelInfo,
    });

    await discordService.sendPrivateMessage({
      userId: player.discordId,
      ...discordPrivateMessage,
    });
  }

  await newResultRanked.save();

  return { ok: true, data: { newResultRanked, queue } };
};

const createGameFromQueue = async ({ queue }) => {
  // TODO: how long does this function need to create a game?
  return await runExclusiveWithId(queue._id.toString(), async () => {
    const otherQueue = await QueueModel.findById(queue._id); // refetch the queue to be sure it's up to date
    if (!otherQueue) return { ok: false, message: "Queue not found" };
    return await createGameFromQueueWithoutLock({ queue: otherQueue });
  });
};

const chooseMap = (queue) => {
  return queue.maps[(Math.random() * queue.maps.length) | 0];
};

const choosePlayers = (queue) => {
  const numberOfPlayersPerTeam = queue.numberOfPlayersPerTeam;
  const numberOfPlayersForGame = queue.numberOfPlayersForGame;

  const playersToChoose = queue.players.sort((player) => player.joinedAt).slice(0, numberOfPlayersForGame);

  const playersShuffled = [...playersToChoose].sort(() => Math.random() - 0.5);

  const bluePlayers = playersShuffled.slice(0, numberOfPlayersPerTeam);
  const redPlayers = playersShuffled.slice(numberOfPlayersPerTeam, numberOfPlayersForGame);

  return { bluePlayers, redPlayers };
};

module.exports = { createGameFromQueue };
