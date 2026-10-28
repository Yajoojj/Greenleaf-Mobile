import type { FeedbackService } from '../domain/services';
import type { Feedback } from '../domain/types';

const KEY = 'gl.mock.feedback';

/** Guarda o feedback no aparelho até existir um endpoint real de suporte. */
export class MockFeedbackService implements FeedbackService {
  constructor(private readonly storage: Storage = localStorage, private readonly delayMs = 600) {}

  async send(feedback: Feedback): Promise<void> {
    const message = feedback.message.trim().slice(0, 2000);
    if (!message) throw new Error('empty');
    await new Promise((r) => setTimeout(r, this.delayMs));
    let list: unknown[] = [];
    try {
      const parsed = JSON.parse(this.storage.getItem(KEY) ?? '[]');
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      list = [];
    }
    list.push({ ...feedback, message, sentAt: new Date().toISOString() });
    this.storage.setItem(KEY, JSON.stringify(list.slice(-50)));
  }
}
