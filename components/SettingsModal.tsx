import React from 'react';
import { User } from 'firebase/auth';
import { db, doc, updateDoc, handleFirestoreError, OperationType } from '../firebase';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User;
    chicoCustomName: string;
    setChicoCustomName: (val: string) => void;
    userPreferredName: string;
    setUserPreferredName: (val: string) => void;
    theme: string;
    setTheme: (val: string) => void;
    tempColor: string;
    setTempColor: (val: string) => void;
    setCustomThemeColor: (val: string) => void;
    onApplyTheme?: (theme: string | undefined, customColor: string | undefined) => void;
    voiceName: string;
    setVoiceName: (val: string) => void;
    integrations: any;
    setIntegrations: (val: any) => void;
    socialLinks: any;
    setSocialLinks: (val: any) => void;
    userApiKey?: string;
    onSaveApiKey?: (key: string) => void;
    validateApiKey?: (key: string) => Promise<{ valid: boolean; message?: string }>;
    userFirecrawlKey?: string;
    userSkyvernKey?: string;
    onSaveFirecrawlKey?: (key: string) => void;
    onSaveSkyvernKey?: (key: string) => void;
    userOpenRouterKey?: string;
    userOpenRouterModel?: string;
    onSaveOpenRouter?: (key: string, model: string) => void;
    onOpenArchived: () => void;
    onOpenFocoFlow: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen,
    onClose,
    user,
    chicoCustomName,
    setChicoCustomName,
    userPreferredName,
    setUserPreferredName,
    theme,
    setTheme,
    tempColor,
    setTempColor,
    setCustomThemeColor,
    onApplyTheme,
    voiceName,
    setVoiceName,
    integrations,
    setIntegrations,
    socialLinks,
    setSocialLinks,
    userApiKey,
    onSaveApiKey,
    validateApiKey,
    userFirecrawlKey,
    userSkyvernKey,
    onSaveFirecrawlKey,
    onSaveSkyvernKey,
    userOpenRouterKey,
    userOpenRouterModel,
    onSaveOpenRouter,
    onOpenArchived,
    onOpenFocoFlow
}) => {
    const [keyDraft, setKeyDraft] = React.useState(userApiKey || '');
    const [keyStatus, setKeyStatus] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [keyMsg, setKeyMsg] = React.useState('');
    const [fcDraft, setFcDraft] = React.useState(userFirecrawlKey || '');
    const [skDraft, setSkDraft] = React.useState(userSkyvernKey || '');
    const [orKeyDraft, setOrKeyDraft] = React.useState(userOpenRouterKey || '');
    const [orModelDraft, setOrModelDraft] = React.useState(userOpenRouterModel || '');
    const [svcMsg, setSvcMsg] = React.useState('');

    React.useEffect(() => {
        if (isOpen) {
            setKeyDraft(userApiKey || ''); setKeyStatus('idle'); setKeyMsg('');
            setFcDraft(userFirecrawlKey || ''); setSkDraft(userSkyvernKey || ''); setSvcMsg('');
            setOrKeyDraft(userOpenRouterKey || ''); setOrModelDraft(userOpenRouterModel || '');
        }
    }, [isOpen, userApiKey, userFirecrawlKey, userSkyvernKey, userOpenRouterKey, userOpenRouterModel]);

    const handleSaveKey = async () => {
        const k = keyDraft.trim();
        if (!k) {
            onSaveApiKey?.('');
            setKeyStatus('saved');
            setKeyMsg('Chave removida — usando a chave padrão do sistema.');
            return;
        }
        setKeyStatus('saving');
        setKeyMsg('Validando...');
        try {
            if (validateApiKey) {
                const res = await validateApiKey(k);
                if (!res.valid) { setKeyStatus('error'); setKeyMsg(res.message || 'Chave inválida.'); return; }
            }
            onSaveApiKey?.(k);
            setKeyStatus('saved');
            setKeyMsg('Chave salva e ativada! ✓');
        } catch (e: any) {
            setKeyStatus('error');
            setKeyMsg(e?.message || 'Erro ao validar a chave.');
        }
    };

    if (!isOpen) return null;

    const updateIntegrations = async (newIntegrations: any) => {
        setIntegrations(newIntegrations);
        const path = `users/${user.uid}`;
        try {
            await updateDoc(doc(db, 'users', user.uid), { integrations: newIntegrations });
        } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, path);
        }
    };

    const updateSocialLinks = async (newLinks: any) => {
        setSocialLinks(newLinks);
        const path = `users/${user.uid}`;
        try {
            await updateDoc(doc(db, 'users', user.uid), { socialLinks: newLinks });
        } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, path);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-[var(--bg-secondary)] p-8 rounded-2xl w-full max-w-md shadow-2xl border border-[var(--border-color)]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-[var(--text-primary)]">Configurações</h2>
                    <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-2xl">&times;</button>
                </div>
                
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                    {/* AI / API Key Section */}
                    <div className="bg-[var(--bg-primary)] p-4 rounded-lg border border-[var(--border-color)]">
                        <label className="block text-sm mb-2 text-[var(--text-secondary)] font-bold">Chave da API (Gemini)</label>
                        <p className="text-xs text-[var(--text-secondary)] mb-3">
                            Use sua própria chave do Google Gemini (começa com <code>AIzaSy…</code>). Fica salva apenas neste navegador e é usada na voz, no texto e na visão. Deixe em branco para usar a chave padrão do sistema.
                        </p>
                        <div className="flex gap-2">
                            <input
                                type="password"
                                value={keyDraft}
                                onChange={e => { setKeyDraft(e.target.value); setKeyStatus('idle'); setKeyMsg(''); }}
                                placeholder="AIzaSy..."
                                aria-label="Chave da API Gemini"
                                autoComplete="off"
                                className="flex-1 p-2 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                            />
                            <button
                                onClick={handleSaveKey}
                                disabled={keyStatus === 'saving'}
                                className="px-4 py-2 bg-[var(--accent-primary)] text-[var(--accent-primary-text)] rounded text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 whitespace-nowrap"
                            >
                                {keyStatus === 'saving' ? 'Validando...' : 'Salvar'}
                            </button>
                        </div>
                        {keyMsg && (
                            <p className={`text-xs mt-2 ${keyStatus === 'error' ? 'text-[var(--destructive-color)]' : 'text-[var(--success-color)]'}`}>{keyMsg}</p>
                        )}
                        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--accent-primary)] hover:underline mt-2 inline-block">
                            Onde pegar minha chave →
                        </a>
                    </div>

                    {/* Service Keys: Firecrawl + Skyvern */}
                    <div className="bg-[var(--bg-primary)] p-4 rounded-lg border border-[var(--border-color)] space-y-3">
                        <label className="block text-sm text-[var(--text-secondary)] font-bold">Chaves de Serviços Web</label>
                        <p className="text-xs text-[var(--text-secondary)]">Opcional. Use suas próprias chaves para leitura/busca web (Firecrawl) e automação autônoma (Skyvern). Ficam salvas neste navegador.</p>

                        <div>
                            <label className="block text-xs mb-1 text-[var(--text-secondary)]">Firecrawl (leitura/busca web)</label>
                            <div className="flex gap-2">
                                <input
                                    type="password"
                                    value={fcDraft}
                                    onChange={e => { setFcDraft(e.target.value); setSvcMsg(''); }}
                                    placeholder="fc-..."
                                    aria-label="Chave Firecrawl"
                                    autoComplete="off"
                                    className="flex-1 p-2 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                                />
                                <button
                                    onClick={() => { onSaveFirecrawlKey?.(fcDraft.trim()); setSvcMsg(fcDraft.trim() ? 'Firecrawl salva! ✓' : 'Firecrawl removida.'); }}
                                    className="px-3 py-2 bg-[var(--accent-primary)] text-[var(--accent-primary-text)] rounded text-sm font-bold hover:opacity-90 transition-opacity whitespace-nowrap"
                                >
                                    Salvar
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs mb-1 text-[var(--text-secondary)]">Skyvern (automação autônoma)</label>
                            <div className="flex gap-2">
                                <input
                                    type="password"
                                    value={skDraft}
                                    onChange={e => { setSkDraft(e.target.value); setSvcMsg(''); }}
                                    placeholder="Token Skyvern (x-api-key)"
                                    aria-label="Chave Skyvern"
                                    autoComplete="off"
                                    className="flex-1 p-2 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                                />
                                <button
                                    onClick={() => { onSaveSkyvernKey?.(skDraft.trim()); setSvcMsg(skDraft.trim() ? 'Skyvern salva! ✓' : 'Skyvern removida.'); }}
                                    className="px-3 py-2 bg-[var(--accent-primary)] text-[var(--accent-primary-text)] rounded text-sm font-bold hover:opacity-90 transition-opacity whitespace-nowrap"
                                >
                                    Salvar
                                </button>
                            </div>
                        </div>
                        {svcMsg && <p className="text-xs text-[var(--success-color)]">{svcMsg}</p>}
                    </div>

                    {/* OpenRouter: economia/fallback de LLM (texto) */}
                    <div className="bg-[var(--bg-primary)] p-4 rounded-lg border border-[var(--border-color)] space-y-3">
                        <label className="block text-sm text-[var(--text-secondary)] font-bold">OpenRouter (economia / plano B)</label>
                        <p className="text-xs text-[var(--text-secondary)]">Opcional. Se preenchido, o Chico usa o OpenRouter como <strong>fallback de texto</strong> caso o Gemini falhe (1 chave → vários modelos). Voz, visão e imagem continuam no Gemini.</p>
                        <div>
                            <label className="block text-xs mb-1 text-[var(--text-secondary)]">Chave OpenRouter</label>
                            <input
                                type="password"
                                value={orKeyDraft}
                                onChange={e => { setOrKeyDraft(e.target.value); setSvcMsg(''); }}
                                placeholder="sk-or-..."
                                aria-label="Chave OpenRouter"
                                autoComplete="off"
                                className="w-full p-2 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                            />
                        </div>
                        <div>
                            <label className="block text-xs mb-1 text-[var(--text-secondary)]">Modelo (opcional)</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={orModelDraft}
                                    onChange={e => { setOrModelDraft(e.target.value); setSvcMsg(''); }}
                                    placeholder="deepseek/deepseek-chat"
                                    aria-label="Modelo OpenRouter"
                                    autoComplete="off"
                                    className="flex-1 p-2 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                                />
                                <button
                                    onClick={() => { onSaveOpenRouter?.(orKeyDraft.trim(), orModelDraft.trim()); setSvcMsg(orKeyDraft.trim() ? 'OpenRouter salvo! ✓' : 'OpenRouter removido.'); }}
                                    className="px-3 py-2 bg-[var(--accent-primary)] text-[var(--accent-primary-text)] rounded text-sm font-bold hover:opacity-90 transition-opacity whitespace-nowrap"
                                >
                                    Salvar
                                </button>
                            </div>
                        </div>
                        {svcMsg && <p className="text-xs text-[var(--success-color)]">{svcMsg}</p>}
                    </div>

                    {/* Personalization Section */}
                    <div className="bg-[var(--bg-primary)] p-4 rounded-lg border border-[var(--border-color)]">
                        <label className="block text-sm mb-2 text-[var(--text-secondary)] font-bold">Personalização de Nomes</label>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs mb-1 text-[var(--text-secondary)]">Nome do Assistente</label>
                                <input 
                                    type="text" 
                                    value={chicoCustomName}
                                    onChange={async e => {
                                        const val = e.target.value;
                                        setChicoCustomName(val);
                                        const path = `users/${user.uid}`;
                                        try {
                                            await updateDoc(doc(db, 'users', user.uid), { chicoCustomName: val });
                                        } catch (error) {
                                            handleFirestoreError(error, OperationType.UPDATE, path);
                                        }
                                    }}
                                    placeholder="Ex: Chico"
                                    className="w-full p-2 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs mb-1 text-[var(--text-secondary)]">Como devo te chamar?</label>
                                <input 
                                    type="text" 
                                    value={userPreferredName}
                                    onChange={async e => {
                                        const val = e.target.value;
                                        setUserPreferredName(val);
                                        const path = `users/${user.uid}`;
                                        try {
                                            await updateDoc(doc(db, 'users', user.uid), { userPreferredName: val });
                                        } catch (error) {
                                            handleFirestoreError(error, OperationType.UPDATE, path);
                                        }
                                    }}
                                    placeholder="Seu nome"
                                    className="w-full p-2 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Social Links Section */}
                    <div className="bg-[var(--bg-primary)] p-4 rounded-lg border border-[var(--border-color)]">
                        <label className="block text-sm mb-2 text-[var(--text-secondary)] font-bold">Redes Sociais (Chico)</label>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs mb-1 text-[var(--text-secondary)]">Instagram</label>
                                <input 
                                    type="text" 
                                    value={socialLinks?.instagram || ''}
                                    onChange={e => updateSocialLinks({ ...socialLinks, instagram: e.target.value })}
                                    placeholder="Link do Instagram"
                                    className="w-full p-2 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs mb-1 text-[var(--text-secondary)]">Site</label>
                                <input 
                                    type="text" 
                                    value={socialLinks?.site || ''}
                                    onChange={e => updateSocialLinks({ ...socialLinks, site: e.target.value })}
                                    placeholder="Link do Site"
                                    className="w-full p-2 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs mb-1 text-[var(--text-secondary)]">Facebook</label>
                                <input 
                                    type="text" 
                                    value={socialLinks?.facebook || ''}
                                    onChange={e => updateSocialLinks({ ...socialLinks, facebook: e.target.value })}
                                    placeholder="Link do Facebook"
                                    className="w-full p-2 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm mb-1 text-[var(--text-secondary)]">Tema</label>
                        <select 
                            value={theme} 
                            onChange={async e => {
                                const newTheme = e.target.value;
                                setTheme(newTheme);
                                const path = `users/${user.uid}`;
                                try {
                                    await updateDoc(doc(db, 'users', user.uid), { theme: newTheme });
                                } catch (error) {
                                    handleFirestoreError(error, OperationType.UPDATE, path);
                                }
                            }}
                            className="w-full p-2 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                        >
                            <option value="dark">Escuro</option>
                            <option value="light">Claro</option>
                        </select>
                    </div>
                    
                    {/* Custom Color Picker */}
                    <div className="bg-[var(--bg-primary)] p-4 rounded-lg border border-[var(--border-color)]">
                        <label className="block text-sm mb-2 text-[var(--text-secondary)] font-bold">Personalizar Cor do Sistema</label>
                        <p className="text-xs text-[var(--text-secondary)] mb-3">Escolha uma cor para alterar todo o visual do Chico.</p>
                        
                        <div className="flex items-center gap-4">
                            <input 
                                type="color" 
                                value={tempColor}
                                onChange={(e) => {
                                    setTempColor(e.target.value);
                                    if (onApplyTheme) onApplyTheme(theme, e.target.value);
                                }}
                                className="h-12 w-12 cursor-pointer border-none bg-transparent rounded-full overflow-hidden shadow-sm"
                            />
                            <div className="flex-1">
                                <div className="text-sm font-mono text-[var(--text-primary)] mb-1">{tempColor}</div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={async () => {
                                            setCustomThemeColor(tempColor);
                                            if (onApplyTheme) onApplyTheme(theme, tempColor);
                                            const path = `users/${user.uid}`;
                                            try {
                                                await updateDoc(doc(db, 'users', user.uid), { customThemeColor: tempColor });
                                            } catch (error) {
                                                handleFirestoreError(error, OperationType.UPDATE, path);
                                            }
                                        }}
                                        className="px-3 py-1.5 bg-[var(--accent-primary)] text-[var(--accent-primary-text)] rounded text-xs font-bold hover:opacity-90 transition-opacity"
                                    >
                                        Aplicar Cor
                                    </button>
                                    <button 
                                        onClick={async () => {
                                            const defaultBlue = '#00B7FF';
                                            setTempColor(defaultBlue);
                                            setCustomThemeColor(defaultBlue);
                                            if (onApplyTheme) onApplyTheme(theme, defaultBlue);
                                            const path = `users/${user.uid}`;
                                            try {
                                                await updateDoc(doc(db, 'users', user.uid), { customThemeColor: defaultBlue });
                                            } catch (error) {
                                                handleFirestoreError(error, OperationType.UPDATE, path);
                                            }
                                        }}
                                        className="px-3 py-1.5 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded text-xs hover:text-[var(--text-primary)] transition-colors"
                                    >
                                        Restaurar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm mb-1 text-[var(--text-secondary)]">Voz do Sistema</label>
                        <select 
                            value={voiceName}
                            onChange={async e => {
                                const v = e.target.value;
                                setVoiceName(v);
                                const path = `users/${user.uid}`;
                                try {
                                    await updateDoc(doc(db, 'users', user.uid), { voiceName: v });
                                } catch (error) {
                                    handleFirestoreError(error, OperationType.UPDATE, path);
                                }
                            }}
                            className="w-full p-2 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                        >
                            <option value="Kore">Kore (Padrão - Feminina)</option>
                            <option value="Fenrir">Fenrir (Masculina Profunda)</option>
                            <option value="Puck">Puck (Masculina Suave)</option>
                            <option value="Charon">Charon (Masculina Séria)</option>
                            <option value="Aoede">Aoede (Feminina Suave)</option>
                        </select>
                    </div>

                    {/* Integrations Section */}
                    <div className="bg-[var(--bg-primary)] p-4 rounded-lg border border-[var(--border-color)] space-y-4">
                        <label className="block text-sm text-[var(--text-secondary)] font-bold">Integrações Externas</label>
                        
                        {/* OpenClaw */}
                        <div className="space-y-2 p-3 bg-[var(--bg-secondary)] rounded-md border border-[var(--border-color)]">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-[var(--text-primary)]">OpenClaw</span>
                                <input 
                                    type="checkbox" 
                                    checked={integrations?.openClaw?.enabled || false}
                                    onChange={e => updateIntegrations({
                                        ...integrations,
                                        openClaw: { ...integrations?.openClaw, enabled: e.target.checked }
                                    })}
                                    className="w-4 h-4 accent-[var(--accent-primary)]"
                                />
                            </div>
                            {integrations?.openClaw?.enabled && (
                                <div className="space-y-2 pt-2 border-t border-[var(--border-color)]">
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="checkbox" 
                                            checked={integrations?.openClaw?.useRemote || false}
                                            onChange={e => updateIntegrations({
                                                ...integrations,
                                                openClaw: { ...integrations?.openClaw, useRemote: e.target.checked }
                                            })}
                                            className="w-3 h-3 accent-[var(--accent-primary)]"
                                        />
                                        <span className="text-xs text-[var(--text-secondary)]">Usar Remoto</span>
                                    </div>
                                    <input 
                                        type="text" 
                                        value={integrations?.openClaw?.useRemote ? (integrations?.openClaw?.remoteUrl || '') : (integrations?.openClaw?.localUrl || '')}
                                        onChange={e => {
                                            const val = e.target.value;
                                            const field = integrations?.openClaw?.useRemote ? 'remoteUrl' : 'localUrl';
                                            updateIntegrations({
                                                ...integrations,
                                                openClaw: { ...integrations?.openClaw, [field]: val }
                                            });
                                        }}
                                        placeholder={integrations?.openClaw?.useRemote ? "URL Remota" : "URL Local (ex: http://127.0.0.1:18789/...)"}
                                        className="w-full p-2 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-primary)]"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Ollama */}
                        <div className="space-y-2 p-3 bg-[var(--bg-secondary)] rounded-md border border-[var(--border-color)]">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-[var(--text-primary)]">Ollama</span>
                                <input 
                                    type="checkbox" 
                                    checked={integrations?.ollama?.enabled || false}
                                    onChange={e => updateIntegrations({
                                        ...integrations,
                                        ollama: { ...integrations?.ollama, enabled: e.target.checked }
                                    })}
                                    className="w-4 h-4 accent-[var(--accent-primary)]"
                                />
                            </div>
                            {integrations?.ollama?.enabled && (
                                <div className="pt-2 border-t border-[var(--border-color)]">
                                    <input 
                                        type="text" 
                                        value={integrations?.ollama?.url || ''}
                                        onChange={e => updateIntegrations({
                                            ...integrations,
                                            ollama: { ...integrations?.ollama, url: e.target.value }
                                        })}
                                        placeholder="URL do Ollama (ex: http://localhost:11434)"
                                        className="w-full p-2 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-primary)]"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Claude Code */}
                        <div className="space-y-2 p-3 bg-[var(--bg-secondary)] rounded-md border border-[var(--border-color)]">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-[var(--text-primary)]">Claude Code</span>
                                <input 
                                    type="checkbox" 
                                    checked={integrations?.claudeCode?.enabled || false}
                                    onChange={e => updateIntegrations({
                                        ...integrations,
                                        claudeCode: { ...integrations?.claudeCode, enabled: e.target.checked }
                                    })}
                                    className="w-4 h-4 accent-[var(--accent-primary)]"
                                />
                            </div>
                            {integrations?.claudeCode?.enabled && (
                                <div className="pt-2 border-t border-[var(--border-color)]">
                                    <input 
                                        type="password" 
                                        value={integrations?.claudeCode?.apiKey || ''}
                                        onChange={e => updateIntegrations({
                                            ...integrations,
                                            claudeCode: { ...integrations?.claudeCode, apiKey: e.target.value }
                                        })}
                                        placeholder="API Key do Claude"
                                        className="w-full p-2 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-primary)]"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-[var(--border-color)] space-y-2">
                        <button 
                            onClick={onOpenFocoFlow}
                            className="w-full py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-primary-text)] rounded-lg transition-colors flex items-center justify-center gap-2 font-bold text-sm"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            Integração FocoFlow
                        </button>
                        <button 
                            onClick={onOpenArchived}
                            className="w-full py-2 text-[var(--accent-primary)] hover:underline text-sm font-semibold text-left"
                        >
                            Conversas Arquivadas
                        </button>
                        <a href="/#/ajuda-e-suporte" className="block py-1 text-[var(--accent-primary)] hover:underline text-sm">Ajuda e Suporte</a>
                        <a href="/#/termos-e-condicoes" className="block py-1 text-[var(--accent-primary)] hover:underline text-sm">Termos e Condições</a>
                        <a href="/#/seguranca" className="block py-1 text-[var(--accent-primary)] hover:underline text-sm">Segurança</a>
                        <a href="/#/comandos-de-voz" className="block py-1 text-[var(--accent-primary)] hover:underline text-sm">Guia de Comandos</a>
                    </div>
                </div>
                <button onClick={onClose} className="mt-6 w-full py-3 bg-[var(--bg-tertiary)] rounded-lg hover:bg-[var(--border-color)] transition-colors font-bold">Fechar</button>
            </div>
        </div>
    );
};

export default SettingsModal;
