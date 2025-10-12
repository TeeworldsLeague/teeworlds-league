const { Mutex } = require("../utils/mutex");
const discordService = require("./discordService");
const ResultRankedModel = require("../models/resultRanked");
const {
  discordMessageResultRankedNotReady,
  discordPrivateMessageNewQueue,
} = require("../utils/discordMessages");


const readyButtonCallBack = async (interaction) => {
  try {
    const resultRankedId = interaction.customId.split("_")[0];
    const resultRanked = await ResultRankedModel.findById(resultRankedId);
    if (!resultRanked) return { ok: false, message: "Game not found" };

    const user = await UserModel.findOne({ userName: interaction.member.displayName });
    if (!user) return { ok: false, message: "User not found" };

    const resReady = await ready({ resultRanked, user });
    if (!resReady.ok) return { ok: false, message: "Player not in result ranked" };

    await interaction.reply({ content: `You have been marked as ready!`, flags: [MessageFlags.Ephemeral] });

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

const cancelResultRankedButtonCallBack = async (interaction) => {
  try {
    const resultRankedId = interaction.customId.split("_")[0];
    const resultRanked = await ResultRankedModel.findById(resultRankedId);
    if (!resultRanked) return { ok: false, message: "Game not found" };

    const user = await UserModel.findOne({ discordId: interaction.member.id });
    if (!user) return { ok: false, message: "User not found" };

    const resVoteCancel = await voteCancel({ resultRanked, user });
    if (!resVoteCancel.ok) return { ok: false, message: "Player not in result ranked" };

    await interaction.reply({ content: `You have voted to cancel the game!`, flags: [MessageFlags.Ephemeral] });

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
    const resultRankedId = interaction.customId.split("_")[0];
    const resultRanked = await ResultRankedModel.findById(resultRankedId);
    if (!resultRanked) return { ok: false, message: "Game not found" };

    const user = await UserModel.findOne({ discordId: interaction.member.id });
    if (!user) return { ok: false, message: "User not found" };

    const resVoteRed = await voteRed({ resultRanked, user });
    if (!resVoteRed.ok) return { ok: false, message: "Player not in result ranked" };

    await interaction.reply({ content: `You have voted for the red team!`, flags: [MessageFlags.Ephemeral] });

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
    const resultRankedId = interaction.customId.split("_")[0];
    const resultRanked = await ResultRankedModel.findById(resultRankedId);
    if (!resultRanked) return { ok: false, message: "Game not found" };

    const user = await UserModel.findOne({ discordId: interaction.member.id });
    if (!user) return { ok: false, message: "User not found" };

    const resVoteBlue = await voteBlue({ resultRanked, user });
    if (!resVoteBlue.ok) return { ok: false, message: "Player not in result ranked" };

    await interaction.reply({ content: `You have voted for the blue team!`, flags: [MessageFlags.Ephemeral] });

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

class ResultRankedService {
  constructor() {
    this.mutex = new Mutex(); // TODO: not used yet
  }

  async createResultRanked({ queue, bluePlayersObj, redPlayersObj, map }) {
    const newResultRankedObj = {
      queueId: queue._id,
      numberFromQueue: queue.numberOfGames,
      queueName: queue.name,

      modeId: queue.modeId,
      modeName: queue.modeName,

      bluePlayers: bluePlayersObj,
      redPlayers: redPlayersObj,

      mode: queue.mode,
      map,

      guildId: queue.guildId,
      categoryQueueId: queue.categoryQueueId,
      textChannelDisplayFinalResultId: queue.textChannelDisplayResultsId,
    };

    const newResultRanked = await ResultRankedModel.create(newResultRankedObj);

    // Create Discord channels for the match
    const resCreateTextChannelDisplayResults = await discordService.createTextChannel({
      guildId: newResultRanked.guildId,
      name: "queue_" + newResultRanked.id.toString(),
      categoryId: newResultRanked.categoryQueueId,
    });
    newResultRanked.textChannelDisplayResultId = resCreateTextChannelDisplayResults.data.channel.id;

    const resCreateVoiceRedChannel = await discordService.createVoiceChannel({
      guildId: newResultRanked.guildId,
      name: "red_" + newResultRanked.id.toString(),
      categoryId: newResultRanked.categoryQueueId,
    });
    if (!resCreateVoiceRedChannel.ok) return { ok: false, message: "Failed to create voice channel" };
    newResultRanked.voiceRedChannelId = resCreateVoiceRedChannel.data.channel.id;

    const resCreateVoiceBlueChannel = await discordService.createVoiceChannel({
      guildId: newResultRanked.guildId,
      name: "blue_" + newResultRanked.id.toString(),
      categoryId: newResultRanked.categoryQueueId,
    });
    if (!resCreateVoiceBlueChannel.ok) return { ok: false, message: "Failed to create voice channel" };
    newResultRanked.voiceBlueChannelId = resCreateVoiceBlueChannel.data.channel.id;

    // Send ready message
    const discordMessage = await discordMessageResultRankedNotReady({ resultRanked: newResultRanked });
    const resSendMessageReady = await discordService.sendMessage({
      channelId: newResultRanked.textChannelDisplayResultId,
      ...discordMessage,
    });
    newResultRanked.messageReadyId = resSendMessageReady.data.message.id;

    await newResultRanked.save();

    // Notify all players
    for (const player of allRealPlayers) {
      if (!player.discordId) continue;
      const discordPrivateMessage = discordPrivateMessageNewQueue({ resultRanked });
      await discordService.sendPrivateMessage({
        userId: player.discordId,
        ...discordPrivateMessage,
      });
    }

    return { ok: true, data: newResultRanked };
  }

  async onStartup() {
    const resultRankeds = await ResultRankedModel.find({ freezed: false });
    for (const resultRanked of resultRankeds) {
      if (resultRanked.readyButtonId) discordService.registerButtonCallback(resultRanked.readyButtonId, readyButtonCallBack);
      if (resultRanked.voteCancelButtonId) discordService.registerButtonCallback(resultRanked.voteCancelButtonId, cancelResultRankedButtonCallBack);
      if (resultRanked.voteRedButtonId) discordService.registerButtonCallback(resultRanked.voteRedButtonId, voteRedResultRankedButtonCallBack);
      if (resultRanked.voteBlueButtonId)
        discordService.registerButtonCallback(resultRanked.voteBlueButtonId, voteBlueResultRankedButtonCallBack);
    }

    console.log("Callbacks for result ranked initialized");
  }

  async onShutdown() {
    // Cleanup logic can be added here in the future
    console.log("Result ranked service shutting down");
  }
}

const resultRankedService = new ResultRankedService();

module.exports = resultRankedService;
