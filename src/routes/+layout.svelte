<script lang="ts">
	import '@fontsource-variable/inter';
	import '@fontsource/roboto-mono/500.css';
	import '../app.css';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

{@render children()}
