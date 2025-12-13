export interface PunchOutItem {
	productId: string;
	name: string;
	sku: string;
	quantity: number;
	pricePerUnit: number; // in cents
	unit: string;
	currency: string;
}

export interface PunchOutResponse {
	buyerCookie: string | null;
	total: number; // in cents
	currency: string;
	items: PunchOutItem[];
}

/**
 * Parses cXML PunchOutOrderMessage and extracts cart items
 */
export function parsePunchOutCxml(cxml: string): PunchOutResponse {
	const items: PunchOutItem[] = [];

	// Extract BuyerCookie
	const buyerCookieMatch = cxml.match(/<BuyerCookie>(.*?)<\/BuyerCookie>/s);
	const buyerCookie = buyerCookieMatch ? buyerCookieMatch[1].trim() : null;

	// Extract total
	const totalMatch = cxml.match(
		/<PunchOutOrderMessageHeader[^>]*>[\s\S]*?<Total>[\s\S]*?<Money\s+currency="(\w+)">([\d.]+)<\/Money>/
	);
	const totalCurrency = totalMatch ? totalMatch[1] : 'USD';
	const totalAmount = totalMatch ? Math.round(parseFloat(totalMatch[2]) * 100) : 0;

	// Extract ItemIn elements
	const itemRegex = /<ItemIn\s+quantity="(\d+)"[^>]*>([\s\S]*?)<\/ItemIn>/g;

	let match;
	while ((match = itemRegex.exec(cxml)) !== null) {
		const quantity = parseInt(match[1], 10);
		const itemContent = match[2];

		// Extract SupplierPartID
		const partIdMatch = itemContent.match(/<SupplierPartID>(.*?)<\/SupplierPartID>/);
		const partId = partIdMatch ? partIdMatch[1].trim() : '';

		// Extract Description
		const descMatch = itemContent.match(/<Description[^>]*>(.*?)<\/Description>/s);
		const description = descMatch ? descMatch[1].trim() : partId || 'Unknown Item';

		// Extract UnitPrice
		const priceMatch = itemContent.match(
			/<UnitPrice>[\s\S]*?<Money\s+currency="(\w+)">([\d.]+)<\/Money>/
		);
		const currency = priceMatch ? priceMatch[1] : 'USD';
		const price = priceMatch ? Math.round(parseFloat(priceMatch[2]) * 100) : 0;

		// Extract UnitOfMeasure
		const unitMatch = itemContent.match(/<UnitOfMeasure>(.*?)<\/UnitOfMeasure>/);
		const unit = unitMatch ? unitMatch[1].trim() : 'EA';

		items.push({
			productId: `punchout-${partId}`,
			name: description,
			sku: partId,
			quantity,
			pricePerUnit: price,
			unit,
			currency
		});
	}

	return {
		buyerCookie,
		total: totalAmount,
		currency: totalCurrency,
		items
	};
}

/**
 * Validates cXML structure
 */
export function validateCxml(cxml: string): { valid: boolean; error?: string } {
	if (!cxml || typeof cxml !== 'string') {
		return { valid: false, error: 'Empty or invalid cXML body' };
	}

	if (!cxml.includes('<PunchOutOrderMessage>')) {
		return { valid: false, error: 'Missing PunchOutOrderMessage element' };
	}

	if (!cxml.includes('<ItemIn')) {
		return { valid: false, error: 'No items found in cXML' };
	}

	return { valid: true };
}
