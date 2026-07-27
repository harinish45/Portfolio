const fs = require('fs');
const path = require('path');

describe('Security Configuration Tests: vercel.json', () => {
  let vercelConfig;

  beforeAll(() => {
    const configPath = path.join(__dirname, '..', 'vercel.json');
    expect(fs.existsSync(configPath)).toBe(true);
    const content = fs.readFileSync(configPath, 'utf8');
    vercelConfig = JSON.parse(content);
  });

  test('vercel.json specifies headers for all routes', () => {
    expect(vercelConfig.headers).toBeDefined();
    expect(Array.isArray(vercelConfig.headers)).toBe(true);
    expect(vercelConfig.headers.length).toBeGreaterThan(0);
  });

  test('Includes Content-Security-Policy with frame-ancestors restrictions', () => {
    const routeHeaders = vercelConfig.headers[0].headers;
    const cspHeader = routeHeaders.find(h => h.key === 'Content-Security-Policy');
    expect(cspHeader).toBeDefined();
    expect(cspHeader.value).toContain("default-src 'self'");
    expect(cspHeader.value).toContain("frame-ancestors 'none'");
  });

  test('Includes X-Frame-Options set to DENY', () => {
    const routeHeaders = vercelConfig.headers[0].headers;
    const header = routeHeaders.find(h => h.key === 'X-Frame-Options');
    expect(header).toBeDefined();
    expect(header.value).toBe('DENY');
  });

  test('Includes X-Content-Type-Options set to nosniff', () => {
    const routeHeaders = vercelConfig.headers[0].headers;
    const header = routeHeaders.find(h => h.key === 'X-Content-Type-Options');
    expect(header).toBeDefined();
    expect(header.value).toBe('nosniff');
  });

  test('Includes Strict-Transport-Security HSTS header', () => {
    const routeHeaders = vercelConfig.headers[0].headers;
    const header = routeHeaders.find(h => h.key === 'Strict-Transport-Security');
    expect(header).toBeDefined();
    expect(header.value).toContain('max-age=');
  });

  test('Includes Referrer-Policy and Permissions-Policy headers', () => {
    const routeHeaders = vercelConfig.headers[0].headers;
    const referrerHeader = routeHeaders.find(h => h.key === 'Referrer-Policy');
    const permHeader = routeHeaders.find(h => h.key === 'Permissions-Policy');
    expect(referrerHeader).toBeDefined();
    expect(permHeader).toBeDefined();
  });
});
