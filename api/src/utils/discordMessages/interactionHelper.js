const QueueModel = require("../../models/queue");
const ResultRankedModel = require("../../models/resultRanked");
const ClanWarResultRankedModel = require("../../models/clanWarResultRanked");
const MapModel = require("../../models/map");
const UserModel = require("../../models/user");
const { ready } = require("../resultRanked");

const findQueueByInteraction = async (interaction) => {
  const queueId = interaction.customId.split("_")[0];
  const queue = await QueueModel.findById(queueId);

  if (!queue) return { ok: false, message: "Queue not found" };

  const user = await UserModel.findOne({ userName: interaction.member.displayName });
  if (!user) return { ok: false, message: "User not found" };

  return { ok: true, data: { queue, user } };
};

const findResultRankedByInteraction = async (interaction) => {
  const resultRankedId = interaction.customId.split("_")[0];
  const resultRanked = await ResultRankedModel.findById(resultRankedId);

  if (!resultRanked) return { ok: false, message: "Game not found" };

  const user = await UserModel.findOne({ userName: interaction.member.displayName });
  if (!user) return { ok: false, message: "User not found" };

  const resReady = await ready({ resultRanked, user });
  if (!resReady.ok) return { ok: false, message: "Player not in result ranked" };

  return { ok: true, data: { resultRanked, user } };
};

const findClanWarResultRankedByInteraction = async (interaction) => {
  const clanWarResultRankedId = interaction.customId.split("_")[0];
  const clanWarResultRanked = await ClanWarResultRankedModel.findById(clanWarResultRankedId);
  if (!clanWarResultRanked) return { ok: false, message: "Clan war result ranked not found" };

  const user = await UserModel.findOne({ userName: interaction.member.displayName });
  if (!user) return { ok: false, message: "User not found" };

  return { ok: true, data: { clanWarResultRanked, user } };
};

const findMapByInteraction = async (interaction) => {
  const mapId = interaction.customId.split("_")[2];
  const map = await MapModel.findById(mapId);
  if (!map) return { ok: false, message: "Map not found" };
  return { ok: true, data: { map } };
};

const findUserByInteraction = async (interaction) => {
  const user = await UserModel.findOne({ discordId: interaction.member.id });
  if (!user) return { ok: false, message: "User not found" };
  return { ok: true, data: { user } };
};

module.exports = {
  findQueueByInteraction,
  findResultRankedByInteraction,
  findClanWarResultRankedByInteraction,
  findMapByInteraction,
  findUserByInteraction,
};
