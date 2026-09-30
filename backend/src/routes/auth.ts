import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../db/client';
import { config } from '../config';
import { requireAuth, type AuthRequest } from '../middleware/requireAuth';
import { asyncRoute } from '../middleware/asyncRoute';
import { loginKey, isBlocked, recordFailure, clearFailures } from '../middleware/loginLimiter';

const router = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'none' as const,
  domain: config.cookieDomain,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// A browser only deletes a cookie whose name, domain and path all match, so
// clearing must repeat the attributes used at login (maxAge excluded).
const { maxAge: _maxAge, ...CLEAR_COOKIE_OPTIONS } = COOKIE_OPTIONS;

// bcrypt (cost 12) of a random throwaway string. Compared against when the email
// is unknown so both branches cost the same and timing cannot enumerate accounts.
const DUMMY_HASH = '$2b$12$HRb0eTf.GBX4F.AonR3IA.xMjLbPXaR7Wo/i6y6sjNtD9.Tvt2KkC';

router.post('/login', asyncRoute(async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ message: 'Email and password required' });
    return;
  }

  const key = loginKey(req, email);
  if (isBlocked(key)) {
    const message = 'Too many attempts, try again later';
    res.status(429).json({ error: message, message });
    return;
  }

  const user = await db.user.findUnique({ where: { email } });
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) {
    recordFailure(key);
    res.status(401).json({ message: 'Invalid credentials' });
    return;
  }
  clearFailures(key);

  const token = jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: '7d' });
  res.cookie('token', token, COOKIE_OPTIONS);
  res.json({ user: { id: user.id, email: user.email } });
}));

router.post('/logout', (_req: Request, res: Response): void => {
  res.clearCookie('token', CLEAR_COOKIE_OPTIONS);
  res.json({ ok: true });
});

router.get('/me', requireAuth, asyncRoute<AuthRequest>(async (req, res) => {
  const user = await db.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true },
  });
  if (!user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  res.json(user);
}));

export default router;
