/**
 * Aperture — GLaDOS Voice Interface
 * Main application logic: WebSocket client + UI coordination.
 */
import { AudioManager } from './audio.js';
import { GladosOrb } from './face.js';

// Token gate — redirect to login if missing
const token = sessionStorage.getItem('aperture_token');
if (!token) {
  window.location.href = '/login.html';
}

// DOM elements
const statusIcon = document.getElementById('status-icon');
const statusText = document.getElementById('status-text');
const transcriptMessages = document.getElementById('transcript-messages');
const btnMic = document.getElementById('btn-mic');
const textInput = document.getElementById('text-input');
const btnSend = document.getElementById('btn-send');
const orbContainer = document.getElementById('orb-container');

let ws = null;
let connected = false;
let pendingAlignment = null;
let animFrameId = null;

// Initialize Three.js face
GladosOrb.init(orbContainer);

// Connect WebSocket
connect();

// --- WebSocket ---

function connect() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}/?token=${encodeURIComponent(token)}`);
  ws.binaryType = 'arraybuffer';

  ws.onopen = () => {
    connected = true;
    setStatus('connected', 'Connected — Aperture Science GLaDOS Interface');
    btnMic.disabled = false;
  };

  ws.onclose = () => {
    connected = false;
    btnMic.disabled = true;
    setStatus('error', 'Disconnected — Reconnecting...');
    setTimeout(connect, 3000);
  };

  ws.onerror = () => {
    setStatus('error', 'Connection error');
  };

  ws.onmessage = async (event) => {
    if (event.data instanceof ArrayBuffer) {
      // Binary = TTS audio
      handleAudio(event.data);
      return;
    }
    if (event.data instanceof Blob) {
      // Blob = TTS audio (server sends Buffer which becomes Blob)
      const arrayBuffer = await event.data.arrayBuffer();
      handleAudio(arrayBuffer);
      return;
    }

    const msg = JSON.parse(event.data);
    switch (msg.type) {
      case 'ready':
        setStatus('connected', 'Ready — Awaiting input');
        break;
      case 'status':
        handleStatus(msg.status);
        break;
      case 'transcription':
        addMessage('user', msg.text);
        break;
      case 'response':
        addMessage('assistant', msg.text);
        break;
      case 'alignment':
        pendingAlignment = msg.alignment;
        break;
      case 'error':
      case 'tts_error':
        addMessage('error', msg.message);
        handleStatus('idle');
        break;
    }
  };
}

function send(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(data);
  }
}

// --- Status ---

function setStatus(state, text) {
  statusIcon.className = state;
  statusText.textContent = text;
}

function handleStatus(status) {
  switch (status) {
    case 'transcribing':
      setStatus('transcribing', 'Transcribing speech...');
      GladosOrb.setState('thinking');
      break;
    case 'thinking':
      setStatus('thinking', 'GLaDOS is thinking...');
      GladosOrb.setState('thinking');
      break;
    case 'speaking':
      setStatus('speaking', 'GLaDOS is speaking...');
      GladosOrb.setState('speaking');
      break;
    case 'idle':
      setStatus('connected', 'Ready — Awaiting input');
      GladosOrb.setState('idle');
      GladosOrb.setAmplitude(0);
      break;
  }
}

// --- Audio handling ---

async function handleAudio(arrayBuffer) {
  GladosOrb.setState('speaking');

  try {
    const playPromise = AudioManager.playAudio(arrayBuffer);
    startAmplitudeTracking();
    await playPromise;
  } catch (err) {
    console.error('Audio playback failed:', err);
    addMessage('error', 'Audio playback failed');
  }

  stopAmplitudeTracking();
  GladosOrb.setState('idle');
  GladosOrb.setAmplitude(0);
}

function startAmplitudeTracking() {
  stopAmplitudeTracking();
  function track() {
    const amp = AudioManager.getAmplitude();
    GladosOrb.setAmplitude(amp);
    animFrameId = requestAnimationFrame(track);
  }
  track();
}

function stopAmplitudeTracking() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}

// --- Recording (push-to-talk) ---

let recording = false;

btnMic.addEventListener('mousedown', startRecording);
btnMic.addEventListener('touchstart', (e) => { e.preventDefault(); startRecording(); });
document.addEventListener('mouseup', stopRecordingIfActive);
document.addEventListener('touchend', stopRecordingIfActive);

async function startRecording() {
  if (!connected || recording) return;

  AudioManager.init();
  try {
    await AudioManager.startRecording();
    recording = true;
    btnMic.classList.add('recording');
    GladosOrb.setState('recording');

    // Track mic amplitude
    startAmplitudeTracking();
  } catch (err) {
    console.error('Could not start recording:', err);
    addMessage('error', 'Microphone access denied');
  }
}

async function stopRecordingIfActive() {
  if (!recording) return;
  recording = false;
  btnMic.classList.remove('recording');
  stopAmplitudeTracking();
  GladosOrb.setState('idle');
  GladosOrb.setAmplitude(0);

  const blob = await AudioManager.stopRecording();
  if (blob && blob.size > 0) {
    const buffer = await blob.arrayBuffer();
    send(buffer);
  }
}

// --- Text input ---

textInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendText();
  }
});

btnSend.addEventListener('click', sendText);

function sendText() {
  const text = textInput.value.trim();
  if (!text || !connected) return;

  addMessage('user', text);
  send(JSON.stringify({ type: 'text', text }));
  textInput.value = '';
}

// --- Transcript ---

function addMessage(role, text) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.textContent = text;
  transcriptMessages.appendChild(div);
  transcriptMessages.scrollTop = transcriptMessages.scrollHeight;

  // Keep last 50 messages visible
  while (transcriptMessages.children.length > 50) {
    transcriptMessages.removeChild(transcriptMessages.firstChild);
  }
}
