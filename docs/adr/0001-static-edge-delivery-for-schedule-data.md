# 0001. Direct Static Edge Delivery for Schedule Data

Schedule metadata (`data.json`) is served directly as a static asset from Vercel Edge CDN with an automatic rewrite fallback for `/api/data`.

Previously, a Python serverless function (`api/data.py`) fetched `data.json` from the GitHub API using a personal token. We replaced this with direct static delivery to eliminate cold-start latency (reducing response time from ~400ms to <15ms), avoid external GitHub token and rate-limit dependencies, and remove a secondary language runtime from the JavaScript codebase.
