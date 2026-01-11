const mongoose = require("mongoose");

const MODELNAME = "map";

const Schema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: "ctf_5" },
    serverNames: { type: [String], trim: true, default: [] },
  },
  {
    timestamps: true,
  },
);

Schema.methods.responseModel = function () {
  return {
    _id: this._id,
    name: this.name,
    serverNames: this.serverNames || [],
  };
};

const OBJ = mongoose.model(MODELNAME, Schema);
module.exports = OBJ;
