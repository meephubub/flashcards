-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.card_progress (
  id integer NOT NULL DEFAULT nextval('card_progress_id_seq'::regclass),
  card_id integer,
  ease_factor double precision NOT NULL DEFAULT 2.5,
  interval integer NOT NULL DEFAULT 0,
  repetitions integer NOT NULL DEFAULT 0,
  due_date timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  last_reviewed timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  user_id uuid,
  CONSTRAINT card_progress_pkey PRIMARY KEY (id),
  CONSTRAINT card_progress_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.cards(id)
);
CREATE TABLE public.cards (
  id integer NOT NULL DEFAULT nextval('cards_id_seq'::regclass),
  deck_id integer,
  front text NOT NULL,
  back text NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  img_url text,
  user_id uuid,
  CONSTRAINT cards_pkey PRIMARY KEY (id),
  CONSTRAINT cards_deck_id_fkey FOREIGN KEY (deck_id) REFERENCES public.decks(id)
);
CREATE TABLE public.decks (
  id integer NOT NULL DEFAULT nextval('decks_id_seq'::regclass),
  name text NOT NULL,
  description text,
  card_count integer DEFAULT 0,
  last_studied text DEFAULT 'Never'::text,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  tag text,
  user_id uuid,
  CONSTRAINT decks_pkey PRIMARY KEY (id)
);
CREATE TABLE public.notes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  content text NOT NULL,
  category text NOT NULL,
  user_id uuid,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT notes_pkey PRIMARY KEY (id)
);
CREATE TABLE public.settings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  theme text NOT NULL DEFAULT 'system'::text,
  enable_animations boolean NOT NULL DEFAULT true,
  enable_sounds boolean NOT NULL DEFAULT false,
  study_settings jsonb NOT NULL DEFAULT '{"autoFlip": false, "autoFlipDelay": 5, "cardsPerSession": 20, "showProgressBar": true, "enableSpacedRepetition": false}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  user_id uuid,
  CONSTRAINT settings_pkey PRIMARY KEY (id),
  CONSTRAINT settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);