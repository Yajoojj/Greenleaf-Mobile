-- GreenLeaf — mapa de calor. Só dados agregados: centro de uma célula de ~5 km, total de análises e
-- total com bacteriose. Células com menos de 5 análises somem (k-anonimato). Nunca devolve coordenada,
-- id ou data individual.
--
-- `security definer` é necessário porque a RLS só deixa cada usuário ver as próprias análises;
-- a função lê tudo, mas devolve apenas o agregado. `search_path` vazio evita sequestro de nomes.

create function public.heatmap_cells()
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

comment on function public.heatmap_cells() is
  'Mapa de calor agregado (grade ~5 km, mínimo 5 análises por célula). Sem dados individuais.';

revoke execute on function public.heatmap_cells() from public;
grant execute on function public.heatmap_cells() to anon, authenticated;
