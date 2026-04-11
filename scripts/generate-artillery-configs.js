/**
 * One Artillery YAML per HTTP route (single request per file).
 * Run: node scripts/generate-artillery-configs.js
 */
const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "artillery");

function header(lines) {
  return lines.map((l) => `# ${l}`).join("\n") + "\n\n";
}

function baseConfig(opts = {}) {
  const proc = opts.processor ? `  processor: "${opts.processor}"\n` : "";
  return [
    "config:",
    '  target: "http://localhost:5000"',
    "  http:",
    "    timeout: 60",
    proc,
    "  phases:",
    '    - duration: 30',
    "      arrivalRate: 3",
    '      name: "steady"',
    "  plugins:",
    "    ensure: {}",
    "  ensure:",
    "    thresholds:",
    "      - http.response_time.p95: 15000",
    "      - http.response_time.p99: 25000",
    "",
  ].join("\n");
}

/** Each line is already indented for content under `flow:` (6 spaces for first `-`, more for children). */
function scenario(name, flowLines) {
  const flow = flowLines.join("\n");
  return [`scenarios:`, `  - name: "${name}"`, `    flow:`, flow, ``].join("\n");
}

/** Indent under `flow:` — Artillery requires nested keys (e.g. url) indented deeper than `- get:`. */
const I6 = "      ";
const I10 = "          ";

const endpoints = [
  {
    file: "get-api-docs.yml",
    desc: ["GET /api/docs — Swagger UI (HTML)"],
    name: "GET /api/docs",
    flow: [`${I6}- get:`, `${I10}url: "/api/docs"`],
  },
  {
    file: "get-api-districts.yml",
    desc: ["GET /api/districts — public"],
    name: "GET /api/districts",
    flow: [`${I6}- get:`, `${I10}url: "/api/districts"`],
  },
  {
    file: "post-api-auth-signup.yml",
    desc: [
      "POST /api/auth/signup — PUBLIC_USER",
      "Processor sets unique signupEmail per VU.",
      "Requires: PERF_SIGNUP_PASSWORD in .env",
    ],
    name: "POST /api/auth/signup",
    processor: "./processors/common.js",
    flow: [
      `${I6}- function: "uniqueSignupEmail"`,
      `${I6}- post:`,
      `${I10}url: "/api/auth/signup"`,
      `${I10}formData:`,
      `${I10}  name: "Perf User"`,
      `${I10}  email: "{{ signupEmail }}"`,
      `${I10}  phone: "0770000000"`,
      `${I10}  password: "{{ $environment.PERF_SIGNUP_PASSWORD }}"`,
      `${I10}  role: "PUBLIC_USER"`,
    ],
  },
  {
    file: "post-api-auth-login.yml",
    desc: ["POST /api/auth/login", "Requires: PERF_LOGIN_EMAIL, PERF_LOGIN_PASSWORD"],
    name: "POST /api/auth/login",
    flow: [
      `${I6}- post:`,
      `${I10}url: "/api/auth/login"`,
      `${I10}headers:`,
      `${I10}  Content-Type: "application/json"`,
      `${I10}json:`,
      `${I10}  email: "{{ $environment.PERF_LOGIN_EMAIL }}"`,
      `${I10}  password: "{{ $environment.PERF_LOGIN_PASSWORD }}"`,
    ],
  },
  {
    file: "get-api-auth-profile.yml",
    desc: ["GET /api/auth/profile — ZOOLOGIST", "Requires: PERF_TOKEN_ZOOLOGIST"],
    name: "GET /api/auth/profile",
    flow: [
      `${I6}- get:`,
      `${I10}url: "/api/auth/profile"`,
      `${I10}headers:`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_ZOOLOGIST }}"`,
    ],
  },
  {
    file: "put-api-auth-profile.yml",
    desc: ["PUT /api/auth/profile — ZOOLOGIST", "Requires: PERF_TOKEN_ZOOLOGIST"],
    name: "PUT /api/auth/profile",
    flow: [
      `${I6}- put:`,
      `${I10}url: "/api/auth/profile"`,
      `${I10}headers:`,
      `${I10}  Content-Type: "application/json"`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_ZOOLOGIST }}"`,
      `${I10}json:`,
      `${I10}  phone: "0777777771"`,
    ],
  },
  {
    file: "get-api-admin-pending-users.yml",
    desc: ["GET /api/admin/pending-users", "Requires: PERF_TOKEN_ADMIN"],
    name: "GET /api/admin/pending-users",
    flow: [
      `${I6}- get:`,
      `${I10}url: "/api/admin/pending-users"`,
      `${I10}headers:`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_ADMIN }}"`,
    ],
  },
  {
    file: "put-api-admin-approve-id.yml",
    desc: ["PUT /api/admin/approve/:id", "Requires: PERF_TOKEN_ADMIN, PERF_PENDING_USER_ID"],
    name: "PUT /api/admin/approve/:id",
    flow: [
      `${I6}- put:`,
      `${I10}url: "/api/admin/approve/{{ $environment.PERF_PENDING_USER_ID }}"`,
      `${I10}headers:`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_ADMIN }}"`,
    ],
  },
  {
    file: "put-api-admin-reject-id.yml",
    desc: ["PUT /api/admin/reject/:id", "Requires: PERF_TOKEN_ADMIN, PERF_REJECT_USER_ID"],
    name: "PUT /api/admin/reject/:id",
    flow: [
      `${I6}- put:`,
      `${I10}url: "/api/admin/reject/{{ $environment.PERF_REJECT_USER_ID }}"`,
      `${I10}headers:`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_ADMIN }}"`,
    ],
  },
  {
    file: "get-api-admin-users.yml",
    desc: ["GET /api/admin/users", "Requires: PERF_TOKEN_ADMIN"],
    name: "GET /api/admin/users",
    flow: [
      `${I6}- get:`,
      `${I10}url: "/api/admin/users"`,
      `${I10}headers:`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_ADMIN }}"`,
    ],
  },
  {
    file: "delete-api-admin-users-id.yml",
    desc: ["DELETE /api/admin/users/:id", "Requires: PERF_TOKEN_ADMIN, PERF_DELETE_USER_ID"],
    name: "DELETE /api/admin/users/:id",
    flow: [
      `${I6}- delete:`,
      `${I10}url: "/api/admin/users/{{ $environment.PERF_DELETE_USER_ID }}"`,
      `${I10}headers:`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_ADMIN }}"`,
    ],
  },
  {
    file: "post-api-reports.yml",
    desc: ["POST /api/reports — multipart", "Requires: PERF_TOKEN_PUBLIC_USER"],
    name: "POST /api/reports",
    flow: [
      `${I6}- post:`,
      `${I10}url: "/api/reports"`,
      `${I10}headers:`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_PUBLIC_USER }}"`,
      `${I10}formData:`,
      `${I10}  district: "Galle"`,
      `${I10}  reportDate: "2026-04-11"`,
      `${I10}  reportTime: "10:30"`,
      `${I10}  location: "Test location"`,
      `${I10}  latitude: "6.0"`,
      `${I10}  longitude: "80.0"`,
      `${I10}  description: "Performance test report description text."`,
    ],
  },
  {
    file: "get-api-reports-my.yml",
    desc: ["GET /api/reports/my", "Requires: PERF_TOKEN_PUBLIC_USER"],
    name: "GET /api/reports/my",
    flow: [
      `${I6}- get:`,
      `${I10}url: "/api/reports/my"`,
      `${I10}headers:`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_PUBLIC_USER }}"`,
    ],
  },
  {
    file: "get-api-reports-my-district.yml",
    desc: ["GET /api/reports/my-district", "Requires: PERF_TOKEN_AUTHORIZED_PERSON"],
    name: "GET /api/reports/my-district",
    flow: [
      `${I6}- get:`,
      `${I10}url: "/api/reports/my-district"`,
      `${I10}headers:`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_AUTHORIZED_PERSON }}"`,
    ],
  },
  {
    file: "get-api-reports-district-district.yml",
    desc: ["GET /api/reports/district/:district", "Requires: PERF_TOKEN_ADMIN, PERF_DISTRICT_NAME"],
    name: "GET /api/reports/district/:district",
    flow: [
      `${I6}- get:`,
      `${I10}url: "/api/reports/district/{{ $environment.PERF_DISTRICT_NAME }}"`,
      `${I10}headers:`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_ADMIN }}"`,
    ],
  },
  {
    file: "get-api-reports-all.yml",
    desc: ["GET /api/reports/all", "Requires: PERF_TOKEN_ADMIN"],
    name: "GET /api/reports/all",
    flow: [
      `${I6}- get:`,
      `${I10}url: "/api/reports/all"`,
      `${I10}headers:`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_ADMIN }}"`,
    ],
  },
  {
    file: "get-api-reports-statistics.yml",
    desc: ["GET /api/reports/statistics", "Requires: PERF_TOKEN_PUBLIC_USER"],
    name: "GET /api/reports/statistics",
    flow: [
      `${I6}- get:`,
      `${I10}url: "/api/reports/statistics"`,
      `${I10}headers:`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_PUBLIC_USER }}"`,
    ],
  },
  {
    file: "put-api-reports-id.yml",
    desc: ["PUT /api/reports/:id", "Requires: PERF_TOKEN_PUBLIC_USER, PERF_REPORT_ID"],
    name: "PUT /api/reports/:id",
    flow: [
      `${I6}- put:`,
      `${I10}url: "/api/reports/{{ $environment.PERF_REPORT_ID }}"`,
      `${I10}headers:`,
      `${I10}  Content-Type: "application/json"`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_PUBLIC_USER }}"`,
      `${I10}json:`,
      `${I10}  description: "Updated via performance test description text."`,
    ],
  },
  {
    file: "delete-api-reports-id.yml",
    desc: ["DELETE /api/reports/:id", "Requires: PERF_TOKEN_PUBLIC_USER, PERF_REPORT_ID"],
    name: "DELETE /api/reports/:id",
    flow: [
      `${I6}- delete:`,
      `${I10}url: "/api/reports/{{ $environment.PERF_REPORT_ID }}"`,
      `${I10}headers:`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_PUBLIC_USER }}"`,
    ],
  },
  {
    file: "get-api-investigations-assigned-reports.yml",
    desc: ["GET /api/investigations/assigned-reports", "Requires: PERF_TOKEN_AUTHORIZED_PERSON"],
    name: "GET /api/investigations/assigned-reports",
    flow: [
      `${I6}- get:`,
      `${I10}url: "/api/investigations/assigned-reports"`,
      `${I10}headers:`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_AUTHORIZED_PERSON }}"`,
    ],
  },
  {
    file: "post-api-investigations-start-reportid.yml",
    desc: ["POST /api/investigations/start/:reportId", "Requires: PERF_TOKEN_AUTHORIZED_PERSON, PERF_REPORT_ID"],
    name: "POST /api/investigations/start/:reportId",
    flow: [
      `${I6}- post:`,
      `${I10}url: "/api/investigations/start/{{ $environment.PERF_REPORT_ID }}"`,
      `${I10}headers:`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_AUTHORIZED_PERSON }}"`,
    ],
  },
  {
    file: "post-api-investigations-submit-investigationid.yml",
    desc: ["POST /api/investigations/submit/:investigationId — multipart", "Requires: PERF_TOKEN_AUTHORIZED_PERSON, PERF_INVESTIGATION_ID"],
    name: "POST /api/investigations/submit/:investigationId",
    flow: [
      `${I6}- post:`,
      `${I10}url: "/api/investigations/submit/{{ $environment.PERF_INVESTIGATION_ID }}"`,
      `${I10}headers:`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_AUTHORIZED_PERSON }}"`,
      `${I10}formData:`,
      `${I10}  visited: "true"`,
      `${I10}  actualSituation: "Performance test visit notes here."`,
      `${I10}  illegalActivityFound: "false"`,
      `${I10}  actionTaken: "NO_ACTION"`,
      `${I10}  visitDate: "2026-04-11"`,
      `${I10}  visitTime: "14:00"`,
    ],
  },
  {
    file: "get-api-investigations-my-investigations.yml",
    desc: ["GET /api/investigations/my-investigations", "Requires: PERF_TOKEN_AUTHORIZED_PERSON"],
    name: "GET /api/investigations/my-investigations",
    flow: [
      `${I6}- get:`,
      `${I10}url: "/api/investigations/my-investigations"`,
      `${I10}headers:`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_AUTHORIZED_PERSON }}"`,
    ],
  },
  {
    file: "get-api-investigations-admin-all.yml",
    desc: ["GET /api/investigations/admin/all", "Requires: PERF_TOKEN_ADMIN"],
    name: "GET /api/investigations/admin/all",
    flow: [
      `${I6}- get:`,
      `${I10}url: "/api/investigations/admin/all"`,
      `${I10}headers:`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_ADMIN }}"`,
    ],
  },
  {
    file: "get-api-investigations-investigationid.yml",
    desc: ["GET /api/investigations/:investigationId", "Requires: PERF_TOKEN_INVESTIGATION_READ, PERF_INVESTIGATION_ID"],
    name: "GET /api/investigations/:investigationId",
    flow: [
      `${I6}- get:`,
      `${I10}url: "/api/investigations/{{ $environment.PERF_INVESTIGATION_ID }}"`,
      `${I10}headers:`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_INVESTIGATION_READ }}"`,
    ],
  },
  {
    file: "get-api-investigations-investigationid-pdf.yml",
    desc: ["GET /api/investigations/:investigationId/pdf", "Requires: PERF_TOKEN_INVESTIGATION_READ, PERF_INVESTIGATION_ID"],
    name: "GET /api/investigations/:investigationId/pdf",
    flow: [
      `${I6}- get:`,
      `${I10}url: "/api/investigations/{{ $environment.PERF_INVESTIGATION_ID }}/pdf"`,
      `${I10}headers:`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_INVESTIGATION_READ }}"`,
    ],
  },
  {
    file: "get-api-investigations-investigationid-notifications.yml",
    desc: ["GET /api/investigations/:investigationId/notifications", "Requires: PERF_TOKEN_ADMIN, PERF_INVESTIGATION_ID"],
    name: "GET /api/investigations/:investigationId/notifications",
    flow: [
      `${I6}- get:`,
      `${I10}url: "/api/investigations/{{ $environment.PERF_INVESTIGATION_ID }}/notifications"`,
      `${I10}headers:`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_ADMIN }}"`,
    ],
  },
  {
    file: "delete-api-investigations-investigationid.yml",
    desc: ["DELETE /api/investigations/:investigationId", "Requires: PERF_TOKEN_ADMIN, PERF_INVESTIGATION_ID"],
    name: "DELETE /api/investigations/:investigationId",
    flow: [
      `${I6}- delete:`,
      `${I10}url: "/api/investigations/{{ $environment.PERF_INVESTIGATION_ID }}"`,
      `${I10}headers:`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_ADMIN }}"`,
    ],
  },
  {
    file: "delete-api-investigations-cancel-investigationid.yml",
    desc: ["DELETE /api/investigations/cancel/:investigationId", "Requires: PERF_TOKEN_AUTHORIZED_PERSON, PERF_INVESTIGATION_ID_CANCEL"],
    name: "DELETE /api/investigations/cancel/:investigationId",
    flow: [
      `${I6}- delete:`,
      `${I10}url: "/api/investigations/cancel/{{ $environment.PERF_INVESTIGATION_ID_CANCEL }}"`,
      `${I10}headers:`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_AUTHORIZED_PERSON }}"`,
    ],
  },
  {
    file: "post-api-investigations-bulk-delete.yml",
    desc: ["POST /api/investigations/bulk-delete", "Requires: PERF_TOKEN_ADMIN"],
    name: "POST /api/investigations/bulk-delete",
    flow: [
      `${I6}- post:`,
      `${I10}url: "/api/investigations/bulk-delete"`,
      `${I10}headers:`,
      `${I10}  Content-Type: "application/json"`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_ADMIN }}"`,
      `${I10}json:`,
      `${I10}  investigationIds: []`,
    ],
  },
  {
    file: "post-api-zones.yml",
    desc: ["POST /api/zones — multipart", "Requires: PERF_TOKEN_AUTHORIZED_PERSON"],
    name: "POST /api/zones",
    flow: [
      `${I6}- post:`,
      `${I10}url: "/api/zones"`,
      `${I10}headers:`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_AUTHORIZED_PERSON }}"`,
      `${I10}formData:`,
      `${I10}  name: "Perf Zone"`,
      `${I10}  location: '{"lat":8.3,"lng":80.4}'`,
      `${I10}  startDate: "2026-04-01"`,
      `${I10}  endDate: "2026-12-31"`,
      `${I10}  restrictedTime: "All Day"`,
    ],
  },
  {
    file: "get-api-zones.yml",
    desc: ["GET /api/zones", "Requires: PERF_TOKEN_PUBLIC_USER"],
    name: "GET /api/zones",
    flow: [
      `${I6}- get:`,
      `${I10}url: "/api/zones"`,
      `${I10}headers:`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_PUBLIC_USER }}"`,
    ],
  },
  {
    file: "put-api-zones-id.yml",
    desc: ["PUT /api/zones/:id — multipart", "Requires: PERF_TOKEN_AUTHORIZED_PERSON, PERF_ZONE_ID"],
    name: "PUT /api/zones/:id",
    flow: [
      `${I6}- put:`,
      `${I10}url: "/api/zones/{{ $environment.PERF_ZONE_ID }}"`,
      `${I10}headers:`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_AUTHORIZED_PERSON }}"`,
      `${I10}formData:`,
      `${I10}  name: "Perf Zone Updated"`,
    ],
  },
  {
    file: "patch-api-zones-id-deactivate.yml",
    desc: ["PATCH /api/zones/:id/deactivate", "Requires: PERF_TOKEN_AUTHORIZED_PERSON, PERF_ZONE_ID"],
    name: "PATCH /api/zones/:id/deactivate",
    flow: [
      `${I6}- patch:`,
      `${I10}url: "/api/zones/{{ $environment.PERF_ZONE_ID }}/deactivate"`,
      `${I10}headers:`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_AUTHORIZED_PERSON }}"`,
    ],
  },
  {
    file: "delete-api-zones-id.yml",
    desc: ["DELETE /api/zones/:id", "Requires: PERF_TOKEN_AUTHORIZED_PERSON, PERF_ZONE_ID"],
    name: "DELETE /api/zones/:id",
    flow: [
      `${I6}- delete:`,
      `${I10}url: "/api/zones/{{ $environment.PERF_ZONE_ID }}"`,
      `${I10}headers:`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_AUTHORIZED_PERSON }}"`,
    ],
  },
  {
    file: "get-api-zones-ai-advisory.yml",
    desc: ["GET /api/zones/ai-advisory", "Requires: PERF_TOKEN_AUTHORIZED_PERSON"],
    name: "GET /api/zones/ai-advisory",
    flow: [
      `${I6}- get:`,
      `${I10}url: "/api/zones/ai-advisory"`,
      `${I10}headers:`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_AUTHORIZED_PERSON }}"`,
    ],
  },
  {
    file: "get-api-profile-me.yml",
    desc: ["GET /api/profile/me — AUTHORIZED_PERSON", "Requires: PERF_TOKEN_AUTHORIZED_PERSON"],
    name: "GET /api/profile/me",
    flow: [
      `${I6}- get:`,
      `${I10}url: "/api/profile/me"`,
      `${I10}headers:`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_AUTHORIZED_PERSON }}"`,
    ],
  },
  {
    file: "put-api-profile-me.yml",
    desc: ["PUT /api/profile/me", "Requires: PERF_TOKEN_AUTHORIZED_PERSON"],
    name: "PUT /api/profile/me",
    flow: [
      `${I6}- put:`,
      `${I10}url: "/api/profile/me"`,
      `${I10}headers:`,
      `${I10}  Content-Type: "application/json"`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_AUTHORIZED_PERSON }}"`,
      `${I10}json:`,
      `${I10}  name: "Perf Officer"`,
    ],
  },
  {
    file: "get-api-profile-public-me.yml",
    desc: ["GET /api/profile/public/me", "Requires: PERF_TOKEN_PUBLIC_USER"],
    name: "GET /api/profile/public/me",
    flow: [
      `${I6}- get:`,
      `${I10}url: "/api/profile/public/me"`,
      `${I10}headers:`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_PUBLIC_USER }}"`,
    ],
  },
  {
    file: "put-api-profile-public-me.yml",
    desc: ["PUT /api/profile/public/me", "Requires: PERF_TOKEN_PUBLIC_USER"],
    name: "PUT /api/profile/public/me",
    flow: [
      `${I6}- put:`,
      `${I10}url: "/api/profile/public/me"`,
      `${I10}headers:`,
      `${I10}  Content-Type: "application/json"`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_PUBLIC_USER }}"`,
      `${I10}json:`,
      `${I10}  name: "Perf Public"`,
    ],
  },
  {
    file: "put-api-profile-public-password.yml",
    desc: ["PUT /api/profile/public/password", "Requires: PERF_TOKEN_PUBLIC_USER, PERF_CURRENT_PASSWORD, PERF_NEW_PASSWORD"],
    name: "PUT /api/profile/public/password",
    flow: [
      `${I6}- put:`,
      `${I10}url: "/api/profile/public/password"`,
      `${I10}headers:`,
      `${I10}  Content-Type: "application/json"`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_PUBLIC_USER }}"`,
      `${I10}json:`,
      `${I10}  currentPassword: "{{ $environment.PERF_CURRENT_PASSWORD }}"`,
      `${I10}  newPassword: "{{ $environment.PERF_NEW_PASSWORD }}"`,
    ],
  },
  {
    file: "get-api-species.yml",
    desc: ["GET /api/species — paginated", "Requires: PERF_TOKEN_PUBLIC_USER"],
    name: "GET /api/species",
    flow: [
      `${I6}- get:`,
      `${I10}url: "/api/species?page=1&limit=10"`,
      `${I10}headers:`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_PUBLIC_USER }}"`,
    ],
  },
  {
    file: "post-api-species-nearby.yml",
    desc: ["POST /api/species/nearby", "Requires: PERF_TOKEN_PUBLIC_USER"],
    name: "POST /api/species/nearby",
    flow: [
      `${I6}- post:`,
      `${I10}url: "/api/species/nearby"`,
      `${I10}headers:`,
      `${I10}  Content-Type: "application/json"`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_PUBLIC_USER }}"`,
      `${I10}json:`,
      `${I10}  longitude: 80.12`,
      `${I10}  latitude: 6.95`,
      `${I10}  maxDistance: 50000`,
    ],
  },
  {
    file: "post-api-species.yml",
    desc: ["POST /api/species — ZOOLOGIST multipart", "Requires: PERF_TOKEN_ZOOLOGIST"],
    name: "POST /api/species",
    flow: [
      `${I6}- post:`,
      `${I10}url: "/api/species"`,
      `${I10}headers:`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_ZOOLOGIST }}"`,
      `${I10}formData:`,
      `${I10}  fishes: '[{"scientificName":"Perf Sp.","localName":"Perf","conservationStatus":"Vulnerable"}]'`,
      `${I10}  description: "Performance test species description text here."`,
      `${I10}  location: '{"coordinates":[80.12,6.95],"address":"Test"}'`,
      `${I10}  threats: '["habitat loss"]'`,
      `${I10}  tags: '["perf"]'`,
      `${I10}  evidence:`,
      `${I10}    fromFile: "${path.join("artillery", "fixtures", "tiny.png").replace(/\\/g, "/")}"`,
    ],
  },
  {
    file: "put-api-species-id.yml",
    desc: ["PUT /api/species/:id", "Requires: PERF_TOKEN_ZOOLOGIST, PERF_SPECIES_ID"],
    name: "PUT /api/species/:id",
    flow: [
      `${I6}- put:`,
      `${I10}url: "/api/species/{{ $environment.PERF_SPECIES_ID }}"`,
      `${I10}headers:`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_ZOOLOGIST }}"`,
      `${I10}formData:`,
      `${I10}  fishes: '[{"scientificName":"Perf Sp.","localName":"Perf Upd","conservationStatus":"Endangered"}]'`,
      `${I10}  description: "Performance test species update description text."`,
    ],
  },
  {
    file: "delete-api-species-id.yml",
    desc: ["DELETE /api/species/:id", "Requires: PERF_TOKEN_ZOOLOGIST, PERF_SPECIES_ID"],
    name: "DELETE /api/species/:id",
    flow: [
      `${I6}- delete:`,
      `${I10}url: "/api/species/{{ $environment.PERF_SPECIES_ID }}"`,
      `${I10}headers:`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_ZOOLOGIST }}"`,
    ],
  },
  {
    file: "post-api-species-details-by-location.yml",
    desc: ["POST /api/species/details-by-location", "Requires: PERF_TOKEN_ZOOLOGIST"],
    name: "POST /api/species/details-by-location",
    flow: [
      `${I6}- post:`,
      `${I10}url: "/api/species/details-by-location"`,
      `${I10}headers:`,
      `${I10}  Content-Type: "application/json"`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_ZOOLOGIST }}"`,
      `${I10}json:`,
      `${I10}  location:`,
      `${I10}    coordinates: [80.12, 6.95]`,
    ],
  },
  {
    file: "get-api-species-all.yml",
    desc: ["GET /api/species/all", "Requires: PERF_TOKEN_PUBLIC_USER"],
    name: "GET /api/species/all",
    flow: [
      `${I6}- get:`,
      `${I10}url: "/api/species/all"`,
      `${I10}headers:`,
      `${I10}  Authorization: "Bearer {{ $environment.PERF_TOKEN_PUBLIC_USER }}"`,
    ],
  },
];

function buildYaml(ep) {
  const cfg = baseConfig({ processor: ep.processor });
  return header(ep.desc) + cfg + scenario(ep.name, ep.flow);
}

function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const ep of endpoints) {
    fs.writeFileSync(path.join(OUT_DIR, ep.file), buildYaml(ep), "utf8");
  }
  console.log(`Wrote ${endpoints.length} files to ${OUT_DIR}`);
}

main();
