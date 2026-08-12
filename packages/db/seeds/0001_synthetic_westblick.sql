-- UNMISTAKABLY SYNTHETIC demo data. No record in this file represents a real person,
-- customer, property, site visit, price book, or commercial offer.

INSERT INTO organisations (
  id, name, locale, currency, created_at, updated_at, version
) VALUES (
  'org-westblick', 'Malerbetrieb Westblick GmbH', 'de-DE', 'EUR',
  '2026-08-12T09:00:00Z', '2026-08-12T09:00:00Z', 1
) ON CONFLICT DO NOTHING;

INSERT INTO users (id, display_name, synthetic) VALUES
  ('user-demo-mohsen', 'Demo-Inhaber Mohsen', true)
ON CONFLICT DO NOTHING;

INSERT INTO memberships (
  organisation_id, id, user_id, role, active, created_at, updated_at, version
) VALUES (
  'org-westblick', 'membership-westblick-owner', 'user-demo-mohsen', 'OWNER', true,
  '2026-08-12T09:00:00Z', '2026-08-12T09:00:00Z', 1
) ON CONFLICT DO NOTHING;

INSERT INTO customers (
  organisation_id, id, display_name, synthetic, created_at, updated_at, version
) VALUES (
  'org-westblick', 'customer-anna-becker', 'Anna Becker', true,
  '2026-08-12T09:00:00Z', '2026-08-12T09:00:00Z', 1
) ON CONFLICT DO NOTHING;

INSERT INTO projects (
  organisation_id, id, customer_id, name, location_label, synthetic,
  created_at, updated_at, version
) VALUES (
  'org-westblick', 'project-wohnzimmer-bochum', 'customer-anna-becker',
  'Wohnzimmer renovieren — Bochum', 'Bochum (synthetisch)', true,
  '2026-08-12T09:00:00Z', '2026-08-12T09:00:00Z', 1
) ON CONFLICT DO NOTHING;

INSERT INTO site_visits (
  organisation_id, id, project_id, status, started_at,
  created_at, updated_at, version
) VALUES (
  'org-westblick', 'visit-wohnzimmer-001', 'project-wohnzimmer-bochum', 'OPEN',
  '2026-08-12T09:15:00Z', '2026-08-12T09:15:00Z', '2026-08-12T09:15:00Z', 1
) ON CONFLICT DO NOTHING;

INSERT INTO price_books (
  organisation_id, id, name, active, created_at, updated_at, version
) VALUES (
  'org-westblick', 'pricebook-westblick-2026',
  'Westblick Demo-Preisbuch 2026 (synthetisch)', true,
  '2026-08-12T09:00:00Z', '2026-08-12T09:00:00Z', 1
) ON CONFLICT DO NOTHING;

INSERT INTO price_book_items (
  organisation_id, id, price_book_id, code, description, category, unit,
  unit_price_minor, currency, tax_category, tax_rate_basis_points, active,
  valid_from, valid_to, synonyms, created_at, updated_at, version
) VALUES
  (
    'org-westblick', 'pb-item-wall-two-coats', 'pricebook-westblick-2026',
    'MAL-WAND-2X', 'Wandfläche weiß, zweimal deckend streichen', 'Malerarbeiten', 'M2',
    1290, 'EUR', 'STANDARD_19', 1900, true,
    '2026-01-01', NULL, '["Wände zweimal weiß", "Wandanstrich 2x"]'::jsonb,
    '2026-08-12T09:00:00Z', '2026-08-12T09:00:00Z', 1
  ),
  (
    'org-westblick', 'pb-item-ceiling-two-coats', 'pricebook-westblick-2026',
    'MAL-DECKE-2X', 'Deckenfläche weiß, zweimal deckend streichen', 'Malerarbeiten', 'M2',
    1490, 'EUR', 'STANDARD_19', 1900, true,
    '2026-01-01', NULL, '["Decke streichen", "Deckenanstrich"]'::jsonb,
    '2026-08-12T09:00:00Z', '2026-08-12T09:00:00Z', 1
  ),
  (
    'org-westblick', 'pb-item-door-frame-protect', 'pricebook-westblick-2026',
    'MAL-SCHUTZ-ZARGE', 'Türzarge fachgerecht abkleben und schützen', 'Schutzarbeiten', 'STK',
    850, 'EUR', 'STANDARD_19', 1900, true,
    '2026-01-01', NULL, '["Türrahmen abkleben", "Zarge schützen"]'::jsonb,
    '2026-08-12T09:00:00Z', '2026-08-12T09:00:00Z', 1
  ),
  (
    'org-westblick', 'pb-item-substrate-repair', 'pricebook-westblick-2026',
    'MAL-UG-AUSB', 'Untergrund ausbessern nach bestätigtem Aufwand', 'Vorarbeiten', 'STD',
    6200, 'EUR', 'STANDARD_19', 1900, true,
    '2026-01-01', NULL, '["Untergrund ausbessern"]'::jsonb,
    '2026-08-12T09:00:00Z', '2026-08-12T09:00:00Z', 1
  )
ON CONFLICT DO NOTHING;
