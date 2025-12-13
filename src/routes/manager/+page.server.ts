import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { count, sum, eq, desc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Resource counts
	const [projectCount] = await db.select({ count: count() }).from(table.project);
	const [supplierCount] = await db.select({ count: count() }).from(table.supplier);
	const [productCount] = await db.select({ count: count() }).from(table.product);

	// Order analytics
	const [approvedSpend] = await db
		.select({ total: sum(table.order.totalCents) })
		.from(table.order)
		.where(eq(table.order.status, 'approved'));

	const [pendingOrders] = await db
		.select({
			count: count(),
			total: sum(table.order.totalCents)
		})
		.from(table.order)
		.where(eq(table.order.status, 'pending'));

	const [totalOrders] = await db.select({ count: count() }).from(table.order);

	// Recent orders (last 10)
	const recentOrders = await db
		.select({
			order: table.order,
			project: table.project,
			worker: table.user
		})
		.from(table.order)
		.innerJoin(table.project, eq(table.order.projectId, table.project.id))
		.innerJoin(table.user, eq(table.order.workerId, table.user.id))
		.orderBy(desc(table.order.createdAt))
		.limit(10);

	// Spending by project (approved orders)
	const spendByProject = await db
		.select({
			projectId: table.order.projectId,
			projectName: table.project.name,
			total: sum(table.order.totalCents),
			orderCount: count()
		})
		.from(table.order)
		.innerJoin(table.project, eq(table.order.projectId, table.project.id))
		.where(eq(table.order.status, 'approved'))
		.groupBy(table.order.projectId, table.project.name);

	return {
		counts: {
			projects: projectCount.count,
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
		spendByProject: spendByProject.map((p) => ({
			projectId: p.projectId,
			projectName: p.projectName,
			totalCents: Number(p.total) || 0,
			orderCount: p.orderCount
		}))
	};
};
