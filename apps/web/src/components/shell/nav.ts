import type { LucideIcon } from 'lucide-react';
import {
  CalendarCheck,
  ClipboardList,
  FolderKanban,
  LayoutDashboard,
  MapPin,
  Package,
  Repeat,
  Route,
  Settings,
  ShoppingCart,
  Store,
  Upload,
  Users,
} from 'lucide-react';
import { DATA_ROLES, MANAGEMENT_ROLES, type Role } from '@/lib/types';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Módulo (cor) — ver [data-module] em globals.css */
  module: string;
  /** Papéis que veem o item (vazio = todos). */
  roles?: Role[];
  /** Descrição curta (menu "Mais" no telemóvel e dicas). */
  hint: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    title: 'Visão geral',
    items: [
      { href: '/painel', label: 'Painel', icon: LayoutDashboard, module: 'painel', hint: 'Indicadores, vendas e ranking da equipa' },
      { href: '/meu-dia', label: 'O meu dia', icon: CalendarCheck, module: 'dia', hint: 'Presença, paragens, visitas e encomendas' },
    ],
  },
  {
    title: 'Planeamento',
    items: [
      { href: '/rotas', label: 'Rotas', icon: Route, module: 'rotas', hint: 'Planear, otimizar e acompanhar rotas' },
      { href: '/beats', label: 'Beats', icon: Repeat, module: 'beats', hint: 'Circuitos semanais e rotas automáticas' },
    ],
  },
  {
    title: 'Terreno',
    items: [
      { href: '/lojas', label: 'Lojas', icon: Store, module: 'lojas', hint: 'Clientes, mapa, aprovações e extratos' },
      { href: '/visitas', label: 'Visitas', icon: MapPin, module: 'visitas', hint: 'Histórico de visitas e presenças' },
    ],
  },
  {
    title: 'Comercial',
    items: [
      { href: '/encomendas', label: 'Encomendas', icon: ShoppingCart, module: 'vendas', hint: 'Encomendas, estados e cobranças' },
      { href: '/produtos', label: 'Produtos', icon: Package, module: 'produtos', hint: 'Catálogo, preços e Must Sell' },
    ],
  },
  {
    title: 'Dados',
    items: [
      { href: '/formularios', label: 'Formulários', icon: ClipboardList, module: 'dados', hint: 'Auditorias, recolhas e correções' },
      { href: '/importacoes', label: 'Importações', icon: Upload, module: 'import', roles: DATA_ROLES, hint: 'Excel e CSV de grandes dimensões' },
    ],
  },
  {
    title: 'Organização',
    items: [
      { href: '/equipa', label: 'Equipa', icon: Users, module: 'equipa', roles: MANAGEMENT_ROLES, hint: 'Membros, papéis e supervisores' },
      { href: '/projetos', label: 'Projetos', icon: FolderKanban, module: 'painel', hint: 'Campanhas e projetos' },
      { href: '/definicoes', label: 'Definições', icon: Settings, module: 'config', hint: 'Organização, perfil e segurança' },
    ],
  },
];

export const visibleNav = (role: Role | null): NavSection[] =>
  NAV.map((s) => ({ ...s, items: s.items.filter((i) => !i.roles || (role !== null && i.roles.includes(role))) })).filter((s) => s.items.length);

/** Página inicial de cada papel. */
export const homeFor = (role: Role | null) => (role === 'FIELD_REP' ? '/meu-dia' : '/painel');

/** Atalhos da barra inferior (telemóvel). */
export const mobileTabs = (role: Role | null): string[] =>
  role === 'FIELD_REP' ? ['/meu-dia', '/rotas', '/lojas', '/encomendas'] : ['/painel', '/rotas', '/lojas', '/encomendas'];
