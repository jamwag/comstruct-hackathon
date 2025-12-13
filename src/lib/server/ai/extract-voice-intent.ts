import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';

export interface OrderItem {
	description: string;
	quantity: number;
	searchTerms: string[];
	confidence: number;
}

export interface VoiceIntentResult {
	items: OrderItem[];
	clarificationNeeded: string | null;
	rawTranscription: string;
}

/**
 * Extract ordering intent from a voice transcription using Claude AI.
 * This analyzes what the construction worker wants to order and extracts
 * searchable terms for database lookup.
 */
export async function extractOrderIntent(transcription: string): Promise<VoiceIntentResult> {
	const apiKey = env.ANTHROPIC_API_KEY;
	if (!apiKey) {
		throw new Error('ANTHROPIC_API_KEY is not set');
	}

	const anthropic = new Anthropic({ apiKey });

	const prompt = `Extract what products a construction worker wants to order from their voice request.

Request: "${transcription}"

Return JSON:
{
  "items": [
    {"description": "product name", "quantity": 1}
  ]
}

Rules:
- "description": Keep the user's words mostly intact (e.g., "safety gloves" stays "safety gloves")
- "quantity": Extract number (default 1, "couple"=2, "few"=3, "some"=1, "a box of"=1)
- Multiple items? Return multiple objects in the array
- Keep it simple - just extract WHAT they want and HOW MANY

Examples:
- "I need some safety gloves" → [{"description": "safety gloves", "quantity": 1}]
- "give me 5 screws and some tape" → [{"description": "screws", "quantity": 5}, {"description": "tape", "quantity": 1}]

Return ONLY valid JSON.`;

	try {
		const response = await anthropic.messages.create({
			model: 'claude-haiku-4-5-20251001',
			max_tokens: 1000,
			messages: [{ role: 'user', content: prompt }]
		});

		const content = response.content[0];
		if (content.type !== 'text') {
			throw new Error('Unexpected response type from Claude');
		}

		// Parse the JSON response - strip markdown code blocks if present
		let jsonText = content.text.trim();
		if (jsonText.startsWith('```')) {
			jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
		}

		const parsed: {
			items?: Array<{
				description?: string;
				quantity?: number;
				searchTerms?: string[];
				confidence?: number;
			}>;
			clarificationNeeded?: string | null;
		} = JSON.parse(jsonText);

		// Validate and normalize the response
		const items: OrderItem[] = (parsed.items || []).map((item) => ({
			description: item.description || 'unknown item',
			quantity: typeof item.quantity === 'number' ? Math.max(1, item.quantity) : 1,
			searchTerms: Array.isArray(item.searchTerms) ? item.searchTerms : [],
			confidence: typeof item.confidence === 'number' ? Math.min(1, Math.max(0, item.confidence)) : 0.5
		}));

		return {
			items,
			clarificationNeeded: parsed.clarificationNeeded || null,
			rawTranscription: transcription
		};
	} catch (error) {
		console.error('Failed to extract voice intent:', error);

		// Return a fallback that uses the raw transcription as a search term
		return {
			items: [
				{
					description: transcription,
					quantity: 1,
					searchTerms: transcription.toLowerCase().split(/\s+/).filter((word) => word.length > 2),
					confidence: 0.3
				}
			],
			clarificationNeeded: null,
			rawTranscription: transcription
		};
	}
}
