insert into clinicas
  (id, nome, bairro, endereco, telefone, aberta, status, horario, responsavel,
   capacidade_diaria, latitude, longitude,
   especialidades, especialidades_exames)
values
  (1, 'UBS Bacaxa', 'Bacaxa', 'Rua Principal, 100 - Bacaxa, Saquarema/RJ', '(22) 2651-0001', true, 'ativa', 'Seg a Sex: 07h as 17h', 'Dra. Helena Martins', 96, -22.9169, -42.6169, '["Clinica Geral","Pediatria","Vacinacao"]'::jsonb, '["Hemograma completo","Glicemia em jejum","Urina tipo 1"]'::jsonb),
  (2, 'UBS Itauna', 'Itauna', 'Av. Oceanica, 250 - Itauna, Saquarema/RJ', '(22) 2651-0002', true, 'ativa', 'Seg a Sex: 08h as 16h', 'Dr. Ricardo Azevedo', 74, -22.9338, -42.4939, '["Clinica Geral","Ginecologia","Pre-Natal"]'::jsonb, '["Colesterol total e fracoes","Ultrassonografia","Preventivo"]'::jsonb),
  (3, 'UBS Vilatur', 'Vilatur', 'Rua das Flores, 45 - Vilatur, Saquarema/RJ', '(22) 2651-0003', false, 'temporariamente_fechada', 'Temporariamente fechada', 'Enf. Marcos Vieira', 42, -22.9344, -42.6835, '["Clinica Geral","Odontologia"]'::jsonb, '["Raio-X","Hemograma completo"]'::jsonb),
  (4, 'UBS Sampaio Correa', 'Sampaio Correa', 'Estrada Municipal, 78 - Sampaio Correa, Saquarema/RJ', '(22) 2651-0004', true, 'ativa', 'Seg a Sex: 07h as 17h', 'Dra. Priscila Rocha', 88, -22.8747, -42.6594, '["Clinica Geral","Pediatria","Nutricao"]'::jsonb, '["Hemograma completo","Glicemia em jejum","Colesterol total e fracoes"]'::jsonb)
on conflict (id) do nothing;

insert into usuarios
  (id, nome, email, senha_hash, nivel_acesso, clinica_id, status)
values
  (1, 'Ana Paula Souza', 'paciente@saudeplus.com', 'scrypt$16384$8$1$vXHijkHyJlsJgJMVAP_2EQ$_I-MxQGIltX2NqP9pnvG2sKJEH9TJwmO0VrkQpA4LZlx8fhSAHVDcNOLSvcoAoB-qZXnNxCgd1sV18HgEpVqDA', 'paciente', null, 'ativo'),
  (2, 'Admin Clinica', 'admin@saudeplus.com', 'scrypt$16384$8$1$vXHijkHyJlsJgJMVAP_2EQ$_I-MxQGIltX2NqP9pnvG2sKJEH9TJwmO0VrkQpA4LZlx8fhSAHVDcNOLSvcoAoB-qZXnNxCgd1sV18HgEpVqDA', 'admin_clinica', 1, 'ativo'),
  (3, 'Admin Master', 'master@saudeplus.com', 'scrypt$16384$8$1$vXHijkHyJlsJgJMVAP_2EQ$_I-MxQGIltX2NqP9pnvG2sKJEH9TJwmO0VrkQpA4LZlx8fhSAHVDcNOLSvcoAoB-qZXnNxCgd1sV18HgEpVqDA', 'admin_master', null, 'ativo'),
  (4, 'Roberto Lima', 'medico@saudeplus.com', 'scrypt$16384$8$1$vXHijkHyJlsJgJMVAP_2EQ$_I-MxQGIltX2NqP9pnvG2sKJEH9TJwmO0VrkQpA4LZlx8fhSAHVDcNOLSvcoAoB-qZXnNxCgd1sV18HgEpVqDA', 'medico', 1, 'ativo')
on conflict (id) do nothing;

select setval('clinicas_id_seq', greatest((select max(id) from clinicas), 1), true);
select setval('usuarios_id_seq', greatest((select max(id) from usuarios), 1), true);
