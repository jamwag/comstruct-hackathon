import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parsePunchOutCxml, validateCxml } from '$lib/server/punchout/cxml-parser';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const contentType = request.headers.get('content-type') || '';
		let cxmlBody: string;

		// Handle different content types
		if (contentType.includes('application/x-www-form-urlencoded')) {
			// External shop sends as form data with cXML field
			const formData = await request.formData();
			const cxmlField = formData.get('cXML') || formData.get('cxml-urlencoded');

			if (!cxmlField || typeof cxmlField !== 'string') {
				console.error('PunchOut: No cXML field found in form data');
				return json({ error: 'No cXML field found in form data' }, { status: 400 });
			}

			cxmlBody = cxmlField;
		} else {
			// Raw XML body
			cxmlBody = await request.text();
		}

		// Check body size (1MB limit)
		if (cxmlBody.length > 1_000_000) {
			return json({ error: 'Request body too large' }, { status: 413 });
		}

		// Validate cXML structure
		const validation = validateCxml(cxmlBody);
		if (!validation.valid) {
			console.error('PunchOut cXML validation failed:', validation.error);
			return json({ error: validation.error }, { status: 400 });
		}

		// Parse cXML into cart items
		const punchoutResponse = parsePunchOutCxml(cxmlBody);

		if (punchoutResponse.items.length === 0) {
			return json({ error: 'No items found in cXML' }, { status: 400 });
		}

		console.log(
			`PunchOut return: ${punchoutResponse.items.length} items, total: ${punchoutResponse.total} cents`
		);

		// Store items in a cookie for the client to read
		// Using httpOnly=false so client JS can read it
		cookies.set('punchout_items', JSON.stringify(punchoutResponse.items), {
			path: '/',
			httpOnly: false,
			secure: true,
			sameSite: 'lax',
			maxAge: 300 // 5 minutes
		});

		// Redirect to worker page with punchout flag
		return new Response(null, {
			status: 303,
			headers: { Location: '/worker?punchout=1' }
		});
	} catch (error) {
		console.error('PunchOut return error:', error);
		return json({ error: 'Failed to process PunchOut response' }, { status: 500 });
	}
};
