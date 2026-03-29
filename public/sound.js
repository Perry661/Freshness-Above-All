(function initFreshTrackerSound(global) {
  const SOUND_FILES = {
    add: './FAA-sound/addFood.mp3',
    delete: './FAA-sound/deleteFood.mp3',
    click: './FAA-sound/click.mp3'
  };

  const SOUND_GAIN = {
    add: 1.5,
    delete: 1,
    click: 1
  };

  const AudioContextCtor = global.AudioContext || global.webkitAudioContext;
  let audioContext = null;
  const bufferCache = new Map();
  let volumePercent = 100;

  function getAudioContext() {
    if (!AudioContextCtor) {
      return null;
    }

    if (!audioContext) {
      audioContext = new AudioContextCtor();
    }

    return audioContext;
  }

  function clampVolume(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return 100;
    }

    return Math.min(200, Math.max(0, Math.round(numeric)));
  }

  function getLinearGain(name) {
    return (volumePercent / 100) * (SOUND_GAIN[name] || 1);
  }

  async function loadBuffer(name) {
    const ctx = getAudioContext();
    if (!ctx) {
      return null;
    }

    if (!bufferCache.has(name)) {
      const promise = fetch(SOUND_FILES[name])
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to load sound: ${name}`);
          }
          return response.arrayBuffer();
        })
        .then((arrayBuffer) => ctx.decodeAudioData(arrayBuffer.slice(0)));

      bufferCache.set(name, promise);
    }

    return bufferCache.get(name);
  }

  function playFallback(name) {
    const audio = new Audio(SOUND_FILES[name]);
    audio.preload = 'auto';
    audio.volume = Math.min(1, getLinearGain(name));
    const playback = audio.play();
    if (playback && typeof playback.catch === 'function') {
      playback.catch(() => {});
    }
  }

  async function playBufferedSound(name) {
    const ctx = getAudioContext();
    if (!ctx) {
      playFallback(name);
      return;
    }

    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const buffer = await loadBuffer(name);
      if (!buffer) {
        playFallback(name);
        return;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const gainNode = ctx.createGain();
      gainNode.gain.value = getLinearGain(name);

      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start(0);
    } catch {
      playFallback(name);
    }
  }

  function setVolume(nextVolume) {
    volumePercent = clampVolume(nextVolume);
  }

  global.FreshTrackerSound = {
    setVolume,
    getVolume() {
      return volumePercent;
    },
    playAddSound() {
      void playBufferedSound('add');
    },
    playDeleteSound() {
      void playBufferedSound('delete');
    },
    playClickSound() {
      void playBufferedSound('click');
    }
  };
})(window);
