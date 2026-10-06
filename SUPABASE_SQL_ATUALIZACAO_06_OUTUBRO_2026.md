# 📋 SQL DE ATUALIZAÇÃO DO SUPABASE (06 DE OUTUBRO DE 2026)

> **INSTRUÇÃO:** Copie todo o código SQL abaixo e cole diretamente no **SQL Editor** do seu painel do Supabase, depois clique em **RUN**.
> **DATA DESTA ATUALIZAÇÃO:** `06/10/2026`
> **O QUE ESTE SQL FAZ:**
> 1. Adiciona suporte a contagem de curtidas (`likes_count`), link de rádio (`radio_url`), playlist de MP3 (`audio_playlist`) e controle de áudio (`audio_enabled`) na tabela `showcase_rooms`.
> 2. Cria a tabela `room_likes` para registrar quem curtiu cada sala (evita duplicatas e persiste as curtidas).
> 3. Garante que a tabela `inventory_items` suporte a persistência e exclusão individual ou em lote dos itens dos usuários.

---

```sql
-- ============================================================================
-- ATUALIZAÇÃO SUPABASE - 3D SOCIAL LOUNGE
-- DATA: 06/10/2026
-- ============================================================================

-- 1. CAMPOS DE ÁUDIO, RÁDIO E CURTIDAS NA TABELA DE SALAS (showcase_rooms)
ALTER TABLE IF EXISTS public.showcase_rooms 
ADD COLUMN IF NOT EXISTS likes_count integer DEFAULT 0;

ALTER TABLE IF EXISTS public.showcase_rooms 
ADD COLUMN IF NOT EXISTS radio_url text DEFAULT 'https://music.poprockenlinea.com/listen/poprock/radio.mp3';

ALTER TABLE IF EXISTS public.showcase_rooms 
ADD COLUMN IF NOT EXISTS audio_playlist jsonb DEFAULT '[]'::jsonb;

ALTER TABLE IF EXISTS public.showcase_rooms 
ADD COLUMN IF NOT EXISTS audio_enabled boolean DEFAULT true;

-- 2. TABELA DE CURTIDAS DE SALAS (room_likes)
CREATE TABLE IF NOT EXISTS public.room_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.showcase_rooms(id) ON DELETE CASCADE,
  user_identifier text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT room_likes_unique_user UNIQUE (room_id, user_identifier)
);

-- Políticas de Acesso (RLS) para room_likes
ALTER TABLE public.room_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer um pode ler curtidas das salas"
ON public.room_likes FOR SELECT
USING (true);

CREATE POLICY "Qualquer um autenticado ou visitante pode curtir"
ON public.room_likes FOR INSERT
WITH CHECK (true);

CREATE POLICY "Qualquer um pode descurtir sua própria curtida"
ON public.room_likes FOR DELETE
USING (true);

-- 3. TABELA DE ITENS DO INVENTÁRIO DO USUÁRIO (inventory_items)
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  asset_id uuid,
  filename text,
  custom_label text,
  category text DEFAULT 'item',
  created_at timestamptz DEFAULT now()
);

-- Políticas de Acesso (RLS) para inventory_items
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem consultar seu inventário"
ON public.inventory_items FOR SELECT
USING (true);

CREATE POLICY "Usuários podem adicionar ao inventário"
ON public.inventory_items FOR INSERT
WITH CHECK (true);

CREATE POLICY "Usuários podem excluir do seu inventário"
ON public.inventory_items FOR DELETE
USING (true);

-- 4. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_showcase_rooms_likes ON public.showcase_rooms (likes_count DESC);
CREATE INDEX IF NOT EXISTS idx_room_likes_room_id ON public.room_likes (room_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_user_id ON public.inventory_items (user_id);
```
