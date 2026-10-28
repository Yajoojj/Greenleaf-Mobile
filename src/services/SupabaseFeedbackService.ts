import type { FeedbackService } from '../domain/services';
import type { Feedback } from '../domain/types';
import type { GreenLeafSupabase } from './supabaseClient';

/**
 * Grava o "Fale conosco" na tabela `feedback`. A RLS só permite INSERT: nem o próprio autor lê de volta.
 * Sem conta, `user_id` vai nulo.
 */
export class SupabaseFeedbackService implements FeedbackService {
  constructor(private readonly client: GreenLeafSupabase, private readonly appVersion: string) {}

  async send(feedback: Feedback): Promise<void> {
    const message = feedback.message.trim().slice(0, 2000);
    if (!message) throw new Error('empty');
    const { data } = await this.client.auth.getSession();
    const { error } = await this.client.from('feedback').insert({
      user_id: data.session?.user.id ?? null,
      topic: feedback.topic,
      message,
      rating: feedback.rating ?? null,
      contact_email: feedback.contactEmail?.trim() || null,
      app_version: this.appVersion,
    });
    if (error) throw new Error('feedback_failed');
  }
}
