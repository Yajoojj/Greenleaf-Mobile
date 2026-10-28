-- GreenLeaf — esquema do app (histórico do usuário). NÃO é o projeto de logs da IA (prediction_logs).
-- Modelo: diagrama de banco dos Artefatos, atualizado para a IA v2 (docs/diagrama-banco.md).

-- ---------------------------------------------------------------------------
-- profiles: 1 linha por usuário do Supabase Auth, criada por trigger no cadastro.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  created_at timestamptz not null default now()
);
comment on table public.profiles is 'Perfil público mínimo do produtor (nome). E-mail e senha ficam só no auth.users.';

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := left(btrim(coalesce(new.raw_user_meta_data ->> 'name', '')), 80);
begin
  -- O app já valida o nome (2–80); este fallback só evita que um cadastro feito fora do app falhe.
  if char_length(v_name) < 2 then
    v_name := left(coalesce(nullif(split_part(new.email, '@', 1), ''), 'Produtor'), 80);
  end if;
  if char_length(v_name) < 2 then
    v_name := 'Produtor';
  end if;
  insert into public.profiles (id, name) values (new.id, v_name);
  return new;
end;
$$;
-- Função de trigger: ninguém do cliente precisa (nem deve) executá-la diretamente.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- analyses: histórico imutável. O id é gerado no app (envio idempotente).
-- Demonstração (source = 'demo' ou simulated = true) nunca chega aqui: `source` só aceita camera | gallery.
-- ---------------------------------------------------------------------------
create table public.analyses (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  state text not null check (state in ('sadia', 'leve', 'moderada', 'grave')),
  probability double precision not null check (probability between 0 and 1),
  model_probability double precision check (model_probability between 0 and 1),
  hsv_probability double precision not null check (hsv_probability between 0 and 1),
  ratio double precision not null check (ratio between 0 and 1),
  severity text check (severity in ('Leve', 'Moderada', 'Grave')),
  other_disease text check (other_disease in ('CBSD', 'CGM', 'CMD')),
  class_probabilities jsonb check (class_probabilities is null or jsonb_typeof(class_probabilities) = 'object'),
  model_version text check (char_length(model_version) <= 80),
  processing_time_ms integer not null check (processing_time_ms >= 0),
  source text not null check (source in ('camera', 'gallery')),
  image_path text not null,
  overlay_path text not null,
  -- Folha sadia nunca tem severidade; doente sempre tem.
  constraint analyses_severity_matches_state check ((state = 'sadia') = (severity is null)),
  -- "Outra doença" só existe quando a bacteriose foi descartada.
  constraint analyses_other_disease_only_sadia check (other_disease is null or state = 'sadia'),
  -- Arquivos sempre dentro da pasta do dono: {user_id}/{analysis_id}/...
  constraint analyses_image_path_owner check (image_path = user_id::text || '/' || id::text || '/original.jpg'),
  constraint analyses_overlay_path_owner check (overlay_path = user_id::text || '/' || id::text || '/overlay.jpg')
);
comment on table public.analyses is 'Histórico de diagnósticos do usuário (sem update: imutável).';
comment on column public.analyses.class_probabilities is 'Probabilidades das 5 classes da IA v2: {CBB, CBSD, CGM, CMD, Healthy}.';

create index analyses_user_created_idx on public.analyses (user_id, created_at desc);
create index analyses_user_state_idx on public.analyses (user_id, state);

-- ---------------------------------------------------------------------------
-- locations: posição aproximada (2 casas decimais ≈ 1 km), só com consentimento.
-- ---------------------------------------------------------------------------
create table public.locations (
  analysis_id uuid primary key references public.analyses (id) on delete cascade,
  latitude numeric(5, 2) not null check (latitude between -90 and 90),
  longitude numeric(5, 2) not null check (longitude between -180 and 180),
  consent boolean not null check (consent),
  created_at timestamptz not null default now()
);
comment on table public.locations is 'Localização arredondada no app; nunca exposta individualmente (ver heatmap_cells).';

-- ---------------------------------------------------------------------------
-- feedback: "Fale conosco". user_id nulo para quem usa sem conta.
-- ---------------------------------------------------------------------------
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  topic text not null check (topic in ('duvida', 'problema', 'sugestao', 'elogio')),
  message text not null check (char_length(btrim(message)) between 1 and 2000),
  rating smallint check (rating between 1 and 5),
  contact_email text check (char_length(contact_email) <= 254),
  app_version text check (char_length(app_version) <= 40),
  created_at timestamptz not null default now()
);
comment on table public.feedback is 'Mensagens de suporte. Gravação pelo cliente; leitura só pela equipe (painel/service role).';

create index feedback_user_idx on public.feedback (user_id);
