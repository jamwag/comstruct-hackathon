import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { eq, isNull } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
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

	// Get selected project from URL or default to first
	const selectedProjectId = url.searchParams.get('project') || projects[0]?.id;
	const selectedProject = projects.find((p) => p.id === selectedProjectId) || null;

	// Get URL params for navigation state
	const categoryId = url.searchParams.get('category');
	const subcategoryId = url.searchParams.get('sub');

	// Load main categories (no parent)
	const mainCategories = await db
		.select()
		.from(table.productCategory)
		.where(isNull(table.productCategory.parentId))
		.orderBy(table.productCategory.sortOrder);

	// If category selected, load its subcategories
	let subcategories: typeof mainCategories = [];
	let selectedCategory: (typeof mainCategories)[0] | null = null;
	if (categoryId) {
		selectedCategory = mainCategories.find((c) => c.id === categoryId) || null;
		subcategories = await db
			.select()
			.from(table.productCategory)
			.where(eq(table.productCategory.parentId, categoryId))
			.orderBy(table.productCategory.sortOrder);
	}

	// If subcategory selected, load products
	let products: Array<{
		id: string;
		name: string;
		sku: string;
		pricePerUnit: number;
		unit: string;
		description: string | null;
	}> = [];
	let selectedSubcategory: (typeof mainCategories)[0] | null = null;
	if (subcategoryId) {
		selectedSubcategory = subcategories.find((c) => c.id === subcategoryId) || null;
		const productRows = await db
			.select({
				id: table.product.id,
				name: table.product.name,
				sku: table.product.sku,
				pricePerUnit: table.product.pricePerUnit,
				unit: table.product.unit,
				description: table.product.description
			})
			.from(table.product)
			.where(eq(table.product.subcategoryId, subcategoryId))
			.orderBy(table.product.name);
		products = productRows;
	}

	// Category icons mapping
	const categoryIcons: Record<string, string> = {
		fastening: '🔩',
		safety: '🦺',
		tools: '🔧',
		electrical: '⚡',
		'coatings-chemicals': '🎨',
		'site-general': '📦'
	};

	return {
		projects,
		selectedProject,
		mainCategories: mainCategories.map((c) => ({
			...c,
			icon: categoryIcons[c.id] || '📦'
		})),
		subcategories,
		products,
		selectedCategory,
		selectedSubcategory,
		categoryId,
		subcategoryId
	};
};
