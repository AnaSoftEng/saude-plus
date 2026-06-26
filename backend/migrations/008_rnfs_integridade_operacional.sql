-- RNFs cobertos: integridade, consistencia concorrente, auditoria, rastreabilidade,
-- idempotencia de eventos e limites de dados sensiveis.

create unique index if not exists usuarios_email_lower_unique_idx
  on usuarios (lower(email));

create index if not exists usuarios_clinica_id_idx
  on usuarios (clinica_id);

create index if not exists usuarios_nivel_status_idx
  on usuarios (nivel_acesso, status);

create index if not exists clinicas_status_idx
  on clinicas (status);

create index if not exists consultas_clinica_data_idx
  on consultas (clinica_id, data, horario);

create index if not exists consultas_medico_data_idx
  on consultas (medico_id, data, horario);

create index if not exists consultas_status_data_idx
  on consultas (status, data);

create unique index if not exists consultas_agenda_nao_cancelada_unique_idx
  on consultas (agenda_id)
  where status <> 'cancelada';

create index if not exists exames_clinica_data_idx
  on exames (clinica_id, data, horario);

create index if not exists exames_medico_data_idx
  on exames (medico_id, data, horario);

create index if not exists exames_status_data_idx
  on exames (status, data);

create unique index if not exists exames_agenda_nao_cancelada_unique_idx
  on exames (agenda_id)
  where agenda_id is not null
    and status <> 'cancelado';

create index if not exists access_logs_usuario_id_idx
  on access_logs (usuario_id);

create index if not exists access_logs_status_code_idx
  on access_logs (status_code);

create index if not exists access_logs_rota_idx
  on access_logs (left(rota, 255));

update consultas
set motivo_cancelamento = 'Motivo nao informado em migracao de saneamento.'
where status = 'cancelada'
  and motivo_cancelamento = '';

update consultas
set cancelado_em = coalesce(cancelado_em, now())
where status = 'cancelada';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clinicas_status_chk') then
    alter table clinicas
      add constraint clinicas_status_chk
      check (status in ('ativa', 'inativa', 'temporariamente_fechada'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinicas_capacidade_diaria_chk') then
    alter table clinicas
      add constraint clinicas_capacidade_diaria_chk
      check (capacidade_diaria >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clinicas_coordenadas_chk') then
    alter table clinicas
      add constraint clinicas_coordenadas_chk
      check (
        (latitude is null or latitude between -90 and 90)
        and (longitude is null or longitude between -180 and 180)
      );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'usuarios_status_chk') then
    alter table usuarios
      add constraint usuarios_status_chk
      check (status in ('ativo', 'inativo', 'bloqueado'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'usuarios_clinica_por_perfil_chk') then
    alter table usuarios
      add constraint usuarios_clinica_por_perfil_chk
      check (
        (nivel_acesso in ('admin_master', 'paciente') and clinica_id is null)
        or (nivel_acesso in ('admin_clinica', 'medico') and clinica_id is not null)
      );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'consultas_cancelamento_chk') then
    alter table consultas
      add constraint consultas_cancelamento_chk
      check (
        (status = 'cancelada' and motivo_cancelamento <> '' and cancelado_em is not null)
        or (status <> 'cancelada')
      );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'exames_status_chk') then
    alter table exames
      add constraint exames_status_chk
      check (status in ('agendado', 'liberado', 'cancelado', 'realizado'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'exames_resultado_categoria_chk') then
    alter table exames
      add constraint exames_resultado_categoria_chk
      check (resultado_categoria in ('exame', 'prontuario', 'atestado'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'exames_resultado_tamanho_chk') then
    alter table exames
      add constraint exames_resultado_tamanho_chk
      check (
        resultado_arquivo_tamanho between 0 and 2097152
        and length(resultado_arquivo_data_url) <= 3145728
      );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'exames_resultado_tipo_chk') then
    alter table exames
      add constraint exames_resultado_tipo_chk
      check (
        resultado_arquivo_tipo = ''
        or resultado_arquivo_tipo in ('application/pdf', 'image/png', 'image/jpeg', 'text/plain')
      );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'access_logs_status_code_chk') then
    alter table access_logs
      add constraint access_logs_status_code_chk
      check (status_code between 100 and 599);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'access_logs_duracao_ms_chk') then
    alter table access_logs
      add constraint access_logs_duracao_ms_chk
      check (duracao_ms >= 0);
  end if;
end $$;

alter table clinicas
  add column if not exists atualizado_em timestamptz not null default now();

alter table usuarios
  add column if not exists atualizado_em timestamptz not null default now();

alter table consultas
  add column if not exists atualizado_em timestamptz not null default now();

alter table exames
  add column if not exists atualizado_em timestamptz not null default now();

create or replace function set_atualizado_em()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'clinicas_set_atualizada_em') then
    create trigger clinicas_set_atualizada_em
      before update on clinicas
      for each row execute function set_atualizado_em();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'usuarios_set_atualizado_em') then
    create trigger usuarios_set_atualizado_em
      before update on usuarios
      for each row execute function set_atualizado_em();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'consultas_set_atualizado_em') then
    create trigger consultas_set_atualizado_em
      before update on consultas
      for each row execute function set_atualizado_em();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'exames_set_atualizado_em') then
    create trigger exames_set_atualizado_em
      before update on exames
      for each row execute function set_atualizado_em();
  end if;
end $$;

create table if not exists outbox_events (
  id bigserial primary key,
  aggregate_type varchar(80) not null,
  aggregate_id varchar(120) not null,
  event_type varchar(120) not null,
  event_version integer not null default 1,
  payload jsonb not null,
  status varchar(30) not null default 'pending',
  attempts integer not null default 0,
  correlation_id varchar(120),
  available_at timestamptz not null default now(),
  published_at timestamptz,
  last_error text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint outbox_events_status_chk
    check (status in ('pending', 'processing', 'published', 'failed')),
  constraint outbox_events_attempts_chk
    check (attempts >= 0),
  constraint outbox_events_payload_object_chk
    check (jsonb_typeof(payload) = 'object')
);

create index if not exists outbox_events_pending_idx
  on outbox_events (status, available_at, id)
  where status in ('pending', 'failed');

create index if not exists outbox_events_aggregate_idx
  on outbox_events (aggregate_type, aggregate_id);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'outbox_events_set_atualizado_em') then
    create trigger outbox_events_set_atualizado_em
      before update on outbox_events
      for each row execute function set_atualizado_em();
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'push_subscriptions_endpoint_chk') then
    alter table push_subscriptions
      add constraint push_subscriptions_endpoint_chk
      check (length(trim(endpoint)) > 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'push_subscriptions_subscription_object_chk') then
    alter table push_subscriptions
      add constraint push_subscriptions_subscription_object_chk
      check (jsonb_typeof(subscription) = 'object');
  end if;
end $$;
