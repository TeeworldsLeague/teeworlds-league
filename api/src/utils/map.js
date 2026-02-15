const MapModel = require("../models/map");

const detectMapFromServer = async (mapString) => {
  const mapName = mapString.split("/").pop();
  const foundMap = await MapModel.findOne({ serverNames: mapName });
  return foundMap ? foundMap : null;
};

module.exports = { detectMapFromServer };
