const mongoose = require("mongoose");
const { enumModes, enumEloMode } = require("../enums/enumModes");
const ObjectId = mongoose.Types.ObjectId;

const MODELNAME = "clanWarResultRanked";

const PlayerSchema = new mongoose.Schema({
  userId: { type: ObjectId },
  userName: { type: String, trim: true },
  avatar: { type: String, trim: true },

  clanId: { type: ObjectId },
  clanName: { type: String, trim: true },

  isReady: { type: Boolean, default: false },
  voteCancel: { type: Boolean, default: false },
  voteRed: { type: Boolean, default: false },
  voteBlue: { type: Boolean, default: false },

  discordId: { type: String, trim: true },
});

const MapSchema = new mongoose.Schema({
  _id: { type: ObjectId },
  mapId: { type: ObjectId },
  name: { type: String, trim: true },

  clanWinnerId: { type: ObjectId },
  clanWinnerName: { type: String, trim: true },
  clanLooserId: { type: ObjectId },
  clanLooserName: { type: String, trim: true },

  votedBy: { type: [ObjectId], default: [] },

  resultRankedId: { type: ObjectId, ref: "resultRanked", default: null },
});

const Schema = new mongoose.Schema(
  {
    queueId: { type: ObjectId },
    numberFromQueue: { type: Number, default: 0 },
    queueName: { type: String, trim: true },
    clanWar: { type: Boolean, default: true },

    modeId: { type: ObjectId },
    modeName: { type: String, trim: true },

    clanOnePlayers: { type: [PlayerSchema], default: [] },
    clanOneId: { type: ObjectId },
    clanOneName: { type: String, trim: true },
    clanOneEloBefore: { type: Number, default: 1000 },
    clanOneEloAfter: { type: Number, default: 1000 },
    clanOneEloGain: { type: Number, default: 0 },
    clanOneWins: { type: Number, default: 0 },

    clanTwoPlayers: { type: [PlayerSchema], default: [] },
    clanTwoId: { type: ObjectId },
    clanTwoName: { type: String, trim: true },
    clanTwoEloBefore: { type: Number, default: 1000 },
    clanTwoEloAfter: { type: Number, default: 1000 },
    clanTwoEloGain: { type: Number, default: 0 },
    clanTwoWins: { type: Number, default: 0 },

    banPickSteps: { type: [String], default: ["PICK", "PICK", "BAN", "BAN", "PICK"] },
    maxStep: { type: Number, default: 5 },
    currentBanPickStep: { type: Number, default: 1 },
    clanStepId: { type: ObjectId },
    clanStepName: { type: String, trim: true },

    maps: { type: [MapSchema], default: [] },
    pendingMaps: { type: [MapSchema], default: [] },
    pickedMaps: { type: [MapSchema], default: [] },
    bannedMaps: { type: [MapSchema], default: [] },
    numberMapsToWin: { type: Number, default: 2 },
    currentMapIndex: { type: Number, default: 0 },

    date: { type: Date, default: Date.now },
    mode: { type: String, trim: true, default: enumModes.twoVTwo },
    eloMode: { type: String, enum: enumEloMode, trim: true },

    hasBeenCanceled: { type: Boolean, default: false },

    freezed: { type: Boolean, default: false },
    freezedAt: { type: Date },

    // Discord
    guildId: { type: String, trim: true },
    categoryQueueId: { type: String, trim: true },
    textChannelDisplayResultId: { type: String, trim: true },
    readyButtonId: { type: String, trim: true },
    messageReadyId: { type: String, trim: true },
    messageBanPickStepId: { type: String, trim: true },
    voiceClanOneChannelId: { type: String, trim: true },
    voiceClanTwoChannelId: { type: String, trim: true },
  },
  {
    timestamps: true,
  },
);

Schema.methods.responseModel = function () {
  return {
    _id: this._id,
    date: this.date,
    numberFromQueue: this.numberFromQueue,
    queueName: this.queueName,
    mode: this.mode,
    mapName: this.mapName,
    scoreLimit: this.scoreLimit,
    timeLimit: this.timeLimit,
    isForfeit: this.isForfeit,
    winnerId: this.winnerId,
    winnerName: this.winnerName,
    winnerSide: this.winnerSide,
    looserId: this.looserId,
    looserName: this.looserName,
    looserSide: this.looserSide,
    blueScore: this.blueScore,
    redScore: this.redScore,
    redPlayers: this.redPlayers,
    bluePlayers: this.bluePlayers,
    eloGain: this.eloGain,
    eloLoss: this.eloLoss,
    redEloBefore: this.redEloBefore,
    blueEloBefore: this.blueEloBefore,
    redEloGain: this.redEloGain,
    blueEloGain: this.blueEloGain,
    freezed: this.freezed,
    clanWar: this.clanWar,
  };
};

const OBJ = mongoose.model(MODELNAME, Schema);
module.exports = OBJ;
