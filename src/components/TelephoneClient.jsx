import React from 'react';
import { Phone } from 'lucide-react';
import { numerosTelephone, formatTelephone } from '@/lib/telephone';

// Numéros du client empilés l'un sous l'autre (mobile en priorité, sinon fixe).
// Chaque numéro est cliquable pour appeler directement depuis la tablette.
export default function TelephoneClient({ client }) {
  const numeros = numerosTelephone(client?.tel_mobile || client?.tel_fixe);

  if (numeros.length === 0) return <span className="text-sm text-muted-foreground">—</span>;

  return (
    <div className="flex flex-col items-start">
      {numeros.map((n) => (
        <a
          key={n}
          href={`tel:${n}`}
          onClick={(e) => e.stopPropagation()}
          className="-mx-1 inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-sm font-semibold text-gd-navy hover:bg-gd-orange/10 hover:text-gd-orange whitespace-nowrap"
        >
          <Phone className="h-4 w-4 xl:h-3.5 xl:w-3.5" />{formatTelephone(n)}
        </a>
      ))}
    </div>
  );
}