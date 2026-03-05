# 🎨 Make Your Poster

Transforme **uma única imagem** em um pôster grande dividido em até **6 páginas para impressão**, com edição visual por página e exportação compactada em `.zip`.

> Aplicação **100% front-end**, sem backend: todo o processamento acontece localmente no navegador.

---

## 🚀 Visão geral

O **Make Your Poster** é um editor web para quem quer imprimir imagens em formato de pôster usando folhas separadas. A proposta é simples: você envia uma imagem, ajusta os parâmetros visuais e gera as páginas prontas para impressão.

### O que torna o projeto útil

| Valor | Como isso aparece no app |
|---|---|
| Privacidade | A imagem é processada localmente no navegador (sem upload para servidor). |
| Controle fino | Ajustes de nitidez, contraste, saturação, redimensionamento, orientação e margem. |
| Precisão por página | Editor individual com arraste de crop e desfazer por página. |
| Saída prática | Geração em JPG, PNG ou PDF com download em arquivo ZIP. |

---

## ✨ Funcionalidades reais implementadas

### Entrada e preview

- ✅ Upload de imagem `JPG` e `PNG`
- ✅ Preview em `canvas`
- ✅ Grade de divisão por páginas (até 6)

### Ajustes globais do poster

- ✅ Quantidade de páginas: **1 a 6**
- ✅ Orientação: **vertical** ou **horizontal**
- ✅ Margem em **mm**
- ✅ Filtros e processamento:
  - Nitidez
  - Contraste
  - Saturação
  - Redimensionamento (%)

### Editor por página

- ✅ Seleção individual de página (`P1`, `P2`, ...)
- ✅ Arraste para reposicionar o crop
- ✅ Histórico de desfazer por página
- ✅ Miniaturas com offsets aplicados

### Exportação

- ✅ Seletor de formato de saída (`JPG`, `PNG`, `PDF`)
- ✅ Geração e download em **ZIP**
- ✅ PDF com ajuste de página para impressão (A4 no jsPDF)

### UX e robustez

- ✅ Tema **claro/escuro** com persistência local
- ✅ Alertas com **SweetAlert2** e fallback para `window.alert`
- ✅ Alertas de runtime quando dependências externas não carregam
- ✅ Fila de renderização com `requestAnimationFrame`

---

## 🧱 Stack e dependências

### Base do projeto

| Camada | Tecnologia |
|---|---|
| Estrutura | HTML (`index.html`) |
| Lógica | JavaScript puro (`src/js/app.js`) |
| Renderização | Canvas API |
| Estilo | Tailwind CSS (via CDN) |

### Dependências via CDN

| Biblioteca | Uso no projeto |
|---|---|
| Tailwind CSS | Estilização da interface |
| SweetAlert2 | Modais e mensagens de feedback |
| JSZip | Compactação e download de arquivos em `.zip` |
| jsPDF | Montagem de saída em PDF |

---

## 🧭 Arquitetura resumida

```text
MakeYourPoster/
├─ index.html          # Estrutura da UI, controles e carregamento de CDNs
└─ src/
   └─ js/
      └─ app.js        # Estado global, renderização em canvas, editor por página e exportação
```

### Fluxo interno (alto nível)

1. Upload da imagem e validações de tipo/tamanho/dimensão.
2. Aplicação de ajustes globais (filtros, orientação, resize).
3. Cálculo de grid de páginas e offsets por página.
4. Renderização de preview + editor individual.
5. Exportação para formato escolhido e compactação em ZIP.

---

## 🛠️ Como usar (passo a passo)

Checklist rápido de uso:

1. ✅ Clique em **Upload (JPG ou PNG)**.
2. ✅ Defina a quantidade de páginas (1–6).
3. ✅ Escolha orientação do poster.
4. ✅ Ajuste margem, nitidez, contraste, saturação e redimensionamento.
5. ✅ (Opcional) Edite páginas individualmente arrastando o crop.
6. ✅ Clique em **Confirmar e gerar poster**.
7. ✅ Selecione `JPG`, `PNG` ou `PDF` e baixe o `.zip`.

---

## ▶️ Instalação e execução local

Como é um projeto estático, você pode rodar de forma simples:

### Opção 1 — Abrir direto no navegador

- Abra o arquivo `index.html`.

### Opção 2 — Servidor local estático (recomendado)

Use qualquer servidor estático (ex.: extensão Live Server do VS Code ou servidor HTTP simples).

> Não há backend, banco de dados ou variáveis de ambiente obrigatórias para executar o app.

---

## 🧪 Limites e validações atuais

| Regra | Valor implementado |
|---|---|
| Tipos aceitos | `image/jpeg`, `image/png` |
| Tamanho máximo do arquivo | `25 MB` |
| Dimensão máxima da imagem | `12000 px` no maior lado |
| Quantidade de páginas | mínimo `1`, máximo `6` |
| Margem | `0` a `20 mm` |
| Redimensionamento | `25%` a `200%` |
| Contraste | `50%` a `200%` |
| Saturação | `0%` a `200%` |
| Nitidez | `0` a `100` |

---

## ❓ FAQ curto

### O app envia minha imagem para algum servidor?

Não. O processamento é local no navegador.

### Quantas páginas posso gerar?

Até 6 páginas.

### Posso corrigir apenas uma página?

Sim. Há editor individual por página com arraste de crop e opção de desfazer.

---

## 🗺️ Roadmap sugerido

Ideias de evolução (não necessariamente implementadas ainda):

- [ ] Presets de tamanho de papel (A3, A4, Letter, etc.)
- [ ] Guias de sobreposição para facilitar montagem física do pôster
- [ ] Exportação de projeto (salvar/restaurar configurações)
- [ ] Atalhos de teclado para fluxo de edição
- [ ] Internacionalização (pt-BR/en-US)

---

## 🤝 Contribuição

Contribuições são bem-vindas.

Sugestão de fluxo:

1. Faça um fork do repositório.
2. Crie uma branch para sua melhoria.
3. Implemente e valide localmente.
4. Abra um Pull Request com contexto claro da mudança.

---

## 📄 Licença

**A definir.**

Se uma licença for adicionada ao repositório, esta seção deve ser atualizada para refletir o arquivo oficial.
