// The sound engine. It plays looping note files and adds the live parts:
// fade in and out, the glide between notes, vibrato, volume and tone.
//
// The engine is told, as often as the caller likes, what each touch should
// sound like right now (setTouch). It works out what has to change. If the
// sound cannot start yet (files still loading, or the browser has not
// allowed audio), it does nothing and the caller simply asks again.
//
// Sound path of one touch:
//   note file (looping) -> note gain (glide) -> tone filter -> press gain
//   -> fade gain (attack, release) -> master -> speakers
// A touch can sound a second note file with the first; both share the path
// from the tone filter on.
// A slow oscillator bends the playback speed of the note files for vibrato.
import { noteFile } from './scales.js';
import { toneToHz, centsToRate } from './expression.js';

export function createSoundEngine({ basePath, settings, meter }) {
  const AudioContextClass =
    typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;

  const OfflineContextClass =
    typeof window !== 'undefined'
      ? window.OfflineAudioContext || window.webkitOfflineAudioContext
      : null;

  let context = null; // the live sound output; made on the first touch
  let decoder = null; // decodes note files; needs no touch
  let master = null;
  let analyser = null;
  let lastError = null;
  const buffers = new Map(); // note file address -> decoded sound
  const loading = new Map(); // note file address -> promise
  const voices = new Map(); // touch id -> the sound of that touch
  let song = null; // the notes being sung by sing(), if any

  function ensureContext() {
    if (context || !AudioContextClass) return context;
    try {
      // The note files are 44.1 kHz; ask for the same rate.
      context = new AudioContextClass({ sampleRate: 44100, latencyHint: 'interactive' });
    } catch (error) {
      context = new AudioContextClass();
    }
    master = context.createGain();
    master.gain.value = settings.masterGain;
    master.connect(context.destination);
    if (meter) {
      analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      master.connect(analyser);
    }
    return context;
  }

  // Browsers only allow sound after the user has touched the page, so the
  // sound output is made and started here. Call this from inside a touch or
  // click handler; calling it again is harmless.
  function unlock() {
    if (!ensureContext()) return;
    if (context.state === 'running') return;
    try {
      const resumed = context.resume();
      if (resumed && resumed.catch) resumed.catch(() => {});
    } catch (error) {
      lastError = String(error);
    }
    // Older iPhones also need a sound to be started inside the handler.
    try {
      const silence = context.createBufferSource();
      silence.buffer = context.createBuffer(1, 1, context.sampleRate);
      silence.connect(context.destination);
      silence.start(0);
    } catch (error) {
      // Not needed on browsers where this fails.
    }
  }

  // Note files are decoded by a context that makes no sound, so they can be
  // ready before the first touch. Where a browser lacks it, the live output
  // decodes them once it exists.
  function ensureDecoder() {
    if (decoder) return decoder;
    if (OfflineContextClass) {
      try {
        decoder = new OfflineContextClass(1, 1, 44100);
      } catch (error) {
        decoder = null;
      }
    }
    return decoder || ensureContext();
  }

  function decode(data) {
    return new Promise((resolve, reject) => {
      // The callback form works on every browser, old iPhones included.
      ensureDecoder().decodeAudioData(data, resolve, reject);
    });
  }

  function loadOne(address) {
    if (buffers.has(address)) return Promise.resolve();
    if (loading.has(address)) return loading.get(address);
    const promise = fetch(address)
      .then((response) => {
        if (!response.ok) throw new Error(`${address}: ${response.status}`);
        return response.arrayBuffer();
      })
      .then(decode)
      .then((buffer) => {
        buffers.set(address, buffer);
        loading.delete(address);
      })
      .catch((error) => {
        loading.delete(address);
        lastError = String(error);
        throw error;
      });
    loading.set(address, promise);
    return promise;
  }

  // Fetch and decode the note files of one voice in one register.
  function load(voice, register, notes) {
    if (!AudioContextClass) return Promise.reject(new Error('this browser has no Web Audio'));
    return Promise.all(notes.map((note) => loadOne(noteFile(basePath, voice, register, note))));
  }

  // Move a setting towards a value smoothly. Skipped when the value has not
  // changed, so a caller may ask sixty times a second.
  function aim(voice, name, param, value, seconds, now) {
    const last = voice.aims[name];
    if (last !== undefined && Math.abs(last - value) <= Math.abs(value) * 1e-4) return;
    voice.aims[name] = value;
    param.setTargetAtTime(value, now, seconds);
  }

  // One looping note file feeding a touch's sound, at a level of its own.
  function startSource(voice, buffer, now, startLevel) {
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = context.createGain();
    gain.gain.setValueAtTime(startLevel, now);
    source.connect(gain);
    gain.connect(voice.filter);
    try {
      voice.vibratoDepth.connect(source.playbackRate);
    } catch (error) {
      // A browser that cannot bend the playback speed plays without vibrato.
      lastError = `vibrato: ${error}`;
    }
    source.onended = () => {
      try {
        gain.disconnect();
      } catch (error) {
        // Already disconnected.
      }
    };
    source.start(now);
    return { source, gain };
  }

  // A touch's sound has two layers: the note itself ("main") and, where the
  // surface asks for one, a second note sounding with it ("second"). Set
  // what a layer plays: a note file's address and buffer at a level, or
  // null for nothing. A change glides: the new note fades in while the old
  // one fades out.
  function setLayer(voice, name, address, buffer, level, now, atStart) {
    const layer = voice.layers[name];
    const seconds = settings.glideSeconds / 3;
    if (layer.address === address) {
      if (layer.current && Math.abs(layer.level - level) > 1e-4) {
        layer.level = level;
        layer.current.gain.gain.setTargetAtTime(level, now, seconds);
      }
      return;
    }
    if (layer.current) {
      layer.current.gain.gain.setTargetAtTime(0, now, seconds);
      layer.current.source.stop(now + settings.glideSeconds * 3);
      layer.current = null;
    }
    layer.address = address;
    layer.level = level;
    if (!address) return;
    // At the very start of a touch the touch's own fade-in is the attack.
    layer.current = startSource(voice, buffer, now, atStart ? level : 0);
    if (!atStart) layer.current.gain.gain.setTargetAtTime(level, now, seconds);
  }

  function startVoice(wanted, now) {
    const voice = {
      aims: {},
      layers: {
        main: { address: null, current: null, level: 1 },
        second: { address: null, current: null, level: 0 },
      },
    };

    voice.filter = context.createBiquadFilter();
    voice.filter.type = 'lowpass';
    voice.filter.Q.value = 0.7;
    voice.filter.frequency.setValueAtTime(toneToHz(wanted.tone, settings.tone), now);

    voice.press = context.createGain();
    voice.press.gain.setValueAtTime(wanted.gain, now);

    voice.fade = context.createGain();
    voice.fade.gain.setValueAtTime(0, now);
    voice.fade.gain.setTargetAtTime(1, now, settings.attackSeconds);

    voice.vibrato = context.createOscillator();
    voice.vibrato.type = 'sine';
    voice.vibrato.frequency.value = settings.vibrato.rateHz;
    voice.vibratoDepth = context.createGain();
    voice.vibratoDepth.gain.setValueAtTime(0, now);
    voice.vibrato.connect(voice.vibratoDepth);
    voice.vibrato.start(now);

    voice.filter.connect(voice.press);
    voice.press.connect(voice.fade);
    voice.fade.connect(master);
    return voice;
  }

  function release(voice) {
    const now = context.currentTime;
    const end = now + settings.releaseSeconds * 8;
    voice.fade.gain.setTargetAtTime(0, now, settings.releaseSeconds);
    voice.vibrato.onended = () => {
      try {
        voice.fade.disconnect();
      } catch (error) {
        // Already disconnected.
      }
    };
    const sounding = [voice.vibrato];
    for (const name of ['main', 'second']) {
      if (voice.layers[name].current) sounding.push(voice.layers[name].current.source);
    }
    for (const node of sounding) {
      try {
        node.stop(end);
      } catch (error) {
        // Already stopped.
      }
    }
  }

  // Say what one touch should sound like now. `wanted` is null for silence,
  // or { voice, register, note, gain, tone, vibratoCents } and, for a second
  // note sounding with the first, second: { register, note, level }.
  function setTouch(id, wanted) {
    const voice = voices.get(id);
    if (!wanted) {
      if (voice) {
        voices.delete(id);
        release(voice);
      }
      return;
    }
    if (!context || context.state !== 'running') return;
    const address = noteFile(basePath, wanted.voice, wanted.register, wanted.note);
    const buffer = buffers.get(address);
    if (!buffer) return;

    const now = context.currentTime;
    let live = voice;
    const atStart = !live;
    if (atStart) {
      live = startVoice(wanted, now);
      voices.set(id, live);
    }
    setLayer(live, 'main', address, buffer, 1, now, atStart);

    // The second note, if its file is here; without it the first plays alone.
    let secondAddress = null;
    let secondBuffer = null;
    if (wanted.second) {
      secondAddress = noteFile(basePath, wanted.voice, wanted.second.register, wanted.second.note);
      secondBuffer = buffers.get(secondAddress);
      if (!secondBuffer) secondAddress = null;
    }
    setLayer(live, 'second', secondAddress, secondBuffer, wanted.second ? wanted.second.level : 0, now, atStart);

    const toneHz = toneToHz(wanted.tone, settings.tone);
    aim(live, 'press', live.press.gain, wanted.gain, settings.press.smoothingSeconds, now);
    aim(live, 'tone', live.filter.frequency, toneHz, settings.tone.smoothingSeconds, now);
    aim(live, 'vibrato', live.vibratoDepth.gain, centsToRate(wanted.vibratoCents), 0.03, now);
  }

  function stopSong() {
    if (!song) return;
    const now = context.currentTime;
    song.fade.gain.cancelScheduledValues(now);
    song.fade.gain.setTargetAtTime(0, now, 0.02);
    for (const source of song.sources) {
      try {
        source.stop(now + 0.2);
      } catch (error) {
        // Already stopped.
      }
    }
    song = null;
  }

  // Sing a few notes without a touch: the sound that answers a tuning
  // gesture. `notes` is a list of { voice, register, note }, sung one after
  // the other, `stepSeconds` apart, gliding from each to the next; the last
  // one holds for `holdSeconds` and fades away softly. Answers false if it
  // cannot sing yet (files still loading, or no sound allowed).
  function sing(notes, { gain, tone, stepSeconds, holdSeconds, fadeSeconds }) {
    if (!context || context.state !== 'running') return false;
    const found = notes.map((note) =>
      buffers.get(noteFile(basePath, note.voice, note.register, note.note)),
    );
    if (found.length === 0 || found.some((buffer) => !buffer)) return false;
    stopSong();

    const start = context.currentTime + 0.02;
    const end = start + (found.length - 1) * stepSeconds + holdSeconds;
    const glide = settings.glideSeconds / 3;

    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.7;
    filter.frequency.value = toneToHz(tone, settings.tone);
    const fade = context.createGain();
    fade.gain.setValueAtTime(0, start);
    fade.gain.setTargetAtTime(gain, start, settings.attackSeconds);
    fade.gain.setTargetAtTime(0, end, fadeSeconds / 3);
    filter.connect(fade);
    fade.connect(master);

    const sources = found.map((buffer, index) => {
      const begins = start + index * stepSeconds;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const level = context.createGain();
      level.gain.setValueAtTime(index === 0 ? 1 : 0, start);
      if (index > 0) level.gain.setTargetAtTime(1, begins, glide);
      if (index < found.length - 1) level.gain.setTargetAtTime(0, begins + stepSeconds, glide);
      source.connect(level);
      level.connect(filter);
      source.start(begins);
      source.stop(end + fadeSeconds * 3);
      return source;
    });
    const mine = { fade, sources };
    sources[sources.length - 1].onended = () => {
      try {
        fade.disconnect();
      } catch (error) {
        // Already disconnected.
      }
      if (song === mine) song = null;
    };
    song = mine;
    return true;
  }

  // Silence everything: used when the page is hidden or loses the touches,
  // so no note can be left sounding.
  function stopAll() {
    for (const id of Array.from(voices.keys())) setTouch(id, null);
    if (context) stopSong();
  }

  // The loudness of what is playing, 0 for silence. Only with `meter`.
  function level() {
    if (!analyser) return 0;
    const samples = new Float32Array(analyser.fftSize);
    if (analyser.getFloatTimeDomainData) {
      analyser.getFloatTimeDomainData(samples);
    } else {
      const bytes = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(bytes);
      for (let i = 0; i < bytes.length; i += 1) samples[i] = (bytes[i] - 128) / 128;
    }
    let sum = 0;
    for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i];
    return Math.sqrt(sum / samples.length);
  }

  function status() {
    return {
      audio: context ? context.state : 'none',
      sampleRate: context ? context.sampleRate : 0,
      loaded: buffers.size,
      loading: loading.size,
      sounding: Array.from(voices.values()).map((voice) => voice.layers.main.address),
      harmony: Array.from(voices.values())
        .map((voice) => voice.layers.second.address)
        .filter((address) => address !== null),
      singing: song !== null,
      error: lastError,
    };
  }

  return { unlock, load, setTouch, sing, stopAll, level, status };
}
