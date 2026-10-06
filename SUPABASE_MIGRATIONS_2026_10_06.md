# SQL MIGRATIONS SUPABASE — 06 DE OUTUBRO DE 2026

> **Data:** 2026-10-06  
> **Instruções:** Copie todo o código SQL abaixo e cole diretamente no **SQL Editor** do seu painel Supabase (ou banco PostgreSQL) e clique em **RUN**.  
> Este script é **idempotente** (pode ser executado múltiplas vezes com segurança sem apagar dados existentes).

---

```sql
-- ==============================================================================
-- 3D SOCIAL LOUNGE — MIGRAÇÃO SUPABASE / POSTGRESQL (06/10/2026)
-- Suporte a: Curtidas/Likes, Rádio Web & Playlists nas Salas, e Limpeza de Inventário
-- ==============================================================================

-- 1. ADICIONAR COLUNAS DE RÁDIO, PLAYLIST E CURTIDAS NA TABELA DE SALAS (SHOWCASE_ROOMS)
ALTER TABLE public.showcase_rooms 
  ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS radio_url TEXT DEFAULT 'https://music.poprockenlinea.com/listen/poprock/radio.mp3',
  ADD COLUMN IF NOT EXISTS audio_playlist JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS audio_enabled BOOLEAN DEFAULT true;

-- Índices para performance de busca e salas mais curtidas
CREATE INDEX IF NOT EXISTS idx_showcase_rooms_likes ON public.showcase_rooms(likes_count DESC);

-- 2. TABELA DE REGISTRO INDIVIDUAL DE CURTIDAS (ROOM_LIKES)
CREATE TABLE IF NOT EXISTS public.room_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL,
    user_identifier TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(room_id, user_identifier)
);

CREATE INDEX IF NOT EXISTS idx_room_likes_room ON public.room_likes(room_id);
CREATE INDEX IF NOT EXISTS idx_room_likes_user ON public.room_likes(user_identifier);

-- 3. POLÍTICAS ROW LEVEL SECURITY (RLS) PARA CURTIDAS
ALTER TABLE public.room_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Likes visíveis por todos" ON public.room_likes;
CREATE POLICY "Likes visíveis por todos" ON public.room_likes 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Qualquer usuário pode curtir sala" ON public.room_likes;
CREATE POLICY "Qualquer usuário pode curtir sala" ON public.room_likes 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Usuário pode remover sua curtida" ON public.room_likes;
CREATE POLICY "Usuário pode remover sua curtida" ON public.room_likes 
    FOR DELETE USING (true);

-- 4. POLÍTICAS RLS PARA PERMITIR ATUALIZAR CONTADOR DE CURTIDAS NA SALA
DROP POLICY IF EXISTS "Atualizar contagem de curtidas na sala" ON public.showcase_rooms;
CREATE POLICY "Atualizar contagem de curtidas na sala" ON public.showcase_rooms 
    FOR UPDATE USING (true);

-- 5. POLÍTICAS RLS PARA EXCLUSÃO E LIMPEZA DE ITENS DO INVENTÁRIO (INVENTORY_ITEMS)
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuário visualiza seu inventário" ON public.inventory_items;
CREATE POLICY "Usuário visualiza seu inventário" ON public.inventory_items 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Usuário insere itens no inventário" ON public.inventory_items;
CREATE POLICY "Usuário insere itens no inventário" ON public.inventory_items 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Usuário exclui itens do seu inventário" ON public.inventory_items;
CREATE POLICY "Usuário exclui itens do seu inventário" ON public.inventory_items 
    FOR DELETE USING (true);

-- 6. GARANTIR VALORES PADRÕES PARA SALAS JÁ EXISTENTES
UPDATE public.showcase_rooms 
SET 
  radio_url = COALESCE(radio_url, 'https://music.poprockenlinea.com/listen/poprock/radio.mp3'),
  audio_playlist = COALESCE(audio_playlist, '[]'::jsonb),
  audio_enabled = COALESCE(audio_enabled, true),
  likes_count = COALESCE(likes_count, 0)
WHERE radio_url IS NULL OR audio_playlist IS NULL OR audio_enabled IS NULL OR likes_count IS NULL;

-- Confirmação de execução bem sucedida
SELECT 'Migração aplicada com sucesso em ' || NOW()::text AS status;
```
