<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';
	import { managerSelectedProjectId } from '$lib/stores/managerSelectedProject';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	const currentProjectId = $derived($managerSelectedProjectId);
	const selectedProject = $derived(data.projects.find((p) => p.id === currentProjectId));

	onMount(() => {
		managerSelectedProjectId.initWithDefault(data.projects);
	});

	function handleProjectChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		managerSelectedProjectId.set(target.value);
		// Update URL with new project
		const url = new URL($page.url);
		url.searchParams.set('project', target.value);
		goto(url.toString(), { replaceState: true, keepFocus: true });
	}
</script>

<!-- Manager dashboard layout -->
<div class="min-h-screen bg-gray-50 flex">
	<aside class="w-64 bg-white border-r min-h-screen p-4 flex flex-col">
		<h1 class="text-xl font-bold text-gray-900 mb-6">ComStruct</h1>
		<nav class="space-y-1 flex-1">
			<a
				href="/manager"
				class="block px-3 py-2 rounded-md hover:bg-gray-100 text-gray-700 font-medium"
			>
				Dashboard
			</a>
			<a
				href="/manager/suppliers"
				class="block px-3 py-2 rounded-md hover:bg-gray-100 text-gray-700 font-medium"
			>
				Suppliers
			</a>
			<a
				href="/manager/products"
				class="block px-3 py-2 rounded-md hover:bg-gray-100 text-gray-700 font-medium"
			>
				Products
			</a>
			<a
				href="/manager/orders"
				class="block px-3 py-2 rounded-md hover:bg-gray-100 text-gray-700 font-medium"
			>
				Orders
			</a>
		</nav>
		<div class="border-t pt-4">
			<div class="text-sm text-gray-600 mb-2">{data.user.username}</div>
			<form method="post" action="/logout" use:enhance>
				<button
					class="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
				>
					Sign out
				</button>
			</form>
		</div>
	</aside>

	<div class="flex-1">
		<header class="bg-white border-b px-6 py-4 flex items-center justify-between">
			<div class="flex items-center gap-3">
				{#if data.projects.length > 0}
					<div class="relative">
						<select
							class="bg-blue-600 text-white text-sm font-medium rounded-md px-3 py-2 pr-8 border border-blue-500 focus:ring-2 focus:ring-blue-300 focus:outline-none appearance-none cursor-pointer"
							value={currentProjectId || ''}
							onchange={handleProjectChange}
						>
							{#each data.projects as project (project.id)}
								<option value={project.id} class="bg-white text-gray-900">{project.name}</option>
							{/each}
						</select>
						<svg
							class="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white pointer-events-none"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
						</svg>
					</div>
					<a
						href="/manager/projects/{currentProjectId}"
						class="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
						title="Project Settings"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
						</svg>
					</a>
				{:else}
					<span class="text-sm text-gray-500">No projects</span>
				{/if}
				<a
					href="/manager/projects/new"
					class="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
					title="Create New Project"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
					</svg>
				</a>
			</div>
			<h2 class="text-lg font-semibold text-gray-900">Manager Portal</h2>
		</header>

		<main class="p-6">
			{@render children()}
		</main>
	</div>
</div>
