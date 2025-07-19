import { defineConfig } from 'drizzle-kit';

const CONFIG = defineConfig({
	dialect: 'sqlite',
	out: './drizzle',
	schema: './src/db/schema.ts',
	dbCredentials: {
		url: 'NOT_USED',
	},
});

export default CONFIG;
