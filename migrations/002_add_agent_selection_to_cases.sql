-- Migration: 002_add_agent_selection_to_cases.sql
-- Description: Add agent_mode and selected_agents columns to cases table for direct queryability and audit trails.

ALTER TABLE cases ADD COLUMN agent_mode TEXT DEFAULT 'auto';
ALTER TABLE cases ADD COLUMN selected_agents TEXT DEFAULT '["devils_advocate","receipts","builder","overthinker"]';
