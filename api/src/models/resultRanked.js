const mongoose = require("mongoose");
const { enumModes } = require("../enums/enumModes");
const { enumMaps } = require("../enums/enumMaps");
const ObjectId = mongoose.Types.ObjectId;

const MODELNAME = "resultRanked";

const PlayerSchema = new mongoose.Schema({
  userId: { type: ObjectId },
  userName: { type: String, trim: true },
  avatar: { type: String, trim: true },

  score: { type: Number },
  kills: { type: Number },
  deaths: { type: Number },
  flags: { type: Number },
  flagsTouches: { type: Number },

  eloBefore: { type: Number },
  eloAfter: { type: Number },

  isReady: { type: Boolean, default: false },
});

const Schema = new mongoose.Schema(
  {
    queueId: { type: ObjectId },
    numberFromQueue: { type: Number },
    queueName: { type: String, trim: true },

    modeId: { type: ObjectId },
    modeName: { type: String, trim: true },

    date: { type: Date, default: Date.now },
    mode: { type: String, trim: true },
    map: { type: String, trim: true },
    scoreLimit: { type: Number },
    timeLimit: { type: Number },
    isForfeit: { type: Boolean, default: false },

    totalTimeSeconds: { type: Number },
    totalTimeMinutes: { type: Number },
    totalTime: { type: Number },

    winnerId: { type: ObjectId, trim: true },
    winnerName: { type: String, trim: true },
    winnerSide: { type: String, trim: true, enum: ["red", "blue", "", null] },

    looserId: { type: ObjectId, trim: true },
    looserName: { type: String, trim: true },
    looserSide: { type: String, trim: true },

    blueScore: { type: Number },
    redScore: { type: Number },

    redPlayers: { type: [PlayerSchema], default: [] },
    bluePlayers: { type: [PlayerSchema], default: [] },

    eloGain: { type: Number },
    eloLoss: { type: Number },
    redEloBefore: { type: Number },
    blueEloBefore: { type: Number },
    redEloGain: { type: Number },
    blueEloGain: { type: Number },

    freezed: { type: Boolean, default: false },
    freezedAt: { type: Date },

    // Discord
    guildId: { type: String, trim: true },
    categoryQueueId: { type: String, trim: true },
    textChannelDisplayFinalResultId: { type: String, trim: true },
    textChannelDisplayResultId: { type: String, trim: true },
    messageResultId: { type: String, trim: true },
    readyButtonId: { type: String, trim: true },
    voiceRedChannelId: { type: String, trim: true },
    voiceBlueChannelId: { type: String, trim: true },
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
    map: this.map,
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
  };
};

const OBJ = mongoose.model(MODELNAME, Schema);
module.exports = OBJ;
