import React, { useEffect, useState } from 'react';
import {
  X,
  Clock,
  Send,
  Lock,
  Globe,
  CheckCircle,
  Ban,
  AlertCircle,
  UserCheck,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Profile, Ticket, TicketComment, TicketStatus } from '../types/database';
import { evaluateSlaStatus } from '../utils/slaAndMatrix';

interface TicketDetailModalProps {
  ticket: Ticket | null;
  onClose: () => void;
  currentUser: Profile;
  technicians: Profile[];
  onUpdated: () => void;
}

export const TicketDetailModal: React.FC<TicketDetailModalProps> = ({
  ticket,
  onClose,
  currentUser,
  technicians,
  onUpdated,
}) => {
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  const [status, setStatus] = useState<TicketStatus>('nuevo');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [solutionNotes, setSolutionNotes] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isStaff = ['tecnico', 'supervisor', 'admin'].includes(currentUser.role);

  useEffect(() => {
    if (!ticket) return;
    setStatus(ticket.status);
    setAssignedTo(ticket.assigned_to || '');
    setSolutionNotes(ticket.solution_notes || '');
    setCancellationReason(ticket.cancellation_reason || '');
    setError(null);
    loadComments(ticket.id);
  }, [ticket]);

  const loadComments = async (ticketId: string) => {
    const { data } = await supabase
      .from('ticket_comments')
      .select('*, author:profiles(*)')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    if (data) setComments(data as TicketComment[]);
  };

  if (!ticket) return null;

  const slaInfo = evaluateSlaStatus(
    ticket.created_at,
    ticket.sla_due_at,
    ticket.status,
    ticket.resolved_at
  );

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    const { error: err } = await supabase.from('ticket_comments').insert({
      ticket_id: ticket.id,
      author_id: currentUser.id,
      content: newComment.trim(),
      is_internal: isStaff ? isInternal : false,
    });
    if (!err) {
      setNewComment('');
      loadComments(ticket.id);
    }
  };

  const handleSaveChanges = async () => {
    setError(null);

    if (status === 'resuelto' && solutionNotes.trim().length < 10) {
      setError(
        'Para marcar el ticket como RESUELTO es obligatorio registrar la solución técnica aplicada (mínimo 10 caracteres).'
      );
      return;
    }

    if (status === 'anulado' && cancellationReason.trim().length < 5) {
      setError(
        'Los tickets no se eliminan físicamente. Debe indicar un motivo válido para su anulación lógica.'
      );
      return;
    }

    setSaving(true);
    const { error: updErr } = await supabase
      .from('tickets')
      .update({
        status,
        assigned_to: assignedTo || null,
        solution_notes: status === 'resuelto' ? solutionNotes.trim() : ticket.solution_notes,
        cancellation_reason: status === 'anulado' ? cancellationReason.trim() : ticket.cancellation_reason,
      })
      .eq('id', ticket.id);

    setSaving(false);
    if (updErr) {
      setError(updErr.message);
    } else {
      onUpdated();
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-6">
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono font-bold text-blue-400 text-base">{ticket.ticket_code}</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 uppercase">
              Canal: {ticket.channel}
            </span>
            <span className={`text-xs px-2.5 py-0.5 rounded-full border ${slaInfo.badgeClass}`}>
              {slaInfo.label}
            </span>
          </div>
          <button onClick={onClose} aria-label="Cerrar detalle" className="text-slate-300 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 max-h-[82vh] overflow-y-auto">
          <div className="lg:col-span-2 space-y-5">
            <div>
              <span className="text-xs font-semibold uppercase text-blue-600">{ticket.category}</span>
              <h3 className="text-xl font-bold text-slate-900 mt-0.5">{ticket.subject}</h3>
              <p className="text-sm text-slate-600 mt-1">
                Cliente: <strong>{ticket.client?.company_name}</strong> ({ticket.client?.contact_name} ·{' '}
                {ticket.client?.contact_email})
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <h4 className="text-xs font-bold uppercase text-slate-500 mb-1.5">Descripción del Caso</h4>
              <p className="text-sm text-slate-800 whitespace-pre-line">{ticket.description}</p>
            </div>

            <div>
              <h4 className="text-sm font-bold text-slate-800 mb-3">
                Bitácora de Comunicación y Notas Técnicas ({comments.length})
              </h4>

              <div className="space-y-3 max-h-64 overflow-y-auto pr-1 mb-4">
                {comments.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">Aún no existen comentarios en este caso.</p>
                ) : (
                  comments.map((c) => (
                    <div
                      key={c.id}
                      className={`p-3 rounded-xl border text-sm ${
                        c.is_internal
                          ? 'bg-amber-50/80 border-amber-200'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-slate-800">
                          {c.author?.full_name || 'Usuario'}
                        </span>
                        <div className="flex items-center gap-2">
                          {c.is_internal ? (
                            <span className="inline-flex items-center gap-1 text-amber-800 font-medium">
                              <Lock className="w-3 h-3" /> Nota Interna
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-blue-700 font-medium">
                              <Globe className="w-3 h-3" /> Público (Visible cliente)
                            </span>
                          )}
                          <span className="text-slate-400">
                            {new Date(c.created_at).toLocaleString('es-CL')}
                          </span>
                        </div>
                      </div>
                      <p className="text-slate-700 whitespace-pre-line">{c.content}</p>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleAddComment} className="space-y-2">
                <textarea
                  rows={2}
                  placeholder="Escriba una actualización para el cliente o una nota técnica interna..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm"
                />
                <div className="flex items-center justify-between">
                  {isStaff ? (
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isInternal}
                        onChange={(e) => setIsInternal(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      <Lock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Marcar como Nota Interna (oculta al cliente)</span>
                    </label>
                  ) : (
                    <span className="text-xs text-slate-500">Comentario visible para el equipo de soporte</span>
                  )}

                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold"
                  >
                    <Send className="w-3.5 h-3.5" /> Publicar
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
            <h4 className="font-bold text-sm text-slate-900 border-b border-slate-200 pb-2">
              Control Operativo e ITIL
            </h4>

            <div className="text-xs space-y-1 text-slate-600">
              <p className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Creado: {new Date(ticket.created_at).toLocaleString('es-CL')}</span>
              </p>
              <p className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-rose-500" />
                <span>Límite SLA: {new Date(ticket.sla_due_at).toLocaleString('es-CL')}</span>
              </p>
              <p>
                Matriz: <strong className="uppercase">{ticket.impact}</strong> Impacto ×{' '}
                <strong className="uppercase">{ticket.urgency}</strong> Urgencia ={' '}
                <strong className="uppercase text-blue-700">{ticket.priority}</strong>
              </p>
            </div>

            {error && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {isStaff ? (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Responsable Asignado
                  </label>
                  <select
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm bg-white"
                  >
                    <option value="">Sin asignar</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Estado Controlado
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TicketStatus)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm bg-white"
                  >
                    <option value="nuevo">Nuevo</option>
                    <option value="en_curso">En Curso</option>
                    <option value="resuelto">Resuelto (Requiere solución)</option>
                    <option value="anulado">Anulado (Baja lógica)</option>
                  </select>
                </div>

                {status === 'resuelto' && (
                  <div>
                    <label className="block text-xs font-bold text-emerald-800 mb-1">
                      Registro Obligatorio de Solución *
                    </label>
                    <textarea
                      rows={4}
                      required
                      placeholder="Detalle la causa raíz encontrada y la solución aplicada para cerrar el ticket..."
                      value={solutionNotes}
                      onChange={(e) => setSolutionNotes(e.target.value)}
                      className="w-full rounded-lg border border-emerald-300 bg-white p-2.5 text-xs"
                    />
                  </div>
                )}

                {status === 'anulado' && (
                  <div>
                    <label className="block text-xs font-bold text-rose-800 mb-1">
                      Motivo de Anulación Lógica *
                    </label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Ej: Ticket duplicado con TCK-2026-1002..."
                      value={cancellationReason}
                      onChange={(e) => setCancellationReason(e.target.value)}
                      className="w-full rounded-lg border border-rose-300 bg-white p-2.5 text-xs"
                    />
                  </div>
                )}

                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveChanges}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-semibold shadow-sm disabled:opacity-50"
                >
                  {status === 'resuelto' ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : status === 'anulado' ? (
                    <Ban className="w-4 h-4" />
                  ) : (
                    <UserCheck className="w-4 h-4" />
                  )}
                  <span>{saving ? 'Guardando...' : 'Guardar Cambios'}</span>
                </button>
              </>
            ) : (
              ticket.solution_notes && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <p className="text-xs font-bold text-emerald-800 mb-1">Solución Aplicada:</p>
                  <p className="text-xs text-emerald-900">{ticket.solution_notes}</p>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
