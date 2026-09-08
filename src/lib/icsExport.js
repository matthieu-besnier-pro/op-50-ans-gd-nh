// Génération de fichiers .ics (iCalendar) pour export vers Outlook / Google Calendar / Apple Calendar.

function toICSDate(isoString) {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  return d.getUTCFullYear() +
    String(d.getUTCMonth() + 1).padStart(2, '0') +
    String(d.getUTCDate()).padStart(2, '0') + 'T' +
    String(d.getUTCHours()).padStart(2, '0') +
    String(d.getUTCMinutes()).padStart(2, '0') +
    String(d.getUTCSeconds()).padStart(2, '0') + 'Z';
}

function escapeICS(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function buildEvent(rdv, client) {
  const start = new Date(rdv.date_heure);
  const end = new Date(start.getTime() + (rdv.duree_minutes || 30) * 60000);
  const dtStart = toICSDate(rdv.date_heure);
  const dtEnd = toICSDate(end.toISOString());
  const dtStamp = toICSDate(new Date().toISOString());
  const summary = `RDV ${rdv.type || ''} — ${client?.raison_sociale || 'Client'}`;
  const location = client?.adresse_complete || '';
  const description = [
    `Type : ${rdv.type || ''}`,
    `Durée : ${rdv.duree_minutes || 30} min`,
    `Statut : ${rdv.statut || ''}`,
    rdv.notes ? `Notes : ${rdv.notes}` : ''
  ].filter(Boolean).join('\\n');

  return [
    'BEGIN:VEVENT',
    `UID:rdv-${rdv.id}@nh50-gd-tracker`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeICS(summary)}`,
    `LOCATION:${escapeICS(location)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    'END:VEVENT'
  ].join('\r\n');
}

export function generateICS(rdv, client) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Gonnin Duris//NH50 Tracker//FR',
    'CALSCALE:GREGORIAN',
    buildEvent(rdv, client),
    'END:VCALENDAR'
  ].join('\r\n');
}

export function generateICSAll(rdvs, clients) {
  const events = rdvs
    .filter((r) => r.date_heure)
    .map((r) => buildEvent(r, clients[r.client_id]))
    .join('\r\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Gonnin Duris//NH50 Tracker//FR',
    'CALSCALE:GREGORIAN',
    events,
    'END:VCALENDAR'
  ].join('\r\n');
}

export function downloadICS(content, filename) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'rdv.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}