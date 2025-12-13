import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
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

export interface SearchResult {
	query: string;
	products: ProductMatch[];
	totalFound: number;
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
 * Search for products assigned to a specific project using AI-powered semantic matching.
 * The AI looks at ALL products and picks the most relevant ones for the user's request.
 * If userId is provided, includes smart quantity suggestions based on order history.
 */
export async function searchProjectProducts(
	projectId: string,
	searchTerms: string[],
	itemDescription: string,
	maxResults: number = 5,
	userId?: string
): Promise<SearchResult> {
	// Get all products assigned to this project
	const projectProducts = await db
		.select({
			product: table.product,
			category: table.productCategory
		})
		.from(table.projectProduct)
		.innerJoin(table.product, eq(table.projectProduct.productId, table.product.id))
		.leftJoin(table.productCategory, eq(table.product.categoryId, table.productCategory.id))
		.where(eq(table.projectProduct.projectId, projectId));

	// If no products assigned to project, return empty
	if (projectProducts.length === 0) {
		return {
			query: itemDescription,
			products: [],
			totalFound: 0
		};
	}

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

	// Build the final product list with match info
	const matchedProducts: ProductMatch[] = [];

	for (const match of aiMatches) {
		const productData = projectProducts.find(p => p.product.id === match.id);
		if (productData) {
			const { product, category } = productData;
			const favorite = userFavorites.get(product.id);

			matchedProducts.push({
				id: product.id,
				name: product.name,
				sku: product.sku,
				description: product.description,
				unit: product.unit,
				pricePerUnit: product.pricePerUnit,
				categoryName: category?.name || null,
				subcategoryName: null, // Simplified - can add later if needed
				matchScore: match.score,
				matchReason: match.reason,
				// Include smart quantity suggestion if user has ordered before
				usualQuantity: favorite?.defaultQuantity,
				orderCount: favorite?.usageCount
			});
		}
	}

	return {
		query: itemDescription,
		products: matchedProducts,
		totalFound: matchedProducts.length
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
