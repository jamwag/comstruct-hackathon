export type ShippingStatus = 'awaiting' | 'confirmed' | 'partial' | 'rejected' | null;

export function deriveShippingStatus(
	orderStatus: string,
	supplierResponses: Array<{ status: string }>
): ShippingStatus {
	if (orderStatus !== 'approved') return null;
	if (supplierResponses.length === 0) return 'awaiting';

	// Priority: confirmed > partial > rejected
	if (supplierResponses.some((r) => r.status === 'confirmed')) return 'confirmed';
	if (supplierResponses.some((r) => r.status === 'partial')) return 'partial';
	if (supplierResponses.some((r) => r.status === 'rejected')) return 'rejected';

	return 'awaiting';
}

export function getShippingStatusColor(status: ShippingStatus): string {
	switch (status) {
		case 'awaiting':
			return 'bg-orange-100 text-orange-800';
		case 'confirmed':
			return 'bg-green-100 text-green-800';
		case 'partial':
			return 'bg-yellow-100 text-yellow-800';
		case 'rejected':
			return 'bg-red-100 text-red-800';
		default:
			return 'bg-gray-100 text-gray-500';
	}
}

export function getShippingStatusLabel(status: ShippingStatus): string {
	switch (status) {
		case 'awaiting':
			return 'Awaiting';
		case 'confirmed':
			return 'Confirmed';
		case 'partial':
			return 'Partial';
		case 'rejected':
			return 'Rejected';
		default:
			return 'N/A';
	}
}
