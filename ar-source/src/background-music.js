// Unlock audio during a touch/click, but only start the loop after the entrance.
export function createBackgroundMusic() {
  let context;
  let buffer;
  let source;
  let wanted = false;
  let disposed = false;
  let loading;
  function playIfReady() {
    if (disposed || !wanted || !buffer || source || document.hidden || context?.state !== 'running') return;
    source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = context.createGain();
    gain.gain.value = 0.25;
    source.connect(gain).connect(context.destination);
    source.start();
  }
  function unlock() {
    if (disposed) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    context ||= new AudioContext();
    void context.resume().then(playIfReady).catch(() => {});
    loading ||= fetch(`${import.meta.env.BASE_URL}audio/8bit-bossa.mp3`)
      .then(response => {
        if (!response.ok) throw new Error(`Music HTTP ${response.status}`);
        return response.arrayBuffer();
      })
      .then(bytes => context.decodeAudioData(bytes))
      .then(decoded => { buffer = decoded; playIfReady(); })
      .catch(error => { loading = null; console.warn('[Music]', error); });
  }
  function pause() {
    wanted = false;
    source?.stop();
    source?.disconnect();
    source = null;
  }
  function visibility() {
    if (document.hidden) void context?.suspend();
    else if (wanted) unlock();
  }
  document.addEventListener('pointerdown', unlock);
  document.addEventListener('click', unlock);
  document.addEventListener('visibilitychange', visibility);
  return {
    unlock,
    start() { wanted = true; unlock(); },
    pause,
    dispose() {
      disposed = true;
      pause();
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('click', unlock);
      document.removeEventListener('visibilitychange', visibility);
      void context?.close();
    },
  };
}
