import React from 'react';
import { User, RichTicket, Notification } from './types.js';
import Header from './components/Header.js';
import DashboardStats from './components/DashboardStats.js';
import AISummaryCard from './components/AISummaryCard.js';
import TicketList from './components/TicketList.js';
import UserManagement from './components/UserManagement.js';
import ManualIngestion from './components/ManualIngestion.js';
import EmailPollingSettings from './components/EmailPollingSettings.js';
import { 
  Shield, 
  Inbox, 
  RefreshCw, 
  UserPlus, 
  LayoutDashboard, 
  History, 
  Settings,
  HelpCircle,
  FileSpreadsheet
} from 'lucide-react';

export default function App() {
  const [users, setUsers] = React.useState<User[]>([]);
  const [tickets, setTickets] = React.useState<RichTicket[]>([]);
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [auditLogs, setAuditLogs] = React.useState<any[]>([]);
  
  const [currentUser, setCurrentUser] = React.useState<User | null>(null);
  const [activeTab, setActiveTab] = React.useState<'tickets' | 'ingestion' | 'users' | 'audit_logs'>('tickets');
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [globalError, setGlobalError] = React.useState<string | null>(null);

  const isFetchingRef = React.useRef(false);

  const fetchAllData = React.useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      // 1. Fetch Users
      const usersRes = await fetch('/api/users');
      if (!usersRes.ok) throw new Error('Could not synchronize technician records.');
      const usersData: User[] = await usersRes.json();
      setUsers(usersData);

      // Set default user if not already set, or refresh the current user to maintain latest stats
      if (usersData.length > 0) {
        setCurrentUser(prevUser => {
          if (!prevUser) {
            // Sarah is the default Team Lead
            return usersData.find(u => u.role === 'lead') || usersData[0];
          }
          const refreshed = usersData.find(u => u.id === prevUser.id);
          if (refreshed) {
            // Check if key stats or info changed to avoid unnecessary re-renders of identical data
            if (
              refreshed.status !== prevUser.status ||
              refreshed.name !== prevUser.name ||
              refreshed.role !== prevUser.role ||
              refreshed.active_tickets_count !== prevUser.active_tickets_count
            ) {
              return refreshed;
            }
          }
          return prevUser;
        });
      }

      // 2. Fetch Rich Tickets
      const ticketsRes = await fetch('/api/tickets');
      if (!ticketsRes.ok) throw new Error('Could not synchronize global ticket pools.');
      const ticketsData: RichTicket[] = await ticketsRes.json();
      setTickets(ticketsData);

      // 3. Fetch Notifications logs
      const alertsRes = await fetch('/api/notifications');
      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setNotifications(alertsData);
      }

      // 4. Fetch Audit Logs
      const logsRes = await fetch('/api/audit-logs');
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setAuditLogs(logsData);
      }

      setGlobalError(null);
    } catch (err: any) {
      console.error(err);
      const isConnectionErr = err.message === 'Failed to fetch' || err.name === 'TypeError' || String(err).includes('Failed to fetch');
      if (isConnectionErr) {
        setGlobalError('Connecting to enterprise control plane...');
      } else {
        setGlobalError(err.message || 'Error communicating with fullstack service.');
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  // Initial Load & Lifecycle Poller (every 12 seconds updates SLA metrics & alarms, with fast reconnect)
  React.useEffect(() => {
    fetchAllData();
    
    const interval = setInterval(() => {
      fetchAllData();
    }, 12000);

    let retryTimeout: any = null;
    if (globalError === 'Connecting to enterprise control plane...') {
      retryTimeout = setTimeout(() => {
        fetchAllData();
      }, 3000);
    }

    return () => {
      clearInterval(interval);
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [fetchAllData, globalError]);

  // Trigger Inbox Sync (Simulated Gmail/Outlook inbox hook poller)
  const handleTriggerInboxSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/polling/trigger', { method: 'POST' });
      if (!res.ok) throw new Error('Simulated Poller gateway timed out.');
      await fetchAllData();
    } catch (err: any) {
      alert(`Sync Failure: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Switch Active Session
  const handleSwitchUser = (userId: string) => {
    const selected = users.find(u => u.id === userId);
    if (selected) {
      setCurrentUser(selected);
    }
  };

  // Update Ticket Status (RBAC checking in client and server)
  const handleUpdateTicketStatus = async (ticketId: string, status: string) => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/tickets/${ticketId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          user_id: currentUser.id,
          user_name: currentUser.name
        })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Could not upgrade status.');
      }
      await fetchAllData();
    } catch (err: any) {
      alert(`Constraint block: ${err.message}`);
    }
  };

  // Reassign Ticket (restricted Lead override checks)
  const handleReassignTicket = async (ticketId: string, targetUserId: string | null) => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/tickets/${ticketId}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_assigned_user_id: targetUserId,
          assigner_id: currentUser.id,
          assigner_name: currentUser.name
        })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Authorized re-routing failed.');
      }
      await fetchAllData();
    } catch (err: any) {
      alert(`Compliance Constraint block: ${err.message}`);
    }
  };

  // Create Manual Ticket Ingestion
  const handleIngestManual = async (payload: { subject: string; body: string; sender: string; source: string }) => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Support portal submission error.');
      await fetchAllData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // Bulk Ingest CSV Simulation
  const handleBulkIngestCsv = async (list: Array<{ subject: string; body: string; sender: string }>) => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/tickets/bulk-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ list })
      });
      if (!res.ok) throw new Error('CSV bulk ingestion upload pipeline broken.');
      await fetchAllData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // Onboard New Technician (RBAC)
  const handleAddUser = async (newUser: { name: string; email: string; role: 'lead' | 'member'; skills: string[]; avatar?: string }) => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newUser, creator_id: currentUser.id })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Onboarding error.');
      }
      await fetchAllData();
    } catch (err: any) {
      alert(`Constraint failure: ${err.message}`);
    }
  };

  // Update Technician Avatar Profile Image
  const handleUpdateUserAvatar = async (userId: string, avatarUrl: string) => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/users/${userId}/avatar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: avatarUrl, actor_id: currentUser.id })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Avatar update error.');
      }
      await fetchAllData();
    } catch (err: any) {
      alert(`Constraint failure: ${err.message}`);
    }
  };

  // Toggle Technician Workforce status (enable/disable)
  const handleToggleUserStatus = async (userId: string, newStatus: 'active' | 'inactive') => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/users/${userId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, actor_id: currentUser.id })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Staff status update error.');
      }
      await fetchAllData();
    } catch (err: any) {
      alert(`Security override: ${err.message}`);
    }
  };

  // Clear in-app notification dropdown records
  const handleClearNotifications = () => {
    setNotifications([]);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <span className="text-xs font-semibold text-slate-500 font-mono">Initializing Enterprise Control Plane...</span>
        </div>
      </div>
    );
  }

  const activeTabClass = "border-b-2 border-blue-600 text-blue-600 px-4 py-3 text-xs font-bold flex items-center space-x-1.5 cursor-pointer";
  const idleTabClass = "text-slate-500 hover:text-slate-800 px-4 py-3 text-xs font-medium flex items-center space-x-1.5 cursor-pointer";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Platform Header */}
      <Header
        currentUser={currentUser}
        users={users}
        onSwitchUser={handleSwitchUser}
        onTriggerSync={handleTriggerInboxSync}
        isSyncing={isSyncing}
        notifications={notifications}
        onClearNotifications={handleClearNotifications}
      />

      {/* Main Workspace Frame */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Global Connection / DB alerts banner */}
        {globalError && (
          <div className={`mb-4 p-3 px-4 rounded-md border text-xs font-semibold flex items-center justify-between transition-all duration-300 ${
            globalError.includes('Connecting') 
              ? 'bg-amber-50/70 border-amber-200 text-amber-700 animate-pulse' 
              : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            <div className="flex items-center space-x-2">
              {globalError.includes('Connecting') ? (
                <div className="flex space-x-1 items-center">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />
                  <span className="text-[10px] uppercase font-bold tracking-wider text-amber-600 font-mono">Reconnecting</span>
                </div>
              ) : (
                <span className="text-red-600 font-bold">🛡️ Warning: Offline fallback mode:</span>
              )}
              <span className="text-slate-700 font-medium">{globalError}</span>
            </div>
          </div>
        )}

        {/* Dashboard Counter Statistics */}
        <DashboardStats tickets={tickets} currentUser={currentUser} />

        {/* Gemini Executive Insights or coaching brief */}
        <AISummaryCard currentUser={currentUser} onRefreshAll={fetchAllData} />

        {/* Workspace Central Nav Tabs */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs mb-6 overflow-hidden">
          <div className="border-b border-slate-150 bg-slate-50/50 px-4 flex items-center justify-between">
            <nav className="flex space-x-4">
              <button
                onClick={() => setActiveTab('tickets')}
                className={activeTab === 'tickets' ? activeTabClass : idleTabClass}
              >
                <Inbox className="h-4 w-4" />
                <span>Incident Command Center</span>
              </button>
              <button
                onClick={() => setActiveTab('ingestion')}
                className={activeTab === 'ingestion' ? activeTabClass : idleTabClass}
              >
                <RefreshCw className="h-4 w-4" />
                <span>Ingestion & Simulators</span>
              </button>
              {currentUser.role === 'lead' && (
                <button
                  onClick={() => setActiveTab('users')}
                  className={activeTab === 'users' ? activeTabClass : idleTabClass}
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Workforce directory</span>
                </button>
              )}
              <button
                onClick={() => setActiveTab('audit_logs')}
                className={activeTab === 'audit_logs' ? activeTabClass : idleTabClass}
              >
                <History className="h-4 w-4" />
                <span>Enterprise Audit Logs</span>
              </button>
            </nav>

            <span className="text-[10px] font-bold text-slate-400 uppercase hidden sm:inline">
              Secure Station &bull; Active: {currentUser.name}
            </span>
          </div>

          {/* Module routing pane */}
          <div className="p-6">
            {activeTab === 'tickets' && (
              <TicketList
                tickets={tickets}
                users={users}
                currentUser={currentUser}
                onUpdateStatus={handleUpdateTicketStatus}
                onReassign={handleReassignTicket}
                onTriggerCheck={fetchAllData}
              />
            )}

            {activeTab === 'ingestion' && (
              <>
                <ManualIngestion
                  onIngestManual={handleIngestManual}
                  onBulkIngestCsv={handleBulkIngestCsv}
                  isSyncing={isSyncing}
                />
                <EmailPollingSettings
                  onRefreshAll={fetchAllData}
                  isSyncing={isSyncing}
                  onTriggerSync={handleTriggerInboxSync}
                />
              </>
            )}

            {activeTab === 'users' && (
              <UserManagement
                users={users}
                currentUser={currentUser}
                onAddUser={handleAddUser}
                onToggleStatus={handleToggleUserStatus}
                onUpdateAvatar={handleUpdateUserAvatar}
              />
            )}

            {activeTab === 'audit_logs' && (
              <div className="bg-white rounded-lg border border-slate-200">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                    <History className="h-4 w-4 text-slate-500" />
                    <span>Global Platform Security Audit Trails</span>
                  </span>
                  <span className="text-[10px] text-slate-400 underline font-semibold">Immutable Records Ledger</span>
                </div>
                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-slate-50/20">
                        <th className="py-2.5 px-4 font-bold">Audit ID</th>
                        <th className="py-2.5 px-4 font-bold">UTC Timestamp</th>
                        <th className="py-2.5 px-4 font-bold">Associated SLA Item</th>
                        <th className="py-2.5 px-4 font-bold">Action Conducted</th>
                        <th className="py-2.5 px-4 font-bold">Authorized Executor</th>
                        <th className="py-2.5 px-4 font-bold">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px] font-mono text-slate-650">
                      {auditLogs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-4 font-bold text-blue-600">{log.id}</td>
                          <td className="py-2.5 px-4 text-slate-500">{new Date(log.created_at).toISOString().replace('T', ' ').substring(0, 19)}</td>
                          <td className="py-2.5 px-4 font-bold text-slate-900">{log.ticket_id || 'SYSTEM'}</td>
                          <td className="py-2.5 px-4">
                            <span className={`px-1.5 py-0.5 rounded-[3px] text-[8.5px] font-black tracking-wider uppercase ${
                              log.action.includes('ASSIGN') 
                                ? 'bg-indigo-50 text-indigo-750 border border-indigo-200' 
                                : log.action.includes('BREACH') || log.action.includes('WARN')
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : log.action.includes('STATUS')
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-bold text-slate-800">{log.user_name}</td>
                          <td className="py-2.5 px-4 text-slate-650 font-sans leading-relaxed">{log.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modern Compact SaaS Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
          <span>AI-Powered Ticket Intelligence & SLA Platform &bull; SaaS Enterprise V1.0</span>
          <span className="mt-2 sm:mt-0">All systems compliant &bull; UTC System Clock: {new Date().toISOString().substring(11, 16)}</span>
        </div>
      </footer>
    </div>
  );
}
