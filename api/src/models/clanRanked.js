const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

const MODELNAME = "clanRanked";

const PlayerSchema = new mongoose.Schema({
  userId: { type: ObjectId },
  userName: { type: String, trim: true },
  avatar: { type: String, trim: true, default: "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y" },
});

const Schema = new mongoose.Schema(
  {
    name: { type: String, trim: true },

    players: { type: [PlayerSchema], default: [] },
  },
  {
    timestamps: true,
  },
);

Schema.methods.responseModel = function () {
  return {
    _id: this._id,
    name: this.name,
    players: this.players,
    points: this.points,
    numberGames: this.numberGames,
    numberWins: this.numberWins,
    numberLosses: this.numberLosses,
    difference: this.difference,
    winRate: this.winRate,
    averageElo: this.averageElo,
  };
};

const OBJ = mongoose.model(MODELNAME, Schema);
module.exports = OBJ;
