// Vitest config for the Node-only helpers under tests/ (fake storage, fixture generator).
// Kept apart from vite.config.ts so these run without the SvelteKit plugin.
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		name: 'test-helpers',
		root: 'tests',
		environment: 'node',
		include: ['**/*.test.ts'],
		expect: { requireAssertions: true }
	}
});
