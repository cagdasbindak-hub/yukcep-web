import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
                    <div className="bg-slate-800 p-6 rounded-2xl border border-red-500/30 max-w-md w-full text-center">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">⚠️</span>
                        </div>
                        <h1 className="text-xl font-bold text-white mb-2">Bir Hata Oluştu</h1>
                        <p className="text-slate-400 text-sm mb-4">
                            Uygulama beklenmedik bir hatayla karşılaştı. Lütfen sayfayı yenileyin.
                        </p>
                        <div className="bg-slate-900/50 p-3 rounded-lg text-left mb-4 overflow-auto max-h-32">
                            <code className="text-red-400 text-xs font-mono">
                                {this.state.error && this.state.error.toString()}
                            </code>
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all"
                        >
                            Sayfayı Yenile
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
