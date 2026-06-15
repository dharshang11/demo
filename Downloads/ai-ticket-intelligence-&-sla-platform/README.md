# AI-Powered Ticket Intelligence & SLA Management Platform

Enterprise-grade SaaS support operations platform that automates ticket ingestion, classifies issue domains with Gemini AI, predicts SLA breach risks, and assigns tasks dynamically to active engineers using a suitability scoring engine.

---

## 🚀 Key Architectural Modules

### 1. Unified Direct Ingestion Gateway
- **Simulated Pollers**: Active background workers query simulated **Gmail** and **Outlook** mailboxes every 5 minutes to fetch support emails.
- **Manual Portal**: Allows direct ticket creation with customizable ingestion labels.
- **Bulk CSV Parser**: Processes bulk tabular data, matching subjects, bodies, and emails dynamically.

### 2. Deep Gemini AI Classification
- Leverages the modern `@google/genai` TypeScript SDK using `gemini-3.5-flash` model.
- Classifies tickets into 9 technical categories: *Database, Network, Security, Infrastructure, Cloud, Application, Performance, Authentication, Other*.
- Computes complexity rating (1-5), business impact (High/Med/Low), and writes an immediate action recommendation runbook.
- Implements a resilient rule-based **Offline Fallback Parser** if API keys are missing or throttled, preserving perfect 100% platform utility.

### 3. Precision SLA Engine
- Automatically maps priority levels to legal response SLA timelines:
  - **P1 (Critical Outage)**: 4 Hours
  - **P2 (Major Outage)**: 8 Hours
  - **P3 (Standard request)**: 24 Hours
  - **P4 (Documentation/Minor update)**: 48 Hours
- Tracks and displays ticking remaining minutes live.
- Fires real-time alerts when the timeline reaches `< 30 Minutes` or is breached.

### 4. Smart Suitability Assignment Engine
- Overrides manual operations by auto-allocating incoming tickets to technicians.
- **Mathematical Selection Suitability Score**:
  $$\text{Suitability Score} = \text{SkillMatchBonus(50pts)} - (\text{OpenTickets} \times \text{5pts}) - (\text{ActiveComplexityWeight} \times \text{2pts})$$
- Dynamically routes database tickets to database engineering experts, security threats to security technicians, etc., while balancing global workload profiles.

### 5. Multi-Channel Alert Dispatcher (Discord & In-App Proxy)
- Dispatches automated warnings on four key events:
  1. **Critical Ticket Created** (Priority P1)
  2. **Risk score exceeds 80**
  3. **SLA Timeline reaches Under 30 minutes**
  4. **SLA Timeline breached**

---

## 🛡️ Role-Based Access Control (RBAC)

### 👥 ROLE 1: TEAM LEAD (e.g. Sarah Jenkins)
* **Permissions**: View all tickets and workloads, view SLA & executive analytics, onboard new technicians, flip workforce status (active/inactive), override and manually reassign any ticket, receive premium Discord alarm notifications, view unified management **AI Executive Summaries**.

### 👥 ROLE 2: TEAM MEMBER (e.g. Rahul Sharma, Priya Patel, John Doe)
* **Permissions**: Access the support board, view ONLY assigned tickets, initiate ticket work (In Progress), resolve tickets, receive assigned notifications, and consult **Personal AI Strengths & Coaching Journeys**.

---

## ⚙️ Configuration & Secrets

Configure environment keys inside `.env` or from the **AI Studio Settings > Secrets** Panel:

```env
# Gemini API Access. Used server-side for all text reasoning & summaries
GEMINI_API_KEY="AI_STUDIO_INJECTED_SECRET_HERE"

# Discord Webhooks. Connects your Slack/Discord to receive platform SLA alerts
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."

# Cloud Neon Database connection string
DATABASE_URL="postgresql://username:passwd@neon-endpoint-slug/dbname"
```

---

## 🛠️ Local Fast Sandbox Start

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Boot Developer Container**:
   ```bash
   npm run dev
   ```
3. **Build Static Assets (Production Mode)**:
   ```bash
   npm run build
   ```
4. **Boot Production Server**:
   ```bash
   npm start
   ```

---

## 📂 Deliverables & Repository Map

- `/server.ts` — Main Express core server orchestrating Gmail pollers, API routing, and Vite asset middleware.
- `/src/types.ts` — Complete, strict compiled TypeScript models.
- `/src/server/db.ts` — High-performance persistent database client loaded with enterprise mock seeds.
- `/src/server/ai.ts` — Gemini Generative SDK engine, prompt templates, and executive summary calculators.
- `/src/server/engines.ts` — Logical core of the SLA timeline, Risk scoring classifier, and smart workload routers.
- `/src/components/*` — Modular, highly-polished React workspace components styled after Atlassian products.
