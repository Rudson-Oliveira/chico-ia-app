import React, { useState } from 'react';
import FinancialReportCard from './FinancialReportCard';

interface FocoFlowItemRendererProps {
  data: any;
}

const FocoFlowItemRenderer: React.FC<FocoFlowItemRendererProps> = ({ data }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (data.category === 'reminder') {
    const date = new Date(data.reminderTime);
    return (
      <div className="bg-[var(--bg-tertiary)] border border-[var(--accent-primary)]/30 rounded-xl p-4 my-2 shadow-md hover:shadow-lg transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-[var(--accent-primary)]/20 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[var(--accent-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)]">Lembrete</span>
          </div>
          <span className="text-[10px] text-[var(--text-secondary)]">{date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <h4 className="text-lg font-bold text-[var(--text-primary)] mb-1">{data.title}</h4>
        {data.description && <p className="text-sm text-[var(--text-secondary)]">{data.description}</p>}
      </div>
    );
  }

  if (data.category === 'link') {
    return (
      <div className="bg-[var(--bg-tertiary)] border border-blue-500/30 rounded-xl p-4 my-2 shadow-md">
        <div className="flex items-center space-x-2 mb-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.826a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Link Salvo</span>
        </div>
        <h4 className="text-base font-bold text-[var(--text-primary)] mb-3">{data.title || 'Link'}</h4>
        <a 
          href={data.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center justify-center w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all shadow-md group"
        >
          <span>Abrir Link</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    );
  }

  if (data.category === 'transaction') {
    const isIncome = data.type === 'income';
    const date = data.date && typeof data.date.toDate === 'function' 
        ? data.date.toDate() 
        : new Date(data.date);
    
    return (
      <div className={`bg-[var(--bg-tertiary)] border ${isIncome ? 'border-green-500/30' : 'border-red-500/30'} rounded-xl p-4 my-2 shadow-md`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <div className={`p-2 ${isIncome ? 'bg-green-500/20' : 'bg-red-500/20'} rounded-lg`}>
              {isIncome ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                </svg>
              )}
            </div>
            <span className={`text-xs font-bold uppercase tracking-wider ${isIncome ? 'text-green-500' : 'text-red-500'}`}>
              {isIncome ? 'Receita' : 'Despesa'}
            </span>
          </div>
          <span className="text-[10px] text-[var(--text-secondary)]">
            {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div className="flex justify-between items-end">
            <div>
                <h4 className="text-lg font-bold text-[var(--text-primary)] mb-1">{data.description}</h4>
                {data.category_name && <span className="text-xs text-[var(--text-secondary)] bg-[var(--bg-primary)] px-2 py-1 rounded-full border border-[var(--border-color)]">{data.category_name}</span>}
                {data.paymentMethod && <span className="text-xs text-[var(--text-secondary)] ml-2">{data.paymentMethod}</span>}
            </div>
            <div className={`text-xl font-bold ${isIncome ? 'text-green-400' : 'text-red-400'}`}>
                {isIncome ? '+' : '-'} R$ {Number(data.amount).toFixed(2)}
            </div>
        </div>
      </div>
    );
  }

  if (data.category === 'copy' || data.category === 'email') {
    return (
      <div className="bg-[var(--bg-tertiary)] border border-emerald-500/30 rounded-xl p-4 my-2 shadow-md">
        <div className="flex items-center space-x-2 mb-3">
          <div className="p-2 bg-emerald-500/20 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">{data.category === 'email' ? 'E-mail' : 'Conteúdo'}</span>
        </div>
        <div className="bg-[var(--bg-primary)] p-3 rounded-lg border border-[var(--border-color)] mb-3 font-mono text-sm break-all">
          {data.content}
        </div>
        <button 
          onClick={() => handleCopy(data.content)}
          className={`flex items-center justify-center w-full py-2.5 px-4 font-bold rounded-lg transition-all shadow-md ${copied ? 'bg-emerald-600 text-white' : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-color)]'}`}
        >
          {copied ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
              <span>Copiado!</span>
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              <span>Copiar {data.category === 'email' ? 'E-mail' : 'Conteúdo'}</span>
            </>
          )}
        </button>
      </div>
    );
  }

  if (data.category === 'financial_report') {
    return <FinancialReportCard data={data} />;
  }

  return null;
};

export default FocoFlowItemRenderer;
