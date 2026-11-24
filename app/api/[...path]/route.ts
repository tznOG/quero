import { env } from '../../../lib/env';
import { getAccount, authAction, throttle } from '../../../lib/auth';
import { HttpError, textValue, validateItem } from '../../../lib/validation';
import { fetchOffers, searchLinks } from '../../../lib/offers';

import { checkOrigin, json, readJson } from '../../../lib/http';
import type { WishItem } from '../../../lib/types';
import {
  listCategories,
  createCategory,
  renameCategory,
  deleteCategory,
  categoryDatabaseError,
} from '../../../lib/categories';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Row = {
  id: string;
  user_id: string;
  wishlist_id: string;
  name: string;
  description: string;
  emoji: string;
  share_token: string | null;
  created_at: number;
  url: string;
  price: number;
  target_price: number | null;
  image: string;
  category: string;
  priority: string;
  notes: string;
  purchased: number;
  owner: string;
  count: number;
  item_id: string;
  payload: string;
  checked_at: number;
};
const token = () => crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().slice(0, 8);
function db() {
  if (!env.DB) throw new HttpError(503, 'O banco de dados ainda não está conectado.');
  return env.DB;
}
async function one(sql: string, ...args: unknown[]): Promise<Row | null> {
  return db()
    .prepare(sql)
    .bind(...args)
    .first<Row>();
}
async function all(sql: string, ...args: unknown[]): Promise<Row[]> {
  return (
    await db()
      .prepare(sql)
      .bind(...args)
      .all<Row>()
  ).results;
}
async function run(sql: string, ...args: unknown[]) {
  return db()
    .prepare(sql)
    .bind(...args)
    .run();
}
function itemView(r: Row) {
  return {
    id: r.id,
    wishlistId: r.wishlist_id,
    name: r.name,
    url: r.url,
    price: r.price,
    targetPrice: r.target_price,
    image: r.image,
    category: r.category,
    priority: r.priority,
    notes: r.notes,
    purchased: !!r.purchased,
    createdAt: r.created_at,
  };
}
function listView(r: Row) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    emoji: r.emoji,
    shareToken: r.share_token,
    createdAt: r.created_at,
  };
}
async function requireUser(request: Request) {
  const p = await getAccount(request);
  if (!p) throw new HttpError(401, 'Entre na sua conta para continuar.');
  return p;
}
async function ownList(id: string, userId: string) {
  const l = await one('SELECT * FROM wishlists WHERE id=? AND user_id=?', id, userId);
  if (!l) throw new HttpError(404, 'Lista não encontrada.');
  return l;
}
async function ownItem(id: string, userId: string) {
  const r = await one(
    'SELECT items.* FROM items JOIN wishlists ON wishlists.id=items.wishlist_id WHERE items.id=? AND wishlists.user_id=?',
    id,
    userId,
  );
  if (!r) throw new HttpError(404, 'Desejo não encontrado.');
  return r;
}
async function handle(request: Request) {
  try {
    const url = new URL(request.url),
      path = url.pathname.slice(5).split('/').filter(Boolean),
      method = request.method;
    checkOrigin(request);
    const payload = method === 'POST' || method === 'PATCH' ? await readJson(request) : {};
    if (path.length === 2 && path[0] === 'auth' && method === 'POST')
      return await authAction(request, path[1], payload);
    if (path.length === 1 && path[0] === 'state' && method === 'GET') {
      const p = await getAccount(request);
      if (!p)
        return json({
          user: null,
          lists: [],
          items: [],
          categories: [],
          friends: [],
          offersEnabled: !!env.SERPAPI_KEY,
          recoveryEnabled: !!env.RESEND_API_KEY && !!env.MAIL_FROM,
        });
      const lists = await all('SELECT * FROM wishlists WHERE user_id=? ORDER BY created_at', p.id);
      const items = await all(
        'SELECT items.* FROM items JOIN wishlists ON wishlists.id=items.wishlist_id WHERE wishlists.user_id=? ORDER BY items.created_at DESC',
        p.id,
      );
      const friends = await all(
        'SELECT wishlists.id,wishlists.name,wishlists.share_token,profiles.name AS owner,(SELECT COUNT(*) FROM items WHERE wishlist_id=wishlists.id AND purchased=0) AS count FROM follows JOIN wishlists ON wishlists.id=follows.wishlist_id JOIN profiles ON profiles.id=wishlists.user_id WHERE follows.user_id=? AND wishlists.share_token IS NOT NULL',
        p.id,
      );
      return json({
        user: p,
        lists: lists.map(listView),
        items: items.map(itemView),
        categories: await listCategories(p.id),
        friends: friends.map((r) => ({
          id: r.id,
          name: r.name,
          shareToken: r.share_token,
          owner: r.owner,
          count: r.count,
        })),
        offersEnabled: !!env.SERPAPI_KEY,
        recoveryEnabled: !!env.RESEND_API_KEY && !!env.MAIL_FROM,
      });
    }
    if (path.length === 2 && path[0] === 'shared' && method === 'GET') {
      const l = await one(
        'SELECT wishlists.*, profiles.name AS owner FROM wishlists JOIN profiles ON profiles.id=wishlists.user_id WHERE share_token=?',
        path[1] || '',
      );
      if (!l)
        throw new HttpError(404, 'Este link não existe ou o compartilhamento foi desativado.');
      const user = await getAccount(request);
      const owner = user?.id === l.user_id;
      const rows = await all(
        'SELECT * FROM items WHERE wishlist_id=? AND purchased=0 ORDER BY created_at DESC',
        l.id,
      );
      const reservations = owner
        ? []
        : await all(
            'SELECT reservations.item_id,reservations.user_id FROM reservations JOIN items ON items.id=reservations.item_id WHERE items.wishlist_id=?',
            l.id,
          );
      return json({
        list: { ...listView(l), owner: l.owner },
        isOwner: owner,
        signedIn: !!user,
        items: rows.map((r) => {
          const v: WishItem = itemView(r);
          if (!owner) {
            const reservation = reservations.find((x) => x.item_id === r.id);
            v.reservation = reservation
              ? reservation.user_id === user?.id
                ? 'mine'
                : 'reserved'
              : null;
          }
          return v;
        }),
      });
    }
    const p = await requireUser(request);
    if (path[0] === 'categories') {
      if (path.length === 1 && method === 'GET') return json(await listCategories(p.id));
      if (path.length === 1 && method === 'POST')
        return json(await createCategory(p.id, payload.name), 201);
      if (path.length === 2 && method === 'PATCH')
        return json(await renameCategory(p.id, path[1], payload.name));
      if (path.length === 2 && method === 'DELETE') {
        await deleteCategory(p.id, path[1]);
        return json({ ok: true });
      }
      throw new HttpError(404, 'Página não encontrada.');
    }
    if (path.length === 1 && path[0] === 'profile' && method === 'PATCH') {
      const b = payload;
      await run('UPDATE profiles SET name=? WHERE id=?', textValue(b.name, 60), p.id);
      return json({ ok: true });
    }
    if (path[0] === 'lists') {
      if (method === 'POST' && !path[1]) {
        const b = payload,
          id = crypto.randomUUID();
        const inserted = await run(
          'INSERT INTO wishlists (id,user_id,name,description,emoji,created_at) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM wishlists WHERE user_id=?)<30',
          id,
          p.id,
          textValue(b.name, 80),
          textValue(b.description, 300, false),
          textValue(b.emoji ?? '♡', 10),
          Date.now(),
          p.id,
        );
        if (!inserted.meta.changes) throw new HttpError(400, 'Você pode criar até 30 listas.');
        return json({ id }, 201);
      }
      if (
        !path[1] ||
        path.length > 3 ||
        (path.length === 3 && (path[2] !== 'share' || method !== 'POST'))
      )
        throw new HttpError(404, 'Página não encontrada.');
      const l = await ownList(path[1], p.id);
      if (path[2] === 'share' && method === 'POST') {
        const b = payload;
        let shareToken = l.share_token;
        if (b.enabled === false) {
          shareToken = null;
        } else if (!shareToken || b.rotate === true) {
          shareToken = token();
        }
        if (
          typeof b.enabled !== 'boolean' ||
          (b.rotate !== undefined && typeof b.rotate !== 'boolean')
        )
          throw new HttpError(400, 'Informe se o compartilhamento deve estar ativo.');
        await db().batch([
          db().prepare('UPDATE wishlists SET share_token=? WHERE id=?').bind(shareToken, l.id),
          // Saved shortcuts must not disclose a replacement sharing token.
          db()
            .prepare('DELETE FROM follows WHERE wishlist_id=? AND ?')
            .bind(l.id, shareToken !== l.share_token ? 1 : 0),
        ]);
        return json({ shareToken });
      }
      if (method === 'PATCH') {
        const b = payload;
        await run(
          'UPDATE wishlists SET name=?,description=?,emoji=? WHERE id=?',
          textValue(b.name, 80),
          textValue(b.description, 300, false),
          textValue(b.emoji || '♡', 10),
          l.id,
        );
        return json({ ok: true });
      }
      if (method === 'DELETE') {
        await run('DELETE FROM wishlists WHERE id=?', l.id);
        return json({ ok: true });
      }
    }
    if (path[0] === 'items') {
      if (method === 'POST' && !path[1]) {
        const b = payload;
        await ownList(textValue(b.wishlistId, 100), p.id);
        const d = validateItem(b),
          id = crypto.randomUUID();
        const inserted = await run(
          'INSERT INTO items (id,wishlist_id,name,url,price,target_price,image,category,priority,notes,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM items WHERE wishlist_id=?)<500',
          id,
          b.wishlistId,
          d.name,
          d.url,
          d.price,
          d.targetPrice,
          d.image,
          d.category,
          d.priority,
          d.notes,
          Date.now(),
          b.wishlistId,
        );
        if (!inserted.meta.changes)
          throw new HttpError(400, 'Esta lista chegou ao limite de 500 desejos.');
        return json({ id }, 201);
      }
      if (
        !path[1] ||
        path.length > 3 ||
        (path.length === 3 &&
          !(
            (path[2] === 'reserve' && method === 'POST') ||
            (path[2] === 'offers' && method === 'GET')
          ))
      )
        throw new HttpError(404, 'Página não encontrada.');
      // A reservation needs a current sharing token, even when the item ID is known.
      if (path[2] === 'reserve' && method === 'POST') {
        const b = payload;
        if (b.cancel !== undefined && typeof b.cancel !== 'boolean')
          throw new HttpError(400, 'Reserva inválida.');
        const r = await one(
          'SELECT items.*,wishlists.user_id FROM items JOIN wishlists ON wishlists.id=items.wishlist_id WHERE items.id=? AND wishlists.share_token=? AND items.purchased=0',
          path[1],
          textValue(b.shareToken, 80),
        );
        if (!r) throw new HttpError(404, 'Desejo indisponível.');
        if (r.user_id === p.id)
          throw new HttpError(400, 'Você não pode reservar o seu próprio presente.');
        if (b.cancel === true) {
          await run('DELETE FROM reservations WHERE item_id=? AND user_id=?', r.id, p.id);
          return json({ ok: true });
        }
        await run(
          'INSERT OR IGNORE INTO reservations (item_id,user_id,created_at) SELECT items.id,?,? FROM items JOIN wishlists ON wishlists.id=items.wishlist_id WHERE items.id=? AND items.purchased=0 AND wishlists.share_token=?',
          p.id,
          Date.now(),
          r.id,
          b.shareToken,
        );
        const reservation = await one('SELECT user_id FROM reservations WHERE item_id=?', r.id);
        if (reservation?.user_id !== p.id)
          throw new HttpError(409, 'Outra pessoa acabou de reservar este presente.');
        return json({ ok: true });
      }
      const r = await ownItem(path[1], p.id);
      if (path[2] === 'offers' && method === 'GET') {
        const cached = await one('SELECT * FROM offer_cache WHERE item_id=?', r.id);
        if (cached && Date.now() - cached.checked_at < 6 * 60 * 60 * 1000)
          return json({
            ...JSON.parse(cached.payload),
            checkedAt: cached.checked_at,
            cached: true,
            links: searchLinks(r.name),
          });
        if (!env.SERPAPI_KEY)
          return json({
            enabled: false,
            offers: [],
            checkedAt: null,
            links: searchLinks(r.name),
          });
        await throttle(request, 'offers', p.id, 10);
        let offers;
        try {
          offers = await fetchOffers(r.name, env.SERPAPI_KEY);
        } catch (e) {
          throw new HttpError(502, e instanceof Error ? e.message : 'A busca está indisponível.');
        }
        const checkedAt = Date.now(),
          payload = JSON.stringify({ enabled: true, offers });
        await run(
          'INSERT INTO offer_cache (item_id,payload,checked_at) SELECT id,?,? FROM items WHERE id=? AND name=? ON CONFLICT(item_id) DO UPDATE SET payload=excluded.payload,checked_at=excluded.checked_at',
          payload,
          checkedAt,
          r.id,
          r.name,
        );
        return json({
          enabled: true,
          offers,
          checkedAt,
          links: searchLinks(r.name),
        });
      }
      if (method === 'PATCH') {
        const b = payload;
        if (Object.keys(b).length === 1 && 'priority' in b) {
          const priority = textValue(b.priority, 20);
          if (!['Quero muito', 'Quero', 'Um dia'].includes(priority))
            throw new HttpError(400, 'Prioridade inválida.');
          await run('UPDATE items SET priority=? WHERE id=?', priority, r.id);
          return json({ ok: true });
        }
        if (Object.keys(b).length === 1 && typeof b.purchased === 'boolean') {
          await db().batch([
            db()
              .prepare('UPDATE items SET purchased=? WHERE id=?')
              .bind(b.purchased ? 1 : 0, r.id),
            db()
              .prepare('DELETE FROM reservations WHERE item_id=? AND ?')
              .bind(r.id, b.purchased ? 1 : 0),
          ]);
          return json({ ok: true });
        }
        const d = validateItem(b);
        await db().batch([
          db()
            .prepare(
              'UPDATE items SET name=?,url=?,price=?,target_price=?,image=?,category=?,priority=?,notes=? WHERE id=?',
            )
            .bind(
              d.name,
              d.url,
              d.price,
              d.targetPrice,
              d.image,
              d.category,
              d.priority,
              d.notes,
              r.id,
            ),
          db().prepare('DELETE FROM offer_cache WHERE item_id=?').bind(r.id),
        ]);
        return json({ ok: true });
      }
      if (method === 'DELETE') {
        await run('DELETE FROM items WHERE id=?', r.id);
        return json({ ok: true });
      }
    }
    if (path.length === 1 && path[0] === 'friends' && method === 'POST') {
      const b = payload,
        l = await one('SELECT * FROM wishlists WHERE share_token=?', textValue(b.shareToken, 80));
      if (!l) throw new HttpError(404, 'Lista não encontrada. Confira o link.');
      if (l.user_id === p.id) throw new HttpError(400, 'Essa lista já é sua.');
      await run(
        'INSERT OR IGNORE INTO follows (id,user_id,wishlist_id,created_at) SELECT ?,?,id,? FROM wishlists WHERE id=? AND share_token=?',
        crypto.randomUUID(),
        p.id,
        Date.now(),
        l.id,
        b.shareToken,
      );
      return json({ ok: true });
    }
    if (path.length === 2 && path[0] === 'friends' && path[1] && method === 'DELETE') {
      await run('DELETE FROM follows WHERE user_id=? AND wishlist_id=?', p.id, path[1]);
      return json({ ok: true });
    }
    throw new HttpError(404, 'Página não encontrada.');
  } catch (e) {
    const categoryError = categoryDatabaseError(e);
    if (categoryError) return json({ error: categoryError.message }, categoryError.status);
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error('Wishlist API error', e instanceof Error ? e.name : 'unknown');
    return json({ error: 'Não foi possível concluir. Tente novamente em instantes.' }, 500);
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
