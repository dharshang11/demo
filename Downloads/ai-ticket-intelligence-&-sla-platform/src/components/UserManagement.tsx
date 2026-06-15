import React from 'react';
import { User } from '../types.js';
import { Users, UserPlus, Slash, ShieldAlert, CheckCircle, Ban, Camera } from 'lucide-react';

interface UserManagementProps {
  users: User[];
  currentUser: User;
  onAddUser: (user: { name: string; email: string; role: 'lead' | 'member'; skills: string[]; avatar?: string }) => void;
  onToggleStatus: (userId: string, newStatus: 'active' | 'inactive') => void;
  onUpdateAvatar?: (userId: string, avatarUrl: string) => void;
}

export default function UserManagement({
  users,
  currentUser,
  onAddUser,
  onToggleStatus,
  onUpdateAvatar
}: UserManagementProps) {
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<'lead' | 'member'>('member');
  const [skillsText, setSkillsText] = React.useState('');
  const [avatarUrl, setAvatarUrl] = React.useState('');
  const [success, setSuccess] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState('');

  // Editing profile avatar modal states
  const [editingAvatarUserId, setEditingAvatarUserId] = React.useState<string | null>(null);
  const [editingAvatarUrl, setEditingAvatarUrl] = React.useState('');

  const isLead = currentUser.role === 'lead';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccess(false);

    if (!name.trim() || !email.trim() || !skillsText.trim()) {
      setErrorMsg('All fields are mandatory to onboard a new technician.');
      return;
    }

    if (!email.includes('@') || !email.includes('.')) {
      setErrorMsg('Please input a valid corporate email.');
      return;
    }

    const skills = skillsText.split(',').map(s => s.trim()).filter(s => s.length > 0);
    
    onAddUser({
      name: name.trim(),
      email: email.trim(),
      role,
      skills,
      avatar: avatarUrl.trim() || undefined
    });

    // Reset Form
    setName('');
    setEmail('');
    setRole('member');
    setSkillsText('');
    setAvatarUrl('');
    setSuccess(true);
    
    setTimeout(() => setSuccess(false), 3000);
  };

  if (!isLead) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-md p-6 text-center max-w-md mx-auto my-8 animate-fade-in">
        <ShieldAlert className="h-8 w-8 text-red-500 mx-auto mb-2" />
        <h3 className="text-[#0f172a] font-extrabold text-xs uppercase tracking-wider">Access Restrained</h3>
        <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
          User Management and technician onboarding dashboards are restricted to certified Team Leads. Change your authorization role at the top panel to audit this console.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* CORES STAFF DIRECTORY AND WORKLOADS */}
      <div className="lg:col-span-2 bg-white rounded-md border border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-4">
        <div className="flex items-center space-x-2 pb-3 mb-3 border-b border-slate-100">
          <Users className="h-4.5 w-4.5 text-slate-600" />
          <h2 className="text-xs font-bold text-[#0f172a] tracking-tight">Active Team Workload Directory</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[9px] font-bold text-[#64748b] bg-slate-50 uppercase tracking-wider leading-none">
                <th className="py-2 px-2.5">Technician Details</th>
                <th className="py-2 px-2.5">Role</th>
                <th className="py-2 px-2.5">Technical Specialty Skills</th>
                <th className="py-2 px-2.5">Active Tickets Load</th>
                <th className="py-2 px-2.5">Workforce Status</th>
                <th className="py-2 px-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px] font-medium text-slate-650">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/50">
                  <td className="py-2 px-2.5">
                    <div className="flex items-center space-x-2">
                      <div className="relative group shrink-0">
                        <img
                          src={u.avatar}
                          alt={u.name}
                          className="h-7 w-7 rounded-full border border-slate-200 shadow-2xs group-hover:brightness-90 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setEditingAvatarUserId(u.id);
                            setEditingAvatarUrl(u.avatar || '');
                          }}
                          className="absolute -bottom-0.5 -right-0.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-550 hover:text-slate-700 p-0.5 rounded-full shadow-2xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center"
                          title="Change Profile Picture"
                        >
                          <Camera className="h-2 w-2" />
                        </button>
                      </div>
                      <div>
                        <span className="text-slate-900 font-bold block leading-tight">{u.name}</span>
                        <span className="text-[10px] text-slate-400 block leading-none">{u.email}</span>
                      </div>
                    </div>
                  </td>

                  <td className="py-2 px-2.5">
                    <span className={`px-1 rounded text-[8.5px] font-bold uppercase border ${
                      u.role === 'lead' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-650 border-slate-200'
                    }`}>
                      {u.role.toUpperCase()}
                    </span>
                  </td>

                  <td className="py-2 px-2.5">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {u.skills.map((skill, i) => (
                        <span key={i} className="px-1 py-0.2 rounded-sm text-[8.5px] bg-slate-50 border border-slate-150 text-slate-600 whitespace-nowrap inline-block">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </td>

                  <td className="py-2 px-2.5">
                    <div className="flex items-center space-x-1 whitespace-nowrap">
                      <span className={`text-xs font-bold leading-none ${
                        (u.active_tickets_count || 0) >= 3 ? 'text-amber-600' : 'text-[#0f172a]'
                      }`}>
                        {u.active_tickets_count || 0}
                      </span>
                      <span className="text-[9.5px] text-slate-400 font-normal">active</span>
                    </div>
                  </td>

                  <td className="py-2 px-2.5">
                    <span className={`px-1 py-0.2 rounded-sm text-[8px] font-bold border uppercase ${
                      u.status === 'active' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-150' 
                        : 'bg-red-50 text-red-700 border-red-150'
                    }`}>
                      {u.status.toUpperCase()}
                    </span>
                  </td>

                  <td className="py-2 px-2">
                    {u.id !== currentUser.id && (
                      <button
                        onClick={() => onToggleStatus(u.id, u.status === 'active' ? 'inactive' : 'active')}
                        className={`p-1 rounded transition-colors cursor-pointer ${
                          u.status === 'active' 
                            ? 'hover:bg-red-50 text-red-650 text-red-600' 
                            : 'hover:bg-emerald-50 text-emerald-650 text-emerald-600'
                        }`}
                        title={u.status === 'active' ? 'Deactivate Account' : 'Activate Account'}
                      >
                        {u.status === 'active' ? <Ban className="h-3 w-3" /> : <CheckCircle className="h-3. w-3" />}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CORES STAFF ADDITION ON BOARD FORM */}
      <div className="bg-white rounded-md border border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-4">
        <div className="flex items-center space-x-2 pb-3 mb-3 border-b border-slate-100">
          <UserPlus className="h-4.5 w-4.5 text-slate-600" />
          <h2 className="text-xs font-bold text-[#0f172a] tracking-tight">Onboard New Technician</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[9px] font-bold text-[#64748b] uppercase tracking-wide block mb-1">
              Full Employee Name
            </label>
            <input
              type="text"
              placeholder="e.g. Rachel Adams"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-2.5 py-1 text-xs border border-slate-250 hover:border-slate-350 focus:border-[#2563eb] bg-slate-50/40 hover:bg-slate-50 transition-colors focus:ring-0 outline-none rounded"
            />
          </div>

          <div>
            <label className="text-[9px] font-bold text-[#64748b] uppercase tracking-wide block mb-1">
              Corporate Email Address
            </label>
            <input
              type="text"
              placeholder="e.g. rachel.adams@enterprise-core.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-2.5 py-1 text-xs border border-slate-250 hover:border-[#cbd5e1] focus:border-[#2563eb] bg-slate-50/40 hover:bg-slate-50 transition-colors focus:ring-0 outline-none rounded"
            />
          </div>

          <div>
            <label className="text-[9px] font-bold text-[#64748b] uppercase tracking-wide block mb-1">
              Platform Role (Permissions Map)
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'lead' | 'member')}
              className="w-full px-2 py-1 text-xs border border-slate-250 hover:border-[#cbd5e1] focus:border-[#2563eb] bg-white transition-colors focus:ring-0 outline-none rounded cursor-pointer font-semibold text-slate-750"
            >
              <option value="member">Team Member (Support Technician)</option>
              <option value="lead">Team Lead (Full Authority Manager)</option>
            </select>
          </div>

          <div>
            <label className="text-[9px] font-bold text-[#64748b] uppercase tracking-wide block mb-1 flex justify-between font-sans">
              <span>Technical Specialty Skills</span>
              <span className="text-slate-400 font-normal scale-90 origin-right normal-case">Comma separated</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Database, Cloud, Security"
              value={skillsText}
              onChange={(e) => setSkillsText(e.target.value)}
              className="w-full px-2.5 py-1 text-xs border border-[#cbd5e1] hover:border-slate-350 focus:border-[#2563eb] bg-slate-50/40 hover:bg-slate-50 transition-colors focus:ring-0 outline-none rounded"
            />
          </div>

          <div>
            <label className="text-[9px] font-bold text-[#64748b] uppercase tracking-wide block mb-1">
              Profile Image (Avatar) URL (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. https://images.unsplash.com/... or leave blank for random"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className="w-full px-2.5 py-1 text-xs border border-[#cbd5e1] hover:border-slate-350 focus:border-[#2563eb] bg-slate-50/40 hover:bg-slate-50 transition-colors focus:ring-0 outline-none rounded"
            />
          </div>

          {errorMsg && (
            <div className="p-2 bg-red-50 text-red-700 text-xs rounded border border-red-200">
              {errorMsg}
            </div>
          )}

          {success && (
            <div className="p-2 bg-emerald-50 text-emerald-700 text-xs rounded border border-emerald-250 flex items-center space-x-1.5">
              <CheckCircle className="h-3.5 w-3.5" />
              <span>Technician onboarded with custom skills match successfully!</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-[#2563eb] hover:bg-blue-700 text-white font-bold text-xs py-1.5 rounded transition-all cursor-pointer shadow-2xs"
          >
            Create Staff Profile Account
          </button>
        </form>
      </div>

      {editingAvatarUserId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-lg border border-slate-200 shadow-lg p-5 w-full max-w-sm">
            <h3 className="text-xs font-bold text-[#0f172a] mb-1 uppercase tracking-wide">
              Update Profile Image
            </h3>
            <p className="text-[10px] text-slate-500 mb-4">
              Enter a new image URL for {users.find(u => u.id === editingAvatarUserId)?.name}. You can use any hosted image or Unsplash link.
            </p>
            
            <div className="flex items-center space-x-3 mb-4">
              <img
                src={editingAvatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                alt="Preview"
                className="h-12 w-12 rounded-full border border-slate-200 shadow-xs object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
                }}
              />
              <div className="flex-1">
                <label className="text-[9px] font-bold text-[#64748b] uppercase tracking-wide block mb-1">
                  Preview Image
                </label>
                <span className="text-[9px] font-mono text-slate-400 block truncate max-w-[200px]">
                  {editingAvatarUrl || 'Default fallback'}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[9px] font-bold text-[#64748b] uppercase tracking-wide block mb-1">
                  Image URL
                </label>
                <input
                  type="text"
                  value={editingAvatarUrl}
                  onChange={(e) => setEditingAvatarUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/... or any hosted URL"
                  className="w-full px-2.5 py-1 text-xs border border-slate-250 hover:border-slate-350 focus:border-[#2563eb] bg-slate-50/45 outline-none rounded"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditingAvatarUserId(null);
                    setEditingAvatarUrl('');
                  }}
                  className="px-3 py-1 border border-slate-200 hover:border-slate-300 text-slate-650 hover:text-slate-800 text-xs font-semibold rounded cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (onUpdateAvatar && editingAvatarUserId) {
                      await onUpdateAvatar(editingAvatarUserId, editingAvatarUrl.trim());
                    }
                    setEditingAvatarUserId(null);
                    setEditingAvatarUrl('');
                  }}
                  className="px-3 py-1 bg-[#2563eb] hover:bg-blue-700 text-white text-xs font-bold rounded cursor-pointer transition-colors shadow-2xs"
                >
                  Save Image URL
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
