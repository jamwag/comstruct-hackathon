<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Projects - ComStruct</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex justify-between items-center">
		<h2 class="text-2xl font-bold text-gray-900">Projects</h2>
		<a
			href="/manager/projects/new"
			class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
		>
			New Project
		</a>
	</div>

	{#if data.projects.length === 0}
		<div class="bg-white rounded-lg shadow p-6 text-center">
			<p class="text-gray-500">No projects yet. Create your first project to get started.</p>
		</div>
	{:else}
		<div class="bg-white rounded-lg shadow overflow-hidden">
			<table class="min-w-full divide-y divide-gray-200">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							Name
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							Address
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							Created
						</th>
						<th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
							Actions
						</th>
					</tr>
				</thead>
				<tbody class="bg-white divide-y divide-gray-200">
					{#each data.projects as project (project.id)}
						<tr class="hover:bg-gray-50">
							<td class="px-6 py-4 whitespace-nowrap">
								<a href="/manager/projects/{project.id}" class="text-blue-600 hover:underline font-medium">
									{project.name}
								</a>
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-gray-500">
								{project.address || '-'}
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-gray-500 text-sm">
								{project.createdAt.toLocaleDateString()}
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-right">
								<a
									href="/manager/projects/{project.id}"
									class="text-blue-600 hover:underline text-sm"
								>
									Manage
								</a>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
