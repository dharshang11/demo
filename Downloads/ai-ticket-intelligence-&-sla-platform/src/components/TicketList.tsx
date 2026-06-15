import React from 'react';
import { RichTicket, User, TicketStatus, TicketCategory } from '../types.js';
import { 
  Search, 
  Filter, 
  Clock, 
  AlertTriangle, 
  User2, 
  ArrowUpRight, 
  SlidersHorizontal,
  ChevronRight,
  ShieldAlert,
  MessageSquare,
  History,
  CheckCircle,
  HelpCircle
} from 'lucide-react';

interface TicketListProps {
  tickets: RichTicket[];
  users: User[];
  currentUser: User;
  onUpdateStatus: (ticketId: string, status: TicketStatus) => void;
  onReassign: (ticketId: string, userId: string | null) => void;
  onTriggerCheck: () => void;
}

export default function TicketList({
  tickets,
  users,
  currentUser,
  onUpdateStatus,
  onReassign,
  onTriggerCheck
}: TicketListProps) {
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [categoryFilter, setCategoryFilter] = React.useState<string>('all');
  const [priorityFilter, setPriorityFilter] = React.useState<string>('all');
  const [selectedTicket, setSelectedTicket] = React.useState<RichTicket | null>(null);
  const [auditLogs, setAuditLogs] = React.useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = React.useState(false);

  const isLead = currentUser.role === 'lead';

  // Format hours/minutes remaining tightly for UI
  const formatSlaRemaining = (mins: number) => {
    if (mins <= 0) {
      return (
        <span className="text-[#dc2626] bg-red-50 border border-red-150 px-1.5 py-0.5 rounded-sm font-bold text-[9px] tracking-wide inline-flex items-center uppercase animate-pulse">
          SLA Breach
        </span>
      );
    }
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    
    let colorClass = "text-slate-600 bg-slate-50 border-slate-200";
    if (mins <= 30) {
      colorClass = "text-red-700 bg-red-50 border-red-150 animate-pulse font-bold";
    } else if (mins <= 120) {
      colorClass = "text-amber-700 bg-amber-50 border-amber-150 font-semibold";
    }

    return (
      <span className={`px-1.5 py-0.5 rounded-sm text-[9.5px] border ${colorClass} inline-flex items-center space-x-1`}>
        <Clock className="h-2.5 w-2.5 opacity-80" />
        <span>{h > 0 ? `${h}h ${m}m` : `${m}m`}</span>
      </span>
    );
  };

  // Compute Risk Badges
  const getRiskBadge = (score: number) => {
    let color = "bg-slate-50 text-slate-605 text-slate-600 border-slate-200";
    let level = "Low";
    if (score >= 81) {
      color = "bg-[#dc2626] text-white border-[#b91c1c] font-bold";
      level = "CRIT";
    } else if (score >= 61) {
      color = "bg-[#ea580c] text-white border-[#c2410c] font-bold";
      level = "HIGH";
    } else if (score >= 31) {
      color = "bg-[#d97706] text-white border-[#b45309] font-semibold";
      level = "MED";
    }

    return (
      <div className={`px-1.5 py-0.5 rounded-sm text-[9px] border ${color} inline-block font-mono leading-none uppercase tracking-wide`}>
        {level} &bull; {score}
      </div>
    );
  };

  // Fetch audit logs for details panel
  const fetchAuditLogs = React.useCallback(async (ticketId: string) => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/audit-logs');
      if (res.ok) {
        const data = await res.json();
        // Filter specifically for this ticket
        const filtered = data.filter((log: any) => log.ticket_id === ticketId);
        setAuditLogs(filtered);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  const viewTicketDetails = async (rt: RichTicket) => {
    setSelectedTicket(rt);
    await fetchAuditLogs(rt.ticket.id);
  };

  // Sync selectedTicket with the latest updates from tickets prop
  React.useEffect(() => {
    if (selectedTicket) {
      const updated = tickets.find(t => t.ticket.id === selectedTicket.ticket.id);
      const canAccess = updated && (isLead || updated.assignment.assigned_user_id === currentUser.id);

      if (canAccess) {
        const hasChanged = 
          updated.ticket.status !== selectedTicket.ticket.status ||
          updated.ticket.updated_at !== selectedTicket.ticket.updated_at ||
          updated.assignment.assigned_user_id !== selectedTicket.assignment.assigned_user_id ||
          updated.sla.remaining_minutes !== selectedTicket.sla.remaining_minutes ||
          updated.risk.risk_score !== selectedTicket.risk.risk_score;

        if (hasChanged) {
          setSelectedTicket(updated);
          
          const logAffectingChange = 
            updated.ticket.status !== selectedTicket.ticket.status ||
            updated.assignment.assigned_user_id !== selectedTicket.assignment.assigned_user_id;

          if (logAffectingChange) {
            fetchAuditLogs(updated.ticket.id);
          }
        }
      } else {
        setSelectedTicket(null);
        setAuditLogs([]);
      }
    }
  }, [tickets, selectedTicket, fetchAuditLogs, isLead, currentUser.id]);

  // Filtered tickets list logic
  const filteredTickets = tickets.filter(rt => {
    // 1. Role boundaries for Team Members (can ONLY see assigned tickets)
    if (!isLead && rt.assignment.assigned_user_id !== currentUser.id) {
      return false;
    }

    // 2. Text Search Match
    const searchText = search.toLowerCase();
    const matchesKeyword = 
      rt.ticket.id.toLowerCase().includes(searchText) ||
      rt.ticket.subject.toLowerCase().includes(searchText) ||
      rt.ticket.body.toLowerCase().includes(searchText) ||
      rt.ticket.sender.toLowerCase().includes(searchText) ||
      rt.analysis.category.toLowerCase().includes(searchText);

    // 3. Status Filters
    const matchesStatus = statusFilter === 'all' || rt.ticket.status === statusFilter;

    // 4. Category Filters
    const matchesCategory = categoryFilter === 'all' || rt.analysis.category === categoryFilter;

    // 5. Priority Filters
    const matchesPriority = priorityFilter === 'all' || rt.analysis.priority === priorityFilter;

    return matchesKeyword && matchesStatus && matchesCategory && matchesPriority;
  });

  const activeTechnicians = users.filter(u => u.status === 'active' && u.role === 'member');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* LEFT & CENTER PANEL: TICKETS DATAGRID TABLE */}
      <div className="lg:col-span-2 bg-white rounded-md border border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-4">
        
        {/* Search, Filters, Tools bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-100">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-450 text-slate-400" />
            <input
              type="text"
              placeholder="Search ID, sender, subject, or AI class..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-[#2563eb] bg-slate-50/50 hover:bg-slate-50 transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Status Select */}
            <div className="flex items-center space-x-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white border border-slate-250 hover:border-slate-350 rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open (New)</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed (Lead Only)</option>
              </select>
            </div>

            {/* Category Select */}
            <div className="flex items-center space-x-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">AI Domain:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-white border border-slate-250 hover:border-slate-350 rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="all">All Domains</option>
                <option value="Database">Database</option>
                <option value="Network">Network</option>
                <option value="Security">Security</option>
                <option value="Infrastructure">Infrastructure</option>
                <option value="Cloud">Cloud</option>
                <option value="Performance">Performance</option>
                <option value="Authentication">Authentication</option>
                <option value="Application">Application</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Priority Select */}
            <div className="flex items-center space-x-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Tier:</span>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="bg-white border border-slate-250 hover:border-slate-350 rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="all">All Tiers</option>
                <option value="P1">P1 - 4 Hours</option>
                <option value="P2">P2 - 8 Hours</option>
                <option value="P3">P3 - 24 Hours</option>
                <option value="P4">P4 - 48 Hours</option>
              </select>
            </div>
          </div>
        </div>

        {/* Datagrid list */}
        <div className="overflow-x-auto">
          {filteredTickets.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-[11px]">
              No support tickets found matching active criteria.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/60 leading-none">
                  <th className="py-2 px-2">ID</th>
                  <th className="py-2 px-2">Subject & Source</th>
                  <th className="py-2 px-2">Domain & SLA</th>
                  <th className="py-2 px-2">Risk Factor</th>
                  <th className="py-2 px-2">Remaining</th>
                  <th className="py-2 px-2">Engineer</th>
                  <th className="py-2 px-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px] font-medium text-slate-600">
                {filteredTickets.map(rt => {
                  const isSelected = selectedTicket?.ticket.id === rt.ticket.id;
                  return (
                    <tr
                      key={rt.ticket.id}
                      onClick={() => viewTicketDetails(rt)}
                      className={`hover:bg-slate-50/70 transition-colors cursor-pointer ${
                        isSelected ? 'bg-blue-50/40 border-l-2 border-l-[#2563eb]' : ''
                      }`}
                    >
                      {/* Ticket id */}
                      <td className="py-2 px-2 font-mono font-bold text-[#0f172a] whitespace-nowrap">
                        {rt.ticket.id}
                      </td>

                      {/* Content details */}
                      <td className="py-2 px-2 max-w-[200px]">
                        <span className="font-semibold text-[#0f172a] block truncate leading-tight">
                          {rt.ticket.subject}
                        </span>
                        <span className="text-[10px] text-slate-450 text-slate-400 truncate block mt-0.5 leading-none">
                          {rt.ticket.sender.split('<')[0].trim()} &bull; {rt.ticket.source.toUpperCase()}
                        </span>
                      </td>

                      {/* AI Domain and Priority */}
                      <td className="py-2 px-2">
                        <div className="flex items-center space-x-1.5 leading-none">
                          <span className="px-1 py-0.2 rounded-sm text-[8px] font-bold uppercase bg-slate-100 border border-slate-200 text-slate-600 scale-90">
                            {rt.analysis.category}
                          </span>
                          <span className={`px-1 py-0.2 rounded-sm text-[8px] font-extrabold tracking-wide scale-90 ${
                            rt.analysis.priority === 'P1' 
                              ? 'bg-red-50 text-[#dc2626] border border-red-100' 
                              : rt.analysis.priority === 'P2' 
                              ? 'bg-orange-50 text-orange-700 border border-orange-100' 
                              : 'bg-slate-50 border border-slate-100 text-slate-600'
                          }`}>
                            {rt.analysis.priority}
                          </span>
                        </div>
                      </td>

                      {/* Risk Score */}
                      <td className="py-2 px-2 whitespace-nowrap">
                        {getRiskBadge(rt.risk.risk_score)}
                      </td>

                      {/* SLA Timer */}
                      <td className="py-2 px-2 whitespace-nowrap">
                        {rt.ticket.status === 'resolved' || rt.ticket.status === 'closed' ? (
                          <span className="px-1.5 py-0.5 rounded-sm bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9.5px] font-bold flex items-center space-x-0.5 inline-flex leading-none">
                            <CheckCircle className="h-2.5 w-2.5" />
                            <span>Done</span>
                          </span>
                        ) : (
                          formatSlaRemaining(rt.sla.remaining_minutes)
                        )}
                      </td>

                      {/* Assigned to */}
                      <td className="py-2 px-2 font-medium">
                        {rt.assigned_user ? (
                          <div className="flex items-center space-x-1 whitespace-nowrap">
                            <img
                              src={rt.assigned_user.avatar}
                              alt={rt.assigned_user.name}
                              className="h-4.5 w-4.5 rounded-full border border-slate-200"
                            />
                            <span className="text-slate-800 text-[10.5px] truncate max-w-[65px]">
                              {rt.assigned_user.name.split(' ')[0]}
                            </span>
                          </div>
                        ) : (
                          <span className="text-red-500 font-extrabold text-[9px] uppercase tracking-wide flex items-center space-x-0.5">
                            <AlertTriangle className="h-2.5 w-2.5 animate-pulse" />
                            <span>Open</span>
                          </span>
                        )}
                      </td>

                      <td className="py-2 px-1">
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* RIGHT SIDE PANEL: DETAILED ACTION ACTION CONTAINER */}
      <div className="bg-white rounded-md border border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-4 self-start h-[calc(100vh-140px)] sticky top-[72px] overflow-y-auto">
        {selectedTicket ? (
          <div>
            {/* Header & Status Change controls */}
            <div className="border-b border-slate-100 pb-3 mb-3">
              <div className="flex justify-between items-center mb-1.5">
                <span className="font-mono text-[10px] font-extrabold text-[#2563eb] bg-[#eff6ff] border border-blue-150 px-1.5 py-0.5 rounded leading-none">
                  {selectedTicket.ticket.id}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide leading-none ${
                  selectedTicket.ticket.status === 'open' 
                    ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                    : selectedTicket.ticket.status === 'in_progress' 
                    ? 'bg-amber-50 text-amber-700 border border-amber-100' 
                    : selectedTicket.ticket.status === 'resolved' 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                    : 'bg-slate-50 text-slate-700 border border-slate-200'
                }`}>
                  {selectedTicket.ticket.status.toUpperCase().replace('_', ' ')}
                </span>
              </div>

              <h3 className="font-bold text-xs text-[#0f172a] leading-tight">
                {selectedTicket.ticket.subject}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1 block">
                From: {selectedTicket.ticket.sender} &bull; {new Date(selectedTicket.ticket.created_at).toLocaleDateString()} {new Date(selectedTicket.ticket.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </p>
            </div>

            {/* Core Ticket Content / Body */}
            <div className="mb-3 bg-slate-50/70 border border-slate-100 rounded p-2.5">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Issue Details</span>
              <p className="text-[11px] text-slate-650 leading-relaxed font-normal whitespace-pre-line max-h-32 overflow-y-auto pr-1">
                {selectedTicket.ticket.body}
              </p>
            </div>

            {/* AI Recommendation Panel */}
            <div className="mb-3 bg-blue-50/50 border border-blue-150 rounded p-3 relative overflow-hidden">
              <div className="flex items-center space-x-1 mb-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-[#2563eb]" />
                <span className="text-[9px] font-bold text-[#1e40af] uppercase tracking-wider">AI Resolution Runbook</span>
              </div>
              <p className="text-[11px] text-slate-700 leading-relaxed">
                {selectedTicket.analysis.recommendation}
              </p>
            </div>

            {/* Smart Assignment Overrides (Lead Check) */}
            <div className="border-t border-slate-100 pt-3 mb-4">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Assigned technician
              </label>
              {isLead ? (
                <div className="flex items-center space-x-2">
                  <select
                    value={selectedTicket.assignment.assigned_user_id || ''}
                    onChange={(e) => onReassign(selectedTicket.ticket.id, e.target.value || null)}
                    className="flex-1 bg-white border border-slate-250 hover:border-slate-350 rounded px-2 py-1 text-[11px] text-slate-700 focus:border-[#2563eb] focus:ring-0 outline-none cursor-pointer"
                  >
                    <option value="">Unassigned</option>
                    {activeTechnicians.map(u => (
                      <option key={u.id} value={u.id}>{u.name} (Active: {u.active_tickets_count || 0})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-100 rounded p-1.5 text-[11px] text-slate-600 font-bold">
                  <User2 className="h-3.5 w-3.5 text-slate-400" />
                  <span>{selectedTicket.assigned_user ? selectedTicket.assigned_user.name : 'Unassigned'}</span>
                </div>
              )}
            </div>

            {/* Lifecycle Work Status transitions */}
            <div className="border-t border-slate-100 pt-3 mb-4">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Work status transition
              </span>

              <div className="flex flex-wrap gap-1.5">
                {selectedTicket.ticket.status === 'open' && (
                  <button
                    onClick={() => onUpdateStatus(selectedTicket.ticket.id, 'in_progress')}
                    className="w-full bg-[#2563eb] hover:bg-blue-700 text-white font-bold text-[11px] p-2 leading-none rounded cursor-pointer text-center shadow-2xs"
                  >
                    Start Investigation
                  </button>
                )}

                {selectedTicket.ticket.status === 'in_progress' && (
                  <button
                    onClick={() => onUpdateStatus(selectedTicket.ticket.id, 'resolved')}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] p-2 leading-none rounded cursor-pointer text-center shadow-2xs"
                  >
                    Mark as Resolved
                  </button>
                )}

                {selectedTicket.ticket.status === 'resolved' && isLead && (
                  <button
                    onClick={() => onUpdateStatus(selectedTicket.ticket.id, 'closed')}
                    className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold text-[11px] p-2 leading-none rounded cursor-pointer text-center shadow-2xs"
                  >
                    Confirm & Close Ticket
                  </button>
                )}

                {selectedTicket.ticket.status === 'resolved' && !isLead && (
                  <div className="text-center w-full text-slate-400 text-[10.5px] italic bg-slate-55 bg-slate-50 p-1.5 rounded border border-slate-150 font-medium">
                    Awaiting Lead validation to Close.
                  </div>
                )}

                {selectedTicket.ticket.status === 'closed' && (
                  <div className="text-center w-full text-emerald-600 font-bold text-[11px] py-1.5 bg-emerald-50 rounded border border-emerald-100 flex items-center justify-center space-x-1 leading-none">
                    <CheckCircle className="h-3 w-3" />
                    <span>Closed & Archived</span>
                  </div>
                )}
              </div>
            </div>

            {/* Individual Ticket Log / Audit Trail */}
            <div className="border-t border-slate-100 pt-3">
              <div className="flex items-center space-x-1 mb-2">
                <History className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">History audit trail</span>
              </div>

              {loadingLogs ? (
                <div className="text-center text-slate-400 py-2 text-[10px] font-mono">Loading...</div>
              ) : (
                <div className="relative border-l border-slate-200 ml-1 pl-3 space-y-2.5 max-h-48 overflow-y-auto">
                  {auditLogs.map(log => (
                    <div key={log.id} className="relative text-[10px] leading-tight">
                      <div className="absolute -left-[16px] mt-0.5 h-1.5 w-1.5 rounded-full bg-slate-300 border border-white"></div>
                      <div className="flex justify-between font-bold text-slate-750 text-slate-700">
                        <span className="font-extrabold">{log.action}</span>
                        <span className="text-slate-400 font-normal">
                          {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-slate-500">{log.description}</p>
                      <span className="text-slate-400 block text-[9px] mt-0.2">By: {log.user_name}</span>
                    </div>
                  ))}
                  {auditLogs.length === 0 && (
                    <div className="text-slate-400 text-[10.5px] italic pl-0.5">No audit entries yet.</div>
                  )}
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center py-16 text-center text-slate-400">
            <MessageSquare className="h-8 w-8 text-slate-250 mb-2.5 text-slate-300" />
            <span className="text-xs font-bold text-slate-750">Select a Ticket from the Pool</span>
            <p className="text-[10px] text-slate-450 text-slate-400 mt-1 max-w-[190px] mx-auto font-normal leading-normal">
              Click any element on the grid to inspect AI details, action recomendations and histories.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
