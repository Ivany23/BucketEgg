export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  label: string;
  /** Número no marcador (ex.: ordem da paragem). */
  number?: number;
  /** Cor do marcador: hex ou variável CSS (ex.: var(--ok)); as variáveis são resolvidas para o SVG. */
  color?: string;
}

export interface MapProps {
  points: MapPoint[];
  /** Ponto de partida (armazém), desenhado como casa. */
  start?: { lat: number; lng: number } | null;
  /** Rótulo do ponto de partida (por omissão "Partida"; ex.: "Você está aqui"). */
  startLabel?: string;
  /** Liga os pontos pela ordem (e regressa à partida). */
  path?: boolean;
  height?: number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Pontos simples em vez de marcadores numerados (muitas lojas). */
  circles?: boolean;
}
