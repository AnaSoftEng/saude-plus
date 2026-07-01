update usuarios
set email = case id
    when 1 then 'paciente@saudeplus.com'
    when 2 then 'admin@saudeplus.com'
    when 3 then 'master@saudeplus.com'
    when 4 then 'medico@saudeplus.com'
  end,
  senha_hash = 'scrypt$16384$8$1$vXHijkHyJlsJgJMVAP_2EQ$_I-MxQGIltX2NqP9pnvG2sKJEH9TJwmO0VrkQpA4LZlx8fhSAHVDcNOLSvcoAoB-qZXnNxCgd1sV18HgEpVqDA'
where id in (1, 2, 3, 4);
