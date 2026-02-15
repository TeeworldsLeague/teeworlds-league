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

    elo: { type: Number, default: 1000 },
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
    elo: this.elo,
  };
};

const OBJ = mongoose.model(MODELNAME, Schema);
module.exports = OBJ;
