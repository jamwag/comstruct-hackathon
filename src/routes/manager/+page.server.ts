import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { count, sum, eq, desc, and } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const projectId = url.searchParams.get('project');

	// Resource counts
	const [supplierCount] = await db.select({ count: count() }).from(table.supplier);
	const [productCount] = await db.select({ count: count() }).from(table.product);

	// Get selected project info
	let selectedProject = null;
	if (projectId) {
		const [project] = await db
			.select()
			.from(table.project)
			.where(eq(table.project.id, projectId));
		selectedProject = project || null;
	}

	// Order analytics - filtered by project if selected
	const orderFilter = projectId
		? and(eq(table.order.status, 'approved'), eq(table.order.projectId, projectId))
		: eq(table.order.status, 'approved');

	const [approvedSpend] = await db
		.select({ total: sum(table.order.totalCents) })
		.from(table.order)
		.where(orderFilter);

	const pendingFilter = projectId
		? and(eq(table.order.status, 'pending'), eq(table.order.projectId, projectId))
		: eq(table.order.status, 'pending');

	const [pendingOrders] = await db
		.select({
			count: count(),
			total: sum(table.order.totalCents)
		})
		.from(table.order)
		.where(pendingFilter);

	const totalFilter = projectId ? eq(table.order.projectId, projectId) : undefined;
	const [totalOrders] = await db
		.select({ count: count() })
		.from(table.order)
		.where(totalFilter);

	// Recent orders (last 10) - filtered by project if selected
	const recentOrdersQuery = db
		.select({
			order: table.order,
			project: table.project,
			worker: table.user
		})
		.from(table.order)
		.innerJoin(table.project, eq(table.order.projectId, table.project.id))
		.innerJoin(table.user, eq(table.order.workerId, table.user.id));

	const recentOrders = projectId
		? await recentOrdersQuery
				.where(eq(table.order.projectId, projectId))
				.orderBy(desc(table.order.createdAt))
				.limit(10)
		: await recentOrdersQuery.orderBy(desc(table.order.createdAt)).limit(10);

	return {
		counts: {
			suppliers: supplierCount.count,
			products: productCount.count
		},
		analytics: {
			totalApprovedSpend: Number(approvedSpend.total) || 0,
			pendingOrdersCount: pendingOrders.count,
			pendingOrdersValue: Number(pendingOrders.total) || 0,
			totalOrdersCount: totalOrders.count
		},
		recentOrders: recentOrders.map((r) => ({
			id: r.order.id,
			orderNumber: r.order.orderNumber,
			status: r.order.status,
			totalCents: r.order.totalCents,
			createdAt: r.order.createdAt,
			priority: r.order.priority,
			projectName: r.project.name,
			workerName: r.worker.username
		})),
		selectedProject,
		projectId
	};
};
