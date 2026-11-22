import React, { useState } from 'react';
import {
  X,
  Mail,
  MessageSquare,
  Phone,
  Globe,
  AlertTriangle,
  Upload,
  CheckCircle2,
  UserPlus,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  Client,
  ImpactLevel,
  Profile,
  TicketChannel,
  UrgencyLevel,
} from '../types/database';
import { calculateMatrixPriority, SLA_HOURS } from '../utils/slaAndMatrix';

interface NewTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Profile;
  clients: Client[];
  technicians: Profile[];
  onCreated: () => void;
}

export const NewTicketModal: React.FC<NewTicketModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  clients,
  technicians,
  onCreated,
}) => {
  const [channel, setChannel] = useState<TicketChannel>('correo');
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('existing');
  const [clientId, setClientId] = useState<string>(clients[0]?.id || '');

  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [privacyConsent, setPrivacyConsent] = useState(true);

  const [category, setCategory] = useState('Infraestructura y Redes');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [impact, setImpact] = useState<ImpactLevel>('medio');
  const [urgency, setUrgency] = useState<UrgencyLevel>('media');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const computedPriority = calculateMatrixPriority(impact, urgency);
  const slaSpec = SLA_HOURS[computedPriority];

  const priorityBadge: Record<string, string> = {
    critica: 'bg-rose-600 text-white',
    alta: 'bg-orange-500 text-white',
    media: 'bg-amber-500 text-slate-950',
    baja: 'bg-sky-600 text-white',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let targetClientId = clientId;

      if (clientMode === 'new' || !targetClientId) {
        if (!privacyConsent) {
          throw new Error('Debe confirmar el consentimiento informado (Ley N° 21.719).');
        }
        const { data: newClient, error: clientErr } = await supabase
          .from('clients')
          .insert({
            company_name: companyName.trim(),
            contact_name: contactName.trim(),
            contact_email: contactEmail.trim(),
            contact_phone: contactPhone.trim() || null,
            privacy_consent: privacyConsent,
          })
          .select()
          .single();

        if (clientErr) throw clientErr;
        targetClientId = newClient.id;
      }

      const { data: ticket, error: ticketErr } = await supabase
        .from('tickets')
        .insert({
          client_id: targetClientId,
          created_by: currentUser.id,
          assigned_to: assignedTo || null,
          channel,
          category,
          subject: subject.trim(),
          description: description.trim(),
          impact,
          urgency,
          priority: computedPriority,
          status: 'nuevo',
        })
        .select()
        .single();

      if (ticketErr) throw ticketErr;

      if (attachment && ticket) {
        const cleanName = attachment.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${ticket.id}/${Date.now()}_${cleanName}`;
        const { error: uploadErr } = await supabase.storage
          .from('ticket-attachments')
          .upload(path, attachment);

        if (!uploadErr) {
          await supabase.from('ticket_attachments').insert({
            ticket_id: ticket.id,
            uploaded_by: currentUser.id,
            file_name: attachment.name,
            file_path: path,
            file_size_bytes: attachment.size,
            mime_type: attachment.type || 'application/octet-stream',
          });
        }
      }

      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al registrar el ticket.');
    } finally {
      setLoading(false);
    }
  };

  const channels: { id: TicketChannel; label: string; icon: React.ReactNode }[] = [
    { id: 'correo', label: 'Correo Electrónico', icon: <Mail className="w-4 h-4" /> },
    { id: 'whatsapp', label: 'WhatsApp', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'telefono', label: 'Llamada Telefónica', icon: <Phone className="w-4 h-4" /> },
    { id: 'web', label: 'Formulario Web', icon: <Globe className="w-4 h-4" /> },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-new-ticket-title"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-8">
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 id="modal-new-ticket-title" className="text-lg font-bold">
              Nuevo Ticket de Soporte
            </h2>
            <p className="text-xs text-slate-300">
              Registro centralizado multicanal con cálculo automático de SLA e Impacto × Urgencia
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar formulario"
            className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Canal de Origen de la Solicitud
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {channels.map((ch) => (
                <button
                  type="button"
                  key={ch.id}
                  onClick={() => setChannel(ch.id)}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs sm:text-sm font-medium transition ${
                    channel === ch.id
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {ch.icon}
                  <span>{ch.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-800">Cliente / Empresa Solicitante</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setClientMode('existing')}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium ${
                    clientMode === 'existing'
                      ? 'bg-slate-800 text-white'
                      : 'bg-white text-slate-600 border border-slate-300'
                  }`}
                >
                  Cliente Registrado
                </button>
                <button
                  type="button"
                  onClick={() => setClientMode('new')}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium flex items-center gap-1 ${
                    clientMode === 'new'
                      ? 'bg-slate-800 text-white'
                      : 'bg-white text-slate-600 border border-slate-300'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" /> Nuevo Cliente
                </button>
              </div>
            </div>

            {clientMode === 'existing' && clients.length > 0 ? (
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name} — {c.contact_name} ({c.contact_email})
                  </option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Empresa / Organización *"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  required
                  placeholder="Nombre del contacto *"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="email"
                  required
                  placeholder="Correo electrónico *"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="tel"
                  placeholder="Teléfono / WhatsApp (+56 9 ...)"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <label className="sm:col-span-2 flex items-start gap-2 text-xs text-slate-600 mt-1">
                  <input
                    type="checkbox"
                    checked={privacyConsent}
                    onChange={(e) => setPrivacyConsent(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300"
                    required
                  />
                  <span>
                    El cliente autoriza el tratamiento de sus datos de contacto exclusivamente para la gestión
                    y trazabilidad del soporte técnico (Ley N° 21.719 de Protección de Datos Personales).
                  </span>
                </label>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Categoría TI</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option>Infraestructura y Redes</option>
                <option>Servidores y Cloud</option>
                <option>Software y Aplicaciones</option>
                <option>Hardware y Puestos de Trabajo</option>
                <option>Accesos, Cuentas y Ciberseguridad</option>
                <option>Correo y Colaboración</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Asunto del Incidente *</label>
              <input
                type="text"
                required
                minLength={5}
                placeholder="Ej: Caída de enlace VPN en sucursal central"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Descripción Detallada del Problema *
            </label>
            <textarea
              required
              minLength={10}
              rows={3}
              placeholder="Describa síntomas, usuarios afectados, mensajes de error y acciones previas..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Impacto en el Negocio
                </label>
                <select
                  value={impact}
                  onChange={(e) => setImpact(e.target.value as ImpactLevel)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="alto">Alto (Empresa / Área detenida)</option>
                  <option value="medio">Medio (Grupo de usuarios)</option>
                  <option value="bajo">Bajo (Usuario individual)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Urgencia Operativa
                </label>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as UrgencyLevel)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="alta">Alta (Sin alternativa operativa)</option>
                  <option value="media">Media (Con alternativa temporal)</option>
                  <option value="baja">Baja (Puede programarse)</option>
                </select>
              </div>

              <div className="bg-white rounded-lg p-3 border border-blue-200 text-center">
                <span className="text-[11px] uppercase font-semibold text-slate-500 block">
                  Prioridad Resultante
                </span>
                <span
                  className={`inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-bold uppercase ${priorityBadge[computedPriority]}`}
                >
                  {computedPriority}
                </span>
                <span className="block text-[11px] text-slate-600 mt-1">
                  SLA Resolución: <strong>{slaSpec.resolutionHours}h</strong> (1ª resp: {slaSpec.responseMin}m)
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Técnico Responsable
              </label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="">Asignación Automática (Balanceo por menor carga)</option>
                {technicians.map((tech) => (
                  <option key={tech.id} value={tech.id}>
                    {tech.full_name} ({tech.department})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Evidencia / Archivo Adjunto (Opcional)
              </label>
              <label className="flex items-center justify-center gap-2 border border-dashed border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 cursor-pointer">
                <Upload className="w-4 h-4 text-blue-600" />
                <span className="truncate">{attachment ? attachment.name : 'Subir captura, log o PDF'}</span>
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                />
              </label>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? 'Registrando Ticket...' : 'Crear y Asignar Ticket'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
