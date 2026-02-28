import { Component, type ReactNode } from 'react';
import { GrandStateLogo } from './GrandStateLogo';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="text-center max-w-md space-y-6">
            <GrandStateLogo className="w-16 h-16 mx-auto opacity-50" />
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">เกิดข้อผิดพลาด</h1>
              <p className="text-muted-foreground text-sm">
                ระบบเกิดข้อผิดพลาดที่ไม่คาดคิด กรุณารีเฟรชหน้าเพื่อลองใหม่
              </p>
            </div>
            {this.state.error && (
              <pre className="text-[10px] text-left bg-muted/50 rounded-lg p-3 overflow-auto max-h-32 text-muted-foreground">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20"
              >
                รีเฟรชหน้า
              </button>
              <button
                onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/'; }}
                className="px-5 py-2.5 rounded-xl bg-muted text-foreground text-sm font-semibold hover:bg-muted/80 transition-colors"
              >
                กลับหน้าแรก
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground/50">Grand$tate v1.0</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
