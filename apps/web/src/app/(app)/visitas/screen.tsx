'use client';

import { Clock3, MapPin } from 'lucide-react';
import { useState } from 'react';
import { RequireProject } from '@/components/domain';
import { PageHeader, Tabs } from '@/components/ui';
import { useSession } from '@/lib/session';
import { AttendanceTab } from './attendance-tab';
import { VisitsTab } from './visits-tab';

type Tab = 'visitas' | 'presencas';

export function VisitsScreen() {
  const { isFieldRep } = useSession();
  const [tab, setTab] = useState<Tab>('visitas');
  return (
    <>
      <PageHeader
        icon={MapPin}
        eyebrow="Terreno"
        title="Visitas"
        description={
          isFieldRep
            ? 'O seu histórico de visitas às lojas e as suas presenças.'
            : 'Histórico de visitas da equipa: geofence, produtividade, duração e presenças diárias.'
        }
      />
      <RequireProject>
        {(project) => (
          <div className="flex flex-col gap-5">
            <Tabs<Tab>
              className="self-start"
              value={tab}
              onChange={setTab}
              tabs={[
                { id: 'visitas', label: 'Visitas', icon: MapPin },
                { id: 'presencas', label: 'Presenças', icon: Clock3 },
              ]}
            />
            <div role="tabpanel" aria-label={tab === 'visitas' ? 'Visitas' : 'Presenças'}>
              {tab === 'visitas' ? <VisitsTab projectId={project.id} /> : <AttendanceTab projectId={project.id} />}
            </div>
          </div>
        )}
      </RequireProject>
    </>
  );
}
