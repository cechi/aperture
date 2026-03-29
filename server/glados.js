const { speechToText, textToSpeech } = require('./elevenlabs');
const { addMessage } = require('./session');

const OPENCLAW_URL = process.env.OPENCLAW_URL || 'http://192.168.50.221:18789/v1/chat/completions';
const OPENCLAW_API_KEY = process.env.OPENCLAW_API_KEY;

/**
 * Handle incoming WebSocket message (audio or text).
 */
async function handleMessage(ws, session, msg) {
  let userText;

  if (msg.type === 'audio') {
    // Transcribe audio via ElevenLabs STT
    ws.send(JSON.stringify({ type: 'status', status: 'transcribing' }));
    try {
      userText = await speechToText(msg.data);
    } catch (err) {
      console.error('[STT] Failed:', err.message);
      ws.send(JSON.stringify({ type: 'error', message: 'Speech-to-text failed. Try typing instead.' }));
      return;
    }

    if (!userText || !userText.trim()) {
      ws.send(JSON.stringify({ type: 'status', status: 'idle' }));
      return;
    }

    // Send transcription back to client
    ws.send(JSON.stringify({ type: 'transcription', text: userText }));
  } else if (msg.type === 'text') {
    userText = msg.text;
  } else {
    return;
  }

  // Add user message to session
  addMessage(session, 'user', userText);

  // Get AI response
  ws.send(JSON.stringify({ type: 'status', status: 'thinking' }));
  let aiText;
  try {
    aiText = await chatCompletion(session.messages);
  } catch (err) {
    console.error('[AI] Failed:', err.message);
    ws.send(JSON.stringify({ type: 'error', message: 'AI request failed.' }));
    return;
  }

  addMessage(session, 'assistant', aiText);
  ws.send(JSON.stringify({ type: 'response', text: aiText }));

  // Generate TTS audio
  ws.send(JSON.stringify({ type: 'status', status: 'speaking' }));
  try {
    const { audio, alignment } = await textToSpeech(aiText);

    // Send alignment data first, then audio
    ws.send(JSON.stringify({ type: 'alignment', alignment }));
    ws.send(audio);
  } catch (err) {
    console.error('[TTS] Failed:', err.message);
    // Text response already sent, just notify about TTS failure
    ws.send(JSON.stringify({ type: 'tts_error', message: 'Voice synthesis failed. Text response is shown above.' }));
  }

  ws.send(JSON.stringify({ type: 'status', status: 'idle' }));
}

/**
 * Call OpenClaw gateway for chat completion.
 */
async function chatCompletion(messages) {
  const res = await fetch(OPENCLAW_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENCLAW_API_KEY}`,
    },
    body: JSON.stringify({
      messages,
      max_tokens: 512,
      temperature: 0.8,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenClaw error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || 'I seem to have encountered an error. How disappointing.';
}

module.exports = { handleMessage };
