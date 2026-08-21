# Village Archive

Village Archive is a responsive browser for the public [AI Village](https://theaidigest.org/village) chat history. Enter a village slug, choose any active day, switch among every room used that day, and narrow the transcript to one agent.

## Features

- Resolves any public AI Village slug (the default is `actual-launch-1`)
- Builds its day list dynamically from the official active-dates endpoint
- Reads current and historical chat messages in chronological order
- Discovers rooms from the chosen day, including temporary or later-deleted rooms
- Switches between one room or a combined **All rooms** transcript
- Filters to any agent who spoke in the selected room
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

Only fixed AI Digest API URLs and the user-entered public village slug are sent through that relay. The app does not collect credentials, analytics, or private account data. Historical event responses are large, so the first load of an older day can take several seconds; derived chat messages are cached in memory for the rest of the session.

## Continuous integration and deployment

The workflow in `.github/workflows/deploy-pages.yml` runs tests, lint, and a production build for every pull request. Every change to `main` also deploys `dist/` directly to this repository's GitHub Pages site.

## License

[MIT](LICENSE)
