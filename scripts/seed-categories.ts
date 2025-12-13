import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as table from '../src/lib/server/db/schema';
import 'dotenv/config';

// Create standalone database connection for scripts
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error('DATABASE_URL is not set in environment');
	process.exit(1);
}

const client = postgres(DATABASE_URL);
const db = drizzle(client);

// Category hierarchy: 6 broad task-based categories for quick foreman navigation
const categoriesWithSubcategories = [
	{
		id: 'fastening',
		name: 'Fastening',
		sortOrder: 1,
		subcategories: [
			{ id: 'screws-nails', name: 'Screws & Nails' },
			{ id: 'anchors-bolts', name: 'Anchors & Bolts' },
			{ id: 'adhesives-glues', name: 'Adhesives & Glues' },
			{ id: 'tapes', name: 'Tapes' },
			{ id: 'clips-clamps', name: 'Clips & Clamps' }
		]
	},
	{
		id: 'safety',
		name: 'Safety & Protection',
		sortOrder: 2,
		subcategories: [
			{ id: 'hand-protection', name: 'Hand Protection' },
			{ id: 'eye-face-protection', name: 'Eye & Face Protection' },
			{ id: 'head-protection', name: 'Head Protection' },
			{ id: 'respiratory-protection', name: 'Respiratory Protection' },
			{ id: 'workwear', name: 'Workwear & Hi-Vis' },
			{ id: 'first-aid', name: 'First Aid' }
		]
	},
	{
		id: 'tools',
		name: 'Tools & Accessories',
		sortOrder: 3,
		subcategories: [
			{ id: 'hand-tools', name: 'Hand Tools' },
			{ id: 'cutting-sawing', name: 'Cutting & Sawing' },
			{ id: 'drilling-driving', name: 'Drilling & Driving' },
			{ id: 'measuring-marking', name: 'Measuring & Marking' },
			{ id: 'grinding-sanding', name: 'Grinding & Sanding' }
		]
	},
	{
		id: 'electrical',
		name: 'Electrical',
		sortOrder: 4,
		subcategories: [
			{ id: 'cables-wires', name: 'Cables & Wires' },
			{ id: 'connectors-terminals', name: 'Connectors & Terminals' },
			{ id: 'switches-sockets', name: 'Switches & Sockets' },
			{ id: 'lighting', name: 'Lighting' },
			{ id: 'electrical-tapes', name: 'Insulation & Tapes' }
		]
	},
	{
		id: 'coatings-chemicals',
		name: 'Coatings & Chemicals',
		sortOrder: 5,
		subcategories: [
			{ id: 'paints-primers', name: 'Paints & Primers' },
			{ id: 'sealants-silicone', name: 'Sealants & Silicone' },
			{ id: 'cleaners-solvents', name: 'Cleaners & Solvents' },
			{ id: 'lubricants', name: 'Lubricants' },
			{ id: 'foam-fillers', name: 'Foam & Fillers' }
		]
	},
	{
		id: 'site-general',
		name: 'Site & General',
		sortOrder: 6,
		subcategories: [
			{ id: 'signs-barriers', name: 'Signs & Barriers' },
			{ id: 'waste-disposal', name: 'Waste & Disposal' },
			{ id: 'packaging-storage', name: 'Packaging & Storage' },
			{ id: 'cleaning-supplies', name: 'Cleaning Supplies' },
			{ id: 'office-stationery', name: 'Office & Stationery' }
		]
	}
];

// Construction types for product tagging (where is this product typically used?)
const constructionTypes = [
	{ id: 'structural', name: 'Structural Work', sortOrder: 1 },
	{ id: 'civil', name: 'Civil Engineering', sortOrder: 2 },
	{ id: 'interior', name: 'Interior Finishing', sortOrder: 3 },
	{ id: 'facade', name: 'Facade Work', sortOrder: 4 },
	{ id: 'general', name: 'General Use', sortOrder: 5 }
];

async function seed() {
	console.log('Seeding product categories...\n');

	// Seed main categories and subcategories
	let subcategoryOrder = 1;
	for (const category of categoriesWithSubcategories) {
		// Insert main category
		await db
			.insert(table.productCategory)
			.values({
				id: category.id,
				name: category.name,
				sortOrder: category.sortOrder,
				parentId: null
			})
			.onConflictDoNothing();

		console.log(`${category.name}`);

		// Insert subcategories
		for (const sub of category.subcategories) {
			await db
				.insert(table.productCategory)
				.values({
					id: sub.id,
					name: sub.name,
					sortOrder: subcategoryOrder++,
					parentId: category.id
				})
				.onConflictDoNothing();

			console.log(`  - ${sub.name}`);
		}
	}

	console.log('\nSeeding construction types...\n');

	// Seed construction types
	for (const ct of constructionTypes) {
		await db
			.insert(table.constructionType)
			.values({
				id: ct.id,
				name: ct.name,
				sortOrder: ct.sortOrder
			})
			.onConflictDoNothing();

		console.log(`  - ${ct.name}`);
	}

	console.log('\nDone!');
	await client.end();
	process.exit(0);
}

seed().catch(async (err) => {
	console.error('Error seeding:', err);
	await client.end();
	process.exit(1);
});
