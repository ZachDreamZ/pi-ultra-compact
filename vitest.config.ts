import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		include: ["tests/**/*.test.ts"],
		exclude: ["node_modules", "dist"],
		coverage: {
			provider: "v8",
			enabled: false,
			include: ["extensions/**/*.ts", "skills/**/*.ts"],
			exclude: ["**/*.test.ts", "node_modules", "dist"],
			reporter: ["text", "lcov", "html"],
			reportsDirectory: "./coverage",
			thresholds: {
				statements: 85,
				branches: 85,
				functions: 85,
				lines: 85,
			},
		},
	},
});
