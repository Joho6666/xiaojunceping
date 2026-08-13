import './globals.css';
import './freeze.css';
import { AppProvider } from '../components/AppProvider';
import { Topbar } from '../components/Topbar';
export const metadata = { title: 'AgentScope · AI 项目智能评估', description: '从一个项目想法，到一套真正可执行的 AI 方案。' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="zh-CN"><body><AppProvider><Topbar />{children}</AppProvider></body></html>; }
