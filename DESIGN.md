---
version: alpha
name: "FaeNet — comunidade do campus"
description: "Fotografia de campus, aurora azul-violeta e superfícies noturnas, preservando a identidade existente."
colors:
  primary: "#8a5cff"
  secondary: "#21b7f4"
  background: "#050817"
  surface: "rgba(12,18,44,0.82)"
  outline: "rgba(131,143,220,0.2)"
  text: "hsl(210 20% 96%)"
  danger: "hsl(0 72% 56%)"
typography:
  sans:
    fontFamily: "Inter, system-ui, Segoe UI, sans-serif"
  display:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
rounded:
  DEFAULT: "10px"
  lg: "14px"
  xl: "20px"
spacing:
  gap: "16px"
components:
  button:
    typography: "{typography.sans}"
    rounded: "{rounded.DEFAULT}"
  input:
    typography: "{typography.sans}"
    rounded: "{rounded.DEFAULT}"
---

# FaeNet Design System

## Overview

Comunidade acadêmica ETESC/FAETEC, em português brasileiro. Público: todos os
perfis ativos e ativados do FaeHub. Login é híbrido: fotografia e marca expressivas,
mas uma ação reconhecível. Vinculação é produto: prova de titularidade, consequências
claras e nenhum gesto escondido. Não redesenhar a marca para acrescentar autenticação.

Modelo B: CSS é canônico. `frontend/css/global.css` define fundamentos e
`experience.css` adapta a identidade aprovada. Os tokens primary, secondary,
background, surface e outline refletem `--primary`, `--primary-2`, `--bg`,
`--bg-elev`, `--line`. `identity.css` consome essas variáveis sem nova paleta.
Nome e turma ilustrativos não devem substituir os dados da conta.

## Colors

Azul-violeta/ciano conduzem a entrada. Superfície noturna permanece; erros têm
texto no banner e nos campos, nunca apenas cor. Scrollbars herdam os tokens
globais, com tratamento do sistema em cores forçadas.

## Typography

Space Grotesk nos títulos, Inter nos controles, com fallback do sistema e suporte
a nomes em português. Não converter nomes fornecidos pelo titular em HTML.

## Layout

Login preserva foto e painel já existentes. A confirmação de perfil usa coluna
até 36rem, margem móvel de 1rem e rolagem natural: nenhum campo ou ação é cortado.

## Elevation & Depth

Borda e superfície distinguem o formulário; o brilho do botão vem do owner
existente. Não criar gradientes ou animações paralelos para segurança.

## Shapes

Raios acompanham `--r-md`/`--r-lg`. Ícone da marca mantém suas dimensões reservadas.

## Components

`btn`, `field` e `field__input` são os owners visuais. A entrada SSO é um link
nomeado Entrar com FaeHub, não um formulário que coleta senha FaeHub. A vinculação
reutiliza campos e controles e é confirmada por checkbox com consequência explícita.
`identity.js` é owner comportamental dos formulários server-rendered de identidade;
`auth.js` permanece owner da entrada SPA. Erros inline reservam espaço, senhas
mascaradas têm revelação acessível; submit duplicado é impedido e BFCache restaura
controles. Não usar confirmação nativa do navegador. Movimento decorativo segue
o tema existente e sua redução de movimento.

## Do's and Don'ts

- Reutilizar fotografia, logo, tipografia e estados existentes.
- Distinguir senha antiga FaeNet da autenticação central FaeHub.
- Não juntar contas por username ou promover diretor a administrador social.
- Não mostrar contas demo ou cadastro independente durante o acesso exclusivo.
