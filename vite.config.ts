import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			// Pages are prerendered to ./build and served by the Worker's static assets.
			adapter: adapter({ pages: 'build', assets: 'build', fallback: '404.html' })
		})
	],
	// In dev, `npm run dev:api` runs the Worker on 8787; Vite forwards API calls to it.
	server: { proxy: { '/api': 'http://localhost:8787' } }
});
