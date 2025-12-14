<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';
	import { onMount } from 'svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import ProjectSelector from '$lib/components/ProjectSelector.svelte';
	import OfflineIndicator from '$lib/components/OfflineIndicator.svelte';
	import { selectedProjectId } from '$lib/stores/selectedProject';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	// Initialize project selection with default on mount
	onMount(() => {
		selectedProjectId.initWithDefault(data.projects);
	});
</script>

<!-- Mobile-first worker layout -->
<div class="min-h-screen bg-gray-100 pb-20">
	<header class="bg-blue-600 text-white px-4 py-3 flex justify-between items-center">
		<h1 class="text-lg font-bold">ComStruct</h1>
		<div class="flex items-center gap-3">
			<ProjectSelector projects={data.projects} />
			<span class="text-sm hidden sm:inline">{data.user.username}</span>
			<form method="post" action="/logout" use:enhance>
				<button class="text-sm bg-blue-700 px-3 py-1 rounded hover:bg-blue-800 transition-colors">
					Logout
				</button>
			</form>
		</div>
	</header>

	<OfflineIndicator />

	<main class="p-4">
		{@render children()}
	</main>

	<BottomNav />
</div>
