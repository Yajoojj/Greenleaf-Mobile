-- GreenLeaf — Row Level Security (PI V / SDA). Toda tabela exposta pela API tem RLS e políticas explícitas.
-- `(select auth.uid())` em vez de `auth.uid()`: o Postgres avalia uma vez por consulta, não por linha.

alter table public.profiles enable row level security;
alter table public.analyses enable row level security;
alter table public.locations enable row level security;
alter table public.feedback enable row level security;

-- Privilégios mínimos por papel (a RLS filtra as linhas; os GRANTs limitam as operações).
revoke all on public.profiles, public.analyses, public.locations, public.feedback from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (name) on public.profiles to authenticated;
grant select, insert, delete on public.analyses to authenticated;
grant select, insert, delete on public.locations to authenticated;
grant insert on public.feedback to anon, authenticated;

-- ---------------------------------------------------------------------------
-- profiles: o próprio usuário lê e atualiza (só o nome). Inserção só pelo trigger; exclusão pelo cascade.
-- ---------------------------------------------------------------------------
create policy "profiles: dono lê" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: dono atualiza" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- analyses: o próprio usuário lê, insere e apaga. Sem UPDATE: o histórico é imutável.
-- ---------------------------------------------------------------------------
create policy "analyses: dono lê" on public.analyses
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "analyses: dono insere" on public.analyses
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "analyses: dono apaga" on public.analyses
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- locations: só através de uma análise do próprio usuário.
-- ---------------------------------------------------------------------------
create policy "locations: dono da análise lê" on public.locations
  for select to authenticated
  using (exists (select 1 from public.analyses a where a.id = analysis_id and a.user_id = (select auth.uid())));

create policy "locations: dono da análise insere" on public.locations
  for insert to authenticated
  with check (exists (select 1 from public.analyses a where a.id = analysis_id and a.user_id = (select auth.uid())));

create policy "locations: dono da análise apaga" on public.locations
  for delete to authenticated
  using (exists (select 1 from public.analyses a where a.id = analysis_id and a.user_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- feedback: qualquer um envia; ninguém do cliente lê (sem política de SELECT).
-- Sem conta → user_id nulo; com conta → nulo ou o próprio id (nunca o de outra pessoa).
-- ---------------------------------------------------------------------------
create policy "feedback: visitante envia sem identificação" on public.feedback
  for insert to anon
  with check (user_id is null);

create policy "feedback: usuário envia em seu nome" on public.feedback
  for insert to authenticated
  with check (user_id is null or user_id = (select auth.uid()));
