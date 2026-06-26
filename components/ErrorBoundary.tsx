import React, { Component } from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<any, any> {
  constructor(props: any) {
    super(props);
    (this as any).state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if ((this as any).state.hasError) {
      let errorMessage = "Ocorreu um erro inesperado.";
      try {
        const errorObj = JSON.parse((this as any).state.error.message);
        if (errorObj.error.includes("Missing or insufficient permissions")) {
          errorMessage = "Você não tem permissão para realizar esta operação ou acessar estes dados.";
        }
      } catch (e) {
        // Not a JSON error message
      }

      return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white p-4 text-center">
          <h1 className="text-2xl font-bold mb-4">Ops! Algo deu errado.</h1>
          <p className="mb-6 text-gray-400">{errorMessage}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Recarregar Aplicativo
          </button>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

export default ErrorBoundary;
