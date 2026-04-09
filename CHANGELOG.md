# Changelog

## [0.3.0](https://github.com/zetlen/sanitycheck-mcp/compare/v0.2.2...v0.3.0) (2026-04-09)


### Features

* add AI vibes fetchers (aidailycheck, isclaudecodedumb, aistupidlevel, lmarena) ([0568e0a](https://github.com/zetlen/sanitycheck-mcp/commit/0568e0aaef1d705f3793a8a1bc5a64d6e563c87b))
* add core types ([71d8b47](https://github.com/zetlen/sanitycheck-mcp/commit/71d8b47b03b1743b12294f3074ae93ada89b4755))
* add custom fetchers for AWS, GCP, Azure, Akamai ([24a1b00](https://github.com/zetlen/sanitycheck-mcp/commit/24a1b004f72db4f4c4c57253acd2819f95bf842c))
* add debug logger with VIBECHECK_DEBUG env toggle ([5011527](https://github.com/zetlen/sanitycheck-mcp/commit/501152703169b373fcbdaaeebda6f6733ed4f3cc))
* add Downdetector and StatusGator aggregator fetchers ([ef4c3a6](https://github.com/zetlen/sanitycheck-mcp/commit/ef4c3a6dea77d6e26eb4602a5c53f09ada7a3b75))
* add file-based TTL cache with atomic writes ([2716a0a](https://github.com/zetlen/sanitycheck-mcp/commit/2716a0af7af8907edebe18976d1277155c270738))
* add generic Atlassian Statuspage fetcher ([1d85de5](https://github.com/zetlen/sanitycheck-mcp/commit/1d85de536a96ec1751b757477ec0378df8030894))
* add how_am_i_feeling tool with client inference ([3fed5a4](https://github.com/zetlen/sanitycheck-mcp/commit/3fed5a4de5c6777950f845b4c51d9a10e8b071ee))
* add is_the_internet_on_fire tool ([0f85e6f](https://github.com/zetlen/sanitycheck-mcp/commit/0f85e6fd9fe7297d4992571c36cc11aeb0a4c4be))
* add lazy browser manager with puppeteer-core ([ae710d2](https://github.com/zetlen/sanitycheck-mcp/commit/ae710d24cc8f6b21722c02db146addc5f00e521a))
* add local system checks to how_am_i_feeling ([e413c2e](https://github.com/zetlen/sanitycheck-mcp/commit/e413c2e80c0889bf7d58635dc85c6f0a3153c651))
* add official status fetchers for Statuspage-based services ([849d337](https://github.com/zetlen/sanitycheck-mcp/commit/849d337927c6ec0e8a70c05a90b492589f06bcb9))
* add service registry with aliases and category lookup ([54fb2f3](https://github.com/zetlen/sanitycheck-mcp/commit/54fb2f3035154d611a179bf4d0738cce711ffc29))
* add whats_going_on_with tool with Downdetector fallback ([1a94f03](https://github.com/zetlen/sanitycheck-mcp/commit/1a94f03f234c9dd1b66ee16bf05a8a93b05f6199))
* wire up MCP server with three tools and stdio transport ([f58a750](https://github.com/zetlen/sanitycheck-mcp/commit/f58a750e3a34b23c5bf89066b8dba6474a56d623))


### Bug Fixes

* add Codex and Gemini CLI client mappings for auto-detection ([1b58b01](https://github.com/zetlen/sanitycheck-mcp/commit/1b58b01d749c419d246e53bb8a942adfa292e59d))
* add repository URL for npm provenance and use trusted publishing ([236e225](https://github.com/zetlen/sanitycheck-mcp/commit/236e22556dc7f55bdbda06c51ec611e525f241b4))
* address code review findings (StatusGator rendering, test mocks, auto-detect test) ([afcd40e](https://github.com/zetlen/sanitycheck-mcp/commit/afcd40e8028fa1636921956189628821840aeb50))
* broaden how_am_i_feeling trigger language for casual phrasing ([0195075](https://github.com/zetlen/sanitycheck-mcp/commit/0195075727bd65d19635380648ae2c315ed359e1))
* deduplicate GCP/Google AI entry and reduce vibes noise ([ce36b44](https://github.com/zetlen/sanitycheck-mcp/commit/ce36b446d69f011758acfdc7a4ee59c662d55112))
* disable component prefix in release-please tags ([de3f0f2](https://github.com/zetlen/sanitycheck-mcp/commit/de3f0f2604b4b541b0e0f52f40c70c63aa4552a6))
* format statuspage fetcher to pass oxfmt check ([b1299a5](https://github.com/zetlen/sanitycheck-mcp/commit/b1299a50001c2225115292fd4af37e3bd365df7b))
* format statuspage fetcher to pass oxfmt check ([9b9ad39](https://github.com/zetlen/sanitycheck-mcp/commit/9b9ad39526ff5dbdf12c88c21559d71a2f070181))
* include component-level detail in how_am_i_feeling output ([d9e35cb](https://github.com/zetlen/sanitycheck-mcp/commit/d9e35cb0437f572fd03f0ac134a453a373c8bfe9))
* include component-level detail in how_am_i_feeling output ([1b72fa3](https://github.com/zetlen/sanitycheck-mcp/commit/1b72fa3b04d8e06b369fed0876f3dd6dc7cc30b8))
* log failure paths in debug output, not just successes ([3f86bfa](https://github.com/zetlen/sanitycheck-mcp/commit/3f86bfa5e3fb86f4d50f788a00c3e5322a780808))
* move LLM instructions from tool output to tool descriptions ([60d4bc5](https://github.com/zetlen/sanitycheck-mcp/commit/60d4bc5d0e68b18447b6b0a96d2dd045c70489c5))
* point Google AI to its dedicated status page ([6261e68](https://github.com/zetlen/sanitycheck-mcp/commit/6261e686ebf8789e73986a5fbb9590f0ca8ac6af))
* prioritize and cap incidents in whats_going_on_with output ([7342b7f](https://github.com/zetlen/sanitycheck-mcp/commit/7342b7f0b2ba2cb0ceed67756768139e35460103))
* repair broken fetchers (Slack, PagerDuty, GitLab, Fastly, AWS) ([1363cd6](https://github.com/zetlen/sanitycheck-mcp/commit/1363cd629fd772ced40b8130afc1f61e85edcaed))
* repair broken fetchers and wrap tool output in LLM prompts ([9a4ca2b](https://github.com/zetlen/sanitycheck-mcp/commit/9a4ca2bf02dab29c52cc5d7280f8be11f34e84ac))
* use real memory pressure instead of misleading os.freemem() ([7bf855c](https://github.com/zetlen/sanitycheck-mcp/commit/7bf855c5b9a87697a32d50e0148d2ba815e13d68))

## [0.2.2](https://github.com/zetlen/sanitycheck-mcp/compare/v0.2.1...v0.2.2) (2026-04-09)


### Bug Fixes

* format statuspage fetcher to pass oxfmt check ([b1299a5](https://github.com/zetlen/sanitycheck-mcp/commit/b1299a50001c2225115292fd4af37e3bd365df7b))
* format statuspage fetcher to pass oxfmt check ([9b9ad39](https://github.com/zetlen/sanitycheck-mcp/commit/9b9ad39526ff5dbdf12c88c21559d71a2f070181))

## [0.2.1](https://github.com/zetlen/sanitycheck-mcp/compare/v0.2.0...v0.2.1) (2026-03-25)


### Bug Fixes

* deduplicate GCP/Google AI entry and reduce vibes noise ([ce36b44](https://github.com/zetlen/sanitycheck-mcp/commit/ce36b446d69f011758acfdc7a4ee59c662d55112))
* point Google AI to its dedicated status page ([6261e68](https://github.com/zetlen/sanitycheck-mcp/commit/6261e686ebf8789e73986a5fbb9590f0ca8ac6af))
* prioritize and cap incidents in whats_going_on_with output ([7342b7f](https://github.com/zetlen/sanitycheck-mcp/commit/7342b7f0b2ba2cb0ceed67756768139e35460103))

## [0.2.0](https://github.com/zetlen/sanitycheck-mcp/compare/v0.1.3...v0.2.0) (2026-03-25)


### Features

* add local system checks to how_am_i_feeling ([e413c2e](https://github.com/zetlen/sanitycheck-mcp/commit/e413c2e80c0889bf7d58635dc85c6f0a3153c651))


### Bug Fixes

* use real memory pressure instead of misleading os.freemem() ([7bf855c](https://github.com/zetlen/sanitycheck-mcp/commit/7bf855c5b9a87697a32d50e0148d2ba815e13d68))

## [0.1.3](https://github.com/zetlen/sanitycheck-mcp/compare/v0.1.2...v0.1.3) (2026-03-25)


### Bug Fixes

* add repository URL for npm provenance and use trusted publishing ([236e225](https://github.com/zetlen/sanitycheck-mcp/commit/236e22556dc7f55bdbda06c51ec611e525f241b4))

## [0.1.2](https://github.com/zetlen/sanitycheck-mcp/compare/v0.1.1...v0.1.2) (2026-03-25)


### Bug Fixes

* add Codex and Gemini CLI client mappings for auto-detection ([1b58b01](https://github.com/zetlen/sanitycheck-mcp/commit/1b58b01d749c419d246e53bb8a942adfa292e59d))
* disable component prefix in release-please tags ([de3f0f2](https://github.com/zetlen/sanitycheck-mcp/commit/de3f0f2604b4b541b0e0f52f40c70c63aa4552a6))
* include component-level detail in how_am_i_feeling output ([d9e35cb](https://github.com/zetlen/sanitycheck-mcp/commit/d9e35cb0437f572fd03f0ac134a453a373c8bfe9))
* include component-level detail in how_am_i_feeling output ([1b72fa3](https://github.com/zetlen/sanitycheck-mcp/commit/1b72fa3b04d8e06b369fed0876f3dd6dc7cc30b8))
