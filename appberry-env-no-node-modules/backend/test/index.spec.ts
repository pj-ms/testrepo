// test/index.spec.ts
import { createExecutionContext, SELF, waitOnExecutionContext } from 'cloudflare:test';
import { inspectRoutes } from 'hono/dev';
import { describe, expect, it } from 'vitest';
import app from '../src/index';

const MOCK_ENV = {
	CORS_ORIGIN: 'http://example.com',
};

describe('Hello World worker', () => {
	it('responds with Hello World! (unit style)', async () => {
		const ctx = createExecutionContext();
		const response = await app.request('/api', undefined, MOCK_ENV, ctx);
		await waitOnExecutionContext(ctx);
		expect(await response.text()).toMatchInlineSnapshot(`"Hello World!"`);
	});

	it('responds with Hello World! (integration style)', async () => {
		const response = await SELF.fetch('https://example.com/api');
		expect(await response.text()).toMatchInlineSnapshot(`"Hello World!"`);
	});

	it('routes are prefixed with /api', async () => {
		const routes = inspectRoutes(app);
		const nonMiddlewareRoutes = routes.filter((route) => !route.isMiddleware);
		nonMiddlewareRoutes.forEach((route) => {
			expect(
				route.path.startsWith('/api/') || route.path === '/api',
				`Route path "${route.path}" is invalid, must equal /api or be prefixed with /api/`,
			).toBe(true);
		});
	});
});
