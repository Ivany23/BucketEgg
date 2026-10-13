import { permanentRedirect } from 'next/navigation';

/** Endereço antigo: o ecrã de entrada passou para /entrar. */
export default function LegacyLogin() {
  permanentRedirect('/entrar');
}
