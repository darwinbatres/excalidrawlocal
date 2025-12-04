# Enterprise Excalidraw

> **⚠️ Please Read First — You Probably Don't Need This**
>
> **For 99% of users, we strongly recommend using the official [Excalidraw](https://excalidraw.com)** — it's free, open-source, has real-time collaboration, end-to-end encryption, and is actively maintained by an amazing team.
>
> This self-hosted project exists **only** for specific enterprise/internal requirements:
>
> - 🏢 **Multi-tenant workspaces** with role-based access (Owner/Admin/Member/Viewer)
> - 📜 **Persistent version history** with point-in-time restore
> - 📝 **Audit logging** for compliance (who did what, when, from where)
> - 🔒 **Full data sovereignty** (all data stays on your PostgreSQL)
> - 📄 **Markdown cards** with Mermaid diagram support on the canvas
> - ✨ **Rich text cards** with Notion-style editing (Tiptap)
>
> If you don't need these specific features, **please use [excalidraw.com](https://excalidraw.com)** instead.
>
> **Huge props to the Excalidraw team** for creating and maintaining such an incredible tool and making it open source.

---

A self-hosted whiteboard application built with [Excalidraw](https://excalidraw.com), featuring persistent PostgreSQL storage, version history, autosave, and organization-based multi-tenancy.

## Features

### ✅ Fully Implemented

#### Drawing & Canvas

- 🎨 **Full Excalidraw Editor** — All drawing tools, shapes, text, arrows, freehand, and more
- 🖼️ **Image Support** — Paste or drag images onto canvas (stored in database)
- 🔍 **Search** — Find text elements and markdown card content
- ↩️ **Undo/Redo** — Full history during editing session

#### Markdown Cards (Custom Feature)

- 📝 **Rich Text Cards** — Add documentation directly on the canvas
- ✨ **Full Markdown** — Headings, bold, italic, links, lists, tables, code blocks
- 📊 **Mermaid.js Diagrams** — Flowcharts, sequence diagrams, class diagrams, etc.
- ✏️ **Double-click to Edit** — Opens modal editor with live preview
- 📐 **Resizable & Movable** — Behaves like any Excalidraw element
- 🔍 **Searchable** — Content is indexed for Excalidraw's search

#### Rich Text Cards (Notion-style, powered by Tiptap)

- ✨ **WYSIWYG Editing** — Notion-style rich text with full toolbar
- 📝 **Rich Formatting** — Bold, italic, underline, strikethrough, highlight
- 📋 **Task Lists** — Checkboxes for to-do items
- 🔢 **Headings & Structure** — H1, H2, H3, bullet/numbered lists, blockquotes
- 💻 **Code Blocks** — Syntax highlighted code snippets
- 🔗 **Links** — Add and remove hyperlinks
- 📏 **Text Alignment** — Left, center, right alignment
- ↩️ **Undo/Redo** — Full editing history
- ⌨️ **Keyboard Shortcuts** — Cmd/Ctrl+B, I, U, S for quick formatting
- 📐 **Resizable & Movable** — Behaves like any Excalidraw element
- 🔍 **Searchable** — Content is indexed for Excalidraw's search
- ⚠️ **Size Validation** — Real-time size tracking with warnings at 80% limit

#### Board Management

- 📋 **Board List** — Dashboard with thumbnails, search, and pagination
- ➕ **Create/Delete/Archive** — Full board lifecycle management
- 📜 **Version History** — View and restore any previous version
- 💾 **Smart Autosave** — Saves every 10s only when content changes
- ⚡ **Conflict Detection** — ETag-based locking prevents overwrites
- 📊 **Storage Tracking** — Detailed breakdown by content type (images, cards, etc.)
- 🧹 **Storage Cleanup** — Remove orphaned embedded files
- 📏 **Size Limits** — Configurable limits with real-time validation

#### Organizations (Workspaces)

- 🏢 **Multiple Workspaces** — Create and switch between organizations
- ✏️ **Rename Workspaces** — Owners can rename their workspaces
- 👤 **Auto-created Personal Org** — Each user gets a default workspace
- 🗑️ **Delete Empty Workspaces** — Remove workspaces with no boards
- 💾 **Persistent Selection** — Remembers last workspace across sessions

#### Authentication & Security

- 🔑 **Email/Password Login** — Credentials-based authentication
- 🔐 **OAuth Support** — Google and GitHub (when configured)
- 🍪 **Secure Sessions** — JWT with httpOnly, sameSite cookies
- 🛡️ **Rate Limiting** — Brute-force protection on login (10/min)
- ✅ **Input Validation** — Zod schemas on all API endpoints
- 📝 **Audit Logging** — All actions logged with IP/user agent

#### User Experience

- 🔔 **Toast Notifications** — Non-blocking feedback for all actions
- ✨ **Confirmation Modals** — Safe destructive action handling
- 🌓 **Dark/Light Mode** — System preference detection

#### Deployment

- 🐳 **Docker Compose** — One command to run app + PostgreSQL
- 🔒 **Security Headers** — X-Frame-Options, CSP-ready, CORS
- 🌐 **Reverse Proxy Ready** — Works with nginx, Traefik, Cloudflare Tunnel
- 🏥 **Health Checks** — `/api/health` endpoint for load balancers

---

### 🚧 Backend Exists, No UI

These features have working API endpoints but **no user interface** yet:

| Feature                 | API Endpoint                   | What's Missing                                                                      |
| ----------------------- | ------------------------------ | ----------------------------------------------------------------------------------- |
| **Invite Team Members** | `POST /api/orgs/:id/members`   | No invite UI, no email notifications — API requires user to already exist in system |
| **Manage Member Roles** | `PATCH /api/orgs/:id/members`  | No role management UI — roles (Owner/Admin/Member/Viewer) enforced in API           |
| **Remove Members**      | `DELETE /api/orgs/:id/members` | No member removal UI — API works, protects owners from being removed                |
| **View Audit Logs**     | `GET /api/audit?orgId=...`     | No audit log viewer page — API supports filtering by actor, action, date range      |
| **Audit Stats**         | `GET /api/audit?stats=true`    | No dashboard — API returns action counts and activity by day                        |
| **User Registration**   | —                              | No sign-up form — users must be created via seed script or OAuth                    |

> **Note:** All these APIs are production-ready with proper auth, validation, and error handling. They just need UI components.

---

### 📋 Schema Exists, Not Implemented

These have database models but **no API or UI**:

| Feature                  | Schema Model        | Status                                                                                                   |
| ------------------------ | ------------------- | -------------------------------------------------------------------------------------------------------- |
| **Share Links**          | `ShareLink`         | Model exists with `token`, `role`, `expiresAt` fields — no API endpoints built                           |
| **Board Permissions**    | `BoardPermission`   | Model exists linking boards to members with roles — not enforced (all org members can access all boards) |
| **External Assets (S3)** | `BoardAsset`        | Model exists with `storageKey`, `sha256`, `sizeBytes` — images stored as base64 in DB instead            |
| **Email Verification**   | `VerificationToken` | NextAuth model exists — no email sending configured                                                      |

> **Note:** These schemas are ready for future implementation. The architecture supports them, but building the full feature requires additional work.

---

## Quick Start with Docker

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/excalidrawlocal.git
cd excalidrawlocal

# 2. Copy environment file
cp .env.example .env

# 3. Generate secure secrets (REQUIRED!)
# On Linux/macOS:
sed -i '' "s/CHANGE_ME_RUN_openssl_rand_base64_32/$(openssl rand -base64 32 | tr -d '\n')/" .env
sed -i '' "s/CHANGE_ME_USE_STRONG_PASSWORD/$(openssl rand -base64 32 | tr -d '\n')/" .env

# Or manually edit .env and set:
#   AUTH_SECRET=<random 32+ char string>
#   POSTGRES_PASSWORD=<strong password>

# 4. (Optional) Create demo user for testing
# Uncomment these lines in .env:
#   DEMO_USER_EMAIL=demo@example.com
#   DEMO_USER_PASSWORD=demo123456

# 5. Start everything
docker compose up -d --build

# 6. Open http://localhost:3021
```

### What's Running

| Service      | Description            | Port                  |
| ------------ | ---------------------- | --------------------- |
| **app**      | Next.js application    | 3021 (all interfaces) |
| **postgres** | PostgreSQL 16 database | 5432 (localhost only) |

> **Note:** PostgreSQL is exposed on `127.0.0.1:5432` for local development tools (like Prisma Studio). It's not accessible from external networks.

---

## Development Setup

### Prerequisites

- Node.js 22+ (LTS)
- pnpm 10+
- Docker (for PostgreSQL)

### Local Development

```bash
# Install dependencies
pnpm install

# Start database only
docker compose up -d postgres

# Configure for local dev
cp .env.example .env
# Edit .env: change DATABASE_URL hostname from "postgres" to "localhost"
# DATABASE_URL=postgresql://excalidraw:your_password@localhost:5432/excalidraw

# Push schema to database
pnpm db:push

# (Optional) Create demo user
# Set DEMO_USER_EMAIL and DEMO_USER_PASSWORD in .env, then:
pnpm db:seed

# Start dev server
pnpm dev

# Open http://localhost:3021
```

### Available Scripts

```bash
# Development
pnpm dev              # Start dev server (Turbopack)
pnpm build            # Production build
pnpm start            # Start production server
pnpm lint             # Run ESLint

# Database
pnpm db:migrate:dev   # Create migrations (development)
pnpm db:migrate       # Apply migrations (production)
pnpm db:push          # Push schema without migrations
pnpm db:seed          # Run seed script
pnpm db:studio        # Open Prisma Studio GUI

# Docker
pnpm docker:build     # Build images
pnpm docker:up        # Start containers
pnpm docker:down      # Stop containers
pnpm docker:logs      # Follow app logs
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Reverse Proxy (nginx/Traefik/Cloudflare)       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js 16 Application                   │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Pages     │  │ API Routes  │  │  Services   │        │
│  │  (React 19  │  │ (REST API)  │  │ (Business   │        │
│  │+ Excalidraw)│  │             │  │   Logic)    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Middleware  │  │  NextAuth   │  │   Prisma    │        │
│  │(Rate Limit) │  │    (JWT)    │  │   (ORM)     │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  PostgreSQL 16  │
                    └─────────────────┘
```

### Project Structure

```
.
├── prisma/
│   ├── schema.prisma       # Database models (User, Org, Board, etc.)
│   ├── migrations/         # SQL migrations
│   └── seed.ts             # Demo user seeding
├── src/
│   ├── components/
│   │   ├── excalidraw/     # Editor components
│   │   │   ├── BoardEditor.tsx       # Main editor + autosave logic
│   │   │   ├── MarkdownCard.tsx      # Markdown card renderer
│   │   │   ├── MarkdownCardEditor.tsx# Modal editor with preview
│   │   │   ├── SaveIndicator.tsx     # Save status + storage display
│   │   │   └── VersionHistory.tsx    # Version history sidebar
│   │   ├── layout/         # Header.tsx, Layout.tsx
│   │   ├── ui/             # Button.tsx, Input.tsx, Modal.tsx
│   │   └── ErrorBoundary.tsx
│   ├── contexts/           # AppContext.tsx (auth, org state)
│   ├── lib/                # utils.ts, constants.ts (config, limits)
│   ├── pages/
│   │   ├── api/
│   │   │   ├── auth/       # [...nextauth].ts
│   │   │   ├── boards/     # CRUD, save, versions, storage, cleanup
│   │   │   ├── orgs/       # Organizations, members, storage
│   │   │   ├── audit/      # Audit log queries (admin only)
│   │   │   └── health.ts   # Health check endpoint
│   │   ├── boards/[id].tsx # Board editor page
│   │   └── index.tsx       # Dashboard (board list + auth)
│   ├── server/
│   │   ├── db/             # prisma.ts (singleton client)
│   │   ├── middleware/     # withAuth.ts, ratelimit.ts
│   │   └── services/       # boards, access, audit services
│   ├── services/           # api.client.ts (client-side fetch)
│   ├── styles/             # globals.css (Tailwind)
│   └── types/              # index.ts (TypeScript types)
├── docker-compose.yml      # PostgreSQL + App
├── Dockerfile              # Multi-stage production build
├── next.config.ts          # Security headers, standalone output
└── package.json
```

---

## Markdown Cards

Add rich documentation directly on your canvas — perfect for architecture diagrams with explanations.

### Creating a Card

1. Click **"Markdown Card"** button (top-right)
2. Card appears at canvas center
3. **Double-click** to edit
4. Click **"Save Card"** or `⌘S`/`Ctrl+S`

### Supported Features

| Feature     | Syntax                          |
| ----------- | ------------------------------- |
| Headings    | `# H1` to `###### H6`           |
| Bold/Italic | `**bold**`, `*italic*`          |
| Links       | `[text](url)`                   |
| Lists       | `- item` or `1. item`           |
| Task Lists  | `- [ ] todo`, `- [x] done`      |
| Tables      | GFM table syntax                |
| Code        | `` `inline` `` or fenced blocks |
| Blockquotes | `> quote`                       |

### Mermaid Diagrams

````markdown
```mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action]
    B -->|No| D[Other]
```
````

Supports flowcharts, sequence diagrams, class diagrams, and more. See [Mermaid docs](https://mermaid.js.org/intro/).

---

## Environment Variables

### Required

| Variable       | Description                                           |
| -------------- | ----------------------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection string                          |
| `AUTH_SECRET`  | NextAuth secret (generate: `openssl rand -base64 32`) |

### Application

| Variable                           | Default                 | Description                          |
| ---------------------------------- | ----------------------- | ------------------------------------ |
| `NODE_ENV`                         | `production`            | Environment mode                     |
| `NEXTAUTH_URL`                     | `http://localhost:3021` | Public app URL (for OAuth callbacks) |
| `NEXT_PUBLIC_APP_URL`              | `http://localhost:3021` | Public app URL (client-side)         |
| `NEXT_PUBLIC_AUTOSAVE_INTERVAL_MS` | `10000`                 | Autosave interval (ms)               |
| `AUTH_TRUST_HOST`                  | `true`                  | Trust host header (for proxies)      |

### Database

| Variable            | Default      | Description                            |
| ------------------- | ------------ | -------------------------------------- |
| `POSTGRES_USER`     | `excalidraw` | PostgreSQL username                    |
| `POSTGRES_PASSWORD` | —            | PostgreSQL password (**change this!**) |
| `POSTGRES_DB`       | `excalidraw` | Database name                          |

### Rate Limiting

| Variable                         | Default | Description               |
| -------------------------------- | ------- | ------------------------- |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | `60`    | API rate limit per IP     |
| (hardcoded)                      | `10`    | Login attempts per minute |

### OAuth (Optional)

| Variable               | Description            |
| ---------------------- | ---------------------- |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret    |
| `GITHUB_ID`            | GitHub OAuth client ID |
| `GITHUB_SECRET`        | GitHub OAuth secret    |

### Demo User (Development Only)

| Variable             | Description                              |
| -------------------- | ---------------------------------------- |
| `DEMO_USER_EMAIL`    | Demo user email (triggers user creation) |
| `DEMO_USER_PASSWORD` | Demo user password                       |
| `DEMO_USER_NAME`     | Demo user display name                   |

> ⚠️ **Remove `DEMO_USER_*` variables for production!**

### Storage Limits (configured in `src/lib/constants.ts`)

| Limit                     | Default  | Description                                   |
| ------------------------- | -------- | --------------------------------------------- |
| `MAX_MARKDOWN_CARD_SIZE`  | 1,000 KB | Maximum size per markdown card                |
| `MAX_RICH_TEXT_CARD_SIZE` | 2,000 KB | Maximum size per rich text card (Tiptap JSON) |
| `MAX_IMAGE_SIZE`          | 50 MB    | Maximum size per embedded image (base64)      |
| `MAX_BOARD_SIZE`          | 500 MB   | Maximum total board size (all content)        |
| `MAX_ELEMENTS_PER_BOARD`  | 10,000   | Maximum elements per board                    |
| `MAX_VERSIONS_PER_BOARD`  | 100      | Version history retention limit               |

> 💡 **Size validation**: Card editors show real-time size indicators with warnings at 80% capacity and prevent saving when over the limit. Users see actionable error messages with specific guidance on how to reduce content size.

---

## API Reference

### Health Check

| Method | Endpoint      | Description              |
| ------ | ------------- | ------------------------ |
| GET    | `/api/health` | Health status + DB check |

### Authentication

| Method | Endpoint            | Description |
| ------ | ------------------- | ----------- |
| POST   | `/api/auth/signin`  | Sign in     |
| POST   | `/api/auth/signout` | Sign out    |
| GET    | `/api/auth/session` | Get session |

### Organizations

| Method | Endpoint                | Description             |
| ------ | ----------------------- | ----------------------- |
| GET    | `/api/orgs`             | List user's orgs        |
| POST   | `/api/orgs`             | Create org              |
| PATCH  | `/api/orgs/:id`         | Rename org (owner only) |
| DELETE | `/api/orgs/:id`         | Delete org (if empty)   |
| GET    | `/api/orgs/:id/storage` | Get workspace storage   |
| GET    | `/api/orgs/:id/members` | List members            |
| POST   | `/api/orgs/:id/members` | Add member _(no UI)_    |
| PATCH  | `/api/orgs/:id/members` | Update role _(no UI)_   |
| DELETE | `/api/orgs/:id/members` | Remove member _(no UI)_ |

### Boards

| Method | Endpoint                  | Description                |
| ------ | ------------------------- | -------------------------- |
| GET    | `/api/boards?orgId=...`   | List boards                |
| POST   | `/api/boards`             | Create board               |
| GET    | `/api/boards/:id`         | Get board + latest version |
| PATCH  | `/api/boards/:id`         | Update metadata            |
| DELETE | `/api/boards/:id`         | Delete board               |
| POST   | `/api/boards/:id/save`    | Save new version           |
| GET    | `/api/boards/:id/storage` | Get storage breakdown      |
| POST   | `/api/boards/:id/cleanup` | Remove orphaned files      |

### Versions

| Method | Endpoint                      | Description          |
| ------ | ----------------------------- | -------------------- |
| GET    | `/api/boards/:id/versions`    | List versions        |
| GET    | `/api/boards/:id/versions/:v` | Get specific version |
| POST   | `/api/boards/:id/versions/:v` | Restore version      |

### Audit _(Admin, no UI)_

| Method | Endpoint               | Description      |
| ------ | ---------------------- | ---------------- |
| GET    | `/api/audit?orgId=...` | Query audit logs |

---

## Production Deployment

### Docker Compose (Recommended)

```bash
# Edit .env with production values:
# - Strong AUTH_SECRET
# - Strong POSTGRES_PASSWORD
# - Correct NEXTAUTH_URL and NEXT_PUBLIC_APP_URL
# - Remove DEMO_USER_* variables

# Build and start
docker compose up -d --build

# Verify health
curl http://localhost:3021/api/health

# View logs
docker compose logs -f app
```

### Cloudflare Tunnel (Recommended for Remote Access)

Cloudflare Tunnel provides secure access without opening firewall ports. Everything runs in Docker — just add your tunnel token.

**Step 1: Create a tunnel in Cloudflare**

1. Go to [Cloudflare One Dashboard](https://one.dash.cloudflare.com)
2. Navigate to **Networks → Tunnels**
3. Click **Create a tunnel**
4. Select **Cloudflared** as the connector type
5. Name your tunnel (e.g., `excalidraw`)
6. **Copy the token** (starts with `eyJ...`) — you'll need this

**Step 2: Configure the public hostname**

In the tunnel configuration, add a public hostname:

| Field        | Value                                    |
| ------------ | ---------------------------------------- |
| Subdomain    | `excalidraw` (or your choice)            |
| Domain       | `yourdomain.com` (must be on Cloudflare) |
| Service Type | `HTTP`                                   |
| URL          | `app:3021`                               |

> **Important:** The URL is `app:3021` (the Docker service name), not `localhost:3021`

**Step 3: Configure your environment**

```bash
# Add to your .env file:
CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoiYWNj...your-token-here

# Update these to match your tunnel hostname:
NEXTAUTH_URL=https://excalidraw.yourdomain.com
NEXT_PUBLIC_APP_URL=https://excalidraw.yourdomain.com
```

**Step 4: Start with the tunnel profile**

```bash
# Start all services including the tunnel
docker compose --profile tunnel up -d --build

# Check tunnel status
docker compose logs cloudflared

# Verify it's working
curl https://excalidraw.yourdomain.com/api/health
```

**That's it!** Your app is now securely accessible at `https://excalidraw.yourdomain.com` with automatic HTTPS.

#### Tunnel Tips

- The tunnel connects outbound to Cloudflare — no inbound ports needed
- You can remove the `ports: "3021:3021"` from docker-compose.yml for extra security
- Monitor tunnel health at [Cloudflare One Dashboard](https://one.dash.cloudflare.com) → Networks → Tunnels
- Tunnel logs: `docker compose logs -f cloudflared`

### Reverse Proxy (nginx)

```nginx
location / {
    proxy_pass http://localhost:3021;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

---

## Security Features

| Feature          | Implementation                          |
| ---------------- | --------------------------------------- |
| Password Hashing | bcrypt (cost 12)                        |
| Sessions         | JWT, httpOnly, sameSite cookies         |
| Rate Limiting    | 10/min login, 60/min API                |
| Input Validation | Zod on all endpoints                    |
| RBAC             | Org roles (Owner/Admin/Member/Viewer)   |
| Audit Logging    | IP, user agent, all actions             |
| Security Headers | X-Frame-Options, X-Content-Type-Options |
| CORS             | Origin-restricted                       |
| SQL Injection    | Prisma parameterized queries            |
| Container        | Non-root user (uid 1001)                |
| Database         | Localhost-only port binding             |

### Production Checklist

- [ ] `AUTH_SECRET` is randomly generated (32+ chars)
- [ ] `POSTGRES_PASSWORD` is strong and unique
- [ ] `DEMO_USER_*` variables are removed
- [ ] `NEXTAUTH_URL` matches your domain
- [ ] HTTPS enabled (via proxy or tunnel)
- [ ] Firewall restricts direct access to port 3021 (or use reverse proxy)
- [ ] Database port (5432) is not exposed in production docker-compose

---

## Known Limitations

### What This Project Doesn't Have (Use Official Excalidraw Instead)

The official [Excalidraw](https://excalidraw.com) has features this project will likely never implement:

| Feature                     | Official Excalidraw             | This Project                                    |
| --------------------------- | ------------------------------- | ----------------------------------------------- |
| **Real-time Collaboration** | ✅ Multiple people editing live | ❌ Single-user per session                      |
| **End-to-End Encryption**   | ✅ E2EE by default              | ❌ Data at rest in PostgreSQL                   |
| **Export to PNG/SVG/JSON**  | ✅ Built-in export menu         | ⚠️ Use Excalidraw's built-in export (it works!) |
| **Libraries & Templates**   | ✅ Extensive shape library      | ❌ Not implemented                              |
| **Public Sharing**          | ✅ Anonymous link sharing       | ❌ Authentication required                      |
| **Mobile App**              | ✅ PWA with touch support       | ⚠️ Works but desktop-optimized                  |
| **Offline Support**         | ✅ Full offline capability      | ❌ Requires server connection                   |
| **Laser Pointer**           | ✅ Presentation mode            | ✅ Works (Excalidraw feature)                   |
| **Infinite Canvas**         | ✅ Unlimited space              | ✅ Works (Excalidraw feature)                   |

**Bottom line:** If you just need a whiteboard, use [excalidraw.com](https://excalidraw.com). This project is only useful if you specifically need: persistent version history, multi-tenant workspaces, audit logging, or full self-hosted data control.

### Original Plan vs Implementation

From the original `todo.md` planning document:

| Planned Feature             | Status                                   |
| --------------------------- | ---------------------------------------- |
| Embedded Excalidraw editor  | ✅ Fully implemented                     |
| Autosave to database        | ✅ Debounced, 10s interval               |
| Version history + restore   | ✅ Full implementation with sidebar UI   |
| Multi-user auth             | ✅ Credentials + OAuth (Google, GitHub)  |
| Multi-tenant organizations  | ✅ Full RBAC (Owner/Admin/Member/Viewer) |
| Board permissions override  | 📋 Schema exists, not enforced           |
| Audit logging               | ✅ API complete, no UI viewer            |
| Search + pagination         | ✅ Boards list with filters              |
| Rate limiting               | ✅ In-memory (10/min auth, 60/min API)   |
| Redis for rate limiting     | ❌ Not implemented (in-memory only)      |
| Shareable links with expiry | 📋 Schema exists, no API                 |
| Offline-first editing       | ❌ Not implemented                       |
| Realtime collaboration      | ❌ Out of scope                          |
| S3 for images               | 📋 Schema exists, using base64 instead   |
| OpenTelemetry/observability | ❌ Not implemented                       |
| Playwright e2e tests        | ❌ Not implemented                       |

### Scalability Limitations

- **Rate limiter is in-memory** — Won't work correctly with multiple app instances. Use Redis for horizontal scaling.
- **Images stored as base64 in DB** — Large boards with many images can slow down. The `BoardAsset` schema exists for S3 storage but isn't implemented.
- **No WebSocket/real-time** — Each user works independently; changes sync on save only.
- **Content limits enforced client-side** — Storage limits are validated in card editors. Server-side validation recommended for production hardening.

### Missing UI for Existing APIs

- No user registration page (use seed script or OAuth)
- No team invitation UI (POST `/api/orgs/:id/members` works)
- No role management UI (PATCH `/api/orgs/:id/members` works)
- No audit log viewer (GET `/api/audit` works, admin only)
- No board-level permissions UI (schema exists, not enforced)

---

## Tech Stack

| Layer      | Technology     | Version | Notes                             |
| ---------- | -------------- | ------- | --------------------------------- |
| Framework  | Next.js        | 16.0.5  | Pages Router, standalone output   |
| UI         | React          | 19.2.0  | Concurrent features enabled       |
| Styling    | Tailwind CSS   | 4.1.x   | PostCSS plugin                    |
| Toasts     | Sonner         | 2.x     | Non-blocking notifications        |
| Database   | PostgreSQL     | 16      | Alpine image in Docker            |
| ORM        | Prisma         | 6.19.x  | With migrations                   |
| Auth       | NextAuth.js    | 4.24.x  | JWT strategy, credentials + OAuth |
| Validation | Zod            | 3.25.x  | All API endpoints                 |
| Whiteboard | Excalidraw     | 0.18.x  | Full editor embedded              |
| Rich Text  | Tiptap         | 3.12.x  | Notion-style card editor          |
| Markdown   | react-markdown | 10.1.x  | With remark-gfm                   |
| Diagrams   | Mermaid.js     | 11.12.x | Flowcharts, sequence, class, etc. |
| Thumbnails | html2canvas    | 1.4.x   | Board preview generation          |
| Runtime    | Node.js        | 22 LTS  | Alpine in Docker                  |

---

## Troubleshooting

### Container won't start

```bash
docker compose logs app
# Common: AUTH_SECRET not set, DB not ready, port in use
```

### Database connection failed

```bash
docker compose ps postgres  # Check if running
docker compose logs postgres  # Check for errors
```

### "Invalid credentials"

- Ensure `DEMO_USER_*` vars are set if using demo user
- Check startup logs for "Created demo user"
- Demo user only created if env vars explicitly set

### Build fails

```bash
docker compose down
docker system prune -f
docker compose build --no-cache
docker compose up -d
```

---

## License

MIT

---

## Acknowledgments

- **[Excalidraw](https://excalidraw.com)** — The amazing whiteboard that powers this project
- **[Mermaid.js](https://mermaid.js.org)** — Diagram rendering in markdown cards
- **[Next.js](https://nextjs.org)** — React framework
- **[Prisma](https://prisma.io)** — Database ORM
- **[NextAuth.js](https://next-auth.js.org)** — Authentication
