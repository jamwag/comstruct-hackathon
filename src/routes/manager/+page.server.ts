import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { count } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [projectCount] = await db.select({ count: count() }).from(table.project);
	const [supplierCount] = await db.select({ count: count() }).from(table.supplier);
	const [productCount] = await db.select({ count: count() }).from(table.product);

	return {
		counts: {
			projects: projectCount.count,
			suppliers: supplierCount.count,
			products: productCount.count
		}
	};
};
