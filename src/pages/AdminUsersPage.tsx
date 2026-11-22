import React, { useEffect, useState } from 'react';
import { ShieldCheck, KeyRound, History, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AuditLog, Profile, UserRole } from '../types/database';

interface AdminUsersPageProps {
  currentUser: Profile;
}

export const AdminUsersPage: React.FC<AdminUsersPageProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [mfaQr, setMfaQr] = useState<string | null>(null);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [mfaSuccess, setMfaSuccess] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });
    if (profilesData) setUsers(profilesData as Profile[]);

    const { data: logsData } = await supabase
      .from('audit_logs')
      .select('*')
      .order('id', { ascending: false })
      .limit(25);
    if (logsData) setAuditLogs(logsData as AuditLog[]);
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (currentUser.role !== 'admin') return;
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    loadData();
  };

  const handleEnrollMfa = async () => {
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    if (!error && data) {
      setMfaFactorId(data.id);
      setMfaQr(data.totp.qr_code);
    }
  };

  const handleConfirmMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaFactorId) return;
    const { data: ch } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
    if (!ch) return;
    const { error } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId,
      challengeId: ch.id,
      code: verifyCode,
    });
    if (!error) {
      setMfaSuccess(true);
      setMfaQr(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-slate-900">Control de Acceso Basado en Roles (RBAC)</h2>
          </div>
          <span className="text-xs text-slate-500">ISO/IEC 27001 · Ley N° 21.719</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-600">
              <tr>
                <th className="py-3 px-4">Usuario</th>
                <th className="py-3 px-4">Correo</th>
                <th className="py-3 px-4">Departamento</th>
                <th className="py-3 px-4">Rol RBAC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="py-3 px-4 font-medium text-slate-900">{u.full_name}</td>
                  <td className="py-3 px-4 text-slate-600">{u.email}</td>
                  <td className="py-3 px-4 text-slate-600">{u.department}</td>
                  <td className="py-3 px-4">
                    <select
                      disabled={currentUser.role !== 'admin'}
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                      className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold uppercase bg-white"
                    >
                      <option value="cliente">Cliente</option>
                      <option value="tecnico">Técnico</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <KeyRound className="w-6 h-6 text-emerald-600" />
            <div>
              <h3 className="font-bold text-slate-900">Autenticación Multifactor (MFA TOTP)</h3>
              <p className="text-xs text-slate-500">
                Obligatoria para administradores y supervisores según políticas de seguridad de la información.
              </p>
            </div>
          </div>

          {!mfaQr && !mfaSuccess && (
            <button
              onClick={handleEnrollMfa}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
            >
              Activar MFA en mi Cuenta
            </button>
          )}
        </div>

        {mfaSuccess && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>MFA TOTP activado correctamente en su cuenta.</span>
          </div>
        )}

        {mfaQr && (
          <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center gap-6">
            <img src={mfaQr} alt="Código QR MFA" className="w-36 h-36 bg-white p-2 rounded-lg border" />
            <form onSubmit={handleConfirmMfa} className="space-y-3">
              <p className="text-xs text-slate-700">
                1. Escanee el código QR con Google Authenticator o Microsoft Authenticator.
                <br />
                2. Ingrese el código de 6 dígitos generado para confirmar:
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={6}
                  required
                  placeholder="123456"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-sm w-32"
                />
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900">Bitácora de Auditoría Inmutable</h3>
          </div>
          <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-medium">
            Protegida contra UPDATE/DELETE (Ley 21.663)
          </span>
        </div>

        <div className="overflow-x-auto max-h-80">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 uppercase text-slate-600">
              <tr>
                <th className="py-2.5 px-4">Fecha / Hora</th>
                <th className="py-2.5 px-4">Actor</th>
                <th className="py-2.5 px-4">Acción</th>
                <th className="py-2.5 px-4">Entidad</th>
                <th className="py-2.5 px-4">Identificador</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td className="py-2.5 px-4 whitespace-nowrap text-slate-500">
                    {new Date(log.occurred_at).toLocaleString('es-CL')}
                  </td>
                  <td className="py-2.5 px-4 font-medium text-slate-800">{log.actor_email}</td>
                  <td className="py-2.5 px-4 font-mono text-blue-700">{log.action}</td>
                  <td className="py-2.5 px-4 text-slate-600">{log.entity_name}</td>
                  <td className="py-2.5 px-4 font-mono text-slate-800">{log.entity_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
