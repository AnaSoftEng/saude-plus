create table if not exists password_recovery_codes (
  email varchar(254) primary key,
  usuario_id integer not null references usuarios(id) on delete cascade,
  codigo_hash varchar(128) not null,
  expira_em timestamptz not null,
  tentativas integer not null default 0,
  max_tentativas integer not null default 5,
  canal varchar(20) not null,
  destino_mascarado varchar(254) not null default '',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint password_recovery_codes_canal_chk
    check (canal in ('email', 'sms')),
  constraint password_recovery_codes_tentativas_chk
    check (tentativas >= 0 and max_tentativas > 0)
);

create index if not exists password_recovery_codes_expira_em_idx
  on password_recovery_codes (expira_em);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'password_recovery_codes_set_atualizado_em') then
    create trigger password_recovery_codes_set_atualizado_em
      before update on password_recovery_codes
      for each row execute function set_atualizado_em();
  end if;
end $$;
