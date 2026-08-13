-- Forward-only PostgreSQL schema for the synthetic internal vertical slice.
-- Tenant-owned references use composite keys so cross-organisation links fail closed.

CREATE TABLE organisations (
  id text PRIMARY KEY,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  locale text NOT NULL CHECK (locale = 'de-DE'),
  currency text NOT NULL CHECK (currency = 'EUR'),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE TABLE users (
  id text PRIMARY KEY,
  display_name text NOT NULL CHECK (length(btrim(display_name)) > 0),
  synthetic boolean NOT NULL CHECK (synthetic)
);

CREATE TABLE memberships (
  organisation_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  id text NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('OWNER', 'MEMBER', 'REVIEWER')),
  active boolean NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (organisation_id, id),
  UNIQUE (organisation_id, user_id)
);

CREATE TABLE customers (
  organisation_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  id text NOT NULL,
  display_name text NOT NULL CHECK (length(btrim(display_name)) > 0),
  synthetic boolean NOT NULL CHECK (synthetic),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (organisation_id, id)
);

CREATE TABLE projects (
  organisation_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  id text NOT NULL,
  customer_id text NOT NULL,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  location_label text,
  synthetic boolean NOT NULL CHECK (synthetic),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (organisation_id, id),
  FOREIGN KEY (organisation_id, customer_id)
    REFERENCES customers(organisation_id, id) ON DELETE RESTRICT
);

CREATE TABLE site_visits (
  organisation_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  id text NOT NULL,
  project_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('OPEN', 'PROCESSING', 'COMPLETE')),
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (organisation_id, id),
  FOREIGN KEY (organisation_id, project_id)
    REFERENCES projects(organisation_id, id) ON DELETE CASCADE,
  CHECK (completed_at IS NULL OR completed_at >= started_at)
);

CREATE TABLE evidence_assets (
  organisation_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  id text NOT NULL,
  site_visit_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('AUDIO', 'PHOTO')),
  filename text NOT NULL CHECK (length(filename) BETWEEN 1 AND 255),
  media_type text NOT NULL CHECK (length(media_type) BETWEEN 1 AND 120),
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  checksum_sha256 text NOT NULL CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  object_key text NOT NULL UNIQUE CHECK (length(object_key) BETWEEN 1 AND 500),
  authority text NOT NULL CHECK (authority IN ('AUTHORITATIVE', 'CONTEXT_ONLY')),
  synthetic boolean NOT NULL CHECK (synthetic),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (organisation_id, id),
  FOREIGN KEY (organisation_id, site_visit_id)
    REFERENCES site_visits(organisation_id, id) ON DELETE CASCADE,
  CHECK (kind <> 'PHOTO' OR authority = 'CONTEXT_ONLY')
);

CREATE TABLE voice_notes (
  organisation_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  id text NOT NULL,
  evidence_asset_id text,
  site_visit_id text NOT NULL,
  transcript_fallback boolean NOT NULL,
  transcript_status text NOT NULL CHECK (transcript_status IN ('PENDING', 'READY', 'FAILED')),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (organisation_id, id),
  FOREIGN KEY (organisation_id, evidence_asset_id)
    REFERENCES evidence_assets(organisation_id, id) ON DELETE SET NULL (evidence_asset_id),
  FOREIGN KEY (organisation_id, site_visit_id)
    REFERENCES site_visits(organisation_id, id) ON DELETE CASCADE
);

CREATE TABLE transcript_segments (
  organisation_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  id text NOT NULL,
  voice_note_id text NOT NULL,
  start_ms integer NOT NULL CHECK (start_ms >= 0),
  end_ms integer NOT NULL CHECK (end_ms > start_ms),
  text text NOT NULL CHECK (length(text) > 0),
  language text NOT NULL CHECK (length(language) BETWEEN 2 AND 35),
  human_edited boolean NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (organisation_id, id),
  FOREIGN KEY (organisation_id, voice_note_id)
    REFERENCES voice_notes(organisation_id, id) ON DELETE CASCADE
);

CREATE TABLE photo_evidence (
  organisation_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  id text NOT NULL,
  evidence_asset_id text NOT NULL,
  caption text,
  authority text NOT NULL DEFAULT 'CONTEXT_ONLY' CHECK (authority = 'CONTEXT_ONLY'),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (organisation_id, id),
  UNIQUE (organisation_id, evidence_asset_id),
  FOREIGN KEY (organisation_id, evidence_asset_id)
    REFERENCES evidence_assets(organisation_id, id) ON DELETE CASCADE
);

CREATE TABLE measurements (
  organisation_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  id text NOT NULL,
  site_visit_id text NOT NULL,
  label text NOT NULL CHECK (length(btrim(label)) > 0),
  context text NOT NULL CHECK (length(btrim(context)) > 0),
  quantity_value text NOT NULL CHECK (
    quantity_value ~ '^[0-9]{1,12}(\.[0-9]{1,6})?$'
    AND quantity_value::numeric > 0
  ),
  quantity_unit text NOT NULL CHECK (quantity_unit IN ('M2', 'M', 'STK', 'STD', 'PAUSCHALE')),
  authority text NOT NULL DEFAULT 'AUTHORITATIVE' CHECK (authority = 'AUTHORITATIVE'),
  confirmed_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (organisation_id, id),
  FOREIGN KEY (organisation_id, site_visit_id)
    REFERENCES site_visits(organisation_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organisation_id, confirmed_by_user_id)
    REFERENCES memberships(organisation_id, user_id) ON DELETE RESTRICT
);

CREATE TABLE extraction_runs (
  organisation_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  id text NOT NULL,
  site_visit_id text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('DETERMINISTIC_FAKE', 'LIVE_FLAGGED')),
  model text NOT NULL,
  prompt_version text NOT NULL,
  schema_version text NOT NULL CHECK (schema_version = 'handwerk.vertical-slice.v1'),
  status text NOT NULL CHECK (status IN ('PENDING', 'SUCCEEDED', 'FAILED_SAFE')),
  duration_ms integer CHECK (duration_ms >= 0),
  token_count_placeholder integer CHECK (token_count_placeholder >= 0),
  cost_minor_placeholder integer CHECK (cost_minor_placeholder >= 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (organisation_id, id),
  FOREIGN KEY (organisation_id, site_visit_id)
    REFERENCES site_visits(organisation_id, id) ON DELETE CASCADE
);

CREATE TABLE source_citations (
  organisation_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  id text NOT NULL,
  project_id text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN (
    'TRANSCRIPT_SEGMENT', 'EXPLICIT_MEASUREMENT', 'USER_ANSWER', 'COMPANY_RULE', 'PHOTO_CONTEXT'
  )),
  source_entity_id text NOT NULL,
  locator text NOT NULL CHECK (length(locator) > 0),
  extraction_version text NOT NULL CHECK (length(extraction_version) > 0),
  explanation text NOT NULL CHECK (length(explanation) > 0),
  authority text NOT NULL CHECK (authority IN ('AUTHORITATIVE', 'CONTEXT_ONLY')),
  PRIMARY KEY (organisation_id, id),
  FOREIGN KEY (organisation_id, project_id)
    REFERENCES projects(organisation_id, id) ON DELETE CASCADE,
  CHECK (source_type <> 'PHOTO_CONTEXT' OR authority = 'CONTEXT_ONLY')
);

CREATE TABLE extracted_facts (
  organisation_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  id text NOT NULL,
  extraction_run_id text NOT NULL,
  key text NOT NULL CHECK (length(key) BETWEEN 1 AND 100),
  value_json jsonb,
  unit text CHECK (unit IN ('M2', 'M', 'STK', 'STD', 'PAUSCHALE')),
  status text NOT NULL CHECK (status IN ('CONFIRMED', 'UNCERTAIN', 'UNKNOWN', 'CONTRADICTORY')),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (organisation_id, id),
  FOREIGN KEY (organisation_id, extraction_run_id)
    REFERENCES extraction_runs(organisation_id, id) ON DELETE CASCADE
);

CREATE TABLE extracted_fact_citations (
  organisation_id text NOT NULL,
  extracted_fact_id text NOT NULL,
  citation_id text NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  PRIMARY KEY (organisation_id, extracted_fact_id, citation_id),
  UNIQUE (organisation_id, extracted_fact_id, position),
  FOREIGN KEY (organisation_id, extracted_fact_id)
    REFERENCES extracted_facts(organisation_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organisation_id, citation_id)
    REFERENCES source_citations(organisation_id, id) ON DELETE CASCADE
);

CREATE TABLE price_books (
  organisation_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  id text NOT NULL,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  active boolean NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (organisation_id, id)
);

CREATE TABLE price_book_items (
  organisation_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  id text NOT NULL,
  price_book_id text NOT NULL,
  code text NOT NULL CHECK (length(btrim(code)) BETWEEN 1 AND 80),
  description text NOT NULL CHECK (length(btrim(description)) > 0),
  category text NOT NULL CHECK (length(btrim(category)) > 0),
  unit text NOT NULL CHECK (unit IN ('M2', 'M', 'STK', 'STD', 'PAUSCHALE')),
  unit_price_minor bigint NOT NULL CHECK (unit_price_minor >= 0 AND unit_price_minor <= 9007199254740991),
  currency text NOT NULL DEFAULT 'EUR' CHECK (currency = 'EUR'),
  tax_category text NOT NULL CHECK (tax_category IN ('STANDARD_19', 'REDUCED_7', 'EXEMPT')),
  tax_rate_basis_points integer NOT NULL CHECK (tax_rate_basis_points BETWEEN 0 AND 10000),
  active boolean NOT NULL,
  valid_from date,
  valid_to date,
  synonyms jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(synonyms) = 'array'),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (organisation_id, id),
  UNIQUE (organisation_id, price_book_id, code),
  FOREIGN KEY (organisation_id, price_book_id)
    REFERENCES price_books(organisation_id, id) ON DELETE CASCADE,
  CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from),
  CHECK (
    (tax_category = 'STANDARD_19' AND tax_rate_basis_points = 1900)
    OR (tax_category = 'REDUCED_7' AND tax_rate_basis_points = 700)
    OR (tax_category = 'EXEMPT' AND tax_rate_basis_points = 0)
  )
);

CREATE TABLE mapping_proposals (
  organisation_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  id text NOT NULL,
  extracted_fact_id text NOT NULL,
  price_book_item_id text,
  status text NOT NULL CHECK (status IN ('SUPPORTED', 'UNMATCHED', 'NEEDS_CLARIFICATION', 'REJECTED')),
  explanation text NOT NULL CHECK (length(explanation) > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (organisation_id, id),
  FOREIGN KEY (organisation_id, extracted_fact_id)
    REFERENCES extracted_facts(organisation_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organisation_id, price_book_item_id)
    REFERENCES price_book_items(organisation_id, id) ON DELETE RESTRICT,
  CHECK (
    (status = 'SUPPORTED' AND price_book_item_id IS NOT NULL)
    OR status <> 'SUPPORTED'
  )
);

CREATE TABLE mapping_proposal_citations (
  organisation_id text NOT NULL,
  mapping_proposal_id text NOT NULL,
  citation_id text NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  PRIMARY KEY (organisation_id, mapping_proposal_id, citation_id),
  UNIQUE (organisation_id, mapping_proposal_id, position),
  FOREIGN KEY (organisation_id, mapping_proposal_id)
    REFERENCES mapping_proposals(organisation_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organisation_id, citation_id)
    REFERENCES source_citations(organisation_id, id) ON DELETE CASCADE
);

CREATE TABLE clarification_questions (
  organisation_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  id text NOT NULL,
  project_id text NOT NULL,
  key text NOT NULL CHECK (length(key) BETWEEN 1 AND 100),
  prompt text NOT NULL CHECK (length(prompt) > 0),
  rationale text NOT NULL CHECK (length(rationale) > 0),
  answer_type text NOT NULL CHECK (answer_type IN ('BOOLEAN', 'SINGLE_CHOICE', 'TEXT', 'QUANTITY')),
  options jsonb CHECK (options IS NULL OR jsonb_typeof(options) = 'array'),
  severity text NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
  blocking boolean NOT NULL,
  status text NOT NULL CHECK (status IN ('OPEN', 'ANSWERED', 'STALE')),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (organisation_id, id),
  UNIQUE (organisation_id, project_id, key),
  FOREIGN KEY (organisation_id, project_id)
    REFERENCES projects(organisation_id, id) ON DELETE CASCADE
);

CREATE TABLE clarification_question_citations (
  organisation_id text NOT NULL,
  question_id text NOT NULL,
  citation_id text NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  PRIMARY KEY (organisation_id, question_id, citation_id),
  UNIQUE (organisation_id, question_id, position),
  FOREIGN KEY (organisation_id, question_id)
    REFERENCES clarification_questions(organisation_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organisation_id, citation_id)
    REFERENCES source_citations(organisation_id, id) ON DELETE CASCADE
);

CREATE TABLE clarification_answers (
  organisation_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  id text NOT NULL,
  question_id text NOT NULL,
  answered_by_user_id text NOT NULL,
  value_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (organisation_id, id),
  FOREIGN KEY (organisation_id, question_id)
    REFERENCES clarification_questions(organisation_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organisation_id, answered_by_user_id)
    REFERENCES memberships(organisation_id, user_id) ON DELETE RESTRICT
);

CREATE TABLE offer_drafts (
  organisation_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  id text NOT NULL,
  project_id text NOT NULL,
  state text NOT NULL CHECK (state IN (
    'CAPTURING', 'PROCESSING', 'NEEDS_CLARIFICATION', 'READY_FOR_REVIEW', 'APPROVED', 'EXPORTED'
  )),
  current_revision integer NOT NULL CHECK (current_revision >= 0),
  approved_revision integer,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (organisation_id, id),
  UNIQUE (organisation_id, project_id),
  FOREIGN KEY (organisation_id, project_id)
    REFERENCES projects(organisation_id, id) ON DELETE CASCADE,
  CHECK (approved_revision IS NULL OR approved_revision = current_revision),
  CHECK (
    (state IN ('APPROVED', 'EXPORTED') AND approved_revision = current_revision)
    OR (state NOT IN ('APPROVED', 'EXPORTED') AND approved_revision IS NULL)
  )
);

CREATE TABLE offer_draft_revisions (
  organisation_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  id text NOT NULL,
  offer_draft_id text NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  excluded_items jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(excluded_items) = 'array'),
  unmatched_items jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(unmatched_items) = 'array'),
  net_total_minor bigint NOT NULL CHECK (net_total_minor >= 0 AND net_total_minor <= 9007199254740991),
  tax_total_minor bigint NOT NULL CHECK (tax_total_minor >= 0 AND tax_total_minor <= 9007199254740991),
  gross_total_minor bigint NOT NULL CHECK (gross_total_minor >= 0 AND gross_total_minor <= 9007199254740991),
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (organisation_id, id),
  UNIQUE (organisation_id, offer_draft_id, revision),
  FOREIGN KEY (organisation_id, offer_draft_id)
    REFERENCES offer_drafts(organisation_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organisation_id, created_by_user_id)
    REFERENCES memberships(organisation_id, user_id) ON DELETE RESTRICT,
  CHECK (gross_total_minor = net_total_minor + tax_total_minor)
);

CREATE TABLE offer_lines (
  organisation_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  id text NOT NULL,
  offer_draft_id text NOT NULL,
  revision integer NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  price_book_item_id text NOT NULL,
  item_code text NOT NULL CHECK (length(item_code) > 0),
  description text NOT NULL CHECK (length(description) > 0),
  quantity_value text NOT NULL CHECK (
    quantity_value ~ '^[0-9]{1,12}(\.[0-9]{1,6})?$'
    AND quantity_value::numeric > 0
  ),
  quantity_unit text NOT NULL CHECK (quantity_unit IN ('M2', 'M', 'STK', 'STD', 'PAUSCHALE')),
  unit_price_minor bigint NOT NULL CHECK (unit_price_minor >= 0 AND unit_price_minor <= 9007199254740991),
  net_total_minor bigint NOT NULL CHECK (net_total_minor >= 0 AND net_total_minor <= 9007199254740991),
  tax_category text NOT NULL CHECK (tax_category IN ('STANDARD_19', 'REDUCED_7', 'EXEMPT')),
  tax_rate_basis_points integer NOT NULL CHECK (tax_rate_basis_points BETWEEN 0 AND 10000),
  tax_total_minor bigint NOT NULL CHECK (tax_total_minor >= 0 AND tax_total_minor <= 9007199254740991),
  gross_total_minor bigint NOT NULL CHECK (gross_total_minor >= 0 AND gross_total_minor <= 9007199254740991),
  calculation text NOT NULL CHECK (length(calculation) > 0),
  risk text NOT NULL CHECK (risk IN ('CONFIRMED', 'LOW_RISK', 'NEEDS_REVIEW', 'BLOCKING')),
  origin text NOT NULL CHECK (origin IN ('GENERATED', 'EDITED', 'CONFIRMED')),
  PRIMARY KEY (organisation_id, offer_draft_id, revision, id),
  UNIQUE (organisation_id, offer_draft_id, revision, position),
  FOREIGN KEY (organisation_id, offer_draft_id, revision)
    REFERENCES offer_draft_revisions(organisation_id, offer_draft_id, revision) ON DELETE CASCADE,
  FOREIGN KEY (organisation_id, price_book_item_id)
    REFERENCES price_book_items(organisation_id, id) ON DELETE RESTRICT,
  CHECK (gross_total_minor = net_total_minor + tax_total_minor)
);

CREATE TABLE offer_line_citations (
  organisation_id text NOT NULL,
  offer_draft_id text NOT NULL,
  revision integer NOT NULL,
  offer_line_id text NOT NULL,
  citation_id text NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  PRIMARY KEY (organisation_id, offer_draft_id, revision, offer_line_id, citation_id),
  UNIQUE (organisation_id, offer_draft_id, revision, offer_line_id, position),
  FOREIGN KEY (organisation_id, offer_draft_id, revision, offer_line_id)
    REFERENCES offer_lines(organisation_id, offer_draft_id, revision, id) ON DELETE CASCADE,
  FOREIGN KEY (organisation_id, citation_id)
    REFERENCES source_citations(organisation_id, id) ON DELETE CASCADE
);

CREATE TABLE human_approvals (
  organisation_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  id text NOT NULL,
  offer_draft_id text NOT NULL,
  revision integer NOT NULL,
  approved_by_user_id text NOT NULL,
  confirmation_text text NOT NULL CHECK (length(btrim(confirmation_text)) >= 10),
  approved_at timestamptz NOT NULL,
  invalidated_at timestamptz,
  invalidation_reason text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (organisation_id, id),
  FOREIGN KEY (organisation_id, offer_draft_id, revision)
    REFERENCES offer_draft_revisions(organisation_id, offer_draft_id, revision) ON DELETE CASCADE,
  FOREIGN KEY (organisation_id, approved_by_user_id)
    REFERENCES memberships(organisation_id, user_id) ON DELETE RESTRICT,
  CHECK (
    (invalidated_at IS NULL AND invalidation_reason IS NULL)
    OR (invalidated_at IS NOT NULL AND length(btrim(invalidation_reason)) > 0)
  )
);

CREATE UNIQUE INDEX one_active_approval_per_draft
  ON human_approvals (organisation_id, offer_draft_id)
  WHERE invalidated_at IS NULL;

CREATE TABLE export_artifacts (
  organisation_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  id text NOT NULL,
  offer_draft_id text NOT NULL,
  revision integer NOT NULL,
  kind text NOT NULL CHECK (kind IN ('PDF', 'CSV', 'PROJECT_DATA')),
  filename text NOT NULL CHECK (length(filename) BETWEEN 1 AND 255),
  media_type text NOT NULL CHECK (length(media_type) BETWEEN 1 AND 120),
  checksum_sha256 text NOT NULL CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (organisation_id, id),
  FOREIGN KEY (organisation_id, offer_draft_id, revision)
    REFERENCES offer_draft_revisions(organisation_id, offer_draft_id, revision) ON DELETE CASCADE
);

CREATE TABLE audit_events (
  organisation_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  id text NOT NULL,
  project_id text NOT NULL,
  actor_user_id text NOT NULL,
  type text NOT NULL CHECK (type IN (
    'CAPTURE_CREATED', 'EXTRACTION_COMPLETED', 'MAPPING_COMPLETED',
    'CLARIFICATION_ANSWERED', 'DRAFT_EDITED', 'DRAFT_APPROVED',
    'APPROVAL_INVALIDATED', 'EXPORT_CREATED', 'DATA_EXPORT_REQUESTED',
    'DELETION_REQUESTED', 'DEMO_DATA_DELETED'
  )),
  occurred_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  correlation_id text NOT NULL CHECK (length(correlation_id) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (organisation_id, id),
  FOREIGN KEY (organisation_id, project_id)
    REFERENCES projects(organisation_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organisation_id, actor_user_id)
    REFERENCES memberships(organisation_id, user_id) ON DELETE RESTRICT
);

CREATE TABLE deletion_requests (
  organisation_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  id text NOT NULL,
  project_id text NOT NULL,
  requested_by_user_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED')),
  consequence_acknowledged boolean NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (organisation_id, id),
  FOREIGN KEY (organisation_id, project_id)
    REFERENCES projects(organisation_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organisation_id, requested_by_user_id)
    REFERENCES memberships(organisation_id, user_id) ON DELETE RESTRICT,
  CHECK (status = 'REQUESTED' OR status = 'CANCELLED' OR consequence_acknowledged)
);

-- A minimal receipt survives demo project deletion. It contains no project/customer identity.
CREATE TABLE deletion_receipts (
  organisation_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  request_id text NOT NULL,
  completed_at timestamptz NOT NULL,
  record_counts jsonb NOT NULL CHECK (jsonb_typeof(record_counts) = 'object'),
  purge_after date NOT NULL,
  PRIMARY KEY (organisation_id, request_id)
);

CREATE OR REPLACE FUNCTION handwerk_validate_offer_line()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  approved_item record;
  expected_net bigint;
  expected_tax bigint;
BEGIN
  SELECT
    item.code,
    item.unit,
    item.unit_price_minor,
    item.tax_category,
    item.tax_rate_basis_points,
    item.active AS item_active,
    item.valid_from,
    item.valid_to,
    book.active AS book_active
  INTO approved_item
  FROM price_book_items item
  JOIN price_books book
    ON book.organisation_id = item.organisation_id
   AND book.id = item.price_book_id
  WHERE item.organisation_id = NEW.organisation_id
    AND item.id = NEW.price_book_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'approved price-book item not found for organisation'
      USING ERRCODE = '23514';
  END IF;
  IF NOT approved_item.book_active OR NOT approved_item.item_active
     OR (approved_item.valid_from IS NOT NULL AND approved_item.valid_from > CURRENT_DATE)
     OR (approved_item.valid_to IS NOT NULL AND approved_item.valid_to < CURRENT_DATE) THEN
    RAISE EXCEPTION 'inactive or ineffective price-book item cannot be priced'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.item_code <> approved_item.code
     OR NEW.quantity_unit <> approved_item.unit
     OR NEW.unit_price_minor <> approved_item.unit_price_minor
     OR NEW.tax_category <> approved_item.tax_category
     OR NEW.tax_rate_basis_points <> approved_item.tax_rate_basis_points THEN
    RAISE EXCEPTION 'commercial line must copy code, unit, price, and tax from approved item'
      USING ERRCODE = '23514';
  END IF;

  expected_net := round(NEW.unit_price_minor::numeric * NEW.quantity_value::numeric, 0)::bigint;
  expected_tax := round(expected_net::numeric * NEW.tax_rate_basis_points::numeric / 10000, 0)::bigint;
  IF NEW.net_total_minor <> expected_net
     OR NEW.tax_total_minor <> expected_tax
     OR NEW.gross_total_minor <> expected_net + expected_tax THEN
    RAISE EXCEPTION 'commercial line totals do not match exact line-level rounding'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_offer_line
BEFORE INSERT OR UPDATE ON offer_lines
FOR EACH ROW EXECUTE FUNCTION handwerk_validate_offer_line();

CREATE OR REPLACE FUNCTION handwerk_validate_revision_totals()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_organisation_id text;
  target_offer_draft_id text;
  target_revision integer;
  expected record;
  stored record;
BEGIN
  target_organisation_id := COALESCE(NEW.organisation_id, OLD.organisation_id);
  target_offer_draft_id := COALESCE(NEW.offer_draft_id, OLD.offer_draft_id);
  target_revision := COALESCE(NEW.revision, OLD.revision);

  SELECT
    COALESCE(sum(net_total_minor), 0)::bigint AS net,
    COALESCE(sum(tax_total_minor), 0)::bigint AS tax,
    COALESCE(sum(gross_total_minor), 0)::bigint AS gross
  INTO expected
  FROM offer_lines
  WHERE organisation_id = target_organisation_id
    AND offer_draft_id = target_offer_draft_id
    AND revision = target_revision;

  SELECT net_total_minor, tax_total_minor, gross_total_minor
  INTO stored
  FROM offer_draft_revisions
  WHERE organisation_id = target_organisation_id
    AND offer_draft_id = target_offer_draft_id
    AND revision = target_revision;

  IF FOUND AND (
    stored.net_total_minor <> expected.net
    OR stored.tax_total_minor <> expected.tax
    OR stored.gross_total_minor <> expected.gross
  ) THEN
    RAISE EXCEPTION 'revision totals do not equal rounded offer-line sums'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER validate_revision_row_totals
AFTER INSERT OR UPDATE ON offer_draft_revisions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION handwerk_validate_revision_totals();

CREATE CONSTRAINT TRIGGER validate_revision_line_totals
AFTER INSERT OR UPDATE OR DELETE ON offer_lines
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION handwerk_validate_revision_totals();

CREATE OR REPLACE FUNCTION handwerk_validate_draft_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  valid_transition boolean;
  approval_exists boolean;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.version <> OLD.version + 1 THEN
      RAISE EXCEPTION 'draft version must increment exactly once'
        USING ERRCODE = '40001';
    END IF;

    valid_transition := CASE OLD.state
      WHEN 'CAPTURING' THEN NEW.state = 'PROCESSING'
      WHEN 'PROCESSING' THEN NEW.state IN ('NEEDS_CLARIFICATION', 'READY_FOR_REVIEW')
      WHEN 'NEEDS_CLARIFICATION' THEN NEW.state = 'READY_FOR_REVIEW'
      WHEN 'READY_FOR_REVIEW' THEN NEW.state = 'APPROVED'
      WHEN 'APPROVED' THEN NEW.state IN ('READY_FOR_REVIEW', 'EXPORTED')
      WHEN 'EXPORTED' THEN NEW.state = 'READY_FOR_REVIEW'
      ELSE false
    END;

    IF NEW.state <> OLD.state AND NOT valid_transition THEN
      RAISE EXCEPTION 'invalid draft state transition from % to %', OLD.state, NEW.state
        USING ERRCODE = '23514';
    END IF;
    IF NEW.current_revision <> OLD.current_revision THEN
      IF NEW.current_revision <> OLD.current_revision + 1 OR NEW.state <> 'READY_FOR_REVIEW' THEN
        RAISE EXCEPTION 'commercial revision must increment once and return to review'
          USING ERRCODE = '23514';
      END IF;
    END IF;
    IF OLD.state IN ('APPROVED', 'EXPORTED') AND NEW.state = 'READY_FOR_REVIEW'
       AND NEW.current_revision <> OLD.current_revision + 1 THEN
      RAISE EXCEPTION 'leaving an approved state requires a new commercial revision'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.state IN ('APPROVED', 'EXPORTED') THEN
    IF NEW.approved_revision IS DISTINCT FROM NEW.current_revision THEN
      RAISE EXCEPTION 'approved state must reference current revision'
        USING ERRCODE = '23514';
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM human_approvals approval
      WHERE approval.organisation_id = NEW.organisation_id
        AND approval.offer_draft_id = NEW.id
        AND approval.revision = NEW.current_revision
        AND approval.invalidated_at IS NULL
    ) INTO approval_exists;
    IF NOT approval_exists THEN
      RAISE EXCEPTION 'approved state requires active revision-bound human approval'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.approved_revision IS NOT NULL THEN
    RAISE EXCEPTION 'unapproved state cannot retain approved revision'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_draft_update
BEFORE INSERT OR UPDATE ON offer_drafts
FOR EACH ROW EXECUTE FUNCTION handwerk_validate_draft_update();

CREATE OR REPLACE FUNCTION handwerk_validate_human_approval()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  draft record;
  allowed_reviewer boolean;
BEGIN
  SELECT state, current_revision
  INTO draft
  FROM offer_drafts
  WHERE organisation_id = NEW.organisation_id
    AND id = NEW.offer_draft_id
  FOR SHARE;

  IF NOT FOUND OR draft.state <> 'READY_FOR_REVIEW' OR draft.current_revision <> NEW.revision THEN
    RAISE EXCEPTION 'approval must bind to current review-ready revision'
      USING ERRCODE = '23514';
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM memberships membership
    WHERE membership.organisation_id = NEW.organisation_id
      AND membership.user_id = NEW.approved_by_user_id
      AND membership.active
      AND membership.role IN ('OWNER', 'REVIEWER')
  ) INTO allowed_reviewer;
  IF NOT allowed_reviewer THEN
    RAISE EXCEPTION 'approval requires active owner or reviewer membership'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_human_approval
BEFORE INSERT ON human_approvals
FOR EACH ROW EXECUTE FUNCTION handwerk_validate_human_approval();

CREATE OR REPLACE FUNCTION handwerk_invalidate_approval_after_edit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.current_revision <> OLD.current_revision THEN
    UPDATE human_approvals
    SET invalidated_at = NEW.updated_at,
        invalidation_reason = 'COMMERCIAL_EDIT',
        updated_at = NEW.updated_at,
        version = version + 1
    WHERE organisation_id = NEW.organisation_id
      AND offer_draft_id = NEW.id
      AND invalidated_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER invalidate_approval_after_edit
AFTER UPDATE ON offer_drafts
FOR EACH ROW EXECUTE FUNCTION handwerk_invalidate_approval_after_edit();

CREATE OR REPLACE FUNCTION handwerk_validate_export_approval()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  export_allowed boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM offer_drafts draft
    JOIN human_approvals approval
      ON approval.organisation_id = draft.organisation_id
     AND approval.offer_draft_id = draft.id
     AND approval.revision = draft.current_revision
     AND approval.invalidated_at IS NULL
    WHERE draft.organisation_id = NEW.organisation_id
      AND draft.id = NEW.offer_draft_id
      AND draft.current_revision = NEW.revision
      AND draft.approved_revision = draft.current_revision
      AND draft.state IN ('APPROVED', 'EXPORTED')
  ) INTO export_allowed;
  IF NOT export_allowed THEN
    RAISE EXCEPTION 'export requires active approval for current revision'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_export_approval
BEFORE INSERT ON export_artifacts
FOR EACH ROW EXECUTE FUNCTION handwerk_validate_export_approval();

CREATE INDEX projects_customer_idx ON projects (organisation_id, customer_id);
CREATE INDEX site_visits_project_idx ON site_visits (organisation_id, project_id);
CREATE INDEX evidence_assets_visit_idx ON evidence_assets (organisation_id, site_visit_id);
CREATE INDEX price_book_items_active_idx ON price_book_items (organisation_id, price_book_id, active);
CREATE INDEX clarification_questions_project_idx ON clarification_questions (organisation_id, project_id, status);
CREATE INDEX offer_draft_revisions_draft_idx ON offer_draft_revisions (organisation_id, offer_draft_id, revision DESC);
CREATE INDEX audit_events_project_idx ON audit_events (organisation_id, project_id, occurred_at);
CREATE INDEX deletion_requests_project_idx ON deletion_requests (organisation_id, project_id, status);

COMMENT ON TABLE deletion_receipts IS
  'Minimal synthetic demo deletion evidence; purge after 30 days. Customer, organisation, membership, and approved price-book data are outside project deletion scope.';
