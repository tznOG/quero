import { env } from './env';
import { publicOrigin, requestOrigin } from './public-origin';
import { HttpError, textValue } from './validation';
const encoder = new TextEncoder();
const hex = (bytes: ArrayBuffer | Uint8Array) =>
  Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
export const randomToken = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export const hashToken = async (value: string) =>
  hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
let activeHashes = 0;
async function derivePassword(password: string, salt: string, iterations: number) {
  if (activeHashes >= 4)
    throw new HttpError(503, 'Autenticação ocupada. Tente novamente em instantes.');
  activeHashes++;
  try {
    const material = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits'],
    );
    return hex(
      await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          hash: 'SHA-256',
          salt: encoder.encode(salt),
          iterations,
        },
        material,
        256,
      ),
    );
  } finally {
    activeHashes--;
  }
}
async function passwordHash(password: string, salt: string) {
  return 'pbkdf2-sha256$600000$' + (await derivePassword(password, salt, 600000));
}
function validatePassword(password: unknown) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128)
    throw new HttpError(400, 'Use uma senha com 12 a 128 caracteres.');
  return password;
}
function emailValue(raw: unknown) {
  const email = textValue(raw, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new HttpError(400, 'Informe um e-mail válido.');
  return email;
}
async function verifyPassword(
  password: unknown,
  user: { password_hash: string; salt: string } | null,
) {
  if (typeof password !== 'string' || password.length > 128) return false;
  const stored = user?.password_hash || 'pbkdf2-sha256$600000$' + '0'.repeat(64);
  const modern = stored.startsWith('pbkdf2-sha256$600000$');
  const expected = modern ? stored.slice('pbkdf2-sha256$600000$'.length) : stored;
  if (!/^[a-f0-9]{64}$/.test(expected)) return false;
  const hashed = await derivePassword(
    password,
    user?.salt || 'unregistered-account-padding-salt',
    modern ? 600000 : 100000,
  );
  let difference = 0;
  for (let i = 0; i < 64; i++) difference |= hashed.charCodeAt(i) ^ expected.charCodeAt(i);
  return !!user && difference === 0;
}
const cookie = (request: Request, value: string, maxAge: number) =>
  `en_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${requestOrigin(request).startsWith('https:') ? '; Secure' : ''}`;
function readCookie(request: Request) {
  return (
    request.headers
      .get('cookie')
      ?.split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('en_session='))
      ?.slice(11) || ''
  );
}
export async function getAccount(
  request: Request,
): Promise<{ id: string; name: string; email: string } | null> {
  const token = readCookie(request);
  if (!token || !/^[a-f0-9]{64}$/.test(token) || !env.DB) return null;
  const now = Date.now(),
    key = await hashToken(token);
  const account = await env.DB.prepare(
    'SELECT profiles.id,profiles.name,profiles.email FROM sessions JOIN profiles ON profiles.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>? AND sessions.last_seen>?',
  )
    .bind(key, now, now - 86400000)
    .first<{ id: string; name: string; email: string }>();
  if (account)
    await env.DB.prepare('UPDATE sessions SET last_seen=? WHERE token_hash=? AND last_seen<?')
      .bind(now, key, now - 60000)
      .run();
  return account;
}
export async function throttle(request: Request, scope: string, email: string, limit: number) {
  // Enable only with an origin reachable exclusively through the trusted proxy.
  const ip =
    process.env.TRUST_PROXY === 'true' && process.env.ORIGIN_PROXY_ONLY === 'true'
      ? request.headers.get('cf-connecting-ip') || 'local'
      : 'local';
  for (const [kind, value, max] of [
    ['ip', ip, limit * 3],
    ['email', email, limit],
  ] as const) {
    const key = await hashToken(scope + ':' + kind + ':' + value),
      now = Date.now(),
      expiry = now + 15 * 60 * 1000;
    const row = await env
      .DB!.prepare(
        'INSERT INTO rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<? THEN 1 ELSE count+1 END,expires_at=CASE WHEN expires_at<? THEN ? ELSE expires_at END RETURNING count',
      )
      .bind(key, expiry, now, now, expiry)
      .first<{ count: number }>();
    if (row!.count > max)
      throw new HttpError(429, 'Muitas tentativas. Aguarde 15 minutos e tente novamente.');
  }
}
export async function authAction(
  request: Request,
  action: string,
  body: Record<string, unknown>,
): Promise<Response> {
  if (!env.DB) throw new HttpError(503, 'Banco de dados indisponível.');
  const db = env.DB,
    now = Date.now();
  const result = (data: unknown, c?: string) =>
    Response.json(data, {
      headers: {
        'Cache-Control': 'no-store',
        ...(c ? { 'Set-Cookie': c } : {}),
      },
    });
  if (action === 'logout') {
    const token = readCookie(request);
    if (/^[a-f0-9]{64}$/.test(token))
      await db
        .prepare('DELETE FROM sessions WHERE token_hash=?')
        .bind(await hashToken(token))
        .run();
    return result({ ok: true }, cookie(request, '', 0));
  }
  if (action === 'password' || action === 'delete-account') {
    const account = await getAccount(request);
    if (!account) throw new HttpError(401, 'Entre na sua conta para continuar.');
    await throttle(request, 'account-security', account.id, 5);
    const user = await db
      .prepare('SELECT password_hash,salt FROM profiles WHERE id=?')
      .bind(account.id)
      .first<{ password_hash: string; salt: string }>();
    if (!(await verifyPassword(body.currentPassword, user)))
      throw new HttpError(401, 'Sua senha atual está incorreta.');
    if (action === 'password') {
      const salt = randomToken(),
        hashed = await passwordHash(validatePassword(body.password), salt);
      const session = randomToken();
      await db.batch([
        db
          .prepare('UPDATE profiles SET password_hash=?,salt=? WHERE id=?')
          .bind(hashed, salt, account.id),
        db.prepare('DELETE FROM sessions WHERE user_id=?').bind(account.id),
        db.prepare('DELETE FROM password_resets WHERE user_id=?').bind(account.id),
        db
          .prepare(
            'INSERT INTO sessions (token_hash,user_id,expires_at,last_seen) VALUES (?,?,?,?)',
          )
          .bind(await hashToken(session), account.id, now + 30 * 86400000, now),
      ]);
      return result({ ok: true }, cookie(request, session, 30 * 86400));
    }
    if (body.confirmation !== 'EXCLUIR') throw new HttpError(400, 'Digite EXCLUIR para confirmar.');
    await db.batch([
      db.prepare('DELETE FROM reservations WHERE user_id=?').bind(account.id),
      db.prepare('DELETE FROM follows WHERE user_id=?').bind(account.id),
      db.prepare('DELETE FROM wishlists WHERE user_id=?').bind(account.id),
      db.prepare('DELETE FROM profiles WHERE id=?').bind(account.id),
    ]);
    return result({ ok: true }, cookie(request, '', 0));
  }
  if (action === 'reset-request') {
    const email = emailValue(body.email);
    await throttle(request, 'reset', email, 3);
    if (!env.RESEND_API_KEY || !env.MAIL_FROM)
      throw new HttpError(
        503,
        'A recuperação por e-mail ainda não foi configurada pelo administrador.',
      );
    const user = await db
      .prepare('SELECT id FROM profiles WHERE email=?')
      .bind(email)
      .first<{ id: string }>();
    if (user) {
      const token = randomToken();
      await db
        .prepare('INSERT INTO password_resets (token_hash,user_id,expires_at) VALUES (?,?,?)')
        .bind(await hashToken(token), user.id, now + 30 * 60 * 1000)
        .run();
      const link = new URL('/?reset=' + token, publicOrigin(request)).href;
      let sent: Response;
      try {
        sent = await fetch('https://api.resend.com/emails', {
          signal: AbortSignal.timeout(15000),
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: env.MAIL_FROM,
            to: [email],
            subject: 'Redefina sua senha — Quero',
            text: `Você pediu uma nova senha. Abra o link em até 30 minutos: ${link}\nSe não foi você, ignore esta mensagem.`,
          }),
        });
        if (!sent.ok) throw new Error('Mail provider failed');
      } catch {
        await db
          .prepare('DELETE FROM password_resets WHERE token_hash=?')
          .bind(await hashToken(token))
          .run();
        throw new HttpError(502, 'Não foi possível enviar o e-mail agora. Tente mais tarde.');
      }
    }
    return result({
      message: 'Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.',
    });
  }
  if (action === 'reset') {
    const token = textValue(body.token, 64),
      password = validatePassword(body.password);
    await throttle(request, 'reset-token', token, 5);
    const tokenHash = await hashToken(token),
      reset = await db
        .prepare('SELECT * FROM password_resets WHERE token_hash=? AND expires_at>?')
        .bind(tokenHash, now)
        .first<{ user_id: string }>();
    if (!reset) throw new HttpError(400, 'Este link expirou ou já foi usado. Solicite outro.');
    const salt = randomToken(),
      hashed = await passwordHash(password, salt),
      validAt = Date.now();
    // A D1 batch is transactional: the password update and token consumption cannot interleave.
    const updated = await db.batch([
      db
        .prepare(
          'UPDATE profiles SET password_hash=?,salt=? WHERE id=? AND EXISTS (SELECT 1 FROM password_resets WHERE token_hash=? AND expires_at>?)',
        )
        .bind(hashed, salt, reset.user_id, tokenHash, validAt),
      db
        .prepare(
          'DELETE FROM sessions WHERE user_id=? AND EXISTS (SELECT 1 FROM password_resets WHERE token_hash=? AND expires_at>?)',
        )
        .bind(reset.user_id, tokenHash, validAt),
      db
        .prepare(
          'DELETE FROM password_resets WHERE user_id=? AND EXISTS (SELECT 1 FROM password_resets WHERE token_hash=? AND expires_at>?)',
        )
        .bind(reset.user_id, tokenHash, validAt),
    ]);
    if (!updated[0].meta.changes) throw new HttpError(400, 'Este link não está mais disponível.');
    return result(
      { message: 'Senha atualizada. Entre com sua nova senha.' },
      cookie(request, '', 0),
    );
  }
  if (action !== 'signup' && action !== 'login') throw new HttpError(404, 'Ação não encontrada.');
  const email = emailValue(body.email);
  await throttle(request, action, email, action === 'login' ? 10 : 5);
  let id: string;
  let expectedHash: string;
  let expectedSalt: string;
  if (action === 'signup') {
    const password = validatePassword(body.password),
      name = textValue(body.name, 60),
      salt = randomToken(),
      hashed = await passwordHash(password, salt);
    expectedHash = hashed;
    expectedSalt = salt;
    id = crypto.randomUUID();
    const existing = await db.prepare('SELECT id FROM profiles WHERE email=?').bind(email).first();
    if (existing)
      throw new HttpError(409, 'Este e-mail já tem uma conta. Entre ou recupere sua senha.');
    try {
      await db.batch([
        db
          .prepare(
            'INSERT INTO profiles (id,name,email,password_hash,salt,created_at) VALUES (?,?,?,?,?,?)',
          )
          .bind(id, name, email, hashed, salt, now),
        db
          .prepare(
            'INSERT INTO wishlists (id,user_id,name,description,emoji,created_at) VALUES (?,?,?,?,?,?)',
          )
          .bind(crypto.randomUUID(), id, 'Minha wishlist', 'Pequenos e grandes desejos.', '♡', now),
      ]);
    } catch (e) {
      if (String(e).includes('UNIQUE')) throw new HttpError(409, 'Este e-mail já tem uma conta.');
      throw e;
    }
  } else {
    const password = typeof body.password === 'string' ? body.password : '';
    if (password.length > 128) throw new HttpError(400, 'E-mail ou senha incorretos.');
    const user = await db
      .prepare('SELECT id,password_hash,salt FROM profiles WHERE email=?')
      .bind(email)
      .first<{ id: string; password_hash: string; salt: string }>();
    if (!(await verifyPassword(password, user)) || !user)
      throw new HttpError(401, 'E-mail ou senha incorretos.');
    id = user.id;
    expectedHash = user.password_hash;
    expectedSalt = user.salt;
    if (!user.password_hash.startsWith('pbkdf2-sha256$600000$')) {
      const upgraded = await passwordHash(password, user.salt);
      const changed = await db
        .prepare('UPDATE profiles SET password_hash=? WHERE id=? AND password_hash=? AND salt=?')
        .bind(upgraded, id, user.password_hash, user.salt)
        .run();
      if (!changed.meta.changes) throw new HttpError(401, 'Entre novamente com sua senha atual.');
      expectedHash = upgraded;
    }
  }
  const session = randomToken();
  const issued = await db.batch([
    db
      .prepare(
        'INSERT INTO sessions (token_hash,user_id,expires_at,last_seen) SELECT ?,id,?,? FROM profiles WHERE id=? AND password_hash=? AND salt=?',
      )
      .bind(await hashToken(session), now + 30 * 86400000, now, id, expectedHash, expectedSalt),
    db.prepare('DELETE FROM sessions WHERE expires_at<?').bind(now),
    db.prepare('DELETE FROM rate_limits WHERE expires_at<?').bind(now),
    db.prepare('DELETE FROM password_resets WHERE expires_at<?').bind(now),
  ]);
  if (!issued[0].meta.changes) throw new HttpError(401, 'Entre novamente com sua senha atual.');
  return result({ ok: true }, cookie(request, session, 30 * 86400));
}
