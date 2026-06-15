export type UserRole = 'lead' | 'member';
export type UserStatus = 'active' | 'inactive';
export type TicketSource = 'gmail' | 'outlook' | 'manual' | 'csv';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  skills: string[]; // e.g. ['Database', 'Network', 'Security']
  avatar?: string;
  active_tickets_count?: number;
}

export interface Ticket {
  id: string;
  subject: string;
  body: string;
  sender: string;
  source: TicketSource;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
}

export type TicketCategory =
  | 'Database'
  | 'Network'
  | 'Security'
  | 'Infrastructure'
  | 'Cloud'
  | 'Application'
  | 'Performance'
  | 'Authentication'
  | 'Other';

export interface TicketAnalysis {
  ticket_id: string;
  category: TicketCategory;
  complexity: number; // 1 to 5
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  business_impact: 'Low' | 'Medium' | 'High';
  recommendation: string;
}

export interface SlaTracking {
  ticket_id: string;
  deadline: string; // ISO string
  duration_hours: number; // e.g. 4 for P1, 8 for P2
  remaining_minutes: number;
  is_breached: boolean;
}

export interface RiskPrediction {
  ticket_id: string;
  risk_score: number; // 0 - 100
  risk_level: 'Low' | 'Medium' | 'High' | 'Critical';
  factors: string[];
}

export interface Assignment {
  ticket_id: string;
  assigned_user_id: string | null;
  assigned_at: string;
  assigned_by: 'system' | 'lead';
}

export interface AuditLog {
  id: string;
  ticket_id: string;
  user_id: string | null; // null for system
  user_name: string; // System or User Name
  action: string;
  description: string;
  created_at: string;
}

export interface Notification {
  id: string;
  ticket_id: string;
  type: string; // e.g. 'critical_created' | 'high_risk' | 'near_breach' | 'sla_breached'
  message: string;
  sent_at: string;
  channel: 'discord' | 'in_app' | 'both';
  delivered: boolean;
}

// Complete consolidated ticket information for dashboards
export interface RichTicket {
  ticket: Ticket;
  analysis: TicketAnalysis;
  sla: SlaTracking;
  risk: RiskPrediction;
  assignment: Assignment;
  assigned_user: User | null;
}

// AI Summary Interface
export interface ExecutiveAISummary {
  today_analyzed_count: number;
  critical_risks_detected: number;
  database_percentage: number;
  avg_resolution_hours: number;
  unassigned_count: number;
  summary_text: string;
  timestamp: string;
}

// Personal AI Insights Interface
export interface PersonalAIInsights {
  engineer_id: string;
  engineer_name: string;
  resolved_tickets: number;
  category_counts: Record<string, number>;
  most_frequent_category: string;
  avg_resolution_hours: number;
  top_strength: string;
  recommendation: string;
}

export interface EmailConfig {
  id: string;
  imap_host: string;
  imap_port: number;
  imap_user: string;
  imap_pass: string;
  use_ssl: boolean;
  is_active: boolean;
}

