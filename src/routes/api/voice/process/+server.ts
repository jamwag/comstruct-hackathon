import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { extractOrderIntent } from '$lib/server/ai/extract-voice-intent';
import { searchProjectProducts, type ProductMatch } from '$lib/server/voice/product-search';
import { speechToText } from '$lib/server/elevenlabs';

export interface ProcessedVoiceResult {
	transcription: string;
	intent: {
		items: Array<{
			description: string;
			quantity: number;
			confidence: number;
		}>;
		clarificationNeeded: string | null;
	};
	recommendations: Array<{
		forItem: string;
		quantity: number;
		products: ProductMatch[];
	}>;
	noMatchMessage: string | null;
}

/**
 * POST /api/voice/process
 *
 * Process voice input for ordering:
 * 1. If audio is provided, transcribe it using ElevenLabs
 * 2. Extract ordering intent using Claude AI
 * 3. Search for matching products in the project's catalogue
 * 4. Return recommendations
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	// Check authentication
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const contentType = request.headers.get('content-type') || '';

	let transcription: string;
	let projectId: string;

	if (contentType.includes('multipart/form-data')) {
		// Audio file upload - transcribe first
		const formData = await request.formData();
		const audioFile = formData.get('audio') as File | null;
		projectId = formData.get('projectId') as string;

		if (!audioFile) {
			throw error(400, 'Audio file is required');
		}

		if (!projectId) {
			throw error(400, 'Project ID is required');
		}

		// Transcribe audio using ElevenLabs
		const audioBuffer = await audioFile.arrayBuffer();
		transcription = await speechToText({ audioBuffer });
	} else {
		// JSON body with transcription already provided
		const body = await request.json();
		transcription = body.transcription;
		projectId = body.projectId;

		if (!transcription || typeof transcription !== 'string') {
			throw error(400, 'Transcription is required');
		}

		if (!projectId || typeof projectId !== 'string') {
			throw error(400, 'Project ID is required');
		}
	}

	// Extract ordering intent from the transcription
	const intent = await extractOrderIntent(transcription);

	// If clarification is needed, return early
	if (intent.clarificationNeeded) {
		const result: ProcessedVoiceResult = {
			transcription,
			intent: {
				items: intent.items.map((item) => ({
					description: item.description,
					quantity: item.quantity,
					confidence: item.confidence
				})),
				clarificationNeeded: intent.clarificationNeeded
			},
			recommendations: [],
			noMatchMessage: intent.clarificationNeeded
		};
		return json(result);
	}

	// Search for products for each extracted item
	const recommendations: ProcessedVoiceResult['recommendations'] = [];
	let totalProductsFound = 0;

	for (const item of intent.items) {
		const searchResult = await searchProjectProducts(
			projectId,
			item.searchTerms,
			item.description,
			5 // max 5 products per item
		);

		totalProductsFound += searchResult.products.length;

		recommendations.push({
			forItem: item.description,
			quantity: item.quantity,
			products: searchResult.products
		});
	}

	// Determine if we need to show a "no match" message
	let noMatchMessage: string | null = null;
	if (intent.items.length > 0 && totalProductsFound === 0) {
		const itemNames = intent.items.map((i) => i.description).join(', ');
		noMatchMessage = `I couldn't find "${itemNames}" in your project catalogue. Try using different words, or browse the main catalogue to find what you need.`;
	} else if (recommendations.some((r) => r.products.length === 0)) {
		const noMatchItems = recommendations
			.filter((r) => r.products.length === 0)
			.map((r) => r.forItem);
		noMatchMessage = `No matches found for: ${noMatchItems.join(', ')}. Try different words or check the main catalogue.`;
	}

	const result: ProcessedVoiceResult = {
		transcription,
		intent: {
			items: intent.items.map((item) => ({
				description: item.description,
				quantity: item.quantity,
				confidence: item.confidence
			})),
			clarificationNeeded: null
		},
		recommendations,
		noMatchMessage
	};

	return json(result);
};
