import {
	pgTable,
	pgEnum,
	integer,
	text,
	timestamp,
	primaryKey,
	boolean,
	foreignKey
} from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['worker', 'project_manager', 'manager']);
export const consumableTypeEnum = pgEnum('consumable_type', ['single-use', 'reusable']);
export const orderStatusEnum = pgEnum('order_status', ['pending', 'approved', 'rejected']);
export const orderPriorityEnum = pgEnum('order_priority', ['normal', 'urgent']);
export const supplierResponseStatusEnum = pgEnum('supplier_response_status', [
	'confirmed',
	'rejected',
	'partial'
]);
export const materialTypeEnum = pgEnum('material_type', ['c_material', 'a_material']);

export const user = pgTable('user', {
	id: text('id').primaryKey(),
	age: integer('age'),
	username: text('username').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	role: userRoleEnum('role').notNull().default('worker')
});

export type UserRole = 'worker' | 'project_manager' | 'manager';

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
	autoApprovalThreshold: integer('auto_approval_threshold').default(20000), // 200 CHF in cents
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

// Project Manager-Project assignments (many-to-many)
export const projectManagerAssignment = pgTable(
	'project_manager_assignment',
	{
		projectId: text('project_id')
			.references(() => project.id, { onDelete: 'cascade' })
			.notNull(),
		managerId: text('manager_id')
			.references(() => user.id, { onDelete: 'cascade' })
			.notNull(),
		assignedAt: timestamp('assigned_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
	},
	(table) => [primaryKey({ columns: [table.projectId, table.managerId] })]
);

export type ProjectManagerAssignment = typeof projectManagerAssignment.$inferSelect;

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

// Project-Supplier preferences (many-to-many with ranking)
export const projectSupplier = pgTable(
	'project_supplier',
	{
		projectId: text('project_id')
			.references(() => project.id, { onDelete: 'cascade' })
			.notNull(),
		supplierId: text('supplier_id')
			.references(() => supplier.id, { onDelete: 'cascade' })
			.notNull(),
		preferenceRank: integer('preference_rank').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
	},
	(table) => [primaryKey({ columns: [table.projectId, table.supplierId] })]
);

export type ProjectSupplier = typeof projectSupplier.$inferSelect;

// Suppliers
export const supplier = pgTable('supplier', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	contactEmail: text('contact_email'),
	shopUrl: text('shop_url'), // External PunchOut catalog URL
	description: text('description'), // Used by voice assistant to suggest external catalog for relevant searches
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
	subcategoryId: text('subcategory_id').references(() => productCategory.id),
	sku: text('sku').notNull(),
	name: text('name').notNull(),
	description: text('description'),
	unit: text('unit').notNull(),
	pricePerUnit: integer('price_per_unit').notNull(),
	manufacturer: text('manufacturer'),
	packagingUnit: text('packaging_unit'),
	hazardous: boolean('hazardous').default(false),
	consumableType: consumableTypeEnum('consumable_type'),
	minOrderQty: integer('min_order_qty').default(1),
	supplierSku: text('supplier_sku'),
	materialType: materialTypeEnum('material_type').default('c_material').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
});

export type Product = typeof product.$inferSelect;
export type MaterialType = 'c_material' | 'a_material';

// Construction Types (Hochbau, Tiefbau, Rohbau, etc.)
export const constructionType = pgTable('construction_type', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	sortOrder: integer('sort_order').default(0)
});

export type ConstructionType = typeof constructionType.$inferSelect;

// Product-ConstructionType junction (many-to-many)
export const productConstructionType = pgTable(
	'product_construction_type',
	{
		productId: text('product_id').notNull(),
		constructionTypeId: text('construction_type_id').notNull()
	},
	(table) => [
		primaryKey({ columns: [table.productId, table.constructionTypeId] }),
		foreignKey({
			columns: [table.productId],
			foreignColumns: [product.id],
			name: 'pct_product_fk'
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.constructionTypeId],
			foreignColumns: [constructionType.id],
			name: 'pct_construction_type_fk'
		}).onDelete('cascade')
	]
);

// Orders (worker product requests)
export const order = pgTable('order', {
	id: text('id').primaryKey(),
	orderNumber: text('order_number').notNull(),
	projectId: text('project_id')
		.references(() => project.id)
		.notNull(),
	workerId: text('worker_id')
		.references(() => user.id)
		.notNull(),
	status: orderStatusEnum('status').notNull().default('pending'),
	totalCents: integer('total_cents').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	approvedAt: timestamp('approved_at', { withTimezone: true, mode: 'date' }),
	approvedBy: text('approved_by').references(() => user.id),
	rejectionReason: text('rejection_reason'),
	// Voice ordering enhancements
	notes: text('notes'),
	priority: orderPriorityEnum('priority').default('normal')
});

export type Order = typeof order.$inferSelect;

// Order Items (products in an order)
export const orderItem = pgTable('order_item', {
	id: text('id').primaryKey(),
	orderId: text('order_id')
		.references(() => order.id, { onDelete: 'cascade' })
		.notNull(),
	productId: text('product_id').references(() => product.id), // nullable for PunchOut items
	quantity: integer('quantity').notNull(),
	pricePerUnit: integer('price_per_unit').notNull(), // snapshot at order time
	totalCents: integer('total_cents').notNull(),
	// PunchOut item fields (when productId is null)
	punchoutSku: text('punchout_sku'),
	punchoutName: text('punchout_name'),
	punchoutUnit: text('punchout_unit')
});

export type OrderItem = typeof orderItem.$inferSelect;

// Supplier Responses - tracks supplier confirmations/rejections per order
export const orderSupplierResponse = pgTable('order_supplier_response', {
	id: text('id').primaryKey(),
	orderId: text('order_id')
		.references(() => order.id, { onDelete: 'cascade' })
		.notNull(),
	supplierId: text('supplier_id')
		.references(() => supplier.id)
		.notNull(),
	status: supplierResponseStatusEnum('status').notNull(),
	deliveryDate: timestamp('delivery_date', { mode: 'date' }),
	message: text('message'),
	receivedAt: timestamp('received_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
});

export type OrderSupplierResponse = typeof orderSupplierResponse.$inferSelect;

// User Favorites - tracks frequently ordered products per user/project
export const userFavorite = pgTable(
	'user_favorite',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.references(() => user.id, { onDelete: 'cascade' })
			.notNull(),
		productId: text('product_id')
			.references(() => product.id, { onDelete: 'cascade' })
			.notNull(),
		projectId: text('project_id').references(() => project.id, { onDelete: 'cascade' }),
		usageCount: integer('usage_count').default(1).notNull(),
		lastUsedAt: timestamp('last_used_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
		defaultQuantity: integer('default_quantity').default(1)
	}
);

export type UserFavorite = typeof userFavorite.$inferSelect;

// Product Kits - predefined bundles of products for quick ordering
export const productKit = pgTable('product_kit', {
	id: text('id').primaryKey(),
	projectId: text('project_id')
		.references(() => project.id, { onDelete: 'cascade' })
		.notNull(),
	name: text('name').notNull(),
	description: text('description'),
	icon: text('icon').default('📦'), // Emoji icon for visual display
	isActive: boolean('is_active').default(true).notNull(),
	createdBy: text('created_by').references(() => user.id),
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
});

export type ProductKit = typeof productKit.$inferSelect;

// Kit Items - products included in a kit with default quantities
export const productKitItem = pgTable(
	'product_kit_item',
	{
		kitId: text('kit_id')
			.references(() => productKit.id, { onDelete: 'cascade' })
			.notNull(),
		productId: text('product_id')
			.references(() => product.id, { onDelete: 'cascade' })
			.notNull(),
		quantity: integer('quantity').default(1).notNull()
	},
	(table) => [primaryKey({ columns: [table.kitId, table.productId] })]
);

export type ProductKitItem = typeof productKitItem.$inferSelect;
