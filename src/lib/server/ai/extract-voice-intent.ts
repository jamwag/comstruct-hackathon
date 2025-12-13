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

// New types for context-aware intent extraction
export type VoiceIntentType = 'new_search' | 'select_product' | 'add_all' | 'clear';

export interface ConversationContext {
	products: Array<{
		index: number;
		productId: string;
		productName: string;
		sku: string;
		pricePerUnit: number;
		unit: string;
	}>;
}

export interface ContextAwareIntentResult {
	intentType: VoiceIntentType;
	// For new_search
	items?: OrderItem[];
	// For select_product
	productSelection?: {
		index: number;
		quantity: number;
	};
	// For add_all
	addAllQuantity?: number;
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

/**
 * Extract ordering intent with conversation context awareness.
 * This can recognize when users reference previously shown products
 * (e.g., "order 10 of the second one") vs starting a new search.
 */
export async function extractOrderIntentWithContext(
	transcription: string,
	context: ConversationContext | null
): Promise<ContextAwareIntentResult> {
	const apiKey = env.ANTHROPIC_API_KEY;
	if (!apiKey) {
		throw new Error('ANTHROPIC_API_KEY is not set');
	}

	const anthropic = new Anthropic({ apiKey });

	// Build context section for the prompt
	const contextSection = context && context.products.length > 0
		? `
CONTEXT - These products are currently displayed to the user:
${context.products.map((p) => `${p.index}. "${p.productName}" (SKU: ${p.sku})`).join('\n')}

The user may reference these by number ("the second one", "#2", "number 2", etc).
`
		: `
No products are currently displayed (this is the first command or context was cleared).
`;

	const prompt = `Analyze this voice command from a construction worker ordering supplies.

Request: "${transcription}"
${contextSection}

Determine the INTENT TYPE and extract relevant data.

INTENT TYPES:
1. "new_search" - User wants to FIND/SEARCH for products. Keywords: find, search, need, get, show, give me, I want, looking for
2. "select_product" - User references a NUMBERED product from the displayed list. Keywords: first, second, third, #1, #2, number 1, the first one, option 2
3. "add_all" - User wants ALL displayed products. Keywords: all of them, everything, add all, all the options
4. "clear" - User wants to cancel/start over. Keywords: never mind, cancel, clear, start over, forget it

IMPORTANT RULES:
- If there's NO context (no products displayed), always return "new_search"
- "order 10 of the second" with context = select_product (referencing displayed item)
- "order 10 screws" = new_search (searching for a product by name)
- "give me some gloves" = new_search (searching)
- "give me the first one" with context = select_product (referencing displayed item)
- Numbers like "3/4 inch" or "4mm" are product specs, NOT product indices

Return JSON:
{
  "intentType": "new_search" | "select_product" | "add_all" | "clear",
  "items": [{"description": "product name", "quantity": 1}],  // ONLY for new_search
  "productSelection": {"index": 2, "quantity": 10}            // ONLY for select_product
}

Examples:
- "find me safety gloves" → {"intentType": "new_search", "items": [{"description": "safety gloves", "quantity": 1}]}
- "order 10 of the second one" (with context) → {"intentType": "select_product", "productSelection": {"index": 2, "quantity": 10}}
- "add all of them" (with context) → {"intentType": "add_all"}
- "never mind" → {"intentType": "clear"}
- "I need 5 screws" → {"intentType": "new_search", "items": [{"description": "screws", "quantity": 5}]}

Return ONLY valid JSON.`;

	try {
		const response = await anthropic.messages.create({
			model: 'claude-haiku-4-5-20251001',
			max_tokens: 500,
			messages: [{ role: 'user', content: prompt }]
		});

		const content = response.content[0];
		if (content.type !== 'text') {
			throw new Error('Unexpected response type from Claude');
		}

		let jsonText = content.text.trim();
		if (jsonText.startsWith('```')) {
			jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
		}

		const parsed: {
			intentType?: VoiceIntentType;
			items?: Array<{ description?: string; quantity?: number }>;
			productSelection?: { index?: number; quantity?: number };
		} = JSON.parse(jsonText);

		const intentType = parsed.intentType || 'new_search';

		// Build result based on intent type
		const result: ContextAwareIntentResult = {
			intentType,
			rawTranscription: transcription
		};

		if (intentType === 'new_search') {
			result.items = (parsed.items || []).map((item) => ({
				description: item.description || transcription,
				quantity: typeof item.quantity === 'number' ? Math.max(1, item.quantity) : 1,
				searchTerms: [],
				confidence: 0.8
			}));
			// Fallback if no items extracted
			if (result.items.length === 0) {
				result.items = [{
					description: transcription,
					quantity: 1,
					searchTerms: [],
					confidence: 0.5
				}];
			}
		} else if (intentType === 'select_product' && parsed.productSelection) {
			result.productSelection = {
				index: parsed.productSelection.index || 1,
				quantity: typeof parsed.productSelection.quantity === 'number'
					? Math.max(1, parsed.productSelection.quantity)
					: 1
			};
		}

		return result;
	} catch (error) {
		console.error('Failed to extract voice intent with context:', error);

		// Fallback to new_search with raw transcription
		return {
			intentType: 'new_search',
			items: [{
				description: transcription,
				quantity: 1,
				searchTerms: [],
				confidence: 0.3
			}],
			rawTranscription: transcription
		};
	}
}
