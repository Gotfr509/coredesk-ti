export type UserRole = 'cliente' | 'tecnico' | 'supervisor' | 'admin';
export type TicketChannel = 'correo' | 'whatsapp' | 'telefono' | 'web';
export type ImpactLevel = 'alto' | 'medio' | 'bajo';
export type UrgencyLevel = 'alta' | 'media' | 'baja';
export type TicketPriority = 'critica' | 'alta' | 'media' | 'baja';
export type TicketStatus = 'nuevo' | 'en_curso' | 'resuelto' | 'anulado';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  department: string;
  is_active: boolean;
  mfa_enforced: boolean;
  created_at: string;
}

export interface Client {
  id: string;
  user_id: string | null;
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  privacy_consent: boolean;
  created_at: string;
}

export interface Ticket {
  id: string;
  ticket_code: string;
  client_id: string;
  created_by: string | null;
  assigned_to: string | null;
  channel: TicketChannel;
  category: string;
  subject: string;
  description: string;
  impact: ImpactLevel;
  urgency: UrgencyLevel;
  priority: TicketPriority;
  status: TicketStatus;
  solution_notes: string | null;
  cancellation_reason: string | null;
  sla_response_due_at: string;
  sla_due_at: string;
  first_responded_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  client?: Client;
  technician?: Profile;
}

export interface TicketComment {
  id: string;
  ticket_id: string;
  author_id: string;
  content: string;
  is_internal: boolean;
  created_at: string;
  author?: Profile;
}

export interface AppNotification {
  id: string;
  recipient_id: string;
  ticket_id: string | null;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: number;
  occurred_at: string;
  actor_email: string | null;
  action: string;
  entity_name: string;
  entity_id: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
}
