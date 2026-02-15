const express = require("express");
const router = express.Router();
const passport = require("passport");

const MapModel = require("../models/map");
const enumUserRole = require("../enums/enumUserRole");
const enumErrorCode = require("../enums/enumErrorCode");
const { catchErrors } = require("../utils");

router.post(
  "/",
  passport.authenticate(enumUserRole.ADMIN, { session: false }),
  catchErrors(async (req, res) => {
    const body = req.body;

    const obj = {};
    if (body.name) obj.name = body.name;
    if (body.serverNames) obj.serverNames = body.serverNames;

    const map = await MapModel.create(obj);
    return res.status(200).send({ ok: true, data: map.responseModel() });
  }),
);

router.post(
  "/search",
  catchErrors(async (req, res) => {
    const body = req.body;

    const obj = {};
    if (body._id) obj._id = body._id;
    if (body.name) obj.name = body.name;
    let order = -1;
    if (body.asc) order = 1;

    let sort = {};
    if (body.sort) sort[body.sort] = order;

    const maps = await MapModel.find(obj).sort(sort);
    return res.status(200).send({ ok: true, data: maps.map((m) => m.responseModel()) });
  }),
);

router.get(
  "/:id",
  catchErrors(async (req, res) => {
    const map = await MapModel.findById(req.params.id);
    if (!map) return res.status(404).send({ ok: false, code: enumErrorCode.INVALID_PROPERTY, message: "Map not found" });

    return res.status(200).send({ ok: true, data: map.responseModel() });
  }),
);

router.put(
  "/:id",
  passport.authenticate(enumUserRole.ADMIN, { session: false }),
  catchErrors(async (req, res) => {
    const body = req.body;

    const map = await MapModel.findById(req.params.id);
    if (!map) return res.status(404).send({ ok: false, code: enumErrorCode.INVALID_PROPERTY, message: "Map not found" });

    const obj = {};
    if (body.name !== undefined) obj.name = body.name;
    if (body.serverNames !== undefined) obj.serverNames = body.serverNames;

    const updatedMap = await MapModel.findByIdAndUpdate(req.params.id, obj, { new: true });
    return res.status(200).send({ ok: true, data: updatedMap.responseModel() });
  }),
);

router.delete(
  "/:id",
  passport.authenticate(enumUserRole.ADMIN, { session: false }),
  catchErrors(async (req, res) => {
    const map = await MapModel.findById(req.params.id);
    if (!map) return res.status(404).send({ ok: false, code: enumErrorCode.INVALID_PROPERTY, message: "Map not found" });

    await MapModel.findByIdAndDelete(req.params.id);
    return res.status(200).send({ ok: true, data: map.responseModel() });
  }),
);

module.exports = router;
