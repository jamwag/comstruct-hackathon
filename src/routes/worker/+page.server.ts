import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user!;

	// Get worker's assigned projects
	const workerProjects = await db
		.select({
			project: table.project
		})
		.from(table.projectWorker)
		.innerJoin(table.project, eq(table.projectWorker.projectId, table.project.id))
		.where(eq(table.projectWorker.workerId, user.id));

	const projects = workerProjects.map((wp) => wp.project);

	// Get worker's recent orders
	const recentOrders = await db
		.select({
			order: table.order,
			project: table.project
		})
		.from(table.order)
		.innerJoin(table.project, eq(table.order.projectId, table.project.id))
		.where(eq(table.order.workerId, user.id))
		.orderBy(desc(table.order.createdAt))
		.limit(10);

	return {
		projects,
		recentOrders
	};
};
