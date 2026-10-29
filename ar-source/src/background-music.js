// Unlock audio during a touch/click, but only start the loop after the entrance.
export function createBackgroundMusic() {
  let context;
  let buffer;
  let source;
  let wanted = false;
  let disposed = false;
  let loading;
  let recoveryTimer;
  let recoveryAttempts = 0;
  function recover() {
    if (disposed || !wanted || document.hidden || !context) return;
    window.clearTimeout(recoveryTimer);
    recoveryAttempts = 0;
    retryResume();
  }
  function retryResume() {
    if (disposed || !wanted || document.hidden || !context || context.state === 'closed') return;
    if (context.state === 'running') { playIfReady(); return; }
    if (recoveryAttempts++ >= 4) return;
    // Safari can interrupt playback while microphone permission/audio routing changes.
    // Resume the existing context/source, retaining the song position.
    void context.resume().then(playIfReady).catch(() => {});
    recoveryTimer = window.setTimeout(retryResume, 350);
  }
  function onAudioStateChange() {
    if (context?.state === 'running') {
      window.clearTimeout(recoveryTimer);
      playIfReady();
    } else if (wanted && !document.hidden) {
      window.clearTimeout(recoveryTimer);
      recoveryTimer = window.setTimeout(retryResume, 350);
    }
  }
  function playIfReady() {
    if (disposed || !wanted || !buffer || source || document.hidden || context?.state !== 'running') return;
    source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = context.createGain();
    gain.gain.value = 0.50;
    source.connect(gain).connect(context.destination);
    source.start();
  }
  function unlock() {
    if (disposed) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!context) {
      context = new AudioContext();
      context.addEventListener('statechange', onAudioStateChange);
    }
    recoveryAttempts = 0;
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
    window.clearTimeout(recoveryTimer);
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
  window.addEventListener('focus', recover);
  return {
    unlock,
    recover,
    start() { wanted = true; unlock(); },
    pause,
    dispose() {
      disposed = true;
      pause();
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('click', unlock);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('focus', recover);
      context?.removeEventListener('statechange', onAudioStateChange);
      void context?.close();
    },
  };
}
