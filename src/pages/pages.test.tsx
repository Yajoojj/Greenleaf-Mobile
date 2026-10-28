import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect } from 'react';
import { useSession } from '../app/session';
import { PredictionError } from '../domain/errors';
import { DiagnosisBadge } from '../ui';
import { analysis, axeViolations, fakeServices, prediction, renderPage } from '../test/utils';
import { DiagnosisView } from './parts/DiagnosisView';
import { HistoryPage } from './HistoryPage';
import { HomePage } from './HomePage';
import { ProcessingPage } from './ProcessingPage';
import { ResultPage } from './ResultPage';
import { AuthPage } from './AuthPage';
import { WelcomePage } from './WelcomePage';
import { SupportPage } from './SupportPage';
import { LearnPage } from './LearnPage';
import { ProfilePage } from './ProfilePage';
import type { Analysis } from '../domain/types';

describe('DiagnosisBadge', () => {
  it.each([
    ['sadia', 'Sadia'],
    ['leve', 'Leve'],
    ['moderada', 'Moderada'],
    ['grave', 'Grave'],
  ] as const)('%s mostra texto + ícone', (state, label) => {
    const { container } = renderPage(<DiagnosisBadge state={state} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeNull();
  });
});

describe('DiagnosisView', () => {
  it('folha sadia nunca mostra severidade', () => {
    renderPage(<DiagnosisView analysis={analysis({ state: 'sadia', severity: null, probability: 0.02, ratio: 0.004 })} />);
    expect(screen.getByText('A folha parece sadia.')).toBeInTheDocument();
    const head = screen.getByText('A folha parece sadia.').closest('section')!;
    // único destaque é "Sadia"; a escala lista os 4 rótulos mas só Sadia é o atual
    expect(within(head).getAllByText('Sadia')[0]).toBeInTheDocument();
    expect(head.querySelector('[aria-current="true"]')?.textContent).toBe('Sadia');
    expect(screen.queryByText(/Sinais/)).toBeNull();
  });

  it('mostra o nível de risco (a porcentagem fica nos detalhes técnicos), aviso de estimativa, taxa e o que fazer', () => {
    renderPage(<DiagnosisView analysis={analysis()} />);
    expect(screen.getByText('Médio')).toBeInTheDocument();
    expect(screen.getByText('Risco de bacteriose')).toBeInTheDocument();
    const details = screen.getByText('Detalhes técnicos').closest('details')!;
    expect(within(details).getByText('42%')).toBeInTheDocument();
    expect(screen.getByText('7,8%')).toBeInTheDocument();
    expect(screen.getByText(/Estimativa — não substitui a avaliação de um agrônomo/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /O que fazer agora/ })).toBeInTheDocument();
    expect(screen.getByText(/não substitui a avaliação de um agrônomo nem um exame de laboratório/)).toBeInTheDocument();
    expect(screen.queryByText('Análise feita apenas pela cor das manchas.')).toBeNull();
  });

  it('avisa quando a análise foi só pela cor (model_probability null)', () => {
    renderPage(<DiagnosisView analysis={analysis({ modelProbability: null })} />);
    expect(screen.getByText('Análise feita apenas pela cor das manchas.')).toBeInTheDocument();
  });

  it('alterna entre área destacada e foto original, com legenda', async () => {
    renderPage(<DiagnosisView analysis={analysis()} />);
    expect(screen.getByAltText(/área suspeita destacada/)).toBeInTheDocument();
    expect(screen.getByText('Mancha suspeita')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Foto original/ }));
    expect(screen.getByAltText('Foto original da folha')).toBeInTheDocument();
  });

  it('sem violações de acessibilidade (axe)', async () => {
    const { container } = renderPage(<DiagnosisView analysis={analysis()} />);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('servidor v2: sem bacteriose mas com outra doença não diz "sadia"', async () => {
    const a = analysis({ state: 'sadia', severity: null, otherDisease: 'CMD', modelVersion: 'greenleaf_effb0-test' });
    const { container } = renderPage(<DiagnosisView analysis={a} />);
    expect(screen.queryByText('A folha parece sadia.')).toBeNull();
    expect(screen.getByText('Sem sinais de bacteriose, mas a folha tem sinais de outra doença.')).toBeInTheDocument();
    expect(screen.getByText('Sem bacteriose')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Possível outra doença/ })).toBeInTheDocument();
    expect(screen.getByText(/mosaico da mandioca/)).toBeInTheDocument();
    expect(screen.getByText('Região que mais pesou na decisão (aproximada)')).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });
});

/** Coloca um resultado na sessão antes de abrir a tela. */
function WithResult({ a, children }: { a: Analysis; children: React.ReactNode }) {
  const { setResult, result } = useSession();
  useEffect(() => setResult(a), [a, setResult]);
  return result ? <>{children}</> : null;
}

describe('ResultPage', () => {
  it('salva no histórico e mostra o selo de resultado simulado', async () => {
    const services = fakeServices();
    const a = analysis({ simulated: true });
    renderPage(<WithResult a={a}><ResultPage /></WithResult>, { services });
    expect(await screen.findByText('Resultado simulado')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Salvar no histórico/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Salvo no histórico/ })).toBeDisabled());
    expect(await services.analyses.get('a1')).not.toBeNull();
  });

  it('sem resultado mostra estado vazio', () => {
    renderPage(<ResultPage />);
    expect(screen.getByText('Nenhum resultado para mostrar.')).toBeInTheDocument();
  });
});

describe('HistoryPage', () => {
  it('estado vazio', async () => {
    renderPage(<HistoryPage />);
    expect(await screen.findByText('Nenhuma análise salva ainda.')).toBeInTheDocument();
  });

  it('lista e filtra por estado', async () => {
    const services = fakeServices();
    await services.analyses.save(analysis({ id: 'x1', state: 'grave', severity: 'Grave', createdAt: '2026-10-21T10:00:00Z' }));
    await services.analyses.save(analysis({ id: 'x2', state: 'sadia', severity: null, createdAt: '2026-10-22T10:00:00Z' }));
    renderPage(<HistoryPage />, { services });
    expect(await screen.findByText('2 análises')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Grave' }));
    expect(await screen.findByText('1 análise')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Moderada' }));
    expect(await screen.findByText('Nenhuma análise com esse resultado.')).toBeInTheDocument();
  });

  it('sem violações de acessibilidade (axe)', async () => {
    const services = fakeServices();
    await services.analyses.save(analysis());
    const { container } = renderPage(<HistoryPage />, { services });
    await screen.findByText('1 análise');
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('HomePage', () => {
  it('botão grande "Analisar folha", status do servidor e última análise', async () => {
    const services = fakeServices();
    await services.analyses.save(analysis({ state: 'leve', severity: 'Leve' }));
    renderPage(<HomePage />, { services });
    expect(screen.getByRole('link', { name: /Analisar folha/ })).toHaveAttribute('href', '/analisar');
    expect(await screen.findByText('Servidor de análise ligado')).toBeInTheDocument();
    expect(await screen.findByText('Leve')).toBeInTheDocument();
  });

  it('servidor dormindo aparece como "acordando"', async () => {
    const services = fakeServices({
      prediction: { predict: vi.fn(), health: vi.fn().mockRejectedValue(new PredictionError('sleeping')) },
    });
    renderPage(<HomePage />, { services });
    expect(await screen.findByText(/Servidor acordando/)).toBeInTheDocument();
  });

  it('modo demonstração mostra o selo e o botão de exemplo', () => {
    renderPage(<HomePage />, { services: fakeServices({ predictionMode: 'demo' }), settings: { demoMode: true } });
    expect(screen.getByText('Modo demonstração (sem internet)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Analisar folha de exemplo/ })).toBeInTheDocument();
  });
});

function WithCapture({ children }: { children: React.ReactNode }) {
  const { setCapture, capture } = useSession();
  useEffect(() => setCapture(new Blob([new Uint8Array([1])], { type: 'image/jpeg' }), 'gallery'), [setCapture]);
  return capture ? <>{children}</> : null;
}

describe('ProcessingPage', () => {
  it.each([
    ['offline', 'Sem internet agora'],
    ['invalid_image', 'O servidor não conseguiu ler essa foto'],
    ['too_large', 'A foto é grande demais'],
    ['sleeping', 'O servidor ainda está acordando'],
    ['network', 'A conexão falhou'],
  ] as const)('erro %s mostra mensagem amigável', async (kind, text) => {
    const services = fakeServices({ prediction: { predict: vi.fn().mockRejectedValue(new PredictionError(kind)), health: vi.fn() } });
    renderPage(<WithCapture><ProcessingPage /></WithCapture>, { services });
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
  });

  it('mostra as etapas e o aviso de demora após 5 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const services = fakeServices({ prediction: { predict: vi.fn(() => new Promise<never>(() => {})), health: vi.fn() } });
    renderPage(<WithCapture><ProcessingPage /></WithCapture>, { services });
    expect(await screen.findByText('Enviando a foto')).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(screen.getByText(/demorando mais que o normal/)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('sem foto mostra estado vazio', () => {
    renderPage(<ProcessingPage />);
    expect(screen.getByText('Nenhuma foto selecionada.')).toBeInTheDocument();
  });

  it('sucesso navega para o resultado', async () => {
    const services = fakeServices({ prediction: { predict: vi.fn().mockResolvedValue(prediction({ class: 'Saudavel', severity: 'Leve' })), health: vi.fn() } });
    renderPage(<WithCapture><ProcessingPage /></WithCapture>, { services });
    expect(await screen.findByText('outra rota')).toBeInTheDocument();
  });
});

describe('AuthPage', () => {
  it('"Usar sem conta" está sempre visível, nos dois modos', async () => {
    renderPage(<AuthPage />);
    expect(screen.getByRole('button', { name: 'Usar sem conta' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(screen.getByLabelText('Nome')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usar sem conta' })).toBeInTheDocument();
  });

  it('sem violações de acessibilidade (axe)', async () => {
    const { container } = renderPage(<AuthPage />);
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('demais telas', () => {
  it('boas-vindas tem 3 cartões navegáveis', async () => {
    renderPage(<WelcomePage />, { settings: { onboardingDone: false } });
    expect(screen.getByRole('heading', { name: 'Descubra se a folha tem bacteriose' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    expect(screen.getByRole('heading', { name: 'Uma boa foto faz diferença' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    expect(screen.getByRole('heading', { name: 'O resultado é uma estimativa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Começar' })).toBeInTheDocument();
  });

  it('suporte valida mensagem e envia', async () => {
    const services = fakeServices();
    renderPage(<SupportPage />, { services });
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(screen.getByText('Escreva sua mensagem.')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Fácil'));
    fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: 'Gostei do app' } });
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText('Obrigado! Recebemos sua mensagem.')).toBeInTheDocument();
    expect(services.feedback.send).toHaveBeenCalledWith(expect.objectContaining({ message: 'Gostei do app', rating: 4 }));
  });

  it('saiba mais e perfil sem violações de acessibilidade (axe)', async () => {
    const a = renderPage(<LearnPage />);
    expect(await axeViolations(a.container)).toEqual([]);
    a.unmount();
    const p = renderPage(<ProfilePage />);
    await screen.findByText('Usando sem conta');
    expect(await axeViolations(p.container)).toEqual([]);
  });

  it('perfil troca o idioma para inglês', async () => {
    renderPage(<ProfilePage />);
    await userEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByRole('heading', { name: 'Profile and settings' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
  });
});

describe('telas futuras (atrás de flag)', () => {
  it('mapa de calor deixa claro "Em breve" e dados fictícios', async () => {
    const { HeatmapPage } = await import('./HeatmapPage');
    const { container } = renderPage(<HeatmapPage />);
    expect(screen.getByText('Em breve')).toBeInTheDocument();
    expect(screen.getByText(/Dados fictícios/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Mapa ilustrativo do Vale do Ribeira/ })).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('consentimento de localização: recusar não pede permissão ao navegador', async () => {
    const { LocationConsentPage } = await import('./LocationConsentPage');
    const services = fakeServices();
    renderPage(<LocationConsentPage />, { services });
    expect(screen.getByText(/Se recusar, todas as funções continuam iguais/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Agora não' }));
    expect(services.location.requestConsent).not.toHaveBeenCalled();
    expect(services.location.revokeConsent).toHaveBeenCalled();
  });
});

describe('mapa de calor com dados reais', () => {
  it('sem "Em breve" nem aviso de fictício; desenha só as células agregadas', async () => {
    const { HeatmapPage } = await import('./HeatmapPage');
    const cells = vi.fn().mockResolvedValue([
      { latitude: -24.503, longitude: -47.858, total: 8, infected: 4 },
      { latitude: -24.413, longitude: -47.948, total: 5, infected: 0 },
    ]);
    const { container } = renderPage(<HeatmapPage />, { services: fakeServices({ heatmap: { simulated: false, cells } }) });
    expect(await screen.findByText(/Dados reais e agregados/)).toBeInTheDocument();
    expect(screen.queryByText('Em breve')).toBeNull();
    expect(screen.queryByText(/Dados fictícios/)).toBeNull();
    await waitFor(() => expect(container.querySelectorAll('circle[fill="url(#hot)"]').length).toBe(1));
    expect(await axeViolations(container)).toEqual([]);
  });

  it('sem células suficientes, avisa que ainda não há dados', async () => {
    const { HeatmapPage } = await import('./HeatmapPage');
    renderPage(<HeatmapPage />, { services: fakeServices({ heatmap: { simulated: false, cells: vi.fn().mockResolvedValue([]) } }) });
    expect(await screen.findByText(/Ainda não há análises suficientes/)).toBeInTheDocument();
  });
});

describe('HistorySyncPrompt (primeiro login com histórico local)', () => {
  const ana = { id: 'u-ana', name: 'Ana', email: 'ana@x.co', createdAt: '' };

  beforeEach(() => localStorage.clear());

  it('pergunta uma vez e envia ao confirmar', async () => {
    const { HistorySyncPrompt } = await import('../app/HistorySyncPrompt');
    const historySync = { pendingLocal: vi.fn().mockResolvedValue(3), uploadLocal: vi.fn().mockResolvedValue(3) };
    const services = fakeServices({ historySync, auth: { ...fakeServices().auth, currentUser: vi.fn().mockResolvedValue(ana) } });
    renderPage(<HistorySyncPrompt />, { services });
    expect(await screen.findByText('Enviar minhas análises deste aparelho para a conta? (3)')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Enviar para a conta' }));
    expect(historySync.uploadLocal).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('gl.sync.asked.u-ana')).toBe('1');
  });

  it('"Agora não" não envia e não pergunta de novo', async () => {
    const { HistorySyncPrompt } = await import('../app/HistorySyncPrompt');
    const historySync = { pendingLocal: vi.fn().mockResolvedValue(2), uploadLocal: vi.fn() };
    const services = fakeServices({ historySync, auth: { ...fakeServices().auth, currentUser: vi.fn().mockResolvedValue(ana) } });
    renderPage(<HistorySyncPrompt />, { services });
    await userEvent.click(await screen.findByRole('button', { name: 'Agora não' }));
    expect(historySync.uploadLocal).not.toHaveBeenCalled();
    expect(localStorage.getItem('gl.sync.asked.u-ana')).toBe('1');
  });

  it('sem back-end real, sem login ou sem análises locais, não aparece', async () => {
    const { HistorySyncPrompt } = await import('../app/HistorySyncPrompt');
    const historySync = { pendingLocal: vi.fn().mockResolvedValue(0), uploadLocal: vi.fn() };
    renderPage(<HistorySyncPrompt />, { services: fakeServices({ historySync }) });
    renderPage(<HistorySyncPrompt />, { services: fakeServices({ historySync, auth: { ...fakeServices().auth, currentUser: vi.fn().mockResolvedValue(ana) } }) });
    await waitFor(() => expect(historySync.pendingLocal).toHaveBeenCalled());
    expect(screen.queryByText(/Enviar minhas análises/)).toBeNull();
  });
});

describe('modo demonstração com respostas reais da IA v2', () => {
  it('5 exemplos, rotulados pelo resultado real, incluindo "Sem bacteriose"', async () => {
    const { CapturePage } = await import('./CapturePage');
    renderPage(<CapturePage />, { services: fakeServices({ predictionMode: 'demo' }), settings: { demoMode: true } });
    const tiles = screen.getAllByRole('button', { name: /Exemplo \d: / });
    expect(tiles).toHaveLength(5);
    expect(screen.getByRole('button', { name: /Exemplo 5: Sem bacteriose$/ })).toBeInTheDocument();
  });
});

describe('DiagnosisView — detalhes técnicos da IA v2', () => {
  it('mostra a classe mais provável e a porcentagem só nos detalhes', () => {
    const a = analysis({ probability: 0.33, state: 'leve', severity: 'Leve', topClass: { code: 'Healthy', label: 'Sadia', probability: 0.526 } });
    renderPage(<DiagnosisView analysis={a} />);
    expect(screen.getByText('Médio')).toBeInTheDocument();
    const details = screen.getByText('Detalhes técnicos').closest('details')!;
    expect(within(details).getByText('Classe mais provável (entre 5)')).toBeInTheDocument();
    expect(within(details).getByText('Sadia — 53%')).toBeInTheDocument();
    expect(within(details).getByText('33%')).toBeInTheDocument();
    expect(screen.getByText(/não substitui a avaliação de um agrônomo/, { selector: '.gl-disclaimer span' })).toBeInTheDocument();
  });
});
