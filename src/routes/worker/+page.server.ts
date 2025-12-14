import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { isNotNull, eq, inArray, and } from 'drizzle-orm';

export const load: PageServerLoad = async ({ parent }) => {
	// Projects are loaded in the layout
	const { projects } = await parent();

	// Fetch suppliers with external shop URLs for PunchOut
	const suppliers = await db
		.select({
			id: table.supplier.id,
			name: table.supplier.name,
			shopUrl: table.supplier.shopUrl
		})
		.from(table.supplier)
		.where(isNotNull(table.supplier.shopUrl));

	// Fetch active product kits for all assigned projects
	const projectIds = projects.map((p) => p.id);
	let kits: Array<{
		id: string;
		projectId: string;
		name: string;
		description: string | null;
		icon: string | null;
		itemCount: number;
		totalPrice: number;
		items: Array<{
			productId: string;
			name: string;
			sku: string;
			quantity: number;
			pricePerUnit: number;
			unit: string;
		}>;
	}> = [];

	if (projectIds.length > 0) {
		const rawKits = await db
			.select()
			.from(table.productKit)
			.where(
				and(
					inArray(table.productKit.projectId, projectIds),
					eq(table.productKit.isActive, true)
				)
			);

		// Get items for each kit
		kits = await Promise.all(
			rawKits.map(async (kit) => {
				const items = await db
					.select({
						productId: table.product.id,
						name: table.product.name,
						sku: table.product.sku,
						quantity: table.productKitItem.quantity,
						pricePerUnit: table.product.pricePerUnit,
						unit: table.product.unit
					})
					.from(table.productKitItem)
					.innerJoin(table.product, eq(table.productKitItem.productId, table.product.id))
					.where(eq(table.productKitItem.kitId, kit.id));

				const totalPrice = items.reduce(
					(sum, item) => sum + item.pricePerUnit * item.quantity,
					0
				);

				return {
					id: kit.id,
					projectId: kit.projectId,
					name: kit.name,
					description: kit.description,
					icon: kit.icon,
					itemCount: items.length,
					totalPrice,
					items
				};
			})
		);
	}

	return { projects, suppliers, kits };
};
