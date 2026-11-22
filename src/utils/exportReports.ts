import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Ticket } from '../types/database';
import { evaluateSlaStatus } from './slaAndMatrix';

export function exportTicketsToExcel(tickets: Ticket[]) {
  const rows = tickets.map((t) => {
    const sla = evaluateSlaStatus(t.created_at, t.sla_due_at, t.status, t.resolved_at);
    return {
      'N° Ticket': t.ticket_code,
      Cliente: t.client?.company_name || 'N/A',
      Contacto: t.client?.contact_name || 'N/A',
      Canal: t.channel.toUpperCase(),
      Categoría: t.category,
      Asunto: t.subject,
      Impacto: t.impact.toUpperCase(),
      Urgencia: t.urgency.toUpperCase(),
      Prioridad: t.priority.toUpperCase(),
      Estado: t.status.replace('_', ' ').toUpperCase(),
      'Técnico Asignado': t.technician?.full_name || 'Sin asignar',
      'Estado SLA': sla.label,
      'Fecha Creación': new Date(t.created_at).toLocaleString('es-CL'),
      'Vencimiento SLA': new Date(t.sla_due_at).toLocaleString('es-CL'),
      'Solución Aplicada': t.solution_notes || '',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Tickets CoreDesk TI');
  XLSX.writeFile(workbook, `Reporte_CoreDesk_TI_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportTicketsToPdf(tickets: Ticket[], slaComplianceRate: number) {
  const doc = new jsPDF({ orientation: 'landscape' });

  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text('CoreDesk TI — Reporte Ejecutivo de Soporte y Cumplimiento SLA', 14, 18);

  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Generado: ${new Date().toLocaleString('es-CL')} | Total Tickets: ${tickets.length} | Cumplimiento SLA Global: ${slaComplianceRate}%`,
    14,
    25
  );

  autoTable(doc, {
    startY: 31,
    head: [['Ticket', 'Cliente', 'Canal', 'Asunto', 'Prioridad', 'Estado', 'Responsable', 'SLA']],
    body: tickets.map((t) => {
      const sla = evaluateSlaStatus(t.created_at, t.sla_due_at, t.status, t.resolved_at);
      return [
        t.ticket_code,
        t.client?.company_name || '-',
        t.channel.toUpperCase(),
        t.subject.slice(0, 38),
        t.priority.toUpperCase(),
        t.status.replace('_', ' ').toUpperCase(),
        t.technician?.full_name || 'Sin asignar',
        sla.label,
      ];
    }),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 64, 175] },
  });

  doc.save(`Reporte_SLA_CoreDesk_TI_${new Date().toISOString().slice(0, 10)}.pdf`);
}
