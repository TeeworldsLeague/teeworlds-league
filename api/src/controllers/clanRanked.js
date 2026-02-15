const express = require("express");
const router = express.Router();
const passport = require("passport");

const ClanRankedModel = require("../models/clanRanked");
const UserModel = require("../models/user");
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

    const clanRanked = await ClanRankedModel.create(obj);
    return res.status(200).send({ ok: true, data: clanRanked.responseModel() });
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

    const clansRanked = await ClanRankedModel.find(obj).sort(sort);
    return res.status(200).send({ ok: true, data: clansRanked.map((c) => c.responseModel()) });
  }),
);

router.put(
  "/:id",
  passport.authenticate(enumUserRole.ADMIN, { session: false }),
  catchErrors(async (req, res) => {
    const body = req.body;

    let needUpdateUsersInfos = false;

    const obj = {};
    if (body.name) {
      obj.name = body.name;
      needUpdateUsersInfos = true;
    }

    const clanRanked = await ClanRankedModel.findByIdAndUpdate(req.params.id, obj, { new: true });

    if (needUpdateUsersInfos) {
      const users = await UserModel.find({ clanId: clanRanked._id });
      for (const user of users) {
        user.clanName = clanRanked.name;
        await user.save();
      }
    }

    return res.status(200).send({ ok: true, data: clanRanked.responseModel() });
  }),
);

router.post(
  "/:id/updateStat",
  passport.authenticate(enumUserRole.ADMIN, { session: false }),
  catchErrors(async (req, res) => {
    const { id } = req.params;

    const clanRanked = await ClanRankedModel.findById(id);
    if (!clanRanked) return res.status(400).send({ ok: false, code: enumErrorCode.CLAN_NOT_FOUND });

    // TODO: Implement updateStatClanRanked function
    // await updateStatClanRanked(clanRanked);

    return res.status(200).send({ ok: true, data: clanRanked.responseModel() });
  }),
);

router.put(
  "/:id/addPlayer",
  passport.authenticate(enumUserRole.ADMIN, { session: false }),
  catchErrors(async (req, res) => {
    const body = req.body;

    const clanRanked = await ClanRankedModel.findById(req.params.id);
    if (!clanRanked) return res.status(400).send({ ok: false, code: enumErrorCode.CLAN_NOT_FOUND });

    const user = await UserModel.findById(body.userId);
    if (!user) return res.status(400).send({ ok: false, code: enumErrorCode.USER_NOT_FOUND });

    // Check if player is already in the clan
    const existingPlayer = clanRanked.players.find((player) => player.userId.toString() === user._id.toString());
    if (existingPlayer) {
      return res.status(400).send({ ok: false, message: "Player is already in the clan" });
    }

    const player = { userId: user._id, userName: user.userName, avatar: user.avatar };
    clanRanked.players.push(player);

    await clanRanked.save();

    user.clanRankedId = clanRanked._id;
    user.clanRankedName = clanRanked.name;
    await user.save();

    // TODO: Update ranked stats if needed
    // This would require a mode parameter to update player ranked stats
    // await updateStatPlayerRanked({ player: user, mode });

    return res.status(200).send({ ok: true, data: clanRanked.responseModel() });
  }),
);

router.delete(
  "/:id/removePlayer",
  passport.authenticate(enumUserRole.ADMIN, { session: false }),
  catchErrors(async (req, res) => {
    const query = req.query;

    const clanRanked = await ClanRankedModel.findById(req.params.id);
    if (!clanRanked) return res.status(400).send({ ok: false, code: enumErrorCode.CLAN_NOT_FOUND });

    const user = await UserModel.findById(query.userId);
    if (!user) return res.status(400).send({ ok: false, code: enumErrorCode.USER_NOT_FOUND });

    clanRanked.players = clanRanked.players.filter((player) => player.userId.toString() !== user._id.toString());

    await clanRanked.save();

    user.clanRankedId = null;
    user.clanRankedName = null;
    await user.save();

    // TODO: Update ranked stats if needed
    // This would require a mode parameter to update player ranked stats
    // await updateStatPlayerRanked({ player: user, mode });

    return res.status(200).send({ ok: true, data: { clanRanked: clanRanked.responseModel(), player: user.responseModel() } });
  }),
);

router.delete(
  "/:id",
  passport.authenticate(enumUserRole.ADMIN, { session: false }),
  catchErrors(async (req, res) => {
    const clanRanked = await ClanRankedModel.findById(req.params.id);

    if (!clanRanked) return res.status(400).send({ ok: false, code: enumErrorCode.CLAN_NOT_FOUND });

    await ClanRankedModel.findByIdAndDelete(req.params.id);

    return res.status(200).send({ ok: true, data: clanRanked.responseModel() });
  }),
);

module.exports = router;
