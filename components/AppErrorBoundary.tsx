'use client';

import { Component, ErrorInfo, ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AgentScope] 页面渲染失败', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="content empty-state">
        <h1>页面暂时无法显示</h1>
        <p>当前页面数据或旧缓存结构不完整，系统已阻止错误继续扩散。</p>
        <button className="btn primary" onClick={() => window.location.reload()}>
          刷新页面
        </button>
        <button className="btn" onClick={() => { localStorage.removeItem('agentscope:state:v3'); window.location.href = '/'; }}>
          清理当前缓存并返回首页
        </button>
      </main>
    );
  }
}
