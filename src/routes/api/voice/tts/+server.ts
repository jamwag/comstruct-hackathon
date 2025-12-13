import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { textToSpeech, textToSpeechStream, isConfigured } from '$lib/server/elevenlabs';

/**
 * POST /api/voice/tts
 *
 * Convert text to speech using ElevenLabs.
 * Returns audio/mpeg stream.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	// Check authentication
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	// Check if ElevenLabs is configured
	if (!isConfigured()) {
		throw error(503, 'Text-to-speech service not configured');
	}

	const body = await request.json();
	const text = body.text;
	const stream = body.stream ?? false;

	if (!text || typeof text !== 'string') {
		throw error(400, 'Text is required');
	}

	if (text.length > 1000) {
		throw error(400, 'Text too long (max 1000 characters)');
	}

	try {
		if (stream) {
			// Return streaming audio
			const audioStream = await textToSpeechStream({ text });

			return new Response(audioStream, {
				headers: {
					'Content-Type': 'audio/mpeg',
					'Transfer-Encoding': 'chunked'
				}
			});
		} else {
			// Return complete audio buffer
			const audioBuffer = await textToSpeech({ text });

			return new Response(audioBuffer, {
				headers: {
					'Content-Type': 'audio/mpeg',
					'Content-Length': audioBuffer.byteLength.toString()
				}
			});
		}
	} catch (err) {
		console.error('TTS error:', err);
		throw error(500, 'Failed to generate speech');
	}
};
