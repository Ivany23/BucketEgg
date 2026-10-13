'use client';

import { AlarmClock, Hourglass, LocateFixed, Plus, Store } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { RequireProject } from '@/components/domain';
import { AllOutletsTab } from '@/components/outlets/all-tab';
import { ApprovalTab, usePendingOutlets } from '@/components/outlets/approval-tab';
import { NearbyTab } from '@/components/outlets/nearby-tab';
import { OutletDrawer } from '@/components/outlets/outlet-drawer';
import { CreateOutletModal } from '@/components/outlets/outlet-form';
import { OverdueTab } from '@/components/outlets/overdue-tab';
import { Button, PageHeader, Tabs, type TabItem } from '@/components/ui';
import type { Project } from '@/lib/types';

type TabId = 'todas' | 'aprovacao' | 'atraso' | 'perto';

export function OutletsScreen() {
  return <RequireProject>{(project) => <OutletsContent key={project.id} project={project} />}</RequireProject>;
}

function OutletsContent({ project }: { project: Project }) {
  const [tab, setTab] = useState<TabId>('todas');
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const pending = usePendingOutlets(project.id);
  const pendingCount = pending.data?.meta.total;

  const tabs: TabItem<TabId>[] = [
    { id: 'todas', label: 'Todas', icon: Store },
    { id: 'aprovacao', label: 'A aguardar aprovação', icon: Hourglass, count: pendingCount },
    { id: 'atraso', label: 'Visita em atraso', icon: AlarmClock },
    { id: 'perto', label: 'Perto de mim', icon: LocateFixed },
  ];

  return (
    <div>
      <PageHeader
        icon={Store}
        eyebrow={project.name}
        title="Lojas"
        description="Os seus clientes no terreno: pesquise, veja no mapa, aprove lojas novas e acompanhe saldos e cobranças."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
            Nova loja
          </Button>
        }
      />

      <Tabs tabs={tabs} value={tab} onChange={setTab} className="mb-5" />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          role="tabpanel"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ type: 'spring', stiffness: 400, damping: 34 }}
        >
          {tab === 'todas' ? (
            <AllOutletsTab projectId={project.id} onOpen={setOpenId} onCreate={() => setCreating(true)} />
          ) : tab === 'aprovacao' ? (
            <ApprovalTab projectId={project.id} onOpen={setOpenId} />
          ) : tab === 'atraso' ? (
            <OverdueTab projectId={project.id} onOpen={setOpenId} />
          ) : (
            <NearbyTab projectId={project.id} onOpen={setOpenId} />
          )}
        </motion.div>
      </AnimatePresence>

      <OutletDrawer outletId={openId} onClose={() => setOpenId(null)} />
      <CreateOutletModal projectId={project.id} open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
