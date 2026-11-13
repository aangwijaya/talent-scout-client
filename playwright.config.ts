import { defineConfig, devices } from '@playwright/test';
import { FAKE_API_PORT, INTEGRATION_PORT, MOCK_PORT, REAL_PORT } from './tests/e2e/ports';

const preview = (port: number) => `pnpm preview --port ${port} --strictPort`;

// Set only by the `integration` CI job, which starts the Go server first (.github/workflows/ci.yml).
const integrationApi = process.env.INTEGRATION_API_URL;

export default defineConfig({
	testDir: 'tests/e2e',
	testMatch: '**/*.e2e.ts',
	forbidOnly: !!process.env.CI,
	retries: 0,
	reporter: process.env.CI ? 'github' : 'list',
	use: { trace: 'retain-on-failure' },
	// Started in order: the build has to finish before either preview serves it.
	webServer: [
		{
			command: `pnpm build && ${preview(MOCK_PORT)}`,
			port: MOCK_PORT,
			env: { USE_MOCK: 'true' },
			timeout: 180_000,
			reuseExistingServer: !process.env.CI
		},
		{
			command: `node tests/e2e/fake-api.ts ${FAKE_API_PORT}`,
			port: FAKE_API_PORT,
			reuseExistingServer: false
		},
		{
			// The real API client against the fake Go API: the only way to see what Kit really
			// sends, such as cookies its inner `fetch` adds back.
			command: preview(REAL_PORT),
			port: REAL_PORT,
			env: {
				USE_MOCK: 'false',
				API_BASE_URL: `http://localhost:${FAKE_API_PORT}`,
				BFF_SHARED_SECRET: 'e2e-bff-secret'
			},
			reuseExistingServer: false
		},
		...(integrationApi
			? [
					{
						command: preview(INTEGRATION_PORT),
						port: INTEGRATION_PORT,
						env: {
							USE_MOCK: 'false',
							API_BASE_URL: integrationApi,
							BFF_SHARED_SECRET: process.env.INTEGRATION_BFF_SHARED_SECRET ?? ''
						},
						reuseExistingServer: false
					}
				]
			: [])
	],
	projects: [
		{
			name: 'desktop',
			testMatch: 'smoke.e2e.ts',
			use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${MOCK_PORT}` }
		},
		{
			name: 'phone',
			testMatch: 'smoke.e2e.ts',
			use: {
				...devices['Desktop Chrome'],
				viewport: { width: 375, height: 667 },
				isMobile: true,
				hasTouch: true,
				baseURL: `http://localhost:${MOCK_PORT}`
			}
		},
		{
			name: 'auth',
			testMatch: 'auth.e2e.ts',
			// Every test resets and reads the one request log in `fake-api.ts`.
			workers: 1,
			use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${REAL_PORT}` }
		},
		...(integrationApi
			? [
					{
						name: 'integration',
						testMatch: '**/*.int.ts',
						use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${INTEGRATION_PORT}` }
					}
				]
			: [])
	]
});
