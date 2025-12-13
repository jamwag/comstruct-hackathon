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

function findCategoryByName(
	name: string | null,
	categories: CategoryInfo[]
): CategoryInfo | undefined {
	if (!name) return undefined;
	const lower = name.toLowerCase();
	return categories.find((c) => c.name.toLowerCase() === lower);
}

function findConstructionTypeByName(
	name: string,
	types: ConstructionTypeInfo[]
): ConstructionTypeInfo | undefined {
	const lower = name.toLowerCase();
	return types.find((ct) => ct.name.toLowerCase() === lower);
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

// Batch classify multiple products
export async function classifyProducts(
	products: Array<{ id: string; name: string; description: string | null }>,
	categories: CategoryInfo[],
	constructionTypes: ConstructionTypeInfo[]
): Promise<Map<string, ClassificationResult>> {
	const results = new Map<string, ClassificationResult>();

	// Process products sequentially to avoid rate limits
	for (const product of products) {
		try {
			const classification = await classifyProduct(
				product.name,
				product.description,
				categories,
				constructionTypes
			);
			results.set(product.id, classification);
		} catch (error) {
			console.error(`Failed to classify product ${product.id}:`, error);
			// Set default classification on error
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

	return results;
}
