<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const assignedWorkerIds = $derived(new Set(data.assignedWorkerIds));
</script>

<svelte:head>
	<title>{data.project.name} - ComStruct</title>
</svelte:head>

<div class="space-y-6">
	<div class="mb-6">
		<a href="/manager/projects" class="text-blue-600 hover:underline text-sm">&larr; Back to Projects</a>
	</div>

	<div class="bg-white rounded-lg shadow p-6">
		<h2 class="text-2xl font-bold text-gray-900">{data.project.name}</h2>
		{#if data.project.address}
			<p class="mt-1 text-gray-500">{data.project.address}</p>
		{/if}
		<p class="mt-2 text-sm text-gray-400">
			Created {data.project.createdAt.toLocaleDateString()}
		</p>
	</div>

	<div class="bg-white rounded-lg shadow p-6">
		<h3 class="text-lg font-semibold text-gray-900 mb-4">Assigned Workers</h3>

		{#if data.allWorkers.length === 0}
			<p class="text-gray-500 text-sm">No workers registered yet. Workers need to register first.</p>
		{:else}
			<div class="space-y-2">
				{#each data.allWorkers as worker (worker.id)}
					{@const isAssigned = assignedWorkerIds.has(worker.id)}
					<div class="flex items-center justify-between py-2 px-3 rounded-md {isAssigned ? 'bg-green-50' : 'bg-gray-50'}">
						<div class="flex items-center gap-3">
							<span class="w-2 h-2 rounded-full {isAssigned ? 'bg-green-500' : 'bg-gray-300'}"></span>
							<span class="font-medium text-gray-900">{worker.username}</span>
							{#if isAssigned}
								<span class="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">Assigned</span>
							{/if}
						</div>
						<form method="post" action={isAssigned ? '?/unassign' : '?/assign'} use:enhance>
							<input type="hidden" name="workerId" value={worker.id} />
							<button
								type="submit"
								class="text-sm px-3 py-1 rounded {isAssigned
									? 'bg-red-100 text-red-700 hover:bg-red-200'
									: 'bg-blue-100 text-blue-700 hover:bg-blue-200'} transition-colors"
							>
								{isAssigned ? 'Remove' : 'Assign'}
							</button>
						</form>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
