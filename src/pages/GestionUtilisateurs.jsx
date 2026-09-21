import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import AdminUsers from '@/components/AdminUsers';
import StatCard from '@/components/StatCard';
import { Users, UserCheck, Briefcase, Mail } from 'lucide-react';

export default function GestionUtilisateurs() {
  const [bases, setBases] = useState([]);
  const [stats, setStats] = useState({ total: 0, commerciaux: 0, responsables: 0, collaborateurs: 0 });

  useEffect(() => {
    const load = async () => {
      try {
        const [b, users] = await Promise.all([
          base44.entities.base.list('-nom', 100),
          base44.entities.User.list('-created_date', 200).catch(() => [])
        ]);
        setBases(b);
        setStats({
          total: users.length,
          commerciaux: users.filter((u) => u.app_role === 'commercial').length,
          responsables: users.filter((u) => u.app_role === 'responsable' || u.app_role === 'direction').length,
          collaborateurs: users.filter((u) => u.app_role === 'collaborateur').length
        });
      } catch (e) { console.error(e); }
    };
    load();
  }, []);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-gd-navy" /> Gestion des utilisateurs
          </h1>
          <p className="text-sm text-muted-foreground">Invitez, assignez les rôles et les bases de rattachement</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total" value={stats.total} icon={Users} />
          <StatCard label="Commerciaux" value={stats.commerciaux} icon={Briefcase} />
          <StatCard label="Responsables / Direction" value={stats.responsables} icon={UserCheck} />
          <StatCard label="Collaborateurs" value={stats.collaborateurs} icon={Mail} accent />
        </div>

        <AdminUsers bases={bases} />
      </div>
    </Layout>
  );
}