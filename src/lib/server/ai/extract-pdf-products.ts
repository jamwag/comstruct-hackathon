import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';

export interface ExtractedProduct {
	sku: string;
	name: string;
	unit: string;
	pricePerUnit: number;
	description?: string;
}

export interface PdfExtractionResult {
	products: ExtractedProduct[];
	supplierName?: string;
	confidence: number;
}

export async function extractProductsFromPdf(pdfBase64: string): Promise<PdfExtractionResult> {
	const apiKey = env.ANTHROPIC_API_KEY;
	if (!apiKey) {
		throw new Error('ANTHROPIC_API_KEY is not set');
	}

	const anthropic = new Anthropic({ apiKey });

	const response = await anthropic.messages.create({
		model: 'claude-haiku-4-5-20251001',
		max_tokens: 4000,
		messages: [
			{
				role: 'user',
				content: [
					{
						type: 'document',
						source: {
							type: 'base64',
							media_type: 'application/pdf',
							data: pdfBase64
						}
					},
					{
						type: 'text',
						text: `Extract all products from this supplier contract/price list document.

Return a JSON object with this exact structure:
{
  "supplierName": "name of the supplier if found",
  "products": [
    {
      "sku": "product ID or SKU",
      "name": "product name",
      "unit": "unit of measure (pcs, pairs, roll, can, etc.)",
      "pricePerUnit": 0.00
    }
  ],
  "confidence": 0.0-1.0
}

Rules:
- Extract ALL products from any tables in the document
- pricePerUnit should be a number (not string), representing the unit price
- If there's a "Line Total" column, use "Unit Price" not "Line Total"
- confidence should reflect how confident you are in the extraction accuracy
- If no products found, return empty products array

Return ONLY valid JSON, no other text.`
					}
				]
			}
		]
	});

	const content = response.content[0];
	if (content.type !== 'text') {
		throw new Error('Unexpected response type from Claude');
	}

	// Parse the JSON response - strip markdown code blocks if present
	let jsonText = content.text.trim();
	if (jsonText.startsWith('```')) {
		jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
	}

	let parsed: {
		supplierName?: string;
		products?: Array<{
			sku?: string;
			name?: string;
			unit?: string;
			pricePerUnit?: number;
		}>;
		confidence?: number;
	};

	try {
		parsed = JSON.parse(jsonText);
	} catch {
		console.error('Failed to parse PDF extraction response:', content.text);
		return {
			products: [],
			confidence: 0
		};
	}

	// Validate and transform products
	const products: ExtractedProduct[] = (parsed.products || [])
		.filter((p) => p.sku && p.name && typeof p.pricePerUnit === 'number')
		.map((p) => ({
			sku: String(p.sku),
			name: String(p.name),
			unit: String(p.unit || 'pcs'),
			pricePerUnit: Math.round((p.pricePerUnit || 0) * 100) // Convert to cents
		}));

	return {
		products,
		supplierName: parsed.supplierName,
		confidence: parsed.confidence || 0
	};
}
