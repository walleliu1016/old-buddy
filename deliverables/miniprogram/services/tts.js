// services/tts.js — 语音播报封装（原型阶段为占位，真实需接入微信同声传译/第三方 TTS 插件）
function speak(text) {
  if (!text) return;
  // 真机可在此调用 wx.createInnerAudioContext 播放 TTS 合成音频；
  // 原型仅做日志，配合“语音播报”开关演示交互。
  console.log("[TTS]", text);
}

module.exports = { speak };
