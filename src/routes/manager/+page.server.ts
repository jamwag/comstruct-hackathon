import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { count, sum, eq, desc, and, inArray, gte, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	const user = locals.user!;
	const projectId = url.searchParams.get('project');

	// For project managers, get their assigned project IDs
	let allowedProjectIds: string[] | null = null;
	if (user.role === 'project_manager') {
		const assignments = await db
			.select({ projectId: table.projectManagerAssignment.projectId })
			.from(table.projectManagerAssignment)
			.where(eq(table.projectManagerAssignment.managerId, user.id));
		allowedProjectIds = assignments.map((a) => a.projectId);
	}

	// Helper to build project filter condition
	const getProjectFilter = (statusCondition?: ReturnType<typeof eq>) => {
		const conditions: ReturnType<typeof eq>[] = [];
		if (statusCondition) conditions.push(statusCondition);

		if (projectId) {
			// Verify PM has access if they're filtering by project
			if (allowedProjectIds && !allowedProjectIds.includes(projectId)) {
				return null; // No access
			}
			conditions.push(eq(table.order.projectId, projectId));
		} else if (allowedProjectIds && allowedProjectIds.length > 0) {
			conditions.push(inArray(table.order.projectId, allowedProjectIds));
		} else if (allowedProjectIds && allowedProjectIds.length === 0) {
			return null; // PM with no projects
		}

		return conditions.length > 0 ? and(...conditions) : undefined;
	};

	// Resource counts (only show to procurement)
	let supplierCount = { count: 0 };
	let productCount = { count: 0 };
	if (user.role === 'manager') {
		[supplierCount] = await db.select({ count: count() }).from(table.supplier);
		[productCount] = await db.select({ count: count() }).from(table.product);
	}

	// Get selected project info
	let selectedProject = null;
	if (projectId) {
		const [project] = await db
			.select()
			.from(table.project)
			.where(eq(table.project.id, projectId));
		selectedProject = project || null;
	}

	// Order analytics - filtered by project and PM access
	const approvedFilter = getProjectFilter(eq(table.order.status, 'approved'));
	const [approvedSpend] = approvedFilter !== null
		? await db.select({ total: sum(table.order.totalCents) }).from(table.order).where(approvedFilter)
		: [{ total: 0 }];

	const pendingFilter = getProjectFilter(eq(table.order.status, 'pending'));
	const [pendingOrders] = pendingFilter !== null
		? await db.select({ count: count(), total: sum(table.order.totalCents) }).from(table.order).where(pendingFilter)
		: [{ count: 0, total: 0 }];

	const totalFilter = getProjectFilter();
	const [totalOrders] = totalFilter !== null
		? await db.select({ count: count() }).from(table.order).where(totalFilter)
		: [{ count: 0 }];

	// Recent orders (last 10) - filtered by project and PM access
	let recentOrders: Array<{
		order: typeof table.order.$inferSelect;
		project: typeof table.project.$inferSelect;
		worker: typeof table.user.$inferSelect;
	}> = [];

	const recentFilter = getProjectFilter();
	if (recentFilter !== null) {
		recentOrders = await db
			.select({
				order: table.order,
				project: table.project,
				worker: table.user
			})
			.from(table.order)
			.innerJoin(table.project, eq(table.order.projectId, table.project.id))
			.innerJoin(table.user, eq(table.order.workerId, table.user.id))
			.where(recentFilter)
			.orderBy(desc(table.order.createdAt))
			.limit(10);
	}

	// Chart data with configurable time range
	const chartRange = url.searchParams.get('range') || '30d';
	const startDate = new Date();
	startDate.setHours(0, 0, 0, 0);

	// Calculate start date based on range
	switch (chartRange) {
		case '7d':
			startDate.setDate(startDate.getDate() - 7);
			break;
		case '30d':
			startDate.setDate(startDate.getDate() - 30);
			break;
		case '6m':
			startDate.setMonth(startDate.getMonth() - 6);
			break;
		case '1y':
			startDate.setFullYear(startDate.getFullYear() - 1);
			break;
		default:
			startDate.setDate(startDate.getDate() - 30);
	}

	let dailyOrderData: Array<{ date: string; orderCount: number; totalSpend: number }> = [];

	const chartFilter = getProjectFilter();
	if (chartFilter !== null) {
		// Build conditions including the date filter
		const dateCondition = gte(table.order.createdAt, startDate);
		const fullFilter = chartFilter ? and(chartFilter, dateCondition) : dateCondition;

		const rawDailyData = await db
			.select({
				date: sql<string>`DATE(${table.order.createdAt})`.as('date'),
				orderCount: count(),
				totalSpend: sum(table.order.totalCents)
			})
			.from(table.order)
			.where(fullFilter)
			.groupBy(sql`DATE(${table.order.createdAt})`)
			.orderBy(sql`DATE(${table.order.createdAt})`);

		// Fill in missing days with zeros
		const dataMap = new Map(rawDailyData.map(d => [d.date, d]));
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
			const dateStr = d.toISOString().split('T')[0];
			const existing = dataMap.get(dateStr);
			dailyOrderData.push({
				date: dateStr,
				orderCount: existing?.orderCount ?? 0,
				totalSpend: Number(existing?.totalSpend) || 0
			});
		}
	}

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
		dailyOrderData,
		chartRange,
		selectedProject,
		projectId
	};
};
