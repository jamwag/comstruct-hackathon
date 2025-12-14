import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { eq, and, isNotNull, asc } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';

export interface ProductMatch {
	id: string;
	name: string;
	sku: string;
	description: string | null;
	unit: string;
	pricePerUnit: number;
	categoryName: string | null;
	subcategoryName: string | null;
	matchScore: number;
	matchReason: string;
	// Smart quantity suggestion
	usualQuantity?: number;
	orderCount?: number;
}

export interface SupplierSuggestion {
	id: string;
	name: string;
	shopUrl: string;
	description: string;
	matchScore: number;
	matchReason: string;
}

export interface SearchResult {
	query: string;
	products: ProductMatch[];
	totalFound: number;
	supplierSuggestions?: SupplierSuggestion[];
}

/**
 * Use AI to intelligently match products to user request.
 * This looks at ALL products and picks the most relevant ones semantically.
 */
async function aiMatchProducts(
	userRequest: string,
	products: Array<{
		id: string;
		name: string;
		description: string | null;
		sku: string;
		unit: string;
		pricePerUnit: number;
		categoryName: string | null;
	}>,
	maxResults: number
): Promise<Array<{ id: string; score: number; reason: string }>> {
	const apiKey = env.ANTHROPIC_API_KEY;
	if (!apiKey) {
		// Fallback to simple matching if no API key
		return simpleMatch(userRequest, products, maxResults);
	}

	// Limit products to avoid token limits (send max 100 products)
	const productSubset = products.slice(0, 100);

	const productList = productSubset
		.map((p, i) => `${i + 1}. [${p.id}] "${p.name}" - ${p.description || 'no description'} (${p.categoryName || 'uncategorized'})`)
		.join('\n');

	const prompt = `A worker needs: "${userRequest}"

Available products:
${productList}

Pick the ${maxResults} MOST RELEVANT products. Think semantically - "safety gloves" matches "gloves size 8" because gloves ARE safety equipment. "screws" matches "wood screws 4x40mm".

Return JSON array of matches (most relevant first):
[{"id": "product_id", "score": 0.95, "reason": "2-3 word reason"}]

Rules:
- Return up to ${maxResults} products, or fewer if less are relevant
- score: 0.9+ = exact match, 0.7-0.9 = good match, 0.5-0.7 = related
- Only include products with score >= 0.5
- If NOTHING matches, return empty array []

Return ONLY valid JSON array.`;

	try {
		const anthropic = new Anthropic({ apiKey });
		const response = await anthropic.messages.create({
			model: 'claude-haiku-4-5-20251001',
			max_tokens: 500,
			messages: [{ role: 'user', content: prompt }]
		});

		const content = response.content[0];
		if (content.type !== 'text') {
			return simpleMatch(userRequest, products, maxResults);
		}

		let jsonText = content.text.trim();
		if (jsonText.startsWith('```')) {
			jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
		}

		const matches: Array<{ id: string; score: number; reason: string }> = JSON.parse(jsonText);
		return matches.slice(0, maxResults);
	} catch (error) {
		console.error('AI matching failed, using simple match:', error);
		return simpleMatch(userRequest, products, maxResults);
	}
}

/**
 * Simple fallback matching when AI is unavailable
 */
function simpleMatch(
	userRequest: string,
	products: Array<{ id: string; name: string; description: string | null }>,
	maxResults: number
): Array<{ id: string; score: number; reason: string }> {
	const requestLower = userRequest.toLowerCase();
	const words = requestLower.split(/\s+/).filter(w => w.length >= 3);

	const scored = products.map(p => {
		const text = `${p.name} ${p.description || ''}`.toLowerCase();
		let score = 0;
		const reasons: string[] = [];

		for (const word of words) {
			if (text.includes(word)) {
				score += 0.3;
				reasons.push(word);
			}
		}

		return {
			id: p.id,
			score: Math.min(score, 1),
			reason: reasons.length > 0 ? `Contains: ${reasons.slice(0, 2).join(', ')}` : ''
		};
	});

	return scored
		.filter(s => s.score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, maxResults);
}

/**
 * Get supplier preference ranks for a project.
 * Returns a Map of supplierId -> preferenceRank (lower = higher priority).
 */
async function getSupplierPriorities(projectId: string): Promise<Map<string, number>> {
	const priorities = await db
		.select({
			supplierId: table.projectSupplier.supplierId,
			preferenceRank: table.projectSupplier.preferenceRank
		})
		.from(table.projectSupplier)
		.where(eq(table.projectSupplier.projectId, projectId));

	return new Map(priorities.map(p => [p.supplierId, p.preferenceRank]));
}

/**
 * Use AI to match supplier descriptions against user search query.
 * Returns suppliers with external shop URLs that are relevant to the query.
 */
async function getExternalShopSuggestions(
	projectId: string,
	searchQuery: string
): Promise<SupplierSuggestion[]> {
	// Get project suppliers with shop URLs and descriptions
	const projectSuppliersWithShops = await db
		.select({
			id: table.supplier.id,
			name: table.supplier.name,
			shopUrl: table.supplier.shopUrl,
			description: table.supplier.description,
			preferenceRank: table.projectSupplier.preferenceRank
		})
		.from(table.projectSupplier)
		.innerJoin(table.supplier, eq(table.projectSupplier.supplierId, table.supplier.id))
		.where(
			and(
				eq(table.projectSupplier.projectId, projectId),
				isNotNull(table.supplier.shopUrl),
				isNotNull(table.supplier.description)
			)
		)
		.orderBy(asc(table.projectSupplier.preferenceRank));

	console.log('[getExternalShopSuggestions] projectId:', projectId);
	console.log('[getExternalShopSuggestions] searchQuery:', searchQuery);
	console.log('[getExternalShopSuggestions] found suppliers:', projectSuppliersWithShops.length, projectSuppliersWithShops);

	if (projectSuppliersWithShops.length === 0) {
		return [];
	}

	// Use AI to match suppliers to search query
	const apiKey = env.ANTHROPIC_API_KEY;
	if (!apiKey) {
		return simpleSupplierMatch(projectSuppliersWithShops, searchQuery);
	}

	const supplierList = projectSuppliersWithShops
		.map((s, i) => `${i + 1}. "${s.name}" - ${s.description}`)
		.join('\n');

	const prompt = `A worker is searching for: "${searchQuery}"

Available supplier catalogs:
${supplierList}

Which suppliers are RELEVANT for this search? Only include suppliers whose description suggests they sell related products.

Return JSON array of matches:
[{"index": 1, "score": 0.8, "reason": "2-3 word reason"}]

Rules:
- score: 0.8+ = highly relevant, 0.5-0.8 = somewhat relevant
- Only include suppliers with score >= 0.5
- If NO supplier is relevant, return empty array []
- Maximum 3 suppliers

Return ONLY valid JSON array.`;

	try {
		const anthropic = new Anthropic({ apiKey });
		const response = await anthropic.messages.create({
			model: 'claude-haiku-4-5-20251001',
			max_tokens: 300,
			messages: [{ role: 'user', content: prompt }]
		});

		const content = response.content[0];
		if (content.type !== 'text') {
			console.log('[getExternalShopSuggestions] AI response not text, falling back');
			return simpleSupplierMatch(projectSuppliersWithShops, searchQuery);
		}

		let jsonText = content.text.trim();
		console.log('[getExternalShopSuggestions] AI raw response:', jsonText);

		if (jsonText.startsWith('```')) {
			jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
		}

		const matches: Array<{ index: number; score: number; reason: string }> = JSON.parse(jsonText);
		console.log('[getExternalShopSuggestions] parsed matches:', matches);

		const result = matches
			.filter(m => m.score >= 0.5)
			.map(m => {
				const supplier = projectSuppliersWithShops[m.index - 1];
				if (!supplier) return null;
				return {
					id: supplier.id,
					name: supplier.name,
					shopUrl: supplier.shopUrl!,
					description: supplier.description!,
					matchScore: m.score,
					matchReason: m.reason
				};
			})
			.filter((s): s is SupplierSuggestion => s !== null)
			.slice(0, 3);

		console.log('[getExternalShopSuggestions] final result:', result);
		return result;
	} catch (error) {
		console.error('AI supplier matching failed:', error);
		return simpleSupplierMatch(projectSuppliersWithShops, searchQuery);
	}
}

/**
 * Simple fallback matching for suppliers when AI is unavailable.
 */
function simpleSupplierMatch(
	suppliers: Array<{ id: string; name: string; shopUrl: string | null; description: string | null }>,
	searchQuery: string
): SupplierSuggestion[] {
	const queryWords = searchQuery.toLowerCase().split(/\s+/).filter(w => w.length >= 3);

	return suppliers
		.filter(s => s.shopUrl && s.description)
		.map(s => {
			const descLower = s.description!.toLowerCase();
			let matchCount = 0;
			for (const word of queryWords) {
				if (descLower.includes(word)) matchCount++;
			}
			return {
				id: s.id,
				name: s.name,
				shopUrl: s.shopUrl!,
				description: s.description!,
				matchScore: matchCount > 0 ? Math.min(0.5 + matchCount * 0.2, 1) : 0,
				matchReason: matchCount > 0 ? 'Contains search terms' : ''
			};
		})
		.filter(s => s.matchScore > 0)
		.slice(0, 3);
}

/**
 * Search for products assigned to a specific project using AI-powered semantic matching.
 * The AI looks at ALL products and picks the most relevant ones for the user's request.
 * If userId is provided, includes smart quantity suggestions based on order history.
 * If includeSupplierSuggestions is true, also returns relevant external supplier catalogs.
 */
export async function searchProjectProducts(
	projectId: string,
	searchTerms: string[],
	itemDescription: string,
	maxResults: number = 5,
	userId?: string,
	includeSupplierSuggestions: boolean = false
): Promise<SearchResult> {
	// Get all C-material products assigned to this project (filter out A-materials)
	const projectProducts = await db
		.select({
			product: table.product,
			category: table.productCategory
		})
		.from(table.projectProduct)
		.innerJoin(table.product, eq(table.projectProduct.productId, table.product.id))
		.leftJoin(table.productCategory, eq(table.product.categoryId, table.productCategory.id))
		.where(
			and(
				eq(table.projectProduct.projectId, projectId),
				eq(table.product.materialType, 'c_material') // Only C-materials for voice ordering
			)
		);

	// Get supplier suggestions if requested (run in parallel with product search)
	const supplierSuggestionsPromise = includeSupplierSuggestions
		? getExternalShopSuggestions(projectId, itemDescription)
		: Promise.resolve([]);

	// If no products assigned to project, return empty (but still include supplier suggestions)
	if (projectProducts.length === 0) {
		const supplierSuggestions = await supplierSuggestionsPromise;
		return {
			query: itemDescription,
			products: [],
			totalFound: 0,
			supplierSuggestions: supplierSuggestions.length > 0 ? supplierSuggestions : undefined
		};
	}

	// Get supplier priorities for tie-breaking
	const supplierPriorities = await getSupplierPriorities(projectId);

	// Prepare products for AI matching
	const productsForAI = projectProducts.map(({ product, category }) => ({
		id: product.id,
		name: product.name,
		description: product.description,
		sku: product.sku,
		unit: product.unit,
		pricePerUnit: product.pricePerUnit,
		categoryName: category?.name || null
	}));

	// Use AI to find the best matches
	const aiMatches = await aiMatchProducts(itemDescription, productsForAI, maxResults);

	// Get user favorites for smart quantity suggestions
	const userFavorites = new Map<string, { usageCount: number; defaultQuantity: number }>();
	if (userId) {
		const favorites = await db
			.select({
				productId: table.userFavorite.productId,
				usageCount: table.userFavorite.usageCount,
				defaultQuantity: table.userFavorite.defaultQuantity
			})
			.from(table.userFavorite)
			.where(
				and(
					eq(table.userFavorite.userId, userId),
					eq(table.userFavorite.projectId, projectId)
				)
			);

		for (const fav of favorites) {
			userFavorites.set(fav.productId, {
				usageCount: fav.usageCount,
				defaultQuantity: fav.defaultQuantity ?? 1
			});
		}
	}

	// Build the product list with match info and supplier priority
	interface ProductWithPriority extends ProductMatch {
		_supplierRank: number;
	}
	const matchedProductsWithPriority: ProductWithPriority[] = [];

	for (const match of aiMatches) {
		const productData = projectProducts.find(p => p.product.id === match.id);
		if (productData) {
			const { product, category } = productData;
			const favorite = userFavorites.get(product.id);
			const supplierRank = supplierPriorities.get(product.supplierId) ?? 999;

			matchedProductsWithPriority.push({
				id: product.id,
				name: product.name,
				sku: product.sku,
				description: product.description,
				unit: product.unit,
				pricePerUnit: product.pricePerUnit,
				categoryName: category?.name || null,
				subcategoryName: null,
				matchScore: match.score,
				matchReason: match.reason,
				usualQuantity: favorite?.defaultQuantity,
				orderCount: favorite?.usageCount,
				_supplierRank: supplierRank
			});
		}
	}

	// Sort by score, using supplier priority as tie-breaker for similar scores (within 0.1)
	matchedProductsWithPriority.sort((a, b) => {
		const scoreDiff = b.matchScore - a.matchScore;
		// If scores are within 0.1 of each other, use supplier priority
		if (Math.abs(scoreDiff) <= 0.1) {
			return a._supplierRank - b._supplierRank;
		}
		return scoreDiff;
	});

	// Remove internal field before returning
	const matchedProducts: ProductMatch[] = matchedProductsWithPriority.map(
		({ _supplierRank, ...product }) => product
	);

	// Wait for supplier suggestions
	const supplierSuggestions = await supplierSuggestionsPromise;

	return {
		query: itemDescription,
		products: matchedProducts,
		totalFound: matchedProducts.length,
		supplierSuggestions: supplierSuggestions.length > 0 ? supplierSuggestions : undefined
	};
}

/**
 * Search for multiple items in a single call.
 * Returns a map of item descriptions to their search results.
 */
export async function searchMultipleItems(
	projectId: string,
	items: Array<{ description: string; searchTerms: string[] }>,
	maxResultsPerItem: number = 3
): Promise<Map<string, SearchResult>> {
	const results = new Map<string, SearchResult>();

	for (const item of items) {
		const result = await searchProjectProducts(
			projectId,
			item.searchTerms,
			item.description,
			maxResultsPerItem
		);
		results.set(item.description, result);
	}

	return results;
}
