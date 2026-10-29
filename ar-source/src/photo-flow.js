// Keep the audio-owning document alive while the existing game handles its flow.
export function openPhotoFlow(preview = false) {
  const frame = document.createElement('iframe');
  frame.src = `./game.html?from=ar${preview ? '&preview=1' : ''}`;
  frame.title = '精灵小游戏与合照';
  frame.allow = 'camera; microphone; autoplay; fullscreen';
  Object.assign(frame.style, {
    position: 'fixed', inset: '0', width: '100%', height: '100%',
    border: '0', zIndex: '1000', background: '#07120d',
  });
  document.body.appendChild(frame);
}
