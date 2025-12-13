import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	// Procurement-only route
	if (locals.user?.role !== 'manager') {
		throw redirect(302, '/manager/products');
	}

	const [result] = await db
		.select({
			product: table.product,
			supplier: table.supplier,
			category: table.productCategory
		})
		.from(table.product)
		.leftJoin(table.supplier, eq(table.product.supplierId, table.supplier.id))
		.leftJoin(table.productCategory, eq(table.product.categoryId, table.productCategory.id))
		.where(eq(table.product.id, params.id));

	if (!result) {
		throw error(404, 'Product not found');
	}

	return {
		product: result.product,
		supplier: result.supplier,
		category: result.category
	};
};

export const actions: Actions = {
	updateMaterialType: async ({ params, request, locals }) => {
		// Procurement-only action
		if (locals.user?.role !== 'manager') {
			return fail(403, { message: 'Not authorized' });
		}

		const formData = await request.formData();
		const materialType = formData.get('materialType') as 'c_material' | 'a_material';

		if (!['c_material', 'a_material'].includes(materialType)) {
			return fail(400, { message: 'Invalid material type' });
		}

		await db
			.update(table.product)
			.set({ materialType })
			.where(eq(table.product.id, params.id));

		return { success: true };
	}
};
