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
export type VoiceIntentType =
	// Existing
	| 'new_search'
	| 'select_product'
	| 'add_all'
	| 'clear'
	// Cart Management
	| 'cart_query'
	| 'cart_total'
	| 'cart_remove'
	| 'cart_update'
	| 'cart_clear'
	// Reorder/Favorites
	| 'reorder_favorites'
	| 'reorder_past'
	| 'order_history'
	// Voice Notes
	| 'add_note'
	| 'set_priority';

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

export interface CartContext {
	items: Array<{
		name: string;
		quantity: number;
		pricePerUnit: number;
	}>;
	totalCents: number;
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
	// For cart_remove and cart_update
	cartAction?: {
		itemName: string;
		newQuantity?: number;
	};
	// For reorder_past
	dateReference?: string;
	// For add_note
	note?: string;
	// For set_priority
	priority?: 'normal' | 'urgent';
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
 * Also handles cart queries, reorder commands, and notes.
 */
export async function extractOrderIntentWithContext(
	transcription: string,
	context: ConversationContext | null,
	cartContext: CartContext | null = null
): Promise<ContextAwareIntentResult> {
	const apiKey = env.ANTHROPIC_API_KEY;
	if (!apiKey) {
		throw new Error('ANTHROPIC_API_KEY is not set');
	}

	const anthropic = new Anthropic({ apiKey });

	// Build context section for the prompt
	const productContextSection = context && context.products.length > 0
		? `
DISPLAYED PRODUCTS - These products are currently shown to the user:
${context.products.map((p) => `${p.index}. "${p.productName}" (SKU: ${p.sku})`).join('\n')}

The user may reference these by number ("the second one", "#2", "number 2", etc).
`
		: `
No products are currently displayed.
`;

	const cartContextSection = cartContext && cartContext.items.length > 0
		? `
CART CONTENTS - The user's cart currently has:
${cartContext.items.map((i) => `- "${i.name}" x${i.quantity} (CHF ${(i.pricePerUnit * i.quantity / 100).toFixed(2)})`).join('\n')}
Total: CHF ${(cartContext.totalCents / 100).toFixed(2)}
`
		: `
The cart is currently empty.
`;

	const prompt = `Analyze this voice command from a construction worker ordering supplies.

Request: "${transcription}"
${productContextSection}
${cartContextSection}

Determine the INTENT TYPE and extract relevant data.

INTENT TYPES:

**Product Search & Selection:**
1. "new_search" - User wants to FIND/SEARCH for products. Keywords: find, search, need, get, show, give me, I want, looking for
2. "select_product" - User references a NUMBERED product from the displayed list. Keywords: first, second, third, #1, #2, number 1, the first one, option 2
3. "add_all" - User wants ALL displayed products. Keywords: all of them, everything, add all, all the options
4. "clear" - User wants to cancel search/start over. Keywords: never mind, cancel, clear, start over, forget it

**Cart Management:**
5. "cart_query" - User asks what's in their cart. Keywords: what's in my cart, show cart, what do I have, cart contents
6. "cart_total" - User asks for total price. Keywords: how much, what's the total, total price, what does it cost
7. "cart_remove" - User wants to remove a specific item. Keywords: remove, delete, take out, get rid of [item name]
8. "cart_update" - User wants to change quantity of an item. Keywords: change [item] to [quantity], update [item] to [quantity], make it [quantity]
9. "cart_clear" - User wants to empty entire cart. Keywords: empty cart, clear cart, remove everything, start fresh

**Reorder & Favorites:**
10. "reorder_favorites" - User wants their frequently ordered items. Keywords: order my usual, my favorites, what I always get, the usual
11. "reorder_past" - User wants to reorder from a past order. Keywords: reorder from [date], same as last [day], order from [date]
12. "order_history" - User asks what they ordered before. Keywords: what did I order, last order, previous order, order history

**Notes & Priority:**
13. "add_note" - User wants to attach a note. Keywords: add note, note that, delivery note, special instructions, note:
14. "set_priority" - User wants to mark as urgent. Keywords: urgent, rush, priority, asap, mark as urgent, this is urgent

IMPORTANT RULES:
- If there's NO product context (no products displayed), assume "new_search" for product requests
- "order 10 of the second" with context = select_product (referencing displayed item)
- "order 10 screws" = new_search (searching for a product by name)
- Numbers like "3/4 inch" or "4mm" are product specs, NOT product indices
- For cart_remove/cart_update, extract the item name the user mentions
- For add_note, extract the note content after "note:" or similar
- For reorder_past, extract the date reference ("last Tuesday", "two days ago")

Return JSON:
{
  "intentType": "<one of the intent types>",
  "items": [{"description": "product name", "quantity": 1}],  // ONLY for new_search
  "productSelection": {"index": 2, "quantity": 10},           // ONLY for select_product
  "cartAction": {"itemName": "gloves", "newQuantity": 5},     // For cart_remove (no newQuantity) or cart_update
  "dateReference": "last Tuesday",                             // For reorder_past
  "note": "deliver to 2nd floor",                              // For add_note
  "priority": "urgent"                                         // For set_priority
}

Examples:
- "find me safety gloves" → {"intentType": "new_search", "items": [{"description": "safety gloves", "quantity": 1}]}
- "order 10 of the second one" (with context) → {"intentType": "select_product", "productSelection": {"index": 2, "quantity": 10}}
- "what's in my cart?" → {"intentType": "cart_query"}
- "how much is my total?" → {"intentType": "cart_total"}
- "remove the gloves" → {"intentType": "cart_remove", "cartAction": {"itemName": "gloves"}}
- "change the screws to 20" → {"intentType": "cart_update", "cartAction": {"itemName": "screws", "newQuantity": 20}}
- "empty my cart" → {"intentType": "cart_clear"}
- "order my usual" → {"intentType": "reorder_favorites"}
- "reorder from last Tuesday" → {"intentType": "reorder_past", "dateReference": "last Tuesday"}
- "what did I order last time?" → {"intentType": "order_history"}
- "add note: deliver to loading dock" → {"intentType": "add_note", "note": "deliver to loading dock"}
- "mark this as urgent" → {"intentType": "set_priority", "priority": "urgent"}

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
			cartAction?: { itemName?: string; newQuantity?: number };
			dateReference?: string;
			note?: string;
			priority?: 'normal' | 'urgent';
		} = JSON.parse(jsonText);

		const intentType = parsed.intentType || 'new_search';

		// Build result based on intent type
		const result: ContextAwareIntentResult = {
			intentType,
			rawTranscription: transcription
		};

		switch (intentType) {
			case 'new_search':
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
				break;

			case 'select_product':
				if (parsed.productSelection) {
					result.productSelection = {
						index: parsed.productSelection.index || 1,
						quantity: typeof parsed.productSelection.quantity === 'number'
							? Math.max(1, parsed.productSelection.quantity)
							: 1
					};
				}
				break;

			case 'cart_remove':
			case 'cart_update':
				if (parsed.cartAction?.itemName) {
					result.cartAction = {
						itemName: parsed.cartAction.itemName,
						newQuantity: parsed.cartAction.newQuantity
					};
				}
				break;

			case 'reorder_past':
				if (parsed.dateReference) {
					result.dateReference = parsed.dateReference;
				}
				break;

			case 'add_note':
				if (parsed.note) {
					result.note = parsed.note;
				}
				break;

			case 'set_priority':
				result.priority = parsed.priority === 'urgent' ? 'urgent' : 'normal';
				break;

			// These intents don't need additional data extraction:
			// cart_query, cart_total, cart_clear, add_all, clear, reorder_favorites, order_history
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
