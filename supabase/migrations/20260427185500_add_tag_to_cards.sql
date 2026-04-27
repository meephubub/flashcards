-- Migration: Add tag column to cards table
ALTER TABLE public.cards ADD COLUMN tag text;
