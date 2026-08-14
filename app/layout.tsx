import './globals.css';
import './freeze.css';
import { AppProvider } from '../components/AppProvider';
import { Topbar } from '../components/Topbar';
import { AppErrorBoundary } from '../components/AppErrorBoundary';
export const metadata = { title: 'AgentScope · AI 项目智能评估', description: '从一个项目想法，到一套真正可执行的 AI 方案。' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="zh-CN"><body><AppErrorBoundary><AppProvider><Topbar />{children}</AppProvider></AppErrorBoundary></body></html>; }
