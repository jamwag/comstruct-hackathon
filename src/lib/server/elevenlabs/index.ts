import { env } from '$env/dynamic/private';

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

/**
 * Get the ElevenLabs API key from environment
 */
function getApiKey(): string {
	const apiKey = env.ELEVENLABS_API_KEY;
	if (!apiKey) {
		throw new Error('ELEVENLABS_API_KEY is not set');
	}
	return apiKey;
}

/**
 * Get the voice ID for TTS (defaults to a natural-sounding voice)
 */
function getVoiceId(): string {
	return env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'; // Sarah - natural conversational voice
}

export interface TTSOptions {
	text: string;
	voiceId?: string;
	modelId?: string;
	stability?: number;
	similarityBoost?: number;
}

/**
 * Convert text to speech using ElevenLabs API
 * Uses eleven_flash_v2_5 by default - fastest model (~75ms), 32 languages, 0.5 credits/char
 * Docs: https://elevenlabs.io/docs/models
 * Returns an audio stream (MP3)
 */
export async function textToSpeech(options: TTSOptions): Promise<ArrayBuffer> {
	const apiKey = getApiKey();
	const voiceId = options.voiceId || getVoiceId();

	const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`, {
		method: 'POST',
		headers: {
			'xi-api-key': apiKey,
			'Content-Type': 'application/json',
			Accept: 'audio/mpeg'
		},
		body: JSON.stringify({
			text: options.text,
			model_id: options.modelId || 'eleven_flash_v2_5',
			voice_settings: {
				stability: options.stability ?? 0.5,
				similarity_boost: options.similarityBoost ?? 0.75
			}
		})
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.error('ElevenLabs TTS error:', errorText);
		throw new Error(`ElevenLabs TTS failed: ${response.status} ${response.statusText}`);
	}

	return response.arrayBuffer();
}

/**
 * Stream text to speech using ElevenLabs API
 * Uses eleven_flash_v2_5 by default - fastest model (~75ms latency)
 * Returns a readable stream for real-time audio playback
 */
export async function textToSpeechStream(options: TTSOptions): Promise<ReadableStream<Uint8Array>> {
	const apiKey = getApiKey();
	const voiceId = options.voiceId || getVoiceId();

	const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceId}/stream`, {
		method: 'POST',
		headers: {
			'xi-api-key': apiKey,
			'Content-Type': 'application/json',
			Accept: 'audio/mpeg'
		},
		body: JSON.stringify({
			text: options.text,
			model_id: options.modelId || 'eleven_flash_v2_5',
			voice_settings: {
				stability: options.stability ?? 0.5,
				similarity_boost: options.similarityBoost ?? 0.75
			}
		})
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.error('ElevenLabs TTS stream error:', errorText);
		throw new Error(`ElevenLabs TTS stream failed: ${response.status} ${response.statusText}`);
	}

	if (!response.body) {
		throw new Error('No response body from ElevenLabs');
	}

	return response.body;
}

export interface STTOptions {
	audioBuffer: ArrayBuffer;
	languageCode?: string;
}

/**
 * Convert speech to text using ElevenLabs Scribe API
 * Uses scribe_v1 model - 96.7% accuracy for English, 99 languages supported
 * Pricing: ~$0.40/hour of audio
 * Docs: https://elevenlabs.io/docs/capabilities/speech-to-text
 */
export async function speechToText(options: STTOptions): Promise<string> {
	const apiKey = getApiKey();

	// Create form data with the audio file
	const formData = new FormData();
	const audioBlob = new Blob([options.audioBuffer], { type: 'audio/webm' });
	formData.append('file', audioBlob, 'audio.webm');

	// Use Scribe v1 - ElevenLabs' most accurate STT model (required field)
	formData.append('model_id', 'scribe_v1');

	if (options.languageCode) {
		formData.append('language_code', options.languageCode);
	}

	const response = await fetch(`${ELEVENLABS_API_URL}/speech-to-text`, {
		method: 'POST',
		headers: {
			'xi-api-key': apiKey
		},
		body: formData
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.error('ElevenLabs STT error:', errorText);
		throw new Error(`ElevenLabs STT failed: ${response.status} ${response.statusText}`);
	}

	const result = (await response.json()) as { text: string };
	return result.text;
}

/**
 * Get WebSocket URL for streaming speech-to-text
 * This is for real-time transcription during recording
 */
export function getSTTWebSocketUrl(): string {
	const apiKey = getApiKey();
	return `wss://api.elevenlabs.io/v1/speech-to-text/websocket?xi-api-key=${apiKey}`;
}

/**
 * Check if ElevenLabs API key is configured
 */
export function isConfigured(): boolean {
	return !!env.ELEVENLABS_API_KEY;
}
