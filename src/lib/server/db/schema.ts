import { pgTable, pgEnum, integer, text, timestamp, primaryKey } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['worker', 'manager']);

export const user = pgTable('user', {
	id: text('id').primaryKey(),
	age: integer('age'),
	username: text('username').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	role: userRoleEnum('role').notNull().default('worker')
});

export type UserRole = 'worker' | 'manager';

export const session = pgTable('session', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id),
	expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull()
});

export type Session = typeof session.$inferSelect;

export type User = typeof user.$inferSelect;

// Projects (construction sites)
export const project = pgTable('project', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	address: text('address'),
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	createdBy: text('created_by').references(() => user.id)
});

export type Project = typeof project.$inferSelect;

// Worker-Project assignments (many-to-many)
export const projectWorker = pgTable(
	'project_worker',
	{
		projectId: text('project_id')
			.references(() => project.id)
			.notNull(),
		workerId: text('worker_id')
			.references(() => user.id)
			.notNull()
	},
	(table) => [primaryKey({ columns: [table.projectId, table.workerId] })]
);

// Product-Project assignments (many-to-many)
export const projectProduct = pgTable(
	'project_product',
	{
		projectId: text('project_id')
			.references(() => project.id)
			.notNull(),
		productId: text('product_id')
			.references(() => product.id)
			.notNull()
	},
	(table) => [primaryKey({ columns: [table.projectId, table.productId] })]
);

// Suppliers
export const supplier = pgTable('supplier', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	contactEmail: text('contact_email'),
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
});

export type Supplier = typeof supplier.$inferSelect;

// Product Categories
export const productCategory = pgTable('product_category', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	parentId: text('parent_id'),
	sortOrder: integer('sort_order').default(0)
});

export type ProductCategory = typeof productCategory.$inferSelect;

// Products
export const product = pgTable('product', {
	id: text('id').primaryKey(),
	supplierId: text('supplier_id')
		.references(() => supplier.id)
		.notNull(),
	categoryId: text('category_id').references(() => productCategory.id),
	sku: text('sku').notNull(),
	name: text('name').notNull(),
	description: text('description'),
	unit: text('unit').notNull(),
	pricePerUnit: integer('price_per_unit').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
});

export type Product = typeof product.$inferSelect;
