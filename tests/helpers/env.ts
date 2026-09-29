// Integration tests run against a separate database and a temp upload dir.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://civic:civic@localhost:5432/civicreport_test?schema=public";
process.env.UPLOAD_DIR = process.env.TEST_UPLOAD_DIR ?? "./storage/test-uploads";
process.env.MOCK_PROVIDERS_LOG = "0";
process.env.GEOCODER = "mock";
process.env.RATE_LIMIT_DISABLED = "1";
