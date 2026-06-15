import React from 'react';
import { User, Notification } from '../types.js';
import { Shield, Users, RefreshCw, Mail, Bell, CheckCircle2 } from 'lucide-react';

interface HeaderProps {
  currentUser: User;
  users: User[];
  onSwitchUser: (userId: string) => void;
  onTriggerSync: () => void;
  isSyncing: boolean;
  notifications: Notification[];
  onClearNotifications: () => void;
}

export default function Header({
  currentUser,
  users,
  onSwitchUser,
  onTriggerSync,
  isSyncing,
  notifications,
  onClearNotifications
}: HeaderProps) {
  const [showNotifDropdown, setShowNotifDropdown] = React.useState(false);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 h-14 flex items-center">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-full">
          {/* Platform Identity */}
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 bg-[#2563eb] rounded flex items-center justify-center font-bold text-sm text-white shadow-xs">
              TI
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h1 className="text-sm font-bold text-[#0f172a] tracking-tight">TicketIntel AI</h1>
                <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider scale-90">
                  Engine
                </span>
              </div>
              <span className="text-[10px] font-medium text-slate-500 block leading-none mt-0.5">
                SLA Compliance Suite
              </span>
            </div>
          </div>

          {/* Core Navigation Tools & Simulators */}
          <div className="flex items-center space-x-3">
            
            {/* Simulation polling button */}
            <button
              onClick={onTriggerSync}
              disabled={isSyncing}
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded border transition-colors ${
                isSyncing 
                  ? 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed' 
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:text-slate-900 shadow-xs'
              }`}
              title="Simulates automated poll of Gmail/Outlook inboxes instantly"
            >
              <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin text-[#2563eb]' : 'text-slate-500'}`} />
              <span>{isSyncing ? 'Polling...' : 'Poll Mailboxes'}</span>
            </button>

            {/* In-app / Discord Notifications bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                className="p-1.5 hover:bg-slate-100 rounded border border-slate-100 transition-colors relative"
              >
                <Bell className="h-3.5 w-3.5 text-slate-600" />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse"></span>
                )}
              </button>

              {/* Notification dropdown panel */}
              {showNotifDropdown && (
                <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded shadow-lg py-1 z-50 text-xs">
                  <div className="px-3 py-1.5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <span className="font-bold text-[11px] text-slate-700">Alert Center</span>
                    {notifications.length > 0 && (
                      <button 
                        onClick={onClearNotifications} 
                        className="text-[10px] text-[#2563eb] hover:underline font-bold"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-3 py-6 text-center text-slate-450 text-[11px]">
                        No warnings or critical alerts active.
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} className="px-3 py-2 border-b border-slate-100 last:border-b-0 text-[10.5px] hover:bg-slate-50">
                          <div className="flex justify-between items-start mb-0.5">
                            <span className={`px-1 rounded-[3px] text-[8px] font-bold uppercase tracking-wide leading-normal ${
                              n.type.includes('critical') 
                                ? 'bg-red-50 text-red-700 border border-red-200' 
                                : n.type.includes('near') 
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}>
                              {n.type.replace('_', ' ')}
                            </span>
                            <span className="text-[9px] text-slate-400">
                              {new Date(n.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-slate-600 leading-snug mt-0.5">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Role Manager Selector (Allows auditors to switch and audit RBAC) */}
            <div className="flex items-center space-x-2 border-l border-slate-200 pl-3">
              <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
                <div className="w-5 h-5 bg-slate-200 border border-slate-300 rounded-full flex items-center justify-center font-bold text-[10px] text-slate-600 overflow-hidden">
                  {currentUser.avatar ? (
                    <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
                  ) : (
                    currentUser.name.split(' ').map(n => n[0]).join('')
                  )}
                </div>
                <div className="text-left hidden sm:block leading-none">
                  <select
                    value={currentUser.id}
                    onChange={(e) => onSwitchUser(e.target.value)}
                    className="bg-transparent text-[11px] font-bold text-slate-700 focus:outline-none pr-1 cursor-pointer"
                  >
                    {users.map(u => (
                      <option key={u.id} value={u.id} disabled={u.status === 'inactive'}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="font-bold text-[8px] background-[#e2e8f0] bg-slate-200 px-1 py-0.5 rounded uppercase tracking-wider text-slate-600 scale-90">
                  {currentUser.role}
                </span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </header>
  );
}
