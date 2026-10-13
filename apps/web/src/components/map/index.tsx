'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui';
import type { MapProps } from './types';

export type { MapPoint, MapProps } from './types';

/** Mapa interativo (Leaflet). Só carrega no browser e só nas páginas que o usam. */
const LeafletMap = dynamic(() => import('./leaflet-map'), {
  ssr: false,
  loading: () => <Skeleton className="h-full min-h-60 w-full rounded-2xl" />,
});

export function MapView(props: MapProps) {
  return (
    <div style={{ height: props.height ?? 360 }}>
      <LeafletMap {...props} />
    </div>
  );
}
