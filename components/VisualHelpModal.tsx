import React from 'react';

interface VisualHelpModalProps {
  data: { image: string; highlight: { x: number; y: number } } | null;
  onClose: () => void;
}

const VisualHelpModal: React.FC<VisualHelpModalProps> = ({ data, onClose }) => {
  if (!data) return null;

  const { image, highlight } = data;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <img src={image} alt="Screenshot with annotation" className="w-full h-full object-contain rounded-lg shadow-2xl" />
        
        {/* Highlighting Container */}
        { highlight.x >= 0 && highlight.y >= 0 && (
            <div 
              className="absolute" 
              style={{ 
                left: `${highlight.x * 100}%`, 
                top: `${highlight.y * 100}%`,
                transform: 'translate(-50%, -50%)' 
              }}
              title="Destaque da IA"
            >
                {/* Pulsing Circle */}
                <div className="w-20 h-20 border-4 border-red-500 rounded-full animate-ping absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-75"></div>
                <div className="w-20 h-20 border-4 border-red-500 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 shadow-[0_0_15px_rgba(255,0,0,0.8)]"></div>
                
                {/* Arrow Pointing Down at the circle */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 drop-shadow-lg animate-bounce">
                     <svg width="48" height="48" viewBox="0 0 24 24" fill="red" stroke="white" strokeWidth="1.5">
                        <path d="M12 2L12 18M12 18L5 11M12 18L19 11" strokeLinecap="round" strokeLinejoin="round"/>
                     </svg>
                </div>
            </div>
        )}
        
        <button onClick={onClose} className="absolute -top-4 -right-4 bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-full h-10 w-10 flex items-center justify-center text-2xl font-bold shadow-lg border-2 border-[var(--border-color)] hover:scale-110 transition-transform">&times;</button>
      </div>
    </div>
  );
};

export default VisualHelpModal;
