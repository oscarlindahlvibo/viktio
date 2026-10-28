/*
# Viktio — Privacy consent

Health data (weight, food, activity) is sensitive personal data under GDPR art. 9 and needs
explicit consent, recorded with a timestamp.
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS health_data_consent_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS privacy_policy_version text;
