<script lang="ts">
	interface Props {
		text: string;
		isProcessing: boolean;
		isListening: boolean;
	}

	let { text, isProcessing, isListening }: Props = $props();
</script>

<div class="bg-gray-50 rounded-lg p-4 min-h-16">
	{#if isListening && !text}
		<div class="flex items-center gap-2 text-gray-500">
			<span class="relative flex h-3 w-3">
				<span
					class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"
				></span>
				<span class="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
			</span>
			<span class="text-lg">Listening...</span>
		</div>
	{:else if isProcessing}
		<div class="flex items-center gap-2 text-gray-500">
			<svg class="animate-spin h-5 w-5 text-blue-500" viewBox="0 0 24 24" fill="none">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
				></circle>
				<path
					class="opacity-75"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
				></path>
			</svg>
			<span class="text-lg">Finding products...</span>
		</div>
	{:else if text}
		<p class="text-lg text-gray-800">"{text}"</p>
	{:else}
		<p class="text-gray-400 text-lg">Tap the microphone and tell me what you need</p>
	{/if}
</div>
