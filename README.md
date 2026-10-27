# City View

City View is a visualization platform for city operators and data analysts, with city metrics dashboards, configurable charts, maps and 3D scenes, an AI data assistant, and user and role management.

- Live site: <https://city.elinew.tech/>
- Stack: React 19, TypeScript, Redux Toolkit, React Router, Ant Design, ECharts, React Three Fiber, Amap JS API, Axios, and Vite

## Features

- City data dashboards and CSV export
- Chart editor with cascading data source, table, and field selection
- Unified rendering for bar, line, pie, and scatter charts
- Amap markers, air quality overlays, traffic heatmaps, and distance analysis around the city
- React Three Fiber city model with interactive buildings, expanded floors, and 3D metric comparisons
- Authentication, role-based menu filtering, and route access control
- AI-assisted city data questions and analysis suggestions

## Local development

```bash
npm install
npm run dev
```

## Checks

```bash
npm run lint
npm run build
```

Production is hosted on Cloudflare Pages; a Pages Function forwards `/api` requests to `http://182.92.74.1:8080`. The local Vite proxy uses the same backend. API documentation: <http://182.92.74.1:9999/>.

Login page photo: [Denys Nevozhai / Unsplash](https://unsplash.com/photos/shanghai-skyline-and-huangpu-river-D8iZPlX-2fs).
