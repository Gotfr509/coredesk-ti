import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { AppNotification, Client, Profile, Ticket } from './types/database';
import { LoginPage } from './pages/LoginPage';
import { ClientTrackingPage } from './pages/ClientTrackingPage';
import { Navbar } from './components/Navbar';
import { TicketInboxPage } from './pages/TicketInboxPage';
import { DashboardReportsPage } from './pages/DashboardReportsPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { NewTicketModal } from './components/NewTicketModal';
import { TicketDetailModal } from './components/TicketDetailModal';

export function App() {
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [publicTrackingMode, setPublicTrackingMode] = useState(false);

  const [activeTab, setActiveTab] = useState<'inbox' | 'dashboard' | 'admin'>('inbox');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [technicians, setTechnicians] = useState<Profile[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [loadingApp, setLoadingApp] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessionUserId(data.session?.user?.id || null);
      setLoadingApp(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUserId(session?.user?.id || null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sessionUserId) {
      setProfile(null);
      return;
    }
    loadAllWorkspaceData(sessionUserId);

    const channel = supabase
      .channel('coredesk-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
        loadTickets();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        loadNotifications(sessionUserId);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionUserId]);

  const loadAllWorkspaceData = async (uid: string) => {
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', uid).single();
    if (prof) setProfile(prof as Profile);

    await Promise.all([loadTickets(), loadClients(), loadTechnicians(), loadNotifications(uid)]);
  };

  const loadTickets = async () => {
    const { data } = await supabase
      .from('tickets')
      .select('*, client:clients(*), technician:profiles!tickets_assigned_to_fkey(*)')
      .order('created_at', { ascending: false });
    if (data) setTickets(data as Ticket[]);
  };

  const loadClients = async () => {
    const { data } = await supabase.from('clients').select('*').order('company_name');
    if (data) setClients(data as Client[]);
  };

  const loadTechnicians = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['tecnico', 'supervisor'])
      .eq('is_active', true);
    if (data) setTechnicians(data as Profile[]);
  };

  const loadNotifications = async (uid: string) => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', uid)
      .order('created_at', { ascending: false })
      .limit(15);
    if (data) setNotifications(data as AppNotification[]);
  };

  const handleMarkAllRead = async () => {
    if (!sessionUserId) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', sessionUserId)
      .eq('is_read', false);
    loadNotifications(sessionUserId);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loadingApp) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600 text-sm">
        Cargando CoreDesk TI...
      </div>
    );
  }

  if (!sessionUserId || !profile) {
    if (publicTrackingMode) {
      return <ClientTrackingPage onBackToLogin={() => setPublicTrackingMode(false)} />;
    }
    return <LoginPage onOpenPublicTracker={() => setPublicTrackingMode(true)} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <Navbar
        profile={profile}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenNewTicket={() => setIsNewTicketOpen(true)}
        notifications={notifications}
        onMarkAllRead={handleMarkAllRead}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'inbox' && (
          <TicketInboxPage
            tickets={tickets}
            technicians={technicians}
            onSelectTicket={(t) => setSelectedTicket(t)}
          />
        )}

        {activeTab === 'dashboard' && (
          <DashboardReportsPage tickets={tickets} technicians={technicians} />
        )}

        {activeTab === 'admin' && <AdminUsersPage currentUser={profile} />}
      </main>

      <NewTicketModal
        isOpen={isNewTicketOpen}
        onClose={() => setIsNewTicketOpen(false)}
        currentUser={profile}
        clients={clients}
        technicians={technicians}
        onCreated={() => {
          loadTickets();
          loadClients();
        }}
      />

      <TicketDetailModal
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        currentUser={profile}
        technicians={technicians}
        onUpdated={() => loadTickets()}
      />
    </div>
  );
}

export default App;
