# Acesso exclusivo pelo FaeHub

Decisão do proprietário em 19/10/2026: alunos, professores, direção e responsáveis
ativos e ativados no FaeHub acessam esta comunidade com a conta central.

`FAEHUB_LOGIN_REQUIRED=1` fecha login/cadastro independentes e sessões antigas,
inclusive uploads. Antes da ativação coordenada o padrão 0 preserva a entrada
anterior. Requer migrations aplicadas, SECRET_KEY privada estável (32+ caracteres)
e FAEHUB_SSO_CLIENT_SECRET igual a FAEHUB_FAENET_CLIENT_SECRET do FaeHub.
Importar primeiro configuração FaeHub, aguardar Live, depois FaeNet e novo Live.
Não expor valores no Git/navegador/chat nem substituir variáveis de banco existentes.

Cliente fixo `faenet`; issuer https://faehub-plus.onrender.com; callback exato
https://faenet.onrender.com/auth/faehub/callback. Código 60s de uso único, PKCE S256
e estado vinculado à sessão. Ponte privada, não provedor genérico OAuth/OIDC.
Token opaco de 12h fica cifrado somente no servidor. Introspecção por API/upload
com timeout 8s: conta bloqueada/versão revogada nega acesso; indisponibilidade 503
não libera login local. Logout é local; nova entrada pode reutilizar sessão FaeHub.
Rotação do segredo exige reautenticação, sem apagar os vínculos.

Após autenticar, titular escolhe criar perfil ou vincular conta antiga comprovando
a senha privada e confirmando a consequência. Nunca vincular por nome coincidente.
Senhas demo públicas não comprovam titularidade. Cinco tentativas por confirmação,
dez por conta antiga/15min persistentes. Preservar perfil, publicações, relações e
mensagens; criar perfil não apaga contas anteriores nem habilita mesclagem futura.
FaeHub fornece UUID, nome, perfil e flag owner, não e-mail/notas/matrícula.
Somente owner é administrador social; diretores não recebem esse poder por perfil.

Recuperar senha/usuário se faz no FaeHub pelo e-mail confirmado; não criar uma
segunda recuperação local. Trocar senha revoga tokens sociais; MFA permanece ativo.
Se necessário rollback, preferir manutenção e não reabrir cadastro independente
sem decisão do proprietário. Validades lógicas existem; limpeza física periódica
das tabelas transitórias ainda não está agendada.

Verificação: `python -m unittest discover -s tests -v`; testes de integração em
`tests/test_federation.py`, incluindo preservação de publicações e falhas fechadas.
Fluxo navegador local validado em desktop e 390px, sucesso e erro no vínculo,
logout/reentrada. Confirmar o corte final em `/api/auth/options` e no fluxo real
somente após importar a configuração privada no Render.

## Perfil escolhido pelo titular — 20/10/2026

O primeiro acesso agora exige @ público (3–30 letras ASCII, números, ponto ou _)
único sem diferença de maiúsculas, e nome de exibição com nome e sobrenome.
Avatar, capa, bio (280), curso (80) e turma (100) são opcionais. Informações sociais
não alteram cadastro, permissões, senha ou autenticador do FaeHub.

`User.username` permanece chave interna imutável para preservar relações; `handle`
é a identidade pública escolhida. Não mostrar fh_UUID como @. URLs de perfil aceitam
handle ou ID interno; busca, feed, comentários e mensagens mostram o @ escolhido.
Nome legado continua reservado para impedir colisão entre os dois identificadores.

Migration `profile_onboarding` acrescenta campos e `profile_images`, sem apagar
registros. Somente contas fh_UUID que têm vínculo FaeHub ficam incompletas até
escolher identidade; contas anteriores mantêm o perfil. Sessão incompleta pode ler
o próprio bootstrap, concluir o perfil ou sair, mas APIs sociais recebem 428.
Próxima entrada redireciona `/auth/faehub/profile`. Editar perfil reutiliza o fluxo.

Fotos opcionais: servidor aceita JPEG/PNG/WebP decodificados até 5 MB/20MP, remove
metadados e gera JPEG avatar 320×320/capa 1280×480, máximo 400 KiB cada. Persistem no
PostgreSQL com RLS/Data API fechada, não no disco temporário do Render. Leitura de
imagem exige sessão FaeHub válida; rotas API não usam cache compartilhado.
Testes adicionais: `tests/test_onboarding.py` cobre escolhas, colisão, arquivos,
quatro perfis, rollback, edição e preservação de posts/seguidores/vínculo.
