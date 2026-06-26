import React, { useState } from 'react';

interface CopyableContentBlockProps {
  content: string;
  blockType?: 'code' | 'text' | 'prompt';
}

const CopyableContentBlock: React.FC<CopyableContentBlockProps> = ({ content, blockType = 'code' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
    });
  };

  let titleText = "Conteúdo";
  switch (blockType) {
    case 'code':
      titleText = "Código";
      break;
    case 'text':
      titleText = "Texto para Copiar";
      break;
    case 'prompt':
      titleText = "Prompt para Copiar";
      break;
  }

  return (
    <div className="bg-black/50 rounded-lg overflow-hidden my-2 border border-[var(--border-color)]">
      <div className="flex justify-between items-center px-4 py-2 bg-gray-800/50">
        <span className="text-xs font-sans text-gray-400">{titleText}</span>
        <button onClick={handleCopy} className="flex items-center space-x-1.5 text-xs font-sans text-gray-300 hover:text-white transition-colors p-1 -m-1 rounded-md">
          {copied ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
              <span>Copiado!</span>
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              <span>Copiar</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 text-sm text-gray-300 overflow-x-auto font-mono bg-gray-900">
        <code>{content}</code>
      </pre>
    </div>
  );
};

export default CopyableContentBlock;
