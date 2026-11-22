import React, { useMemo, useState } from 'react';
import {
  Search,
  Filter,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Mail,
  MessageSquare,
  Phone,
  Globe,
  Eye,
} from 'lucide-react';
import { Profile, Ticket, TicketChannel, TicketPriority, TicketStatus } from '../types/database';
import { evaluateSlaStatus } from '../utils/slaAndMatrix';

interface TicketInboxPageProps {
  tickets: Ticket[];
  technicians: Profile[];
  onSelectTicket: (ticket: Ticket) => void;
}

export const TicketInboxPage: React.FC<TicketInboxPageProps> = ({
  tickets,
  technicians,
  onSelectTicket,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'todos'>('todos');
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | 'todas'>('todas');
  const [channelFilter, setChannelFilter] = useState<TicketChannel | 'todos'>('todos');
  const [techFilter, setTechFilter] = useState<string>('todos');

  const kpis = useMemo(() => {
    const active = tickets.filter((t) => ['nuevo', 'en_curso'].includes(t.status));
    const critical = active.filter((t) => t.priority === 'critica');
    const breachedOrRisk = active.filter((t) => {
      const s = evaluateSlaStatus(t.created_at, t.sla_due_at, t.status, t.resolved_at);
      return s.isBreached || s.isWarning;
    });
    const resolved = tickets.filter((t) => t.status === 'resuelto');
    return {
      totalActive: active.length,
      criticalCount: critical.length,
      slaAlertCount: breachedOrRisk.length,
      resolvedCount: resolved.length,
    };
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const matchesSearch =
        t.ticket_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.client?.company_name || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'todos' || t.status === statusFilter;
      const matchesPriority = priorityFilter === 'todas' || t.priority === priorityFilter;
      const matchesChannel = channelFilter === 'todos' || t.channel === channelFilter;
      const matchesTech = techFilter === 'todos' || t.assigned_to === techFilter;
      return matchesSearch && matchesStatus && matchesPriority && matchesChannel && matchesTech;
    });
  }, [tickets, searchTerm, statusFilter, priorityFilter, channelFilter, techFilter]);

  const priorityColors: Record<TicketPriority, string> = {
    critica: 'bg-rose-100 text-rose-800 border-rose-300',
    alta: 'bg-orange-100 text-orange-800 border-orange-300',
    media: 'bg-amber-100 text-amber-800 border-amber-300',
    baja: 'bg-sky-100 text-sky-800 border-sky-300',
  };

  const statusColors: Record<TicketStatus, string> = {
    nuevo: 'bg-blue-100 text-blue-800',
    en_curso: 'bg-indigo-100 text-indigo-800',
    resuelto: 'bg-emerald-100 text-emerald-800',
    anulado: 'bg-slate-200 text-slate-600',
  };

  const channelIcon: Record<TicketChannel, React.ReactNode> = {
    correo: <Mail className="w-3.5 h-3.5 text-slate-500" />,
    whatsapp: <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />,
    telefono: <Phone className="w-3.5 h-3.5 text-blue-600" />,
    web: <Globe className="w-3.5 h-3.5 text-indigo-600" />,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500">Tickets Activos</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{kpis.totalActive}</p>
          <p className="text-xs text-slate-500 mt-0.5">Nuevos y en curso</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-rose-600">Prioridad Crítica</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-bold text-rose-700 mt-2">{kpis.criticalCount}</p>
          <p className="text-xs text-slate-500 mt-0.5">SLA resolución 2 horas</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-amber-700">Alertas SLA</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-amber-700 mt-2">{kpis.slaAlertCount}</p>
          <p className="text-xs text-slate-500 mt-0.5">En riesgo (&gt;75%) o vencidos</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-emerald-700">Resueltos</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-2">{kpis.resolvedCount}</p>
          <p className="text-xs text-slate-500 mt-0.5">Con solución documentada</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar por N° ticket (TCK-2026-...), asunto o empresa cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 hidden sm:block" />
          <select
            aria-label="Filtrar por estado"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-medium bg-white"
          >
            <option value="todos">Estado: Todos</option>
            <option value="nuevo">Nuevo</option>
            <option value="en_curso">En Curso</option>
            <option value="resuelto">Resuelto</option>
            <option value="anulado">Anulado</option>
          </select>

          <select
            aria-label="Filtrar por prioridad"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as any)}
            className="rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-medium bg-white"
          >
            <option value="todas">Prioridad: Todas</option>
            <option value="critica">Crítica</option>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>

          <select
            aria-label="Filtrar por canal"
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value as any)}
            className="rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-medium bg-white"
          >
            <option value="todos">Canal: Todos</option>
            <option value="correo">Correo</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="telefono">Teléfono</option>
            <option value="web">Web</option>
          </select>

          <select
            aria-label="Filtrar por técnico"
            value={techFilter}
            onChange={(e) => setTechFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-medium bg-white"
          >
            <option value="todos">Técnico: Todos</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-600">
                <th className="py-3 px-4">Ticket</th>
                <th className="py-3 px-4">Cliente / Canal</th>
                <th className="py-3 px-4">Asunto</th>
                <th className="py-3 px-4">Prioridad</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4">Responsable</th>
                <th className="py-3 px-4">Monitor SLA</th>
                <th className="py-3 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-500">
                    No se encontraron tickets con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredTickets.map((t) => {
                  const sla = evaluateSlaStatus(t.created_at, t.sla_due_at, t.status, t.resolved_at);
                  return (
                    <tr
                      key={t.id}
                      onClick={() => onSelectTicket(t)}
                      className="hover:bg-blue-50/40 cursor-pointer transition"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-blue-700 whitespace-nowrap">
                        {t.ticket_code}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900">{t.client?.company_name || 'Cliente'}</p>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5 capitalize">
                          {channelIcon[t.channel]}
                          <span>{t.channel}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <p className="font-medium text-slate-800 truncate">{t.subject}</p>
                        <p className="text-xs text-slate-500">{t.category}</p>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${priorityColors[t.priority]}`}
                        >
                          {t.priority}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase ${statusColors[t.status]}`}
                        >
                          {t.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-700">
                        {t.technician?.full_name || (
                          <span className="text-xs italic text-slate-400">Sin asignar</span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-md text-xs border ${sla.badgeClass}`}>
                          {sla.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTicket(t);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 text-xs font-semibold transition"
                        >
                          <Eye className="w-3.5 h-3.5" /> Gestionar
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
