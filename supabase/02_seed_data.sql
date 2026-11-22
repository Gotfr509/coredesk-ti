-- Datos iniciales de clientes empresariales para pruebas inmediatas
INSERT INTO public.clients (company_name, contact_name, contact_email, contact_phone, privacy_consent)
VALUES
  ('Clínica Santa María Sur', 'Dra. Camila Rojas', 'crojas@clinicasms.cl', '+56 9 8123 4567', TRUE),
  ('Constructora Andes SpA', 'Rodrigo Valenzuela', 'rvalenzuela@andesconstructora.cl', '+56 9 7654 3210', TRUE),
  ('Logística Pacífico Ltda.', 'Marcela Fuentes', 'mfuentes@logisticapacifico.cl', '+56 9 6543 2198', TRUE),
  ('Estudio Jurídico Silva & Asociados', 'Andrés Silva', 'asilva@silvalegal.cl', '+56 9 5432 1876', TRUE)
ON CONFLICT DO NOTHING;
