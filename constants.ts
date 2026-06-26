import { Agent } from './types';

export const SYSTEM_AGENTS = [
    {
        id: 'default' as Agent,
        name: 'Assistente Padrão',
        description: 'O assistente padrão, versátil para guiá-lo em qualquer site ou tarefa com assistência visual e de voz.',
        keywords: ['padrao', 'normal', 'inicio', 'voltar', 'geral', 'default', 'assistente', 'comum', 'principal'],
        icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
    },
    {
        id: 'social_media' as Agent,
        name: 'Especialista em Mídias Sociais',
        description: 'Analisa seus painéis de métricas, busca tendências na web e fornece estratégias para crescimento.',
        keywords: ['social', 'midia', 'instagram', 'facebook', 'tiktok', 'rede social', 'post', 'stories', 'marketing', 'influencer'],
        icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6'
    },
    {
        id: 'traffic_manager' as Agent,
        name: 'Andromeda Ads Operative',
        description: 'Especialista em Meta Ads focado em Criativos, CBO e Advantage+. Guia passo a passo como um GPS.',
        keywords: ['trafego', 'gestor', 'meta ads', 'facebook ads', 'anuncio', 'campanha', 'andromeda', 'ads', 'cbo', 'tráfego'],
        icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z'
    },
    {
        id: 'google_ads' as Agent,
        name: 'Especialista Google Ads',
        description: 'Cria, estrutura e otimiza campanhas de pesquisa com foco em ROI, palavras-chave e anúncios que convertem.',
        keywords: ['google', 'google ads', 'adwords', 'pesquisa', 'links patrocinados', 'youtube ads', 'g ads'],
        icon: 'M8 16l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
    },
    {
        id: 'programmer' as Agent,
        name: 'Agente Programador',
        description: 'Atua como um dev sênior, analisando código, debugando, sugerindo otimizações e auxiliando em plataformas no-code.',
        keywords: ['programador', 'dev', 'desenvolvedor', 'codigo', 'software', 'programacao', 'web', 'app', 'react', 'code', 'programmer', 'python', 'javascript', 'programação'],
        icon: 'M16 18l6-6-6-6M8 6l-6 6 6 6'
    },
    {
        id: 'rpa_specialist' as Agent,
        name: 'Especialista em RPA e Visão',
        description: 'Especialista em automação de processos (RPA) e visão computacional. Pode navegar na web, preencher formulários e extrair dados automaticamente.',
        keywords: ['rpa', 'automacao', 'navegador', 'browser', 'vision', 'visao', 'bot', 'robo', 'clicar', 'preencher', 'extrair', 'automação', 'visão'],
        icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'
    }
];
