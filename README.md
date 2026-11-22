# CoreDesk TI — Sistema Web de Gestión de Tickets de Soporte Informático

Sistema web centralizado de gestión de tickets de soporte TI desarrollado con **React 18 + TypeScript + Vite + Tailwind CSS** y **Supabase (PostgreSQL, Auth + MFA, Row Level Security, Storage y Realtime)**.

## Funcionalidades Principales
- **Unificación Multicanal:** Registro único correlativo (`TCK-2026-XXXX`) desde Correo, WhatsApp, Llamada Telefónica y Formulario Web.
- **Matriz Objetiva Impacto × Urgencia:** Cálculo automático de prioridad (`Crítica`, `Alta`, `Media`, `Baja`) y tiempos SLA.
- **Asignación Manual y Automática:** Balanceo automático hacia el técnico activo con menor carga o asignación directa.
- **Ciclo de Vida Controlado (ITIL 4):** Estados `Nuevo`, `En Curso`, `Resuelto` (con registro obligatorio de solución) y `Anulado` (baja lógica sin borrado físico).
- **Seguridad y Cumplimiento Normativo (Leyes N° 19.628, N° 21.719 y N° 21.663 / ISO 27001):**
  - Control de acceso por roles (**RBAC**: `cliente`, `tecnico`, `supervisor`, `admin`) reforzado con **RLS** en PostgreSQL.
  - Autenticación Multifactor (**MFA TOTP**).
  - Bitácora de auditoría inmutable (`audit_logs` protegida contra `UPDATE` y `DELETE`).
- **Portal Público de Seguimiento para Clientes:** Consulta en tiempo real por código de ticket y correo sin necesidad de llamar.
- **Reportes Gerenciales:** Dashboard de cumplimiento SLA y exportación a **Excel (`.xlsx`)** y **PDF**.

## Instalación y Puesta en Marcha

### 1. Configurar Supabase
1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Abre el **SQL Editor** y ejecuta en orden:
   - `supabase/01_schema_and_rls.sql`
   - `supabase/02_seed_data.sql`
3. En **Authentication → Providers → Email**, activa el inicio de sesión con correo y contraseña.
4. En **Authentication → Multi-Factor**, activa **TOTP**.
5. Crea los usuarios de prueba en **Authentication → Users → Add User** (marcando *Auto Confirm User*):
   - `admin@coredesk.cl` (Contraseña: `CoreDesk2026!`)
   - `supervisor@coredesk.cl` (Contraseña: `CoreDesk2026!`)
   - `widjy.marcellus@coredesk.cl` (Contraseña: `CoreDesk2026!`)
   - `nicolas.casapia@coredesk.cl` (Contraseña: `CoreDesk2026!`)
6. Ejecuta en el **SQL Editor** para asignar sus roles RBAC:
   ```sql
   UPDATE public.profiles SET role = 'admin', full_name = 'Administrador CoreDesk', mfa_enforced = TRUE WHERE email = 'admin@coredesk.cl';
   UPDATE public.profiles SET role = 'supervisor', full_name = 'Jefe de Soporte TI', mfa_enforced = TRUE WHERE email = 'supervisor@coredesk.cl';
   UPDATE public.profiles SET role = 'tecnico', full_name = 'Widjy Marcellus' WHERE email = 'widjy.marcellus@coredesk.cl';
   UPDATE public.profiles SET role = 'tecnico', full_name = 'Nicolas Casapia' WHERE email = 'nicolas.casapia@coredesk.cl';
   ```

### 2. Ejecutar Frontend Web
```bash
npm install
cp .env.example .env
# Edita .env con tu VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev
```
