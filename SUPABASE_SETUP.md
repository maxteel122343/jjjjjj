# Supabase & PostgreSQL Schema - 3D Social Lounge

Este documento contém todas as definições DDL, tabelas, permissões RLS e configurações do banco de dados PostgreSQL / Supabase para o projeto 3D Social Lounge.

---

## 1. Tabelas Principais

### `public.store_items`
Armazena itens da loja, avatares, poses e acessórios publicados.

```sql
CREATE TABLE IF NOT EXISTS public.store_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NULL,
    name TEXT NOT NULL,
    object_type TEXT NOT NULL, -- 'avatar', 'acessorio', 'pose', 'moveis', 'sala', 'item'
    price INTEGER DEFAULT 0,
    price_cents INTEGER DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'BRL',
    hashtags TEXT[] DEFAULT ARRAY['#3d', '#comunidade']::TEXT[],
    thumbnail_url TEXT,
    asset_id UUID NULL,
    asset_url TEXT,
    rarity TEXT DEFAULT 'COMUM', -- 'COMUM', 'RARO', 'ÉLITE'
    description TEXT,
    publish_mode TEXT DEFAULT 'simples', -- 'simples' ou 'avancado'
    metadata JSONB DEFAULT '{}'::JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    sales_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_store_items_active ON public.store_items(is_active);
CREATE INDEX IF NOT EXISTS idx_store_items_user_id ON public.store_items(user_id);
CREATE INDEX IF NOT EXISTS idx_store_items_type ON public.store_items(object_type);
```

### `public.showcase_rooms`
Armazena salas 3D publicadas na vitrine comunitária.

```sql
CREATE TABLE IF NOT EXISTS public.showcase_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NULL,
    owner_user_id UUID NULL,
    name TEXT NOT NULL,
    title TEXT,
    description TEXT,
    thumbnail_url TEXT,
    cover_url TEXT,
    model_url TEXT,
    asset_id UUID NULL,
    boundary JSONB DEFAULT '{"x": 8, "y": 3, "z": 8, "isConfirmed": true}'::JSONB,
    spots JSONB DEFAULT '[]'::JSONB,
    placed_objects JSONB DEFAULT '[]'::JSONB,
    hashtags TEXT[] DEFAULT ARRAY['#vitrine3d', '#sala']::TEXT[],
    price INTEGER DEFAULT 0,
    publish_mode TEXT DEFAULT 'simples',
    is_published BOOLEAN DEFAULT TRUE,
    visits_count INTEGER DEFAULT 0,
    visibility VARCHAR(30) DEFAULT 'public',
    source_room_id UUID NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_showcase_rooms_published ON public.showcase_rooms(is_published);
CREATE INDEX IF NOT EXISTS idx_showcase_rooms_user_id ON public.showcase_rooms(user_id);
```

### `public.assets`
Armazena metadados de binários 3D (`model.glb`) persistidos no Object Storage S3.

```sql
CREATE TABLE IF NOT EXISTS public.assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL,
    storage_bucket TEXT NOT NULL DEFAULT 'models',
    storage_key TEXT NOT NULL,
    format VARCHAR(20) NOT NULL DEFAULT 'glb',
    category VARCHAR(50) NOT NULL, -- 'avatar', 'accessory', 'room_mesh', 'furniture', 'prop'
    mime_type VARCHAR(100) NOT NULL DEFAULT 'model/gltf-binary',
    byte_size BIGINT NOT NULL,
    sha256_checksum VARCHAR(64) NOT NULL,
    etag VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'uploading', -- 'uploading', 'ready', 'failed'
    version INTEGER NOT NULL DEFAULT 1,
    visibility VARCHAR(30) NOT NULL DEFAULT 'public_marketplace',
    failure_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assets_owner ON public.assets(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_assets_status ON public.assets(status);
```

### `public.inventory_items`
Inventário de itens adquiridos/carregados por cada usuário.

```sql
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    custom_label TEXT,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    is_favorite BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    acquired_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inventory_user ON public.inventory_items(user_id);
```

---

## 2. Row Level Security (RLS)

Políticas universais para visualização pública e gerenciamento de publicações:

```sql
-- Ativação de RLS
ALTER TABLE public.store_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.showcase_rooms ENABLE ROW LEVEL SECURITY;

-- store_items
DROP POLICY IF EXISTS "Itens ativos visíveis por todos" ON public.store_items;
CREATE POLICY "Itens ativos visíveis por todos" ON public.store_items
    FOR SELECT USING (is_active = true OR auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Criadores publicam itens" ON public.store_items;
CREATE POLICY "Criadores publicam itens" ON public.store_items
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Criadores atualizam itens" ON public.store_items;
CREATE POLICY "Criadores atualizam itens" ON public.store_items
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Criadores excluem itens" ON public.store_items;
CREATE POLICY "Criadores excluem itens" ON public.store_items
    FOR DELETE USING (true);

-- showcase_rooms
DROP POLICY IF EXISTS "Salas públicas visíveis por todos" ON public.showcase_rooms;
CREATE POLICY "Salas públicas visíveis por todos" ON public.showcase_rooms
    FOR SELECT USING (is_published = true OR auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Criadores publicam salas" ON public.showcase_rooms;
CREATE POLICY "Criadores publicam salas" ON public.showcase_rooms
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Criadores atualizam salas" ON public.showcase_rooms;
CREATE POLICY "Criadores atualizam salas" ON public.showcase_rooms
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Criadores excluem salas" ON public.showcase_rooms;
CREATE POLICY "Criadores excluem salas" ON public.showcase_rooms
    FOR DELETE USING (true);
```

---

## 3. Storage Bucket

O bucket no Supabase Storage deve se chamar `models`.
No painel do Supabase Storage, certifique-se de que o bucket `models` está criado (ou via SQL):

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('models', 'models', true)
ON CONFLICT (id) DO UPDATE SET public = true;
```
