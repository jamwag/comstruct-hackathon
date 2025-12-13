<script lang="ts">
	import type { PageData } from './$types';
	import VoiceMicButton from '$lib/components/voice/VoiceMicButton.svelte';
	import { selectedProjectId } from '$lib/stores/selectedProject';

	let { data }: { data: PageData } = $props();

	// Get current project from store
	const currentProjectId = $derived($selectedProjectId);
	const selectedProject = $derived(data.projects.find((p) => p.id === currentProjectId));
</script>

<svelte:head>
	<title>Purchasing - ComStruct</title>
</svelte:head>

<div class="space-y-6">
	{#if data.projects.length === 0}
		<!-- No project assigned message -->
		<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
			<p class="text-yellow-800 font-medium">You are not assigned to any project.</p>
			<p class="text-yellow-700 text-sm mt-1">
				Please contact your manager to be assigned to a project.
			</p>
		</div>
	{:else}
		<!-- Voice Ordering Section - Main Feature (Enhanced) -->
		<div
			class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-lg p-6 border border-blue-100"
		>
			<div class="text-center mb-4">
				<h2 class="text-2xl font-bold text-gray-900">Quick Voice Order</h2>
				<p class="mt-1 text-gray-600">Tap the mic and tell me what you need</p>
				{#if selectedProject}
					<p class="text-sm text-gray-500 mt-2">
						Ordering for: <span class="font-medium">{selectedProject.name}</span>
					</p>
				{/if}
			</div>

			<!-- Voice mic button -->
			<VoiceMicButton projectId={currentProjectId} />

			<!-- Enhanced "Browse the catalog" button -->
			<div class="mt-8 pt-6 border-t border-blue-200">
				<a
					href="/worker/order"
					class="block w-full bg-blue-600 text-white py-4 px-6 rounded-xl font-bold text-lg text-center hover:bg-blue-700 active:scale-95 transition-all shadow-md"
				>
					Browse the Catalog
				</a>
				<p class="text-center text-gray-500 text-sm mt-2">Or browse products manually</p>
			</div>
		</div>
	{/if}
</div>
