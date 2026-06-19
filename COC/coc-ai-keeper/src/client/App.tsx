import { HomePage } from './pages/HomePage';
import { KeeperPage } from './pages/KeeperPage';
import { LibraryPage } from './pages/LibraryPage';
import { RoomPage } from './pages/RoomPage';

export function App() {
  const path = window.location.pathname;
  if (path.startsWith('/room/')) return <RoomPage roomId={decodeURIComponent(path.replace('/room/', ''))} />;
  if (path.startsWith('/keeper/')) return <KeeperPage roomId={decodeURIComponent(path.replace('/keeper/', ''))} />;
  if (path === '/library') return <LibraryPage />;
  return <HomePage />;
}
