import React, { useState } from 'react';
import {
  Headphones,
  Inbox,
  PlusCircle,
  BarChart3,
  ShieldCheck,
  Bell,
  LogOut,
  CheckCheck,
} from 'lucide-react';
import { AppNotification, Profile } from '../types/database';

interface NavbarProps {
  profile: Profile;
  activeTab: 'inbox' | 'dashboard' | 'admin';
  setActiveTab: (tab: 'inbox' | 'dashboard' | 'admin') => void;
  onOpenNewTicket: () => void;
  notifications: AppNotification[];
  onMarkAllRead: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  profile,
  activeTab,
  setActiveTab,
  onOpenNewTicket,
  notifications,
  onMarkAllRead,
  onLogout,
}) => {
  const [showNotif, setShowNotif] = useState(false);
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <header className="sticky top-0 z-30 bg-slate-900 text-white border-b border-slate-800 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Headphones className="w-5 h-5 text-white" aria-hidden="true" />
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight">CoreDesk TI</span>
            <span className="hidden sm:inline-block ml-2 text-xs bg-slate-800 text-blue-300 px-2 py-0.5 rounded border border-slate-700">
              ITSM · ISO 27001
            </span>
          </div>
        </div>

        <nav aria-label="Navegación principal" className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setActiveTab('inbox')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'inbox'
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Inbox className="w-4 h-4" />
            <span>Bandeja</span>
          </button>

          {['tecnico', 'supervisor', 'admin'].includes(profile.role) && (
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === 'dashboard'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden md:inline">Reportes SLA</span>
            </button>
          )}

          {['supervisor', 'admin'].includes(profile.role) && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === 'admin'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span className="hidden md:inline">Seguridad y RBAC</span>
            </button>
          )}

          <button
            onClick={onOpenNewTicket}
            className="ml-1 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-lg text-sm font-semibold shadow-sm transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nuevo Ticket</span>
          </button>
        </nav>

        <div className="flex items-center gap-3 relative">
          <button
            onClick={() => setShowNotif(!showNotif)}
            aria-label="Notificaciones y alertas SLA"
            className="relative p-2 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-rose-600 text-white text-[11px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotif && (
            <div className="absolute right-12 top-12 w-80 sm:w-96 bg-white text-slate-900 rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="font-semibold text-sm">Alertas y Notificaciones</span>
                {unreadCount > 0 && (
                  <button
                    onClick={onMarkAllRead}
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <CheckCheck className="w-3.5 h-3.5" /> Marcar leídas
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <p className="p-4 text-sm text-slate-500 text-center">Sin notificaciones recientes.</p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-3 text-sm ${n.is_read ? 'bg-white' : 'bg-blue-50/60'}`}
                    >
                      <p className="font-semibold text-slate-800">{n.title}</p>
                      <p className="text-slate-600 text-xs mt-0.5">{n.message}</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {new Date(n.created_at).toLocaleString('es-CL')}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="hidden lg:block text-right leading-tight">
            <p className="text-sm font-medium">{profile.full_name}</p>
            <p className="text-xs text-slate-400 uppercase">{profile.role}</p>
          </div>

          <button
            onClick={onLogout}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            className="p-2 rounded-lg text-slate-300 hover:bg-rose-600/20 hover:text-rose-400 transition"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
