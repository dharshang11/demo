import React from 'react';
import { User, ExecutiveAISummary, PersonalAIInsights } from '../types.js';
import { Sparkles, Brain, Award, TrendingUp, HelpCircle, Activity } from 'lucide-react';

interface AISummaryCardProps {
  currentUser: User;
  onRefreshAll: () => void;
}

export default function AISummaryCard({ currentUser, onRefreshAll }: AISummaryCardProps) {
  const [leadSummary, setLeadSummary] = React.useState<ExecutiveAISummary | null>(null);
  const [memberInsights, setMemberInsights] = React.useState<PersonalAIInsights | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isLead = currentUser.role === 'lead';

  const fetchData = React.useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const queryParam = forceRefresh ? '?refresh=true' : '';
      if (isLead) {
        const res = await fetch(`/api/summary${queryParam}`);
        if (!res.ok) throw new Error('Failed to retrieve executive AI summary.');
        const data = await res.json();
        setLeadSummary(data);
      } else {
        const res = await fetch(`/api/insights/${encodeURIComponent(currentUser.name)}${queryParam}`);
        if (!res.ok) throw new Error('Failed to retrieve personal insights.');
        const data = await res.json();
        setMemberInsights(data);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'AI request error occurred.');
    } finally {
      setLoading(false);
    }
  }, [isLead, currentUser.name, currentUser.role]);

  React.useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  const handleRecalculate = () => {
    fetchData(true);
  };

  return (
    <div className="bg-[#eff6ff] text-[#1e40af] rounded-md border border-[#bfdbfe] p-4.5 mb-4.5 relative overflow-hidden shadow-[0_1px_3px_rgba(37,99,235,0.04)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-3 border-b border-[#bfdbfe]/40">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 bg-[#2563eb] text-white rounded-full flex items-center justify-center font-bold text-[10px] shadow-xs">
            AI
          </div>
          <div>
            <h2 className="font-bold text-xs text-[#1e3a8a] tracking-tight flex items-center">
              {isLead ? 'Executive AI Insights Brief' : 'AI Performance & Coaching Journal'}
              <span className="ml-1.5 px-1 py-0.2 rounded text-[8px] font-extrabold uppercase bg-blue-200 text-blue-800 border border-blue-300">
                Gemini Active
              </span>
            </h2>
            <p className="text-[10px] text-slate-500 font-medium">
              {isLead ? "Today's SLA impact and ticket trend optimization analysis" : "Personal workload specialty indicators"}
            </p>
          </div>
        </div>

        <button
          onClick={handleRecalculate}
          disabled={loading}
          className="flex items-center space-x-1.5 px-2.5 py-1 bg-white hover:bg-slate-50 disabled:opacity-50 text-[11px] font-bold rounded border border-blue-200 text-[#1e40af] hover:text-[#1e3a8a] transition-all shadow-2xs cursor-pointer self-start sm:self-center"
        >
          <Brain className="h-3 w-3 text-[#2563eb]" />
          <span>{loading ? 'Analyzing...' : 'Recalculate Insights'}</span>
        </button>
      </div>

      {loading ? (
        <div className="py-8 flex flex-col items-center justify-center space-y-2">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#2563eb] border-t-transparent"></div>
          <span className="text-[10px] text-slate-500 font-medium font-mono">Running model logic rules...</span>
        </div>
      ) : error ? (
        <div className="p-2.5 bg-red-50 text-red-700 rounded border border-red-200 text-[11px]">
          Operational failure: {error}. Using local heuristics context.
        </div>
      ) : isLead && leadSummary ? (
        <div>
          {/* Executive Metrics Panels */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <div className="bg-white p-2.5 rounded border border-[#bfdbfe]/50 shadow-2xs">
              <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider mb-0.5">Today Triaged</span>
              <span className="text-sm font-extrabold text-[#0f172a] block">{leadSummary.today_analyzed_count} Tickets</span>
            </div>
            <div className="bg-white p-2.5 rounded border border-[#bfdbfe]/50 shadow-2xs">
              <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider mb-0.5">Critical Outages</span>
              <span className={`text-sm font-extrabold block ${leadSummary.critical_risks_detected > 0 ? 'text-[#dc2626]' : 'text-slate-700'}`}>
                {leadSummary.critical_risks_detected} Alert{leadSummary.critical_risks_detected === 1 ? '' : 's'}
              </span>
            </div>
            <div className="bg-white p-2.5 rounded border border-[#bfdbfe]/50 shadow-2xs">
              <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider mb-0.5">DB Share / Risks</span>
              <span className="text-sm font-extrabold text-blue-600 block">{leadSummary.database_percentage}%</span>
            </div>
            <div className="bg-white p-2.5 rounded border border-[#bfdbfe]/50 shadow-2xs">
              <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider mb-0.5">Resolution SLA</span>
              <span className="text-sm font-extrabold text-emerald-600 block">{leadSummary.avg_resolution_hours}h target</span>
            </div>
          </div>

          {/* AI Narrative */}
          <div className="bg-white p-3 rounded border border-[#bfdbfe]/50 shadow-2xs">
            <p className="text-[11px] text-slate-700 leading-relaxed whitespace-pre-line font-medium">
              {leadSummary.summary_text}
            </p>
          </div>
        </div>
      ) : !isLead && memberInsights ? (
        <div>
          {/* Personal Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <div className="bg-white p-2.5 rounded border border-[#bfdbfe]/50 shadow-2xs">
              <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider mb-0.5">My Resolved Pool</span>
              <span className="text-sm font-extrabold text-[#0f172a] block">{memberInsights.resolved_tickets} Tickets</span>
            </div>
            <div className="bg-white p-2.5 rounded border border-[#bfdbfe]/50 shadow-2xs">
              <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider mb-0.5">Specialties</span>
              <span className="text-[10px] font-bold text-[#2563eb] block capitalize truncate" title={memberInsights.most_frequent_category}>
                {memberInsights.most_frequent_category} Support
              </span>
            </div>
            <div className="bg-white p-2.5 rounded border border-[#bfdbfe]/50 shadow-2xs">
              <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider mb-0.5">Avg Resolution</span>
              <span className="text-sm font-extrabold text-emerald-600 block">{memberInsights.avg_resolution_hours} Hours</span>
            </div>
            <div className="bg-white p-2.5 rounded border border-[#bfdbfe]/50 shadow-2xs">
              <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider mb-0.5">Core Strength</span>
              <span className="text-[10px] font-bold text-amber-650 text-amber-600 block truncate" title={memberInsights.top_strength}>
                {memberInsights.top_strength}
              </span>
            </div>
          </div>

          {/* AI Strength Narrative */}
          <div className="bg-white p-3 rounded border border-[#bfdbfe]/50 shadow-2xs text-slate-705">
            <div className="flex items-center space-x-1.5 mb-1.5 pb-1 border-b border-slate-100">
              <Award className="h-3.5 w-3.5 text-yellow-500" />
              <span className="text-[10px] font-bold text-slate-800">Strengths & Growth Path Coaching</span>
            </div>
            <p className="text-[11px] text-slate-650 leading-relaxed">
              {memberInsights.recommendation}
            </p>
          </div>
        </div>
      ) : (
        <div className="py-3 text-center text-slate-400 text-[11px]">
          No metrics synchronized yet.
        </div>
      )}
    </div>
  );
}
