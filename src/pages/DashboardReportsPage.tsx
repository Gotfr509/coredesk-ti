import React, { useMemo } from 'react';
import { FileSpreadsheet, FileText, Award, Layers, Users } from 'lucide-react';
import { Profile, Ticket } from '../types/database';
import { evaluateSlaStatus } from '../utils/slaAndMatrix';
import { exportTicketsToExcel, exportTicketsToPdf } from '../utils/exportReports';

interface DashboardReportsPageProps {
  tickets: Ticket[];
  technicians: Profile[];
}

export const DashboardReportsPage: React.FC<DashboardReportsPageProps> = ({
  tickets,
  technicians,
}) => {
  const metrics = useMemo(() => {
    const nonCancelled = tickets.filter((t) => t.status !== 'anulado');
    const resolved = nonCancelled.filter((t) => t.status === 'resuelto');
    const resolvedOnTime = resolved.filter((t) => {
      const s = evaluateSlaStatus(t.created_at, t.sla_due_at, t.status, t.resolved_at);
      return !s.isBreached;
    });

    const complianceRate =
      resolved.length > 0 ? Math.round((resolvedOnTime.length / resolved.length) * 100) : 100;

    const byChannel = {
      correo: nonCancelled.filter((t) => t.channel === 'correo').length,
      whatsapp: nonCancelled.filter((t) => t.channel === 'whatsapp').length,
      telefono: nonCancelled.filter((t) => t.channel === 'telefono').length,
      web: nonCancelled.filter((t) => t.channel === 'web').length,
    };

    const byTech = technicians.map((tech) => {
      const assigned = nonCancelled.filter((t) => t.assigned_to === tech.id);
      const techResolved = assigned.filter((t) => t.status === 'resuelto');
      return {
        name: tech.full_name,
        total: assigned.length,
        resolved: techResolved.length,
        open: assigned.length - techResolved.length,
      };
    });

    return {
      total: nonCancelled.length,
      resolved: resolved.length,
      complianceRate,
      byChannel,
      byTech,
    };
  }, [tickets, technicians]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Reportes Gerenciales y Cumplimiento SLA</h2>
          <p className="text-sm text-slate-500">
            Indicadores operativos para toma de decisiones basada en datos (ITIL 4 / ISO 20000-1)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => exportTicketsToExcel(tickets)}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Exportar Excel</span>
          </button>
          <button
            onClick={() => exportTicketsToPdf(tickets, metrics.complianceRate)}
            className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition"
          >
            <FileText className="w-4 h-4" />
            <span>Exportar PDF</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm">
            <Award className="w-5 h-5" />
            <span>Cumplimiento Global de SLA</span>
          </div>
          <p className="text-4xl font-extrabold text-slate-900 mt-3">{metrics.complianceRate}%</p>
          <div className="w-full bg-slate-100 h-2.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full"
              style={{ width: `${metrics.complianceRate}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Calculado sobre {metrics.resolved} tickets resueltos dentro del tiempo comprometido.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-indigo-600 font-semibold text-sm">
            <Layers className="w-5 h-5" />
            <span>Distribución por Canal Integrado</span>
          </div>
          <div className="mt-4 space-y-2.5 text-sm">
            {Object.entries(metrics.byChannel).map(([ch, count]) => {
              const pct = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;
              return (
                <div key={ch}>
                  <div className="flex justify-between text-xs font-medium capitalize mb-1">
                    <span>{ch}</span>
                    <span>
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm">
            <Users className="w-5 h-5" />
            <span>Carga y Resolución por Técnico</span>
          </div>
          <div className="mt-4 space-y-3">
            {metrics.byTech.map((t) => (
              <div key={t.name} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                <p className="font-bold text-slate-800">{t.name}</p>
                <div className="flex justify-between text-slate-600 mt-1">
                  <span>Asignados: {t.total}</span>
                  <span className="text-emerald-700 font-semibold">Resueltos: {t.resolved}</span>
                  <span className="text-amber-700">Abiertos: {t.open}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
