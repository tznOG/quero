export type WishItem = {
  id: string;
  wishlistId: string;
  name: string;
  url: string;
  price: number;
  targetPrice: number | null;
  image: string;
  category: string;
  priority: string;
  notes: string;
  purchased: boolean;
  createdAt: number;
  reservation?: 'mine' | 'reserved' | null;
};
export type WishList = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  shareToken: string | null;
  createdAt: number;
  owner?: string;
};
export type AppState = {
  user: { id: string; name: string; email: string } | null;
  lists: WishList[];
  items: WishItem[];
  friends: {
    id: string;
    name: string;
    shareToken: string;
    owner: string;
    count: number;
  }[];
  offersEnabled: boolean;
  recoveryEnabled: boolean;
};
export const categories = [
  'Tecnologia',
  'Moda',
  'Casa',
  'Beleza',
  'Livros',
  'Experiências',
  'Outros',
];
export const money = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
export const demoList: WishList = {
  id: 'demo',
  name: 'Minha wishlist',
  description: 'Pequenos e grandes desejos.',
  emoji: '♡',
  shareToken: null,
  createdAt: 0,
};
export const demoItems: WishItem[] = [
  {
    id: 'd1',
    name: 'Fone sem fio para me desconectar',
    price: 129900,
    category: 'Tecnologia',
    priority: 'Quero muito',
    image: '/images/headphones.jpg',
    url: 'https://www.amazon.com.br/s?k=fone+bluetooth',
    notes: 'De preferência com cancelamento de ruído. Para ouvir minhas músicas favoritas.',
    targetPrice: 100000,
  },
  {
    id: 'd2',
    name: 'Tênis para ir a qualquer lugar',
    price: 54990,
    category: 'Moda',
    priority: 'Quero',
    image: '/images/sneakers.jpg',
    url: 'https://www.nike.com.br',
    notes: 'Tamanho 38. Amo um tênis confortável!',
    targetPrice: 45000,
  },
  {
    id: 'd3',
    name: 'Uma câmera para guardar momentos',
    price: 289900,
    category: 'Tecnologia',
    priority: 'Um dia',
    image: '/images/camera.jpg',
    url: 'https://www.amazon.com.br/s?k=camera+fotografica',
    notes: 'Para transformar nossas viagens em memórias.',
    targetPrice: null,
  },
  {
    id: 'd4',
    name: 'Relógio para todos os dias',
    price: 38900,
    category: 'Moda',
    priority: 'Quero',
    image: '/images/watch.jpg',
    url: 'https://www.amazon.com.br/s?k=relogio+minimalista',
    notes: 'Gosto de modelos minimalistas, com pulseira clara.',
    targetPrice: 30000,
  },
  {
    id: 'd5',
    name: 'Mais um capítulo na estante',
    price: 6990,
    category: 'Livros',
    priority: 'Quero muito',
    image: '/images/books.jpg',
    url: 'https://www.amazon.com.br/s?k=livros',
    notes: 'Sempre cabe mais uma boa história.',
    targetPrice: null,
  },
  {
    id: 'd6',
    name: 'Garrafa para levar a vida mais leve',
    price: 14990,
    category: 'Casa',
    priority: 'Quero',
    image: '/images/bottle.jpg',
    url: 'https://www.amazon.com.br/s?k=garrafa+termica',
    notes: 'Uma garrafa de 750 ml para me acompanhar.',
    targetPrice: 12000,
  },
].map((p, i) => ({
  ...p,
  id: p.id,
  wishlistId: 'demo',
  purchased: false,
  createdAt: 1700000000000 - i * 86400000,
}));
