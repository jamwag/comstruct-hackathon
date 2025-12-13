import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const suppliers = await db
		.select()
		.from(table.supplier)
		.orderBy(desc(table.supplier.createdAt));

	return { suppliers };
};
