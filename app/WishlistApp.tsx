'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useId,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  Heart,
  Plus,
  Search,
  Share2,
  ArrowUpRight,
  Gift,
  Sparkles,
  Tag,
  Users,
  Check,
  ChevronDown,
  ChevronRight,
  X,
  SlidersHorizontal,
  LayoutGrid,
  List,
  ArrowRight,
  Link2,
  Copy,
  LockKeyhole,
  LogOut,
  Menu,
  Pencil,
  Trash2,
  Loader2,
  ExternalLink,
  CircleCheck,
  ShoppingBag,
  Settings2,
  RefreshCw,
  Eye,
  EyeOff,
  Bookmark,
  Leaf,
  CheckCheck,
} from 'lucide-react';
import Link from 'next/link';
import SecurityForm from './SecurityForm';
import ThemePicker from './ThemePicker';
import {
  type AppState,
  type WishItem,
  type WishList,
  categories,
  money,
  demoList,
  demoItems,
} from '../lib/types';
import { searchLinks, type Offer } from '../lib/offers';

type OffersData = {
  enabled: boolean;
  offers: Offer[];
  checkedAt: number | null;
  links: { name: string; url: string }[];
};
const emptyState: AppState = {
  user: null,
  lists: [],
  items: [],
  friends: [],
  offersEnabled: false,
  recoveryEnabled: false,
};
type ModalState = {
  type:
    | 'auth'
    | 'item'
    | 'detail'
    | 'share'
    | 'list'
    | 'profile'
    | 'friend'
    | 'confirm'
    | 'reset'
    | 'security';
  item?: WishItem;
  list?: WishList;
  action?: () => Promise<void>;
  title?: string;
  message?: string;
};
type Shared = {
  list: WishList;
  items: WishItem[];
  isOwner: boolean;
  signedIn: boolean;
};
async function api<
  T = {
    ok?: boolean;
    id?: string;
    shareToken?: string | null;
    message?: string;
  },
>(path: string, method = 'GET', data?: unknown): Promise<T> {
  const response = await fetch('/api/' + path, {
    method,
    credentials: 'same-origin',
    headers: data !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });
  const body = (await response.json().catch(() => {
    throw new Error('O servidor não respondeu como esperado. Tente novamente.');
  })) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || 'Não foi possível concluir.');
  return body;
}
function domain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Produto';
  }
}
function ProductImage({ item }: { item: WishItem }) {
  const [failed, setFailed] = useState('');
  return item.image && failed !== item.image ? (
    // Images come from user-selected HTTPS stores; do not proxy arbitrary URLs through an optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.image}
      alt={item.name}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(item.image)}
    />
  ) : (
    <div className="image-placeholder">
      <ShoppingBag size={52} strokeWidth={1} />
      <span>{item.category}</span>
    </div>
  );
}
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    titleId = useId();
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={'modal ' + (wide ? 'modal-wide' : '')}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-inner">
        <header className="modal-heading">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Fechar">
            <X size={21} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

export default function WishlistApp() {
  const [state, setState] = useState<AppState>(emptyState),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [examples, setExamples] = useState(demoItems),
    [activeList, setActiveList] = useState(''),
    [view, setView] = useState('wishlist');
  const [search, setSearch] = useState(''),
    [category, setCategory] = useState('Todas'),
    [sort, setSort] = useState('recent'),
    [tab, setTab] = useState('all'),
    [layout, setLayout] = useState('grid');
  const [modal, setModal] = useState<ModalState | null>(null),
    [toast, setToast] = useState(''),
    [mobileNav, setMobileNav] = useState(false),
    [shared, setShared] = useState<Shared | null>(null),
    [shareToken, setShareToken] = useState('');
  const [sharedError, setSharedError] = useState(''),
    [busy, setBusy] = useState(false),
    [resetToken, setResetToken] = useState('');
  const sharedRequest = useRef(0);
  const demo = !loading && !error && !state.user && !shareToken;
  const lists = demo ? [demoList] : state.lists;
  const currentList = shared?.list || lists.find((l) => l.id === activeList) || lists[0];
  const own = !shared || shared.isOwner;
  const items = shared
    ? shared.items
    : (demo ? examples : state.items).filter(
        (i) => view === 'offers' || view === 'purchased' || i.wishlistId === currentList?.id,
      );
  const reload = useCallback(async () => {
    const data = await api<AppState>('state');
    setState(data);
    return data as AppState;
  }, []);
  const loadShared = useCallback(async (token: string) => {
    const requestId = ++sharedRequest.current;
    try {
      const data = await api<Shared>('shared/' + encodeURIComponent(token));
      if (requestId !== sharedRequest.current) return;
      setShared(data);
      setSharedError('');
    } catch (e) {
      if (requestId !== sharedRequest.current) return;
      setShared(null);
      setSharedError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    let active = true;
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      const query = new URLSearchParams(location.search),
        token = query.get('lista') || '';
      setShareToken(token);
      if (query.get('reset')) {
        setResetToken(query.get('reset')!);
        setModal({ type: 'reset' });
        query.delete('reset');
        history.replaceState(
          {},
          '',
          location.pathname + (query.size ? '?' + query.toString() : ''),
        );
      }
      try {
        await Promise.all([reload(), token ? loadShared(token) : Promise.resolve()]);
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [reload, loadShared]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  const notify = (message: string) => setToast(message);
  const refresh = async () => {
    await reload();
    if (shareToken) await loadShared(shareToken);
  };
  const needAccount = () => {
    setModal({ type: 'auth' });
  };
  const selectView = (v: string, id?: string) => {
    sharedRequest.current++;
    setView(v);
    setShared(null);
    setShareToken('');
    setSharedError('');
    setSearch('');
    setCategory('Todas');
    setTab('all');
    if (id) setActiveList(id);
    setMobileNav(false);
    history.replaceState({}, '', '/');
  };
  const filtered = items
    .filter((i) => {
      if (view === 'purchased' ? !i.purchased : i.purchased) return false;
      return (
        (!search ||
          [i.name, i.notes, i.category].some((s) =>
            s.toLowerCase().includes(search.toLowerCase()),
          )) &&
        (category === 'Todas' || i.category === category) &&
        (tab !== 'priority' || i.priority === 'Quero muito')
      );
    })
    .sort((a, b) =>
      sort === 'low'
        ? a.price - b.price
        : sort === 'high'
          ? b.price - a.price
          : sort === 'priority'
            ? ['Quero muito', 'Quero', 'Um dia'].indexOf(a.priority) -
              ['Quero muito', 'Quero', 'Um dia'].indexOf(b.priority)
            : b.createdAt - a.createdAt,
    );
  const activeItems = items.filter((i) => !i.purchased),
    total = activeItems.reduce((s, i) => s + i.price, 0),
    targets = activeItems.filter((i) => i.targetPrice != null).length;
  const changeItem = async (item: WishItem, method: string, data?: Record<string, unknown>) => {
    if (demo) {
      setExamples((prev) =>
        method === 'DELETE'
          ? prev.filter((i) => i.id !== item.id)
          : prev.map((i) => (i.id === item.id ? { ...i, ...data } : i)),
      );
    } else {
      await api('items/' + item.id, method, data);
      await refresh();
    }
  };
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify('Link copiado. Espalhe um pouco de carinho!');
    } catch {
      notify('Não foi possível copiar. Selecione e copie o link no campo.');
    }
  };
  const reserve = async (item: WishItem) => {
    if (!state.user) return needAccount();
    setBusy(true);
    try {
      await api('items/' + item.id + '/reserve', 'POST', {
        shareToken,
        cancel: item.reservation === 'mine',
      });
      await loadShared(shareToken);
      setModal(null);
      notify(
        item.reservation === 'mine'
          ? 'Reserva cancelada.'
          : 'Presente reservado. A surpresa está segura!',
      );
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const sharedUrl =
    currentList?.shareToken && typeof location !== 'undefined'
      ? `${location.origin}/?lista=${currentList.shareToken}`
      : '';
  const title = shared
    ? `Wishlist de ${shared.list.owner}`
    : view === 'purchased'
      ? 'Desejos realizados'
      : view === 'friends'
        ? 'Pessoas queridas'
        : view === 'offers'
          ? 'Encontre uma boa oportunidade'
          : currentList?.name || 'Minha wishlist';
  return (
    <div className="app-shell">
      {mobileNav && (
        <button
          className="nav-backdrop"
          aria-label="Fechar menu"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside className={'sidebar ' + (mobileNav ? 'sidebar-open' : '')}>
        <Link className="brand" href="/" aria-label="Quero — início">
          <span className="brand-mark">
            <Heart size={26} />
            <Heart size={18} />
          </span>
          <span>
            quero<span className="brand-dot">.</span>
          </span>
        </Link>
        <div className="workspace">
          <span className="workspace-icon">
            <Leaf size={18} />
          </span>
          <div>
            <strong>Meu cantinho</strong>
            <small>Um lugar para sonhar</small>
          </div>
          <Heart size={14} className="muted" />
        </div>
        <p className="nav-label">SEU UNIVERSO</p>
        <nav aria-label="Menu principal">
          <button
            className={'nav-item ' + (view === 'wishlist' && !shared ? 'active' : '')}
            onClick={() => selectView('wishlist')}
          >
            <Heart size={19} />
            <span>Minha wishlist</span>
            <span className="nav-count">
              {demo
                ? examples.filter((i) => !i.purchased).length
                : state.items.filter((i) => !i.purchased).length}
            </span>
          </button>
          <button
            className={'nav-item ' + (view === 'offers' ? 'active' : '')}
            onClick={() => selectView('offers')}
          >
            <Tag size={19} />
            <span>Ofertas e cupons</span>
            <span className="tiny-dot" />
          </button>
          <button
            className={'nav-item ' + (view === 'friends' ? 'active' : '')}
            onClick={() => selectView('friends')}
          >
            <Users size={19} />
            <span>Pessoas queridas</span>
          </button>
          <button
            className={'nav-item ' + (view === 'purchased' ? 'active' : '')}
            onClick={() => selectView('purchased')}
          >
            <CircleCheck size={19} />
            <span>Já conquistei</span>
          </button>
        </nav>
        <div className="nav-section-title">
          <p className="nav-label">MINHAS LISTAS</p>
          <button
            className="icon-button small"
            aria-label="Criar lista"
            onClick={() => (state.user ? setModal({ type: 'list' }) : needAccount())}
          >
            <Plus size={17} />
          </button>
        </div>
        <div className="my-lists">
          {lists.map((l, i) => (
            <button
              key={l.id}
              className={'list-nav ' + (currentList?.id === l.id && !shared ? 'selected' : '')}
              onClick={() => selectView('wishlist', l.id)}
            >
              <span className={'list-dot color-' + (i % 4)} />
              <span>{l.name}</span>
              <ChevronRight size={14} />
            </button>
          ))}
          <button
            className="new-list"
            onClick={() => (state.user ? setModal({ type: 'list' }) : needAccount())}
          >
            <Plus size={16} />
            Criar nova lista
          </button>
        </div>
        <div className="sidebar-bottom">
          <ThemePicker />
          <div className="little-note">
            <div className="note-hearts">
              ♡ <span>✧</span> ♡
            </div>
            <strong>Presente bom tem história.</strong>
            <p>Compartilhe seus desejos com quem faz parte da sua.</p>
            <button
              onClick={() =>
                shared
                  ? selectView('wishlist')
                  : demo
                    ? needAccount()
                    : currentList
                      ? setModal({ type: 'share' })
                      : setModal({ type: 'list' })
              }
            >
              Convidar alguém <ArrowUpRight size={15} />
            </button>
          </div>
          <button
            className="account"
            onClick={() => setModal({ type: state.user ? 'profile' : 'auth' })}
          >
            <span className="avatar">{state.user?.name.slice(0, 1).toUpperCase() || '♡'}</span>
            <span>
              <strong>{state.user?.name || 'Seu próximo sonho'}</strong>
              <small>{state.user ? 'Minha conta' : 'Entre ou crie sua conta'}</small>
            </span>
            <Settings2 size={17} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Abrir menu"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb">Meu cantinho</span>
            <ChevronRight size={13} />
            <strong>
              {shared
                ? 'Lista compartilhada'
                : view === 'friends'
                  ? 'Pessoas queridas'
                  : view === 'offers'
                    ? 'Ofertas e cupons'
                    : view === 'purchased'
                      ? 'Já conquistei'
                      : 'Minha wishlist'}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="made-with">
              Feito para compartilhar <Heart size={12} />
            </span>
            {state.user ? (
              <button
                className="avatar small-avatar"
                aria-label="Minha conta"
                onClick={() => setModal({ type: 'profile' })}
              >
                {state.user.name.slice(0, 1).toUpperCase()}
              </button>
            ) : (
              <button className="button top-login" onClick={needAccount}>
                Entrar <ArrowUpRight size={14} />
              </button>
            )}
          </div>
        </header>
        <main className="main-content">
          {error && (
            <div className="notice error" role="alert">
              {error}
              <button
                onClick={() => {
                  setError('');
                  setLoading(true);
                  refresh()
                    .catch((e) => setError(e.message))
                    .finally(() => setLoading(false));
                }}
              >
                Tentar novamente
              </button>
            </div>
          )}
          {sharedError ? (
            <div className="empty-state">
              <Link2 size={40} />
              <h1>Esse desejo está guardado.</h1>
              <p>{sharedError}</p>
              <button className="button primary" onClick={() => selectView('wishlist')}>
                Ir para minha wishlist
              </button>
            </div>
          ) : (
            <>
              <section className="hero">
                <div className="hero-copy">
                  <p className="eyebrow">
                    <span /> PEQUENOS DESEJOS. GRANDES SORRISOS.
                  </p>
                  <h1>
                    {shared ? (
                      <>
                        Um jeito de dizer
                        <br />
                        <em>“lembrei de você”.</em>
                      </>
                    ) : (
                      <>
                        Toda vontade merece
                        <br />
                        um <em>lugar especial.</em>
                      </>
                    )}
                  </h1>
                  <p>
                    {shared
                      ? `Descubra o que faz ${shared.list.owner} sorrir. Reserve um presente e mantenha a surpresa.`
                      : 'Guarde o que você ama, descubra boas oportunidades e compartilhe um pouquinho dos seus sonhos.'}
                  </p>
                  <div className="hero-actions">
                    <button
                      className="button primary"
                      onClick={() =>
                        shared
                          ? state.user
                            ? api('friends', 'POST', { shareToken })
                                .then(async () => {
                                  await refresh();
                                  notify('Lista salva em Pessoas queridas.');
                                })
                                .catch((e) => notify(e.message))
                            : needAccount()
                          : demo
                            ? needAccount()
                            : currentList
                              ? setModal({ type: 'item' })
                              : setModal({ type: 'list' })
                      }
                    >
                      {shared ? <Bookmark size={17} /> : <Plus size={18} />}{' '}
                      {shared
                        ? 'Salvar esta lista'
                        : demo
                          ? 'Criar minha wishlist'
                          : 'Adicionar um desejo'}
                    </button>
                    <span className="hero-footnote">
                      <LockKeyhole size={12} />
                      {shared ? 'Sem estragar a surpresa' : 'Seus desejos, do seu jeito'}
                    </span>
                  </div>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <span className="art-spark spark-one">✧</span>
                  <span className="art-spark spark-two">✦</span>
                  <span className="art-dotted" />
                  <div className="art-note">
                    <span className="tape" />
                    <Heart size={24} />
                    <span>
                      coisas que
                      <br />
                      me fazem <em>sorrir</em>
                    </span>
                    <div className="note-line" />
                    <div className="note-line short" />
                  </div>
                  <div className="art-gift">
                    <span className="gift-bow left" />
                    <span className="gift-bow right" />
                    <span className="gift-lid" />
                    <span className="gift-ribbon" />
                    <Heart className="gift-heart" size={25} />
                  </div>
                  <div className="art-label">
                    <Heart size={13} fill="currentColor" /> com carinho, sempre
                  </div>
                  <span className="art-mini-heart">♡</span>
                </div>
              </section>
              {demo && (
                <div className="demo-notice">
                  <span>
                    <Sparkles size={15} />
                    <strong>Um gostinho do seu cantinho.</strong> Estes são produtos e preços de
                    exemplo.
                  </span>
                  <button onClick={needAccount}>
                    Criar minha conta <ArrowRight size={14} />
                  </button>
                </div>
              )}
              {view === 'friends' && !shared ? (
                <section className="friends-section">
                  <div className="section-title">
                    <div>
                      <h2>
                        {title}
                        <span className="heading-dot">.</span>
                      </h2>
                      <p>As melhores ideias de presente vêm de quem você ama.</p>
                    </div>
                    <button
                      className="button primary"
                      onClick={() => (state.user ? setModal({ type: 'friend' }) : needAccount())}
                    >
                      <Plus size={17} />
                      Adicionar lista
                    </button>
                  </div>
                  {state.friends.length ? (
                    <div className="friends-grid">
                      {state.friends.map((f) => (
                        <article key={f.id} className="friend-card">
                          <span className="friend-avatar">{f.owner.slice(0, 1).toUpperCase()}</span>
                          <h3>{f.owner}</h3>
                          <p>{f.name}</p>
                          <span>{f.count} desejos esperando um sorriso</span>
                          <a className="button secondary" href={'/?lista=' + f.shareToken}>
                            Ver wishlist <ArrowUpRight size={16} />
                          </a>
                          <button
                            className="text-button subtle"
                            onClick={() =>
                              setModal({
                                type: 'confirm',
                                title: 'Remover das pessoas queridas?',
                                message:
                                  'A lista continuará existindo. Você pode adicioná-la de novo quando quiser.',
                                action: async () => {
                                  await api('friends/' + f.id, 'DELETE');
                                  await refresh();
                                },
                              })
                            }
                          >
                            Remover atalho
                          </button>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      icon={<Users size={38} />}
                      title="Tem espaço para quem você ama."
                      text="Peça o link da wishlist de alguém e salve aqui. Na hora de presentear, a ideia certa já vai estar esperando."
                      action={
                        <button
                          className="button primary"
                          onClick={() =>
                            state.user ? setModal({ type: 'friend' }) : needAccount()
                          }
                        >
                          <Link2 size={16} />
                          Adicionar uma wishlist
                        </button>
                      }
                    />
                  )}
                </section>
              ) : (
                <>
                  <section className="stats-grid" aria-label="Resumo da wishlist">
                    <div className="stat-card">
                      <span className="stat-icon green">
                        <Heart size={21} />
                      </span>
                      <div>
                        <span>Desejos na lista</span>
                        <strong>
                          {activeItems.length.toString().padStart(2, '0')}
                          <small> coisas para amar</small>
                        </strong>
                      </div>
                      <span className="stat-decoration">♡</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-icon peach">
                        <ShoppingBag size={21} />
                      </span>
                      <div>
                        <span>Valor dos seus sonhos</span>
                        <strong>{money(total)}</strong>
                      </div>
                    </div>
                    <div className="stat-card">
                      <span className="stat-icon lavender">
                        <Tag size={21} />
                      </span>
                      <div>
                        <span>De olho no preço</span>
                        <strong>
                          {targets.toString().padStart(2, '0')}
                          <small> com preço desejado</small>
                        </strong>
                      </div>
                    </div>
                  </section>
                  {view === 'offers' && (
                    <div className="offer-intro">
                      <span className="stat-icon green">
                        <Sparkles size={24} />
                      </span>
                      <div>
                        <h3>O desejo é seu. A pesquisa fica mais fácil.</h3>
                        <p>
                          {state.offersEnabled
                            ? 'Abra um produto para consultar preços de outras lojas. Resultados ficam salvos por 6 horas.'
                            : 'Compare nas lojas e procure cupons pelos atalhos de cada produto. A busca automática de ofertas ainda não está disponível.'}
                        </p>
                      </div>
                    </div>
                  )}
                  <section className="wishlist-section">
                    <div className="section-title">
                      <div>
                        <div className="title-line">
                          <h2>
                            {title}
                            <span className="heading-dot">.</span>
                          </h2>
                          {!shared && view === 'wishlist' && own && currentList && !demo && (
                            <button
                              className="icon-button small"
                              aria-label="Editar lista"
                              onClick={() => setModal({ type: 'list', list: currentList })}
                            >
                              <Pencil size={15} />
                            </button>
                          )}
                        </div>
                        <p>
                          {view === 'purchased'
                            ? 'Um cantinho para celebrar o que já se tornou realidade.'
                            : shared
                              ? shared.list.description
                              : currentList?.description ||
                                'Uma coleção de coisas que fazem seus olhos brilharem.'}
                        </p>
                      </div>
                      <div className="section-actions">
                        {!shared && view === 'wishlist' && (
                          <button
                            className="button secondary"
                            onClick={() =>
                              demo
                                ? needAccount()
                                : currentList
                                  ? setModal({ type: 'share' })
                                  : setModal({ type: 'list' })
                            }
                          >
                            <Share2 size={16} />
                            <span>Compartilhar lista</span>
                          </button>
                        )}
                        {own && (
                          <button
                            className="button primary"
                            onClick={() =>
                              currentList ? setModal({ type: 'item' }) : setModal({ type: 'list' })
                            }
                          >
                            <Plus size={17} />
                            <span>Adicionar desejo</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="list-toolbar">
                      <div className="tabs" role="tablist" aria-label="Filtrar desejos">
                        <button
                          role="tab"
                          aria-selected={tab === 'all'}
                          className={tab === 'all' ? 'selected' : ''}
                          onClick={() => setTab('all')}
                        >
                          Todos os desejos{' '}
                          <span>
                            {
                              items.filter((i) =>
                                view === 'purchased' ? i.purchased : !i.purchased,
                              ).length
                            }
                          </span>
                        </button>
                        <button
                          role="tab"
                          aria-selected={tab === 'priority'}
                          className={tab === 'priority' ? 'selected' : ''}
                          onClick={() => setTab('priority')}
                        >
                          <Heart size={14} />
                          Quero muito
                        </button>
                      </div>
                      <div className="toolbar-controls">
                        <label className="search-input">
                          <Search size={16} />
                          <input
                            placeholder="Buscar um desejo..."
                            aria-label="Buscar um desejo"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                          {search && (
                            <button
                              className="icon-button small"
                              aria-label="Limpar busca"
                              onClick={() => setSearch('')}
                            >
                              <X size={14} />
                            </button>
                          )}
                        </label>
                        <label className="filter-select">
                          <SlidersHorizontal size={15} />
                          <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            aria-label="Filtrar categoria"
                          >
                            <option value="Todas">Categorias</option>
                            {categories.map((c) => (
                              <option key={c}>{c}</option>
                            ))}
                          </select>
                          <ChevronDown size={13} />
                        </label>
                      </div>
                    </div>
                    <div className="results-toolbar">
                      <p>
                        {filtered.length} {filtered.length === 1 ? 'desejo' : 'desejos'}
                        {category !== 'Todas' ? ' em ' + category : ''}
                        <span> · cada um com uma história</span>
                      </p>
                      <div>
                        <label className="sort-label">
                          Ordenar por:{' '}
                          <select
                            value={sort}
                            onChange={(e) => setSort(e.target.value)}
                            aria-label="Ordenar desejos"
                          >
                            <option value="recent">Mais recentes</option>
                            <option value="low">Menor preço</option>
                            <option value="high">Maior preço</option>
                            <option value="priority">Prioridade</option>
                          </select>
                          <ChevronDown size={12} />
                        </label>
                        <div className="view-switch">
                          <button
                            className={layout === 'grid' ? 'selected' : ''}
                            onClick={() => setLayout('grid')}
                            aria-label="Visualizar em grade"
                            aria-pressed={layout === 'grid'}
                          >
                            <LayoutGrid size={16} />
                          </button>
                          <button
                            className={layout === 'list' ? 'selected' : ''}
                            onClick={() => setLayout('list')}
                            aria-label="Visualizar em lista"
                            aria-pressed={layout === 'list'}
                          >
                            <List size={17} />
                          </button>
                        </div>
                      </div>
                    </div>
                    {loading ? (
                      <div className="loading-state">
                        <Loader2 size={25} className="spin" />
                        <p>Preparando seu cantinho…</p>
                      </div>
                    ) : filtered.length ? (
                      <div className={'product-grid ' + (layout === 'list' ? 'list-layout' : '')}>
                        {filtered.map((item) => (
                          <article
                            className={'product-card ' + (item.purchased ? 'purchased-card' : '')}
                            key={item.id}
                          >
                            <div className="product-image">
                              <button
                                className="image-open"
                                onClick={() => setModal({ type: 'detail', item })}
                                aria-label={'Ver ' + item.name}
                              >
                                <ProductImage item={item} />
                              </button>
                              <span
                                className={
                                  'priority-badge ' +
                                  (item.priority === 'Quero muito'
                                    ? 'priority-high'
                                    : item.priority === 'Um dia'
                                      ? 'priority-low'
                                      : '')
                                }
                              >
                                <Heart
                                  size={11}
                                  fill={item.priority === 'Quero muito' ? 'currentColor' : 'none'}
                                />
                                {item.priority}
                              </span>
                              {own && (
                                <button
                                  className={
                                    'favorite-button ' +
                                    (item.priority === 'Quero muito' ? 'favorited' : '')
                                  }
                                  aria-label={
                                    item.priority === 'Quero muito'
                                      ? 'Diminuir prioridade'
                                      : 'Marcar como quero muito'
                                  }
                                  onClick={() =>
                                    changeItem(item, 'PATCH', {
                                      priority:
                                        item.priority === 'Quero muito' ? 'Quero' : 'Quero muito',
                                    }).catch((e) => notify(e.message))
                                  }
                                >
                                  <Heart
                                    size={17}
                                    fill={item.priority === 'Quero muito' ? 'currentColor' : 'none'}
                                  />
                                </button>
                              )}
                              {item.purchased && (
                                <span className="purchased-badge">
                                  <Check size={13} />
                                  Conquistado
                                </span>
                              )}
                            </div>
                            <div className="product-info">
                              <div className="product-meta">
                                <span>{item.category}</span>
                                <span>·</span>
                                <span>{domain(item.url)}</span>
                              </div>
                              <button
                                className="product-name"
                                onClick={() => setModal({ type: 'detail', item })}
                              >
                                {item.name}
                              </button>
                              <div className="product-price-row">
                                <strong>{money(item.price)}</strong>
                                <span>preço salvo</span>
                              </div>
                              <p className="target-price">
                                {item.targetPrice != null ? (
                                  <>
                                    <span className="target-dot" />
                                    Quero pagar até <strong>{money(item.targetPrice)}</strong>
                                  </>
                                ) : (
                                  <>
                                    <span className="target-dot neutral" />
                                    Um desejo esperando o momento certo
                                  </>
                                )}
                              </p>
                              <div className="product-footer">
                                {shared && !own ? (
                                  <button
                                    className={
                                      'button reserve-button ' +
                                      (item.reservation === 'mine' ? 'mine' : '')
                                    }
                                    disabled={busy || item.reservation === 'reserved'}
                                    onClick={() => reserve(item)}
                                  >
                                    <Gift size={15} />
                                    {item.reservation === 'mine'
                                      ? 'Reservado por você'
                                      : item.reservation === 'reserved'
                                        ? 'Presente já reservado'
                                        : 'Vou presentear'}
                                  </button>
                                ) : (
                                  <button
                                    className="find-offer"
                                    onClick={() => setModal({ type: 'detail', item })}
                                  >
                                    <Tag size={15} />
                                    Encontrar ofertas <ArrowUpRight size={15} />
                                  </button>
                                )}
                                <a
                                  className="icon-button"
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={'Abrir loja: ' + item.name}
                                >
                                  <ExternalLink size={16} />
                                </a>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <Empty
                        icon={view === 'purchased' ? <CheckCheck size={40} /> : <Heart size={40} />}
                        title={
                          search || category !== 'Todas' || tab === 'priority'
                            ? 'Nenhum desejo por aqui.'
                            : view === 'purchased'
                              ? 'Os sonhos realizados vão morar aqui.'
                              : 'Qual é o seu próximo desejo?'
                        }
                        text={
                          search || category !== 'Todas' || tab === 'priority'
                            ? 'Tente outra busca ou ajuste os filtros para encontrar seu desejo.'
                            : 'Pode ser aquele livro, uma viagem ou algo que você viu e amou. Guarde para não esquecer.'
                        }
                        action={
                          own &&
                          !search &&
                          category === 'Todas' &&
                          tab === 'all' &&
                          view !== 'purchased' ? (
                            <button
                              className="button primary"
                              onClick={() =>
                                currentList
                                  ? setModal({ type: 'item' })
                                  : setModal({ type: 'list' })
                              }
                            >
                              <Plus size={16} />
                              Adicionar meu primeiro desejo
                            </button>
                          ) : undefined
                        }
                      />
                    )}
                  </section>
                  <div className="bottom-note">
                    <Heart size={14} />
                    <p>Não é sobre ter tudo. É sobre saber o que faz você sorrir.</p>
                    <span>quero.</span>
                  </div>
                </>
              )}
            </>
          )}
        </main>
        <footer className="page-footer">
          <span>
            quero. <span>Desejos que aproximam.</span>
          </span>
          <span>
            Feito com um pouquinho de carinho <Heart size={11} />
          </span>
        </footer>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CircleCheck size={18} />
          {toast}
          <button
            className="icon-button small"
            aria-label="Fechar aviso"
            onClick={() => setToast('')}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {modal && (
        <Modal
          key={modal.type + ':' + (modal.item?.id || modal.list?.id || '')}
          title={
            modal.type === 'auth'
              ? 'Seu cantinho começa aqui.'
              : modal.type === 'reset'
                ? 'Uma nova senha.'
                : modal.type === 'item'
                  ? modal.item
                    ? 'Editar desejo'
                    : 'Um novo desejo.'
                  : modal.type === 'detail'
                    ? 'Um desejo, muitos caminhos.'
                    : modal.type === 'share'
                      ? 'Compartilhe um pouquinho de você.'
                      : modal.type === 'list'
                        ? modal.list
                          ? 'Editar lista'
                          : 'Uma nova coleção de desejos.'
                        : modal.type === 'security'
                          ? 'Segurança da sua conta.'
                          : modal.type === 'profile'
                            ? 'Sua conta.'
                            : modal.type === 'friend'
                              ? 'Mais perto de quem você ama.'
                              : modal.title || 'Tem certeza?'
          }
          onClose={() => setModal(null)}
          wide={modal.type === 'detail' || modal.type === 'item'}
        >
          {modal.type === 'auth' && (
            <AuthForm
              recoveryEnabled={state.recoveryEnabled}
              onSuccess={async () => {
                setModal(null);
                await refresh();
                notify('Que bom ter você por aqui!');
              }}
            />
          )}
          {modal.type === 'reset' && (
            <ResetForm
              token={resetToken}
              onSuccess={() => {
                history.replaceState({}, '', '/');
                setModal({ type: 'auth' });
                notify('Senha atualizada. Entre na sua conta.');
              }}
            />
          )}
          {modal.type === 'item' && (
            <ItemForm
              item={modal.item}
              lists={lists}
              listId={currentList?.id}
              onSave={async (data) => {
                if (demo) {
                  setExamples((prev) =>
                    modal.item
                      ? prev.map((i) => (i.id === modal.item!.id ? { ...i, ...data } : i))
                      : [
                          {
                            ...data,
                            id: crypto.randomUUID(),
                            purchased: false,
                            createdAt: Date.now(),
                          },
                          ...prev,
                        ],
                  );
                  notify(
                    'Desejo adicionado à demonstração. Crie uma conta para salvar de verdade.',
                  );
                } else {
                  await api(
                    'items' + (modal.item ? '/' + modal.item.id : ''),
                    modal.item ? 'PATCH' : 'POST',
                    data,
                  );
                  await refresh();
                  notify(modal.item ? 'Desejo atualizado.' : 'Mais um sonho guardado com carinho!');
                }
                setModal(null);
              }}
            />
          )}
          {modal.type === 'detail' && modal.item && (
            <ItemDetail
              item={modal.item}
              demo={demo}
              own={own}
              shared={!!shared}
              onEdit={() => setModal({ type: 'item', item: modal.item })}
              onDelete={() =>
                setModal({
                  type: 'confirm',
                  title: 'Remover este desejo?',
                  message: 'Este produto será removido da sua wishlist.',
                  action: async () => {
                    await changeItem(modal.item!, 'DELETE');
                    notify('Desejo removido.');
                  },
                })
              }
              onPurchased={async () => {
                await changeItem(modal.item!, 'PATCH', {
                  purchased: !modal.item!.purchased,
                });
                setModal(null);
                notify(
                  modal.item!.purchased ? 'De volta aos seus desejos.' : 'Mais um sonho realizado!',
                );
              }}
              onReserve={() => reserve(modal.item!)}
              notify={notify}
            />
          )}
          {modal.type === 'share' && currentList && (
            <ShareForm
              list={currentList}
              url={sharedUrl}
              onChange={async (data) => {
                const result = await api('lists/' + currentList.id + '/share', 'POST', data);
                await refresh();
                return result.shareToken ? `${location.origin}/?lista=${result.shareToken}` : '';
              }}
              copy={copy}
            />
          )}
          {modal.type === 'list' && (
            <ListForm
              list={modal.list}
              onSave={async (data) => {
                const result = await api(
                  'lists' + (modal.list ? '/' + modal.list.id : ''),
                  modal.list ? 'PATCH' : 'POST',
                  data,
                );
                await refresh();
                if (result.id) setActiveList(result.id);
                setModal(null);
                notify('Lista guardada com carinho.');
              }}
              onDelete={
                modal.list
                  ? () =>
                      setModal({
                        type: 'confirm',
                        title: 'Excluir esta lista?',
                        message:
                          'Todos os desejos desta lista serão removidos e o link compartilhado deixará de funcionar.',
                        action: async () => {
                          await api('lists/' + modal.list!.id, 'DELETE');
                          await refresh();
                          setActiveList('');
                          notify('Lista excluída.');
                        },
                      })
                  : undefined
              }
            />
          )}
          {modal.type === 'profile' && state.user && (
            <ProfileForm
              onSecurity={() => setModal({ type: 'security' })}
              onExport={async () => {
                const data = await api<AppState>('state');
                const url = URL.createObjectURL(
                  new Blob(
                    [JSON.stringify({ exportedAt: new Date().toISOString(), ...data }, null, 2)],
                    { type: 'application/json' },
                  ),
                );
                const link = document.createElement('a');
                link.href = url;
                link.download = 'quero-meus-dados.json';
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
              user={state.user}
              onSave={async (name) => {
                await api('profile', 'PATCH', { name });
                await refresh();
                setModal(null);
                notify('Seu nome foi atualizado.');
              }}
              onLogout={async () => {
                await api('auth/logout', 'POST', {});
                setModal(null);
                setActiveList('');
                await refresh();
                notify('Até logo! Seus desejos estão guardados.');
              }}
            />
          )}
          {modal.type === 'friend' && (
            <FriendForm
              onSave={async (token) => {
                await api('friends', 'POST', { shareToken: token });
                await refresh();
                setModal(null);
                notify('Lista adicionada às pessoas queridas.');
              }}
            />
          )}
          {modal.type === 'confirm' && (
            <Confirm
              message={modal.message || ''}
              onConfirm={async () => {
                await modal.action?.();
                setModal(null);
              }}
              onCancel={() => setModal(null)}
            />
          )}
          {modal.type === 'security' && (
            <SecurityForm
              onChanged={async (deleted) => {
                if (deleted) {
                  selectView('wishlist');
                  await reload();
                }
                setModal(null);
                notify(
                  deleted
                    ? 'Sua conta e seus dados foram excluídos.'
                    : 'Senha atualizada. Outras sessões foram encerradas.',
                );
              }}
            />
          )}
        </Modal>
      )}
    </div>
  );
}

function Empty({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
function ErrorMessage({ error }: { error: string }) {
  return error ? (
    <p className="form-error" role="alert">
      {error}
    </p>
  ) : null;
}
function Submit({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <button type="submit" className="button primary full-width" disabled={busy}>
      {busy ? <Loader2 size={17} className="spin" /> : children}
    </button>
  );
}
function AuthForm({
  onSuccess,
  recoveryEnabled,
}: {
  onSuccess: () => Promise<void>;
  recoveryEnabled: boolean;
}) {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('signup'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [show, setShow] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const result = await api(
        'auth/' + (mode === 'forgot' ? 'reset-request' : mode),
        'POST',
        data,
      );
      if (mode === 'forgot') setMessage(result.message || 'Confira seu e-mail.');
      else await onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <p className="modal-description">
        Seus desejos guardados. As pessoas que você ama, por perto.
      </p>
      <div className="auth-tabs">
        <button
          className={mode === 'signup' ? 'selected' : ''}
          onClick={() => {
            setMode('signup');
            setError('');
          }}
        >
          Criar conta
        </button>
        <button
          className={mode === 'login' ? 'selected' : ''}
          onClick={() => {
            setMode('login');
            setError('');
          }}
        >
          Já tenho conta
        </button>
      </div>
      <form onSubmit={submit} className="form">
        {mode === 'signup' && (
          <label>
            Como podemos te chamar?
            <input
              name="name"
              autoComplete="given-name"
              placeholder="Seu nome"
              maxLength={60}
              required
            />
          </label>
        )}
        <label>
          Seu e-mail
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            maxLength={254}
            required
          />
        </label>
        {mode !== 'forgot' && (
          <label>
            Senha
            <div className="password-input">
              <input
                name="password"
                aria-label="Senha"
                type={show ? 'text' : 'password'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                placeholder={mode === 'signup' ? 'Pelo menos 12 caracteres' : 'Sua senha'}
                minLength={mode === 'signup' ? 12 : 1}
                maxLength={128}
                required
              />
              <button
                type="button"
                className="icon-button"
                aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
                onClick={() => setShow(!show)}
              >
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            {mode === 'signup' && (
              <small>
                Uma frase com algumas palavras é fácil de lembrar e difícil de adivinhar.
              </small>
            )}
          </label>
        )}
        <ErrorMessage error={error} />
        {message && (
          <p className="form-success" role="status">
            {message}
          </p>
        )}
        <Submit busy={busy}>
          {mode === 'signup' ? (
            <>
              Criar minha conta <ArrowRight size={17} />
            </>
          ) : mode === 'login' ? (
            'Entrar no meu cantinho'
          ) : (
            'Enviar link de recuperação'
          )}
        </Submit>
        {mode !== 'signup' && recoveryEnabled && (
          <button
            className="text-button"
            type="button"
            onClick={() => {
              setMode(mode === 'forgot' ? 'login' : 'forgot');
              setError('');
              setMessage('');
            }}
          >
            {mode === 'forgot' ? 'Voltar para entrar' : 'Esqueci minha senha'}
          </button>
        )}
        {mode === 'login' && !recoveryEnabled && (
          <p className="privacy-note">
            A recuperação por e-mail ainda não está disponível. Se perdeu o acesso, fale com o
            responsável pelo projeto.
          </p>
        )}
        <p className="privacy-note">
          <LockKeyhole size={13} /> Suas listas começam privadas. Você escolhe o que compartilhar.
        </p>
      </form>
    </>
  );
}
function ResetForm({ onSuccess, token }: { onSuccess: () => void; token: string }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          await api('auth/reset', 'POST', {
            password: new FormData(e.currentTarget).get('password'),
            token,
          });
          onSuccess();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="modal-description">Escolha uma senha com pelo menos 12 caracteres.</p>
      <label>
        Nova senha
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
        />
      </label>
      <ErrorMessage error={error} />
      <Submit busy={busy}>Salvar nova senha</Submit>
    </form>
  );
}
function ItemForm({
  item,
  lists,
  listId,
  onSave,
}: {
  item?: WishItem;
  lists: WishList[];
  listId?: string;
  onSave: (data: Omit<WishItem, 'id' | 'purchased' | 'createdAt'>) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const f = new FormData(e.currentTarget),
      value = (k: string) => String(f.get(k) || '');
    try {
      await onSave({
        wishlistId: item?.wishlistId || value('wishlistId'),
        name: value('name'),
        url: value('url'),
        price: Math.round(Number(value('price')) * 100),
        targetPrice: value('targetPrice') ? Math.round(Number(value('targetPrice')) * 100) : null,
        image: value('image'),
        category: value('category'),
        priority: value('priority'),
        notes: value('notes'),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="form" onSubmit={submit}>
      <p className="modal-description">
        Viu, amou, guardou. Os detalhes ajudam na hora de presentear.
      </p>
      <div className="form-grid">
        <label className="span-two">
          Nome do produto
          <input
            name="name"
            defaultValue={item?.name}
            placeholder="O que fez seus olhos brilharem?"
            maxLength={160}
            required
          />
        </label>
        <label className="span-two">
          Link da loja
          <div className="input-with-icon">
            <Link2 size={16} />
            <input
              name="url"
              type="url"
              pattern="https://.*"
              defaultValue={item?.url}
              placeholder="https://loja.com.br/seu-produto"
              maxLength={2048}
              required
            />
          </div>
        </label>
        <label>
          Preço atual (R$)
          <input
            name="price"
            type="number"
            min="0"
            max="10000000"
            step="0.01"
            defaultValue={item ? item.price / 100 : undefined}
            placeholder="0,00"
            required
          />
        </label>
        <label>
          Quero pagar até (R$)
          <input
            name="targetPrice"
            type="number"
            min="0"
            max="10000000"
            step="0.01"
            defaultValue={item?.targetPrice != null ? item.targetPrice / 100 : undefined}
            placeholder="Opcional"
          />
        </label>
        <label>
          Categoria
          <select name="category" defaultValue={item?.category || 'Tecnologia'}>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          O quanto você quer?
          <select name="priority" defaultValue={item?.priority || 'Quero'}>
            <option>Quero muito</option>
            <option>Quero</option>
            <option>Um dia</option>
          </select>
        </label>
        {!item && (
          <label className="span-two">
            Guardar em
            <select name="wishlistId" defaultValue={listId}>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.emoji} {l.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="span-two">
          Link da imagem <span className="optional">opcional</span>
          <input
            name="image"
            type="url"
            pattern="https://.*"
            defaultValue={item?.image.startsWith('https:') ? item.image : ''}
            placeholder="https://.../imagem.jpg"
            maxLength={2048}
          />
        </label>
        <label className="span-two">
          Uma dica para quem vai presentear <span className="optional">opcional</span>
          <textarea
            name="notes"
            rows={3}
            defaultValue={item?.notes}
            placeholder="Cor, tamanho, modelo... ou a história por trás desse desejo."
            maxLength={1000}
          />
        </label>
      </div>
      <ErrorMessage error={error} />
      <Submit busy={busy}>
        <Heart size={16} />
        {item ? 'Salvar alterações' : 'Guardar meu desejo'}
      </Submit>
    </form>
  );
}
function ItemDetail({
  item,
  demo,
  own,
  shared,
  onEdit,
  onDelete,
  onPurchased,
  onReserve,
  notify,
}: {
  item: WishItem;
  demo: boolean;
  own: boolean;
  shared: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onPurchased: () => Promise<void>;
  onReserve: () => void;
  notify: (s: string) => void;
}) {
  const [data, setData] = useState<OffersData | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const findOffers = async () => {
    setBusy(true);
    setError('');
    try {
      setData(await api<OffersData>('items/' + item.id + '/offers'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="detail">
      <div className="detail-top">
        <div className="detail-image">
          <ProductImage item={item} />
        </div>
        <div>
          <span className="detail-category">
            {item.category} · {item.priority}
          </span>
          <h3>{item.name}</h3>
          <strong className="detail-price">{money(item.price)}</strong>
          <small>Preço que você salvou{demo ? ' · exemplo' : ''}</small>
          {item.targetPrice != null && (
            <p className="detail-target">
              <Tag size={14} />
              Preço desejado: {money(item.targetPrice)}
            </p>
          )}
          <a className="button primary" href={item.url} target="_blank" rel="noopener noreferrer">
            Ver na loja <ArrowUpRight size={16} />
          </a>
        </div>
      </div>
      {item.notes && (
        <div className="detail-notes">
          <Heart size={15} />
          <p>{item.notes}</p>
        </div>
      )}
      <div className="detail-section">
        <div className="detail-section-heading">
          <h4>
            <Sparkles size={17} />
            Um bom preço faz a diferença.
          </h4>
          {data?.checkedAt && (
            <small>Consultado {new Date(data.checkedAt).toLocaleString('pt-BR')}</small>
          )}
        </div>
        {!shared && !demo && (
          <button className="button secondary" disabled={busy} onClick={findOffers}>
            <Search size={15} />
            {data ? 'Consultar novamente' : 'Consultar ofertas nas lojas'}
          </button>
        )}
        {busy ? (
          <div className="loading-state compact">
            <Loader2 className="spin" size={20} />
            Procurando oportunidades…
          </div>
        ) : error ? (
          <>
            <ErrorMessage error={error} />
            <p className="modal-description">Você ainda pode comparar pelos atalhos abaixo.</p>
          </>
        ) : data?.enabled ? (
          <>
            {data.offers.length ? (
              <div className="offer-results">
                {data.offers.map((o, i) => (
                  <a
                    key={i}
                    className="offer-row"
                    href={o.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <div>
                      <strong>{o.store}</strong>
                      <span>{o.title}</span>
                      {o.coupon && <span className="coupon-code">Cupom: {o.coupon}</span>}
                    </div>
                    <div>
                      <strong>{money(o.price)}</strong>
                      {o.oldPrice != null && o.oldPrice > o.price && <del>{money(o.oldPrice)}</del>}
                    </div>
                    <ArrowUpRight size={17} />
                  </a>
                ))}
              </div>
            ) : (
              <p className="modal-description">
                Nenhuma oferta encontrada agora. Tente comparar nas lojas abaixo.
              </p>
            )}
            <p className="offer-disclaimer">
              Confira modelo, variação, frete e condições na loja. Resultados de busca podem incluir
              produtos semelhantes. Cupons só aparecem quando informados pelo provedor.
            </p>
          </>
        ) : (
          <p className="modal-description">
            {shared
              ? 'Compare as opções e encontre o presente ideal.'
              : 'Use os atalhos para comparar preços e procurar cupons. Consulte as ofertas disponíveis ou use os atalhos abaixo.'}
          </p>
        )}
        <div className="search-links">
          {(data?.links || searchLinks(item.name)).map((l) => (
            <a key={l.name} href={l.url} target="_blank" rel="noopener noreferrer">
              {l.name}
              <ArrowUpRight size={14} />
            </a>
          ))}
        </div>
      </div>
      {own ? (
        <div className="detail-actions">
          <button className="button secondary" onClick={onEdit}>
            <Pencil size={15} />
            Editar
          </button>
          <button
            className="button secondary"
            onClick={() => onPurchased().catch((e) => notify(e.message))}
          >
            <Check size={16} />
            {item.purchased ? 'Voltar à wishlist' : 'Já conquistei'}
          </button>
          <button className="icon-button danger" aria-label="Excluir desejo" onClick={onDelete}>
            <Trash2 size={17} />
          </button>
        </div>
      ) : (
        <button
          className="button primary full-width"
          disabled={item.reservation === 'reserved'}
          onClick={onReserve}
        >
          <Gift size={17} />
          {item.reservation === 'mine'
            ? 'Cancelar minha reserva'
            : item.reservation === 'reserved'
              ? 'Presente já reservado'
              : 'Vou presentear'}
        </button>
      )}
    </div>
  );
}
function ShareForm({
  list,
  url,
  onChange,
  copy,
}: {
  list: WishList;
  url: string;
  onChange: (data: Record<string, unknown>) => Promise<string>;
  copy: (s: string) => void;
}) {
  const [link, setLink] = useState(url),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const change = async (data: Record<string, unknown>) => {
    setBusy(true);
    setError('');
    try {
      setLink(await onChange(data));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="form">
      <div className="share-illustration">
        <Share2 size={32} />
        <Heart size={18} />
      </div>
      <p className="modal-description center">
        Compartilhe <strong>{list.name}</strong> com quem faz parte da sua história. Quem tiver o
        link poderá ver seu nome, a descrição da lista e os desejos, incluindo notas, preços e
        links. Compartilhe apenas informações que deseja tornar visíveis a essas pessoas.
      </p>
      {link ? (
        <>
          <label>
            Seu link de carinho
            <div className="copy-input">
              <input
                value={link}
                readOnly
                aria-label="Link compartilhável"
                onFocus={(e) => e.target.select()}
              />
              <button className="icon-button" aria-label="Copiar link" onClick={() => copy(link)}>
                <Copy size={18} />
              </button>
            </div>
          </label>
          <div className="share-buttons">
            <a
              className="button primary"
              href={
                'https://wa.me/?text=' +
                encodeURIComponent('Um pouquinho dos meus desejos ♡ ' + link)
              }
              target="_blank"
              rel="noopener noreferrer"
            >
              Enviar pelo WhatsApp <ArrowUpRight size={16} />
            </a>
            <button
              className="button secondary"
              onClick={async () => {
                if (navigator.share) {
                  try {
                    await navigator.share({
                      title: 'Minha wishlist — Quero',
                      url: link,
                    });
                  } catch {}
                } else copy(link);
              }}
            >
              Outras opções <Share2 size={15} />
            </button>
          </div>
          <p className="privacy-note">
            <Gift size={15} />
            Quem entrar na conta pode reservar um presente. Você não verá as reservas da sua lista.
          </p>
          <p className="privacy-note">
            Trocar ou desativar o link também remove os atalhos salvos por outras pessoas. Envie o
            novo link para compartilhar novamente.
          </p>
          <div className="share-manage">
            <button
              className="text-button subtle"
              disabled={busy}
              onClick={() => change({ enabled: true, rotate: true })}
            >
              <RefreshCw size={13} />
              Trocar link
            </button>
            <button
              className="text-button danger"
              disabled={busy}
              onClick={() => change({ enabled: false })}
            >
              Desativar compartilhamento
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="privacy-note">
            <LockKeyhole size={14} />
            Esta lista está privada. Ative o link para compartilhar.
          </p>
          <button
            className="button primary full-width"
            disabled={busy}
            onClick={() => change({ enabled: true })}
          >
            {busy ? (
              <Loader2 size={17} className="spin" />
            ) : (
              <>
                <Link2 size={16} />
                Criar link compartilhável
              </>
            )}
          </button>
        </>
      )}
      <ErrorMessage error={error} />
    </div>
  );
}
function ListForm({
  list,
  onSave,
  onDelete,
}: {
  list?: WishList;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onDelete?: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          await onSave(Object.fromEntries(new FormData(e.currentTarget)));
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="modal-description">
        Para a casa, a próxima viagem ou só porque sim. Cada sonho pode ter seu lugar.
      </p>
      <label>
        Nome da lista
        <input
          name="name"
          defaultValue={list?.name}
          placeholder="Ex.: Nosso novo lar"
          maxLength={80}
          required
        />
      </label>
      <label>
        Um símbolo para ela
        <select name="emoji" defaultValue={list?.emoji || '♡'}>
          <option>♡</option>
          <option>✦</option>
          <option>☀</option>
          <option>✈</option>
          <option>⌂</option>
          <option>☕</option>
        </select>
      </label>
      <label>
        Uma pequena descrição
        <textarea
          name="description"
          defaultValue={list?.description}
          placeholder="O que você está sonhando por aqui?"
          maxLength={300}
          rows={3}
        />
      </label>
      <ErrorMessage error={error} />
      <Submit busy={busy}>{list ? 'Salvar lista' : 'Criar minha lista'}</Submit>
      {onDelete && (
        <button type="button" className="text-button danger" onClick={onDelete}>
          <Trash2 size={14} />
          Excluir lista e seus desejos
        </button>
      )}
    </form>
  );
}
function ProfileForm({
  user,
  onSave,
  onLogout,
  onSecurity,
  onExport,
}: {
  onSecurity: () => void;
  onExport: () => Promise<void>;
  user: NonNullable<AppState['user']>;
  onSave: (name: string) => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          await onSave(String(new FormData(e.currentTarget).get('name')));
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="profile-head">
        <span className="friend-avatar">{user.name.slice(0, 1).toUpperCase()}</span>
        <div>
          <strong>Um cantinho só seu.</strong>
          <p>{user.email}</p>
        </div>
      </div>
      <label>
        Seu nome
        <input name="name" defaultValue={user.name} maxLength={60} required />
      </label>
      <ErrorMessage error={error} />
      <Submit busy={busy}>Salvar alterações</Submit>
      <button
        type="button"
        className="button secondary full-width"
        disabled={busy}
        onClick={onSecurity}
      >
        Alterar senha ou excluir conta
      </button>
      <button
        type="button"
        className="button secondary full-width"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          onExport()
            .catch((e) => setError(e.message))
            .finally(() => setBusy(false));
        }}
      >
        Baixar meus dados
      </button>
      <button
        type="button"
        className="button secondary full-width"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onLogout();
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        <LogOut size={16} />
        Sair da minha conta
      </button>
    </form>
  );
}
function FriendForm({ onSave }: { onSave: (token: string) => Promise<void> }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        const raw = String(new FormData(e.currentTarget).get('url') || '');
        try {
          const u = new URL(raw),
            token = u.searchParams.get('lista');
          if (!token || u.origin !== location.origin)
            throw new Error('Cole um link de wishlist válido do Quero.');
          await onSave(token);
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="modal-description">
        Peça o link da wishlist de alguém especial e cole aqui. As ideias de presente ficam sempre à
        mão.
      </p>
      <label>
        Link da wishlist
        <input name="url" type="url" placeholder="https://.../?lista=..." required />
      </label>
      <ErrorMessage error={error} />
      <Submit busy={busy}>
        <Users size={16} />
        Adicionar às pessoas queridas
      </Submit>
    </form>
  );
}
function Confirm({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <div className="form">
      <p className="modal-description">{message}</p>
      <ErrorMessage error={error} />
      <button
        className="button destructive full-width"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onConfirm();
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        {busy ? <Loader2 className="spin" size={17} /> : 'Sim, remover'}
      </button>
      <button className="button secondary full-width" disabled={busy} onClick={onCancel}>
        Manter por aqui
      </button>
    </div>
  );
}
