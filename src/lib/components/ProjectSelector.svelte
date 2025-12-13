<script lang="ts">
	import { selectedProjectId } from '$lib/stores/selectedProject';

	interface Project {
		id: string;
		name: string;
		address?: string | null;
	}

	interface Props {
		projects: Project[];
	}

	let { projects }: Props = $props();

	// Get current value from store (using $ prefix for auto-subscription)
	const currentProjectId = $derived($selectedProjectId);

	const selectedProject = $derived(projects.find((p) => p.id === currentProjectId));

	function handleChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		selectedProjectId.set(target.value);
	}
</script>

{#if projects.length > 1}
	<div class="relative">
		<select
			class="bg-blue-500 text-white text-sm font-medium rounded-md px-3 py-1.5 pr-8 border border-blue-400 focus:ring-2 focus:ring-blue-300 focus:outline-none appearance-none cursor-pointer"
			value={currentProjectId || ''}
			onchange={handleChange}
		>
			{#each projects as project (project.id)}
				<option value={project.id} class="bg-white text-gray-900">{project.name}</option>
			{/each}
		</select>
		<!-- Dropdown arrow -->
		<svg
			class="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white pointer-events-none"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
		</svg>
	</div>
{:else if selectedProject}
	<span class="text-white text-sm font-medium bg-blue-500 px-3 py-1.5 rounded-md">
		{selectedProject.name}
	</span>
{/if}
