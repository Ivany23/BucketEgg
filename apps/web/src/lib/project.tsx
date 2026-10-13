'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useApi } from './query';
import { useSession } from './session';
import type { Project } from './types';

interface ProjectState {
  projects: Project[];
  loading: boolean;
  project: Project | null;
  projectId: string | null;
  setProjectId: (id: string) => void;
}

const ProjectContext = createContext<ProjectState | null>(null);
const keyFor = (orgId: string) => `bucketegg.project.${orgId}`;

/** Projeto (campanha) ativo: escolhido no topo e lembrado por organização neste browser. */
export function ProjectProvider({ children }: { children: ReactNode }) {
  const { organizationId, loading: sessionLoading } = useSession();
  const q = useApi<Project[]>(['projects', organizationId], organizationId ? '/projects' : null);
  // A escolha guardada só existe no browser; a organização só é conhecida lá (sem token no servidor).
  const [picked, setPicked] = useState<{ orgId: string; id: string } | null>(null);
  const stored = useMemo(() => {
    if (!organizationId || typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(keyFor(organizationId));
    } catch {
      return null;
    }
  }, [organizationId]);
  const chosen = picked && picked.orgId === organizationId ? picked.id : stored;

  const setProjectId = useCallback(
    (id: string) => {
      if (!organizationId) return;
      setPicked({ orgId: organizationId, id });
      try {
        window.localStorage.setItem(keyFor(organizationId), id);
      } catch {
        // sem armazenamento: escolha vale só nesta página
      }
    },
    [organizationId],
  );

  const value = useMemo<ProjectState>(() => {
    const projects = (q.data ?? []).filter((p) => !p.isArchived);
    // Por omissão, o projeto com mais atividade.
    const fallback = [...projects].sort((a, b) => (b._count?.outlets ?? 0) - (a._count?.outlets ?? 0))[0] ?? null;
    const project = projects.find((p) => p.id === chosen) ?? fallback;
    // A carregar enquanto a sessão ou a lista de projetos não chegaram (evita "sem projetos" a piscar).
    return { projects, loading: sessionLoading || !organizationId || q.isPending, project, projectId: project?.id ?? null, setProjectId };
  }, [q.data, q.isPending, organizationId, sessionLoading, chosen, setProjectId]);

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject(): ProjectState {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject fora do ProjectProvider');
  return ctx;
}
