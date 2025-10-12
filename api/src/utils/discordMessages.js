const { EmbedBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const discordService = require("../services/discordService");
const queueService = require("../services/queueService");
const ResultRankedModel = require("../models/resultRanked");
const UserModel = require("../models/user");
const {
  ready,
  arePlayersReady,
  voteCancel,
  voteRed,
  voteBlue,
  updateAllStatsResultRanked,
  arePlayersVotedRed,
  deleteResultRankedDiscord,
  arePlayersVotedBlue,
  arePlayersVotedCancel,
} = require("./resultRanked");
const QueueModel = require("../models/queue");

const discordMessageQueue = async ({ queue }) => {
  const joinButtonId = `${queue._id}_join_queue`;
  const joinQueueButton = createButton({ customId: joinButtonId, label: "Join Queue", style: ButtonStyle.Success });

  const leaveButtonId = `${queue._id}_leave_queue`;
  const leaveQueueButton = createButton({ customId: leaveButtonId, label: "Leave Queue", style: ButtonStyle.Danger });

  const embed = new EmbedBuilder()
    .setTitle(queue.name)
    .setColor(0x0099ff)
    .addFields(
      {
        name: "Maps",
        value: queue.maps.join(", "),
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
    )
    .setTimestamp();

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
        value: resultRanked.freezed ? `**${winner} won**\n${resultRanked.redScore} - ${resultRanked.blueScore}` : resultRanked.map,
        inline: resultRanked.freezed ? false : true,
      },
      {
        name: resultRanked.freezed ? "🗺️ Map" : "🔴 Red Team",
        value: resultRanked.freezed ? `**${resultRanked.map}**` : redPlayersFormatted,
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
      createButton({ customId: voteCancelButtonId, label: "Vote Cancel", style: ButtonStyle.Secondary }),
    ];

    discordService.registerButtonCallback(voteRedButtonId, voteRedResultRankedButtonCallBack);
    discordService.registerButtonCallback(voteBlueButtonId, voteBlueResultRankedButtonCallBack);
    discordService.registerButtonCallback(voteCancelButtonId, cancelResultRankedButtonCallBack);

    resultRanked.voteCancelButtonId = voteCancelButtonId;
    resultRanked.voteRedButtonId = voteRedButtonId;
    resultRanked.voteBlueButtonId = voteBlueButtonId;

    await resultRanked.save();

    const redVoteField = formatRedVotes({ resultRanked });
    const blueVoteField = formatBlueVotes({ resultRanked });
    const cancelVoteField = formatCancelVotes({ resultRanked });

    embed.addFields(redVoteField);
    embed.addFields(blueVoteField);
    embed.addFields(cancelVoteField);
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
        value: `**${resultRanked.map}**`,
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
        value: `**${resultRanked.map}**`,
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
        value: `**${resultRanked.map}**`,
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

const discordMessageResultRankedNotReady = async ({ resultRanked }) => {
  const readyButtonId = `${resultRanked._id}_ready`;
  const readyButton = createButton({ customId: readyButtonId, label: "Ready", style: ButtonStyle.Success });
  const allPlayers = [...resultRanked.redPlayers, ...resultRanked.bluePlayers];

  resultRanked.readyButtonId = readyButtonId;
  await resultRanked.save();

  discordService.registerButtonCallback(readyButtonId, readyButtonCallBack);

  const embed = new EmbedBuilder()
    .setTitle(getGameStatus({ resultRanked }))
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

const discordPrivateMessageNewQueue = ({ resultRanked }) => {
  const embed = new EmbedBuilder()
    .setTitle("Game found : " + resultRanked.queueName)
    .setColor(0x0099ff)
    .addFields({
      name: "📢 Join the game channel",
      value: `[Game channel to get ready !](https://discord.com/channels/${resultRanked.guildId}/${resultRanked.textChannelDisplayResultId}`,
      inline: false,
    })
    .setTimestamp();

  return {
    embed: embed,
    message: "New game found!",
  };
};

const getGameStatus = ({ resultRanked }) => {
  if (resultRanked.freezed) {
    return "Match Completed 🏆";
  } else if (resultRanked.blueScore > 0 || resultRanked.redScore > 0) {
    return "Match In Progress 🏆";
  } else {
    return "Match Starting 🏆";
  }
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

// CALLBACKS


module.exports = {
  // Queue
  discordMessageQueue,
  discordPrivateMessageNewQueue,

  // Result Ranked
  discordMessageResultRanked,
  discordMessageResultRankedNotReady,
};
