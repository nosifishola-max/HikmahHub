# Repository Guidelines

## Project Structure & Module Organization
This is a monorepo containing a campus marketplace application split into two main modules:
- **`app/`**: Frontend built with **React**, **Vite**, and **TypeScript**. It uses **Tailwind CSS** for styling and **Shadcn/UI** components. State management is primarily handled through React Context and custom hooks located in `app/src/hooks/`.
- **`backend/`**: A **Node.js/Express** API that handles secure operations such as **Paystack** payment initialization/verification and Supabase admin tasks. It uses CommonJS modules.
- **Supabase**: Serves as the primary database and authentication provider. Frontend communicates directly with Supabase for data fetching (using RLS), while the backend handles sensitive transactions.

## Build, Test, and Development Commands
### Frontend (`app/`)
- `npm run dev`: Start Vite development server
- `npm run build`: Build for production
- `npm run lint`: Run ESLint

### Backend (`backend/`)
- `npm run dev`: Start server with `nodemon`
- `npm start`: Start production server

### Infrastructure
- `docker-compose up`: Run the entire stack (including backend) locally via Docker

## Coding Style & Naming Conventions
- **TypeScript**: Strictly enforced in the `app` module. Use interfaces for data models (defined in `app/src/types/database.ts` and `app/src/lib/supabase.ts`).
- **Linting**: ESLint is configured in the `app` directory using `typescript-eslint` recommended rules.
- **Naming**:
  - React components: PascalCase (e.g., `CreateListing.tsx`).
  - Hooks: `use` prefix (e.g., `useAuth.ts`).
  - Backend: Follows standard Express/Middleware patterns.
- **Styling**: Utility-first CSS using Tailwind. Avoid custom CSS unless absolutely necessary (prefer `index.css` for globals).

## Deployment & Security
- **Frontend**: Deployed on **Vercel**; configuration resides in `app/vercel.json`.
- **Backend**: Containerized via **Docker**; handles all payment processing to keep secret keys off the client.
- **Auth**: Uses Supabase PKCE flow. Backend validates users via the Supabase GoTrue user endpoint.

## Commit & Pull Request Guidelines
Follow conventional commit prefixes:
- `feat:`: New features
- `fix:`: Bug fixes
- `perf:`: Performance improvements
- `chore:`: Maintenance tasks
- `docs:`: Documentation updates
- `refactor:`: Code restructuring without feature changes
