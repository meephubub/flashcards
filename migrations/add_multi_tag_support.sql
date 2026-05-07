-- Migration to support multiple tags per card
-- Creates tags table and card_tags junction table
-- Migrates existing single tags to the new structure

-- Create tags table
CREATE TABLE IF NOT EXISTS public.tags (
  id serial NOT NULL,
  name text NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT tags_pkey PRIMARY KEY (id),
  CONSTRAINT tags_name_user_id_unique UNIQUE (name, user_id)
) TABLESPACE pg_default;

-- Create card_tags junction table
CREATE TABLE IF NOT EXISTS public.card_tags (
  id serial NOT NULL,
  card_id integer NOT NULL,
  tag_id integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT card_tags_pkey PRIMARY KEY (id),
  CONSTRAINT card_tags_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.cards (id) ON DELETE CASCADE,
  CONSTRAINT card_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags (id) ON DELETE CASCADE,
  CONSTRAINT card_tags_unique UNIQUE (card_id, tag_id)
) TABLESPACE pg_default;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON public.tags USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_card_tags_card_id ON public.card_tags USING btree (card_id);
CREATE INDEX IF NOT EXISTS idx_card_tags_tag_id ON public.card_tags USING btree (tag_id);

-- Migrate existing single tags to the new structure
-- Only migrate cards that have non-null, non-empty tags
INSERT INTO public.tags (name, user_id)
SELECT DISTINCT 
  TRIM(card.tag) as tag_name,
  card.user_id
FROM public.cards card
WHERE card.tag IS NOT NULL 
  AND TRIM(card.tag) != ''
  AND card.user_id IS NOT NULL
ON CONFLICT (name, user_id) 
DO NOTHING;

-- Create card_tags relationships for migrated tags
INSERT INTO public.card_tags (card_id, tag_id)
SELECT 
  card.id as card_id,
  tag.id as tag_id
FROM public.cards card
JOIN public.tags tag ON TRIM(card.tag) = tag.name AND card.user_id = tag.user_id
WHERE card.tag IS NOT NULL 
  AND TRIM(card.tag) != ''
  AND card.user_id IS NOT NULL
ON CONFLICT (card_id, tag_id) 
DO NOTHING;

-- Drop the old tag column from cards table
ALTER TABLE public.cards DROP COLUMN IF EXISTS tag;

-- Enable RLS on new tables
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_tags ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tags table
CREATE POLICY "Users can read their own tags" ON public.tags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own tags" ON public.tags FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own tags" ON public.tags FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own tags" ON public.tags FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for card_tags table
CREATE POLICY "Users can read card tags for their cards" ON public.card_tags FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.cards 
    WHERE cards.id = card_tags.card_id 
    AND cards.user_id = auth.uid()
  )
);
CREATE POLICY "Users can create card tags for their cards" ON public.card_tags FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cards 
    WHERE cards.id = card_tags.card_id 
    AND cards.user_id = auth.uid()
  )
);
CREATE POLICY "Users can delete card tags for their cards" ON public.card_tags FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.cards 
    WHERE cards.id = card_tags.card_id 
    AND cards.user_id = auth.uid()
  )
);
