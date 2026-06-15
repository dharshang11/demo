import fs from 'fs';
import path from 'path';
import pg from 'pg';
import {
  User,
  Ticket,
  TicketAnalysis,
  SlaTracking,
  RiskPrediction,
  Assignment,
  AuditLog,
  Notification,
  RichTicket,
  TicketStatus,
  UserRole,
  UserStatus,
  TicketSource,
  TicketCategory,
  EmailConfig
} from '../types.js';

interface DatabaseSchema {
  users: User[];
  tickets: Ticket[];
  ticket_analysis: TicketAnalysis[];
  sla_tracking: SlaTracking[];
  risk_predictions: RiskPrediction[];
  assignments: Assignment[];
  notifications: Notification[];
  audit_logs: AuditLog[];
  email_configs?: EmailConfig[];
}

const { Pool } = pg;

const dbUrl = process.env.DATABASE_URL || '';
let USE_POSTGRES = dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://');
let pool: pg.Pool | null = null;

if (USE_POSTGRES) {
  console.log('[Database] DATABASE_URL provided with valid Postgres scheme. Operating in PostgreSQL / Neon mode.');
  pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 3000
  });
} else {
  console.log('[Database] DATABASE_URL missing or invalid. Operating in Local Offline JSON mode.');
}

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

let isInitialized = false;

// Ensure database directory, tables, or file exist and are seeded
export async function initializeDatabase() {
  if (isInitialized) return;

  if (USE_POSTGRES && pool) {
    try {
      // 1. Create table schemas
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(50) PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          role TEXT NOT NULL,
          status TEXT NOT NULL,
          skills TEXT[] NOT NULL,
          avatar TEXT
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS tickets (
          id VARCHAR(50) PRIMARY KEY,
          subject TEXT NOT NULL,
          body TEXT NOT NULL,
          sender TEXT NOT NULL,
          source TEXT NOT NULL,
          status TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS ticket_analysis (
          ticket_id VARCHAR(50) PRIMARY KEY REFERENCES tickets(id) ON DELETE CASCADE,
          category TEXT NOT NULL,
          complexity INTEGER NOT NULL,
          priority VARCHAR(10) NOT NULL,
          business_impact VARCHAR(20) NOT NULL,
          recommendation TEXT NOT NULL
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS sla_tracking (
          ticket_id VARCHAR(50) PRIMARY KEY REFERENCES tickets(id) ON DELETE CASCADE,
          deadline TIMESTAMP WITH TIME ZONE NOT NULL,
          duration_hours INTEGER NOT NULL,
          remaining_minutes INTEGER NOT NULL,
          is_breached BOOLEAN DEFAULT FALSE
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS risk_predictions (
          ticket_id VARCHAR(50) PRIMARY KEY REFERENCES tickets(id) ON DELETE CASCADE,
          risk_score INTEGER NOT NULL,
          risk_level VARCHAR(20) NOT NULL,
          factors TEXT[] NOT NULL
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS assignments (
          ticket_id VARCHAR(50) PRIMARY KEY REFERENCES tickets(id) ON DELETE CASCADE,
          assigned_user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
          assigned_at TIMESTAMP WITH TIME ZONE,
          assigned_by VARCHAR(50) NOT NULL
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id VARCHAR(50) PRIMARY KEY,
          ticket_id VARCHAR(50) NOT NULL,
          type TEXT NOT NULL,
          message TEXT NOT NULL,
          sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          channel TEXT NOT NULL,
          delivered BOOLEAN DEFAULT FALSE
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id VARCHAR(50) PRIMARY KEY,
          ticket_id VARCHAR(50) NOT NULL,
          user_id VARCHAR(50),
          user_name TEXT NOT NULL,
          action TEXT NOT NULL,
          description TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS email_configs (
          id VARCHAR(50) PRIMARY KEY,
          imap_host TEXT NOT NULL,
          imap_port INTEGER NOT NULL,
          imap_user TEXT NOT NULL,
          imap_pass TEXT NOT NULL,
          use_ssl BOOLEAN DEFAULT TRUE,
          is_active BOOLEAN DEFAULT TRUE
        );
      `);

      // 2. Check if we need to seed
      const { rows } = await pool.query('SELECT COUNT(*) FROM users');
      if (parseInt(rows[0].count) === 0) {
        console.log('[Database] PostgreSQL tables created. Seeding standard enterprise mock dataset...');
        const seed = getSeedData();

        for (const u of seed.users) {
          await pool.query(
            'INSERT INTO users (id, name, email, role, status, skills, avatar) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [u.id, u.name, u.email, u.role, u.status, u.skills, u.avatar]
          );
        }

        for (const t of seed.tickets) {
          await pool.query(
            'INSERT INTO tickets (id, subject, body, sender, source, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [t.id, t.subject, t.body, t.sender, t.source, t.status, t.created_at, t.updated_at]
          );
        }

        for (const ta of seed.ticket_analysis) {
          await pool.query(
            'INSERT INTO ticket_analysis (ticket_id, category, complexity, priority, business_impact, recommendation) VALUES ($1, $2, $3, $4, $5, $6)',
            [ta.ticket_id, ta.category, ta.complexity, ta.priority, ta.business_impact, ta.recommendation]
          );
        }

        for (const s of seed.sla_tracking) {
          await pool.query(
            'INSERT INTO sla_tracking (ticket_id, deadline, duration_hours, remaining_minutes, is_breached) VALUES ($1, $2, $3, $4, $5)',
            [s.ticket_id, s.deadline, s.duration_hours, s.remaining_minutes, s.is_breached]
          );
        }

        for (const r of seed.risk_predictions) {
          await pool.query(
            'INSERT INTO risk_predictions (ticket_id, risk_score, risk_level, factors) VALUES ($1, $2, $3, $4)',
            [r.ticket_id, r.risk_score, r.risk_level, r.factors]
          );
        }

        for (const a of seed.assignments) {
          await pool.query(
            'INSERT INTO assignments (ticket_id, assigned_user_id, assigned_at, assigned_by) VALUES ($1, $2, $3, $4)',
            [a.ticket_id, a.assigned_user_id, a.assigned_at || null, a.assigned_by]
          );
        }

        for (const n of seed.notifications) {
          await pool.query(
            'INSERT INTO notifications (id, ticket_id, type, message, sent_at, channel, delivered) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [n.id, n.ticket_id, n.type, n.message, n.sent_at, n.channel, n.delivered]
          );
        }

        for (const al of seed.audit_logs) {
          await pool.query(
            'INSERT INTO audit_logs (id, ticket_id, user_id, user_name, action, description, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [al.id, al.ticket_id, al.user_id, al.user_name, al.action, al.description, al.created_at]
          );
        }
        console.log('[Database] PostgreSQL seeded successfully.');
      }
      isInitialized = true;
    } catch (err) {
      console.error('[Database] Failed to initialize/seed PostgreSQL database. Falling back to Local Offline JSON mode.', err);
      USE_POSTGRES = false;
      if (pool) {
        await pool.end().catch(() => {});
        pool = null;
      }
    }
  }

  if (!USE_POSTGRES) {
    // Offline local JSON DB fallback logic
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }

    if (!fs.existsSync(DB_FILE)) {
      const defaultData = getSeedData();
      fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
      console.log('[Database] Local fallback JSON database initialized and seeded successfully.');
    } else {
      // PRUNE EXISTING OVERBLOATED DATABASE ON STARTUP TO AVOID HIGH DISK/MEMORY USAGE!
      try {
        const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
        const db = JSON.parse(fileContent);
        let modified = false;
        
        // Filter out duplicate SLA_BREACHED audit logs
        if (db.audit_logs && db.audit_logs.length > 500) {
          const originalLength = db.audit_logs.length;
          // Keep non-system SLA_BREACHED logs, or only keep a high-quality slice
          // Filter duplicate SLA_BREACHED / SLA_WARNING logs: keep only the latest 100 system logs
          const nonSlaSystemLogs = db.audit_logs.filter((log: any) => log.user_name !== 'SLA Engine');
          const slaSystemLogs = db.audit_logs.filter((log: any) => log.user_name === 'SLA Engine');
          const uniqueSlaSystemLogs = slaSystemLogs.slice(-100); // Only keep the last 100 SLA system logs
          
          db.audit_logs = [...nonSlaSystemLogs, ...uniqueSlaSystemLogs].sort((a: any, b: any) => {
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateA - dateB;
          });
          console.log(`[Database] Cleaned up audit logs. Pruned ${originalLength - db.audit_logs.length} duplicate system logs.`);
          modified = true;
        }

        // Similarly for notifications, if they are bloated
        if (db.notifications && db.notifications.length > 500) {
          const originalLength = db.notifications.length;
          // Group by type & ticket_id and keep only unique or newest
          const seen = new Set();
          const uniqueNotifications: any[] = [];
          // Keep newest notifications by traversing backwards
          for (let i = db.notifications.length - 1; i >= 0; i--) {
            const notif = db.notifications[i];
            const key = `${notif.ticket_id}_${notif.type}`;
            if (!seen.has(key)) {
              seen.add(key);
              uniqueNotifications.push(notif);
            }
          }
          db.notifications = uniqueNotifications.reverse();
          console.log(`[Database] Cleaned up notifications. Pruned ${originalLength - db.notifications.length} duplicate notifications.`);
          modified = true;
        }

        if (modified) {
          fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
          console.log(`[Database] Pruned bloated local JSON database successfully.`);
        }
      } catch (pruneErr) {
        console.error('[Database] Failed to prune bloated local database on startup:', pruneErr);
      }
    }
    isInitialized = true;
  }
}

// Read database
export async function readDb(): Promise<DatabaseSchema> {
  await initializeDatabase();
  if (USE_POSTGRES && pool) {
    try {
      const { rows: users } = await pool.query('SELECT * FROM users');
      const { rows: tickets } = await pool.query('SELECT * FROM tickets');
      const { rows: ticket_analysis } = await pool.query('SELECT * FROM ticket_analysis');
      const { rows: sla_tracking } = await pool.query('SELECT * FROM sla_tracking');
      const { rows: risk_predictions } = await pool.query('SELECT * FROM risk_predictions');
      const { rows: assignments } = await pool.query('SELECT * FROM assignments');
      const { rows: notifications } = await pool.query('SELECT * FROM notifications');
      const { rows: audit_logs } = await pool.query('SELECT * FROM audit_logs');
      const { rows: email_configs } = await pool.query('SELECT * FROM email_configs');
      return {
        users,
        tickets,
        ticket_analysis,
        sla_tracking,
        risk_predictions,
        assignments,
        notifications,
        audit_logs,
        email_configs
      };
    } catch (err) {
      console.error('[Database] Error performing full readDb query from PostgreSQL:', err);
      return getSeedData();
    }
  } else {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      console.error('Error reading JSON database file, returning seed data:', err);
      return getSeedData();
    }
  }
}

// Write entire database (or persist modified records)
export async function writeDb(data: DatabaseSchema) {
  await initializeDatabase();
  if (USE_POSTGRES && pool) {
    try {
      // For SLA recalculation task, we persist modified tables to PostgreSQL
      for (const s of data.sla_tracking) {
        await pool.query(
          `INSERT INTO sla_tracking (ticket_id, deadline, duration_hours, remaining_minutes, is_breached)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (ticket_id) DO UPDATE 
           SET deadline = EXCLUDED.deadline, duration_hours = EXCLUDED.duration_hours, 
               remaining_minutes = EXCLUDED.remaining_minutes, is_breached = EXCLUDED.is_breached`,
          [s.ticket_id, s.deadline, s.duration_hours, s.remaining_minutes, s.is_breached]
        );
      }
      for (const r of data.risk_predictions) {
        await pool.query(
          `INSERT INTO risk_predictions (ticket_id, risk_score, risk_level, factors)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (ticket_id) DO UPDATE 
           SET risk_score = EXCLUDED.risk_score, risk_level = EXCLUDED.risk_level, factors = EXCLUDED.factors`,
          [r.ticket_id, r.risk_score, r.risk_level, r.factors]
        );
      }
      for (const t of data.tickets) {
        await pool.query(
          'UPDATE tickets SET status = $1, updated_at = $2 WHERE id = $3',
          [t.status, t.updated_at, t.id]
        );
      }
    } catch (err) {
      console.error('[Database] Error putting batch updates into PostgreSQL database:', err);
    }
  } else {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  }
}

// SEED DATA FOR PRODUCTION QUALITY LOOK-AND-FEEL
function getSeedData(): DatabaseSchema {
  const now = new Date();
  
  // Create 4 initial users
  const users: User[] = [
    {
      id: 'u1',
      name: 'Sarah Jenkins',
      email: 'sarah.jenkins@enterprise-core.com',
      role: 'lead',
      status: 'active',
      skills: ['Security', 'Cloud', 'Infrastructure'],
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'
    },
    {
      id: 'u2',
      name: 'Rahul Sharma',
      email: 'rahul.sharma@enterprise-core.com',
      role: 'member',
      status: 'active',
      skills: ['Database', 'Performance', 'Application'],
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'
    },
    {
      id: 'u3',
      name: 'Priya Patel',
      email: 'priya.patel@enterprise-core.com',
      role: 'member',
      status: 'active',
      skills: ['Network', 'Security', 'Authentication'],
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150'
    },
    {
      id: 'u4',
      name: 'John Doe',
      email: 'john.doe@enterprise-core.com',
      role: 'member',
      status: 'active',
      skills: ['Application', 'Cloud', 'Infrastructure', 'Other'],
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150'
    },
    {
      id: 'u5',
      name: 'Alex Rivera',
      email: 'alex.rivera@enterprise-core.com',
      role: 'member',
      status: 'inactive',
      skills: ['Infrastructure', 'Performance'],
      avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150'
    }
  ];

  const timeMinus = (hours: number) => {
    const t = new Date(now.getTime() - hours * 60 * 60 * 1000);
    return t.toISOString();
  };

  const tickets: Ticket[] = [
    {
      id: 'T1001',
      subject: 'CRITICAL: Production DB Master Node is unresponsive - Out of Disk Space',
      body: 'Our automatic alert has triggered. The master database node pg-db-01 is experiencing 100% disk usage on /var/log/postgresql, causing connection failures for all API client services. Application is returning 500 server errors on core services.',
      sender: 'nagios-alerts@enterprise-core.com',
      source: 'gmail',
      status: 'in_progress',
      created_at: timeMinus(2),
      updated_at: timeMinus(1)
    },
    {
      id: 'T1002',
      subject: 'Urgent: Suspicious auth requests detected from foreign subnet',
      body: 'Our SIEM system noticed an unusual spike (over 450 authentication attempts per minute) from IP subnet 198.51.100.0/24 trying to access internal API server accounts. Need database logs review and block rule implementation ASAP.',
      sender: 'siem-security@enterprise-core.com',
      source: 'gmail',
      status: 'open',
      created_at: timeMinus(4),
      updated_at: timeMinus(4)
    },
    {
      id: 'T1003',
      subject: 'Slack connection Webhook timeout warning',
      body: 'Users are reporting that real-time Slack notifications are failing to post. Looks like a DNS query latency issue when communicating with cellular webhook endpoints.',
      sender: 'alerts@slack-corp.com',
      source: 'outlook',
      status: 'resolved',
      created_at: timeMinus(12),
      updated_at: timeMinus(9)
    },
    {
      id: 'T1004',
      subject: 'Need system network topology diagram update',
      body: 'Please refresh the infrastructure draw.io blueprint to reflect the newly provisioned isolated subnets in our US-East region for SLA compliance audits.',
      sender: 'regulatory-compliance@enterprise-core.com',
      source: 'manual',
      status: 'closed',
      created_at: timeMinus(48),
      updated_at: timeMinus(36)
    },
    {
      id: 'T1005',
      subject: 'High Latency / SLA Breach Risk on Asia South Gateway',
      body: 'BGP routing instability has caused massive package drop rate on the main corporate VPN tunnel connected to the Bangalore engineering center. Communication with remote developers is completely hindered.',
      sender: 'networks-noc@enterprise-core.com',
      source: 'gmail',
      status: 'in_progress',
      created_at: timeMinus(3.6),
      updated_at: timeMinus(3.6)
    },
    {
      id: 'T1006',
      subject: 'Kubernetes Pod CrashLoopBackOff: auth-api-service',
      body: 'Kubernetes deployment auth-api-service pod keeps restarting. Container logs indicate memory leak / Out of Memory killing. Need pod resource limit expansion in production cluster specs.',
      sender: 'kubernetes-noc@enterprise-core.com',
      source: 'outlook',
      status: 'open',
      created_at: timeMinus(1.5),
      updated_at: timeMinus(1.5)
    },
    {
      id: 'T1007',
      subject: 'OAuth login loop for standard customer portal',
      body: 'We are receiving multiples tickets from corporate customers saying that they get redirected back to login screen continuously when entering OAuth callback URL. Cookies mismatch might be the cause after the latest TLS certificate upgrade.',
      sender: 'customer-support@retailer_ext.com',
      source: 'csv',
      status: 'resolved',
      created_at: timeMinus(22),
      updated_at: timeMinus(16)
    }
  ];

  const ticket_analysis: TicketAnalysis[] = [
    {
      ticket_id: 'T1001',
      category: 'Database' as TicketCategory,
      complexity: 5,
      priority: 'P1',
      business_impact: 'High',
      recommendation: 'Increase disk size of master node root partition and truncate pg_wal or clear bloated postgresql log files immediately to restore service.'
    },
    {
      ticket_id: 'T1002',
      category: 'Security' as TicketCategory,
      complexity: 4,
      priority: 'P2',
      business_impact: 'High',
      recommendation: 'Deploy dynamic ingress IP block rule on cloud firewall to counter 198.51.100.0/24 access. Audit affected API keys.'
    },
    {
      ticket_id: 'T1003',
      category: 'Application' as TicketCategory,
      complexity: 2,
      priority: 'P3',
      business_impact: 'Medium',
      recommendation: 'Modify dns_resolver timeout configs in slack webhook dispatcher engine and add background retry queue.'
    },
    {
      ticket_id: 'T1004',
      category: 'Infrastructure' as TicketCategory,
      complexity: 1,
      priority: 'P4',
      business_impact: 'Low',
      recommendation: 'Retrieve network layout changes from Cloud Formation logs and update the static Atlassian Confluence documentation page.'
    },
    {
      ticket_id: 'T1005',
      category: 'Network' as TicketCategory,
      complexity: 4,
      priority: 'P1',
      business_impact: 'High',
      recommendation: 'Reroute local transit VPN tunnels traffic temporarily over back up link (Asia West) while ISP fixes BGP handshake config.'
    },
    {
      ticket_id: 'T1006',
      category: 'Cloud' as TicketCategory,
      complexity: 3,
      priority: 'P2',
      business_impact: 'Medium',
      recommendation: 'Expand default Kubernetes RAM memory limits allocation in patch commit and test the container garbage disposal speed.'
    },
    {
      ticket_id: 'T1007',
      category: 'Authentication' as TicketCategory,
      complexity: 2,
      priority: 'P3',
      business_impact: 'High',
      recommendation: 'Set correct Secure and SameSite flags in application OAuth cookies configs to match new secure HTTPS configurations.'
    }
  ];

  const calculateDeadline = (createdStr: string, priority: string) => {
    const created = new Date(createdStr);
    let hours = 24;
    if (priority === 'P1') hours = 4;
    else if (priority === 'P2') hours = 8;
    else if (priority === 'P3') hours = 24;
    else if (priority === 'P4') hours = 48;
    return new Date(created.getTime() + hours * 60 * 60 * 1000).toISOString();
  };

  const sla_tracking: SlaTracking[] = [
    {
      ticket_id: 'T1001',
      deadline: calculateDeadline(tickets[0].created_at, 'P1'),
      duration_hours: 4,
      remaining_minutes: 120,
      is_breached: false
    },
    {
      ticket_id: 'T1002',
      deadline: calculateDeadline(tickets[1].created_at, 'P2'),
      duration_hours: 8,
      remaining_minutes: 240,
      is_breached: false
    },
    {
      ticket_id: 'T1003',
      deadline: calculateDeadline(tickets[2].created_at, 'P3'),
      duration_hours: 24,
      remaining_minutes: 720,
      is_breached: false
    },
    {
      ticket_id: 'T1004',
      deadline: calculateDeadline(tickets[3].created_at, 'P4'),
      duration_hours: 48,
      remaining_minutes: 2160,
      is_breached: false
    },
    {
      ticket_id: 'T1005',
      deadline: calculateDeadline(tickets[4].created_at, 'P1'),
      duration_hours: 4,
      remaining_minutes: 24,
      is_breached: false
    },
    {
      ticket_id: 'T1006',
      deadline: calculateDeadline(tickets[5].created_at, 'P2'),
      duration_hours: 8,
      remaining_minutes: 390,
      is_breached: false
    },
    {
      ticket_id: 'T1007',
      deadline: calculateDeadline(tickets[6].created_at, 'P3'),
      duration_hours: 24,
      remaining_minutes: 120,
      is_breached: false
    }
  ];

  const risk_predictions: RiskPrediction[] = [
    {
      ticket_id: 'T1001',
      risk_score: 85,
      risk_level: 'Critical',
      factors: ['Extreme ticket complexity (5/5)', 'P1 High Urgency', 'Remaining Time < 2 Hours']
    },
    {
      ticket_id: 'T1002',
      risk_score: 48,
      risk_level: 'Medium',
      factors: ['Medium network complexity (4/5)', 'Sufficient SLA cushion (> 4 Hours remaining)']
    },
    {
      ticket_id: 'T1003',
      risk_score: 15,
      risk_level: 'Low',
      factors: ['Resolved state', 'Simple application issue']
    },
    {
      ticket_id: 'T1004',
      risk_score: 5,
      risk_level: 'Low',
      factors: ['Closed state', 'Documentation simple task', 'Generous SLA cushion']
    },
    {
      ticket_id: 'T1005',
      risk_score: 96,
      risk_level: 'Critical',
      factors: ['SLA Breach Imminent (< 30 Minutes remaining)', 'High complexity network anomaly', 'High Business Impact']
    },
    {
      ticket_id: 'T1006',
      risk_score: 35,
      risk_level: 'Medium',
      factors: ['Moderate cloud complexity', 'Unassigned ticket', 'Moderate Business Impact']
    },
    {
      ticket_id: 'T1007',
      risk_score: 10,
      risk_level: 'Low',
      factors: ['Resolved state', 'High Business Impact fully addressed']
    }
  ];

  const assignments: Assignment[] = [
    {
      ticket_id: 'T1001',
      assigned_user_id: 'u2',
      assigned_at: timeMinus(1.8),
      assigned_by: 'system'
    },
    {
      ticket_id: 'T1002',
      assigned_user_id: 'u3',
      assigned_at: timeMinus(3.8),
      assigned_by: 'system'
    },
    {
      ticket_id: 'T1003',
      assigned_user_id: 'u4',
      assigned_at: timeMinus(11.5),
      assigned_by: 'system'
    },
    {
      ticket_id: 'T1004',
      assigned_user_id: 'u1',
      assigned_at: timeMinus(47.5),
      assigned_by: 'lead'
    },
    {
      ticket_id: 'T1005',
      assigned_user_id: 'u3',
      assigned_at: timeMinus(3.5),
      assigned_by: 'system'
    },
    {
      ticket_id: 'T1006',
      assigned_user_id: null,
      assigned_at: '',
      assigned_by: 'system'
    },
    {
      ticket_id: 'T1007',
      assigned_user_id: 'u3',
      assigned_at: timeMinus(21.5),
      assigned_by: 'system'
    }
  ];

  const notifications: Notification[] = [
    {
      id: 'n1',
      ticket_id: 'T1001',
      type: 'critical_created',
      message: '🚨 CRITICAL INCIDENT Created: Production DB Master Node is unresponsive - Out of Disk Space. Assigned to Rahul Sharma.',
      sent_at: timeMinus(2),
      channel: 'both',
      delivered: true
    },
    {
      id: 'n2',
      ticket_id: 'T1005',
      type: 'near_breach',
      message: '⚠️ NEAR BREACH ALERT: High Latency / SLA Breach Risk on Asia South Gateway has < 30 Minutes remaining! Assigned to Priya Patel.',
      sent_at: timeMinus(0.5),
      channel: 'both',
      delivered: true
    }
  ];

  const audit_logs: AuditLog[] = [
    {
      id: 'log1',
      ticket_id: 'T1001',
      user_id: null,
      user_name: 'AI Ingestion Service',
      action: 'INGESTED',
      description: 'Ingested ticket automatically from Gmail alert mailbox.',
      created_at: timeMinus(2)
    },
    {
      id: 'log2',
      ticket_id: 'T1001',
      user_id: null,
      user_name: 'AI Smart Assignment Engine',
      action: 'AUTO_ASSIGNED',
      description: 'System identified Rahul Sharma as highest probability resolver (Db skills, low workload).',
      created_at: timeMinus(1.8)
    },
    {
      id: 'log3',
      ticket_id: 'T1001',
      user_id: 'u2',
      user_name: 'Rahul Sharma',
      action: 'WORK_STARTED',
      description: 'Standard worker Rahul acknowledged the notification and set status to In Progress.',
      created_at: timeMinus(1)
    },
    {
      id: 'log4',
      ticket_id: 'T1005',
      user_id: null,
      user_name: 'AI Smart Assignment Engine',
      action: 'AUTO_ASSIGNED',
      description: 'High priority system network failure routing completed to Priya Patel.',
      created_at: timeMinus(3.5)
    }
  ];

  return {
    users,
    tickets,
    ticket_analysis,
    sla_tracking,
    risk_predictions,
    assignments,
    notifications,
    audit_logs,
    email_configs: []
  };
}

// Data Utility Methods
export async function getUsers(): Promise<User[]> {
  await initializeDatabase();
  if (USE_POSTGRES && pool) {
    try {
      const query = `
        SELECT u.*, COALESCE(COUNT(t.id), 0)::integer as active_tickets_count
        FROM users u
        LEFT JOIN assignments a ON a.assigned_user_id = u.id
        LEFT JOIN tickets t ON t.id = a.ticket_id AND t.status IN ('open', 'in_progress')
        GROUP BY u.id
      `;
      const { rows } = await pool.query(query);
      return rows;
    } catch (err) {
      console.error('[Database] Error executing getUsers query:', err);
      return [];
    }
  } else {
    const db = await readDb();
    return db.users.map(u => {
      const activeCount = db.tickets.filter(t => {
        const isAssigned = db.assignments.find(a => a.ticket_id === t.id)?.assigned_user_id === u.id;
        const isPending = t.status === 'open' || t.status === 'in_progress';
        return isAssigned && isPending;
      }).length;
      return { ...u, active_tickets_count: activeCount };
    });
  }
}

export async function getUserById(id: string): Promise<User | undefined> {
  const users = await getUsers();
  return users.find(u => u.id === id);
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const users = await getUsers();
  return users.find(u => u.email === email);
}

export async function createUser(user: Omit<User, 'id'>): Promise<User> {
  await initializeDatabase();
  const id = 'u' + (Math.floor(Math.random() * 900000) + 100000);
  const newUser: User = { ...user, id };

  const auditId = 'log_usr_' + Math.random().toString(36).substring(2, 9);
  const description = `Created new team member: ${user.name} (${user.role}) - Skills: ${user.skills.join(', ')}`;
  const now = new Date().toISOString();

  if (USE_POSTGRES && pool) {
    try {
      await pool.query(
        'INSERT INTO users (id, name, email, role, status, skills, avatar) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [id, user.name, user.email, user.role, user.status, user.skills, user.avatar]
      );
      await pool.query(
        'INSERT INTO audit_logs (id, ticket_id, user_id, user_name, action, description, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [auditId, '', null, 'Administrator', 'USER_CREATED', description, now]
      );
    } catch (err) {
      console.error('[Database] Failed to insert new user in PostgreSQL:', err);
    }
  } else {
    const db = await readDb();
    db.users.push(newUser);
    db.audit_logs.push({
      id: auditId,
      ticket_id: '',
      user_id: null,
      user_name: 'Administrator',
      action: 'USER_CREATED',
      description,
      created_at: now
    });
    await writeDb(db);
  }

  return newUser;
}

export async function updateUserStatus(userId: string, status: UserStatus) {
  await initializeDatabase();
  if (USE_POSTGRES && pool) {
    try {
      await pool.query('UPDATE users SET status = $1 WHERE id = $2', [status, userId]);
    } catch (err) {
      console.error('[Database] Failed to update user status in PostgreSQL:', err);
    }
  } else {
    const db = await readDb();
    const user = db.users.find(u => u.id === userId);
    if (user) {
      user.status = status;
      await writeDb(db);
    }
  }
}

export async function updateUserAvatar(userId: string, avatar: string) {
  await initializeDatabase();
  if (USE_POSTGRES && pool) {
    try {
      await pool.query('UPDATE users SET avatar = $1 WHERE id = $2', [avatar, userId]);
    } catch (err) {
      console.error('[Database] Failed to update user avatar in PostgreSQL:', err);
    }
  } else {
    const db = await readDb();
    const user = db.users.find(u => u.id === userId);
    if (user) {
      user.avatar = avatar;
      await writeDb(db);
    }
  }
}

export async function getTickets(): Promise<Ticket[]> {
  await initializeDatabase();
  if (USE_POSTGRES && pool) {
    try {
      const { rows } = await pool.query('SELECT * FROM tickets ORDER BY created_at DESC');
      return rows;
    } catch (err) {
      console.error('[Database] Failed to select tickets from PostgreSQL:', err);
      return [];
    }
  } else {
    const db = await readDb();
    return db.tickets;
  }
}

export async function getRichTickets(): Promise<RichTicket[]> {
  await initializeDatabase();
  if (USE_POSTGRES && pool) {
    try {
      const { rows: tickets } = await pool.query('SELECT * FROM tickets ORDER BY created_at DESC');
      const { rows: analyses } = await pool.query('SELECT * FROM ticket_analysis');
      const { rows: slas } = await pool.query('SELECT * FROM sla_tracking');
      const { rows: risks } = await pool.query('SELECT * FROM risk_predictions');
      const { rows: assignments } = await pool.query('SELECT * FROM assignments');
      const usersList = await getUsers();

      return tickets.map(t => {
        const t_id = t.id;
        const analysis = analyses.find(a => a.ticket_id === t_id) || {
          ticket_id: t_id,
          category: 'Other' as TicketCategory,
          complexity: 3,
          priority: 'P3' as const,
          business_impact: 'Medium' as const,
          recommendation: 'Needs manual analysis.'
        };
        
        const sla = slas.find(s => s.ticket_id === t_id) || {
          ticket_id: t_id,
          deadline: new Date(new Date(t.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString(),
          duration_hours: 24,
          remaining_minutes: 1440,
          is_breached: false
        };

        const risk = risks.find(r => r.ticket_id === t_id) || {
          ticket_id: t_id,
          risk_score: 30,
          risk_level: 'Low' as const,
          factors: ['Default low risk predicted.']
        };

        const assignment = assignments.find(a => a.ticket_id === t_id) || {
          ticket_id: t_id,
          assigned_user_id: null,
          assigned_at: '',
          assigned_by: 'system' as const
        };

        const assigned_user = assignment.assigned_user_id 
          ? usersList.find(u => u.id === assignment.assigned_user_id) || null
          : null;

        return {
          ticket: {
            ...t,
            created_at: t.created_at ? new Date(t.created_at).toISOString() : '',
            updated_at: t.updated_at ? new Date(t.updated_at).toISOString() : ''
          },
          analysis,
          sla: {
            ...sla,
            deadline: sla.deadline ? new Date(sla.deadline).toISOString() : '',
            is_breached: !!sla.is_breached
          },
          risk: {
            ...risk,
            risk_score: Number(risk.risk_score)
          },
          assignment: {
            ...assignment,
            assigned_at: assignment.assigned_at ? new Date(assignment.assigned_at).toISOString() : ''
          },
          assigned_user
        };
      });
    } catch (err) {
      console.error('[Database] Failed to perform complex getRichTickets mapping from PostgreSQL:', err);
      return [];
    }
  } else {
    const db = await readDb();
    const usersList = await getUsers();

    return db.tickets.map(t => {
      const analysis = db.ticket_analysis.find(a => a.ticket_id === t.id) || {
        ticket_id: t.id,
        category: 'Other' as TicketCategory,
        complexity: 3,
        priority: 'P3' as const,
        business_impact: 'Medium' as const,
        recommendation: 'Needs manual analysis.'
      };
      
      const sla = db.sla_tracking.find(s => s.ticket_id === t.id) || {
        ticket_id: t.id,
        deadline: new Date(new Date(t.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString(),
        duration_hours: 24,
        remaining_minutes: 1440,
        is_breached: false
      };

      const risk = db.risk_predictions.find(r => r.ticket_id === t.id) || {
        ticket_id: t.id,
        risk_score: 30,
        risk_level: 'Low' as const,
        factors: ['Default low risk predicted.']
      };

      const assignment = db.assignments.find(a => a.ticket_id === t.id) || {
        ticket_id: t.id,
        assigned_user_id: null,
        assigned_at: '',
        assigned_by: 'system' as const
      };

      const assigned_user = assignment.assigned_user_id 
        ? usersList.find(u => u.id === assignment.assigned_user_id) || null
        : null;

      return {
        ticket: t,
        analysis,
        sla,
        risk,
        assignment,
        assigned_user
      };
    });
  }
}

export async function getRichTicketById(id: string): Promise<RichTicket | undefined> {
  const rich = await getRichTickets();
  return rich.find(rt => rt.ticket.id === id);
}

export async function createNewTicketRaw(
  ticket: Ticket, 
  analysis: TicketAnalysis, 
  sla: SlaTracking, 
  risk: RiskPrediction, 
  assignment: Assignment
) {
  await initializeDatabase();
  if (USE_POSTGRES && pool) {
    try {
      await pool.query(
        'INSERT INTO tickets (id, subject, body, sender, source, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [ticket.id, ticket.subject, ticket.body, ticket.sender, ticket.source, ticket.status, ticket.created_at, ticket.updated_at]
      );
      await pool.query(
        'INSERT INTO ticket_analysis (ticket_id, category, complexity, priority, business_impact, recommendation) VALUES ($1, $2, $3, $4, $5, $6)',
        [analysis.ticket_id, analysis.category, analysis.complexity, analysis.priority, analysis.business_impact, analysis.recommendation]
      );
      await pool.query(
        'INSERT INTO sla_tracking (ticket_id, deadline, duration_hours, remaining_minutes, is_breached) VALUES ($1, $2, $3, $4, $5)',
        [sla.ticket_id, sla.deadline, sla.duration_hours, sla.remaining_minutes, sla.is_breached]
      );
      await pool.query(
        'INSERT INTO risk_predictions (ticket_id, risk_score, risk_level, factors) VALUES ($1, $2, $3, $4)',
        [risk.ticket_id, risk.risk_score, risk.risk_level, risk.factors]
      );
      await pool.query(
        'INSERT INTO assignments (ticket_id, assigned_user_id, assigned_at, assigned_by) VALUES ($1, $2, $3, $4)',
        [assignment.ticket_id, assignment.assigned_user_id, assignment.assigned_at || null, assignment.assigned_by]
      );
    } catch (err) {
      console.error('[Database] Failed to insert raw new ticket records in PostgreSQL:', err);
    }
  } else {
    const db = await readDb();
    db.tickets.push(ticket);
    db.ticket_analysis.push(analysis);
    db.sla_tracking.push(sla);
    db.risk_predictions.push(risk);
    db.assignments.push(assignment);
    await writeDb(db);
  }
}

export async function updateTicketStatus(
  ticketId: string, 
  status: TicketStatus, 
  userId: string | null, 
  userName: string
) {
  await initializeDatabase();
  const logId = 'log_' + Math.random().toString(36).substring(2, 9);
  const nowStr = new Date().toISOString();

  if (USE_POSTGRES && pool) {
    try {
      const currentTicket = await getRichTicketById(ticketId);
      if (currentTicket) {
        const oldStatus = currentTicket.ticket.status;
        await pool.query('UPDATE tickets SET status = $1, updated_at = $2 WHERE id = $3', [status, nowStr, ticketId]);
        
        await pool.query(
          'INSERT INTO audit_logs (id, ticket_id, user_id, user_name, action, description, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [logId, ticketId, userId, userName, 'STATUS_CHANGED', `Changed status from ${oldStatus.toUpperCase()} to ${status.toUpperCase()}`, nowStr]
        );
      }
    } catch (err) {
      console.error('[Database] Failed to update ticket status in PostgreSQL:', err);
    }
  } else {
    const db = await readDb();
    const ticket = db.tickets.find(t => t.id === ticketId);
    if (ticket) {
      const oldStatus = ticket.status;
      ticket.status = status;
      ticket.updated_at = nowStr;

      db.audit_logs.push({
        id: logId,
        ticket_id: ticketId,
        user_id: userId,
        user_name: userName,
        action: 'STATUS_CHANGED',
        description: `Changed status from ${oldStatus.toUpperCase()} to ${status.toUpperCase()}`,
        created_at: nowStr
      });
      await writeDb(db);
    }
  }
}

export async function reassignTicket(
  ticketId: string, 
  newUserId: string | null, 
  assignerId: string, 
  assignerName: string
) {
  await initializeDatabase();
  const logId = 'log_' + Math.random().toString(36).substring(2, 9);
  const nowStr = new Date().toISOString();

  if (USE_POSTGRES && pool) {
    try {
      const richTicket = await getRichTicketById(ticketId);
      if (richTicket) {
        const oldUserId = richTicket.assignment?.assigned_user_id;
        const usersList = await getUsers();
        const oldUser = oldUserId ? usersList.find(u => u.id === oldUserId) : null;
        const newUser = newUserId ? usersList.find(u => u.id === newUserId) : null;

        await pool.query(
          `INSERT INTO assignments (ticket_id, assigned_user_id, assigned_at, assigned_by) 
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (ticket_id) DO UPDATE 
           SET assigned_user_id = EXCLUDED.assigned_user_id, assigned_at = EXCLUDED.assigned_at, assigned_by = EXCLUDED.assigned_by`,
          [ticketId, newUserId, nowStr, 'lead']
        );

        await pool.query(
          'INSERT INTO audit_logs (id, ticket_id, user_id, user_name, action, description, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [
            logId, 
            ticketId, 
            assignerId, 
            assignerName, 
            'REASSIGNED', 
            `Reassigned ticket from ${oldUser ? oldUser.name : 'Unassigned'} to ${newUser ? newUser.name : 'Unassigned'}`, 
            nowStr
          ]
        );
      }
    } catch (err) {
      console.error('[Database] Failed to reassign ticket in PostgreSQL:', err);
    }
  } else {
    const db = await readDb();
    let assignment = db.assignments.find(a => a.ticket_id === ticketId);
    
    const newUser = db.users.find(u => u.id === newUserId);
    const oldUserId = assignment?.assigned_user_id;
    const oldUser = oldUserId ? db.users.find(u => u.id === oldUserId) : null;
    
    if (!assignment) {
      assignment = {
        ticket_id: ticketId,
        assigned_user_id: newUserId,
        assigned_at: nowStr,
        assigned_by: 'lead'
      };
      db.assignments.push(assignment);
    } else {
      assignment.assigned_user_id = newUserId;
      assignment.assigned_at = nowStr;
      assignment.assigned_by = 'lead';
    }

    db.audit_logs.push({
      id: logId,
      ticket_id: ticketId,
      user_id: assignerId,
      user_name: assignerName,
      action: 'REASSIGNED',
      description: `Reassigned ticket from ${oldUser ? oldUser.name : 'Unassigned'} to ${newUser ? newUser.name : 'Unassigned'}`,
      created_at: nowStr
    });
    await writeDb(db);
  }
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  await initializeDatabase();
  if (USE_POSTGRES && pool) {
    try {
      const { rows } = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC');
      return rows;
    } catch (err) {
      console.error('[Database] Failed to fetch audit logs from PostgreSQL:', err);
      return [];
    }
  } else {
    const db = await readDb();
    return db.audit_logs;
  }
}

export async function addAuditLog(
  ticketId: string, 
  userId: string | null, 
  userName: string, 
  action: string, 
  description: string
) {
  await initializeDatabase();
  const id = 'log_' + Math.random().toString(36).substring(2, 9);
  const nowStr = new Date().toISOString();

  if (USE_POSTGRES && pool) {
    try {
      await pool.query(
        'INSERT INTO audit_logs (id, ticket_id, user_id, user_name, action, description, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [id, ticketId, userId, userName, action, description, nowStr]
      );
    } catch (err) {
      console.error('[Database] Failed to add audit log in PostgreSQL:', err);
    }
  } else {
    const db = await readDb();
    db.audit_logs.push({
      id,
      ticket_id: ticketId,
      user_id: userId,
      user_name: userName,
      action,
      description,
      created_at: nowStr
    });
    await writeDb(db);
  }
}

export async function getNotifications(): Promise<Notification[]> {
  await initializeDatabase();
  if (USE_POSTGRES && pool) {
    try {
      const { rows } = await pool.query('SELECT * FROM notifications ORDER BY sent_at DESC');
      return rows.map(r => ({
        ...r,
        delivered: !!r.delivered
      }));
    } catch (err) {
      console.error('[Database] Failed to fetch notifications from PostgreSQL:', err);
      return [];
    }
  } else {
    const db = await readDb();
    return db.notifications;
  }
}

export async function addNotification(
  notification: Omit<Notification, 'id' | 'sent_at'>
): Promise<Notification> {
  await initializeDatabase();
  const id = 'notif_' + Math.random().toString(36).substring(2, 9);
  const sent_at = new Date().toISOString();
  const newNotif: Notification = {
    ...notification,
    id,
    sent_at
  };

  if (USE_POSTGRES && pool) {
    try {
      await pool.query(
        'INSERT INTO notifications (id, ticket_id, type, message, sent_at, channel, delivered) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [id, notification.ticket_id, notification.type, notification.message, sent_at, notification.channel, notification.delivered]
      );
    } catch (err) {
      console.error('[Database] Failed to insert notification in PostgreSQL:', err);
    }
  } else {
    const db = await readDb();
    db.notifications.push(newNotif);
    await writeDb(db);
  }

  return newNotif;
}

export async function getEmailConfigs(): Promise<EmailConfig[]> {
  await initializeDatabase();
  if (USE_POSTGRES && pool) {
    try {
      const { rows } = await pool.query('SELECT * FROM email_configs');
      return rows.map(r => ({
        ...r,
        use_ssl: !!r.use_ssl,
        is_active: !!r.is_active
      }));
    } catch (err) {
      console.error('[Database] Failed to fetch email configs from PostgreSQL:', err);
      return [];
    }
  } else {
    const db = await readDb();
    return db.email_configs || [];
  }
}

export async function saveEmailConfig(config: Omit<EmailConfig, 'id'> & { id?: string }): Promise<EmailConfig> {
  await initializeDatabase();
  const id = config.id || 'emcfg_' + Math.random().toString(36).substring(2, 9);
  const target: EmailConfig = {
    ...config,
    id
  };

  if (USE_POSTGRES && pool) {
    try {
      await pool.query(
        `INSERT INTO email_configs (id, imap_host, imap_port, imap_user, imap_pass, use_ssl, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE
         SET imap_host = EXCLUDED.imap_host, imap_port = EXCLUDED.imap_port,
             imap_user = EXCLUDED.imap_user, imap_pass = EXCLUDED.imap_pass,
             use_ssl = EXCLUDED.use_ssl, is_active = EXCLUDED.is_active`,
        [id, target.imap_host, target.imap_port, target.imap_user, target.imap_pass, target.use_ssl, target.is_active]
      );
    } catch (err) {
      console.error('[Database] Failed to save email config in PostgreSQL:', err);
    }
  } else {
    const db = await readDb();
    if (!db.email_configs) db.email_configs = [];
    const index = db.email_configs.findIndex(c => c.id === id);
    if (index >= 0) {
      db.email_configs[index] = target;
    } else {
      db.email_configs.push(target);
    }
    await writeDb(db);
  }
  return target;
}

export async function deleteEmailConfig(id: string): Promise<boolean> {
  await initializeDatabase();
  if (USE_POSTGRES && pool) {
    try {
      await pool.query('DELETE FROM email_configs WHERE id = $1', [id]);
      return true;
    } catch (err) {
      console.error('[Database] Failed to delete email config from PostgreSQL:', err);
      return false;
    }
  } else {
    const db = await readDb();
    if (!db.email_configs) db.email_configs = [];
    const originalLength = db.email_configs.length;
    db.email_configs = db.email_configs.filter(c => c.id !== id);
    await writeDb(db);
    return db.email_configs.length < originalLength;
  }
}
