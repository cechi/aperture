const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;

/**
 * Speech-to-text using ElevenLabs STT API.
 * Accepts raw audio buffer, returns transcribed text.
 */
async function speechToText(audioBuffer) {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY not configured');
  }

  const formData = new FormData();
  formData.append('file', new Blob([audioBuffer], { type: 'audio/webm' }), 'audio.webm');
  formData.append('model_id', 'scribe_v1');
  formData.append('language_code', 'cs');

  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
    },
    body: formData,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElevenLabs STT error ${res.status}: ${body}`);
  }

  const result = await res.json();
  return result.text || '';
}

/**
 * Text-to-speech using ElevenLabs TTS API with streaming.
 * Returns { audio: Buffer, alignment: object } with phoneme timing data.
 */
async function textToSpeech(text) {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY not configured');
  }

  if (!ELEVENLABS_VOICE_ID) {
    throw new Error('ELEVENLABS_VOICE_ID not configured');
  }

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/with-timestamps`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        output_format: 'mp3_44100_128',
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElevenLabs TTS error ${res.status}: ${body}`);
  }

  const result = await res.json();

  // Collect all audio chunks and alignment data
  const audioChunks = [];
  const alignmentChars = [];
  const alignmentStarts = [];
  const alignmentEnds = [];

  if (result.audio_base64) {
    audioChunks.push(Buffer.from(result.audio_base64, 'base64'));
    if (result.alignment) {
      alignmentChars.push(...(result.alignment.characters || []));
      alignmentStarts.push(...(result.alignment.character_start_times_seconds || []));
      alignmentEnds.push(...(result.alignment.character_end_times_seconds || []));
    }
  }

  return {
    audio: Buffer.concat(audioChunks),
    alignment: {
      characters: alignmentChars,
      charStartTimes: alignmentStarts,
      charEndTimes: alignmentEnds,
    },
  };
}

module.exports = { speechToText, textToSpeech };
