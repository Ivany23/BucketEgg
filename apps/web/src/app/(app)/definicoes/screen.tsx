'use client';

import { ArrowLeftRight, Building2, KeyRound, Palette, Settings, UserRound } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { PageHeader, Tabs, type TabItem } from '@/components/ui';
import { AppearanceTab } from './appearance-tab';
import { OrganizationTab } from './organization-tab';
import { OrganizationsTab } from './organizations-tab';
import { ProfileTab } from './profile-tab';
import { SecurityTab } from './security-tab';

type Tab = 'perfil' | 'seguranca' | 'organizacao' | 'organizacoes' | 'aparencia';

const TABS: TabItem<Tab>[] = [
  { id: 'perfil', label: 'Perfil', icon: UserRound },
  { id: 'seguranca', label: 'Segurança', icon: KeyRound },
  { id: 'organizacao', label: 'Organização', icon: Building2 },
  { id: 'organizacoes', label: 'Organizações', icon: ArrowLeftRight },
  { id: 'aparencia', label: 'Aparência', icon: Palette },
];

export function SettingsScreen() {
  const [tab, setTab] = useState<Tab>('perfil');
  const reduce = useReducedMotion();
  const label = TABS.find((t) => t.id === tab)?.label;
  return (
    <div>
      <PageHeader icon={Settings} title="Definições" description="O seu perfil, a segurança da conta, a organização e o aspeto da aplicação." />
      <Tabs tabs={TABS} value={tab} onChange={setTab} className="mb-6" />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          role="tabpanel"
          aria-label={label}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          {tab === 'perfil' ? <ProfileTab /> : null}
          {tab === 'seguranca' ? <SecurityTab /> : null}
          {tab === 'organizacao' ? <OrganizationTab /> : null}
          {tab === 'organizacoes' ? <OrganizationsTab /> : null}
          {tab === 'aparencia' ? <AppearanceTab /> : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
