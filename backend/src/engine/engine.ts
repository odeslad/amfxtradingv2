import { CandleTracker } from './candle-tracker';
import { OrderExecutor } from './order-executor';
import { evaluateStrategies } from './strategy-evaluator';
import type { TickBatch } from '../bridge/pipe-reader';

const ENGINE_MAGIC = 9999;

export class Engine {
  private readonly brokerName: string;
  private readonly tracker: CandleTracker;
  private readonly executor: OrderExecutor;

  constructor(brokerName: string, bridgePath: string) {
    this.brokerName = brokerName;
    this.tracker = new CandleTracker();
    this.executor = new OrderExecutor(brokerName, bridgePath);

    this.tracker.on('close', async (event) => {
      try {
        const results = await evaluateStrategies(brokerName, event);
        for (const result of results) {
          await this.executor.execute({
            action: result.action,
            symbol: event.symbol,
            lots: result.lots,
            sl: result.sl,
            tp: result.tp,
            magic: ENGINE_MAGIC,
          });
        }
      } catch (err) {
        console.error(`[ENGINE:${this.brokerName}] error on candle close ${event.symbol} ${event.timeframe}:`, err);
      }
    });
  }

  processTicks(batch: TickBatch) {
    for (const tick of batch) {
      this.tracker.processTick(tick);
    }
  }
}
