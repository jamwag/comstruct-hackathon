import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';

export interface ColumnMapping {
	sourceColumn: string;
	targetField: string;
	confidence: number;
	transformationHint?: string;
}

export interface MappingResult {
	mappings: ColumnMapping[];
	unmappedColumns: string[];
}

// Target schema fields that can be mapped
const TARGET_FIELDS = [
	{ field: 'sku', description: 'Product SKU or article ID (required, unique identifier)' },
	{ field: 'name', description: 'Product name or title (required)' },
	{ field: 'description', description: 'Product description or details' },
	{ field: 'unit', description: 'Unit of measure (Stk, m, kg, Paar, Rolle, etc.)' },
	{ field: 'pricePerUnit', description: 'Price per unit (numeric, will be converted to cents)' },
	{ field: 'manufacturer', description: 'Manufacturer or brand name' },
	{ field: 'packagingUnit', description: 'Packaging description (e.g., "Box of 100", "Roll 50m")' },
	{ field: 'hazardous', description: 'Hazardous material indicator (true/false, yes/no, 1/0)' },
	{
		field: 'consumableType',
		description: 'Disposable vs reusable (Einweg/Mehrweg, single-use/reusable)'
	},
	{ field: 'minOrderQty', description: 'Minimum order quantity (numeric)' },
	{ field: 'supplierSku', description: 'Original supplier article ID or reference number' },
	{ field: 'category', description: 'Product category name (for AI classification)' }
];

export async function mapCsvColumns(
	headers: string[],
	sampleRows: Record<string, unknown>[]
): Promise<MappingResult> {
	const apiKey = env.ANTHROPIC_API_KEY;
	if (!apiKey) {
		throw new Error('ANTHROPIC_API_KEY is not set');
	}

	const anthropic = new Anthropic({ apiKey });

	// Build sample data string
	const sampleData = sampleRows
		.slice(0, 5)
		.map((row, i) => {
			const values = headers.map((h) => `${h}: "${row[h] ?? ''}"`).join(', ');
			return `Row ${i + 1}: ${values}`;
		})
		.join('\n');

	const targetFieldsDesc = TARGET_FIELDS.map((f) => `- ${f.field}: ${f.description}`).join('\n');

	const prompt = `You are a data mapping expert for construction material products. Analyze the CSV columns and map them to the product schema fields.

CSV Headers: ${headers.join(', ')}

Sample Data:
${sampleData}

Target Schema Fields:
${targetFieldsDesc}

Return a JSON array of mappings. For each CSV column that can be mapped, include:
{
  "sourceColumn": "exact CSV column name",
  "targetField": "exact schema field name from the list above",
  "confidence": 0.0-1.0,
  "transformationHint": "optional hint for data transformation"
}

Mapping rules:
1. "artikel_id", "artikelnummer", "sku", "id" → likely "sku" or "supplierSku"
2. "artikelname", "name", "bezeichnung", "produkt" → likely "name"
3. "preis", "price", "preis_eur" → likely "pricePerUnit"
4. "einheit", "unit", "me" → likely "unit"
5. "hersteller", "marke", "brand" → likely "manufacturer"
6. "gefahrgut", "hazmat" → likely "hazardous"
7. "verbrauchsart", "einweg/mehrweg" → likely "consumableType"
8. "kategorie", "category" → likely "category" (for AI classification reference)

For transformationHint, include notes like:
- "multiply by 100 to convert to cents" for prices
- "convert Einweg→single-use, Mehrweg→reusable" for consumableType
- "convert to boolean" for hazardous

Only map columns you're confident about. Skip unmappable columns.
Return ONLY valid JSON array, no other text.`;

	const response = await anthropic.messages.create({
		model: 'claude-haiku-4-5-20251001',
		max_tokens: 1000,
		messages: [{ role: 'user', content: prompt }]
	});

	const content = response.content[0];
	if (content.type !== 'text') {
		throw new Error('Unexpected response type from Claude');
	}

	let mappings: ColumnMapping[];
	try {
		mappings = JSON.parse(content.text);
		if (!Array.isArray(mappings)) {
			throw new Error('Response is not an array');
		}
	} catch {
		console.error('Failed to parse AI mapping response:', content.text);
		// Return empty mappings on parse error
		return {
			mappings: [],
			unmappedColumns: headers
		};
	}

	// Validate mappings
	const validTargetFields = TARGET_FIELDS.map((f) => f.field);
	const validMappings = mappings.filter(
		(m) =>
			headers.includes(m.sourceColumn) &&
			validTargetFields.includes(m.targetField) &&
			typeof m.confidence === 'number'
	);

	// Find unmapped columns
	const mappedColumns = new Set(validMappings.map((m) => m.sourceColumn));
	const unmappedColumns = headers.filter((h) => !mappedColumns.has(h));

	return {
		mappings: validMappings,
		unmappedColumns
	};
}

// Apply suggested mappings to transform row data
export function applyMappings(
	row: Record<string, unknown>,
	mappings: ColumnMapping[]
): Record<string, unknown> {
	const result: Record<string, unknown> = {};

	for (const mapping of mappings) {
		const value = row[mapping.sourceColumn];
		if (value === undefined || value === null || value === '') continue;

		let transformedValue: unknown = value;

		// Apply transformations based on target field
		switch (mapping.targetField) {
			case 'pricePerUnit':
				// Convert to cents
				if (typeof value === 'number') {
					transformedValue = Math.round(value * 100);
				} else if (typeof value === 'string') {
					const parsed = parseFloat(value.replace(',', '.'));
					transformedValue = isNaN(parsed) ? 0 : Math.round(parsed * 100);
				}
				break;

			case 'hazardous':
				// Convert to boolean
				if (typeof value === 'boolean') {
					transformedValue = value;
				} else if (typeof value === 'string') {
					const lower = value.toLowerCase();
					transformedValue = ['true', 'yes', 'ja', '1', 'x'].includes(lower);
				} else if (typeof value === 'number') {
					transformedValue = value === 1;
				}
				break;

			case 'consumableType':
				// Map German terms
				if (typeof value === 'string') {
					const lower = value.toLowerCase();
					if (lower.includes('einweg') || lower.includes('single')) {
						transformedValue = 'single-use';
					} else if (lower.includes('mehrweg') || lower.includes('reusable')) {
						transformedValue = 'reusable';
					} else {
						transformedValue = null;
					}
				}
				break;

			case 'minOrderQty':
				// Convert to integer
				if (typeof value === 'number') {
					transformedValue = Math.round(value);
				} else if (typeof value === 'string') {
					const parsed = parseInt(value, 10);
					transformedValue = isNaN(parsed) ? 1 : parsed;
				}
				break;
		}

		result[mapping.targetField] = transformedValue;
	}

	return result;
}
