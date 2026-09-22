import React, { useState, useEffect } from 'react';
import Loader from '@/components/Loader';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { UserPlus, Mail, Trash2, Briefcase } from 'lucide-react';

const APP_ROLES = [
  { value: 'commercial', label: 'Commercial' },
  { value: 'responsable', label: 'Responsable commercial' },
  { value: 'chef_atelier', label: 'Chef d\'atelier' },
  { value: 'responsable_sav', label: 'Responsable SAV' },
  { value: 'direction', label: 'Direction / Marketing' },
  { value: 'collaborateur', label: 'Collaborateur' }
];

export default function AdminUsers({ bases, onReload }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('commercial');
  const [inviteBase, setInviteBase] = useState('');
  const [inviting, setInviting] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('lister_utilisateurs', {});
      setUsers((res?.data?.users) || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setMsg('');
    try {
      await base44.users.inviteUser(inviteEmail.trim(), 'user');
      // Re-fetch to get the new user, then set app_role + base
      const res = await base44.functions.invoke('lister_utilisateurs', {});
      const list = (res?.data?.users) || [];
      const newUser = list.find((u) => u.email === inviteEmail.trim());
      if (newUser) {
        await base44.functions.invoke('definir_role', {
          utilisateur_id: newUser.id,
          app_role: inviteRole,
          base_id: ['commercial', 'chef_atelier'].includes(inviteRole) ? inviteBase : undefined
        });
      }
      setInviteEmail('');
      setMsg('Invitation envoyée et rôle configuré.');
      setTimeout(() => setMsg(''), 4000);
      load();
      if (onReload) onReload();
    } catch (e) {
      setMsg('Erreur: ' + (e.message || 'invitation échouée'));
      setTimeout(() => setMsg(''), 5000);
    } finally {
      setInviting(false);
    }
  };

  const changeRole = async (userId, newRole) => {
    try {
      await base44.functions.invoke('definir_role', { utilisateur_id: userId, app_role: newRole });
      load();
    } catch (e) { console.error(e); }
  };

  const changeBase = async (userId, baseId) => {
    try {
      await base44.entities.User.update(userId, { base_id: baseId || null });
      load();
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-4">
      {/* Invite form */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          <UserPlus className="h-4 w-4 text-gd-orange" /> Inviter un utilisateur
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" placeholder="prenom.nom@gonnin-duris.fr" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Rôle</Label>
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {APP_ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {['commercial', 'chef_atelier'].includes(inviteRole) && (
            <div className="space-y-1.5">
              <Label>Base de rattachement</Label>
              <Select value={inviteBase} onValueChange={setInviteBase}>
                <SelectTrigger><SelectValue placeholder="Choisir une base…" /></SelectTrigger>
                <SelectContent>
                  {bases.map((b) => <SelectItem key={b.id} value={b.id}>{b.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-end">
            <Button onClick={handleInvite} disabled={inviting} className="w-full bg-gd-navy hover:bg-gd-navy-dark text-white">
              {inviting ? 'Invitation…' : 'Inviter'}
            </Button>
          </div>
        </div>
        {msg && <p className="mt-2 text-sm text-emerald-600">{msg}</p>}
      </div>

      {/* Users list */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nom</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rôle</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Base</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4}><Loader compact /></td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-sm font-semibold text-foreground">{u.full_name || '—'}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3">
                  <Select value={u.app_role || 'collaborateur'} onValueChange={(v) => changeRole(u.id, v)}>
                    <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {APP_ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3">
                  {['commercial', 'responsable', 'chef_atelier', 'responsable_sav'].includes(u.app_role) ? (
                    <Select value={u.base_id || ''} onValueChange={(v) => changeBase(u.id, v)}>
                      <SelectTrigger className="h-8 w-40"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>—</SelectItem>
                        {bases.map((b) => <SelectItem key={b.id} value={b.id}>{b.nom}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}