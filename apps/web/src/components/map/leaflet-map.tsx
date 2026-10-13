'use client';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import type { MapPoint, MapProps } from './types';

/** Tema efetivo (data-theme ou sistema), para escolher o mapa base claro/escuro. */
function subscribeTheme(cb: () => void) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  mq.addEventListener('change', cb);
  return () => {
    obs.disconnect();
    mq.removeEventListener('change', cb);
  };
}
const isDarkNow = () => {
  const t = document.documentElement.dataset.theme;
  return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
};

/** Os atributos SVG do Leaflet não resolvem var(--x): converte para a cor calculada. */
function resolveColor(color: string | undefined, fallback: string): string {
  if (!color) return fallback;
  const m = /^var\((--[\w-]+)\)$/.exec(color.trim());
  if (!m) return color;
  const v = getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim();
  return v || fallback;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function numberedIcon(p: MapPoint, selected: boolean) {
  const color = p.color ?? 'var(--brand)';
  const size = selected ? 38 : 30;
  const label = p.number !== undefined ? String(p.number) : '';
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    html: `<div style="width:${size}px;height:${size}px;transform:translateY(-2px);display:flex;align-items:center;justify-content:center;border-radius:50% 50% 50% 4px;rotate:-45deg;background:${color};border:2.5px solid var(--surface);box-shadow:0 6px 14px -4px rgba(0,0,0,.45)"><span style="rotate:45deg;font:800 ${selected ? 14 : 12}px var(--font-sans);color:#1a1208">${escapeHtml(label)}</span></div>`,
  });
}

const startIcon = L.divIcon({
  className: '',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  html: `<div style="width:34px;height:34px;border-radius:12px;background:#1f0e03;display:flex;align-items:center;justify-content:center;border:2.5px solid #fb923c;box-shadow:0 6px 14px -4px rgba(0,0,0,.5)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fb923c" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V9l9-6 9 6v12"/><path d="M9 21v-6h6v6"/></svg></div>`,
});

function FitBounds({ points, start }: { points: MapPoint[]; start?: { lat: number; lng: number } | null }) {
  const map = useMap();
  const key = useMemo(() => [...points.map((p) => `${p.lat},${p.lng}`), start ? `${start.lat},${start.lng}` : ''].join('|'), [points, start]);
  useEffect(() => {
    const coords: [number, number][] = points.map((p) => [p.lat, p.lng]);
    if (start) coords.push([start.lat, start.lng]);
    if (!coords.length) return;
    if (coords.length === 1) map.setView(coords[0], 15, { animate: true });
    else map.fitBounds(L.latLngBounds(coords), { padding: [36, 36], maxZoom: 16, animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recentrar só quando os pontos mudam (key)
  }, [map, key]);
  return null;
}

export default function LeafletMap({ points, start, startLabel = 'Partida', path = false, height = 360, selectedId, onSelect, circles = false }: MapProps) {
  const dark = useSyncExternalStore(subscribeTheme, isDarkNow, () => false);
  const center: [number, number] = points[0] ? [points[0].lat, points[0].lng] : start ? [start.lat, start.lng] : [-25.9692, 32.5732];
  const line: [number, number][] = [
    ...(start ? [[start.lat, start.lng] as [number, number]] : []),
    ...points.map((p) => [p.lat, p.lng] as [number, number]),
    ...(start && path ? [[start.lat, start.lng] as [number, number]] : []),
  ];
  // Mosaicos: OpenStreetMap oficial por omissão (uso interativo, com atribuição — política da OSMF).
  // Em produção com muito tráfego, defina NEXT_PUBLIC_MAP_TILES (ex.: MapTiler/Stadia com chave).
  const tiles = process.env.NEXT_PUBLIC_MAP_TILES || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const attribution =
    process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  return (
    <div className="be-map overflow-hidden rounded-2xl border border-line" data-dark={dark || undefined} style={{ height }}>
      <MapContainer center={center} zoom={13} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }} attributionControl>
        <TileLayer url={tiles} attribution={attribution} maxZoom={19} />
        <FitBounds points={points} start={start} />
        {path && line.length > 1 ? (
          <Polyline positions={line} pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.8, dashArray: '2 10', lineCap: 'round' }} />
        ) : null}
        {start ? (
          <Marker position={[start.lat, start.lng]} icon={startIcon}>
            <Tooltip direction="top" offset={[0, -14]}>
              {startLabel}
            </Tooltip>
          </Marker>
        ) : null}
        {points.map((p) =>
          circles ? (
            <CircleMarker
              key={p.id}
              center={[p.lat, p.lng]}
              radius={selectedId === p.id ? 10 : 7}
              pathOptions={{ color: dark ? '#1a1410' : '#ffffff', weight: 2, fillColor: resolveColor(p.color, '#f97316'), fillOpacity: 0.95 }}
              eventHandlers={onSelect ? { click: () => onSelect(p.id) } : undefined}
            >
              <Tooltip direction="top">{p.label}</Tooltip>
            </CircleMarker>
          ) : (
            <Marker
              key={p.id}
              position={[p.lat, p.lng]}
              icon={numberedIcon(p, selectedId === p.id)}
              eventHandlers={onSelect ? { click: () => onSelect(p.id) } : undefined}
              keyboard
              title={p.label}
            >
              <Tooltip direction="top" offset={[0, -26]}>
                {p.label}
              </Tooltip>
            </Marker>
          ),
        )}
      </MapContainer>
    </div>
  );
}
