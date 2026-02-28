# YukCep Web

YukCep is a logistics marketplace web app built with React, Vite, Tailwind v4, and Supabase.

## Runtime Requirements

- Node.js: `^20.19.0 || >=22.12.0`
- npm: latest stable recommended

The project also includes an `.nvmrc` file (`20.19.0`) for predictable local setup.

## Environment Variables

Create `.env` from `.env.example`:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

The app fails fast on startup if these variables are missing.

## Scripts

- `npm install` - install dependencies
- `npm run dev` - start development server
- `npm run build` - production build
- `npm run lint` - eslint
- `npm run preview` - preview production build

## Database

The canonical schema is in [`schema.sql`](./schema.sql) and includes:

- `profiles`
- `loads`
- `bids`
- `notifications`
- Row-Level Security (RLS) policies matching frontend behavior

Apply the schema in your Supabase SQL editor before using authenticated flows.

## Notes

- Keep `.env` out of version control.
- Use `.env.example` as the only committed env template.
