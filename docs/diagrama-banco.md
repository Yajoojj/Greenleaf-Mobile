# Diagrama de banco — GreenLeaf (versão final, Supabase)

Atualiza o diagrama de banco dos Artefatos (`usuario`, `analise`, `localizacao`) com as tabelas que estão no projeto
`greenleaf-app` e com os campos da IA v2. Fonte: `supabase/migrations/`. Decisões em [decisoes.md](decisoes.md) (D-22 e D-23).

```mermaid
erDiagram
  AUTH_USERS ||--|| PROFILES : "1:1 (trigger no cadastro)"
  PROFILES ||--o{ ANALYSES : "faz"
  ANALYSES ||--o| LOCATIONS : "pode ter (com consentimento)"
  PROFILES |o--o{ FEEDBACK : "envia (opcional)"
  ANALYSES ||--|{ STORAGE_LEAVES : "original.jpg e overlay.jpg"

  AUTH_USERS {
    uuid id PK
    text email "gerenciado pelo Supabase Auth"
    text encrypted_password "bcrypt, nunca exposto"
  }
  PROFILES {
    uuid id PK "FK auth.users, on delete cascade"
    text name "2 a 80 caracteres"
    timestamptz created_at
  }
  ANALYSES {
    uuid id PK "gerado no app (envio idempotente)"
    uuid user_id FK "profiles, on delete cascade"
    timestamptz created_at "hora da análise no aparelho"
    text state "sadia | leve | moderada | grave"
    float8 probability "0 a 1"
    float8 model_probability "0 a 1, nulo = só cor"
    float8 hsv_probability "0 a 1"
    float8 ratio "0 a 1"
    text severity "Leve | Moderada | Grave | nulo (sadia)"
    text other_disease "CBSD | CGM | CMD | nulo"
    jsonb class_probabilities "CBB, CBSD, CGM, CMD, Healthy"
    text model_version
    int processing_time_ms
    text source "camera | gallery (demo nunca)"
    text image_path "user_id/id/original.jpg"
    text overlay_path "user_id/id/overlay.jpg"
  }
  LOCATIONS {
    uuid analysis_id PK "FK analyses, on delete cascade"
    numeric latitude "2 casas (~1 km)"
    numeric longitude "2 casas (~1 km)"
    boolean consent "sempre true (check)"
    timestamptz created_at
  }
  FEEDBACK {
    uuid id PK
    uuid user_id FK "nulo sem conta; on delete set null"
    text topic "duvida | problema | sugestao | elogio"
    text message "1 a 2000 caracteres"
    smallint rating "1 a 5, nulo"
    text contact_email "nulo"
    text app_version
    timestamptz created_at
  }
  STORAGE_LEAVES {
    text bucket "leaves (privado, JPEG/PNG, 8 MB)"
    text name "user_id/analysis_id/arquivo"
  }
```

## O que mudou em relação aos Artefatos

| Artefatos | Final | Por quê |
|---|---|---|
| `usuario` com e-mail e senha | `auth.users` (Supabase Auth) + `profiles` (só o nome) | Senha e sessão ficam no serviço de autenticação; o app nunca vê hash de senha |
| `analise` com classe e probabilidade | `analyses` com `state`, `severity`, `other_disease`, `class_probabilities`, `model_version` | Campos da IA v2 (5 classes, "outra doença", versão do modelo no histórico) |
| imagem no registro | `image_path`/`overlay_path` + bucket privado `leaves` | Arquivo fora do banco; acesso só por URL assinada curta |
| `localizacao` | `locations` 1:1 com a análise, arredondada e com `consent` obrigatório | LGPD: só com consentimento e sem precisão de lavoura |
| — | `feedback` | Tela "Suporte e sugestões" |
| — | função `heatmap_cells()` | Mapa de calor só com dados agregados (≥ 5 análises por célula de ~5 km) |

Logs técnicos da IA (`prediction_logs`) **não** fazem parte deste banco: ficam no Supabase do servidor da IA.
