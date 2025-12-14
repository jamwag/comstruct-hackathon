<script lang="ts">
	import { browser } from '$app/environment';

	interface Props {
		storageKey?: string;
	}

	let { storageKey = 'cmaterials-info-seen' }: Props = $props();

	let isExpanded = $state(true);

	// Check localStorage on mount to see if user has seen this before
	$effect(() => {
		if (browser) {
			const hasSeenBefore = localStorage.getItem(storageKey) === 'true';
			if (hasSeenBefore) {
				isExpanded = false;
			}
		}
	});

	function toggleExpand() {
		isExpanded = !isExpanded;
		if (browser && !isExpanded) {
			localStorage.setItem(storageKey, 'true');
		}
	}
</script>

<div class="bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
	<!-- Header - always visible -->
	<button
		type="button"
		onclick={toggleExpand}
		class="w-full flex items-center justify-between p-4 text-left hover:bg-blue-100 transition-colors"
		aria-expanded={isExpanded}
	>
		<div class="flex items-center gap-3">
			<svg
				class="w-6 h-6 text-blue-600 flex-shrink-0"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			<span class="font-medium text-blue-900">What can I order here?</span>
		</div>
		<svg
			class="w-5 h-5 text-blue-600 transform transition-transform {isExpanded
				? 'rotate-180'
				: 'rotate-0'}"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
		</svg>
	</button>

	<!-- Expandable content -->
	{#if isExpanded}
		<div class="px-4 pb-4 border-t border-blue-200">
			<p class="text-blue-800 mt-3">
				This is for <strong>everyday site supplies</strong> - the small stuff you run out of:
			</p>
			<ul class="mt-3 space-y-2 text-blue-700">
				<li class="flex items-center gap-2">
					<span class="text-lg">🔩</span>
					<span>Screws, plugs, tape, sealants</span>
				</li>
				<li class="flex items-center gap-2">
					<span class="text-lg">🦺</span>
					<span>Gloves, masks, safety gear</span>
				</li>
				<li class="flex items-center gap-2">
					<span class="text-lg">🔧</span>
					<span>Drill bits, blades, small tools</span>
				</li>
				<li class="flex items-center gap-2">
					<span class="text-lg">⚡</span>
					<span>Cables, connectors, cleaning supplies</span>
				</li>
			</ul>
						<div class="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
				<p class="text-sm text-orange-800">
					<svg class="inline w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
							clip-rule="evenodd"
						/>
					</svg>
					For big project materials (steel, windows, concrete, equipment) - contact your manager.
				</p>
			</div>
		</div>
	{/if}
</div>
