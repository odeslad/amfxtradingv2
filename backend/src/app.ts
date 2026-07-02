import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRouter from './routes/auth';
import commandsRouter from './routes/commands';
import tradesRouter from './routes/trades';
import balancesRouter from './routes/balances';
import positionsRouter from './routes/positions';
import settingsRouter from './routes/settings';
import strategiesRouter from './routes/strategies';
import symbolsRouter from './routes/symbols';
import candlesRouter from './routes/candles';
import chartIndicatorsRouter from './routes/chart-indicators';
import drawingsRouter from './routes/drawings';
import alertsRouter from './routes/alerts';
import emaAlertsRouter from './routes/ema-alerts';
import scannerRouter from './routes/scanner';
import pushRouter from './routes/push';
import { requireAuth } from './middleware/requireAuth';

const app = express();

const ALLOWED_ORIGINS = [/\.amfxtrading\.com(:\d+)?$/];

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
app.use('/trades', requireAuth, tradesRouter);
app.use('/positions', requireAuth, positionsRouter);
app.use('/balances', requireAuth, balancesRouter);
app.use('/strategies', requireAuth, strategiesRouter);
app.use('/settings', requireAuth, settingsRouter);
app.use('/symbols', requireAuth, symbolsRouter);
app.use('/candles', requireAuth, candlesRouter);
app.use('/chart-indicators', requireAuth, chartIndicatorsRouter);
app.use('/drawings', requireAuth, drawingsRouter);
app.use('/alerts', requireAuth, alertsRouter);
app.use('/ema-alerts', requireAuth, emaAlertsRouter);
app.use('/scanner', requireAuth, scannerRouter);
app.use('/push', requireAuth, pushRouter);

export default app;
