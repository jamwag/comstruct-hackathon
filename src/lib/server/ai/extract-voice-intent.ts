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

	const prompt = `You are helping a construction worker order supplies. Extract what they want to order from their spoken request.

The worker might use informal language, abbreviations, or describe items by their use case rather than exact product names. Construction workers often say things like:
- "I need some screws" (meaning various fasteners)
- "Give me a couple boxes of gloves" (PPE/safety equipment)
- "The red spray paint" (coatings/chemicals)
- "Something to seal the window" (sealants)
- German/Swiss terms mixed with English

Spoken request: "${transcription}"

Return a JSON object with this exact structure:
{
  "items": [
    {
      "description": "normalized description of what they want",
      "quantity": 1,
      "searchTerms": ["term1", "term2", "term3"],
      "confidence": 0.9
    }
  ],
  "clarificationNeeded": null
}

Rules:
- "description" should be a clear, normalized description (e.g., "wood screws", "safety gloves", "spray paint")
- "quantity" should be a number (default to 1 if not specified, "a couple" = 2, "a few" = 3, "some" = 1)
- "searchTerms" should include 3-5 keywords that might match product names/descriptions in a database:
  - Include the main item type (e.g., "screw", "glove", "paint")
  - Include variations and related terms (e.g., "fastener", "PPE", "coating")
  - Include size/specifications if mentioned (e.g., "6mm", "large", "red")
- "confidence" is 0.0-1.0 indicating how sure you are about what they want
- If the request is completely unclear or not related to construction materials, set "clarificationNeeded" to a short question

Common construction material categories:
- Fastening: screws, nails, plugs, anchors, bolts
- Safety/PPE: gloves, glasses, helmets, vests, masks
- Tools: drill bits, blades, measuring tools
- Electrical: cables, connectors, switches
- Coatings & Chemicals: paints, sprays, sealants, adhesives
- Site General: tape, foil, bags, cleaning supplies

Return ONLY valid JSON, no other text.`;

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
