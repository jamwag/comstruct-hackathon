import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const projects = await db
		.select()
		.from(table.project)
		.orderBy(desc(table.project.createdAt));

	return { projects };
};
