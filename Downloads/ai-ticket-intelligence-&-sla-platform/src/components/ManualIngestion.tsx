import React from 'react';
import { Mail, FileSpreadsheet, PlusCircle, AlertCircle, CheckCircle, HelpCircle } from 'lucide-react';
import { TicketSource, RichTicket } from '../types.js';

interface ManualIngestionProps {
  onIngestManual: (ticket: { subject: string; body: string; sender: string; source: TicketSource }) => void;
  onBulkIngestCsv: (list: Array<{ subject: string; body: string; sender: string }>) => void;
  isSyncing: boolean;
}

export default function ManualIngestion({
  onIngestManual,
  onBulkIngestCsv,
  isSyncing
}: ManualIngestionProps) {
  // Manual Ingestion States
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');
  const [sender, setSender] = React.useState('');
  const [source, setSource] = React.useState<TicketSource>('manual');
  const [success, setSuccess] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState('');

  // CSV States
  const [csvText, setCsvText] = React.useState<string>(
    `Subject,Body,Sender\n` +
    `"Database Connection Timeout on Read Replica","Critical query bottleneck observed under peak morning billing routines.","performance-monitoring@enterprise.com"\n` +
    `"Firewall block triggered on port 8080","Unusual TCP package spike detected on staging proxy gateway during deployment.","siem-firewall@enterprise.com"\n` +
    `"SSO Certificate renewal approaching deadline","Enterprise SAML Token verification key expires on US-West gateway in 36 hours.","compliance-monitor@enterprise.com"`
  );
  const [csvSuccess, setCsvSuccess] = React.useState(false);
  const [csvParseError, setCsvParseError] = React.useState('');

  // Submit manual form
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccess(false);

    if (!subject.trim() || !body.trim() || !sender.trim()) {
      setErrorMsg('Subject, description body, and sender are required fields.');
      return;
    }

    if (!sender.includes('@')) {
      setErrorMsg('Please input a valid contact/sender email address.');
      return;
    }

    onIngestManual({
      subject: subject.trim(),
      body: body.trim(),
      sender: sender.trim(),
      source
    });

    setSubject('');
    setBody('');
    setSender('');
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3500);
  };

  // Run CSV parser simulation
  const handleCsvIngest = () => {
    setCsvParseError('');
    setCsvSuccess(false);

    try {
      const lines = csvText.split('\n').filter(line => line.trim().length > 0);
      if (lines.length < 2) {
        setCsvParseError('The CSV payload holds insufficient lines. Header row + minimum 1 data row required.');
        return;
      }

      const list: Array<{ subject: string; body: string; sender: string }> = [];

      // Simple CSV row parser (handles quotes and commas)
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        
        // Match standard quoted strings or unquoted terms
        const regex = /("([^"]*)"|([^,]*))/g;
        const matches = [...line.matchAll(regex)]
          .map(m => m[2] !== undefined ? m[2] : m[3])
          .filter((val, idx) => idx % 2 === 0); // Filter regex matching overhead artifacts

        if (matches.length >= 2) {
          list.push({
            subject: matches[0] || 'Bulk Ingested Incident',
            body: matches[1] || 'No description provided.',
            sender: matches[2] || 'csv-uploader@enterprise-corp.com'
          });
        }
      }

      if (list.length === 0) {
        setCsvParseError('Could not locate valid comma-delimited rows. Confirm your quotation formatting.');
        return;
      }

      onBulkIngestCsv(list);
      setCsvSuccess(true);
      setTimeout(() => setCsvSuccess(false), 3500);
    } catch (err: any) {
      setCsvParseError(`Parsing error: ${err.message}`);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      
      {/* MANUAL SUPPORT FORM ENTRY */}
      <div className="bg-white rounded-md border border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-4">
        <div className="flex items-center space-x-2 pb-3 mb-3 border-b border-slate-100">
          <PlusCircle className="h-4.5 w-4.5 text-slate-650" />
          <h2 className="text-xs font-bold text-[#0f172a] tracking-tight">Manual Ingestion Form</h2>
        </div>

        <form onSubmit={handleManualSubmit} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-0.5">
            <div>
              <label className="text-[9px] font-bold text-[#64748b] uppercase tracking-wide block mb-1">
                Sender Contact / API Email
              </label>
              <input
                type="text"
                placeholder="e.g. devops-alert@company.com"
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                className="w-full px-2.5 py-1 text-xs border border-slate-250 hover:border-slate-350 focus:border-[#2563eb] bg-slate-50/40 hover:bg-slate-50 transition-colors focus:ring-0 outline-none rounded"
              />
            </div>

            <div>
              <label className="text-[9px] font-bold text-[#64748b] uppercase tracking-wide block mb-1">
                Trigger Source Ingestion
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as TicketSource)}
                className="w-full px-2 py-1 text-xs border border-slate-250 hover:border-slate-350 focus:border-[#2563eb] bg-white transition-colors focus:ring-0 outline-none rounded cursor-pointer font-semibold text-slate-700"
              >
                <option value="manual">Manual Form Ticket</option>
                <option value="gmail">Gmail Ingestion Simulation</option>
                <option value="outlook">Outlook Ingestion Simulation</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[9px] font-bold text-[#64748b] uppercase tracking-wide block mb-1">
              Brief Subject Line
            </label>
            <input
              type="text"
              placeholder="e.g. High latency errors on US billing replica"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-2.5 py-1 text-xs border border-slate-250 hover:border-slate-350 focus:border-[#2563eb] bg-slate-50/40 hover:bg-slate-50 transition-colors focus:ring-0 outline-none rounded"
            />
          </div>

          <div>
            <label className="text-[9px] font-bold text-[#64748b] uppercase tracking-wide block mb-1">
              Comprehensive Support Description
            </label>
            <textarea
              placeholder="Record any core log outputs, system indicators, or impact details here..."
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-250 hover:border-slate-350 focus:border-[#2563eb] bg-slate-50/40 hover:bg-slate-50 transition-colors focus:ring-0 outline-none rounded font-sans"
            />
          </div>

          {errorMsg && (
            <div className="p-2 bg-red-50 text-red-705 text-red-700 text-[11px] rounded border border-red-150 flex items-center space-x-1.5 font-medium leading-none">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {success && (
            <div className="p-2 bg-emerald-50 text-emerald-750 text-emerald-700 text-[11px] rounded border border-emerald-150 flex items-center space-x-1.5 font-medium leading-none">
              <CheckCircle className="h-3.5 w-3.5" />
              <span>Incidents created! Routing completed.</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSyncing}
            className="w-full bg-[#2563eb] hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs py-1.5 rounded transition-all cursor-pointer shadow-2xs"
          >
            {isSyncing ? 'Processing AI analysis...' : 'Submit Support Request'}
          </button>
        </form>
      </div>

      {/* CSV BATCH INGESTION SIMULATION */}
      <div className="bg-white rounded-md border border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center space-x-2 pb-3 mb-3 border-b border-slate-100">
            <FileSpreadsheet className="h-4.5 w-4.5 text-slate-650" />
            <h2 className="text-xs font-bold text-[#0f172a] tracking-tight">Structured Bulk CSV Ingest</h2>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded leading-relaxed text-[11px] p-2.5 text-slate-500 font-medium leading-normal mb-3">
            <span className="font-extrabold text-slate-700 uppercase tracking-wide text-[9px] block mb-1">Bulk Processing Guidelines</span>
            Upload raw incidents in tabular layout. Once submitted, each record is parsed, queued, and dispatched to Gemini for category clustering, risk evaluation, and active technician autorouting.
          </div>

          <div>
            <label className="text-[9px] font-bold text-[#64748b] uppercase tracking-wide block mb-1">
              CSV Text Payload Editor
            </label>
            <textarea
              className="w-full px-2.5 py-1.5 text-xs border border-slate-250 hover:border-slate-350 focus:border-[#2563eb] bg-slate-50/50 hover:bg-slate-50 transition-colors focus:ring-0 outline-none rounded font-mono text-slate-800 leading-normal"
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-3.5">
          {csvParseError && (
            <div className="p-2 bg-red-50 text-red-750 text-red-700 text-[11px] rounded border border-red-150 mb-2 flex items-center space-x-1.5 font-medium leading-none">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>{csvParseError}</span>
            </div>
          )}

          {csvSuccess && (
            <div className="p-2 bg-emerald-50 text-emerald-755 text-emerald-700 text-[11px] rounded border border-emerald-150 mb-2 flex items-center space-x-1.5 font-medium leading-none">
              <CheckCircle className="h-3.5 w-3.5" />
              <span>Table rows ingested, analyzed, and routed!</span>
            </div>
          )}

          <button
            onClick={handleCsvIngest}
            disabled={isSyncing}
            className="w-full bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-bold text-xs py-1.5 rounded transition-all cursor-pointer shadow-2xs"
          >
            {isSyncing ? 'Ingesting Bulk Analytics...' : 'Execute Bulk CSV Upload'}
          </button>
        </div>

      </div>

    </div>
  );
}
