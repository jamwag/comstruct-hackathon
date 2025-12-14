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
	const currentPath = $derived($page.url.pathname);

	// Role-based visibility
	const isProcurement = $derived(data.user.role === 'manager');
	const isProjectManager = $derived(data.user.role === 'project_manager');
	const roleLabel = $derived(isProcurement ? 'Procurement' : 'Project Manager');

	// Check if a nav item is active
	function isActive(href: string): boolean {
		if (href === '/manager') {
			return currentPath === '/manager';
		}
		return currentPath.startsWith(href);
	}

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
<div class="h-screen bg-gray-50 flex overflow-hidden">
	<aside class="w-64 bg-white border-r h-screen p-4 flex flex-col flex-shrink-0">
		<h1 class="text-xl font-bold text-gray-900 mb-6">ComStruct</h1>
		<nav class="space-y-1 flex-1">
			<a
				href="/manager"
				class="block px-3 py-2 rounded-md font-medium {isActive('/manager')
					? 'bg-blue-50 text-blue-700'
					: 'text-gray-700 hover:bg-gray-100'}"
			>
				Dashboard
			</a>
			<a
				href="/manager/products{currentProjectId ? `?project=${currentProjectId}` : ''}"
				class="block px-3 py-2 rounded-md font-medium {isActive('/manager/products')
					? 'bg-blue-50 text-blue-700'
					: 'text-gray-700 hover:bg-gray-100'}"
			>
				Assigned Products
			</a>
			<a
				href="/manager/orders"
				class="block px-3 py-2 rounded-md font-medium {isActive('/manager/orders')
					? 'bg-blue-50 text-blue-700'
					: 'text-gray-700 hover:bg-gray-100'}"
			>
				Orders
			</a>

			{#if isProcurement}
				<div class="border-t border-gray-200 my-3"></div>
				<a
					href="/manager/suppliers"
					class="block px-3 py-2 rounded-md font-medium {isActive('/manager/suppliers')
						? 'bg-blue-50 text-blue-700'
						: 'text-gray-700 hover:bg-gray-100'}"
				>
					Suppliers
				</a>
			{/if}
		</nav>
		<div class="border-t pt-4">
			<div class="flex items-center gap-3 px-2 py-2">
				<div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
					{data.user.username.slice(0, 2).toUpperCase()}
				</div>
				<div class="flex-1 min-w-0">
					<div class="text-sm font-medium text-gray-900 truncate">{data.user.username}</div>
					<div class="text-xs text-gray-500">{roleLabel}</div>
				</div>
				<form method="post" action="/logout" use:enhance>
					<button
						type="submit"
						class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
						title="Sign out"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
						</svg>
					</button>
				</form>
			</div>
		</div>
	</aside>

	<div class="flex-1 flex flex-col overflow-hidden">
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

		<main class="flex-1 overflow-y-auto p-6">
			{@render children()}
		</main>
	</div>
</div>
