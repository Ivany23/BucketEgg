import { Beer, Coffee, Cookie, CupSoda, Citrus, Droplets, Milk, Package, Wine, Zap, type LucideIcon } from 'lucide-react';

/** Paleta das categorias: usa as cores dos módulos (cada uma tem versão de texto AA e fundo suave). */
const PALETTE = ['dia', 'produtos', 'import', 'beats', 'painel', 'lojas', 'rotas', 'vendas', 'visitas', 'equipa', 'dados'] as const;
type PaletteKey = (typeof PALETTE)[number];

const KNOWN: [RegExp, PaletteKey, LucideIcon][] = [
  [/cerve|beer/i, 'dia', Beer],
  [/refri|soda|gasos/i, 'produtos', CupSoda],
  [/água|agua|water/i, 'import', Droplets],
  [/energ/i, 'beats', Zap],
  [/sumo|juice|néctar|nectar/i, 'painel', Citrus],
  [/vinho|wine|espirit/i, 'vendas', Wine],
  [/leite|lact|iogur/i, 'rotas', Milk],
  [/bolach|biscoit|snack/i, 'lojas', Cookie],
  [/café|cafe|chá|cha\b/i, 'equipa', Coffee],
];

export interface CategoryStyle {
  /** Cor forte (ícones, barras). */
  color: string;
  /** Cor de texto com contraste AA. */
  text: string;
  /** Fundo suave. */
  soft: string;
  icon: LucideIcon;
}

const style = (k: PaletteKey, icon: LucideIcon): CategoryStyle => ({
  color: `var(--m-${k})`,
  text: `var(--m-${k}-text)`,
  soft: `var(--m-${k}-soft)`,
  icon,
});

/** Cor e ícone estáveis por categoria (a mesma categoria tem sempre a mesma cor). */
export function categoryStyle(category: string | null | undefined): CategoryStyle {
  const name = (category ?? '').trim();
  if (!name) return { color: 'var(--text-3)', text: 'var(--text-2)', soft: 'var(--surface-2)', icon: Package };
  const known = KNOWN.find(([re]) => re.test(name));
  if (known) return style(known[1], known[2]);
  let h = 0;
  for (const c of name.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return style(PALETTE[h % PALETTE.length], Package);
}
