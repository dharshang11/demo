import { User, Ticket, TicketAnalysis, SlaTracking, RiskPrediction, Assignment, TicketCategory, TicketStatus } from '../types.js';
import { getUsers, readDb, writeDb, addNotification } from './db.js';

// SLA ENGINE
// Calculate default SLA duration in hours based on priority
export function getSlaDurationHours(priority: 'P1' | 'P2' | 'P3' | 'P4'): number {
  switch (priority) {
    case 'P1': return 4;
    case 'P2': return 8;
    case 'P3': return 24;
    case 'P4': return 48;
    default: return 24;
  }
}

// Calculate static SLA Deadline, remaining time (minutes), and breached status
export function calculateSla(createdAtIso: string, priority: 'P1' | 'P2' | 'P3' | 'P4'): SlaTracking {
  const createdDate = new Date(createdAtIso);
  const durationHours = getSlaDurationHours(priority);
  const deadlineDate = new Date(createdDate.getTime() + durationHours * 60 * 60 * 1000);
  
  const now = new Date();
  const diffMs = deadlineDate.getTime() - now.getTime();
  const remainingMinutes = Math.round(diffMs / 60 / 1000);
  const is_breached = remainingMinutes <= 0;

  return {
    ticket_id: '',
    deadline: deadlineDate.toISOString(),
    duration_hours: durationHours,
    remaining_minutes: remainingMinutes,
    is_breached
  };
}

// RISK PREDICTION ENGINE
// Calculates a highly realistic risk score between 0 and 100 based on core metrics
export function predictRisk(
  status: TicketStatus,
  remainingMinutes: number,
  priority: 'P1' | 'P2' | 'P3' | 'P4',
  complexity: number,
  businessImpact: 'Low' | 'Medium' | 'High'
): RiskPrediction {
  // If already resolved or closed, risk is very low
  if (status === 'resolved' || status === 'closed') {
    return {
      ticket_id: '',
      risk_score: status === 'resolved' ? 15 : 5,
      risk_level: 'Low',
      factors: ['Ticket has been successfully resolved/closed by engineering.']
    };
  }

  let score = 0;
  const factors: string[] = [];

  // Factor 1: SLA Time pressure
  let totalHoursOfSla = getSlaDurationHours(priority);
  let totalMinOfSla = totalHoursOfSla * 60;
  let timeRatio = remainingMinutes / totalMinOfSla;

  if (remainingMinutes <= 0) {
    score += 45;
    factors.push('SLA Deadline has been BREACHED');
  } else if (remainingMinutes < 30) {
    score += 40;
    factors.push('SLA Breach is IMMINENT (< 30 min remaining)');
  } else if (timeRatio < 0.25) {
    score += 25;
    factors.push('SLA timeline under high pressure (< 25% time cushion)');
  } else if (timeRatio < 0.5) {
    score += 15;
    factors.push('Moderate SLA time pressure (< 50% remaining)');
  } else {
    factors.push('Sufficient SLA cushion (> 50% remaining)');
  }

  // Factor 2: Priority Weight
  if (priority === 'P1') {
    score += 25;
    factors.push('Critical Priority (P1 Core Incident)');
  } else if (priority === 'P2') {
    score += 15;
    factors.push('Urgent Priority (P2 Significant Outage)');
  } else if (priority === 'P3') {
    score += 5;
  }

  // Factor 3: Complexity Weight (1-5)
  score += complexity * 5; // adds 5 to 25 points
  if (complexity >= 4) {
    factors.push(`High incident technical complexity: Rating ${complexity}/5`);
  }

  // Factor 4: Business Impact
  if (businessImpact === 'High') {
    score += 15;
    factors.push('High Business Impact on downstream systems');
  } else if (businessImpact === 'Medium') {
    score += 8;
  }

  // Bound score between 0 and 100
  const finalScore = Math.max(0, Math.min(100, score));

  // Determine levels: 0-30 = Low, 31-60 = Medium, 61-80 = High, 81-100 = Critical
  let risk_level: 'Low' | 'Medium' | 'High' | 'Critical' = 'Low';
  if (finalScore >= 81) {
    risk_level = 'Critical';
  } else if (finalScore >= 61) {
    risk_level = 'High';
  } else if (finalScore >= 31) {
    risk_level = 'Medium';
  }

  return {
    ticket_id: '',
    risk_score: finalScore,
    risk_level,
    factors
  };
}

// SMART ASSIGNMENT ENGINE
// Automatically assigns tickets based on suitability scoring
// Suitability Score = SkillMatchBonus (50 pts) - ActiveCountPenalty (5 pts * count) - ComplexityWorkloadPenalty (2 pts * sumComplexity)
export async function assignTicketAutomatically(ticketId: string, category: TicketCategory, complexity: number): Promise<Assignment> {
  const engineers = (await getUsers()).filter(u => u.status === 'active' && u.role === 'member');
  
  // Handlers if no active support engineers
  if (engineers.length === 0) {
    // Falls back to assigning to the Team Lead
    const leads = (await getUsers()).filter(u => u.status === 'active' && u.role === 'lead');
    const leadId = leads[0]?.id || 'u1';
    
    return {
      ticket_id: ticketId,
      assigned_user_id: leadId,
      assigned_at: new Date().toISOString(),
      assigned_by: 'system'
    };
  }

  let bestEngineer: User = engineers[0];
  let highestScore = -9999;

  for (const eng of engineers) {
    let score = 0;

    // 1. Skill Match Check (Does the engineer have the specific category in skills list?)
    // Normalizing strings (e.g. 'Network' or 'Database')
    const hasSkill = eng.skills.some(skill => skill.toLowerCase() === category.toLowerCase());
    if (hasSkill) {
      score += 50; // Massively prioritize matching expertise
    }

    // 2. Workload & Ticket Count Penalties
    const activeCount = eng.active_tickets_count || 0;
    score -= (activeCount * 5); // 5 points deduction per open ticket

    // 3. Complexity penalty
    // Let's retrieve all current assigned ticket complexites for this user
    const db = await readDb();
    const assignedComplexities = db.assignments
      .filter(a => a.assigned_user_id === eng.id)
      .map(a => {
        const analysis = db.ticket_analysis.find(ta => ta.ticket_id === a.ticket_id);
        const ticket = db.tickets.find(t => t.id === a.ticket_id);
        const isOpen = ticket && (ticket.status === 'open' || ticket.status === 'in_progress');
        return isOpen && analysis ? analysis.complexity : 0;
      });
    const totalComplexityWorkload = assignedComplexities.reduce((a, b) => a + b, 0);
    score -= (totalComplexityWorkload * 2); // Deduct 2 points per complexity weight point currently handled

    // Add some random tiny tiebreaker so it distributes evenly on perfectly identical tiers
    score += Math.random() * 0.1;

    console.log(`Smart Assignment suitability calculation for ${eng.name} regarding category "${category}": Score = ${score.toFixed(2)} (SkillMatch: ${hasSkill}, OpenCount: ${activeCount})`);

    if (score > highestScore) {
      highestScore = score;
      bestEngineer = eng;
    }
  }

  return {
    ticket_id: ticketId,
    assigned_user_id: bestEngineer.id,
    assigned_at: new Date().toISOString(),
    assigned_by: 'system'
  };
}

// REALTIME RE-CALCULATOR & ALERT DISPATCHER (Cron Worker-like Routine)
// Updates remaining_minutes on active tickets AND sends alerts for breaches or critical risks
export async function runSlaAndRiskChecks(): Promise<{ updated_count: number; alerts_dispatched: number }> {
  const db = await readDb();
  let updated_count = 0;
  let alerts_dispatched = 0;
  const now = new Date();

  for (const ticket of db.tickets) {
    if (ticket.status === 'resolved' || ticket.status === 'closed') continue;

    const analysis = db.ticket_analysis.find(a => a.ticket_id === ticket.id);
    const sla = db.sla_tracking.find(s => s.ticket_id === ticket.id);
    const risk = db.risk_predictions.find(r => r.ticket_id === ticket.id);
    const assignment = db.assignments.find(a => a.ticket_id === ticket.id);

    if (!analysis || !sla || !risk) continue;

    // Calculate live remaining time
    const deadlineDate = new Date(sla.deadline);
    const diffMs = deadlineDate.getTime() - now.getTime();
    const remainingMinutes = Math.round(diffMs / 60 / 1000);
    
    const was_breached = sla.is_breached;
    const is_breachedNow = remainingMinutes <= 0;
    
    sla.remaining_minutes = remainingMinutes;
    sla.is_breached = is_breachedNow;

    // Recalculate Risk Score
    const newRisk = predictRisk(ticket.status, remainingMinutes, analysis.priority, analysis.complexity, analysis.business_impact);
    const oldScore = risk.risk_score;
    risk.risk_score = newRisk.risk_score;
    risk.risk_level = newRisk.risk_level;
    risk.factors = newRisk.factors;

    updated_count++;

    // DISCORD ALERTS TRIGGERS:
    // 1. Critical Ticket Created (handled during creation)
    // 2. Risk Score crossed 80
    // 3. Remaining SLA < 30 Minutes
    // 4. SLA Breached
    const assignedUser = db.users.find(u => u.id === assignment?.assigned_user_id);
    const assigneeName = assignedUser ? assignedUser.name : 'Unassigned';

    // TRIGGER 3: SLA < 30 Minutes Warning
    const alreadyWarnedSla = db.notifications.some(n => n.ticket_id === ticket.id && n.type === 'near_breach');
    if (remainingMinutes > 0 && remainingMinutes <= 30 && !alreadyWarnedSla) {
      const message = `⚠️ NEAR BREACH ALERT | Ticket ${ticket.id} (${analysis.priority}) has only ${remainingMinutes} minutes left before SLA failure! Assigned to ${assigneeName}.`;
      const addedNotif = await addNotification({
        ticket_id: ticket.id,
        type: 'near_breach',
        message,
        channel: 'both',
        delivered: true
      });
      db.notifications.push(addedNotif);
      alerts_dispatched++;
      // Log to audit log
      db.audit_logs.push({
        id: 'log_' + Math.random().toString(36).substring(2, 9),
        ticket_id: ticket.id,
        user_id: null,
        user_name: 'SLA Engine',
        action: 'SLA_WARNING',
        description: `Triggered critical breach alert: remaining minutes is ${remainingMinutes}.`,
        created_at: now.toISOString()
      });
    }

    // TRIGGER 4: SLA Breached Alert
    const alreadyNotifiedBreached = db.notifications.some(n => n.ticket_id === ticket.id && n.type === 'sla_breached');
    if (is_breachedNow && !alreadyNotifiedBreached) {
      const message = `🚨 SLA BREACHED ALERT | Ticket ${ticket.id} has breached its ${sla.duration_hours}H SLA deadline! Please reassign or expedite immediately. Assigned: ${assigneeName}.`;
      const addedNotif = await addNotification({
        ticket_id: ticket.id,
        type: 'sla_breached',
        message,
        channel: 'both',
        delivered: true
      });
      db.notifications.push(addedNotif);
      alerts_dispatched++;
      // Log to audit
      db.audit_logs.push({
        id: 'log_' + Math.random().toString(36).substring(2, 9),
        ticket_id: ticket.id,
        user_id: null,
        user_name: 'SLA Engine',
        action: 'SLA_BREACHED',
        description: 'SLA deadline exceeded. Status marked as Breached.',
        created_at: now.toISOString()
      });
    }

    // TRIGGER 2: High Risk Score > 80 Alert
    const alreadyNotifiedRisk = db.notifications.some(n => n.ticket_id === ticket.id && n.type === 'high_risk');
    if (newRisk.risk_score > 80 && oldScore <= 80 && !alreadyNotifiedRisk) {
      const message = `🔥 EXTREME RISK ALERT | Ticket ${ticket.id} is predicted with Risk Score ${newRisk.risk_score}/100 [${newRisk.risk_level}]. Assigned to ${assigneeName}.`;
      const addedNotif = await addNotification({
        ticket_id: ticket.id,
        type: 'high_risk',
        message,
        channel: 'both',
        delivered: true
      });
      db.notifications.push(addedNotif);
      alerts_dispatched++;
    }
  }

  await writeDb(db);
  return { updated_count, alerts_dispatched };
}
