/**
 * Tipos de falha que as telas sabem explicar. Nunca carregam detalhes internos
 * (corpo da resposta, stack, URL) — a mensagem ao usuário vem do i18n.
 */
export type PredictionErrorKind =
  | 'invalid_format' // não é JPEG/PNG
  | 'too_large' // acima de 8 MB (cliente) ou 413 (servidor)
  | 'low_quality' // pequena demais / ilegível no cliente
  | 'invalid_image' // 400 do servidor
  | 'server' // 500 ou outra falha do servidor
  | 'sleeping' // servidor acordando (Render) — 502/503/504
  | 'timeout'
  | 'offline'
  | 'network'
  | 'malformed' // resposta fora do contrato
  | 'cancelled';

export class PredictionError extends Error {
  constructor(readonly kind: PredictionErrorKind) {
    super(`prediction_error:${kind}`);
    this.name = 'PredictionError';
  }

  /** Vale a pena tentar de novo com a mesma foto? */
  get retryable(): boolean {
    return ['server', 'sleeping', 'timeout', 'offline', 'network', 'malformed'].includes(this.kind);
  }
}

export type AuthErrorKind =
  | 'invalid_credentials'
  | 'email_taken'
  | 'weak_password'
  | 'invalid_email'
  | 'invalid_name'
  | 'not_signed_in'
  /** Conta criada (ou login tentado) antes de confirmar o e-mail (Supabase Auth). */
  | 'confirm_email';

export class AuthError extends Error {
  constructor(readonly kind: AuthErrorKind) {
    super(`auth_error:${kind}`);
    this.name = 'AuthError';
  }
}
