import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';

// Types for classification
export interface CategoryInfo {
	id: string;
	name: string;
	parentId: string | null;
}

export interface ConstructionTypeInfo {
	id: string;
	name: string;
}

export interface ClassificationResult {
	categoryId: string | null;
	categoryName: string | null;
	categoryConfidence: number;
	subcategoryId: string | null;
	subcategoryName: string | null;
	subcategoryConfidence: number;
	constructionTypes: Array<{
		id: string;
		name: string;
		confidence: number;
	}>;
	hazardous: boolean;
	consumableType: 'single-use' | 'reusable' | null;
}

function buildCategoryTree(categories: CategoryInfo[]): string {
	const mainCategories = categories.filter((c) => c.parentId === null);
	const lines: string[] = [];

	for (const main of mainCategories) {
		const subs = categories.filter((c) => c.parentId === main.id);
		if (subs.length > 0) {
			lines.push(`- ${main.name}: ${subs.map((s) => s.name).join(', ')}`);
		} else {
			lines.push(`- ${main.name}`);
		}
	}

	return lines.join('\n');
}

function normalizeForMatch(str: string): string {
	return str
		.toLowerCase()
		.replace(/&/g, 'and')
		.replace(/[^a-z0-9]/g, ''); // Remove all non-alphanumeric
}

function findCategoryByName(
	name: string | null,
	categories: CategoryInfo[]
): CategoryInfo | undefined {
	if (!name) return undefined;

	const normalizedInput = normalizeForMatch(name);

	// First try exact match
	const exactMatch = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
	if (exactMatch) return exactMatch;

	// Then try normalized match
	const normalizedMatch = categories.find(
		(c) => normalizeForMatch(c.name) === normalizedInput
	);
	if (normalizedMatch) return normalizedMatch;

	// Try partial match as fallback
	const partialMatch = categories.find(
		(c) =>
			normalizedInput.includes(normalizeForMatch(c.name)) ||
			normalizeForMatch(c.name).includes(normalizedInput)
	);

	return partialMatch;
}

function findConstructionTypeByName(
	name: string,
	types: ConstructionTypeInfo[]
): ConstructionTypeInfo | undefined {
	const normalizedInput = normalizeForMatch(name);

	// First try exact match
	const exactMatch = types.find((ct) => ct.name.toLowerCase() === name.toLowerCase());
	if (exactMatch) return exactMatch;

	// Then try normalized match
	return types.find((ct) => normalizeForMatch(ct.name) === normalizedInput);
}

export async function classifyProduct(
	name: string,
	description: string | null,
	categories: CategoryInfo[],
	constructionTypes: ConstructionTypeInfo[]
): Promise<ClassificationResult> {
	const apiKey = env.ANTHROPIC_API_KEY;
	if (!apiKey) {
		throw new Error('ANTHROPIC_API_KEY is not set');
	}

	const anthropic = new Anthropic({ apiKey });

	const categoryTree = buildCategoryTree(categories);
	const constructionTypeList = constructionTypes.map((ct) => ct.name).join(', ');

	const prompt = `You are a construction materials classification expert. Classify the following product into the most appropriate category and subcategory.

Product Name: ${name}
Description: ${description || 'No description provided'}

Available Categories (main category: subcategories):
${categoryTree}

Available Construction Types: ${constructionTypeList}

Return a JSON object with these exact fields:
{
  "category": "exact main category name from the list above",
  "categoryConfidence": 0.0-1.0,
  "subcategory": "exact subcategory name or null if unsure",
  "subcategoryConfidence": 0.0-1.0,
  "constructionTypes": ["list of applicable construction type names"],
  "hazardous": true or false,
  "consumableType": "single-use" or "reusable" or null
}

Rules:
- Use exact category/subcategory names from the list
- hazardous=true for chemicals, solvents, spray paints, or items with safety warnings
- consumableType="single-use" for disposables (gloves, trash bags, tape), "reusable" for tools
- constructionTypes should list all applicable construction scenarios

Return ONLY valid JSON, no other text.`;

	const response = await anthropic.messages.create({
		model: 'claude-haiku-4-5-20251001',
		max_tokens: 500,
		messages: [{ role: 'user', content: prompt }]
	});

	const content = response.content[0];
	if (content.type !== 'text') {
		throw new Error('Unexpected response type from Claude');
	}

	// Parse the JSON response - strip markdown code blocks if present
	let parsed: {
		category?: string;
		categoryConfidence?: number;
		subcategory?: string | null;
		subcategoryConfidence?: number;
		constructionTypes?: string[];
		hazardous?: boolean;
		consumableType?: 'single-use' | 'reusable' | null;
	};

	try {
		let jsonText = content.text.trim();
		// Strip markdown code blocks if present
		if (jsonText.startsWith('```')) {
			jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
		}
		parsed = JSON.parse(jsonText);
	} catch {
		console.error('Failed to parse AI response:', content.text);
		// Return default classification on parse error
		return {
			categoryId: null,
			categoryName: null,
			categoryConfidence: 0,
			subcategoryId: null,
			subcategoryName: null,
			subcategoryConfidence: 0,
			constructionTypes: [],
			hazardous: false,
			consumableType: null
		};
	}

	// Map names back to IDs
	const mainCategory = findCategoryByName(parsed.category || null, categories);
	const subcategory = findCategoryByName(parsed.subcategory || null, categories);

	// Debug logging
	console.log('AI Classification result:', {
		productName: name,
		aiCategory: parsed.category,
		aiSubcategory: parsed.subcategory,
		matchedCategory: mainCategory?.name || 'NOT FOUND',
		matchedSubcategory: subcategory?.name || 'NOT FOUND'
	});

	const mappedConstructionTypes = (parsed.constructionTypes || [])
		.map((ctName) => {
			const ct = findConstructionTypeByName(ctName, constructionTypes);
			return ct ? { id: ct.id, name: ct.name, confidence: 0.8 } : null;
		})
		.filter((ct): ct is { id: string; name: string; confidence: number } => ct !== null);

	return {
		categoryId: mainCategory?.id || null,
		categoryName: mainCategory?.name || null,
		categoryConfidence: parsed.categoryConfidence || 0,
		subcategoryId: subcategory?.id || null,
		subcategoryName: subcategory?.name || null,
		subcategoryConfidence: parsed.subcategoryConfidence || 0,
		constructionTypes: mappedConstructionTypes,
		hazardous: parsed.hazardous || false,
		consumableType: parsed.consumableType || null
	};
}

// Batch classify multiple products in a single API call
export async function classifyProductsBatch(
	products: Array<{ id: string; name: string; description: string | null }>,
	categories: CategoryInfo[],
	constructionTypes: ConstructionTypeInfo[]
): Promise<Map<string, ClassificationResult>> {
	const results = new Map<string, ClassificationResult>();

	if (products.length === 0) return results;

	const apiKey = env.ANTHROPIC_API_KEY;
	if (!apiKey) {
		throw new Error('ANTHROPIC_API_KEY is not set');
	}

	const anthropic = new Anthropic({ apiKey });
	const categoryTree = buildCategoryTree(categories);
	const constructionTypeList = constructionTypes.map((ct) => ct.name).join(', ');

	// Process in batches of 20 products per API call
	const BATCH_SIZE = 20;

	for (let i = 0; i < products.length; i += BATCH_SIZE) {
		const batch = products.slice(i, i + BATCH_SIZE);

		const productList = batch
			.map((p, idx) => `${idx + 1}. ID: "${p.id}" | Name: "${p.name}" | Description: "${p.description || 'None'}"`)
			.join('\n');

		const prompt = `You are a construction materials classification expert. Classify ALL the following products into appropriate categories.

Products to classify:
${productList}

Available Categories (main category: subcategories):
${categoryTree}

Available Construction Types: ${constructionTypeList}

Return a JSON array with one object per product, in the same order as listed above:
[
  {
    "id": "product id from above",
    "category": "exact main category name",
    "categoryConfidence": 0.0-1.0,
    "subcategory": "exact subcategory name or null",
    "subcategoryConfidence": 0.0-1.0,
    "constructionTypes": ["applicable construction types"],
    "hazardous": true/false,
    "consumableType": "single-use" or "reusable" or null
  }
]

Rules:
- Use exact category/subcategory names from the list
- hazardous=true for chemicals, solvents, spray paints, safety-warning items
- consumableType="single-use" for disposables, "reusable" for tools
- Return ALL ${batch.length} products in the array

Return ONLY valid JSON array, no other text.`;

		try {
			const response = await anthropic.messages.create({
				model: 'claude-haiku-4-5-20251001',
				max_tokens: 4000,
				messages: [{ role: 'user', content: prompt }]
			});

			const content = response.content[0];
			if (content.type !== 'text') {
				throw new Error('Unexpected response type');
			}

			let jsonText = content.text.trim();
			if (jsonText.startsWith('```')) {
				jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
			}

			const parsed: Array<{
				id: string;
				category?: string;
				categoryConfidence?: number;
				subcategory?: string | null;
				subcategoryConfidence?: number;
				constructionTypes?: string[];
				hazardous?: boolean;
				consumableType?: 'single-use' | 'reusable' | null;
			}> = JSON.parse(jsonText);

			// Map results back to product IDs
			for (const item of parsed) {
				const mainCategory = findCategoryByName(item.category || null, categories);
				const subcategory = findCategoryByName(item.subcategory || null, categories);

				const mappedConstructionTypes = (item.constructionTypes || [])
					.map((ctName) => {
						const ct = findConstructionTypeByName(ctName, constructionTypes);
						return ct ? { id: ct.id, name: ct.name, confidence: 0.8 } : null;
					})
					.filter((ct): ct is { id: string; name: string; confidence: number } => ct !== null);

				results.set(item.id, {
					categoryId: mainCategory?.id || null,
					categoryName: mainCategory?.name || null,
					categoryConfidence: item.categoryConfidence || 0,
					subcategoryId: subcategory?.id || null,
					subcategoryName: subcategory?.name || null,
					subcategoryConfidence: item.subcategoryConfidence || 0,
					constructionTypes: mappedConstructionTypes,
					hazardous: item.hazardous || false,
					consumableType: item.consumableType || null
				});
			}

			console.log(`Batch classified ${parsed.length} products in one API call`);
		} catch (error) {
			console.error('Batch classification failed:', error);
			// Fall back to setting defaults for this batch
			for (const product of batch) {
				results.set(product.id, {
					categoryId: null,
					categoryName: null,
					categoryConfidence: 0,
					subcategoryId: null,
					subcategoryName: null,
					subcategoryConfidence: 0,
					constructionTypes: [],
					hazardous: false,
					consumableType: null
				});
			}
		}
	}

	return results;
}

// Legacy: Classify products one by one (kept for backwards compatibility)
export async function classifyProducts(
	products: Array<{ id: string; name: string; description: string | null }>,
	categories: CategoryInfo[],
	constructionTypes: ConstructionTypeInfo[]
): Promise<Map<string, ClassificationResult>> {
	// Use batch classification by default
	return classifyProductsBatch(products, categories, constructionTypes);
}
