# MedFlow — Manual de Instalação (Windows)

Este guia é para o **técnico** instalar o MedFlow em um computador Windows (ambiente local).

## 1) Requisitos

- Windows 10/11
- **Node.js LTS (recomendado: Node 20.x)** instalado (vem com o NPM)
  - Para confirmar, abra o **Prompt de Comando** e rode:
    - `node -v`
    - `npm -v`

> Dica: se o Windows perguntar sobre firewall quando o sistema iniciar, permita para **Rede Privada**.

## 2) Primeira instalação (passo a passo)

1. **Descompacte** o projeto em uma pasta fixa (ex.: `C:\MedFlow\`)
   - Evite colocar dentro de `Downloads` para não perder permissões/arquivos.
2. Entre na pasta do projeto (a pasta onde está o arquivo `package.json`).
3. Clique com o botão direito em **`Instalar-Atalho-Desktop.cmd`** e escolha:
   - **Executar como administrador** (recomendado em ambientes corporativos)
4. Na Área de Trabalho serão criados:
   - **MedFlow** (silencioso) — recomendado para o usuário final
   - **MedFlow (Console)** — opcional, para suporte/diagnóstico

## 3) Primeiro start do sistema

- Para iniciar:
  - Dê duplo clique no atalho **MedFlow**
- O sistema abre no navegador em:
  - `http://localhost:5000`

### O que acontece no primeiro start?
No primeiro start, se a pasta `node_modules` não existir, o MedFlow executa automaticamente:
- `npm install`
- depois `npm run dev`

Isso pode demorar alguns minutos dependendo da máquina e da internet.

## 4) Como parar o sistema

### Opção A (recomendada para suporte)
1. Inicie com **MedFlow (Console)**.
2. Para parar, use **Ctrl + C** no terminal.

### Opção B (quando iniciado “silencioso”)
1. Abra o **Gerenciador de Tarefas** (Ctrl + Shift + Esc).
2. Finalize o processo **Node.js** (geralmente `node.exe`).

## 5) Comandos úteis (linha de comando)

Abra o Prompt de Comando (ou PowerShell) **na raiz do projeto**.

### Instalar dependências manualmente
```bat
npm install
```

### Rodar o sistema (modo desenvolvimento)
```bat
npm run dev
```

## 6) Gerar chave de licença

O projeto já possui um script para gerar licença.

### Gerar licença por X dias
Exemplos:

```bat
npm run license:generate -- --days 30
```

ou (forma curta):

```bat
npm run license:generate -- 30
```

Após rodar, o terminal exibirá a chave.

### Importante sobre o segredo da licença
Na primeira geração, o sistema cria/usa um arquivo chamado:

- `.license_secret` (na raiz do projeto)

**Não apague esse arquivo**, porque ele é usado para validar as licenças geradas.

### Onde colar a chave
No sistema, vá em:
- **Admin → Licença**  
e cole a chave gerada para ativar.

## 7) Solução de problemas

### “npm não é reconhecido...”
- Node.js/NPM não está instalado (ou não está no PATH).
- Reinstale o Node LTS e reinicie o Windows.

### Porta 5000 ocupada
- Verifique se outro programa já está usando `localhost:5000`.
- Feche o programa concorrente ou altere a porta no projeto (se necessário).

### Atalho não cria / PowerShell bloqueado
- Execute `Instalar-Atalho-Desktop.cmd` como administrador.
- Se a política de execução for restrita, o instalador já usa `-ExecutionPolicy Bypass`, mas algumas empresas bloqueiam mesmo assim.
  - Alternativa: criar atalho manual apontando para `Iniciar-MedFlow.vbs` (com ícone `windows\medflow.ico`).

---
**Arquivos importantes na raiz**
- `Iniciar-MedFlow.cmd` — inicializador principal (instala dependências e roda o sistema)
- `Iniciar-MedFlow.vbs` — inicializador silencioso (usado pelo atalho do usuário)
- `Instalar-Atalho-Desktop.cmd` — cria os atalhos na Área de Trabalho
