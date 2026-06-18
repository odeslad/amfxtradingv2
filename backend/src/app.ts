import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRouter from './routes/auth';
import commandsRouter from './routes/commands';
import strategiesRouter from './routes/strategies';
import { requireAuth } from './middleware/requireAuth';

const app = express();

app.use(cors({
  origin: /\.amfxtrading\.com$/,
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/auth', authRouter);
app.use('/commands', requireAuth, commandsRouter);
app.use('/strategies', requireAuth, strategiesRouter);

export default app;
