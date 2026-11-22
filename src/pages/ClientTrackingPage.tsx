import React, { useState } from 'react';
import { ArrowLeft, Search, CheckCircle2, Clock, Headphones } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ClientTrackingPageProps {
  onBackToLogin: () => void;
}

export const ClientTrackingPage: React.FC<ClientTrackingPageProps> = ({ onBackToLogin }) => {
  const [ticketCode, setTicketCode] = useState('');
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setNotFound(false);
    setResult(null);

    const { data, error } = await supabase.rpc('track_ticket_public', {
      p_ticket_code: ticketCode,
      p_contact_email: email,
    });

    setLoading(false);
    if (error || !data) {
      setNotFound(true);
    } else {
      setResult(data);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Headphones className="w-5 h-5 text-blue-400" />
            <span className="font-bold">CoreDesk TI — Portal de Consulta de Clientes</span>
          </div>
          <button
            onClick={onBackToLogin}
            className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" /> Volver al Login
          </button>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-sm text-slate-600">
            Ingrese su número de ticket y correo electrónico registrado para conocer el estado en tiempo real,
            el técnico responsable y las actualizaciones públicas de su caso.
          </p>

          <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              placeholder="N° Ticket (Ej: TCK-2026-1001)"
              value={ticketCode}
              onChange={(e) => setTicketCode(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-mono uppercase"
            />
            <input
              type="email"
              required
              placeholder="Correo registrado"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            />
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold"
            >
              <Search className="w-4 h-4" />
              <span>{loading ? 'Buscando...' : 'Consultar'}</span>
            </button>
          </form>

          {notFound && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
              No se encontró ningún ticket asociado a esa combinación de código y correo electrónico.
            </div>
          )}

          {result && (
            <div className="border border-slate-200 rounded-xl p-5 bg-slate-50 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div>
                  <span className="font-mono font-bold text-blue-700 text-lg">{result.ticket_code}</span>
                  <h3 className="font-bold text-slate-900">{result.subject}</h3>
                </div>
                <span className="px-3 py-1 rounded-full bg-blue-600 text-white text-xs font-bold uppercase">
                  Estado: {String(result.status).replace('_', ' ')}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700">
                <p>
                  <strong>Técnico Responsable:</strong> {result.assigned_technician}
                </p>
                <p>
                  <strong>Prioridad Asignada:</strong>{' '}
                  <span className="uppercase">{result.priority}</span>
                </p>
                <p className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Ingresado: {new Date(result.created_at).toLocaleString('es-CL')}</span>
                </p>
                <p className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  <span>Compromiso SLA: {new Date(result.sla_due_at).toLocaleString('es-CL')}</span>
                </p>
              </div>

              {result.solution_notes && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                  <p className="font-bold flex items-center gap-1 mb-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Solución Aplicada:
                  </p>
                  <p>{result.solution_notes}</p>
                </div>
              )}

              <div>
                <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">
                  Actualizaciones del Equipo de Soporte
                </h4>
                {result.public_comments?.length === 0 ? (
                  <p className="text-xs text-slate-500">Sin mensajes adicionales registrados aún.</p>
                ) : (
                  <div className="space-y-2">
                    {result.public_comments.map((c: any, idx: number) => (
                      <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 text-xs">
                        <div className="flex justify-between text-slate-500 mb-1">
                          <strong>{c.author}</strong>
                          <span>{new Date(c.created_at).toLocaleString('es-CL')}</span>
                        </div>
                        <p className="text-slate-800">{c.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
