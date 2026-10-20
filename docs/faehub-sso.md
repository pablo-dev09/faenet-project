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
