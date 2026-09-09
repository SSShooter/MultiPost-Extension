clean-dev:
	rm -rf .output/chrome-mv3
	pnpm dev


clean-prod:
	rm -rf .output/chrome-mv3
	pnpm build
