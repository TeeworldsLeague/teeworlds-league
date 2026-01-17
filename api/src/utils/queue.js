const UserModel = require("../models/user");
const ResultRankedModel = require("../models/resultRanked");
const StatRankedModel = require("../models/statRanked");
const ClanWarResultRankedModel = require("../models/clanWarResultRanked");
const discordService = require("../services/discordService");
const ClanRankedModel = require("../models/clanRanked");
const QueueModel = require("../models/queue");
const { discordMessageResultRankedNotReady, discordPrivateMessageNewQueue, discordMessageQueue } = require("./discordMessages").resultRankedMessages;
const { runExclusiveWithId } = require("./mutex");
const { PermissionFlagsBits } = require("discord.js");
const { discordMessageResultNotReady } = require("./discordMessages/resultRankedMessages");

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

  let allPlayers = [];
  let result = null;
  let playersTeamOne = [];
  let playersTeamTwo = [];

  if (queue.clanWar) {
    const { playersClanOne, playersClanTwo } = choosePlayersClan(queue);

    const playersClanOneObj = playersClanOne.map((player) => ({
      userId: player.userId,
      userName: player.userName,
      avatar: player.avatar,
      clanId: player.clanId,
      clanName: player.clanName,
      elo: player.elo,
    }));
    const playersClanTwoObj = playersClanTwo.map((player) => ({
      userId: player.userId,
      userName: player.userName,
      avatar: player.avatar,
      clanId: player.clanId,
      clanName: player.clanName,
      elo: player.elo,
    }));
    const mapsObj = queue.maps.map((map) => ({
      _id: map._id,
      mapId: map.mapId,
      name: map.name,
    }));

    const clanOne = await ClanRankedModel.findOne({ _id: playersClanOneObj[0]?.clanId });
    const clanTwo = await ClanRankedModel.findOne({ _id: playersClanTwoObj[0]?.clanId });

    if ((!clanOne && playersClanOneObj.length > 0) || (!clanTwo && playersClanTwoObj.length > 0)) return { ok: false, message: "Clan not found" };

    const clanChoosed = Math.random() > 0.5 ? "clanOne" : "clanTwo";

    const newClanWarResultRankedObj = {
      queueId: queue._id,

      modeId: queue.modeId,
      modeName: queue.modeName,

      clanOnePlayers: playersClanOneObj,
      clanOneId: clanOne?._id,
      clanOneName: clanOne?.name,
      clanOneEloBefore: clanOne?.elo,
      clanOneEloAfter: clanOne?.elo,
      clanOneEloGain: 0,

      clanTwoPlayers: playersClanTwoObj,
      clanTwoId: clanTwo?._id,
      clanTwoName: clanTwo?.name,
      clanTwoEloBefore: clanTwo?.elo,
      clanTwoEloAfter: clanTwo?.elo,
      clanTwoEloGain: 0,

      banPickSteps: queue.banPickSteps,
      maxStep: queue.banPickSteps.length,
      currentBanPickStep: 1,
      clanStepId: clanChoosed === "clanOne" ? clanOne?._id : clanTwo?._id,
      clanStepName: clanChoosed === "clanOne" ? clanOne?.name : clanTwo?.name,

      maps: mapsObj,
      pendingMaps: queue.maps,
      pickedMaps: [],
      bannedMaps: [],

      eloMode: queue.eloMode,

      guildId: queue.guildId,
      categoryQueueId: queue.categoryQueueId,
    };

    const newClanWarResultRanked = await ClanWarResultRankedModel.create(newClanWarResultRankedObj);

    allPlayers = [...playersClanOne, ...playersClanTwo];
    playersTeamOne = playersClanOne;
    playersTeamTwo = playersClanTwo;

    result = newClanWarResultRanked;
  } else {
    const { bluePlayers, redPlayers } = choosePlayers(queue);

    allPlayers = [...bluePlayers, ...redPlayers];
    playersTeamOne = bluePlayers;
    playersTeamTwo = redPlayers;

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

      clanWar: queue.clanWar,
      banPickSteps: queue.banPickSteps,
      maxStep: queue.banPickSteps.length,
      currentStep: 1,

      maps: queue.maps,

      mode: queue.mode,
      eloMode: queue.eloMode,

      mapId: selectedMap._id,
      mapName: selectedMap.name,

      guildId: queue.guildId,
      categoryQueueId: queue.categoryQueueId,
      textChannelDisplayFinalResultId: queue.textChannelDisplayResultsId,
    };

    const newResultRanked = await ResultRankedModel.create(newResultRankedObj);

    result = newResultRanked;
  }

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

          clanId: player.clanRankedId,
          clanName: player.clanRankedName,

          discordId: player.discordId,

          modeId: queue.modeId,
          modeName: queue.modeName,
        });
      }

      return {
        userId: player._id,
        userName: player.userName,
        avatar: player.avatar,
        clanId: player.clanId,
        clanName: player.clanName,
        eloBefore: statRanked.elo,
        discordId: player.discordId,
      };
    }),
  );

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
    guildId: result.guildId,
    name: "queue_" + result.id.toString(),
    categoryId: result.categoryQueueId,
  });
  result.textChannelDisplayResultId = resCreateTextChannelDisplayResults.data.channel.id;

  const redTeamDiscordIds = playersTeamOne.map((p) => p.discordId).filter((id) => id);
  const blueTeamDiscordIds = playersTeamTwo.map((p) => p.discordId).filter((id) => id);

  const resGetGuild = await discordService.getGuild({ guildId: result.guildId });
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

  const resCreateVoiceTeamOneChannel = await discordService.createVoiceChannel({
    guildId: result.guildId,
    name: "team_one_" + result._id.toString(),
    categoryId: result.categoryQueueId,
    permissionOverwrites: redChannelPermissions,
  });
  if (!resCreateVoiceTeamOneChannel.ok) return { ok: false, message: "Failed to create voice channel" };
  result[queue.clanWar ? "voiceClanOneChannelId" : "voiceRedChannelId"] = resCreateVoiceTeamOneChannel.data.channel.id;

  const resCreateVoiceTeamTwoChannel = await discordService.createVoiceChannel({
    guildId: result.guildId,
    name: "team_two_" + result._id.toString(),
    categoryId: result.categoryQueueId,
    permissionOverwrites: blueChannelPermissions,
  });
  if (!resCreateVoiceTeamTwoChannel.ok) return { ok: false, message: "Failed to create voice channel" };
  result[queue.clanWar ? "voiceClanTwoChannelId" : "voiceBlueChannelId"] = resCreateVoiceTeamTwoChannel.data.channel.id;

  const discordMessage = await discordMessageResultNotReady({ result });
  const resSendMessageReady = await discordService.sendMessage({
    channelId: result.textChannelDisplayResultId,
    ...discordMessage,
  });
  result.messageReadyId = resSendMessageReady.data.message.id;

  for (const player of allRealPlayers) {
    if (!player.discordId) continue;

    const isRedPlayer = playersTeamOne.some((p) => p.userId.toString() === player._id.toString());
    const isBluePlayer = playersTeamTwo.some((p) => p.userId.toString() === player._id.toString());

    let voiceChannelInfo = null;
    if (isRedPlayer && result[queue.clanWar ? "voiceClanOneChannelId" : "voiceRedChannelId"]) {
      voiceChannelInfo = {
        channelId: result[queue.clanWar ? "voiceClanOneChannelId" : "voiceRedChannelId"],
        guildId: result.guildId,
        teamName: "Red",
      };
    } else if (isBluePlayer && result[queue.clanWar ? "voiceClanTwoChannelId" : "voiceBlueChannelId"]) {
      voiceChannelInfo = {
        channelId: result[queue.clanWar ? "voiceClanTwoChannelId" : "voiceBlueChannelId"],
        guildId: result.guildId,
        teamName: "Blue",
      };
    }

    const discordPrivateMessage = discordPrivateMessageNewQueue({
      resultRanked: result,
      voiceChannelInfo,
    });

    await discordService.sendPrivateMessage({
      userId: player.discordId,
      ...discordPrivateMessage,
    });
  }

  await result.save();

  return { ok: true, data: { result, queue } };
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

const choosePlayersClan = (queue) => {
  const numberOfPlayersPerTeam = queue.numberOfPlayersPerTeam;

  const regroupedPlayers = queue.players.reduce((acc, player) => {
    if (player.clanId) {
      acc[player.clanId] = [...(acc[player.clanId] || []), player];
    }
    return acc;
  }, {});

  const regroupedPlayersArray = Object.values(regroupedPlayers);

  const playersClanOne = regroupedPlayersArray.length > 0 ? regroupedPlayersArray[0].slice(0, numberOfPlayersPerTeam) : [];
  const playersClanTwo = regroupedPlayersArray.length > 1 ? regroupedPlayersArray[1].slice(0, numberOfPlayersPerTeam) : [];

  return { playersClanOne, playersClanTwo };
};

module.exports = { createGameFromQueue };
