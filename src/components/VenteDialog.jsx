import React from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MessageCircle, Clock } from 'lucide-react';

// La déclaration de vente se fait sur le groupe WhatsApp : cet écran le rappelle,
// l'outil récupère ensuite les ventes automatiquement (import plusieurs fois par jour).
export default function VenteDialog({ open, onOpenChange, client }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Déclarer une vente</DialogTitle>
          <DialogDescription>{client?.raison_sociale}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
            <MessageCircle className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
            <p className="text-sm font-semibold text-emerald-900 leading-snug">
              Déclarez votre vente dans le groupe WhatsApp comme d'habitude ! Elle remontera automatiquement ici, rien d'autre à faire.
            </p>
          </div>
          <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
            <Clock className="h-4 w-4 text-gd-navy mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-snug">
              Les mises à jour sont faites plusieurs fois par jour : votre vente apparaît dans l'outil quelques heures après sa déclaration.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="bg-gd-navy hover:bg-gd-navy-dark text-white">
            J'ai compris
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}