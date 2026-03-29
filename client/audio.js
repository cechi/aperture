/**
 * Audio recording (microphone) and playback module.
 */
let mediaRecorder = null;
let audioChunks = [];
let audioContext = null;
let analyser = null;
let sourceNode = null;
let isRecording = false;

// Playback
let playbackContext = null;
let playbackAnalyser = null;
let currentSource = null;

/**
 * Initialize audio context (must be called from user gesture).
 */
function init() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (!playbackContext) {
    playbackContext = new (window.AudioContext || window.webkitAudioContext)();
    playbackAnalyser = playbackContext.createAnalyser();
    playbackAnalyser.fftSize = 256;
    playbackAnalyser.connect(playbackContext.destination);
  }
}

/**
 * Start recording from microphone.
 * Returns a promise that resolves when recording starts.
 */
async function startRecording() {
  init();
  audioChunks = [];

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // Set up analyser for recording visualization
  sourceNode = audioContext.createMediaStreamSource(stream);
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  sourceNode.connect(analyser);

  mediaRecorder = new MediaRecorder(stream, {
    mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm',
  });

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) audioChunks.push(e.data);
  };

  mediaRecorder.start(100); // collect in 100ms chunks
  isRecording = true;
}

/**
 * Stop recording and return audio blob.
 */
function stopRecording() {
  return new Promise((resolve) => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      resolve(null);
      return;
    }

    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      audioChunks = [];

      // Stop all tracks
      mediaRecorder.stream.getTracks().forEach((t) => t.stop());
      if (sourceNode) { sourceNode.disconnect(); sourceNode = null; }
      analyser = null;
      isRecording = false;

      resolve(blob);
    };

    mediaRecorder.stop();
  });
}

/**
 * Play audio buffer (MP3 from TTS).
 * Returns a promise that resolves when playback finishes.
 */
function playAudio(arrayBuffer) {
  init();
  return new Promise(async (resolve, reject) => {
    try {
      if (playbackContext.state === "suspended") await playbackContext.resume();
      const audioBuffer = await playbackContext.decodeAudioData(arrayBuffer.slice(0));
      currentSource = playbackContext.createBufferSource();
      currentSource.buffer = audioBuffer;
      currentSource.connect(playbackAnalyser);
      currentSource.onended = () => {
        currentSource = null;
        resolve();
      };
      currentSource.start(0);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Stop current playback.
 */
function stopPlayback() {
  if (currentSource) {
    try { currentSource.stop(); } catch {}
    currentSource = null;
  }
}

/**
 * Get current audio amplitude (0-1) for visualization.
 * Works for both recording input and playback output.
 */
function getAmplitude() {
  const activeAnalyser = isRecording ? analyser : playbackAnalyser;
  if (!activeAnalyser) return 0;

  const data = new Uint8Array(activeAnalyser.frequencyBinCount);
  activeAnalyser.getByteFrequencyData(data);

  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  return sum / (data.length * 255);
}

export const AudioManager = {
  init,
  startRecording,
  stopRecording,
  playAudio,
  stopPlayback,
  getAmplitude,
  get isRecording() { return isRecording; },
  get isPlaying() { return currentSource !== null; },
};
