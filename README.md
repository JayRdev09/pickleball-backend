# 🏓 Pickleball Court Management System — Backend

A full-featured REST API for managing a pickleball court — player registration, bookings, smart queue/stacking, and revenue reporting. Built with **Express.js** + **Supabase**.

---

## Features

### Player Side
- ✅ Register & login (JWT via Supabase Auth)
- ✅ Profile dashboard with skills breakdown (Serve, Return, Dink, Volley, Mobility)
- ✅ Court booking system
- ✅ Real-time queue position view (via Supabase Realtime)

### Owner / Operator Side
- ✅ View all bookings (pending, confirmed, completed)
- ✅ Create game sessions & assign players
- ✅ **Smart Queue Engine** — FCFS + skill-balance matching
- ✅ "Next" button to advance the queue match-by-match
- ✅ Insert walk-in players at any queue position
- ✅ Remove players from the queue
- ✅ Manually reorder the queue
- ✅ Revenue tracking — daily, weekly, monthly
- ✅ CSV export for revenue reports

### Smart Queue Algorithm
- **FCFS (First Come, First Serve)** as the base ordering
- **Skill-balance optimization** within each match group
- Tries all team combinations to minimize skill gap between teams
- Fairness labels: `excellent / good / moderate / poor`
- Completed players **re-loop to the end** of the queue automatically
- Supports both **Doubles (2v2)** and **Singles (1v1)**

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Express.js 4 |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (JWT) |
| Validation | Joi |
| Real-time | Supabase Realtime |
| Security | Helmet, CORS, Rate Limiting |

---

## Quick Start

### 1. Clone & Install
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

Fill in your `.env` with your Supabase credentials:
```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-jwt-secret
```

> **Where to find these:** Supabase Dashboard → Settings → API

### 3. Set Up Database
1. Go to your **Supabase project → SQL Editor**
2. Open `supabase/schema.sql`
3. Copy & paste the entire file into the editor and run it
4. All tables, triggers, RLS policies, and Realtime will be configured

### 4. Start the Server
```bash
# Development (with hot reload)
npm run dev

# Production
npm start
```

### 5. Seed Sample Data (Optional)
```bash
npm run seed
```

Creates 1 owner + 8 players (2 per skill tier) + bookings for testing.

---

## API Reference

### Base URL
```
http://localhost:3000/api
```

### Authentication
All protected routes require a Bearer token in the `Authorization` header:
```
Authorization: Bearer <access_token>
```

---

### Auth (`/api/auth`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/register` | Public | Register player or owner |
| POST | `/login` | Public | Login, get JWT tokens |
| POST | `/logout` | Protected | Logout |
| GET  | `/me` | Protected | Get current user |
| POST | `/refresh` | Public | Refresh access token |
| PUT  | `/change-password` | Protected | Change password |

**Register example:**
```json
POST /api/auth/register
{
  "email": "player@example.com",
  "password": "SecurePass123!",
  "full_name": "Juan dela Cruz",
  "username": "juandc",
  "role": "player"
}
```

---

### Players (`/api/players`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/profile` | Player | Own profile + skills |
| PUT | `/profile` | Player | Update own profile |
| GET | `/skills` | Player | Own skill ratings |
| PUT | `/skills` | Player | Update skill ratings |
| GET | `/stats` | Player | Win/loss stats |
| GET | `/` | Owner | List all players |
| GET | `/:id` | Owner | Get specific player |
| PUT | `/:id/verify-skill` | Owner | Verify player skill tier |

---

### Bookings (`/api/bookings`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST   | `/` | Player | Create booking |
| GET    | `/` | Player | Own bookings |
| DELETE | `/:id` | Player | Cancel booking |
| GET    | `/owner/all` | Owner | All bookings |
| GET    | `/owner/pending` | Owner | Pending bookings |
| PATCH  | `/:id/status` | Owner | Update booking status |
| PATCH  | `/:id/payment` | Owner | Mark payment |
| GET    | `/:id` | Both | Booking detail |

---

### Sessions (`/api/sessions`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET    | `/courts` | Both | Available courts |
| GET    | `/` | Both | List sessions |
| POST   | `/` | Owner | Create session |
| GET    | `/:id` | Both | Session details |
| POST   | `/:id/players` | Owner | Add players to session |
| DELETE | `/:id/players/:playerId` | Owner | Remove player |
| POST   | `/:id/start` | Owner | Start session |
| POST   | `/:id/end` | Owner | End session |

---

### Queue (`/api/queue`) ⭐ Smart Queue

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET    | `/player/status` | Player | Own queue position |
| GET    | `/session/:id` | Both | Full queue view |
| POST   | `/session/:id/build` | Owner | **Build smart queue** |
| POST   | `/session/:id/next` | Owner | **Advance to next match** |
| POST   | `/session/:id/insert` | Owner | Insert walk-in player |
| DELETE | `/session/:id/remove/:entryId` | Owner | Remove from queue |
| PUT    | `/session/:id/reorder` | Owner | Manually reorder |

**Build Queue:**
```json
POST /api/queue/session/:id/build
{}
```

**Next Match (with optional score):**
```json
POST /api/queue/session/:id/next
{
  "match_result": {
    "team1_score": 11,
    "team2_score": 7,
    "winner_team": 1
  }
}
```

**Insert Walk-in:**
```json
POST /api/queue/session/:id/insert
{
  "player_id": "uuid-here",
  "position": 3
}
```

---

### Revenue (`/api/revenue`) — Owner Only

| Method | Endpoint | Description |
|---|---|---|
| GET | `/summary` | Overall totals + today's revenue |
| GET | `/daily?start_date=&end_date=` | Day-by-day breakdown |
| GET | `/weekly?weeks=12` | Week-by-week |
| GET | `/monthly?months=12` | Month-by-month |
| GET | `/sessions` | Per-session revenue |
| GET | `/top-players` | Top players by visits |
| GET | `/export?format=csv` | Export as CSV or JSON |

---

## Real-time Queue Updates

The frontend can subscribe to live queue changes via **Supabase Realtime**:

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Subscribe to queue changes for a session
const channel = supabase
  .channel('queue-changes')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'queue_entries', filter: `session_id=eq.${sessionId}` },
    (payload) => {
      console.log('Queue updated:', payload);
      // Refresh your queue UI here
    }
  )
  .subscribe();
```

---

## Skill Tiers

| Tier | Score Multiplier | Description |
|---|---|---|
| Beginner | 1.0x | New to pickleball |
| Intermediate | 2.5x | Playing for 6+ months |
| Advanced | 4.0x | Tournament level |
| Professional | 6.0x | Elite competitive players |

Individual ratings (1–10): **Serve, Return, Dink, Volley, Mobility**

Skill Score = weighted average × tier multiplier (computed automatically by database trigger)

---

## Project Structure

```
src/
├── app.js                    # Express app setup
├── server.js                 # Entry point
├── config/
│   ├── env.js                # Env validation
│   └── supabase.js           # Supabase clients
├── middleware/
│   ├── auth.js               # JWT authentication
│   ├── roleGuard.js          # Owner/Player guards
│   ├── validate.js           # Joi validation
│   └── errorHandler.js       # Global error handling
├── utils/
│   ├── response.js           # Standard API responses
│   └── smartQueue.js         # Smart queue algorithm ⭐
└── modules/
    ├── auth/                 # Authentication
    ├── players/              # Player profiles & skills
    ├── bookings/             # Court bookings
    ├── sessions/             # Game sessions
    ├── queue/                # Smart queue engine
    └── revenue/              # Revenue & reporting

supabase/
└── schema.sql                # Full DB schema + RLS + Realtime

scripts/
└── seed.js                   # Development seed data
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | 3000 | Server port |
| `NODE_ENV` | No | development | Environment |
| `SUPABASE_URL` | **Yes** | — | Supabase project URL |
| `SUPABASE_ANON_KEY` | **Yes** | — | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | — | Supabase service role key |
| `JWT_SECRET` | **Yes** | — | Supabase JWT secret |
| `VENUE_NAME` | No | Pickleball Club | Venue display name |
| `MAX_COURTS` | No | 4 | Number of courts |
| `BOOKING_FEE` | No | 150 | Default booking fee |
| `ALLOWED_ORIGINS` | No | localhost | CORS origins (comma-separated) |

---

## License
MIT
