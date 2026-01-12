-- =============================================================================
-- Add searchContent column for full-text search across board content
-- =============================================================================
-- This field stores aggregated plain text from all elements for searching:
-- - Text elements
-- - Markdown cards (stripped to plain text)
-- - Rich text cards (extracted from Tiptap JSON)
-- =============================================================================
-- Add the searchContent column
ALTER TABLE
    "Board"
ADD
    COLUMN "searchContent" TEXT;

-- Enable pg_trgm extension for trigram-based fuzzy search (required for ILIKE optimization)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN trigram index for efficient ILIKE/contains queries
-- This index specifically optimizes the `contains` (ILIKE '%query%') pattern used by Prisma
CREATE INDEX IF NOT EXISTS "Board_searchContent_trgm_idx" ON "Board" USING GIN ("searchContent" gin_trgm_ops);

-- Also index title and description for consistent search performance
CREATE INDEX IF NOT EXISTS "Board_title_trgm_idx" ON "Board" USING GIN ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Board_description_trgm_idx" ON "Board" USING GIN ("description" gin_trgm_ops);

-- Note: For very large deployments (100K+ boards), consider:
-- 1. Adding a dedicated search service (Elasticsearch/Meilisearch/Typesense)
-- 2. Using PostgreSQL full-text search with ts_vector for ranking
-- 3. Implementing search result caching with Redis