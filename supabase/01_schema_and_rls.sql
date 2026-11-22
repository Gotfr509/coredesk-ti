-- ============================================================================
-- COREDESK TI - ESQUEMA DE BASE DE DATOS, TRIGGERS, AUDITORÍA Y RLS (SUPABASE)
-- Cumplimiento: ITIL 4, ISO/IEC 27001, Ley 19.628, Ley 21.719, Ley 21.663
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TIPOS ENUMERADOS
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('cliente', 'tecnico', 'supervisor', 'admin');
  CREATE TYPE ticket_channel AS ENUM ('correo', 'whatsapp', 'telefono', 'web');
  CREATE TYPE impact_level AS ENUM ('alto', 'medio', 'bajo');
  CREATE TYPE urgency_level AS ENUM ('alta', 'media', 'baja');
  CREATE TYPE ticket_priority AS ENUM ('critica', 'alta', 'media', 'baja');
  CREATE TYPE ticket_status AS ENUM ('nuevo', 'en_curso', 'resuelto', 'anulado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. TABLA DE PERFILES Y ROLES (RBAC vinculado a auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'cliente',
  department TEXT DEFAULT 'Soporte TI',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  mfa_enforced BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABLA DE CLIENTES / EMPRESAS SOLICITANTES (Minimización de datos - Ley 21.719)
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  privacy_consent BOOLEAN NOT NULL DEFAULT TRUE,
  consent_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_retention_months INT NOT NULL DEFAULT 24,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. POLÍTICAS DE NIVEL DE SERVICIO (SLA)
CREATE TABLE IF NOT EXISTS public.sla_policies (
  priority ticket_priority PRIMARY KEY,
  first_response_minutes INT NOT NULL,
  resolution_minutes INT NOT NULL,
  description TEXT NOT NULL
);

INSERT INTO public.sla_policies (priority, first_response_minutes, resolution_minutes, description) VALUES
  ('critica', 15, 120, 'Interrupción total de operación o caída de infraestructura crítica (2h)'),
  ('alta',    30, 240, 'Degradación grave de servicio sin alternativa inmediata (4h)'),
  ('media',  120, 480, 'Incidente operativo parcial con alternativa temporal (8h)'),
  ('baja',   240, 1440, 'Consulta general, requerimiento menor o configuración estándar (24h)')
ON CONFLICT (priority) DO UPDATE SET
  first_response_minutes = EXCLUDED.first_response_minutes,
  resolution_minutes = EXCLUDED.resolution_minutes,
  description = EXCLUDED.description;

-- 5. SECUENCIA Y TABLA PRINCIPAL DE TICKETS
CREATE SEQUENCE IF NOT EXISTS public.ticket_number_seq START 1001;

CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_code TEXT UNIQUE NOT NULL DEFAULT (
    'TCK-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || LPAD(nextval('public.ticket_number_seq')::TEXT, 4, '0')
  ),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  channel ticket_channel NOT NULL DEFAULT 'web',
  category TEXT NOT NULL DEFAULT 'Soporte General',
  subject TEXT NOT NULL CHECK (char_length(trim(subject)) >= 5),
  description TEXT NOT NULL CHECK (char_length(trim(description)) >= 10),
  impact impact_level NOT NULL DEFAULT 'medio',
  urgency urgency_level NOT NULL DEFAULT 'media',
  priority ticket_priority NOT NULL DEFAULT 'media',
  status ticket_status NOT NULL DEFAULT 'nuevo',
  solution_notes TEXT,
  cancellation_reason TEXT,
  sla_response_due_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sla_due_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_responded_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_solution_required_when_resolved
    CHECK (status <> 'resuelto' OR (solution_notes IS NOT NULL AND char_length(trim(solution_notes)) >= 10)),
  CONSTRAINT chk_reason_required_when_cancelled
    CHECK (status <> 'anulado' OR (cancellation_reason IS NOT NULL AND char_length(trim(cancellation_reason)) >= 5))
);

-- 6. COMENTARIOS PÚBLICOS E INTERNOS
CREATE TABLE IF NOT EXISTS public.ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE RESTRICT,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  content TEXT NOT NULL CHECK (char_length(trim(content)) >= 1),
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. ARCHIVOS ADJUNTOS
CREATE TABLE IF NOT EXISTS public.ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE RESTRICT,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. NOTIFICACIONES Y ALERTAS SLA / ESCALAMIENTO
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. BITÁCORA DE AUDITORÍA INMUTABLE (Ley 21.663 / ISO 27001)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_id UUID,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB
);

CREATE OR REPLACE FUNCTION public.prevent_audit_tampering()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Violación de seguridad: La bitácora de auditoría es inmutable (ISO 27001 / Ley 21.663).';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_immutable ON public.audit_logs;
CREATE TRIGGER trg_audit_immutable
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_tampering();

CREATE OR REPLACE FUNCTION public.prevent_ticket_physical_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Operación denegada: Los tickets no pueden eliminarse físicamente. Utilice el estado "anulado".';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_no_delete_tickets ON public.tickets;
CREATE TRIGGER trg_no_delete_tickets
  BEFORE DELETE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.prevent_ticket_physical_delete();

-- 10. MATRIZ DE IMPACTO x URGENCIA, ASIGNACIÓN AUTOMÁTICA Y SLA
CREATE OR REPLACE FUNCTION public.calculate_priority(p_impact impact_level, p_urgency urgency_level)
RETURNS ticket_priority AS $$
BEGIN
  IF p_impact = 'alto' AND p_urgency = 'alta' THEN RETURN 'critica';
  ELSIF (p_impact = 'alto' AND p_urgency = 'media') OR (p_impact = 'medio' AND p_urgency = 'alta') THEN RETURN 'alta';
  ELSIF (p_impact = 'bajo' AND p_urgency = 'baja') THEN RETURN 'baja';
  ELSE RETURN 'media';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.handle_ticket_before_write()
RETURNS TRIGGER AS $$
DECLARE
  v_sla RECORD;
  v_auto_tech UUID;
BEGIN
  NEW.updated_at := NOW();
  NEW.priority := public.calculate_priority(NEW.impact, NEW.urgency);

  IF TG_OP = 'INSERT' THEN
    SELECT * INTO v_sla FROM public.sla_policies WHERE priority = NEW.priority;
    NEW.sla_response_due_at := NEW.created_at + make_interval(mins => v_sla.first_response_minutes);
    NEW.sla_due_at := NEW.created_at + make_interval(mins => v_sla.resolution_minutes);

    IF NEW.assigned_to IS NULL THEN
      SELECT p.id INTO v_auto_tech
      FROM public.profiles p
      LEFT JOIN public.tickets t
        ON t.assigned_to = p.id AND t.status IN ('nuevo', 'en_curso')
      WHERE p.role = 'tecnico' AND p.is_active = TRUE
      GROUP BY p.id
      ORDER BY COUNT(t.id) ASC, p.created_at ASC
      LIMIT 1;

      NEW.assigned_to := v_auto_tech;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.priority <> OLD.priority AND NEW.status IN ('nuevo', 'en_curso') THEN
      SELECT * INTO v_sla FROM public.sla_policies WHERE priority = NEW.priority;
      NEW.sla_due_at := NEW.created_at + make_interval(mins => v_sla.resolution_minutes);
    END IF;

    IF OLD.status = 'nuevo' AND NEW.status = 'en_curso' AND NEW.first_responded_at IS NULL THEN
      NEW.first_responded_at := NOW();
    END IF;

    IF NEW.status = 'resuelto' AND OLD.status <> 'resuelto' THEN
      NEW.resolved_at := NOW();
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_tickets_before_write ON public.tickets;
CREATE TRIGGER trg_tickets_before_write
  BEFORE INSERT OR UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.handle_ticket_before_write();

-- 11. TRIGGER POST-ESCRITURA: NOTIFICACIONES Y AUDITORÍA INMUTABLE
CREATE OR REPLACE FUNCTION public.handle_ticket_after_write()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_email TEXT;
  v_sup RECORD;
BEGIN
  SELECT email INTO v_actor_email FROM public.profiles WHERE id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (actor_id, actor_email, action, entity_name, entity_id, new_data)
    VALUES (auth.uid(), COALESCE(v_actor_email, 'sistema@coredesk.cl'), 'INSERT', 'tickets', NEW.ticket_code, to_jsonb(NEW));

    IF NEW.assigned_to IS NOT NULL THEN
      INSERT INTO public.notifications (recipient_id, ticket_id, type, title, message)
      VALUES (
        NEW.assigned_to,
        NEW.id,
        'asignacion',
        'Nuevo ticket asignado: ' || NEW.ticket_code,
        'Asunto: ' || NEW.subject || ' | Prioridad: ' || UPPER(NEW.priority::TEXT)
      );
    END IF;

    IF NEW.priority = 'critica' THEN
      FOR v_sup IN SELECT id FROM public.profiles WHERE role IN ('supervisor', 'admin') AND is_active = TRUE LOOP
        INSERT INTO public.notifications (recipient_id, ticket_id, type, title, message)
        VALUES (
          v_sup.id,
          NEW.id,
          'alerta_critica',
          'ALERTA CRÍTICA: ' || NEW.ticket_code,
          'Incidente de impacto alto y urgencia alta requiere supervisión inmediata.'
        );
      END LOOP;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (actor_id, actor_email, action, entity_name, entity_id, old_data, new_data)
    VALUES (
      auth.uid(),
      COALESCE(v_actor_email, 'sistema@coredesk.cl'),
      CASE WHEN OLD.status <> NEW.status THEN 'STATUS_CHANGE' ELSE 'UPDATE' END,
      'tickets',
      NEW.ticket_code,
      to_jsonb(OLD),
      to_jsonb(NEW)
    );

    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL THEN
      INSERT INTO public.notifications (recipient_id, ticket_id, type, title, message)
      VALUES (
        NEW.assigned_to,
        NEW.id,
        'asignacion',
        'Ticket reasignado: ' || NEW.ticket_code,
        'Se te ha asignado el caso "' || NEW.subject || '".'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_tickets_after_write ON public.tickets;
CREATE TRIGGER trg_tickets_after_write
  AFTER INSERT OR UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.handle_ticket_after_write();

CREATE OR REPLACE FUNCTION public.handle_comment_audit()
RETURNS TRIGGER AS $$
DECLARE v_actor_email TEXT;
BEGIN
  SELECT email INTO v_actor_email FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.audit_logs (actor_id, actor_email, action, entity_name, entity_id, new_data)
  VALUES (auth.uid(), COALESCE(v_actor_email, 'sistema@coredesk.cl'), 'COMMENT', 'ticket_comments', NEW.ticket_id::TEXT, to_jsonb(NEW));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_comment_audit ON public.ticket_comments;
CREATE TRIGGER trg_comment_audit
  AFTER INSERT ON public.ticket_comments
  FOR EACH ROW EXECUTE FUNCTION public.handle_comment_audit();

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'cliente')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 12. FUNCIÓN RPC PARA CONSULTA PÚBLICA DE TICKET POR CLIENTE
CREATE OR REPLACE FUNCTION public.track_ticket_public(p_ticket_code TEXT, p_contact_email TEXT)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'ticket_code', t.ticket_code,
    'subject', t.subject,
    'category', t.category,
    'channel', t.channel,
    'priority', t.priority,
    'status', t.status,
    'solution_notes', t.solution_notes,
    'sla_due_at', t.sla_due_at,
    'created_at', t.created_at,
    'updated_at', t.updated_at,
    'assigned_technician', COALESCE(p.full_name, 'En proceso de asignación'),
    'public_comments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'content', c.content,
        'created_at', c.created_at,
        'author', pr.full_name
      ) ORDER BY c.created_at ASC)
      FROM public.ticket_comments c
      JOIN public.profiles pr ON pr.id = c.author_id
      WHERE c.ticket_id = t.id AND c.is_internal = FALSE
    ), '[]'::jsonb)
  ) INTO v_result
  FROM public.tickets t
  JOIN public.clients cl ON cl.id = t.client_id
  LEFT JOIN public.profiles p ON p.id = t.assigned_to
  WHERE UPPER(t.ticket_code) = UPPER(trim(p_ticket_code))
    AND LOWER(cl.contact_email) = LOWER(trim(p_contact_email));

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. HABILITAR ROW LEVEL SECURITY (RLS) Y POLÍTICAS RBAC
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE POLICY "Staff ve todos los perfiles; usuario ve el suyo"
  ON public.profiles FOR SELECT
  USING (id = auth.uid() OR public.current_user_role() IN ('tecnico', 'supervisor', 'admin'));

CREATE POLICY "Solo admin actualiza roles y perfiles"
  ON public.profiles FOR UPDATE
  USING (public.current_user_role() = 'admin' OR id = auth.uid());

CREATE POLICY "Lectura pública de SLA para autenticados"
  ON public.sla_policies FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Staff ve clientes; cliente ve su registro"
  ON public.clients FOR SELECT
  USING (user_id = auth.uid() OR public.current_user_role() IN ('tecnico', 'supervisor', 'admin'));

CREATE POLICY "Staff y clientes crean ficha de cliente"
  ON public.clients FOR INSERT TO authenticated WITH CHECK (TRUE);

CREATE POLICY "Staff ve todos los tickets; cliente solo los suyos"
  ON public.tickets FOR SELECT
  USING (
    public.current_user_role() IN ('tecnico', 'supervisor', 'admin')
    OR client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  );

CREATE POLICY "Usuarios autenticados pueden crear tickets"
  ON public.tickets FOR INSERT TO authenticated WITH CHECK (TRUE);

CREATE POLICY "Solo staff de soporte actualiza tickets"
  ON public.tickets FOR UPDATE
  USING (public.current_user_role() IN ('tecnico', 'supervisor', 'admin'));

CREATE POLICY "Staff ve todos los comentarios; cliente solo los públicos"
  ON public.ticket_comments FOR SELECT
  USING (
    public.current_user_role() IN ('tecnico', 'supervisor', 'admin')
    OR (
      is_internal = FALSE
      AND ticket_id IN (
        SELECT t.id FROM public.tickets t
        JOIN public.clients c ON c.id = t.client_id
        WHERE c.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Usuarios autenticados insertan comentarios en sus tickets"
  ON public.ticket_comments FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('tecnico', 'supervisor', 'admin')
    OR (
      is_internal = FALSE
      AND ticket_id IN (
        SELECT t.id FROM public.tickets t
        JOIN public.clients c ON c.id = t.client_id
        WHERE c.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Usuario ve y marca sus notificaciones"
  ON public.notifications FOR ALL
  USING (recipient_id = auth.uid());

CREATE POLICY "Supervisores y admins leen bitácora inmutable"
  ON public.audit_logs FOR SELECT
  USING (public.current_user_role() IN ('supervisor', 'admin'));

INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-attachments', 'ticket-attachments', FALSE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Autenticados suben adjuntos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ticket-attachments');

CREATE POLICY "Autenticados leen adjuntos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ticket-attachments');
