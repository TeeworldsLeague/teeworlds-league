const { EmbedBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const StatRankedModel = require("../../models/statRanked");
const discordService = require("../../services/discordService");
const {
  ready,
  arePlayersReady,
  join,
  leave,
  voteCancel,
  voteRed,
  voteBlue,
  updateAllStatsResultRanked,
  arePlayersVotedRed,
  deleteResultRankedDiscord,
  arePlayersVotedBlue,
  arePlayersVotedCancel,
  voteBanPickStep,
  tryFindVotedMap,
  arePlayersReadyClanWar,
  readyClanWar,
} = require("../resultRanked");
const QueueModel = require("../../models/queue");
const ClanWarResultRankedModel = require("../../models/clanWarResultRanked");
const {
  findQueueByInteraction,
  findResultRankedByInteraction,
  findClanWarResultRankedByInteraction,
  findUserByInteraction,
  findMapByInteraction,
} = require("./interactionHelper");
const { getOngoingResultRanked, startNextResultRanked, tryEndClanWar, deleteClanWarResultRankedDiscord } = require("../clanWarResultRanked");

const formatPlayersByClan = ({ queue }) => {
  const { players, numberOfPlayersPerTeam } = queue;

  const playersByClan = {};
  players.forEach((player) => {
    const clanKey = player.clanId ? player.clanId.toString() : "no-clan";
    const clanName = player.clanName || "No Clan";

    if (!playersByClan[clanKey]) {
      playersByClan[clanKey] = {
        clanName: clanName,
        players: [],
      };
    }
    playersByClan[clanKey].players.push(player);
  });

  let result = "";

  Object.values(playersByClan).forEach((clan) => {
    const playerCount = clan.players.length;
    result += `${clan.clanName} (${playerCount}/${numberOfPlayersPerTeam})\n`;
    clan.players.forEach((player) => {
      result += `• ${player.userName}\n`;
    });
  });

  if (players.length === 0) {
    result = "• No players";
  }

  return result;
};

const discordMessageQueue = async ({ queue }) => {
  const joinButtonId = `${queue._id}_join_queue`;
  const joinQueueButton = createButton({ customId: joinButtonId, label: "Join Queue", style: ButtonStyle.Success });

  const leaveButtonId = `${queue._id}_leave_queue`;
  const leaveQueueButton = createButton({ customId: leaveButtonId, label: "Leave Queue", style: ButtonStyle.Danger });

  let embed = new EmbedBuilder().setTitle(queue.name).setColor(0x0099ff).setTimestamp();

  if (queue.clanWar) {
    embed.addFields(
      {
        name: "Maps",
        value: queue.maps.map((map) => map.name).join(", "),
        inline: true,
      },
      {
        name: "Mode",
        value: queue.mode,
        inline: true,
      },
      {
        name: "Players in Queue",
        value: formatPlayersByClan({ queue }),
        inline: false,
      },
      {
        name: "IMPORTANT",
        value:
          "Be sure to be in a queue server and that your discord name is the same as your ingame name. Verify also that your clan tag is correct.",
        inline: false,
      },
    );
  } else {
    embed.addFields(
      {
        name: "Maps",
        value: queue.maps.map((map) => map.name).join(", "),
        inline: true,
      },
      {
        name: "Mode",
        value: queue.mode,
        inline: true,
      },
      {
        name: "Players",
        value: queue.players.length + " / " + queue.numberOfPlayersForGame,
        inline: true,
      },
      {
        name: "IMPORTANT",
        value: "Be sure to be in a queue server and that your discord name is the same as your ingame name.",
        inline: true,
      },
    );
  }

  queue.joinButtonId = joinButtonId;
  queue.leaveButtonId = leaveButtonId;

  discordService.registerButtonCallback(joinButtonId, joinQueueButtonCallBack);
  discordService.registerButtonCallback(leaveButtonId, leaveQueueButtonCallBack);

  await queue.save();

  return {
    embed: embed,
    buttons: [joinQueueButton, leaveQueueButton],
  };
};

const discordMessageClassement = async ({ queue }) => {
  const stats = await StatRankedModel.find({ modeId: queue.modeId }).sort({ elo: -1 }).limit(30);

  const leaderboardData = formatLeaderboard({ stats });

  const embed = new EmbedBuilder().setTitle(`🏆 ${queue.name} - Leaderboard`).setColor(0x0099ff).setTimestamp().addFields(
    {
      name: "Rank",
      value: leaderboardData.ranks,
      inline: true,
    },
    {
      name: "Player",
      value: leaderboardData.players,
      inline: true,
    },
    {
      name: "Rating",
      value: leaderboardData.ratings,
      inline: true,
    },
  );
  return {
    embed: embed,
  };
};

const discordMessageClanWarBanPickStep = async ({ clanWarResultRanked }) => {
  const { bannedMaps, pickedMaps, pendingMaps, currentBanPickStep, maxStep, banPickSteps, clanStepName } = clanWarResultRanked;

  const action = banPickSteps[currentBanPickStep - 1];

  const embed = new EmbedBuilder()
    .setTitle("🏆 Ban Pick Step")
    .setDescription(`**${banPickSteps[currentBanPickStep - 1]}**`)
    .setColor(0x0099ff)
    .addFields(
      {
        name: `Clan turn to ${action.toLowerCase()}`,
        value: clanStepName || "Unknown",
      },
      {
        name: "Banned Maps",
        value: bannedMaps?.map((map) => map.name).join("\n") || "None",
      },
      {
        name: "Picked Maps",
        value: pickedMaps?.map((map) => map.name).join("\n") || "None",
      },
    )
    .setTimestamp();

  const buttons = [];
  pendingMaps.forEach((map) => {
    buttons.push(createButton({ customId: `${clanWarResultRanked._id}_vote_${map.mapId}`, label: map.name, style: ButtonStyle.Primary }));
    discordService.registerButtonCallback(`${clanWarResultRanked._id}_vote_${map.mapId}`, voteBanPickStepButtonCallBack);
  });

  return {
    embed: embed,
    buttons: buttons,
  };
};

const discordMessageResultRanked = async ({ resultRanked }) => {
  if (resultRanked.freezed && !resultRanked.hasBeenVoted) {
    return await discordMessageResultRankedFreezed({ resultRanked });
  }
  if (resultRanked.freezed && resultRanked.hasBeenVoted && resultRanked.hasBeenCanceled) {
    return await discordMessageResultRankedCanceled({ resultRanked });
  }
  if (resultRanked.freezed && resultRanked.hasBeenVoted && !resultRanked.hasBeenCanceled) {
    return await discordMessageResultRankedVoted({ resultRanked });
  }

  const { bluePlayers, redPlayers } = resultRanked;

  const matchId = resultRanked._id.toString();

  const winner = resultRanked.winnerName;
  const winnerColor = resultRanked.winnerSide === "red" ? 0xff0000 : 0x0000ff;

  const redPlayersFormatted = redPlayers.map((player) => formatPlayerWithStats({ player, resultRanked })).join("\n");
  const bluePlayersFormatted = bluePlayers.map((player) => formatPlayerWithStats({ player, resultRanked })).join("\n");

  const embed = new EmbedBuilder()
    .setTitle(resultRanked.freezed ? "🏆 Match Completed 🏆" : "🏆 Match In Progress 🏆")
    .setDescription(`**Match ${matchId}** has ${resultRanked.freezed ? "finished" : "started"}!`)
    .setColor(resultRanked.freezed ? winnerColor : 0x0099ff)
    .addFields(
      {
        name: resultRanked.freezed ? "🎯 Result" : "🗺️ Map",
        value: resultRanked.freezed ? `**${winner} won**\n${resultRanked.redScore} - ${resultRanked.blueScore}` : resultRanked.mapName,
        inline: resultRanked.freezed ? false : true,
      },
      {
        name: resultRanked.freezed ? "🗺️ Map" : "🔴 Red Team",
        value: resultRanked.freezed ? `**${resultRanked.mapName}**` : redPlayersFormatted,
        inline: true,
      },
      {
        name: resultRanked.freezed ? "⏱️ Duration" : "🔵 Blue Team",
        value: resultRanked.freezed
          ? `${resultRanked.totalTimeMinutes || 0}:${String(resultRanked.totalTimeSeconds || 0).padStart(2, "0")}`
          : bluePlayersFormatted,
        inline: true,
      },
      {
        name: resultRanked.freezed ? "🔴 Red Team" : "IMPORTANT",
        value: resultRanked.freezed
          ? redPlayersFormatted
          : "Be sure to be in a queue server and that your discord name is the same as your ingame name.",
        inline: resultRanked.freezed ? true : true,
      },
      {
        name: resultRanked.freezed ? "🔵 Blue Team" : "",
        value: resultRanked.freezed ? bluePlayersFormatted : "",
        inline: resultRanked.freezed ? true : true,
      },
    )
    .setTimestamp();

  if (resultRanked.freezed && resultRanked.eloGain && resultRanked.eloLoss) {
    embed.addFields({
      name: "📈 ELO Changes",
      value: `**Winners:** +${resultRanked.eloGain} ELO\n**Losers:** ${resultRanked.eloLoss} ELO`,
      inline: false,
    });
  }

  const obj = {
    embed: embed,
  };

  if (!resultRanked.freezed) {
    const voteRedButtonId = `${resultRanked._id}_vote_red`;
    const voteBlueButtonId = `${resultRanked._id}_vote_blue`;
    const voteCancelButtonId = `${resultRanked._id}_vote_cancel`;

    obj.buttons = [
      createButton({ customId: voteRedButtonId, label: "Vote Red", style: ButtonStyle.Danger }),
      createButton({ customId: voteBlueButtonId, label: "Vote Blue", style: ButtonStyle.Primary }),
    ];

    discordService.registerButtonCallback(voteRedButtonId, voteRedResultRankedButtonCallBack);
    discordService.registerButtonCallback(voteBlueButtonId, voteBlueResultRankedButtonCallBack);

    resultRanked.voteRedButtonId = voteRedButtonId;
    resultRanked.voteBlueButtonId = voteBlueButtonId;

    if (!resultRanked.clanWar) {
      obj.buttons.push(createButton({ customId: voteCancelButtonId, label: "Vote Cancel", style: ButtonStyle.Secondary }));
      discordService.registerButtonCallback(voteCancelButtonId, cancelResultRankedButtonCallBack);
      resultRanked.voteCancelButtonId = voteCancelButtonId;
    }

    await resultRanked.save();

    const redVoteField = formatRedVotes({ resultRanked });
    const blueVoteField = formatBlueVotes({ resultRanked });

    embed.addFields(redVoteField);
    embed.addFields(blueVoteField);

    if (!resultRanked.clanWar) {
      const cancelVoteField = formatCancelVotes({ resultRanked });
      embed.addFields(cancelVoteField);
    }
  }

  return obj;
};

const discordMessageResultRankedFreezed = async ({ resultRanked }) => {
  const { bluePlayers, redPlayers } = resultRanked;

  const matchId = resultRanked._id.toString();

  const winner = resultRanked.winnerName;
  const winnerColor = resultRanked.winnerSide === "red" ? 0xff0000 : 0x0000ff;

  const redPlayersFormatted = redPlayers.map((player) => formatPlayerWithStats({ player, resultRanked })).join("\n");
  const bluePlayersFormatted = bluePlayers.map((player) => formatPlayerWithStats({ player, resultRanked })).join("\n");

  const embed = new EmbedBuilder()
    .setTitle("🏆 Match Completed 🏆")
    .setDescription(`**Match ${matchId}** has finished!`)
    .setColor(resultRanked.freezed ? winnerColor : 0x0099ff)
    .addFields(
      {
        name: "🎯 Result",
        value: `**${winner} won**\n${resultRanked.redScore} - ${resultRanked.blueScore}`,
        inline: false,
      },
      {
        name: "🗺️ Map",
        value: `**${resultRanked.mapName}**`,
        inline: true,
      },
      {
        name: "⏱️ Duration",
        value: `${resultRanked.totalTimeMinutes || 0}:${String(resultRanked.totalTimeSeconds || 0).padStart(2, "0")}`,
        inline: true,
      },
      {
        name: "🔴 Red Team",
        value: redPlayersFormatted,
        inline: true,
      },
      {
        name: "🔵 Blue Team",
        value: bluePlayersFormatted,
        inline: true,
      },
    )
    .setTimestamp();

  if (resultRanked.eloGain && resultRanked.eloLoss) {
    embed.addFields({
      name: "📈 ELO Changes",
      value: `**Winners:** +${resultRanked.eloGain} ELO\n**Losers:** ${resultRanked.eloLoss} ELO`,
      inline: false,
    });
  }

  return {
    embed: embed,
  };
};

const discordMessageResultRankedVoted = async ({ resultRanked }) => {
  const { bluePlayers, redPlayers } = resultRanked;

  const matchId = resultRanked._id.toString();

  const winner = resultRanked.winnerName;
  const winnerColor = resultRanked.winnerSide === "red" ? 0xff0000 : 0x0000ff;

  const redPlayersFormatted = formatPlayers(redPlayers);
  const bluePlayersFormatted = formatPlayers(bluePlayers);

  const embed = new EmbedBuilder()
    .setTitle("🏆 Match Completed 🏆")
    .setDescription(`**Match ${matchId}** has finished!`)
    .setColor(winnerColor)
    .addFields(
      {
        name: "🎯 Result",
        value: `**${winner} won**`,
        inline: false,
      },
      {
        name: "🗺️ Map",
        value: `**${resultRanked.mapName}**`,
        inline: true,
      },
      {
        name: "🔴 Red Team",
        value: redPlayersFormatted,
        inline: true,
      },
      {
        name: "🔵 Blue Team",
        value: bluePlayersFormatted,
        inline: true,
      },
    )
    .setTimestamp();

  if (resultRanked.eloGain && resultRanked.eloLoss) {
    embed.addFields({
      name: "📈 ELO Changes",
      value: `**Winners:** +${resultRanked.eloGain} ELO\n**Losers:** ${resultRanked.eloLoss} ELO`,
      inline: false,
    });
  }

  return {
    embed: embed,
  };
};

const discordMessageResultRankedCanceled = async ({ resultRanked }) => {
  const { bluePlayers, redPlayers } = resultRanked;

  const matchId = resultRanked._id.toString();

  const winnerColor = 0x0000ff;

  const redPlayersFormatted = formatPlayers(redPlayers);
  const bluePlayersFormatted = formatPlayers(bluePlayers);

  const embed = new EmbedBuilder()
    .setTitle("🏆 Match Canceled 🏆")
    .setDescription(`**Match ${matchId}** has been canceled!`)
    .setColor(winnerColor)
    .addFields(
      {
        name: "🎯 Reason",
        value: `**Match canceled by vote !**`,
        inline: false,
      },
      {
        name: "🗺️ Map",
        value: `**${resultRanked.mapName}**`,
        inline: true,
      },
      {
        name: "🔴 Red Team",
        value: redPlayersFormatted,
        inline: true,
      },
      {
        name: "🔵 Blue Team",
        value: bluePlayersFormatted,
        inline: true,
      },
    )
    .setTimestamp();

  return {
    embed: embed,
  };
};

const discordMessageResultNotReady = async ({ result }) => {
  const readyButtonId = `${result._id}_ready`;
  const readyButton = createButton({ customId: readyButtonId, label: "Ready", style: ButtonStyle.Success });
  const allPlayers = [...result[result.clanWar ? "clanOnePlayers" : "redPlayers"], ...result[result.clanWar ? "clanTwoPlayers" : "bluePlayers"]];

  result.readyButtonId = readyButtonId;
  await result.save();

  discordService.registerButtonCallback(readyButtonId, result.clanWar ? readyButtonClanWarCallBack : readyButtonCallBack);

  const embed = new EmbedBuilder()
    .setTitle(getGameStatus({ result }))
    .setColor(0x0099ff)
    .addFields(
      {
        name: "Not ready",
        value: formatPlayers(allPlayers.filter((player) => !player.isReady)),
        inline: true,
      },
      {
        name: "Ready",
        value: formatPlayers(allPlayers.filter((player) => player.isReady)),
        inline: true,
      },
      {
        name: "IMPORTANT",
        value: "Be sure to be in a queue server and that your discord name is the same as your ingame name.",
        inline: true,
      },
    );

  return {
    embed: embed,
    buttons: [readyButton],
  };
};

const discordPrivateMessageNewQueue = ({ resultRanked, voiceChannelInfo = null }) => {
  const fileds = [];
  if (voiceChannelInfo && voiceChannelInfo.channelId && voiceChannelInfo.teamName) {
    fileds.push({
      name: `🎤 Join ${voiceChannelInfo.teamName} Team Voice Channel`,
      value: `https://discord.com/channels/${voiceChannelInfo.guildId}/${voiceChannelInfo.channelId}`,
      inline: false,
    });
  }
  fileds.push({
    name: "📢 Join the game channel",
    value: `https://discord.com/channels/${resultRanked.guildId}/${resultRanked.textChannelDisplayResultId}`,
    inline: false,
  });
  const embed = new EmbedBuilder()
    .setTitle("Game found : " + resultRanked.queueName)
    .setColor(0x0099ff)
    .addFields(fileds)
    .setTimestamp();

  return {
    embed: embed,
    message: "New game found!",
  };
};

const discordMessageClanWarBilanVotes = async ({ clanWarResultRanked }) => {
  const { pickedMaps, bannedMaps } = clanWarResultRanked;

  const embed = new EmbedBuilder()
    .setTitle("🏆 Clan War Bilan Votes 🏆")
    .setDescription("Bilan of the votes for the clan war")
    .setColor(0x0099ff)
    .addFields({
      name: "Picked Maps",
      value: pickedMaps.map((map) => map.name).join("\n"),
    })
    .setTimestamp();

  return {
    embed: embed,
  };
};

const discordMessageClanWarOngoing = async ({ clanWarResultRanked }) => {
  const resOngoingResultRanked = await getOngoingResultRanked({ clanWarResultRanked });
  if (!resOngoingResultRanked.ok) return resOngoingResultRanked;

  const { resultRanked } = resOngoingResultRanked.data;

  if (null === resultRanked) {
    const resStartResultRanked = await startNextResultRanked({ clanWarResultRanked });
    if (!resStartResultRanked.ok) return resStartResultRanked;

    const { resultRanked: newResultRanked } = resStartResultRanked.data;

    return await discordMessageResultRanked({ resultRanked: newResultRanked });
  }
};

const discordMessageClanWarFinalResult = async ({ clanWarResultRanked }) => {
  const embed = new EmbedBuilder()
    .setTitle("🏆 Clan War Final Result 🏆")
    .setDescription("Final result of the clan war")
    .setColor(0x0099ff)
    .addFields(
      {
        name: "🎯 Result",
        value: `**${clanWarResultRanked.winnerName} won**`,
      },
      {
        name: "🗺️ Maps",
        value: `**${clanWarResultRanked.pickedMaps.map((map) => map.name).join("\n")}**`,
        inline: true,
      },
      {
        name: clanWarResultRanked.clanOneName,
        value: clanWarResultRanked.clanOnePlayers.map((player) => `• ${player.userName} (${player.clanName})`).join("\n"),
        inline: true,
      },
      {
        name: clanWarResultRanked.clanTwoName,
        value: clanWarResultRanked.clanTwoPlayers.map((player) => `• ${player.userName} (${player.clanName})`).join("\n"),
        inline: true,
      },
    )
    .setTimestamp();
  return {
    embed: embed,
  };
};

const getGameStatus = ({ result }) => {
  if (result.freezed) {
    return "Match Completed 🏆";
  }
  return "Match Starting 🏆";
};

const getRankEmoji = (position) => {
  if (position === 1) return "🥇";
  if (position === 2) return "🥈";
  if (position === 3) return "🥉";
  return `${position}.`;
};

const formatLeaderboard = ({ stats }) => {
  const ranks = stats.map((stat, i) => getRankEmoji(i + 1)).join("\n");
  const players = stats
    .map((stat) => {
      if (stat.discordId) {
        return `<@${stat.discordId}>`;
      }
      return stat.userName;
    })
    .join("\n");
  const ratings = stats.map((stat) => `${stat.elo.toFixed(2)} (${stat.numberWins}W/${stat.numberLosses}L)`).join("\n");

  return {
    ranks,
    players,
    ratings,
  };
};

const formatPlayers = (players) => {
  return players.map((player) => `• ${player.userName}`).join("\n") || "• No players";
};

const formatPlayerWithStats = ({ player, resultRanked }) => {
  if (resultRanked.freezed) {
    const stats = `**${player.score}** pts | ${Math.round(player.kills / player.deaths, 2)} K/D | ${player.flags} flags`;
    return `• **${player.userName}**\n  ${stats}`;
  }
  return `• ${player.userName}`;
};

const formatRedVotes = ({ resultRanked }) => {
  const allPlayers = [...resultRanked.redPlayers, ...resultRanked.bluePlayers];
  const votedPlayers = allPlayers.filter((player) => player.voteRed);

  const field = {
    name: "Red Votes (" + votedPlayers.length + " / " + allPlayers.length + ")",
    value: votedPlayers.map((player) => `• ${player.userName}`).join("\n"),
    inline: false,
  };

  if (votedPlayers.length === 0) {
    field.value = "• No players";
  }

  return field;
};

const formatBlueVotes = ({ resultRanked }) => {
  const allPlayers = [...resultRanked.redPlayers, ...resultRanked.bluePlayers];
  const votedPlayers = allPlayers.filter((player) => player.voteBlue);

  const field = {
    name: "Blue Votes (" + votedPlayers.length + " / " + allPlayers.length + ")",
    value: votedPlayers.map((player) => `• ${player.userName}`).join("\n"),
    inline: false,
  };

  if (votedPlayers.length === 0) {
    field.value = "• No players";
  }

  return field;
};

const formatCancelVotes = ({ resultRanked }) => {
  const allPlayers = [...resultRanked.redPlayers, ...resultRanked.bluePlayers];
  const votedPlayers = allPlayers.filter((player) => player.voteCancel);

  const field = {
    name: "Cancel Votes (" + votedPlayers.length + " / " + allPlayers.length + ")",
    value: votedPlayers.map((player) => `• ${player.userName}`).join("\n"),
    inline: false,
  };

  if (votedPlayers.length === 0) {
    field.value = "• No players";
  }

  return field;
};

const createButton = ({ customId, label, style }) => {
  return new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(style);
};

const handleClanWarAfterVote = async ({ resultRanked }) => {
  if (!resultRanked.clanWar) {
    return { ok: true };
  }

  const clanWarResultRanked = await ClanWarResultRankedModel.findById(resultRanked.resultRankedClanWarId);
  if (!clanWarResultRanked) {
    return { ok: true };
  }

  const playersWinner = resultRanked.winnerSide === "red" ? resultRanked.redPlayers : resultRanked.bluePlayers;
  const clanWinnerId = playersWinner[0].clanId;

  clanWarResultRanked.clanOneWins =
    clanWinnerId.toString() === clanWarResultRanked.clanOneId?.toString() ? clanWarResultRanked.clanOneWins + 1 : clanWarResultRanked.clanOneWins;
  clanWarResultRanked.clanTwoWins =
    clanWinnerId.toString() === clanWarResultRanked.clanTwoId?.toString() ? clanWarResultRanked.clanTwoWins + 1 : clanWarResultRanked.clanTwoWins;
  await clanWarResultRanked.save();

  const resTryEndClanWar = await tryEndClanWar({ clanWarResultRanked });
  if (!resTryEndClanWar.ok) return resTryEndClanWar;
  const { clanWarResultRanked: newClanWarResultRanked } = resTryEndClanWar.data;
  if (newClanWarResultRanked.freezed) {
    await deleteClanWarResultRankedDiscord({ clanWarResultRanked });

    const discordMessageClanWarResult = await discordMessageClanWarFinalResult({ clanWarResultRanked });
    await discordService.sendMessage({
      channelId: clanWarResultRanked.textChannelDisplayFinalResultId,
      ...discordMessageClanWarResult,
    });
    return { ok: true };
  }

  const resStartNextResultRanked = await startNextResultRanked({ clanWarResultRanked });
  if (!resStartNextResultRanked.ok) return resStartNextResultRanked;

  const { resultRanked: newResultRanked } = resStartNextResultRanked.data;
  const newDiscordMessage = await discordMessageResultRanked({ resultRanked: newResultRanked });

  const resSendMessage = await discordService.sendMessage({
    channelId: newResultRanked.textChannelDisplayResultId,
    ...newDiscordMessage,
  });
  newResultRanked.messageResultId = resSendMessage.data.message.id;
  await newResultRanked.save();

  return { ok: true };
};

// CALLBACKS

const joinQueueButtonCallBack = async (interaction) => {
  try {
    const resExtract = await findQueueByInteraction(interaction);
    if (!resExtract.ok) return resExtract;

    const { queue, user } = resExtract.data;

    const resJoin = await join({ queue, user });
    if (!resJoin.ok) {
      interaction.reply({
        content: resJoin.message || "You are already in the queue!",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    await queue.save();

    interaction.reply({
      content: `You have been added to the queue!`,
      flags: [MessageFlags.Ephemeral],
    });

    if (!user.discordId) {
      user.discordId = interaction.member.id;

      const resCreateChannel = await discordService.createPrivateMessageChannel({ userId: user.discordId });
      if (!resCreateChannel.ok) return { ok: false, message: "Failed to create private message channel" };

      await discordService.sendPrivateMessage({
        userId: user.discordId,
        message: "Welcome ! Your discord has been successfully linked to your account. Hf !",
      });

      await user.save();
    }

    const discordMessage = await discordMessageQueue({ queue });
    await discordService.updateMessage({
      channelId: queue.textChannelDisplayQueueId,
      messageId: queue.messageQueueId,
      ...discordMessage,
    });
  } catch (error) {
    console.error(error);
  }
};

const leaveQueueButtonCallBack = async (interaction) => {
  try {
    const resExtract = await findQueueByInteraction(interaction);
    if (!resExtract.ok) return resExtract;

    const { queue, user } = resExtract.data;

    const resLeave = await leave({ queue, user });
    if (!resLeave.ok) {
      interaction.reply({
        content: resLeave.message || "You are not in the queue!",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    interaction.reply({
      content: `You left the queue!`,
      flags: [MessageFlags.Ephemeral],
    });

    const discordMessage = await discordMessageQueue({ queue });
    await discordService.updateMessage({
      channelId: queue.textChannelDisplayQueueId,
      messageId: queue.messageQueueId,
      ...discordMessage,
    });
  } catch (error) {
    console.error(error);
  }
};

const readyButtonCallBack = async (interaction) => {
  try {
    const resExtract = await findResultRankedByInteraction(interaction);
    if (!resExtract.ok) return resExtract;

    const { resultRanked, user } = resExtract.data;

    const resReady = await ready({ resultRanked, user });
    if (!resReady.ok) return { ok: false, message: "Player not in result ranked" };

    interaction.reply({ content: `You have been marked as ready!`, flags: [MessageFlags.Ephemeral] });

    if (arePlayersReady({ resultRanked })) {
      discordService.deleteMessage({ channelId: resultRanked.textChannelDisplayResultId, messageId: resultRanked.messageReadyId });
      resultRanked.messageReadyId = null;

      discordService.unregisterButtonCallback(resultRanked.readyButtonId);
      resultRanked.readyButtonId = null;

      const resSendMessage = await discordService.sendMessage({
        channelId: resultRanked.textChannelDisplayResultId,
        ...(await discordMessageResultRanked({ resultRanked })),
      });
      resultRanked.messageResultId = resSendMessage.data.message.id;

      await resultRanked.save();
    }
  } catch (error) {
    console.error(error);
  }
};

const readyButtonClanWarCallBack = async (interaction) => {
  try {
    const resExtract = await findClanWarResultRankedByInteraction(interaction);
    if (!resExtract.ok) return resExtract;

    const { clanWarResultRanked, user } = resExtract.data;

    const resReady = await readyClanWar({ clanWarResultRanked, user });
    if (!resReady.ok) return { ok: false, message: "Player not in clan war result ranked" };

    await interaction.reply({ content: `You have been marked as ready!`, flags: [MessageFlags.Ephemeral] });

    if (arePlayersReadyClanWar({ clanWarResultRanked })) {
      discordService.deleteMessage({ channelId: clanWarResultRanked.textChannelDisplayResultId, messageId: clanWarResultRanked.messageReadyId });
      clanWarResultRanked.messageReadyId = null;

      discordService.unregisterButtonCallback(clanWarResultRanked.readyButtonId);
      clanWarResultRanked.readyButtonId = null;

      const resSendMessage = await discordService.sendMessage({
        channelId: clanWarResultRanked.textChannelDisplayResultId,
        ...(await discordMessageClanWarBanPickStep({ clanWarResultRanked })),
      });
      clanWarResultRanked.messageBanPickStepId = resSendMessage.data.message.id;

      await clanWarResultRanked.save();
    }
  } catch (error) {
    console.error(error);
  }
};

const voteBanPickStepButtonCallBack = async (interaction) => {
  try {
    const resUser = await findUserByInteraction(interaction);
    if (!resUser.ok) {
      interaction.reply({ content: resUser.message || "User not found", flags: [MessageFlags.Ephemeral] });
      return;
    }
    const resClanWarResultRanked = await findClanWarResultRankedByInteraction(interaction);
    if (!resClanWarResultRanked.ok) {
      interaction.reply({ content: resClanWarResultRanked.message || "Clan war result ranked not found", flags: [MessageFlags.Ephemeral] });
      return;
    }
    const resFindMap = await findMapByInteraction(interaction);
    if (!resFindMap.ok) {
      interaction.reply({ content: resFindMap.message || "Map not found", flags: [MessageFlags.Ephemeral] });
      return;
    }

    const { user } = resUser.data;
    const { clanWarResultRanked } = resClanWarResultRanked.data;
    const { map } = resFindMap.data;

    if (!clanWarResultRanked.clanStepId) {
      clanWarResultRanked.pendingMaps.forEach((m) => {
        if (m.mapId.toString() === map._id.toString()) {
          m.votedBy.filter((u) => u.toString() !== user._id.toString());
        }
      });

      const pendingMap = clanWarResultRanked.pendingMaps.find((m) => m.mapId.toString() === map._id.toString());
      pendingMap.votedBy.push(user._id);
      await clanWarResultRanked.save();
    } else {
      const resVoteBanPickStep = await voteBanPickStep({ user, clanWarResultRanked, map });
      if (!resVoteBanPickStep.ok) {
        interaction.reply({ content: resVoteBanPickStep.message || "Failed to vote for the map", flags: [MessageFlags.Ephemeral] });
        return;
      }
    }

    const resTryFindVotedMap = tryFindVotedMap({ clanWarResultRanked });
    if (!resTryFindVotedMap.ok) return resTryFindVotedMap;
    const { map: votedMap } = resTryFindVotedMap.data;
    if (!votedMap) return { ok: true };

    const action = clanWarResultRanked.banPickSteps[clanWarResultRanked.currentBanPickStep - 1];

    if (action === "PICK") {
      clanWarResultRanked.pickedMaps.push(votedMap);
    }
    if (action === "BAN") {
      clanWarResultRanked.bannedMaps.push(votedMap);
    }

    clanWarResultRanked.pendingMaps = clanWarResultRanked.pendingMaps.filter((m) => m.mapId.toString() !== votedMap._id.toString());
    clanWarResultRanked.clanStepId =
      clanWarResultRanked.clanStepId?.toString() === clanWarResultRanked.clanOneId?.toString()
        ? clanWarResultRanked.clanTwoId
        : clanWarResultRanked.clanOneId;
    clanWarResultRanked.clanStepName =
      clanWarResultRanked.clanStepId?.toString() === clanWarResultRanked.clanOneId?.toString()
        ? clanWarResultRanked.clanTwoName
        : clanWarResultRanked.clanOneName;
    clanWarResultRanked.currentBanPickStep++;

    await clanWarResultRanked.save();

    interaction.reply({ content: `You have voted for ${map.name} !`, flags: [MessageFlags.Ephemeral] });

    if (clanWarResultRanked.currentBanPickStep > clanWarResultRanked.maxStep) {
      await discordService.sendMessage({
        channelId: clanWarResultRanked.textChannelDisplayResultId,
        ...(await discordMessageClanWarBilanVotes({ clanWarResultRanked })),
      });

      const resSendMessage = await discordService.sendMessage({
        channelId: clanWarResultRanked.textChannelDisplayResultId,
        ...(await discordMessageClanWarOngoing({ clanWarResultRanked })),
      });
      clanWarResultRanked.messageResultId = resSendMessage.data.message.id;
      await clanWarResultRanked.save();

      await discordService.deleteMessage({
        channelId: clanWarResultRanked.textChannelDisplayResultId,
        messageId: clanWarResultRanked.messageBanPickStepId,
      });

      return;
    }

    const discordMessage = await discordMessageClanWarBanPickStep({ clanWarResultRanked });
    await discordService.updateMessage({
      channelId: clanWarResultRanked.textChannelDisplayResultId,
      messageId: clanWarResultRanked.messageBanPickStepId,
      ...discordMessage,
    });
    return;
  } catch (error) {
    console.log(error);
  }
};

const cancelResultRankedButtonCallBack = async (interaction) => {
  try {
    const resExtract = await findResultRankedByInteraction(interaction);
    if (!resExtract.ok) return resExtract;

    const { resultRanked, user } = resExtract.data;

    const resVoteCancel = await voteCancel({ resultRanked, user });
    if (!resVoteCancel.ok) return { ok: false, message: "Player not in result ranked" };

    interaction.reply({ content: `You have voted to cancel the game!`, flags: [MessageFlags.Ephemeral] });

    if (arePlayersVotedCancel({ resultRanked })) {
      resultRanked.hasBeenVoted = true;
      resultRanked.hasBeenVotedAt = new Date();

      resultRanked.hasBeenCanceled = true;

      await updateAllStatsResultRanked(resultRanked);

      await deleteResultRankedDiscord({ resultRanked });

      await discordService.sendMessage({
        channelId: resultRanked.textChannelDisplayFinalResultId,
        ...(await discordMessageResultRanked({ resultRanked })),
      });

      return;
    }

    const discordMessage = await discordMessageResultRanked({ resultRanked });
    await discordService.updateMessage({
      channelId: resultRanked.textChannelDisplayResultId,
      messageId: resultRanked.messageResultId,
      ...discordMessage,
    });
  } catch (error) {
    console.error(error);
  }
};

const voteRedResultRankedButtonCallBack = async (interaction) => {
  try {
    const resExtract = await findResultRankedByInteraction(interaction);
    if (!resExtract.ok) return resExtract;

    const { resultRanked, user } = resExtract.data;

    const resVoteRed = await voteRed({ resultRanked, user });
    if (!resVoteRed.ok) return { ok: false, message: "Player not in result ranked" };

    interaction.reply({ content: `You have voted for the red team!`, flags: [MessageFlags.Ephemeral] });

    if (arePlayersVotedRed({ resultRanked })) {
      resultRanked.hasBeenVoted = true;
      resultRanked.hasBeenVotedAt = new Date();

      resultRanked.redScore = 1000;
      resultRanked.blueScore = 0;

      await updateAllStatsResultRanked(resultRanked);
      await deleteResultRankedDiscord({ resultRanked });

      await discordService.sendMessage({
        channelId: resultRanked.textChannelDisplayFinalResultId,
        ...(await discordMessageResultRanked({ resultRanked })),
      });

      if (!resultRanked.clanWar) {
        const queue = await QueueModel.findById(resultRanked.queueId);
        if (queue && queue.textChannelDisplayClassementId) {
          await discordService.updateMessage({
            messageId: queue.messageClassementId,
            channelId: queue.textChannelDisplayClassementId,
            ...(await discordMessageClassement({ queue })),
          });
        }
      }

      if (resultRanked.clanWar) {
        const resHandleClanWar = await handleClanWarAfterVote({ resultRanked });
        if (!resHandleClanWar.ok) return resHandleClanWar;
        return;
      }

      return;
    }

    const discordMessage = await discordMessageResultRanked({ resultRanked });
    await discordService.updateMessage({
      channelId: resultRanked.textChannelDisplayResultId,
      messageId: resultRanked.messageResultId,
      ...discordMessage,
    });
  } catch (error) {
    console.error(error);
  }
};

const voteBlueResultRankedButtonCallBack = async (interaction) => {
  try {
    const resExtract = await findResultRankedByInteraction(interaction);
    if (!resExtract.ok) return resExtract;

    const { resultRanked, user } = resExtract.data;

    const resVoteBlue = await voteBlue({ resultRanked, user });
    if (!resVoteBlue.ok) return { ok: false, message: "Player not in result ranked" };

    interaction.reply({ content: `You have voted for the blue team!`, flags: [MessageFlags.Ephemeral] });

    if (arePlayersVotedBlue({ resultRanked })) {
      resultRanked.hasBeenVoted = true;
      resultRanked.hasBeenVotedAt = new Date();

      resultRanked.blueScore = 1000;
      resultRanked.redScore = 0;

      await updateAllStatsResultRanked(resultRanked);
      await deleteResultRankedDiscord({ resultRanked });

      await discordService.sendMessage({
        channelId: resultRanked.textChannelDisplayFinalResultId,
        ...(await discordMessageResultRanked({ resultRanked })),
      });

      if (!resultRanked.clanWar) {
        const queue = await QueueModel.findById(resultRanked.queueId);
        if (queue && queue.textChannelDisplayClassementId) {
          await discordService.updateMessage({
            messageId: queue.messageClassementId,
            channelId: queue.textChannelDisplayClassementId,
            ...(await discordMessageClassement({ queue })),
          });
        }
      }

      if (resultRanked.clanWar) {
        const resHandleClanWar = await handleClanWarAfterVote({ resultRanked });
        if (!resHandleClanWar.ok) return resHandleClanWar;
        return;
      }

      return;
    }

    const discordMessage = await discordMessageResultRanked({ resultRanked });
    await discordService.updateMessage({
      channelId: resultRanked.textChannelDisplayResultId,
      messageId: resultRanked.messageResultId,
      ...discordMessage,
    });
  } catch (error) {
    console.error(error);
  }
};

module.exports = {
  // Queue
  discordMessageQueue,
  discordPrivateMessageNewQueue,
  discordMessageClassement,

  // Result Ranked
  discordMessageResultRanked,
  discordMessageResultNotReady,

  handleClanWarAfterVote,

  // Callbacks
  readyButtonCallBack,
  readyButtonClanWarCallBack,

  joinQueueButtonCallBack,
  leaveQueueButtonCallBack,

  cancelResultRankedButtonCallBack,
  voteRedResultRankedButtonCallBack,
  voteBlueResultRankedButtonCallBack,
};
