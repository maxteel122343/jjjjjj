-- ==============================================================================
-- ALTER TABLE MIGRATION: showcase_rooms & store_items
-- Suporte a salas privadas com source_room_id, visibilidade, asset_id e loja
-- ==============================================================================

-- 1. Colunas para vínculo de salas privadas (source_room_id por ponteiro)
ALTER TABLE public.showcase_rooms 
ADD COLUMN IF NOT EXISTS source_room_id UUID REFERENCES public.showcase_rooms(id) ON DELETE SET NULL;

ALTER TABLE public.showcase_rooms 
ADD COLUMN IF NOT EXISTS visibility VARCHAR(32) DEFAULT 'public';

ALTER TABLE public.showcase_rooms 
ADD COLUMN IF NOT EXISTS asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL;

ALTER TABLE public.showcase_rooms 
ADD COLUMN IF NOT EXISTS owner_user_id UUID;

ALTER TABLE public.showcase_rooms 
ADD COLUMN IF NOT EXISTS title TEXT;

ALTER TABLE public.showcase_rooms 
ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- 2. Atualizar constraint de store_items para permitir 'room' além de 'sala'
ALTER TABLE public.store_items DROP CONSTRAINT IF EXISTS store_items_object_type_check;
ALTER TABLE public.store_items ADD CONSTRAINT store_items_object_type_check 
CHECK (object_type IN ('avatar', 'acessorio', 'item', 'pose', 'sala', 'room', 'moveis'));

ALTER TABLE public.store_items 
ADD COLUMN IF NOT EXISTS asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL;

ALTER TABLE public.store_items 
ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES public.showcase_rooms(id) ON DELETE CASCADE;

-- 3. Índices para performance na vitrine e buscas de relacionamento
CREATE INDEX IF NOT EXISTS idx_showcase_rooms_visibility ON public.showcase_rooms(visibility);
CREATE INDEX IF NOT EXISTS idx_showcase_rooms_source_room ON public.showcase_rooms(source_room_id);
CREATE INDEX IF NOT EXISTS idx_showcase_rooms_owner ON public.showcase_rooms(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_store_items_room_id ON public.store_items(room_id);
