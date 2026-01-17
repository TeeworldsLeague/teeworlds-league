const ResultRankedModel = require("../models/resultRanked");
const MapModel = require("../models/map");
const ClanRankedModel = require("../models/clanRanked");
const discordService = require("../services/discordService");
const { freeMutexWithId } = require("./mutex");

const startNextResultRanked = async ({ clanWarResultRanked }) => {
  const pickedMaps = clanWarResultRanked.pickedMaps;
  if (pickedMaps.length === 0) return { ok: false, message: "No maps picked" };

  if (clanWarResultRanked.currentMapIndex >= pickedMaps.length) return { ok: false, message: "No more maps to start" };

  const resTryFindWinner = await tryFindWinner({ clanWarResultRanked });
  if (!resTryFindWinner.ok) return resTryFindWinner;
  const { winner } = resTryFindWinner.data;
  if (winner) return { ok: false, message: "Winner already found" };

  const mapObj = pickedMaps[clanWarResultRanked.currentMapIndex];
  const map = await MapModel.findById(mapObj.mapId);
  if (!map) return { ok: false, message: "Map not found" };

  const sideClanOne = Math.random() > 0.5 ? "red" : "blue";
  const sideClanTwo = sideClanOne === "red" ? "blue" : "red";

  const redPlayers = sideClanOne === "red" ? clanWarResultRanked.clanOnePlayers : clanWarResultRanked.clanTwoPlayers;
  const bluePlayers = sideClanTwo === "blue" ? clanWarResultRanked.clanTwoPlayers : clanWarResultRanked.clanOnePlayers;

  const newResultRanked = await ResultRankedModel.create({
    queueId: clanWarResultRanked.queueId,
    numberFromQueue: clanWarResultRanked.numberFromQueue,
    queueName: clanWarResultRanked.queueName,

    clanWar: true,
    resultRankedClanWarId: clanWarResultRanked._id,

    modeId: clanWarResultRanked.modeId,
    modeName: clanWarResultRanked.modeName,

    redPlayers: redPlayers,
    bluePlayers: bluePlayers,

    mapId: map._id,
    mapName: map.name,

    date: new Date(),
    mode: clanWarResultRanked.mode,
    eloMode: clanWarResultRanked.eloMode,

    // DISCORD
    guildId: clanWarResultRanked.guildId,
    categoryQueueId: clanWarResultRanked.categoryQueueId,
    textChannelDisplayResultId: clanWarResultRanked.textChannelDisplayResultId,
    textChannelDisplayFinalResultId: clanWarResultRanked.textChannelDisplayFinalResultId,
    messageReadyId: clanWarResultRanked.messageReadyId,
    messageResultId: clanWarResultRanked.messageResultId,
  });

  clanWarResultRanked.pickedMaps[clanWarResultRanked.currentMapIndex].resultRankedId = newResultRanked._id;
  clanWarResultRanked.currentMapIndex++;
  await clanWarResultRanked.save();

  return { ok: true, data: { resultRanked: newResultRanked } };
};

const getOngoingResultRanked = async ({ clanWarResultRanked }) => {
  const pickedMaps = clanWarResultRanked.pickedMaps;
  if (pickedMaps.length === 0) return { ok: true, data: { resultRanked: null } };

  const ongoingPickedMaps = pickedMaps.filter((map) => map.resultRankedId === null);
  if (ongoingPickedMaps.length === 0) return { ok: true, data: { resultRanked: null } };

  const resultRankeds = await ResultRankedModel.findOne({ _id: { $in: ongoingPickedMaps.map((map) => map.resultRankedId) } });
  if (!resultRankeds) return { ok: true, data: { resultRanked: null } };

  let resultRankedsFiltered = resultRankeds.filter((resultRanked) => resultRanked.freezed === false);
  if (resultRankedsFiltered.length === 0) return { ok: true, data: { resultRanked: null } };

  const resultRanked = resultRankedsFiltered[0];

  return { ok: true, data: { resultRanked } };
};

const tryEndClanWar = async ({ clanWarResultRanked }) => {
  const resFindWinner = await tryFindWinner({ clanWarResultRanked });
  if (!resFindWinner.ok) return resFindWinner;
  const { winner } = resFindWinner.data;
  if (!winner) return { ok: true, data: { clanWarResultRanked } };

  if (clanWarResultRanked.freezed) return { ok: true, data: { clanWarResultRanked } };

  clanWarResultRanked.freezed = true;
  clanWarResultRanked.freezedAt = new Date();

  const clanOne = await ClanRankedModel.findById(clanWarResultRanked.clanOneId);
  const clanTwo = await ClanRankedModel.findById(clanWarResultRanked.clanTwoId);

  if (winner === "clanOne") {
    clanWarResultRanked.clanOneWins++;
    clanOne.numberWins++;
    await clanOne.save();
  } else {
    clanWarResultRanked.clanTwoWins++;
    clanTwo.numberWins++;
    await clanTwo.save();
  }

  await clanWarResultRanked.save();

  return { ok: true, data: { clanWarResultRanked } };
};

const tryFindWinner = async ({ clanWarResultRanked }) => {
  const numberMapsToWin = clanWarResultRanked.numberMapsToWin;
  const clanOneWins = clanWarResultRanked.clanOneWins;
  const clanTwoWins = clanWarResultRanked.clanTwoWins;
  if (clanOneWins >= numberMapsToWin) return { ok: true, data: { winner: "clanOne" } };
  if (clanTwoWins >= numberMapsToWin) return { ok: true, data: { winner: "clanTwo" } };
  return { ok: true, data: { winner: null } };
};

const deleteClanWarResultRankedDiscord = async ({ clanWarResultRanked }) => {
  if (!clanWarResultRanked.guildId) return { ok: true };

  await discordService.deleteChannel({ channelId: clanWarResultRanked.textChannelDisplayResultId });
  clanWarResultRanked.textChannelDisplayResultId = null;

  await discordService.deleteChannel({ channelId: clanWarResultRanked.voiceClanOneChannelId });
  clanWarResultRanked.voiceClanOneChannelId = null;

  await discordService.deleteChannel({ channelId: clanWarResultRanked.voiceClanTwoChannelId });
  clanWarResultRanked.voiceClanTwoChannelId = null;

  discordService.unregisterButtonCallback(clanWarResultRanked.readyButtonId);

  await freeMutexWithId(clanWarResultRanked._id.toString());
  return { ok: true };
};

module.exports = {
  startNextResultRanked,
  getOngoingResultRanked,
  tryEndClanWar,
  deleteClanWarResultRankedDiscord,
};
