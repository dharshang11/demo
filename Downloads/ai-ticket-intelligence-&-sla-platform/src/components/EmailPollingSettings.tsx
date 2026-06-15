import React from 'react';
import { Mail, Settings, Key, Server, CheckCircle2, AlertTriangle, Trash2, Plus, RefreshCw, Info, Lock, LogOut } from 'lucide-react';
import { EmailConfig } from '../types.js';
import { initAuth, googleSignIn, logout, fetchGmailRecentMessages, sendGmailTicketEmail, type GmailEmail } from '../lib/gmailAuth.js';
import { type User as FirebaseUser } from 'firebase/auth';

interface EmailPollingSettingsProps {
  onRefreshAll: () => Promise<void>;
  isSyncing: boolean;
  onTriggerSync: () => Promise<void>;
}

export default function EmailPollingSettings({
  onRefreshAll,
  isSyncing,
  onTriggerSync
}: EmailPollingSettingsProps) {
  // Tabs and general configs
  const [activeTab, setActiveTab] = React.useState<'oauth' | 'imap'>('oauth');
  const [configs, setConfigs] = React.useState<EmailConfig[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState('');
  const [successMsg, setSuccessMsg] = React.useState('');

  // OAuth Google State
  const [googleUser, setGoogleUser] = React.useState<FirebaseUser | null>(null);
  const [accessToken, setAccessToken] = React.useState<string | null>(null);
  const [oauthSyncing, setOauthSyncing] = React.useState(false);
  const [syncLogs, setSyncLogs] = React.useState<string[]>([]);
  const [numNewTickets, setNumNewTickets] = React.useState<number | null>(null);

  // Test Email State for Gmail
  const [testRecipient, setTestRecipient] = React.useState('');
  const [testSubject, setTestSubject] = React.useState('URGENT: Database replication failure on node-xyz');
  const [testBody, setTestBody] = React.useState(`The automated replication lock on node-xyz has thrown a critical write error: 'LOCK_ACQUISITION_TIMEOUT'. Transaction streams are falling behind SLA boundaries. Please verify secondary logs ASAP.`);
  const [isSendingTest, setIsSendingTest] = React.useState(false);
  const [testStatus, setTestStatus] = React.useState<'idle' | 'success' | 'error'>('idle');
  const [testError, setTestError] = React.useState('');

  React.useEffect(() => {
    if (googleUser?.email && !testRecipient) {
      setTestRecipient(googleUser.email);
    }
  }, [googleUser, testRecipient]);

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) {
      setErrorMsg('Unauthorized. Please connect your Gmail account.');
      return;
    }
    if (!testRecipient || !testSubject || !testBody) {
      setTestError('Please fill in recipient, subject, and body fields.');
      setTestStatus('error');
      return;
    }

    setIsSendingTest(true);
    setTestStatus('idle');
    setTestError('');

    try {
      setSyncLogs(prev => [...prev, `Preparing test ticket email to ${testRecipient}...`]);
      await sendGmailTicketEmail(accessToken, testRecipient, testSubject, testBody);
      setTestStatus('success');
      setSyncLogs(prev => [
        ...prev,
        `🚀 Sent test ticket email to ${testRecipient} successfully! Check your inbox or search for "${testSubject}".`
      ]);
      setSuccessMsg(`Test ticket email successfully sent to ${testRecipient}!`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error(err);
      setTestStatus('error');
      setTestError(err.message || 'Error occurred while sending the email.');
      setSyncLogs(prev => [...prev, `❌ Error sending test email: ${err.message || 'API rejected transfer'}`]);
    } finally {
      setIsSendingTest(false);
    }
  };

  // Form State for IMAP
  const [editingId, setEditingId] = React.useState<string | undefined>(undefined);
  const [imapHost, setImapHost] = React.useState('');
  const [imapPort, setImapPort] = React.useState('993');
  const [imapUser, setImapUser] = React.useState('');
  const [imapPass, setImapPass] = React.useState('');
  const [useSsl, setUseSsl] = React.useState(true);
  const [isActive, setIsActive] = React.useState(true);

  // Load configs
  const loadConfigs = async () => {
    try {
      setErrorMsg('');
      const res = await fetch('/api/email-configs');
      if (res.ok) {
        const data = await res.json();
        setConfigs(data);
      } else {
        throw new Error('Failed to retrieve email settings.');
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Initialize OAuth Listener on load
  React.useEffect(() => {
    loadConfigs();

    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setAccessToken(token);
      },
      () => {
        setGoogleUser(null);
        setAccessToken(null);
      }
    );

    return () => unsubscribe();
  }, []);

  // Google OAuth sign-in trigger
  const handleGoogleLogin = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setAccessToken(result.accessToken);
        setSuccessMsg(`Securely linked Gmail account: ${result.user.email}`);
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Permission or Google Authentication was refused.');
    }
  };

  // Google OAuth sign-out
  const handleGoogleLogout = async () => {
    try {
      await logout();
      setGoogleUser(null);
      setAccessToken(null);
      setSyncLogs([]);
      setNumNewTickets(null);
      setSuccessMsg('Google Account unlinked.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Sync Live Gmail via secure REST endpoints
  const handleSyncGmail = async () => {
    if (!accessToken) {
      setErrorMsg('Not authenticated with Google. Please log in first.');
      return;
    }

    setOauthSyncing(true);
    setErrorMsg('');
    setSuccessMsg('');
    setSyncLogs(['Initiating OAuth Handshake...', 'Authorized with Google Gmail Scopes...']);
    setNumNewTickets(null);

    try {
      // 1. Fetch from Google REST endpoint
      setSyncLogs(prev => [...prev, 'Scanning inbox for incoming support incidents...']);
      const emails: GmailEmail[] = await fetchGmailRecentMessages(accessToken, 8);
      
      setSyncLogs(prev => [...prev, `Found ${emails.length} recent inbox messages.`]);

      if (emails.length === 0) {
        setSyncLogs(prev => [...prev, 'No messages returned. Inbox is current.']);
        setOauthSyncing(false);
        return;
      }

      // 2. Back-end ingestion for fetched message
      let newCount = 0;
      setSyncLogs(prev => [...prev, 'Comparing logs for duplicate check...']);
      
      for (const email of emails) {
        setSyncLogs(prev => [...prev, `Relaying message: "${email.subject.substring(0, 30)}..."`]);
        try {
          const res = await fetch('/api/tickets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subject: email.subject,
              body: email.body,
              sender: email.sender,
              source: 'gmail'
            })
          });

          if (res.ok) {
            newCount++;
          }
        } catch (postErr) {
          console.error('[Gmail Ingestion] Error importing individual thread:', postErr);
        }
      }

      // 3. Complete sync
      setNumNewTickets(newCount);
      setSyncLogs(prev => [
        ...prev, 
        'SLA indices synchronized.', 
        'Smart Tech auto-routing complete.', 
        '✨ Inbound mailbox synchronization completed!'
      ]);

      setSuccessMsg('Inbox synchronization successful.');
      await onRefreshAll();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Workspace Ingestion Failed: ${err.message || err}`);
      setSyncLogs(prev => [...prev, `⚠️ Sync interrupted: ${err.message || 'Network Timeout'}`]);
    } finally {
      setOauthSyncing(false);
    }
  };

  // Preset selectors for IMAP form
  const applyPreset = (type: 'gmail' | 'outlook') => {
    if (type === 'gmail') {
      setImapHost('imap.gmail.com');
      setImapPort('993');
      setUseSsl(true);
    } else if (type === 'outlook') {
      setImapHost('outlook.office365.com');
      setImapPort('993');
      setUseSsl(true);
    }
  };

  // Handle Save for IMAP config
  const handleSaveImap = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!imapHost || !imapPort || !imapUser || !imapPass) {
      setErrorMsg('All connection details are required.');
      return;
    }

    try {
      const res = await fetch('/api/email-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          imap_host: imapHost,
          imap_port: Number(imapPort),
          imap_user: imapUser,
          imap_pass: imapPass,
          use_ssl: useSsl,
          is_active: isActive
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error saving credentials.');

      setSuccessMsg(data.message);
      resetForm();
      await loadConfigs();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Handle Delete for IMAP config
  const handleDeleteImap = async (id: string) => {
    if (!window.confirm('Delete this active email synchronizer config?')) return;
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch(`/api/email-configs/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error deleting config.');

      setSuccessMsg('Configuration removed successfully.');
      await loadConfigs();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleEditImap = (c: EmailConfig) => {
    setEditingId(c.id);
    setImapHost(c.imap_host);
    setImapPort(String(c.imap_port));
    setImapUser(c.imap_user);
    setImapPass('••••••••');
    setUseSsl(c.use_ssl);
    setIsActive(c.is_active);
  };

  const resetForm = () => {
    setEditingId(undefined);
    setImapHost('');
    setImapPort('993');
    setImapUser('');
    setImapPass('');
    setUseSsl(true);
    setIsActive(true);
  };

  return (
    <div className="bg-white rounded-md border border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-4 mt-4">
      
      {/* Title & Hub Header */}
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
        <div className="flex items-center space-x-2">
          <Mail className="h-4.5 w-4.5 text-slate-700" />
          <h2 className="text-xs font-bold text-[#0f172a] tracking-tight">Active Ingestion Gateways (Gmail/Outlook Sync)</h2>
        </div>
        
        {/* Sync Controls */}
        <div className="flex items-center space-x-2">
          {activeTab === 'imap' && (
            <button
              type="button"
              onClick={onTriggerSync}
              disabled={isSyncing}
              className="px-2.5 py-1 text-[11px] font-bold bg-[#2563eb] hover:bg-blue-700 disabled:bg-blue-300 text-white rounded flex items-center space-x-1 cursor-pointer transition-all"
            >
              <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Scanning Inboxes...' : 'Run IMAP Scanner Now'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Gateway Connection Tabs */}
      <div className="flex space-x-2 mb-4 border-b border-slate-100 pb-2">
        <button
          type="button"
          onClick={() => {
            setActiveTab('oauth');
            setErrorMsg('');
          }}
          className={`px-3 py-1 text-xs font-bold rounded cursor-pointer transition-colors ${
            activeTab === 'oauth'
              ? 'bg-slate-100 text-slate-800 border-slate-250 border'
              : 'text-slate-500 hover:text-slate-850 hover:bg-slate-50'
          }`}
        >
          <span>Google Workspace OAuth (Recommended)</span>
          {googleUser && (
            <span className="ml-1.5 px-1.5 py-0.5 text-[9px] font-extrabold bg-emerald-100 text-emerald-800 rounded">
              Linked
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('imap');
            setErrorMsg('');
          }}
          className={`px-3 py-1 text-xs font-bold rounded cursor-pointer transition-colors ${
            activeTab === 'imap'
              ? 'bg-slate-100 text-slate-800 border-slate-250 border'
              : 'text-slate-500 hover:text-slate-850 hover:bg-slate-50'
          }`}
        >
          <span>Custom IMAP Protocol (Manual Setup)</span>
          {configs.filter(c => c.is_active).length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 text-[9px] font-extrabold bg-blue-100 text-blue-800 rounded">
              {configs.filter(c => c.is_active).length} Configured
            </span>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Area: Tab specific views */}
        <div className="lg:col-span-8">
          
          {/* TAB 1: GOOGLE WORKSPACE OAUTH */}
          {activeTab === 'oauth' && (
            <div className="space-y-4">
              
              <div className="bg-slate-50 border border-slate-150 rounded p-3 text-[11px] text-slate-600 leading-relaxed font-sans">
                <span className="font-extrabold text-[#1e293b] uppercase tracking-wide text-[9px] block mb-1">
                  Secure API-Based Scanning
                </span>
                Link your Gmail inbox directly via secure Google authentication. There is no need to expose passwords or App Secrets. The portal will scan your incoming emails, analyze content instantly using Google Gemini, and route issues to active technicians.
              </div>

              {!googleUser ? (
                /* Prompt login */
                <div className="border border-dashed border-slate-250 rounded-lg p-6 bg-slate-50/50 flex flex-col items-center justify-center text-center">
                  <div className="bg-slate-100 p-2.5 rounded-full mb-3">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <h3 className="text-xs font-bold text-[#0f172a] mb-1">Connect Your Gmail Inbox</h3>
                  <p className="text-[11px] text-slate-550 max-w-sm mb-4">
                    Authorized on-demand synchronization. Only retrieves email headers and bodies to populate incident records on click.
                  </p>
                  
                  {/* Styled GSI Button */}
                  <button
                    onClick={handleGoogleLogin}
                    className="relative cursor-pointer select-none items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 active:bg-slate-100 transition-all duration-155 flex space-x-2"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    <span>Sign in with Google</span>
                  </button>
                </div>
              ) : (
                /* Authenticated Control Center */
                <div className="bg-slate-50/50 border border-slate-200 rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {googleUser.photoURL ? (
                        <img
                          src={googleUser.photoURL}
                          alt="Avatar"
                          referrerPolicy="no-referrer"
                          className="h-10 w-10 rounded-full border border-slate-200"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs">
                          {googleUser.displayName?.charAt(0) || 'G'}
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-bold text-slate-800">{googleUser.displayName || 'Authorized Member'}</div>
                        <div className="text-xs text-slate-500 font-normal">{googleUser.email}</div>
                      </div>
                    </div>
                    <button
                      onClick={handleGoogleLogout}
                      className="px-2 py-1 border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded text-xs flex items-center space-x-1 cursor-pointer transition-colors"
                      title="Disconnect account"
                    >
                      <LogOut className="h-3 w-3" />
                      <span>Disconnect</span>
                    </button>
                  </div>

                  {/* Sync Trigger Grid */}
                  <div className="pt-2 border-t border-slate-150">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">On-demand secure scan</span>
                        <p className="text-[11px] text-slate-550">Press to connect directly to the Gmail REST API and pull latest threads.</p>
                      </div>
                      <button
                        onClick={handleSyncGmail}
                        disabled={oauthSyncing}
                        className="px-4 py-2 bg-[#2563eb] hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold text-xs rounded shadow-2xs flex items-center space-x-1.5 transition-all self-start sm:self-center cursor-pointer"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${oauthSyncing ? 'animate-spin' : ''}`} />
                        <span>{oauthSyncing ? 'Synchronizing Custom Inbox...' : 'Scan & Ingest My Mailbox Now'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Real-time Log console output */}
                  {syncLogs.length > 0 && (
                    <div className="bg-[#0f172a] text-sky-400 font-mono text-[10px] rounded p-3 space-y-1 max-h-[160px] overflow-y-auto">
                      <div className="text-slate-400 text-[9px] uppercase font-bold border-b border-slate-800 pb-1 mb-1.5 flex justify-between">
                        <span>Connection Log Console</span>
                        {oauthSyncing && <span className="animate-pulse">Active Syncing...</span>}
                      </div>
                      {syncLogs.map((log, idx) => (
                        <div key={idx} className="leading-tight">
                          <span className="text-slate-500 mr-1.5 font-bold">[{idx + 1}]</span>
                          {log}
                        </div>
                      ))}
                      {numNewTickets !== null && (
                        <div className="mt-2 text-emerald-400 font-semibold border-t border-slate-800 pt-2 text-xs flex items-center space-x-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Sync Success! Added {numNewTickets} new ticket(s) from your Gmail address.</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Send Test Email Panel */}
                  <div className="pt-4 border-t border-slate-150">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">
                      Send Test Ticket Email
                    </span>
                    <form onSubmit={handleSendTestEmail} className="space-y-3 mt-2 bg-white border border-slate-200 p-3 rounded-md">
                      <div>
                        <label className="text-[9px] font-bold text-[#64748b] uppercase tracking-wide block mb-1">Recipient Address</label>
                        <input
                          type="email"
                          value={testRecipient}
                          onChange={(e) => setTestRecipient(e.target.value)}
                          placeholder="your.email@domain.com"
                          className="w-full px-2.5 py-1 text-xs border border-slate-250 hover:border-slate-350 focus:border-[#2563eb] focus:ring-0 outline-none rounded bg-slate-50/20"
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-2.5">
                        <div>
                          <label className="text-[9px] font-bold text-[#64748b] uppercase tracking-wide block mb-1">Subject</label>
                          <input
                            type="text"
                            value={testSubject}
                            onChange={(e) => setTestSubject(e.target.value)}
                            placeholder="e.g. URGENT: Database replication failure"
                            className="w-full px-2.5 py-1 text-xs border border-slate-250 hover:border-slate-350 focus:border-[#2563eb] focus:ring-0 outline-none rounded bg-slate-50/20"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-[#64748b] uppercase tracking-wide block mb-1">Message Body</label>
                          <textarea
                            value={testBody}
                            onChange={(e) => setTestBody(e.target.value)}
                            rows={3}
                            placeholder="Describe the incident..."
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-250 hover:border-slate-350 focus:border-[#2563eb] focus:ring-0 outline-none rounded bg-slate-50/20 resize-y"
                          />
                        </div>
                      </div>

                      {testError && (
                        <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded border border-red-150 flex items-center space-x-2">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                          <span>{testError}</span>
                        </div>
                      )}

                      {testStatus === 'success' && (
                        <div className="p-2.5 bg-emerald-50 text-emerald-700 text-xs rounded border border-emerald-150 flex items-center space-x-2">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                          <span>Test Email Sent Successfully! Scan your inbox shortly using the scan trigger above to auto-ingest it!</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isSendingTest}
                        className="w-full py-1.5 bg-[#16a34a] hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-bold text-xs rounded shadow-2xs flex items-center justify-center space-x-1.5 cursor-pointer transition-colors"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        <span>{isSendingTest ? 'Sending Test Email...' : 'Send Test Ticket Email Now'}</span>
                      </button>
                    </form>
                  </div>

                </div>
              )}

            </div>
          )}

          {/* TAB 2: IMAP CUSTOM PROTOCOL CONTROL */}
          {activeTab === 'imap' && (
            <form onSubmit={handleSaveImap} className="space-y-3">
              <div className="bg-slate-50 border border-slate-150 rounded p-2.5 text-[11px] text-slate-600 leading-relaxed">
                <span className="font-extrabold text-[#1e293b] uppercase tracking-wide text-[9px] block mb-1">Set Up Your Custom Mailbox</span>
                To feed incidents via traditional email protocols, register connection details below. The backend poller logs into your security mailbox via IMAP on a periodic background schedule.
              </div>

              {/* Quick Presets */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1.5">Load Connection Presets</span>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => applyPreset('gmail')}
                    className="px-2.5 py-1 text-[11px] font-semibold border border-slate-200 hover:border-slate-350 bg-white text-slate-700 hover:bg-slate-50 transition-all rounded cursor-pointer flex items-center space-x-1"
                  >
                    <span>Google Gmail IMAP</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('outlook')}
                    className="px-2.5 py-1 text-[11px] font-semibold border border-slate-200 hover:border-slate-350 bg-white text-slate-700 hover:bg-slate-50 transition-all rounded cursor-pointer flex items-center space-x-1"
                  >
                    <span>Microsoft Outlook / O365</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-bold text-[#64748b] uppercase tracking-wide block mb-1">IMAP Host Address</label>
                  <input
                    type="text"
                    placeholder="e.g. imap.gmail.com"
                    value={imapHost}
                    onChange={(e) => setImapHost(e.target.value)}
                    className="w-full px-2.5 py-1 text-xs border border-slate-250 hover:border-slate-350 focus:border-[#2563eb] focus:ring-0 outline-none rounded bg-slate-50/20"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-[#64748b] uppercase tracking-wide block mb-1">IMAP Port (typically 993)</label>
                  <input
                    type="number"
                    placeholder="993"
                    value={imapPort}
                    onChange={(e) => setImapPort(e.target.value)}
                    className="w-full px-2.5 py-1 text-xs border border-slate-250 hover:border-slate-350 focus:border-[#2563eb] focus:ring-0 outline-none rounded bg-slate-50/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-bold text-[#64748b] uppercase tracking-wide block mb-1">My Mail Address (Username)</label>
                  <input
                    type="email"
                    placeholder="e.g. custom.service@company.com"
                    value={imapUser}
                    onChange={(e) => setImapUser(e.target.value)}
                    className="w-full px-2.5 py-1 text-xs border border-slate-250 hover:border-slate-350 focus:border-[#2563eb] focus:ring-0 outline-none rounded bg-slate-50/20"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-[#64748b] uppercase tracking-wide block mb-1">Password or Secure App Password</label>
                  <input
                    type="password"
                    placeholder="••••••••••••••••"
                    value={imapPass}
                    onChange={(e) => setImapPass(e.target.value)}
                    className="w-full px-2.5 py-1 text-xs border border-slate-250 hover:border-slate-350 focus:border-[#2563eb] focus:ring-0 outline-none rounded bg-slate-50/20"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-1">
                <label className="flex items-center space-x-2 text-xs font-semibold text-slate-650 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useSsl}
                    onChange={(e) => setUseSsl(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <span>Encrypt Socket (SSL/TLS secure)</span>
                </label>

                <label className="flex items-center space-x-2 text-xs font-semibold text-slate-650 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <span>Enable Background Active Polling</span>
                </label>
              </div>

              <div className="flex space-x-2.5 pt-1.5">
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 border text-white font-bold text-xs rounded transition-all cursor-pointer shadow-2xs"
                >
                  {editingId ? 'Update Credentials' : 'Register Secure Mailbox'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-3 py-1.5 border border-slate-200 hover:border-slate-350 bg-white text-slate-700 font-bold text-xs rounded transition-all cursor-pointer"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>
          )}

          {/* User Feedback lines */}
          {errorMsg && (
            <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded border border-red-150 flex items-center space-x-2 mt-3">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-2.5 bg-emerald-50 text-emerald-700 text-xs rounded border border-emerald-150 flex items-center space-x-2 mt-3">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              <span>{successMsg}</span>
            </div>
          )}

        </div>

        {/* Right Area: Status Side Panel */}
        <div className="lg:col-span-4 space-y-4">
          
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1.5">Configure IMAP connections</span>
            {loading ? (
              <span className="text-xs text-slate-400 font-mono animate-pulse">Checking mail servers...</span>
            ) : configs.length === 0 ? (
              <div className="text-center p-4 bg-slate-50 border border-slate-100 rounded text-xs text-slate-500 font-medium">
                No active IMAP relays connected.
              </div>
            ) : (
              <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                {configs.map(c => (
                  <div key={c.id} className="p-2 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 rounded flex items-center justify-between transition-colors">
                    <div className="truncate pr-1">
                      <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800 truncate">
                        <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{c.imap_user}</span>
                      </div>
                      <div className="text-[9px] text-slate-400 font-mono mt-0.5 mt-1 leading-normal">
                        {c.imap_host}:{c.imap_port} &bull; {c.is_active ? 'Active Sync' : 'Paused'}
                      </div>
                    </div>
                    <div className="flex space-x-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleEditImap(c)}
                        className="p-1 hover:bg-white border hover:border-slate-300 text-slate-600 rounded cursor-pointer"
                        title="Edit credentials"
                      >
                        <Settings className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteImap(c.id)}
                        className="p-1 hover:bg-red-50 hover:text-red-600 border border-transparent hover:border-red-150 text-slate-400 rounded cursor-pointer"
                        title="Delete connection"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 bg-[#eff6ff] border border-blue-150 rounded-md">
            <div className="flex items-start space-x-2">
              <Info className="h-4 w-4 text-[#1d4ed8] shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed text-[#1e40af] font-medium">
                <span className="font-extrabold uppercase tracking-wide text-[9px] text-[#2563eb] block mb-1">
                  Secure Token Management
                </span>
                We adhere to strict enterprise security practices:
                <ul className="list-disc pl-3 mt-1.5 space-y-1 text-slate-650 font-normal">
                  <li>
                    <span className="font-bold text-[#1e40af]">Tokens are in-memory</span>: Access authorization is never stored on disk.
                  </li>
                  <li>
                    <span className="font-bold text-[#1e40af]">App Passwords</span>: If using standard IMAP instead of OAuth, generate a secure app-specific key in your account panel.
                  </li>
                </ul>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
