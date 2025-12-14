import { error, fail } from '@sveltejs/kit';
import { eq, and, asc } from 'drizzle-orm';
import { encodeBase32LowerCase } from '@oslojs/encoding';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

function generateId() {
	const bytes = crypto.getRandomValues(new Uint8Array(15));
	return encodeBase32LowerCase(bytes);
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const [project] = await db
		.select()
		.from(table.project)
		.where(eq(table.project.id, params.id));

	if (!project) {
		throw error(404, 'Project not found');
	}

	// Get all kits for this project with their items
	const kits = await db
		.select()
		.from(table.productKit)
		.where(eq(table.productKit.projectId, params.id))
		.orderBy(asc(table.productKit.name));

	// Get kit items with product details
	const kitsWithItems = await Promise.all(
		kits.map(async (kit) => {
			const items = await db
				.select({
					product: table.product,
					quantity: table.productKitItem.quantity
				})
				.from(table.productKitItem)
				.innerJoin(table.product, eq(table.productKitItem.productId, table.product.id))
				.where(eq(table.productKitItem.kitId, kit.id));

			const totalPrice = items.reduce(
				(sum, item) => sum + item.product.pricePerUnit * item.quantity,
				0
			);

			return {
				...kit,
				items,
				itemCount: items.length,
				totalPrice
			};
		})
	);

	// Get all products assigned to this project (for adding to kits)
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
				eq(table.projectProduct.projectId, params.id),
				eq(table.product.materialType, 'c_material')
			)
		)
		.orderBy(asc(table.product.name));

	return {
		project,
		kits: kitsWithItems,
		products: projectProducts,
		userRole: locals.user?.role
	};
};

export const actions: Actions = {
	createKit: async ({ params, request, locals }) => {
		const formData = await request.formData();
		const name = formData.get('name');
		const description = formData.get('description');
		const icon = formData.get('icon') || '📦';

		if (typeof name !== 'string' || name.trim().length === 0) {
			return fail(400, { message: 'Kit name is required' });
		}

		const kitId = generateId();

		await db.insert(table.productKit).values({
			id: kitId,
			projectId: params.id,
			name: name.trim(),
			description: typeof description === 'string' ? description.trim() : null,
			icon: typeof icon === 'string' ? icon : '📦',
			createdBy: locals.user?.id
		});

		return { success: true, kitId };
	},

	deleteKit: async ({ request }) => {
		const formData = await request.formData();
		const kitId = formData.get('kitId');

		if (typeof kitId !== 'string') {
			return fail(400, { message: 'Invalid kit ID' });
		}

		await db.delete(table.productKit).where(eq(table.productKit.id, kitId));

		return { success: true };
	},

	addItem: async ({ request }) => {
		const formData = await request.formData();
		const kitId = formData.get('kitId');
		const productId = formData.get('productId');
		const quantity = parseInt(formData.get('quantity') as string) || 1;

		if (typeof kitId !== 'string' || typeof productId !== 'string') {
			return fail(400, { message: 'Invalid kit or product ID' });
		}

		// Check if item already exists
		const [existing] = await db
			.select()
			.from(table.productKitItem)
			.where(
				and(
					eq(table.productKitItem.kitId, kitId),
					eq(table.productKitItem.productId, productId)
				)
			);

		if (existing) {
			// Update quantity
			await db
				.update(table.productKitItem)
				.set({ quantity: existing.quantity + quantity })
				.where(
					and(
						eq(table.productKitItem.kitId, kitId),
						eq(table.productKitItem.productId, productId)
					)
				);
		} else {
			await db.insert(table.productKitItem).values({
				kitId,
				productId,
				quantity
			});
		}

		return { success: true };
	},

	updateItemQuantity: async ({ request }) => {
		const formData = await request.formData();
		const kitId = formData.get('kitId');
		const productId = formData.get('productId');
		const quantity = parseInt(formData.get('quantity') as string);

		if (typeof kitId !== 'string' || typeof productId !== 'string' || isNaN(quantity)) {
			return fail(400, { message: 'Invalid data' });
		}

		if (quantity <= 0) {
			// Remove item if quantity is 0 or less
			await db
				.delete(table.productKitItem)
				.where(
					and(
						eq(table.productKitItem.kitId, kitId),
						eq(table.productKitItem.productId, productId)
					)
				);
		} else {
			await db
				.update(table.productKitItem)
				.set({ quantity })
				.where(
					and(
						eq(table.productKitItem.kitId, kitId),
						eq(table.productKitItem.productId, productId)
					)
				);
		}

		return { success: true };
	},

	removeItem: async ({ request }) => {
		const formData = await request.formData();
		const kitId = formData.get('kitId');
		const productId = formData.get('productId');

		if (typeof kitId !== 'string' || typeof productId !== 'string') {
			return fail(400, { message: 'Invalid data' });
		}

		await db
			.delete(table.productKitItem)
			.where(
				and(
					eq(table.productKitItem.kitId, kitId),
					eq(table.productKitItem.productId, productId)
				)
			);

		return { success: true };
	},

	toggleActive: async ({ request }) => {
		const formData = await request.formData();
		const kitId = formData.get('kitId');
		const isActive = formData.get('isActive') === 'true';

		if (typeof kitId !== 'string') {
			return fail(400, { message: 'Invalid kit ID' });
		}

		await db
			.update(table.productKit)
			.set({ isActive: !isActive })
			.where(eq(table.productKit.id, kitId));

		return { success: true };
	}
};
