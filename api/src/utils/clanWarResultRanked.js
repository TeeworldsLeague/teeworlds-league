const ResultRankedModel = require("../models/resultRanked");
const MapModel = require("../models/map");

const startNextResultRanked = async ({ clanWarResultRanked }) => {
  const pickedMaps = clanWarResultRanked.pickedMaps;
  if (pickedMaps.length === 0) return { ok: false, message: "No maps picked" };

  if (clanWarResultRanked.currentMapIndex >= pickedMaps.length) return { ok: false, message: "No more maps to start" };

  const mapObj = pickedMaps[clanWarResultRanked.currentMapIndex];
  const map = await MapModel.findById(mapObj.mapId);
  if (!map) return { ok: false, message: "Map not found" };

  const sideClanOne = Math.random() > 0.5 ? "red" : "blue";
  const sideClanTwo = sideClanOne === "red" ? "blue" : "red";

  const redPlayers = sideClanOne === "red" ? clanWarResultRanked.clanOnePlayers : clanWarResultRanked.clanTwoPlayers;
  const bluePlayers = sideClanTwo === "blue" ? clanWarResultRanked.clanOnePlayers : clanWarResultRanked.clanTwoPlayers;

  const newResultRanked = await ResultRankedModel.create({
    queueId: clanWarResultRanked.queueId,
    numberFromQueue: clanWarResultRanked.numberFromQueue,
    queueName: clanWarResultRanked.queueName,

    modeId: clanWarResultRanked.modeId,
    modeName: clanWarResultRanked.modeName,

    redPlayers: redPlayers,
    bluePlayers: bluePlayers,

    mapId: map._id,
    mapName: map.name,

    date: new Date(),
    mode: clanWarResultRanked.mode,
    eloMode: clanWarResultRanked.eloMode,
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

const tryFindWinner = async ({ clanWarResultRanked }) => {
  const numberMapsToWin = clanWarResultRanked.numberMapsToWin;
  const clanOneWins = clanWarResultRanked.clanOneWins;
  const clanTwoWins = clanWarResultRanked.clanTwoWins;
  if (clanOneWins >= numberMapsToWin) return { ok: true, data: { winner: "clanOne" } };
  if (clanTwoWins >= numberMapsToWin) return { ok: true, data: { winner: "clanTwo" } };
  return { ok: true, data: { winner: null } };
};

module.exports = {
  startNextResultRanked,
  getOngoingResultRanked,
  tryFindWinner,
};
