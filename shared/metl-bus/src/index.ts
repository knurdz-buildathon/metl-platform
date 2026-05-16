import { connect, NatsConnection, JetStreamClient, JetStreamManager, JSONCodec } from 'nats';
import { logger } from '@metl/logger';

const jc = JSONCodec();

export class MetlBus {
  private nc: NatsConnection | null = null;
  private js: JetStreamClient | null = null;
  private jsm: JetStreamManager | null = null;

  async connect(urls?: string[]): Promise<void> {
    const servers = urls || [process.env.NATS_URL || 'nats://localhost:4222'];
    this.nc = await connect({ servers });
    this.js = this.nc.jetstream();
    this.jsm = await this.nc.jetstreamManager();
    logger.info({ servers }, 'Connected to NATS');
  }

  async publish(subject: string, data: unknown): Promise<void> {
    if (!this.js) throw new Error('NATS not connected');
    await this.js.publish(subject, jc.encode(data));
  }

  async subscribe<T>(
    subject: string,
    consumer: string,
    handler: (data: T) => Promise<void>,
  ): Promise<void> {
    if (!this.js || !this.jsm) throw new Error('NATS not connected');

    const stream = subject.split('.')[0];
    try {
      await this.jsm.streams.add({
        name: stream,
        subjects: [`${stream}.*`, `${stream}.*.*`, `${stream}.*.*.*`],
      });
    } catch {
      // Stream may already exist
    }

    try {
      await this.jsm.consumers.add(stream, {
        durable_name: consumer,
        ack_policy: 'explicit',
      });
    } catch {
      // Consumer may already exist
    }

    const c = await this.js.consumers.get(stream, consumer);

    (async () => {
      for await (const msg of await c.consume()) {
        try {
          const data = jc.decode(msg.data) as T;
          await handler(data);
          msg.ack();
        } catch (err) {
          logger.error({ err, subject, msg: msg.data.toString() }, 'Message handler error');
          msg.nak();
        }
      }
    })();
  }

  async close(): Promise<void> {
    if (this.nc) {
      await this.nc.close();
      this.nc = null;
      this.js = null;
      this.jsm = null;
    }
  }
}

export const bus = new MetlBus();
