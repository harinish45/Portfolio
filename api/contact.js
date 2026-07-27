/**
 * Vercel Serverless Function: /api/contact
 * Handles contact form submissions with backend security enforcement.
 */

// In-memory rate limiting map (IP -> { count, resetTime })
const rateLimitStore = new Map();
const RATE_LIMIT_MAX = 5; // max 5 requests
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes window

/**
 * Sanitizes user input string against XSS, HTML injection, and control characters.
 * @param {string} input 
 * @param {number} maxLength 
 * @returns {string}
 */
function sanitizeInput(input, maxLength = 1000) {
  if (typeof input !== 'string') return '';
  
  const trimmed = input.trim().slice(0, maxLength);
  // Replace HTML special characters with entities
  return trimmed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/`/g, '&#x60;');
}

/**
 * Validates email format.
 * @param {string} email 
 * @returns {boolean}
 */
function validateEmail(email) {
  if (typeof email !== 'string') return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}

/**
 * Checks rate limiting for a client IP.
 * @param {string} ip 
 * @returns {{ allowed: boolean, remaining: number, resetTime: number }}
 */
function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  if (!record || now > record.resetTime) {
    const newRecord = { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS };
    rateLimitStore.set(ip, newRecord);
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetTime: newRecord.resetTime };
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime };
  }

  record.count += 1;
  return { allowed: true, remaining: RATE_LIMIT_MAX - record.count, resetTime: record.resetTime };
}

/**
 * Main HTTP Handler
 */
async function handler(req, res) {
  // 1. Security Response Headers
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  // 2. Method Checking
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed. Only POST requests are permitted.'
    });
  }

  // 3. Rate Limiting Enforcement
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                   req.socket?.remoteAddress || 
                   '127.0.0.1';
  
  const rateLimit = checkRateLimit(clientIp);
  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX.toString());
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());
  res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimit.resetTime / 1000).toString());

  if (!rateLimit.allowed) {
    return res.status(429).json({
      success: false,
      error: 'Too many contact requests from this IP. Please try again in 15 minutes.'
    });
  }

  // 4. Content-Type Header Verification
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('application/json')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid Content-Type. Expected application/json.'
    });
  }

  // 5. Payload Size Check
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > 10240) { // 10KB limit
    return res.status(413).json({
      success: false,
      error: 'Payload Too Large. Maximum allowed request body size is 10KB.'
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { name, email, subject, message } = body;

    // 6. Input Validation
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, email, and message are mandatory.'
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email address format.'
      });
    }

    // 7. Sanitization
    const sanitizedData = {
      name: sanitizeInput(name, 100),
      email: email.trim().toLowerCase(),
      subject: sanitizeInput(subject || 'General Inquiry', 200),
      message: sanitizeInput(message, 2000),
      timestamp: new Date().toISOString(),
      clientIp
    };

    // Log sanitized security audit entry (In production, forward to secure log storage / email service)
    console.log('[SECURITY AUDIT] Valid contact submission received:', {
      name: sanitizedData.name,
      email: sanitizedData.email,
      subject: sanitizedData.subject,
      timestamp: sanitizedData.timestamp
    });

    return res.status(200).json({
      success: true,
      message: 'Connection request received securely. Thank you for reaching out!',
      data: {
        receivedAt: sanitizedData.timestamp,
        subject: sanitizedData.subject
      }
    });
  } catch (err) {
    console.error('[SECURITY ERROR] Failed to parse request body:', err);
    return res.status(400).json({
      success: false,
      error: 'Malformed JSON payload in request body.'
    });
  }
}

module.exports = handler;
module.exports.sanitizeInput = sanitizeInput;
module.exports.validateEmail = validateEmail;
module.exports.checkRateLimit = checkRateLimit;
module.exports.rateLimitStore = rateLimitStore;
