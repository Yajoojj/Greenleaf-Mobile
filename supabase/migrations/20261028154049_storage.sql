-- GreenLeaf — fotos e overlays. Bucket privado: as telas recebem só URLs assinadas de curta duração.
-- Caminhos: {user_id}/{analysis_id}/original.jpg e {user_id}/{analysis_id}/overlay.jpg

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('leaves', 'leaves', false, 8388608, array['image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- O primeiro segmento do caminho tem de ser o id de quem chama. Sem UPDATE: arquivos são imutáveis.
create policy "leaves: dono lê" on storage.objects
  for select to authenticated
  using (bucket_id = 'leaves' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "leaves: dono envia" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'leaves' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "leaves: dono apaga" on storage.objects
  for delete to authenticated
  using (bucket_id = 'leaves' and (storage.foldername(name))[1] = (select auth.uid())::text);
