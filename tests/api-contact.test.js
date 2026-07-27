const handler = require('../api/contact');
const { sanitizeInput, validateEmail, checkRateLimit, rateLimitStore } = handler;

// Helper mock functions for HTTP req and res
function createMockReqRes({ method = 'POST', headers = {}, body = {} } = {}) {
  const req = {
    method,
    headers: {
      'content-type': 'application/json',
      ...headers
    },
    body,
    socket: { remoteAddress: '127.0.0.1' }
  };

  const res = {
    statusCode: 200,
    headers: {},
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.bodyData = data;
      return this;
    }
  };

  return { req, res };
}

describe('Backend Security API Tests: /api/contact', () => {

  beforeEach(() => {
    rateLimitStore.clear();
  });

  describe('1. Input Sanitization & Helper Logic', () => {
    test('sanitizeInput strips dangerous HTML and XSS tags', () => {
      const maliciousInput = '<script>alert("XSS")</script>&"hello"\'`/';
      const sanitized = sanitizeInput(maliciousInput);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('&lt;script&gt;');
      expect(sanitized).toContain('&amp;');
      expect(sanitized).toContain('&quot;');
      expect(sanitized).toContain('&#x27;');
    });

    test('sanitizeInput enforces maximum length truncation', () => {
      const longText = 'a'.repeat(500);
      const sanitized = sanitizeInput(longText, 50);
      expect(sanitized.length).toBe(50);
    });

    test('validateEmail correctly validates standard email formats', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('harinish.s@srmist.edu.in')).toBe(true);
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('user@domain')).toBe(false);
      expect(validateEmail('')).toBe(false);
    });
  });

  describe('2. Method Enforcement & Request Headers', () => {
    test('Rejects non-POST requests with 405 Method Not Allowed', async () => {
      const { req, res } = createMockReqRes({ method: 'GET' });
      await handler(req, res);
      expect(res.statusCode).toBe(405);
      expect(res.headers['Allow']).toBe('POST');
      expect(res.bodyData.success).toBe(false);
    });

    test('Rejects non-JSON content-type header with 400 Bad Request', async () => {
      const { req, res } = createMockReqRes({
        headers: { 'content-type': 'text/plain' },
        body: { name: 'John', email: 'john@example.com', message: 'Hello' }
      });
      await handler(req, res);
      expect(res.statusCode).toBe(400);
      expect(res.bodyData.error).toContain('Invalid Content-Type');
    });

    test('Rejects payload larger than 10KB with 413 Payload Too Large', async () => {
      const { req, res } = createMockReqRes({
        headers: { 'content-length': '15000' },
        body: { name: 'John', email: 'john@example.com', message: 'Hello' }
      });
      await handler(req, res);
      expect(res.statusCode).toBe(413);
      expect(res.bodyData.error).toContain('Payload Too Large');
    });
  });

  describe('3. Validation & Sanitization in Endpoints', () => {
    test('Accepts valid post payload and returns 200 with security audit output', async () => {
      const { req, res } = createMockReqRes({
        body: {
          name: 'Security Tester',
          email: 'sec@example.com',
          subject: 'Security Audit Collaboration',
          message: 'Interested in zero-trust research.'
        }
      });
      await handler(req, res);
      expect(res.statusCode).toBe(200);
      expect(res.bodyData.success).toBe(true);
      expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
    });

    test('Rejects missing required fields with 400 Bad Request', async () => {
      const { req, res } = createMockReqRes({
        body: { name: 'John', email: 'john@example.com' } // missing message
      });
      await handler(req, res);
      expect(res.statusCode).toBe(400);
      expect(res.bodyData.error).toContain('Missing required fields');
    });

    test('Rejects invalid email address format with 400 Bad Request', async () => {
      const { req, res } = createMockReqRes({
        body: { name: 'John', email: 'not-an-email', message: 'Hello' }
      });
      await handler(req, res);
      expect(res.statusCode).toBe(400);
      expect(res.bodyData.error).toContain('Invalid email address');
    });
  });

  describe('4. Rate Limiting Enforcement', () => {
    test('Enforces rate limit after 5 requests per IP with 429 Too Many Requests', async () => {
      const ip = '192.168.1.100';

      for (let i = 0; i < 5; i++) {
        const { req, res } = createMockReqRes({
          headers: { 'x-forwarded-for': ip },
          body: { name: `Tester ${i}`, email: 'test@example.com', message: 'Rate limit test' }
        });
        await handler(req, res);
        expect(res.statusCode).toBe(200);
      }

      // 6th request should fail
      const { req, res } = createMockReqRes({
        headers: { 'x-forwarded-for': ip },
        body: { name: 'Exceeded Tester', email: 'test@example.com', message: 'Blocked test' }
      });
      await handler(req, res);
      expect(res.statusCode).toBe(429);
      expect(res.bodyData.error).toContain('Too many contact requests');
    });
  });

});
