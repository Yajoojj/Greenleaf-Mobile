-- GreenLeaf — corrige os alertas 0028/0029 do advisor de segurança: a função SECURITY DEFINER sai do
-- esquema exposto pela API (`public`) e vai para `private`, que o PostgREST não publica.
-- `public.heatmap_cells()` vira SECURITY INVOKER e só repassa o agregado.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create function private.heatmap_cells()
returns table (latitude numeric, longitude numeric, total integer, infected integer)
language sql
stable
security definer
set search_path = ''
as $$
  -- 0,045° ≈ 5 km de latitude (e ~4,6 km de longitude no Vale do Ribeira).
  select
    round(floor(l.latitude / 0.045) * 0.045 + 0.0225, 3) as latitude,
    round(floor(l.longitude / 0.045) * 0.045 + 0.0225, 3) as longitude,
    count(*)::integer as total,
    (count(*) filter (where a.state <> 'sadia'))::integer as infected
  from public.locations l
  join public.analyses a on a.id = l.analysis_id
  where l.consent
  group by 1, 2
  having count(*) >= 5
  order by 1, 2;
$$;
comment on function private.heatmap_cells() is
  'Lê todas as localizações com consentimento (definer) e devolve só células com 5+ análises.';
revoke execute on function private.heatmap_cells() from public;
grant execute on function private.heatmap_cells() to anon, authenticated;

-- Mesma assinatura: `create or replace` troca o corpo e o modo de segurança sem apagar a função.
create or replace function public.heatmap_cells()
returns table (latitude numeric, longitude numeric, total integer, infected integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.heatmap_cells();
$$;
comment on function public.heatmap_cells() is
  'Mapa de calor agregado (grade ~5 km, mínimo 5 análises por célula). Sem dados individuais.';
revoke execute on function public.heatmap_cells() from public;
grant execute on function public.heatmap_cells() to anon, authenticated;
