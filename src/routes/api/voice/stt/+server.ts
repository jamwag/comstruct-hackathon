import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { speechToText, isConfigured } from '$lib/server/elevenlabs';

/**
 * POST /api/voice/stt
 *
 * Convert speech to text using ElevenLabs.
 * Accepts audio file upload and returns transcription.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	// Check authentication
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	// Check if ElevenLabs is configured
	if (!isConfigured()) {
		throw error(503, 'Speech-to-text service not configured');
	}

	const contentType = request.headers.get('content-type') || '';

	if (!contentType.includes('multipart/form-data')) {
		throw error(400, 'Expected multipart/form-data with audio file');
	}

	const formData = await request.formData();
	const audioFile = formData.get('audio') as File | null;
	const languageCode = formData.get('languageCode') as string | null;

	if (!audioFile) {
		throw error(400, 'Audio file is required');
	}

	// Validate file size (max 25MB)
	if (audioFile.size > 25 * 1024 * 1024) {
		throw error(400, 'Audio file too large (max 25MB)');
	}

	try {
		const audioBuffer = await audioFile.arrayBuffer();
		const transcription = await speechToText({
			audioBuffer,
			languageCode: languageCode || undefined
		});

		return json({
			success: true,
			transcription
		});
	} catch (err) {
		console.error('STT error:', err);
		throw error(500, 'Failed to transcribe audio');
	}
};
