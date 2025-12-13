import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { isNotNull } from 'drizzle-orm';

export const load: PageServerLoad = async ({ parent }) => {
	// Projects are already loaded in the layout
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

	return { projects, suppliers };
};
