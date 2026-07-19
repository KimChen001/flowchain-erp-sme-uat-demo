ALTER TABLE "Tenant"
  ADD COLUMN "defaultLanguage" TEXT NOT NULL DEFAULT 'zh-CN',
  ADD COLUMN "operationalSettings" JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "User"
  ADD COLUMN "languagePreference" TEXT;

ALTER TABLE "Tenant"
  ADD CONSTRAINT "Tenant_locale_supported_check"
    CHECK ("locale" IN ('zh-CN', 'en-US')),
  ADD CONSTRAINT "Tenant_defaultLanguage_supported_check"
    CHECK ("defaultLanguage" IN ('zh-CN', 'en-US')),
  ADD CONSTRAINT "Tenant_currency_iso_check"
    CHECK ("currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "Tenant_timezone_required_check"
    CHECK (length(trim("timezone")) > 0);

ALTER TABLE "User"
  ADD CONSTRAINT "User_languagePreference_supported_check"
    CHECK ("languagePreference" IS NULL OR "languagePreference" IN ('zh-CN', 'en-US'));
