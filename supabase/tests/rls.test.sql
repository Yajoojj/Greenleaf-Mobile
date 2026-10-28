-- GreenLeaf — testes de RLS com dois usuários (A e B) e o papel anon.
-- Roda numa transação e termina com ROLLBACK: nada fica no banco (nem os usuários de teste).
-- Uso: cole no SQL Editor do projeto (ou execute_sql pelo plugin). Qualquer falha aborta com "FALHOU: ...".

begin;

-- ---------------------------------------------------------------- preparação (postgres, ignora RLS)
insert into auth.users (id, email, aud, role, raw_user_meta_data)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'rls-a@greenleaf.test', 'authenticated', 'authenticated', '{"name":"Teste A"}'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'rls-b@greenleaf.test', 'authenticated', 'authenticated', '{"name":"B"}');

do $$
begin
  if (select name from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000001') is distinct from 'Teste A' then
    raise exception 'FALHOU: trigger não criou o perfil de A com o nome do cadastro';
  end if;
  -- "B" tem 1 caractere: o trigger usa a parte local do e-mail.
  if (select name from public.profiles where id = 'bbbbbbbb-0000-4000-8000-000000000002') is distinct from 'rls-b' then
    raise exception 'FALHOU: fallback de nome curto';
  end if;
end $$;

-- 4 análises de A com localização na mesma célula (menos que 5 → célula não aparece no mapa).
insert into public.analyses (id, user_id, state, probability, model_probability, hsv_probability, ratio, severity,
                             other_disease, class_probabilities, model_version, processing_time_ms, source, image_path, overlay_path)
select g.id, 'aaaaaaaa-0000-4000-8000-000000000001', 'grave', 0.9, 0.9, 0.5, 0.2, 'Grave', null,
       '{"CBB":0.9,"CBSD":0.02,"CGM":0.02,"CMD":0.03,"Healthy":0.03}', 'greenleaf_effb0-2026-10-28', 120, 'camera',
       'aaaaaaaa-0000-4000-8000-000000000001/' || g.id || '/original.jpg',
       'aaaaaaaa-0000-4000-8000-000000000001/' || g.id || '/overlay.jpg'
from (values ('a0000000-0000-4000-8000-000000000001'::uuid), ('a0000000-0000-4000-8000-000000000002'),
             ('a0000000-0000-4000-8000-000000000003'), ('a0000000-0000-4000-8000-000000000004')) as g(id);

insert into public.locations (analysis_id, latitude, longitude, consent)
select id, -24.49, -47.84, true from public.analyses where user_id = 'aaaaaaaa-0000-4000-8000-000000000001';

insert into storage.objects (bucket_id, name, owner_id)
values ('leaves', 'aaaaaaaa-0000-4000-8000-000000000001/a0000000-0000-4000-8000-000000000001/original.jpg',
        'aaaaaaaa-0000-4000-8000-000000000001');

-- Restrições de domínio
do $$
begin
  begin
    insert into public.analyses (id, user_id, state, probability, hsv_probability, ratio, severity, processing_time_ms, source, image_path, overlay_path)
    values ('a0000000-0000-4000-8000-0000000000ff', 'aaaaaaaa-0000-4000-8000-000000000001', 'sadia', 0.1, 0.1, 0.01, 'Leve', 1, 'camera',
            'aaaaaaaa-0000-4000-8000-000000000001/a0000000-0000-4000-8000-0000000000ff/original.jpg',
            'aaaaaaaa-0000-4000-8000-000000000001/a0000000-0000-4000-8000-0000000000ff/overlay.jpg');
    raise exception 'FALHOU: folha sadia aceitou severidade';
  exception when check_violation then null;
  end;
  begin
    insert into public.analyses (id, user_id, state, probability, hsv_probability, ratio, severity, processing_time_ms, source, image_path, overlay_path)
    values ('a0000000-0000-4000-8000-0000000000fe', 'aaaaaaaa-0000-4000-8000-000000000001', 'leve', 0.4, 0.1, 0.01, 'Leve', 1, 'demo',
            'aaaaaaaa-0000-4000-8000-000000000001/a0000000-0000-4000-8000-0000000000fe/original.jpg',
            'aaaaaaaa-0000-4000-8000-000000000001/a0000000-0000-4000-8000-0000000000fe/overlay.jpg');
    raise exception 'FALHOU: análise de demonstração aceita na nuvem';
  exception when check_violation then null;
  end;
  begin
    insert into public.analyses (id, user_id, state, probability, hsv_probability, ratio, severity, processing_time_ms, source, image_path, overlay_path)
    values ('a0000000-0000-4000-8000-0000000000fd', 'aaaaaaaa-0000-4000-8000-000000000001', 'leve', 1.5, 0.1, 0.01, 'Leve', 1, 'camera',
            'aaaaaaaa-0000-4000-8000-000000000001/a0000000-0000-4000-8000-0000000000fd/original.jpg',
            'aaaaaaaa-0000-4000-8000-000000000001/a0000000-0000-4000-8000-0000000000fd/overlay.jpg');
    raise exception 'FALHOU: probabilidade fora de 0–1 aceita';
  exception when check_violation then null;
  end;
end $$;

-- ---------------------------------------------------------------- usuário B
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}', true);

do $$
declare n integer;
begin
  select count(*) into n from public.analyses;
  if n <> 0 then raise exception 'FALHOU: B leu % análises de A', n; end if;

  select count(*) into n from public.locations;
  if n <> 0 then raise exception 'FALHOU: B leu localizações de A'; end if;

  select count(*) into n from public.profiles;
  if n <> 1 then raise exception 'FALHOU: B vê % perfis (esperado só o próprio)', n; end if;

  delete from public.analyses where id = 'a0000000-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU: B apagou análise de A'; end if;

  -- Download de imagem = SELECT em storage.objects
  select count(*) into n from storage.objects where bucket_id = 'leaves';
  if n <> 0 then raise exception 'FALHOU: B enxerga a imagem de A no Storage'; end if;

  begin
    insert into public.analyses (id, user_id, state, probability, hsv_probability, ratio, severity, processing_time_ms, source, image_path, overlay_path)
    values ('b0000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'leve', 0.4, 0.1, 0.01, 'Leve', 1, 'camera',
            'aaaaaaaa-0000-4000-8000-000000000001/b0000000-0000-4000-8000-000000000001/original.jpg',
            'aaaaaaaa-0000-4000-8000-000000000001/b0000000-0000-4000-8000-000000000001/overlay.jpg');
    raise exception 'FALHOU: B inseriu análise em nome de A';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.locations (analysis_id, latitude, longitude, consent)
    values ('a0000000-0000-4000-8000-000000000001', -10, -10, true);
    raise exception 'FALHOU: B inseriu localização na análise de A';
  exception when insufficient_privilege or unique_violation then null;
  end;

  begin
    insert into storage.objects (bucket_id, name) values ('leaves', 'aaaaaaaa-0000-4000-8000-000000000001/x/original.jpg');
    raise exception 'FALHOU: B enviou arquivo para a pasta de A';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.analyses set state = 'sadia';
    raise exception 'FALHOU: histórico aceitou UPDATE';
  exception when insufficient_privilege then null;
  end;

  update public.profiles set name = 'Invasor' where id = 'aaaaaaaa-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU: B alterou o perfil de A'; end if;

  begin
    insert into public.feedback (user_id, topic, message) values ('aaaaaaaa-0000-4000-8000-000000000001', 'elogio', 'oi');
    raise exception 'FALHOU: B enviou feedback em nome de A';
  exception when insufficient_privilege then null;
  end;
  insert into public.feedback (user_id, topic, message) values ('bbbbbbbb-0000-4000-8000-000000000002', 'sugestao', 'ok');
end $$;

-- ---------------------------------------------------------------- usuário A
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);

do $$
declare n integer;
begin
  select count(*) into n from public.analyses;
  if n <> 4 then raise exception 'FALHOU: A deveria ver as próprias 4 análises, viu %', n; end if;
  select count(*) into n from storage.objects where bucket_id = 'leaves';
  if n <> 1 then raise exception 'FALHOU: A não enxerga a própria imagem'; end if;

  -- Mapa: 4 análises na célula → nada é devolvido
  select count(*) into n from public.heatmap_cells();
  if n <> 0 then raise exception 'FALHOU: heatmap devolveu célula com menos de 5 análises'; end if;

  begin
    select count(*) into n from public.feedback;
    raise exception 'FALHOU: usuário leu feedback';
  exception when insufficient_privilege then null;
  end;

  -- A apaga a própria análise → localização sai pelo cascade
  delete from public.analyses where id = 'a0000000-0000-4000-8000-000000000004';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALHOU: A não conseguiu apagar a própria análise'; end if;
  select count(*) into n from public.locations where analysis_id = 'a0000000-0000-4000-8000-000000000004';
  if n <> 0 then raise exception 'FALHOU: localização não saiu em cascata'; end if;
end $$;

-- ---------------------------------------------------------------- anon
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
declare n integer;
begin
  begin
    select count(*) into n from public.analyses;
    raise exception 'FALHOU: anon leu analyses';
  exception when insufficient_privilege then null;
  end;
  begin
    select count(*) into n from public.feedback;
    raise exception 'FALHOU: anon leu feedback';
  exception when insufficient_privilege then null;
  end;
  begin
    select count(*) into n from public.locations;
    raise exception 'FALHOU: anon leu locations';
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from storage.objects where bucket_id = 'leaves';
  if n <> 0 then raise exception 'FALHOU: anon enxerga imagens'; end if;

  insert into public.feedback (topic, message, rating, app_version) values ('duvida', 'Como tiro a foto?', 5, 'teste');
  begin
    insert into public.feedback (user_id, topic, message) values ('aaaaaaaa-0000-4000-8000-000000000001', 'elogio', 'oi');
    raise exception 'FALHOU: anon enviou feedback identificado';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------------------------------------------------------------- mapa com 5 análises na célula
reset role;
insert into public.analyses (id, user_id, state, probability, hsv_probability, ratio, severity, processing_time_ms, source, image_path, overlay_path)
values
  ('b0000000-0000-4000-8000-000000000011', 'bbbbbbbb-0000-4000-8000-000000000002', 'sadia', 0.05, 0.02, 0.0, null, 1, 'gallery',
   'bbbbbbbb-0000-4000-8000-000000000002/b0000000-0000-4000-8000-000000000011/original.jpg',
   'bbbbbbbb-0000-4000-8000-000000000002/b0000000-0000-4000-8000-000000000011/overlay.jpg'),
  ('b0000000-0000-4000-8000-000000000012', 'bbbbbbbb-0000-4000-8000-000000000002', 'sadia', 0.05, 0.02, 0.0, null, 1, 'gallery',
   'bbbbbbbb-0000-4000-8000-000000000002/b0000000-0000-4000-8000-000000000012/original.jpg',
   'bbbbbbbb-0000-4000-8000-000000000002/b0000000-0000-4000-8000-000000000012/overlay.jpg');
insert into public.locations (analysis_id, latitude, longitude, consent)
values ('b0000000-0000-4000-8000-000000000011', -24.49, -47.84, true),
       ('b0000000-0000-4000-8000-000000000012', -24.50, -47.85, true);

set local role anon;
do $$
declare r record; n integer;
begin
  select count(*) into n from public.heatmap_cells();
  if n <> 1 then raise exception 'FALHOU: esperado 1 célula com 5 análises, veio %', n; end if;
  select * into r from public.heatmap_cells();
  if r.total <> 5 or r.infected <> 3 then raise exception 'FALHOU: agregado errado (total %, infectadas %)', r.total, r.infected; end if;
  -- Centro da célula, nunca a coordenada enviada
  if r.latitude in (-24.49, -24.50) or r.longitude in (-47.84, -47.85) then
    raise exception 'FALHOU: heatmap devolveu coordenada individual';
  end if;
end $$;

reset role;
select 'RLS: todos os testes passaram' as resultado;

rollback;
