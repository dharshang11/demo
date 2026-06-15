import { RichTicket, User } from '../types.js';
import { 
  Inbox, 
  Hourglass, 
  CheckCircle, 
  FolderLock, 
  AlertOctagon, 
  AlertTriangle, 
  Flame,
  Activity
} from 'lucide-react';

interface DashboardStatsProps {
  tickets: RichTicket[];
  currentUser: User;
}

export default function DashboardStats({ tickets, currentUser }: DashboardStatsProps) {
  const isLead = currentUser.role === 'lead';

  // Calculations
  const myTickets = tickets.filter(rt => rt.assignment.assigned_user_id === currentUser.id);

  const total = isLead ? tickets.length : myTickets.length;
  const open = (isLead ? tickets : myTickets).filter(rt => rt.ticket.status === 'open').length;
  const inProgress = (isLead ? tickets : myTickets).filter(rt => rt.ticket.status === 'in_progress').length;
  const resolved = (isLead ? tickets : myTickets).filter(rt => rt.ticket.status === 'resolved').length;
  const closed = (isLead ? tickets : myTickets).filter(rt => rt.ticket.status === 'closed').length;
  
  // Critical = Priority P1 and not resolved/closed
  const critical = (isLead ? tickets : myTickets).filter(rt => 
    rt.analysis.priority === 'P1' && 
    rt.ticket.status !== 'resolved' && 
    rt.ticket.status !== 'closed'
  ).length;

  // Near Breach = Priority P1/P2, open/in_progress, remaining minutes < 30
  const nearBreach = (isLead ? tickets : myTickets).filter(rt => 
    rt.ticket.status !== 'resolved' && 
    rt.ticket.status !== 'closed' && 
    rt.sla.remaining_minutes > 0 && 
    rt.sla.remaining_minutes <= 30
  ).length;

  // SLA Breaches = remaining minutes <= 0 and open/in_progress
  const breaches = (isLead ? tickets : myTickets).filter(rt => 
    rt.ticket.status !== 'resolved' && 
    rt.ticket.status !== 'closed' && 
    rt.sla.remaining_minutes <= 0
  ).length;

  const cardClass = "bg-white p-3.5 rounded-md border border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex items-center justify-between transition-all hover:border-[#2563eb]/30";

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-4.5">
      {/* Total Tickets */}
      <div className={cardClass}>
        <div>
          <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider block mb-0.5">
            {isLead ? 'Global Pool' : 'My Total'}
          </span>
          <span className="text-xl font-extrabold text-[#0f172a] block leading-none">{total}</span>
        </div>
        <div className="p-1.5 bg-slate-50 text-slate-500 rounded border border-slate-100">
          <Inbox className="h-3.5 w-3.5" />
        </div>
      </div>

      {/* Open */}
      <div className={cardClass}>
        <div>
          <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider block mb-0.5">
            Untriaged
          </span>
          <span className="text-xl font-extrabold text-[#2563eb] block leading-none">{open}</span>
        </div>
        <div className="p-1.5 bg-blue-50 text-blue-600 rounded border border-blue-100">
          <Hourglass className="h-3.5 w-3.5" />
        </div>
      </div>

      {/* In Progress */}
      <div className={cardClass}>
        <div>
          <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider block mb-0.5">
            In Work
          </span>
          <span className="text-xl font-extrabold text-amber-600 block leading-none">{inProgress}</span>
        </div>
        <div className="p-1.5 bg-amber-50 text-amber-500 rounded border border-amber-100">
          <Activity className="h-3.5 w-3.5" />
        </div>
      </div>

      {/* Resolved */}
      <div className={cardClass}>
        <div>
          <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider block mb-0.5">
            Resolved
          </span>
          <span className="text-xl font-extrabold text-emerald-600 block leading-none">{resolved}</span>
        </div>
        <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded border border-emerald-100">
          <CheckCircle className="h-3.5 w-3.5" />
        </div>
      </div>

      {/* Closed */}
      <div className={cardClass}>
        <div>
          <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider block mb-0.5">
            Archived
          </span>
          <span className="text-xl font-extrabold text-slate-700 block leading-none">{closed}</span>
        </div>
        <div className="p-1.5 bg-slate-100 text-slate-705 text-slate-700 rounded border border-slate-150">
          <FolderLock className="h-3.5 w-3.5" />
        </div>
      </div>

      {/* Critical Incidents */}
      <div className={cardClass}>
        <div>
          <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider block mb-0.5">
            Critical
          </span>
          <span className="text-xl font-extrabold text-red-600 block leading-none">{critical}</span>
        </div>
        <div className="p-1.5 bg-red-50 text-red-500 rounded border border-red-100 animate-pulse">
          <AlertOctagon className="h-3.5 w-3.5" />
        </div>
      </div>

      {/* Near Breach Incidents */}
      <div className={cardClass}>
        <div>
          <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block mb-0.5">
            Near SLA
          </span>
          <span className="text-xl font-extrabold text-amber-650 text-amber-655 text-amber-600 block leading-none">{nearBreach}</span>
        </div>
        <div className="p-1.5 bg-amber-50 text-amber-500 rounded border border-amber-150">
          <Flame className="h-3.5 w-3.5" />
        </div>
      </div>

      {/* SLA Breaches */}
      <div className={cardClass}>
        <div>
          <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider block mb-0.5">
            SLA Failed
          </span>
          <span className="text-xl font-extrabold text-red-700 block leading-none">{breaches}</span>
        </div>
        <div className="p-1.5 bg-red-100 text-red-700 rounded border border-red-200">
          <AlertTriangle className="h-3.5 w-3.5" />
        </div>
      </div>
    </div>
  );
}
