import type { ReactNode } from 'react';
import Navigation from '../Navigation';
import TopBar from './TopBar';

/**
 * Moldura da app (estilo "framed sheet"): barra lateral e barra de topo
 * partilham o fundo azul-gelo, sem linha entre elas; o trabalho fica numa
 * folha branca com 1px de borda e cantos de 16px, recuada 8px à direita e em
 * baixo. No telemóvel a folha é o ecrã inteiro e a navegação vai para baixo.
 */
export default function AppLayout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen bg-app-frame text-app-ink md:flex">
      <Navigation />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 bg-app-sheet pb-24 md:mb-2 md:mr-2 md:rounded-2xl md:border md:border-app-edge md:pb-0">
          <div className={`mx-auto w-full px-4 py-5 sm:px-6 md:px-8 md:py-7 ${wide ? 'max-w-[1400px]' : 'max-w-6xl'}`}>{children}</div>
        </main>
      </div>
    </div>
  );
}
