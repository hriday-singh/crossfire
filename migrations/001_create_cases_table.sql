-- Migration: 001_create_cases_table.sql
-- Description: Create cases table to persist Crossfire cases across process restarts.

CREATE TABLE IF NOT EXISTS cases (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cases_updated_at ON cases(updated_at);
