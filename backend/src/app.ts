import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRouter from './routes/auth';
import commandsRouter from './routes/commands';
import strategiesRouter from './routes/strategies';
import { requireAuth } from './middleware/requireAuth';

const app = express();

const ALLOWED_ORIGINS = [/\.amfxtrading\.com$/, 'http://localhost:5173'];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const allowed = ALLOWED_ORIGINS.some(o => typeof o === 'string' ? o === origin : o.test(origin));
    cb(allowed ? null : new Error('Not allowed by CORS'), allowed);
  },
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/auth', authRouter);
app.use('/commands', requireAuth, commandsRouter);
app.use('/strategies', requireAuth, strategiesRouter);

export default app;
