import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { userFavorite, product, projectProduct } from '$lib/server/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { encodeBase32LowerCase } from '@oslojs/encoding';

function generateId() {
	const bytes = crypto.getRandomValues(new Uint8Array(15));
	return encodeBase32LowerCase(bytes);
}

export interface FavoriteProduct {
	id: string;
	productId: string;
	productName: string;
	sku: string;
	pricePerUnit: number;
	unit: string;
	usageCount: number;
	defaultQuantity: number;
}

/**
 * GET /api/voice/favorites
 * Fetch user's favorite products for a project
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const projectId = url.searchParams.get('projectId');
	if (!projectId) {
		throw error(400, 'Project ID is required');
	}

	// Get user's favorites for this project, ordered by usage count
	const favorites = await db
		.select({
			id: userFavorite.id,
			productId: userFavorite.productId,
			usageCount: userFavorite.usageCount,
			defaultQuantity: userFavorite.defaultQuantity,
			productName: product.name,
			sku: product.sku,
			pricePerUnit: product.pricePerUnit,
			unit: product.unit
		})
		.from(userFavorite)
		.innerJoin(product, eq(userFavorite.productId, product.id))
		.innerJoin(
			projectProduct,
			and(eq(projectProduct.productId, product.id), eq(projectProduct.projectId, projectId))
		)
		.where(
			and(
				eq(userFavorite.userId, locals.user.id),
				eq(userFavorite.projectId, projectId)
			)
		)
		.orderBy(desc(userFavorite.usageCount))
		.limit(10);

	const result: FavoriteProduct[] = favorites.map((f) => ({
		id: f.id,
		productId: f.productId,
		productName: f.productName,
		sku: f.sku,
		pricePerUnit: f.pricePerUnit,
		unit: f.unit,
		usageCount: f.usageCount,
		defaultQuantity: f.defaultQuantity ?? 1
	}));

	return json({ favorites: result });
};

/**
 * POST /api/voice/favorites
 * Track a product as a favorite (or update usage count if it already exists)
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json();
	const { projectId, productId, quantity } = body;

	if (!projectId || !productId) {
		throw error(400, 'Project ID and Product ID are required');
	}

	// Check if favorite already exists
	const existing = await db
		.select()
		.from(userFavorite)
		.where(
			and(
				eq(userFavorite.userId, locals.user.id),
				eq(userFavorite.productId, productId),
				eq(userFavorite.projectId, projectId)
			)
		)
		.limit(1);

	if (existing.length > 0) {
		// Update existing favorite - increment usage count and update default quantity
		await db
			.update(userFavorite)
			.set({
				usageCount: sql`${userFavorite.usageCount} + 1`,
				lastUsedAt: new Date(),
				defaultQuantity: quantity || existing[0].defaultQuantity
			})
			.where(eq(userFavorite.id, existing[0].id));

		return json({ success: true, updated: true });
	}

	// Create new favorite
	await db.insert(userFavorite).values({
		id: generateId(),
		userId: locals.user.id,
		productId,
		projectId,
		usageCount: 1,
		lastUsedAt: new Date(),
		defaultQuantity: quantity || 1
	});

	return json({ success: true, created: true });
};
