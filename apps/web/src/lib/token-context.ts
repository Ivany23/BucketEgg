'use client';

import { createContext } from 'react';

/** Token da sessão atual (null sem sessão ou ainda por ler). Os pedidos à API só partem com token. */
export const TokenContext = createContext<string | null>(null);
