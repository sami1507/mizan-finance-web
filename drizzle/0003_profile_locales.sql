-- Expand existing installations without changing users' saved language choices.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_locale_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_locale_check CHECK (locale IN ('ar', 'en', 'he', 'de'));
