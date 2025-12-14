import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	extractOrderIntentWithContext,
	type VoiceIntentType,
	type ConversationContext,
	type CartContext
} from '$lib/server/ai/extract-voice-intent';
import { searchProjectProducts, type ProductMatch, type SupplierSuggestion } from '$lib/server/voice/product-search';
import { speechToText } from '$lib/server/elevenlabs';

// Context product for client-side tracking
export interface ContextProduct {
	index: number;
	productId: string;
	productName: string;
	sku: string;
	pricePerUnit: number;
	unit: string;
}

// Response for new_search intent
export interface NewSearchResult {
	transcription: string;
	intentType: 'new_search';
	intent: {
		items: Array<{
			description: string;
			quantity: number;
			confidence: number;
		}>;
	};
	recommendations: Array<{
		forItem: string;
		quantity: number;
		products: ProductMatch[];
	}>;
	noMatchMessage: string | null;
	supplierSuggestions?: SupplierSuggestion[];
}

// Response for select_product intent
export interface SelectProductResult {
	transcription: string;
	intentType: 'select_product';
	addedToCart: {
		productId: string;
		productName: string;
		sku: string;
		pricePerUnit: number;
		unit: string;
		quantity: number;
		confirmationMessage: string;
	};
}

// Response for add_all intent
export interface AddAllResult {
	transcription: string;
	intentType: 'add_all';
	addedProducts: Array<{
		productId: string;
		productName: string;
		sku: string;
		pricePerUnit: number;
		unit: string;
		quantity: number;
	}>;
	confirmationMessage: string;
}

// Response for clear intent
export interface ClearResult {
	transcription: string;
	intentType: 'clear';
}

// Response for errors (e.g., invalid product index)
export interface ErrorResult {
	transcription: string;
	intentType: 'error';
	errorMessage: string;
}

// Response for cart_query intent
export interface CartQueryResult {
	transcription: string;
	intentType: 'cart_query';
	cartSummary: string;
}

// Response for cart_total intent
export interface CartTotalResult {
	transcription: string;
	intentType: 'cart_total';
	totalMessage: string;
}

// Response for cart_remove intent
export interface CartRemoveResult {
	transcription: string;
	intentType: 'cart_remove';
	itemName: string;
	confirmationMessage: string;
}

// Response for cart_update intent
export interface CartUpdateResult {
	transcription: string;
	intentType: 'cart_update';
	itemName: string;
	newQuantity: number;
	confirmationMessage: string;
}

// Response for cart_clear intent
export interface CartClearResult {
	transcription: string;
	intentType: 'cart_clear';
	confirmationMessage: string;
}

// Response for add_note intent
export interface AddNoteResult {
	transcription: string;
	intentType: 'add_note';
	note: string;
	confirmationMessage: string;
}

// Response for set_priority intent
export interface SetPriorityResult {
	transcription: string;
	intentType: 'set_priority';
	priority: 'normal' | 'urgent';
	confirmationMessage: string;
}

// Response for reorder_favorites intent
export interface ReorderFavoritesResult {
	transcription: string;
	intentType: 'reorder_favorites';
	message: string;
}

// Response for reorder_past intent
export interface ReorderPastResult {
	transcription: string;
	intentType: 'reorder_past';
	dateReference: string;
	message: string;
}

// Response for order_history intent
export interface OrderHistoryResult {
	transcription: string;
	intentType: 'order_history';
	message: string;
}

export type ProcessedVoiceResult =
	| NewSearchResult
	| SelectProductResult
	| AddAllResult
	| ClearResult
	| CartQueryResult
	| CartTotalResult
	| CartRemoveResult
	| CartUpdateResult
	| CartClearResult
	| AddNoteResult
	| SetPriorityResult
	| ReorderFavoritesResult
	| ReorderPastResult
	| OrderHistoryResult
	| ErrorResult;

/**
 * POST /api/voice/process
 *
 * Process voice input for ordering with conversation context:
 * 1. If audio is provided, transcribe it using ElevenLabs
 * 2. Extract ordering intent using Claude AI (context-aware)
 * 3. Handle different intent types:
 *    - new_search: Search for products
 *    - select_product: Add specific product from context to cart
 *    - add_all: Add all products from context to cart
 *    - clear: Clear the conversation
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	// Check authentication
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const contentType = request.headers.get('content-type') || '';

	let transcription: string;
	let projectId: string;
	let conversationContext: ConversationContext | null = null;
	let cartContext: CartContext | null = null;

	if (contentType.includes('multipart/form-data')) {
		// Audio file upload - transcribe first
		const formData = await request.formData();
		const audioFile = formData.get('audio') as File | null;
		projectId = formData.get('projectId') as string;
		const contextJson = formData.get('conversationContext') as string | null;
		const cartContextJson = formData.get('cartContext') as string | null;

		if (!audioFile) {
			throw error(400, 'Audio file is required');
		}

		if (!projectId) {
			throw error(400, 'Project ID is required');
		}

		// Parse conversation context if provided
		if (contextJson) {
			try {
				conversationContext = JSON.parse(contextJson);
			} catch {
				// Ignore invalid context
			}
		}

		// Parse cart context if provided
		if (cartContextJson) {
			try {
				cartContext = JSON.parse(cartContextJson);
			} catch {
				// Ignore invalid cart context
			}
		}

		// Transcribe audio using ElevenLabs
		const audioBuffer = await audioFile.arrayBuffer();
		transcription = await speechToText({ audioBuffer });
	} else {
		// JSON body with transcription already provided
		const body = await request.json();
		transcription = body.transcription;
		projectId = body.projectId;
		conversationContext = body.conversationContext || null;
		cartContext = body.cartContext || null;

		if (!transcription || typeof transcription !== 'string') {
			throw error(400, 'Transcription is required');
		}

		if (!projectId || typeof projectId !== 'string') {
			throw error(400, 'Project ID is required');
		}
	}

	// Extract ordering intent with context awareness
	const intentResult = await extractOrderIntentWithContext(transcription, conversationContext, cartContext);

	// Handle different intent types
	switch (intentResult.intentType) {
		case 'select_product': {
			// User wants to select a specific product from context
			if (!conversationContext || conversationContext.products.length === 0) {
				// No context available, treat as new search
				return handleNewSearch(transcription, projectId, intentResult.rawTranscription);
			}

			const selection = intentResult.productSelection;
			if (!selection) {
				return json({
					transcription,
					intentType: 'error',
					errorMessage: "I couldn't understand which product you want. Try saying the number, like 'the first one' or 'number 2'."
				} satisfies ErrorResult);
			}

			// Find the product by index
			const selectedProduct = conversationContext.products.find(
				(p) => p.index === selection.index
			);

			if (!selectedProduct) {
				const maxIndex = Math.max(...conversationContext.products.map((p) => p.index));
				return json({
					transcription,
					intentType: 'error',
					errorMessage: `I only see ${maxIndex} product${maxIndex === 1 ? '' : 's'}. Try saying a number from 1 to ${maxIndex}.`
				} satisfies ErrorResult);
			}

			return json({
				transcription,
				intentType: 'select_product',
				addedToCart: {
					productId: selectedProduct.productId,
					productName: selectedProduct.productName,
					sku: selectedProduct.sku,
					pricePerUnit: selectedProduct.pricePerUnit,
					unit: selectedProduct.unit,
					quantity: selection.quantity,
					confirmationMessage: `Adding ${selection.quantity} ${selectedProduct.productName} to your cart.`
				}
			} satisfies SelectProductResult);
		}

		case 'add_all': {
			// User wants to add all displayed products
			if (!conversationContext || conversationContext.products.length === 0) {
				return json({
					transcription,
					intentType: 'error',
					errorMessage: "There are no products to add. Try searching for something first."
				} satisfies ErrorResult);
			}

			const addedProducts = conversationContext.products.map((p) => ({
				productId: p.productId,
				productName: p.productName,
				sku: p.sku,
				pricePerUnit: p.pricePerUnit,
				unit: p.unit,
				quantity: 1 // Default to 1 each for add_all
			}));

			return json({
				transcription,
				intentType: 'add_all',
				addedProducts,
				confirmationMessage: `Adding ${addedProducts.length} products to your cart.`
			} satisfies AddAllResult);
		}

		case 'clear': {
			return json({
				transcription,
				intentType: 'clear'
			} satisfies ClearResult);
		}

		// ===== Cart Management =====
		case 'cart_query': {
			if (!cartContext || cartContext.items.length === 0) {
				return json({
					transcription,
					intentType: 'cart_query',
					cartSummary: 'Your cart is empty.'
				} satisfies CartQueryResult);
			}

			const itemSummaries = cartContext.items.map((item) =>
				`${item.quantity} ${item.name}`
			);
			const cartSummary = `Your cart has ${itemSummaries.join(', ')}.`;

			return json({
				transcription,
				intentType: 'cart_query',
				cartSummary
			} satisfies CartQueryResult);
		}

		case 'cart_total': {
			if (!cartContext || cartContext.items.length === 0) {
				return json({
					transcription,
					intentType: 'cart_total',
					totalMessage: 'Your cart is empty.'
				} satisfies CartTotalResult);
			}

			const totalFrancs = (cartContext.totalCents / 100).toFixed(2);
			const totalMessage = `Your total is ${totalFrancs} Swiss francs.`;

			return json({
				transcription,
				intentType: 'cart_total',
				totalMessage
			} satisfies CartTotalResult);
		}

		case 'cart_remove': {
			if (!intentResult.cartAction?.itemName) {
				return json({
					transcription,
					intentType: 'error',
					errorMessage: "I couldn't understand which item to remove. Try saying something like 'remove the gloves'."
				} satisfies ErrorResult);
			}

			return json({
				transcription,
				intentType: 'cart_remove',
				itemName: intentResult.cartAction.itemName,
				confirmationMessage: `Removing ${intentResult.cartAction.itemName} from your cart.`
			} satisfies CartRemoveResult);
		}

		case 'cart_update': {
			if (!intentResult.cartAction?.itemName || intentResult.cartAction.newQuantity === undefined) {
				return json({
					transcription,
					intentType: 'error',
					errorMessage: "I couldn't understand the update. Try saying something like 'change screws to 20'."
				} satisfies ErrorResult);
			}

			return json({
				transcription,
				intentType: 'cart_update',
				itemName: intentResult.cartAction.itemName,
				newQuantity: intentResult.cartAction.newQuantity,
				confirmationMessage: `Updating ${intentResult.cartAction.itemName} to ${intentResult.cartAction.newQuantity}.`
			} satisfies CartUpdateResult);
		}

		case 'cart_clear': {
			return json({
				transcription,
				intentType: 'cart_clear',
				confirmationMessage: 'Clearing your cart.'
			} satisfies CartClearResult);
		}

		// ===== Notes & Priority =====
		case 'add_note': {
			const note = intentResult.note || transcription;
			return json({
				transcription,
				intentType: 'add_note',
				note,
				confirmationMessage: `Adding note: ${note}`
			} satisfies AddNoteResult);
		}

		case 'set_priority': {
			const priority = intentResult.priority || 'urgent';
			return json({
				transcription,
				intentType: 'set_priority',
				priority,
				confirmationMessage: priority === 'urgent'
					? 'Marking your order as urgent.'
					: 'Setting normal priority for your order.'
			} satisfies SetPriorityResult);
		}

		// ===== Reorder & Favorites =====
		case 'reorder_favorites': {
			// This will be handled by the client - returns a signal to fetch favorites
			return json({
				transcription,
				intentType: 'reorder_favorites',
				message: 'Getting your usual items.'
			} satisfies ReorderFavoritesResult);
		}

		case 'reorder_past': {
			const dateRef = intentResult.dateReference || 'recently';
			return json({
				transcription,
				intentType: 'reorder_past',
				dateReference: dateRef,
				message: `Looking for your order from ${dateRef}.`
			} satisfies ReorderPastResult);
		}

		case 'order_history': {
			return json({
				transcription,
				intentType: 'order_history',
				message: 'Getting your order history.'
			} satisfies OrderHistoryResult);
		}

		case 'new_search':
		default: {
			return handleNewSearch(transcription, projectId, intentResult.rawTranscription, intentResult.items, locals.user.id);
		}
	}
};

/**
 * Handle new search intent - search for products
 */
async function handleNewSearch(
	transcription: string,
	projectId: string,
	rawTranscription: string,
	items?: Array<{ description: string; quantity: number; searchTerms: string[]; confidence: number }>,
	userId?: string
): Promise<Response> {
	const searchItems = items || [{
		description: rawTranscription,
		quantity: 1,
		searchTerms: [],
		confidence: 0.5
	}];

	const recommendations: NewSearchResult['recommendations'] = [];
	let totalProductsFound = 0;
	const allSupplierSuggestions: SupplierSuggestion[] = [];

	for (const item of searchItems) {
		const searchResult = await searchProjectProducts(
			projectId,
			item.searchTerms,
			item.description,
			8, // Show up to 8 products per item for better selection
			userId, // Pass userId for smart quantity suggestions
			true // Include supplier suggestions
		);

		totalProductsFound += searchResult.products.length;

		// Collect supplier suggestions from each search
		if (searchResult.supplierSuggestions) {
			allSupplierSuggestions.push(...searchResult.supplierSuggestions);
		}

		recommendations.push({
			forItem: item.description,
			quantity: item.quantity,
			products: searchResult.products
		});
	}

	// Deduplicate supplier suggestions by ID and keep top 3
	const uniqueSupplierSuggestions = Array.from(
		new Map(allSupplierSuggestions.map(s => [s.id, s])).values()
	).slice(0, 3);

	// Determine if we need to show a "no match" message
	let noMatchMessage: string | null = null;
	if (searchItems.length > 0 && totalProductsFound === 0) {
		const itemNames = searchItems.map((i) => i.description).join(', ');
		if (uniqueSupplierSuggestions.length > 0) {
			noMatchMessage = `No matching products in your project catalogue. Try browsing an external supplier catalog below.`;
		} else {
			noMatchMessage = `I couldn't find "${itemNames}" in your project catalogue. Try using different words, or browse the main catalogue to find what you need.`;
		}
	} else if (recommendations.some((r) => r.products.length === 0)) {
		const noMatchItems = recommendations
			.filter((r) => r.products.length === 0)
			.map((r) => r.forItem);
		noMatchMessage = `No matches found for: ${noMatchItems.join(', ')}. Try different words or check the main catalogue.`;
	}

	return json({
		transcription,
		intentType: 'new_search',
		intent: {
			items: searchItems.map((item) => ({
				description: item.description,
				quantity: item.quantity,
				confidence: item.confidence
			}))
		},
		recommendations,
		noMatchMessage,
		supplierSuggestions: uniqueSupplierSuggestions.length > 0 ? uniqueSupplierSuggestions : undefined
	} satisfies NewSearchResult);
}
