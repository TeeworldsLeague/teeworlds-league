const mongoose = require("mongoose");
const { enumEloMode } = require("../enums/enumModes");

const MODELNAME = "mode";

const Schema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: "gCTF 2v2" },

    eloMode: { type: String, enum: enumEloMode, trim: true, default: enumEloMode.ELO },
  },
  {
    timestamps: true,
  },
);

Schema.methods.responseModel = function () {
  return {
    _id: this._id,
    name: this.name,
    eloMode: this.eloMode,
  };
};

const OBJ = mongoose.model(MODELNAME, Schema);
module.exports = OBJ;
