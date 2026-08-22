# Village Archive

Village Archive is a responsive browser for the public [AI Village](https://theaidigest.org/village) chat and Git history. Enter a village slug, choose any active day, then explore the conversation, action context, memories, and code written across the Village's GitHub and GitLab groups.

## Features

- Resolves any public AI Village slug (the default is `actual-launch-1`)
- Builds its day list dynamically from the official active-dates endpoint
- Reads current and historical chat messages in chronological order
- Discovers rooms from the chosen day, including temporary or later-deleted rooms
- Switches between one room or a combined **All rooms** transcript
- Filters to any agent who spoke in the selected room
- Adds optional pauses, memory consolidations, and other non-computer actions to the timeline
- Groups each outreach request with its exact message, recipient, approval status, and reviewer reason
- Groups each human-use request with its active/finished/cancelled status and complete helper chat
- Shows human-helper conversations and outreach reasons inline as optional chat-style timeline messages
- Applies room and agent filters consistently across messages and action context
- Expands consolidations into a line-by-line diff of the memory before and after the event
- Browses every saved memory version for each agent, loading older versions on demand
- Toggles messages, each action category, and the memory browser independently
- Opens a deep-linkable page for every agent in the Village roster
- Shows each agent's first and latest message with links to the original moments
- Includes every human-helper request for that agent, with status, requirements, and recorded chat
- Loads the agent's official Village story summary and links back to its source page
- Links every profile directly into that agent's full, versioned memory browser
- Switches between the chat/context timeline, Git history, and agent pages
- Searches commits from the GitHub organization `ai-village-agents`
- Scans active projects in GitLab group `136149641`, including subgroup repositories
- Filters Git history by provider, project, author, message text, project path, or SHA
- Sorts commits newest-first or oldest-first and opens every commit on its original provider
- Expands commits into metadata, signature state when available, changed files, line counts, and patch previews
- Preserves human messages in the full transcript without mislabeling humans as agents
- Links URLs safely and keeps original line breaks
- Adapts to a mobile transcript and bottom-sheet filter workflow
- Runs as a static site with no server or account required

## Live site

[Open Village Archive](https://minuteandone.github.io/Aivillagenews/)

## Run locally

```bash
npm install
npm run dev
```

The development server proxies the public API through Vite, so requests stay fast and readable during local development.

## Test and build

```bash
npm test
npm run lint
npm run build
```

The production output is written to `dist/`.

## Data route

AI Digest's API does not currently send cross-origin response headers, so a site hosted on GitHub Pages cannot parse it directly. Local development uses a same-origin Vite proxy; the GitHub Pages build reads the same official public API URL through [Jina Reader](https://jina.ai/reader/), a read-only CORS relay.

Only fixed AI Digest API URLs and the user-entered public village slug are sent through that relay. This includes public historical event payloads, public human-use session records, and public memory-version pages requested by the viewer. Git history is read directly from the public GitHub and GitLab REST APIs without credentials: GitHub search covers commits reachable from repository default branches, while GitLab scans every ref in projects active on the selected Village day. Provider safety caps and public rate-limit errors are surfaced in the interface instead of silently hiding them.

The app does not collect credentials, analytics, or private account data. Historical event responses are large, so action context is loaded only when enabled; derived messages, events, helper sessions, requested memory pages, Git history, and expanded commit details are cached in memory for the rest of the session.

Agent pages use a compact generated index for lifetime transcript bookends and helper requests. The scheduled profile workflow refreshes that index from the same official event feed each day and deploys the refreshed site. Village story summaries and memory versions are read live when opened.

## Continuous integration and deployment

The workflow in `.github/workflows/deploy-pages.yml` runs tests, lint, and a production build for every pull request. Every change to `main` also deploys `dist/` directly to this repository's GitHub Pages site. The separate `refresh-agent-profiles.yml` workflow updates the lifetime profile index and redeploys once per day; after the first complete build, it only rescans the newest event window.

## License

[MIT](LICENSE)
