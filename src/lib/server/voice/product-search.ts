import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

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
}

export interface SearchResult {
	query: string;
	products: ProductMatch[];
	totalFound: number;
}

/**
 * Calculate a match score for a product against search terms.
 * Higher scores mean better matches.
 */
function calculateMatchScore(
	product: {
		name: string;
		description: string | null;
		sku: string;
	},
	searchTerms: string[],
	itemDescription: string
): { score: number; reason: string } {
	let score = 0;
	const reasons: string[] = [];

	const productName = product.name.toLowerCase();
	const productDesc = (product.description || '').toLowerCase();
	const productSku = product.sku.toLowerCase();
	const productText = `${productName} ${productDesc} ${productSku}`;

	// Check each search term
	for (const term of searchTerms) {
		const termLower = term.toLowerCase();

		// Exact name match is highest value
		if (productName === termLower) {
			score += 0.5;
			reasons.push(`Exact name match: "${term}"`);
		}
		// Name contains the term
		else if (productName.includes(termLower)) {
			score += 0.35;
			reasons.push(`Name contains: "${term}"`);
		}
		// SKU match
		else if (productSku.includes(termLower)) {
			score += 0.25;
			reasons.push(`SKU match: "${term}"`);
		}
		// Description contains the term
		else if (productDesc.includes(termLower)) {
			score += 0.2;
			reasons.push(`Description match: "${term}"`);
		}
		// Any part of product text contains term
		else if (productText.includes(termLower)) {
			score += 0.15;
			reasons.push(`Content match: "${term}"`);
		}
	}

	// Bonus for matching the original item description
	const descLower = itemDescription.toLowerCase();
	if (productName.includes(descLower)) {
		score += 0.3;
		reasons.push('Matches item description');
	} else if (productText.includes(descLower)) {
		score += 0.15;
		reasons.push('Partial description match');
	}

	// Cap the score at 1.0
	score = Math.min(score, 1.0);

	return {
		score,
		reason: reasons.length > 0 ? reasons.slice(0, 2).join(', ') : 'Partial match'
	};
}

/**
 * Search for products assigned to a specific project that match the given search criteria.
 * Returns the top matches sorted by relevance.
 */
export async function searchProjectProducts(
	projectId: string,
	searchTerms: string[],
	itemDescription: string,
	maxResults: number = 5
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

	// Get subcategory names separately (since we can't join twice on same table easily)
	const subcategoryIds = projectProducts
		.map((p) => p.product.subcategoryId)
		.filter((id): id is string => id !== null);

	const subcategories =
		subcategoryIds.length > 0
			? await db
					.select()
					.from(table.productCategory)
					.where(
						subcategoryIds.length === 1
							? eq(table.productCategory.id, subcategoryIds[0])
							: // For multiple IDs, we'll match any
								eq(table.productCategory.id, subcategoryIds[0])
					)
			: [];

	// Create a map of subcategory names
	const subcategoryMap = new Map<string, string>();
	for (const subcat of subcategories) {
		subcategoryMap.set(subcat.id, subcat.name);
	}

	// Score each product
	const scoredProducts: ProductMatch[] = [];

	for (const { product, category } of projectProducts) {
		const { score, reason } = calculateMatchScore(
			{
				name: product.name,
				description: product.description,
				sku: product.sku
			},
			searchTerms,
			itemDescription
		);

		// Only include products with some match
		if (score > 0.1) {
			scoredProducts.push({
				id: product.id,
				name: product.name,
				sku: product.sku,
				description: product.description,
				unit: product.unit,
				pricePerUnit: product.pricePerUnit,
				categoryName: category?.name || null,
				subcategoryName: product.subcategoryId ? subcategoryMap.get(product.subcategoryId) || null : null,
				matchScore: score,
				matchReason: reason
			});
		}
	}

	// Sort by score (highest first) and take top results
	scoredProducts.sort((a, b) => b.matchScore - a.matchScore);
	const topProducts = scoredProducts.slice(0, maxResults);

	return {
		query: itemDescription,
		products: topProducts,
		totalFound: scoredProducts.length
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
