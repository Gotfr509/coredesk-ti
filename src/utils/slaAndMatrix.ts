import { ImpactLevel, TicketPriority, TicketStatus, UrgencyLevel } from '../types/database';

export function calculateMatrixPriority(impact: ImpactLevel, urgency: UrgencyLevel): TicketPriority {
  if (impact === 'alto' && urgency === 'alta') return 'critica';
  if ((impact === 'alto' && urgency === 'media') || (impact === 'medio' && urgency === 'alta')) {
    return 'alta';
  }
  if (impact === 'bajo' && urgency === 'baja') return 'baja';
  return 'media';
}

export const SLA_HOURS: Record<TicketPriority, { responseMin: number; resolutionHours: number }> = {
  critica: { responseMin: 15, resolutionHours: 2 },
  alta: { responseMin: 30, resolutionHours: 4 },
  media: { responseMin: 120, resolutionHours: 8 },
  baja: { responseMin: 240, resolutionHours: 24 },
};

export interface SlaStatusInfo {
  label: string;
  badgeClass: string;
  isBreached: boolean;
  isWarning: boolean;
  percentElapsed: number;
}

export function evaluateSlaStatus(
  createdAt: string,
  slaDueAt: string,
  status: TicketStatus,
  resolvedAt?: string | null
): SlaStatusInfo {
  const start = new Date(createdAt).getTime();
  const due = new Date(slaDueAt).getTime();
  const endRef = status === 'resuelto' && resolvedAt ? new Date(resolvedAt).getTime() : Date.now();

  if (status === 'anulado') {
    return {
      label: 'Anulado',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-300',
      isBreached: false,
      isWarning: false,
      percentElapsed: 0,
    };
  }

  const totalDuration = Math.max(due - start, 1);
  const elapsed = endRef - start;
  const percent = Math.min(Math.round((elapsed / totalDuration) * 100), 100);
  const remainingMs = due - endRef;

  if (status === 'resuelto') {
    const met = remainingMs >= 0;
    return {
      label: met ? 'SLA Cumplido' : 'Resuelto Fuera de SLA',
      badgeClass: met
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-rose-50 text-rose-700 border-rose-200',
      isBreached: !met,
      isWarning: false,
      percentElapsed: percent,
    };
  }

  if (remainingMs < 0) {
    const minsLate = Math.abs(Math.round(remainingMs / 60000));
    const hoursLate = Math.floor(minsLate / 60);
    return {
      label: hoursLate > 0 ? `Vencido hace ${hoursLate}h ${minsLate % 60}m` : `Vencido hace ${minsLate}m`,
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-semibold',
      isBreached: true,
      isWarning: false,
      percentElapsed: 100,
    };
  }

  const minsLeft = Math.round(remainingMs / 60000);
  const hoursLeft = Math.floor(minsLeft / 60);
  const timeText = hoursLeft > 0 ? `${hoursLeft}h ${minsLeft % 60}m restantes` : `${minsLeft}m restantes`;

  if (percent >= 75) {
    return {
      label: `En riesgo (${timeText})`,
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 font-medium',
      isBreached: false,
      isWarning: true,
      percentElapsed: percent,
    };
  }

  return {
    label: `En tiempo (${timeText})`,
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    isBreached: false,
    isWarning: false,
    percentElapsed: percent,
  };
}
