# FaeNet — contrato de identidade

Público brasileiro ETESC, `pt-BR`, fuso America/Sao_Paulo, meta WCAG 2.2 AA.
Contrato da integração: `docs/faehub-sso.md` (decisão do titular em 19/10/2026).
Identidade visual: `DESIGN.md`, CSS canônico global/experience, sem rebrand.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Form | identidade server-rendered | `frontend/js/identity.js` | vincular / criar | `tests/test_federation.py` + navegador |
| Scrollbar | tema global | `frontend/css/global.css` | viewport / conteúdo | navegador e cores forçadas |
| CRUD | vínculo de identidade | `backend/services/federation.py` | criar vínculo sem mesclar dados | testes de preservação |

## Fontes de negócio

Permissão e ciclo de identidade: `docs/faehub-sso.md`; decisão explícita do
proprietário, revisada 19/10/2026. Não há alteração de cobrança, exclusão ou
retenção de publicações neste fluxo. Não inventar termos legais.

## Fluxos e recuperação

| Operação | Pendente | Sucesso | Falha |
|---|---|---|---|
| Entrar com FaeHub | CTA ocupado | FaeHub, depois destino interno validado | erro acionável / tentar novamente |
| Vincular conta antiga | botão único ocupado | feed/destino, perfil preservado | username preservado, senha limpa, erro no topo |
| Criar perfil | envio único | feed/destino | nenhum vínculo parcial, recomeçar |
| Conta bloqueada / senha alterada | revalidação no servidor | nenhuma liberação indevida | 401 e nova confirmação |
| FaeHub fora do ar | não fornecer dados protegidos | revalidar depois | 503, sem login local como atalho |

Formulários usam novalidate, rótulos reais, resumo associado, foco no primeiro
campo inválido ou erro do servidor. Senha é mascarada/revelável e não é retida
na resposta, URL, logs nem storage. Confirmação da vinculação diz exatamente
qual conta será acessada pelo FaeHub; não há popup nativo. Botões mantêm dimensões,
voltar restaura estado disponível. A opção criar não apaga registros antigos.
Títulos distinguem entrada e confirmação; navegação mantém rolagem natural no
celular. Sem menus/data/tabelas novos, não há novo Select/Date para padronizar.

UI é pessimista. Callback usa código opaco de uso único e PKCE; nenhum bearer
token/segredo entra na URL ou no storage do navegador. A sessão contém só ID
opaco, e o token fica cifrado no servidor. Usuários sem acesso recebem erro
com caminho para a entrada, não uma tela de cadastro independente.

## Rollout e verificação

`FAEHUB_LOGIN_REQUIRED=0` preserva o comportamento anterior somente durante o
deploy coordenado. Ativar após migrations, código e segredo nos dois servidores.
Depois de ativar, login/cadastro locais e sessões antigas não liberam APIs nem
uploads. Testes: `python -m unittest discover -s tests -v`; auditoria premium
estática e fluxo navegador local com bancos descartáveis em desktop/celular.

Auditoria estática: `affordance.actionless-button` no controle de revelar senha
é falso positivo do parser (não resolve listeners externos). Owner real em
`identity.js`; clique no navegador confirmou tipo password → text, label
Mostrar → Ocultar e aria-pressed. Não inserir JavaScript inline só para satisfazer
esse detector. Demais regras estáticas foram verificadas; não confundir esse
resultado com certificação integral de acessibilidade.
