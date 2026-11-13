# RildonX

RildonX is a multi-page web application built with HTML, CSS, JavaScript, and Vite. It uses Supabase for authentication, data, and storage, and includes document and image-processing features.

## Application pages

The app has 13 pages: Home, Bulletin, Messages, Calendar, Tasks, Projects, Documents, People, My Space, Help, Profile, Settings, and Login.

## Requirements

- Node.js 20 or newer
- npm

## Local development

From the project root:

```sh
npm ci
npm run dev
```

Open `http://localhost:4173`. The development server binds to all network interfaces to support LAN testing; only run it on a trusted network.

Supabase's browser URL and public anon key are configured in `assets/js/supabase-config.js`. The anon key is intended for browser use; never put a `service_role` key or other server secret in frontend code. Access control must be enforced by Supabase Row Level Security (RLS).

## Checks and production build

```sh
npm run check
npm run build
npm run preview
```

`npm run check` parses project-owned JavaScript files and skips dependencies, generated output, and `paineis_personalizados`. `npm run build` creates the production site in `dist/` and copies the OCR runtime assets required by the marketing import feature. `npm run preview` serves that build at `http://localhost:4173`.

Deploy the contents of `dist/` with the static hosting provider of your choice. The `dist/` directory is generated and should not be edited manually.

## Security and backend configuration

The `rildonx-login` Supabase Edge Function source is in `supabase/functions/rildonx-login/` and must be deployed to the Supabase project separately. Its `verify_jwt = false` setting is required so unauthenticated login requests and browser preflights can reach the function; the function authenticates credentials with Supabase Auth and does not use a service-role key. Its CORS allowlist must include each exact frontend origin used for development and production. Keep RLS enabled and verify policies for every table accessed by the browser client. The frontend anon key is not a substitute for RLS.
