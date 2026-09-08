import React from 'react';
import AgentChat from '@/components/AgentChat';

export default function CopilotAdmin() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Copilot Admin</h1>
        <p className="text-sm text-muted-foreground">
          Votre assistant IA pour piloter l'opération : ajustez les paramètres, validez les ventes,
          gérez les badges, les bases et les affectations — directement en conversation.
        </p>
      </div>
      <AgentChat
        agentName="admin_copilot"
        title="Copilot Admin"
        subtitle="Pilotez l'opération en langage naturel"
        placeholder="Ex : « Combien de ventes en attente de validation ? » ou « Modifie l'objectif RDV à 150 »"
      />
    </div>
  );
}